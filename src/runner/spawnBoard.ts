import { laneMask } from "../layout/lanes.ts";
import { deterministicOccupancyMasks, reactiveLaneMasks } from "./laneAlternatives.ts";
import { type MoverBody, type MoverPlacement } from "./moverModel.ts";
import { type OnScreen, onScreenOf } from "./moverScreen.ts";
import {
  fitsMoverSpot,
  keepMoverSpot,
  leavesPathOpen,
  type MoverGrid,
  moverWithinZone,
  type Spot,
} from "./moverSpots.ts";
import { ridersMeet, type RiderSpan, riderSpanOf } from "./riderSpans.ts";
import { LaneBlocks, PlacedPlaces, SpawnCells } from "./spawnCells.ts";
import type { FeasibilityObserver, FeasibilityWitness } from "./spawnFeasibilityDiagnostics.ts";
import {
  fitsStanding,
  holdMoverRests,
  keepStanding,
  sharesRoad,
  type StandingFitContext,
  standingSpan,
} from "./spawnFeasibilityRules.ts";
import {
  blockingLength,
  blockingPlace,
  blockingSpan,
  type Cell,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRestSpans,
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
} from "./spawning.ts";
import { auditHerringGeometry } from "./spawnMoverValidation.ts";
import { type SpawnVisibilityTrace, visibilityRejection } from "./spawnVisibility.ts";
import { rowsWithin, WHOLE_ZONE } from "./stretches.ts";
export interface SpawnPlacement<Kind extends string> {
  readonly event: SpawnEvent<Kind>;
  readonly herring: boolean;
  readonly trace: SpawnVisibilityTrace;
  // New moving insertions retain their original compiled candidate, including stop.
  readonly placement?: MoverPlacement;
}
// Owners are a conservative witness for one failure, not a sufficient ejection set.
export interface PlacementRejection {
  readonly classification: "intrinsic" | "conflict" | "unattributed";
  readonly conflicts: readonly string[];
  readonly rule: string;
  readonly witness?: { readonly row?: number; readonly moment?: number };
}
export type PlacementResult =
  { readonly accepted: true } | { readonly accepted: false; readonly failure: PlacementRejection };
const identity = (entry: SpawnPlacement<string>) =>
  `${entry.trace.quotaIndex}:${entry.trace.memberIndex}`;
