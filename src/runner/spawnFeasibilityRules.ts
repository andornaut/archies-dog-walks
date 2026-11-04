import { laneMask } from "../layout/lanes.ts";
import type { MoverSpec } from "./moverModel.ts";
import type { SpawnRejection } from "./spawnAdmission.ts";
import type { LaneBlocks, PlacedPlaces, SpawnCells } from "./spawnCells.ts";
import type { FeasibilityObserver } from "./spawnFeasibilityDiagnostics.ts";
import {
  blockingPlace,
  type Cell,
  type Footprint,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRestSpans,
  quotaFootprint,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
} from "./spawning.ts";
export interface StandingFitContext {
  readonly laneMode?: "complete" | "partial";
  onFailure?: FeasibilityObserver;
  readonly completeLaneCheck?: true;
  readonly retainBlocks?: true;
  readonly plan: SpawnPlan<string>;
  readonly rows: readonly number[];
  readonly spacing: number;
  readonly cells: SpawnCells;
  readonly lanes: LaneBlocks;
  readonly places: PlacedPlaces;
  canShow(quota: SpawnQuota<string>, cell: Cell): boolean;
  clearOfMovers(cell: Cell, footprint: Footprint): boolean;
  reject(kind: string, reason: SpawnRejection): false;
}
export function standingSpan(
  context: Pick<StandingFitContext, "plan" | "rows" | "spacing">,
  cell: Cell,
  footprint: Footprint,
  quota: SpawnQuota<string>,
): { readonly last: number } | { readonly rule: "outside-road" | "outside-rows" } {
  if (cell.lane + footprint.lanes > context.plan.laneCount) {
    return { rule: "outside-road" };
  }
  const last = lastRowTaken(context.plan, context.spacing, cell, footprint, quota.blocksLane);
  return last >= context.rows.length ? { rule: "outside-rows" } : { last };
}
export function fitsStanding(
  context: StandingFitContext,
  cell: Cell,
  footprint: Footprint,
  quota: SpawnQuota<string>,
): boolean {
  const { canShow, cells, clearOfMovers, lanes, places, plan, reject, rows, spacing } = context;
  const { blocksLane, kind } = quota;
  if (!canShow(quota, cell)) {
    return false;
  }
  const span = standingSpan(context, cell, footprint, quota);
  if ("rule" in span) {
    return reject(kind, span.rule);
  }
  const { last } = span;
  const covered = laneMask(cell.lane, footprint.lanes);
  const standingCells: Cell[] = [];
  for (let row = cell.row; row <= last; row++) {
    if ((cells.heldFor(row, quota) & covered) !== 0) {
      context.onFailure?.({ mask: cells.heldFor(row, quota) & covered, row, rule: "cells" });
      return reject(kind, "cells");
    }
    for (let lane = cell.lane; lane < cell.lane + footprint.lanes; lane++) {
      standingCells.push({ lane, row });
    }
  }
  const needed = cells.untaken(standingCells);
  if (footprint.lanes * footprint.rows > 1 && !cells.leavesRoom(needed)) {
    return reject(kind, "reservation");
  }
  if (!blocksLane) {
    return true;
  }
  if (!clearOfMovers(cell, footprint)) {
    return reject(kind, "body");
  }
  if (
    footprint.lanes >= WIDE_LANES &&
    !lanes.clearOfWide(cell.row, lastHitRow(plan, spacing, cell, footprint))
  ) {
    context.onFailure?.({
      lastRow: lastHitRow(plan, spacing, cell, footprint),
      row: cell.row,
      rule: "wide-gap",
    });
    return reject(kind, "wide-gap");
  }
  if (!places.fits(blockingPlace(plan, rows, quota, cell, footprint), context.onFailure)) {
    return reject(kind, "pack-gap");
  }
  return (
    lanes.tryBlock(
      cell,
      footprint,
      false,
      false,
      context.completeLaneCheck ?? false,
      context.onFailure,
      context.laneMode ?? "complete",
    ) || reject(kind, "open-lanes")
  );
}
export function keepStanding(
  context: StandingFitContext,
  quota: SpawnQuota<string>,
  cell: Cell,
): void {
  const { cells, lanes, places, plan, rows, spacing } = context;
  const footprint = quotaFootprint(quota);
  const last = lastRowTaken(plan, spacing, cell, footprint, quota.blocksLane);
  const covered = laneMask(cell.lane, footprint.lanes);
  for (let row = cell.row; row <= last; row++) {
    cells.standOn(row, covered, !quota.blocksLane && quota.moversPassOver === true);
  }
  if (quota.blocksLane) {
    if (footprint.lanes >= WIDE_LANES) {
      lanes.markWide(1, cell.row, lastHitRow(plan, spacing, cell, footprint));
    }
    if (context.retainBlocks === true) {
      lanes.retainBlock(cell, footprint);
    } else {
      lanes.tryBlock(cell, footprint, true);
    }
    places.add(blockingPlace(plan, rows, quota, cell, footprint));
  }
}
interface MaskedRoad {
  readonly from: number;
  readonly lanes: number;
  readonly to: number;
}
export function sharesRoad(a: MaskedRoad, b: MaskedRoad): boolean {
  return (a.lanes & b.lanes) !== 0 && a.from < b.to && b.from < a.to;
}

export function holdMoverRests(
  plan: SpawnPlan<string>,
  rows: readonly number[],
  cells: Pick<SpawnCells, "holdRest">,
  spec: Pick<MoverSpec, "footprint" | "hitLength">,
  event: SpawnEvent<string>,
): void {
  if (event.mover === undefined) {
    return;
  }
  const oneRowHit = hitLength(plan, 1);
  const roadLanes = laneMask(0, plan.laneCount);
  for (const rest of moverRestSpans(plan, spec, event)) {
    const covered = laneMask(rest.lane, rest.lanes) & roadLanes;
    rows.forEach((rowDistance, row) => {
      if (rowDistance > rest.distance - oneRowHit && rowDistance < rest.distance + rest.length) {
        cells.holdRest(row, covered);
      }
    });
  }
}
