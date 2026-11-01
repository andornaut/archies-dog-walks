import { laneMask } from "../layout/lanes";
import {
  fitsMoverSpot,
  keepMoverSpot,
  leavesPathOpen,
  type MoverBody,
  type MoverGrid,
  type MoverPlacement,
  type OnScreen,
  onScreenOf,
  ridersMeet,
  type RiderSpan,
  riderSpanOf,
  type Spot,
} from "./moverPlanning";
import { LaneBlocks, PlacedPlaces, SpawnCells } from "./spawnCells";
import type { FeasibilityObserver, FeasibilityWitness } from "./spawnFeasibilityDiagnostics";
import {
  fitsStanding,
  holdMoverRests,
  keepStanding,
  sharesRoad,
  type StandingFitContext,
} from "./spawnFeasibilityRules";
import {
  blockingLength,
  blockingPlace,
  blockingSpan,
  type Cell,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRests,
  pathChanges,
  pathHeldLanes,
  pickupAllowsMover,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
  zoneRows,
} from "./spawning";
import { auditHerringGeometry } from "./spawnMoverValidation";
import { type SpawnVisibilityTrace, visibilityRejection } from "./spawnVisibility";
import { rowsWithin, WHOLE_ZONE } from "./stretches";
export interface RepairEntry<Kind extends string> {
  readonly event: SpawnEvent<Kind>;
  readonly herring: boolean;
  readonly trace: SpawnVisibilityTrace;
  // New moving insertions retain their original compiled candidate, including stop.
  readonly placement?: MoverPlacement;
}
// Owners are a conservative witness for one failure, not a sufficient ejection set.
export interface RepairRejection {
  readonly classification: "intrinsic" | "conflict" | "unattributed";
  readonly conflicts: readonly string[];
  readonly rule: string;
  readonly witness?: { readonly row?: number; readonly moment?: number };
}
export type RepairInsertResult =
  { readonly accepted: true } | { readonly accepted: false; readonly failure: RepairRejection };
export interface RepairCheckpoint<Kind extends string> {
  readonly entries: readonly RepairEntry<Kind>[];
}
// The validated plan/path/ledger and all compiled entry objects remain immutable.
// Partial mode defers only stretch reachability until mandatory actors are restored.
// Neither mode replaces the independent audit required for final acceptance.
export function createRepairFeasibility<Kind extends string>(
  mode: "complete" | "partial",
  plan: SpawnPlan<Kind>,
  path: PlannedSpawns<Kind>["path"],
  validatedLedger: readonly RepairEntry<Kind>[],
) {
  return {
    without(requestIds: readonly string[]) {
      const excluded = new Set(requestIds);
      let entries = validatedLedger.filter((entry) => !excluded.has(identity(entry)));
      let board = new RepairBoard(mode, plan, path, entries);
      const owner = new WeakSet<object>();
      return {
        checkpoint(): RepairCheckpoint<Kind> {
          const checkpoint = { entries };
          owner.add(checkpoint);
          return checkpoint;
        },
        // Reports feasibility without retaining the candidate.
        probeDetailed(entry: RepairEntry<Kind>): RepairInsertResult {
          let failure: RepairRejection | undefined;
          if (
            !board.probe(entry, (value) => {
              failure ??= value;
            })
          ) {
            return {
              accepted: false,
              failure: failure ?? {
                classification: "unattributed",
                conflicts: [],
                rule: "unattributed",
              },
            };
          }
          return { accepted: true };
        },
        restore(checkpoint: RepairCheckpoint<Kind>): void {
          if (!owner.has(checkpoint)) {
            throw new Error("Checkpoint belongs to another repair transaction");
          }
          // Rehydration restores every reservation, including mover/rest/cap state.
          entries = [...checkpoint.entries];
          board = new RepairBoard(mode, plan, path, entries);
        },
        tryInsert(entry: RepairEntry<Kind>): boolean {
          if (!board.fits(entry)) {
            return false;
          }
          board.keep(entry);
          entries = [...entries, entry];
          return true;
        },
        tryInsertDetailed(entry: RepairEntry<Kind>): RepairInsertResult {
          let failure: RepairRejection | undefined;
          if (
            !board.probe(entry, (value) => {
              failure ??= value;
            })
          ) {
            return {
              accepted: false,
              failure: failure ?? {
                classification: "unattributed",
                conflicts: [],
                rule: "unattributed",
              },
            };
          }
          board.keep(entry);
          entries = [...entries, entry];
          return { accepted: true };
        },
      };
    },
  };
}
const identity = (entry: RepairEntry<string>) =>
  `${entry.trace.quotaIndex}:${entry.trace.memberIndex}`;
