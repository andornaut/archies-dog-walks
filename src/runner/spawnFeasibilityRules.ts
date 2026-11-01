import { laneMask } from "../layout/lanes";
import type { SpawnRejection } from "./spawnAdmission";
import type { LaneBlocks, PlacedPlaces, SpawnCells } from "./spawnCells";
import type { FeasibilityObserver } from "./spawnFeasibilityDiagnostics";
import {
  blockingPlace,
  type Cell,
  type Footprint,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRests,
  quotaFootprint,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
} from "./spawning";
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
  if (cell.lane + footprint.lanes > plan.laneCount) {
    return reject(kind, "outside-road");
  }
  const last = lastRowTaken(plan, spacing, cell, footprint, blocksLane);
  if (last >= rows.length) {
    return reject(kind, "outside-rows");
  }
  const covered = laneMask(cell.lane, footprint.lanes);
  for (let row = cell.row; row <= last; row++) {
    if ((cells.heldFor(row, quota) & covered) !== 0) {
      context.onFailure?.({ mask: cells.heldFor(row, quota) & covered, row, rule: "cells" });
      return reject(kind, "cells");
    }
  }
  const needed = footprint.lanes * (last - cell.row + 1);
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
export interface MaskedRoad {
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
  event: SpawnEvent<string>,
  footprint: Footprint,
): void {
  if (event.mover === undefined) {
    return;
  }
  const oneRowHit = hitLength(plan, 1);
  const length = hitLength(plan, footprint.rows);
  const roadLanes = laneMask(0, plan.laneCount);
  for (const rest of moverRests(plan.laneCount, event.distance, event.mover)) {
    const covered = laneMask(rest.lane, footprint.lanes) & roadLanes;
    rows.forEach((rowDistance, row) => {
      if (rowDistance > rest.distance - oneRowHit && rowDistance < rest.distance + length) {
        cells.holdRest(row, covered);
      }
    });
  }
}
