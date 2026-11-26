import { laneMask } from "../layout/index.ts";
import { deterministicOccupancyMasks, reactiveLaneMasks } from "./laneAlternatives.ts";
import type { MoverBody, MoverPlacement } from "./moverModel.ts";
import type { OnScreen } from "./moverScreen.ts";
import { fitsMoverSpot, keepMoverSpot, leavesPathOpen, type MoverGrid } from "./moverSpots.ts";
import type { RiderSpan } from "./riderSpans.ts";
import { createSpawnBoardConflicts } from "./spawnBoardConflicts.ts";
import { placementIdentity, spotForPlacement } from "./spawnBoardSpots.ts";
import { createSpawnBoardVisibility } from "./spawnBoardVisibility.ts";
import { LaneBlocks, PlacedPlaces, SpawnCells, SpawnRetentionError } from "./spawnCells.ts";
import type { FeasibilityObserver, FeasibilityWitness } from "./spawnFeasibilityDiagnostics.ts";
import {
  fitsStanding,
  holdMoverRests,
  keepStanding,
  type StandingFitContext,
  standingSpan,
} from "./spawnFeasibilityRules.ts";
import {
  blockingLength,
  pathChanges,
  pathHeldLanes,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";
import { auditHerringGeometry } from "./spawnMoverValidation.ts";
import type { SpawnVisibilityTrace } from "./spawnVisibility.ts";
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
// A refusal no native rule names.
const UNATTRIBUTED: PlacementRejection = {
  classification: "unattributed",
  conflicts: [],
  rule: "unattributed",
};
// Each admit or refuse check of the board returns its refusal, or undefined to admit. The
// feasibility rules the board calls into take boolean checks; passes reports a refusal to the
// probe that is observing and admits only without one.
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
  private readonly bodies: MoverBody[] = [];
  private readonly riders: RiderSpan[] = [];
  private readonly screens: OnScreen[] = [];
  private readonly prizeScreens: OnScreen[] = [];
  private readonly geometry;
  private readonly visibility;
  private readonly conflicts;
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
    this.visibility = createSpawnBoardVisibility(plan, this.rows, this.spacing, this.entries);
    this.conflicts = createSpawnBoardConflicts({
      bodies: this.bodies,
      entries: this.entries,
      geometry: this.geometry,
      plan,
      quotaFor: (entry) => this.quota(entry),
      riders: this.riders,
      rows: this.rows,
      spacing: this.spacing,
      visibilityRefusal: this.visibility.visibilityRefusal,
    });
    this.standingFit = {
      canShow: (quota, cell) =>
        this.passes(this.visibility.visibilityRefusal(this.visibility.standingTrace(quota, cell))),
      cells: this.cells,
      clearOfMovers: (cell, footprint) =>
        this.passes(this.conflicts.moverBodyRefusal(cell, footprint)),
      completeLaneCheck: true,
      laneMode: mode,
      lanes: this.lanes,
      places: this.places,
      plan,
      reject: (_kind, rule) => {
        this.passes({ intrinsic: rule === "outside-road" || rule === "outside-rows", rule });
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
    const restore = [
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
  private passes(refusal: FeasibilityWitness | undefined): boolean {
    if (refusal !== undefined) {
      this.observation?.(refusal);
    }
    return refusal === undefined;
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
        this.passes(this.conflicts.moverShowRefusal(quota, entry, cells)),
      clearOf: (body) => this.passes(this.conflicts.standingBodyRefusal(body)),
      clearOfRiders: (ride) => !blocking || this.passes(this.conflicts.riderRefusal(ride)),
      clearRun: (span, row) => this.lanes.clearRun(span, row),
      heldLanes: (row) => this.lanes.heldAt(row),
      isFree: (motion, lane, row) =>
        this.passes(
          this.cells.isFreeForRepair(motion, lane, row, blocking)
            ? undefined
            : { mask: laneMask(lane, 1), row, rule: "cells" },
        ),
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
  // The refusal of a placement on the board as it stands, or undefined to admit it: the first
  // native rule it fails, with the placed requests that rule attributes the failure to.
  refusal(entry: SpawnPlacement<Kind>): PlacementRejection | undefined {
    let rejection: PlacementRejection | undefined;
    this.observation = (witness) => {
      rejection ??= this.conflicts.rejection(entry, witness);
    };
    this.standingFit.onFailure = this.observation;
    try {
      return this.fits(entry) ? undefined : (rejection ?? UNATTRIBUTED);
    } finally {
      this.observation = undefined;
      delete this.standingFit.onFailure;
    }
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

  // The complete board's refusal for a row without its open lanes, or undefined when every row
  // keeps them.
  completeRefusal(): PlacementRejection | undefined {
    let rejection: PlacementRejection | undefined;
    const open = this.lanes.keepsAllLanesOpen((witness) => {
      rejection ??= this.conflicts.rejection(undefined, witness);
    }, "complete");
    return open ? undefined : (rejection ?? UNATTRIBUTED);
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
    const spot = spotForPlacement(this.rows, entry, false);
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

  private fits(entry: SpawnPlacement<Kind>): boolean {
    const intrinsic = this.checkIntrinsic(entry);
    if (!intrinsic.accepted) {
      return this.passes({ intrinsic: true, rule: intrinsic.rule });
    }
    const quota = this.quota(entry)!;
    if (this.entries.some((other) => placementIdentity(other) === placementIdentity(entry))) {
      return this.passes({ requests: [placementIdentity(entry)], rule: "duplicate-request" });
    }
    if (entry.herring) {
      return (
        this.passes(this.visibility.visibilityRefusal(entry.trace)) &&
        this.lanes.keepsAllLanesOpen(this.observation, this.mode)
      );
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
    const spot = spotForPlacement(this.rows, entry, false)!;
    return fitsMoverSpot(
      {
        caps: this.plan.moverCaps,
        geometry: this.geometry,
        grid: this.grid(quota, entry),
        onScreen: quota.blocksLane ? this.screens : this.prizeScreens,
        reject: (rule) => {
          this.passes({ intrinsic: rule === "outside-zone", rule });
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
      throw new SpawnRetentionError("Missing repair request identity");
    }
    if (!entry.herring) {
      if (entry.event.mover === undefined) {
        keepStanding(this.standingFit, quota, {
          lane: entry.event.lane,
          row: this.rows.indexOf(entry.event.distance),
        });
      } else {
        const spot = spotForPlacement(this.rows, entry, true);
        if (spot === undefined || quota.mover === undefined) {
          throw new SpawnRetentionError("Missing compiled repair placement");
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
  }
}