class RepairBoard<Kind extends string> {
  private observation: FeasibilityObserver | undefined;
  private readonly spacing: number;
  private readonly rows: readonly number[];
  private readonly cells: SpawnCells;
  private readonly lanes: LaneBlocks;
  private readonly places: PlacedPlaces;
  private readonly standingFit: StandingFitContext;
  private readonly entries: RepairEntry<Kind>[] = [];
  private readonly bodies: MoverBody[] = [];
  private readonly riders: RiderSpan[] = [];
  private readonly screens: OnScreen[] = [];
  private readonly prizeScreens: OnScreen[] = [];
  private readonly geometry;
  constructor(
    private readonly mode: "complete" | "partial",
    private readonly plan: SpawnPlan<Kind>,
    path: PlannedSpawns<Kind>["path"],
    entries: readonly RepairEntry<Kind>[],
  ) {
    this.spacing = rowSpacing(plan);
    this.rows = zoneRows(plan, this.spacing);
    const pathLanes = path.map((row) => row.lane);
    this.lanes = new LaneBlocks(plan, this.spacing, pathHeldLanes(pathLanes));
    this.places = new PlacedPlaces(plan, pathChanges(this.rows, pathLanes));
    // Completed-ledger relocation has no future mandatory-cell construction budget.
    // Physical availability and every collision/path/cap rule remain enforced.
    this.cells = new SpawnCells(this.rows.length, plan.laneCount, 0);
    this.geometry = { ...plan, rowSpacing: this.spacing, window: blockingLength(plan, 1) };
    this.standingFit = {
      canShow: (quota, cell) => this.canShow(this.standingTrace(quota, cell)),
      cells: this.cells,
      clearOfMovers: (cell, footprint) => {
        const from = this.rows[cell.row]!,
          to = from + hitLength(plan, footprint.rows);
        const clear = this.bodies.every(
          (body) =>
            !sharesRoad(
              { ...body, lanes: laneMask(body.lanes.first, body.lanes.count) },
              { from, lanes: laneMask(cell.lane, footprint.lanes), to },
            ),
        );
        if (!clear && this.observation !== undefined) {
          this.observation({
            requests: this.entries
              .filter((other) => {
                const body = other.trace.placement?.body;
                return (
                  this.quota(other)?.blocksLane &&
                  body !== undefined &&
                  sharesRoad(
                    { ...body, lanes: laneMask(body.lanes.first, body.lanes.count) },
                    { from, lanes: laneMask(cell.lane, footprint.lanes), to },
                  )
                );
              })
              .map(identity),
            rule: "body",
          });
        }
        return clear;
      },
      completeLaneCheck: true,
      laneMode: mode,
      lanes: this.lanes,
      places: this.places,
      plan,
      reject: (_kind, rule) => {
        this.observation?.({ intrinsic: rule === "outside-road" || rule === "outside-rows", rule });
        return false;
      },
      retainBlocks: true,
      rows: this.rows,
      spacing: this.spacing,
    };
    for (const entry of entries) {
      this.keep(entry);
    }
  }
  private quota(entry: RepairEntry<Kind>): SpawnQuota<Kind> | undefined {
    const { memberIndex, quotaIndex } = entry.trace;
    if (
      quotaIndex === undefined ||
      memberIndex === undefined ||
      !Number.isInteger(quotaIndex) ||
      !Number.isInteger(memberIndex)
    ) {
      return undefined;
    }
    const quota = this.plan.quotas[quotaIndex];
    return quota !== undefined &&
      memberIndex >= 0 &&
      memberIndex < quota.count &&
      quota.kind === entry.event.kind
      ? quota
      : undefined;
  }
  private canShow(trace: SpawnVisibilityTrace): boolean {
    return (
      !trace.hazard ||
      visibilityRejection(
        this.plan.scrollSpeed * this.plan.stepSeconds,
        this.entries.filter((entry) => entry.trace.hazard).map((entry) => entry.trace),
        trace,
        this.observation,
      ) === undefined
    );
  }
  private standingTrace(quota: SpawnQuota<string>, cell: Cell): SpawnVisibilityTrace {
    const entry = this.rows[cell.row]!,
      until =
        entry +
        this.plan.roadLength +
        (quota.hitLength ?? quotaFootprint(quota).rows * this.plan.cellLength);
    return {
      entry,
      hazard: quota.hazard ?? quota.blocksLane,
      index: 0,
      kind: quota.kind,
      lane: cell.lane,
      nativeUntil: until,
      row: Math.floor(entry / this.spacing),
      source: "events",
      until,
    };
  }
  private grid(quota: SpawnQuota<Kind>, entry: RepairEntry<Kind>): MoverGrid {
    const blocking = quota.blocksLane;
    return {
      block: (row, span, rows, keep, dart = false) => {
        if (!blocking) {
          return this.lanes.keepsAllLanesOpen(this.observation, this.mode);
        }
        const cell = { lane: span.first, row };
        const footprint = { lanes: span.count, rows };
        if (keep) {
          this.lanes.retainBlock(cell, footprint, dart);
          return true;
        }
        return this.lanes.tryBlock(cell, footprint, false, dart, true, this.observation, this.mode);
      },
      canShow: (_event, _interval, cells = []) =>
        this.canShow(entry.trace) &&
        this.entries.every((other) => {
          const q = this.quota(other);
          if (other.herring || other.event.mover !== undefined || q === undefined || q.blocksLane) {
            return true;
          }
          const footprint = quotaFootprint(q),
            row = this.rows.indexOf(other.event.distance),
            last = lastRowTaken(
              this.plan,
              this.spacing,
              { lane: other.event.lane, row },
              footprint,
              false,
            );
          const allowed = pickupAllowsMover(
            {
              firstRow: row,
              from: other.event.distance,
              lane: other.event.lane,
              lanes: footprint.lanes,
              lastRow: last,
              moversPassOver: q.moversPassOver === true,
              moversRestOn: q.moversRestOn === true,
              to: this.rows[last]!,
            },
            {
              blocksLane: blocking,
              cells,
              lanes: quotaFootprint(quota).lanes,
              rests: moverRests(this.plan.laneCount, entry.event.distance, entry.event.mover!),
            },
          );
          if (!allowed) {
            this.observation?.({ requests: [identity(other)], rule: "pickup" });
          }
          return allowed;
        }),
      clearOf: (body) =>
        this.entries.every((other) => {
          const q = this.quota(other);
          if (other.herring || other.event.mover !== undefined || !q?.blocksLane) {
            return true;
          }
          const footprint = quotaFootprint(q),
            from = other.event.distance,
            to = from + hitLength(this.plan, footprint.rows);
          const clear = !sharesRoad(
            { ...body, lanes: laneMask(body.lanes.first, body.lanes.count) },
            { from, lanes: laneMask(other.event.lane, footprint.lanes), to },
          );
          if (!clear) {
            this.observation?.({ requests: [identity(other)], rule: "body" });
          }
          return clear;
        }),
      clearOfRiders: (ride) =>
        !blocking ||
        this.riders.every((other) => {
          const clear = !ridersMeet(this.plan.riderFollowGap, ride, other);
          if (!clear && this.observation !== undefined) {
            this.observation({
              requests: this.entries
                .filter((entry) => {
                  const quota = this.quota(entry),
                    spot = this.spot(entry, true);
                  if (!quota?.blocksLane || quota.mover === undefined || spot === undefined) {
                    return false;
                  }
                  const span = riderSpanOf(
                    this.geometry,
                    quota.mover,
                    entry.event.distance,
                    spot.placement,
                  );
                  return (
                    span !== undefined &&
                    Object.entries(span).every(([key, value]) => Reflect.get(other, key) === value)
                  );
                })
                .map(identity),
              rule: "rider-gap",
            });
          }
          return clear;
        }),
      clearRun: (span, row) => this.lanes.clearRun(span, row),
      heldLanes: (row) => this.lanes.heldAt(row),
      isFree: (motion, lane, row) => {
        const free = this.cells.isFreeForRepair(motion, lane, row, blocking);
        if (!free) {
          this.observation?.({ mask: laneMask(lane, 1), row, rule: "cells" });
        }
        return free;
      },
      leavesRoom: (spots) => this.cells.leavesRoom(this.cells.untaken(spots)),
      occupy: (body) => {
        if (blocking) {
          this.bodies.push(body);
        }
      },
      onFailure: this.observation,
      packFits: (stands) => !blocking || this.places.fitsAll(stands, this.observation),
      rode: (ride) => {
        if (blocking) {
          this.riders.push(ride);
        }
      },
      stand: (stands) => {
        if (blocking) {
          for (const stand of stands) {
            this.places.add(stand);
          }
        }
      },
      take: (dart, lane, row, rider = false) =>
        blocking
          ? this.cells.takeMover(dart, lane, row, rider)
          : this.cells.takePrize(dart, lane, row),
    };
  }
  private spot(entry: RepairEntry<Kind>, hydrate: boolean): Spot | undefined {
    const proof = entry.trace.placement,
      row = proof?.block.row;
    if (
      proof === undefined ||
      row === undefined ||
      this.rows[row] === undefined ||
      entry.event.mover === undefined
    ) {
      return undefined;
    }
    const distance = this.rows[row]!;
    const placement =
      entry.placement ??
      (hydrate
        ? {
            appears: entry.event.distance - distance,
            cells: proof.cells.map((cell) => ({ ...cell, row: cell.row - row })),
            lane: entry.event.lane,
            lanes: proof.block.lanes,
            path: entry.event.mover,
            rows: proof.block.rows,
            ...(proof.body === undefined
              ? {}
              : {
                  body: {
                    ...proof.body,
                    from: proof.body.from - distance,
                    to: proof.body.to - distance,
                  },
                }),
            screen: [proof.screen[0] - distance, proof.screen[1] - distance] as const,
            stands: proof.stands.map((stand) => ({
              ...stand,
              distance: stand.distance - distance,
            })),
            ...(proof.selection === undefined ? {} : { selection: proof.selection }),
          }
        : undefined);
    return placement === undefined ? undefined : { distance, placement, row };
  }
  probe(entry: RepairEntry<Kind>, onFailure: (failure: RepairRejection) => void): boolean {
    let reported = false;
    this.observation = (witness) => {
      if (reported) {
        return;
      }
      reported = true;
      const conflicts = this.conflicts(entry, witness);
      onFailure({
        classification:
          witness.intrinsic === true
            ? "intrinsic"
            : conflicts.length > 0
              ? "conflict"
              : "unattributed",
        conflicts,
        rule: witness.rule,
        witness: {
          ...(witness.row === undefined ? {} : { row: witness.row }),
          ...(witness.moment === undefined ? {} : { moment: witness.moment }),
        },
      });
    };
    this.standingFit.onFailure = this.observation;
    try {
      return this.fits(entry);
    } finally {
      this.observation = undefined;
      delete this.standingFit.onFailure;
    }
  }