export class SpawnBoard<Kind extends string> {
  private readonly mode: "complete" | "partial";
  private readonly plan: SpawnPlan<Kind>;
  private readonly lookupQuota:
    ((entry: SpawnPlacement<Kind>) => SpawnQuota<Kind> | undefined) | undefined;
  private observation: FeasibilityObserver | undefined;
  private readonly spacing: number;
  private readonly rows: readonly number[];
  private readonly cells: SpawnCells;
  private readonly lanes: LaneBlocks;
  private readonly places: PlacedPlaces;
  private readonly standingFit: StandingFitContext;
  private readonly entries: SpawnPlacement<Kind>[] = [];
  private visibilityContext: {
    failures?: Map<
      string,
      {
        readonly rule: string;
        readonly owners: readonly SpawnPlacement<Kind>[];
      }
    >;
  } = {};
  private readonly bodies: MoverBody[] = [];
  private readonly riders: RiderSpan[] = [];
  private readonly screens: OnScreen[] = [];
  private readonly prizeScreens: OnScreen[] = [];
  private readonly geometry;
  constructor(
    mode: "complete" | "partial",
    plan: SpawnPlan<Kind>,
    path: PlannedSpawns<Kind>["path"],
    lookupQuota: ((entry: SpawnPlacement<Kind>) => SpawnQuota<Kind> | undefined) | undefined,
    entries: readonly SpawnPlacement<Kind>[],
  ) {
    this.mode = mode;
    this.plan = plan;
    this.lookupQuota = lookupQuota;
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
  // The returned mark restores all native geometry and ownership without revalidation.
  save(): () => void {
    const saveArray = <Value>(array: Value[]) => {
      const saved = array.slice();
      return () => {
        array.splice(0, array.length, ...saved);
      };
    };
    const visibilityContext = this.visibilityContext;
    const restore = [
      () => {
        this.visibilityContext = visibilityContext;
      },
      this.cells.save(),
      this.lanes.save(),
      this.places.save(),
      saveArray(this.entries),
      saveArray(this.bodies),
      saveArray(this.riders),
      saveArray(this.screens),
      saveArray(this.prizeScreens),
    ];
    return () => {
      restore.forEach((reset) => reset());
    };
  }
  private quota(entry: SpawnPlacement<Kind>): SpawnQuota<Kind> | undefined {
    const { memberIndex, quotaIndex } = entry.trace;
    if (
      quotaIndex === undefined ||
      memberIndex === undefined ||
      !Number.isSafeInteger(quotaIndex) ||
      quotaIndex < 0 ||
      !Number.isSafeInteger(memberIndex)
    ) {
      return undefined;
    }
    const quota =
      this.lookupQuota === undefined ? this.plan.quotas[quotaIndex] : this.lookupQuota(entry);
    return quota !== undefined &&
      memberIndex >= 0 &&
      memberIndex < quota.count &&
      quota.kind === entry.event.kind
      ? quota
      : undefined;
  }
  private visibilityKey(trace: SpawnVisibilityTrace): string {
    return JSON.stringify([
      "hazards",
      this.plan.scrollSpeed * this.plan.stepSeconds,
      trace.kind,
      trace.row,
      trace.lane,
      trace.entry,
      trace.until,
    ]);
  }
  private canShow(trace: SpawnVisibilityTrace): boolean {
    if (!trace.hazard) {
      return true;
    }
    let witness: FeasibilityWitness | undefined;
    const rejection = visibilityRejection(
      this.plan.scrollSpeed * this.plan.stepSeconds,
      this.entries.filter((entry) => entry.trace.hazard).map((entry) => entry.trace),
      trace,
      (failure) => {
        witness = failure;
        this.observation?.(failure);
      },
    );
    if (rejection !== undefined && witness?.contributors !== undefined) {
      let failures = this.visibilityContext.failures;
      if (failures === undefined) {
        failures = new Map();
        this.visibilityContext.failures = failures;
      }
      failures.set(this.visibilityKey(trace), {
        owners: this.entries.filter((entry) => witness!.contributors!.includes(entry.trace)),
        rule: rejection,
      });
    }
    return rejection === undefined;
  }
  hasNegativeVisibilityIndex(): boolean {
    return (this.visibilityContext.failures?.size ?? 0) > 0;
  }
  lookupNegativeVisibility(trace: SpawnVisibilityTrace): PlacementRejection | undefined {
    if (!trace.hazard) {
      return undefined;
    }
    const failure = this.visibilityContext.failures?.get(this.visibilityKey(trace));
    if (
      failure === undefined ||
      failure.owners.length === 0 ||
      !failure.owners.every((owner) => this.entries.includes(owner))
    ) {
      return undefined;
    }
    return this.rejection(undefined, {
      contributors: failure.owners.map((owner) => owner.trace),
      rule: failure.rule,
    });
  }
  // Mint only after the intrinsic check accepted this exact entry.
  visibilityPrerequisite(
    entry: SpawnPlacement<Kind>,
    quota: SpawnQuota<Kind>,
  ): SpawnVisibilityTrace | undefined {
    if (entry.herring) {
      return entry.trace;
    }
    if (entry.event.mover === undefined) {
      const row = entry.trace.placement?.block.row ?? this.rows.indexOf(entry.event.distance);
      return this.standingTrace(quota, { lane: entry.event.lane, row });
    }
    const spot = this.spot(entry, false);
    return spot !== undefined && moverWithinZone(this.geometry, spot) ? entry.trace : undefined;
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
  private grid(quota: SpawnQuota<Kind>, entry: SpawnPlacement<Kind>): MoverGrid {
    const blocking = quota.blocksLane;
    return {
      block: (row, span, rows, keep, dart = false) => {
        if (!blocking) {
          return this.lanes.keepsAllLanesOpen(this.observation, this.mode);
        }
        const cell = { lane: span.first, row };
        const footprint = { lanes: span.count, rows };
        const alternatives =
          entry.event.mover === undefined
            ? undefined
            : reactiveLaneMasks(quota.mover!.footprint.lanes, entry.event.mover);
        const occupancy =
          entry.event.mover === undefined
            ? undefined
            : deterministicOccupancyMasks(
                this.plan.laneCount,
                quota.mover!.footprint.lanes,
                laneMask(span.first, span.count),
                entry.event.mover,
              );
        if (keep) {
          this.lanes.retainBlock(cell, footprint, dart, alternatives, occupancy);
          return true;
        }
        return this.lanes.tryBlock(
          cell,
          footprint,
          false,
          dart,
          true,
          this.observation,
          this.mode,
          alternatives,
          occupancy,
        );
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
              to: this.rows[last]! + hitLength(this.plan, 1),
            },
            {
              blocksLane: blocking,
              cells,
              rests: moverRestSpans(this.plan, quota.mover!, entry.event),
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
        this.bodies.push(body);
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
  private spot(entry: SpawnPlacement<Kind>, hydrate: boolean): Spot | undefined {
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
  probe(entry: SpawnPlacement<Kind>, onFailure: (failure: PlacementRejection) => void): boolean {
    let reported = false;
    this.observation = (witness) => {
      if (reported) {
        return;
      }
      reported = true;
      onFailure(this.rejection(entry, witness));
    };
    this.standingFit.onFailure = this.observation;
    try {
      return this.fits(entry);
    } finally {
      this.observation = undefined;
      delete this.standingFit.onFailure;
    }
  }

  kindRowPair(
    step: () => boolean,
    entry: SpawnPlacement<Kind>,
    failure: PlacementRejection,
  ): boolean | undefined {
    if (
      failure.rule !== "kind-row" ||
      failure.classification !== "conflict" ||
      failure.conflicts.length === 0 ||
      !Object.isFrozen(entry.trace)
    ) {
      return false;
    }
    const quota = this.quota(entry);
    if (quota === undefined) {
      return false;
    }
    const incoming = this.visibilityPrerequisite(entry, quota);
    if (incoming === undefined || !incoming.hazard) {
      return false;
    }
    const wanted = new Set(failure.conflicts);
    const matching = this.entries.filter((other) => wanted.has(identity(other)));
    if (matching.length !== wanted.size) {
      return false;
    }
    for (const other of matching) {
      if (!step()) {
        return undefined;
      }
      if (!Object.isFrozen(other.trace)) {
        return false;
      }
      if (
        visibilityRejection(
          this.plan.scrollSpeed * this.plan.stepSeconds,
          [other.trace],
          incoming,
        ) === "kind-row"
      ) {
        return true;
      }
    }
    return false;
  }

  requiredWalls(step: () => boolean, row: number) {
    return this.lanes.requiredWalls(step, row);
  }
  guaranteedWalls(step: () => boolean, row: number): number | undefined {
    return this.lanes.guaranteedWalls(step, row);
  }

  openStretchRow(): number | undefined {
    let row: number | undefined;
    this.lanes.keepsAllLanesOpen((witness) => {
      if (witness.rule === "open-stretches") {
        row = witness.row;
      }
    }, "complete");
    return row;
  }

  checkComplete(onFailure: (failure: PlacementRejection) => void): boolean {
    return this.lanes.keepsAllLanesOpen(
      (witness) => onFailure(this.rejection(undefined, witness)),
      "complete",
    );
  }

  private rejection(
    candidate: SpawnPlacement<Kind> | undefined,
    witness: FeasibilityWitness,
  ): PlacementRejection {
    const conflicts = this.conflicts(candidate, witness);
    const candidateOnlyLanes =
      witness.rule === "open-lanes" &&
      witness.requests === undefined &&
      witness.contributors === undefined &&
      candidate !== undefined &&
      this.blocksOpenRow(candidate, witness) === true &&
      this.entries.every((entry) => this.blocksOpenRow(entry, witness) === false);
    return {
      classification:
        witness.intrinsic === true || candidateOnlyLanes
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
    };
  }

  // Lane-count failures are unary only when the failed row has no committed block.
  // Use the same native span for owner attribution and the absence proof.
  private blocksOpenRow(
    entry: SpawnPlacement<Kind>,
    witness: FeasibilityWitness,
  ): boolean | undefined {
    const quota = this.quota(entry);
    if (quota === undefined || witness.row === undefined) {
      return undefined;
    }
    if (!quota.blocksLane || entry.herring) {
      return false;
    }
    const footprint = quotaFootprint(quota);
    const row = entry.trace.placement?.block.row ?? this.rows.indexOf(entry.event.distance);
    const rows = entry.trace.placement?.block.rows ?? footprint.rows;
    if (!Number.isSafeInteger(row) || row < 0 || !Number.isSafeInteger(rows) || rows <= 0) {
      return undefined;
    }
    const span = blockingSpan(this.plan, this.spacing, row, rows);
    return (
      witness.row >= row && witness.row <= (witness.gap === true ? span.lastGap : span.lastRow)
    );
  }

  private conflicts(
    candidate: SpawnPlacement<Kind> | undefined,
    witness: FeasibilityWitness,
  ): string[] {
    if (witness.intrinsic === true) {
      return [];
    }
    // An elsewhere wall can repair a dart stretch by moving into it. Its dependency
    // therefore includes the whole prefix, not only current failed-row contributors.
    if (witness.rule === "open-stretches") {
      return [...new Set(this.entries.map(identity))];
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
          candidate !== undefined &&
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
        return this.blocksOpenRow(entry, witness) === true;
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
        quota.mover!,
        entry.event,
      );
      return held;
    });
    return [...new Set(matches.map(identity))];
  }

  checkIntrinsic(
    entry: SpawnPlacement<Kind>,
  ): { readonly accepted: true } | { readonly accepted: false; readonly rule: string } {
    const fail = (rule: string) => ({ accepted: false as const, rule });
    const quota = this.quota(entry);
    if (quota === undefined) {
      return fail("request-identity");
    }
    if (
      entry.trace.entry !== entry.event.distance ||
      entry.trace.kind !== entry.event.kind ||
      entry.trace.lane !== entry.event.lane
    ) {
      return fail("trace-binding");
    }
    const row = entry.trace.placement?.block.row ?? this.rows.indexOf(entry.event.distance);
    const [first, end] = rowsWithin(this.rows.length, quota.within ?? WHOLE_ZONE);
    if (row < first || row >= end) {
      return fail("quota-span");
    }
    if (entry.herring) {
      if (entry.trace.entry < 0 || entry.trace.nativeUntil > this.plan.zoneLength) {
        return fail("outside-zone");
      }
      const audit = auditHerringGeometry(this.plan, quota, entry.event, entry.trace.nativeUntil);
      if (audit.reasons.length) {
        return fail("herring-geometry");
      }
      return audit.coverage.length ? fail("herring-coverage") : { accepted: true };
    }
    if (entry.event.mover === undefined) {
      if (!Number.isInteger(entry.event.lane) || entry.event.lane < 0) {
        return fail("outside-road");
      }
      const cell = { lane: entry.event.lane, row };
      const footprint = quotaFootprint(quota);
      const span = standingSpan(this.standingFit, cell, footprint, quota);
      if ("rule" in span) {
        return fail(span.rule);
      }
      let rule: string | undefined;
      if (
        quota.blocksLane &&
        !this.lanes.pathFits(cell, footprint, (failure) => {
          rule = failure.rule;
        })
      ) {
        return fail(rule ?? "path");
      }
      return { accepted: true };
    }
    const spot = this.spot(entry, false);
    if (
      quota.mover === undefined ||
      spot === undefined ||
      spot.placement.path !== entry.event.mover ||
      spot.placement.lane !== entry.event.lane ||
      spot.distance + spot.placement.appears !== entry.event.distance
    ) {
      return fail("compiled-placement");
    }
    if (!leavesPathOpen(this.lanes.heldAt(spot.row), spot.placement)) {
      return fail("path-stop");
    }
    if (quota.blocksLane) {
      let rule: string | undefined;
      if (
        !this.lanes.pathFits(
          { lane: spot.placement.lanes.first, row: spot.row },
          { lanes: spot.placement.lanes.count, rows: spot.placement.rows },
          (failure) => {
            rule = failure.rule;
          },
        )
      ) {
        return fail(rule ?? "path");
      }
      const stands = spot.placement.stands.map((stand) => ({
        ...stand,
        distance: spot.distance + stand.distance,
      }));
      if (!this.places.fitsSelf(stands)) {
        return fail("pack-gap");
      }
    }
    return { accepted: true };
  }

  fits(entry: SpawnPlacement<Kind>): boolean {
    const intrinsic = this.checkIntrinsic(entry);
    if (!intrinsic.accepted) {
      this.observation?.({ intrinsic: true, rule: intrinsic.rule });
      return false;
    }
    const quota = this.quota(entry)!;
    if (this.entries.some((other) => identity(other) === identity(entry))) {
      this.observation?.({ requests: [identity(entry)], rule: "duplicate-request" });
      return false;
    }
    if (entry.herring) {
      return this.canShow(entry.trace) && this.lanes.keepsAllLanesOpen(this.observation, this.mode);
    }
    const row = entry.trace.placement?.block.row ?? this.rows.indexOf(entry.event.distance);
    if (entry.event.mover === undefined) {
      if (!quota.blocksLane && !this.lanes.keepsAllLanesOpen(this.observation, this.mode)) {
        return false;
      }
      return fitsStanding(
        this.standingFit,
        { lane: entry.event.lane, row },
        quotaFootprint(quota),
        quota,
      );
    }
    const spot = this.spot(entry, false)!;
    return fitsMoverSpot(
      {
        caps: this.plan.moverCaps,
        geometry: this.geometry,
        grid: this.grid(quota, entry),
        onScreen: quota.blocksLane ? this.screens : this.prizeScreens,
        reject: (rule) => {
          this.observation?.({ intrinsic: rule === "outside-zone", rule });
          return false;
        },
      },
      quota.mover!,
      quota.kind,
      spot,
    );
  }
  keep(entry: SpawnPlacement<Kind>): void {
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
          {
            geometry: this.geometry,
            grid: this.grid(quota, entry),
            onScreen: quota.blocksLane ? this.screens : this.prizeScreens,
          },
          quota.mover,
          spot,
        );
        holdMoverRests(this.plan, this.rows, this.cells, quota.mover, entry.event);
      }
    }
    this.entries.push(entry);
    this.visibilityContext = {};
  }
}