  private conflicts(candidate: RepairEntry<Kind>, witness: FeasibilityWitness): string[] {
    if (witness.intrinsic === true) {
      return [];
    }
    if (witness.requests !== undefined) {
      return [...new Set(witness.requests)];
    }
    const matches = this.entries.filter((entry) => {
      const quota = this.quota(entry);
      if (quota === undefined) {
        return false;
      }
      if (witness.contributors !== undefined) {
        if (witness.contributors.includes(entry.trace)) {
          return true;
        }
        if (
          witness.rule === "screen-cap" &&
          !entry.herring &&
          entry.event.mover !== undefined &&
          quota.blocksLane === this.quota(candidate)?.blocksLane
        ) {
          const screen = onScreenOf(
            entry.event.mover,
            entry.trace.placement?.screen ?? [entry.trace.entry, entry.trace.nativeUntil],
          );
          return witness.contributors.some((raw) => {
            const other = raw as OnScreen;
            return (
              other.dart === screen.dart &&
              other.slowVehicle === screen.slowVehicle &&
              other.interval[0] === screen.interval[0] &&
              other.interval[1] === screen.interval[1]
            );
          });
        }
        if (witness.rule === "pack-gap" && quota.blocksLane && !entry.herring) {
          const places =
            entry.event.mover === undefined
              ? [
                  blockingPlace(
                    this.plan,
                    this.rows,
                    quota,
                    { lane: entry.event.lane, row: this.rows.indexOf(entry.event.distance) },
                    quotaFootprint(quota),
                  ),
                ]
              : (entry.trace.placement?.stands ?? []);
          return places.some((place) =>
            witness.contributors!.some((raw) =>
              Object.entries(place).every(([key, value]) => Reflect.get(raw, key) === value),
            ),
          );
        }
        return false;
      }
      if (witness.rule === "rider-gap") {
        return quota.blocksLane && entry.event.mover?.motion === "ride";
      }
      if (witness.rule === "reservation") {
        return !entry.herring;
      }
      if (witness.row === undefined || entry.herring) {
        return false;
      }
      const footprint = quotaFootprint(quota);
      const row = entry.trace.placement?.block.row ?? this.rows.indexOf(entry.event.distance);
      if (witness.rule === "open-lanes") {
        if (!quota.blocksLane) {
          return false;
        }
        const span = blockingSpan(
          this.plan,
          this.spacing,
          row,
          entry.trace.placement?.block.rows ?? footprint.rows,
        );
        return (
          witness.row >= row && witness.row <= (witness.gap === true ? span.lastGap : span.lastRow)
        );
      }
      if (witness.rule === "wide-gap") {
        return (
          quota.blocksLane &&
          entry.event.mover === undefined &&
          footprint.lanes >= WIDE_LANES &&
          row <= (witness.lastRow ?? witness.row) + 1 &&
          lastHitRow(this.plan, this.spacing, { lane: entry.event.lane, row }, footprint) >=
            witness.row - 1
        );
      }
      if (witness.rule !== "cells" || witness.mask === undefined) {
        return false;
      }
      if (entry.event.mover === undefined) {
        return (
          witness.row >= row &&
          witness.row <=
            lastRowTaken(
              this.plan,
              this.spacing,
              { lane: entry.event.lane, row },
              footprint,
              quota.blocksLane,
            ) &&
          (laneMask(entry.event.lane, footprint.lanes) & witness.mask) !== 0
        );
      }
      if (
        entry.trace.placement?.cells.some(
          (cell) => cell.row === witness.row && (laneMask(cell.lane, 1) & witness.mask!) !== 0,
        )
      ) {
        return true;
      }
      const distance = this.rows[witness.row];
      if (distance === undefined) {
        return false;
      }
      let held = false;
      holdMoverRests(
        this.plan,
        [distance],
        {
          holdRest: (_row, mask) => {
            held ||= (mask & witness.mask!) !== 0;
          },
        },
        entry.event,
        footprint,
      );
      return held;
    });
    return [...new Set(matches.map(identity))];
  }

  fits(entry: RepairEntry<Kind>): boolean {
    const quota = this.quota(entry);
    if (quota === undefined) {
      this.observation?.({ intrinsic: true, rule: "request-identity" });
      return false;
    }
    if (this.entries.some((other) => identity(other) === identity(entry))) {
      this.observation?.({ requests: [identity(entry)], rule: "duplicate-request" });
      return false;
    }
    if (
      entry.trace.entry !== entry.event.distance ||
      entry.trace.kind !== entry.event.kind ||
      entry.trace.lane !== entry.event.lane
    ) {
      this.observation?.({ intrinsic: true, rule: "trace-binding" });
      return false;
    }
    const row = entry.trace.placement?.block.row ?? this.rows.indexOf(entry.event.distance);
    const [first, end] = rowsWithin(this.rows.length, quota.within ?? WHOLE_ZONE);
    if (row < first || row >= end) {
      this.observation?.({ intrinsic: true, rule: "quota-span" });
      return false;
    }
    if (entry.herring) {
      if (entry.trace.entry < 0 || entry.trace.nativeUntil > this.plan.zoneLength) {
        this.observation?.({ intrinsic: true, rule: "outside-zone" });
        return false;
      }
      const audit = auditHerringGeometry(this.plan, quota, entry.event, entry.trace.nativeUntil);
      if (audit.reasons.length) {
        this.observation?.({ intrinsic: true, rule: "herring-geometry" });
      } else if (audit.coverage.length) {
        this.observation?.({ rule: "herring-coverage" });
      }
      return (
        audit.reasons.length === 0 &&
        audit.coverage.length === 0 &&
        this.canShow(entry.trace) &&
        this.lanes.keepsAllLanesOpen(this.observation, this.mode)
      );
    }
    if (entry.event.mover === undefined) {
      if (!quota.blocksLane && !this.lanes.keepsAllLanesOpen(this.observation, this.mode)) {
        return false;
      }
      if (!Number.isInteger(entry.event.lane) || entry.event.lane < 0) {
        this.observation?.({ intrinsic: true, rule: "outside-road" });
        return false;
      }
      return fitsStanding(
        this.standingFit,
        { lane: entry.event.lane, row },
        quotaFootprint(quota),
        quota,
      );
    }
    const spot = this.spot(entry, false);
    if (
      quota.mover === undefined ||
      spot === undefined ||
      spot.placement.path !== entry.event.mover ||
      spot.placement.lane !== entry.event.lane ||
      spot.distance + spot.placement.appears !== entry.event.distance
    ) {
      this.observation?.({ intrinsic: true, rule: "compiled-placement" });
      return false;
    }
    if (!leavesPathOpen(this.lanes.heldAt(spot.row), spot.placement)) {
      this.observation?.({ intrinsic: true, rule: "path-stop" });
      return false;
    }
    return fitsMoverSpot(
      this.geometry,
      this.plan.moverCaps,
      this.grid(quota, entry),
      quota.blocksLane ? this.screens : this.prizeScreens,
      quota.mover,
      quota.kind,
      (rule) => {
        this.observation?.({ intrinsic: rule === "outside-zone", rule });
        return false;
      },
      spot,
    );
  }
  keep(entry: RepairEntry<Kind>): void {
    const quota = this.quota(entry);
    if (quota === undefined) {
      throw new Error("Missing repair request identity");
    }
    if (!entry.herring) {
      if (entry.event.mover === undefined) {
        keepStanding(this.standingFit, quota, {
          lane: entry.event.lane,
          row: this.rows.indexOf(entry.event.distance),
        });
      } else {
        const spot = this.spot(entry, true);
        if (spot === undefined || quota.mover === undefined) {
          throw new Error("Missing compiled repair placement");
        }
        keepMoverSpot(
          this.geometry,
          quota.mover,
          this.grid(quota, entry),
          quota.blocksLane ? this.screens : this.prizeScreens,
          spot,
        );
        holdMoverRests(this.plan, this.rows, this.cells, entry.event, quotaFootprint(quota));
      }
    }
    this.entries.push(entry);
  }
}
