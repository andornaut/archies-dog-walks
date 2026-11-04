import { laneMask } from "../layout/lanes";
import type { LaneSpan, MoverPath } from "./movers";
import { type Footprint, laneTotal, openStretches, type SpawnPlan, sweptPockets } from "./spawning";

// Reactive positions are exclusive; a one-lane transition overlaps both endpoint footprints.
export function reactiveLaneMasks(width: number, path: MoverPath): readonly number[] | undefined {
  if (path.motion !== "approach" && path.motion !== "shy") {
    return undefined;
  }
  // Longitudinal choices may leave a reserved row unoccupied. Do not credit a phantom wall.
  const masks = new Set<number>([0]);
  for (let offset = 0; offset < path.reach.count; offset++) {
    masks.add(laneMask(path.reach.first + offset, width));
    if (offset + 1 < path.reach.count) {
      masks.add(laneMask(path.reach.first + offset, width + 1));
    }
  }
  return [...masks];
}

// A deterministic single body occupies one footprint at a time within its complete sweep.
// The sweep remains authoritative for path, reaction and open-stretch clearance.
export function deterministicOccupancyMasks(
  laneCount: number,
  width: number,
  covered: number,
  path: MoverPath,
): readonly number[] | undefined {
  if (path.motion !== "cross" && path.motion !== "steps" && path.motion !== "ride") {
    return undefined;
  }
  const actualWidth =
    path.motion === "cross" ? (path.span ?? 1) : path.motion === "ride" ? path.lanes : width;
  if (actualWidth !== width) {
    return undefined;
  }
  const masks = new Set<number>([0]);
  const road = laneMask(0, laneCount) & covered;
  for (let first = -width; first < laneCount; first++) {
    for (const count of [width, width + 1]) {
      // Negative origins are clipped before forming an integer lane mask.
      const left = Math.max(0, first),
        right = Math.min(laneCount, first + count);
      if (right > left) {
        masks.add(laneMask(left, right - left) & road);
      }
    }
  }
  return [...masks];
}

export interface LaneAlternativeBlock {
  readonly alternatives?: readonly number[] | undefined;
  readonly covered: number;
  readonly dart: boolean;
  readonly occupancy?: readonly number[] | undefined;
}

// A blocking native placement's necessary count condition ignores the held path and other owners.
export function moverLeavesMinimumLanes(
  geometry: Pick<SpawnPlan<string>, "laneCount" | "minOpenLanes">,
  footprint: Pick<Footprint, "lanes">,
  placement: { readonly lanes: LaneSpan; readonly path: MoverPath },
): boolean {
  const covered = laneMask(placement.lanes.first, placement.lanes.count);
  return alternativeLanesOpen(geometry.laneCount, geometry.minOpenLanes, false, [
    {
      alternatives: reactiveLaneMasks(footprint.lanes, placement.path),
      covered,
      dart: false,
      occupancy: deterministicOccupancyMasks(
        geometry.laneCount,
        footprint.lanes,
        covered,
        placement.path,
      ),
    },
  ]);
}

// Every combination must preserve clearance. The safe path still avoids the complete union.
export function alternativeLanesOpen(
  laneCount: number,
  minOpenLanes: number,
  checkStretches: boolean,
  blocks: readonly LaneAlternativeBlock[],
): boolean {
  let fixed = 0,
    walls = 0,
    darts = 0;
  const moving: LaneAlternativeBlock[] = [];
  const exclusive: LaneAlternativeBlock[] = [];
  for (const block of blocks) {
    if (block.occupancy !== undefined || block.alternatives !== undefined) {
      moving.push(block);
    } else {
      fixed |= block.covered;
    }
    if (block.alternatives !== undefined) {
      exclusive.push(block);
    } else if (block.dart) {
      darts |= block.covered;
    } else {
      walls |= block.covered;
    }
  }
  if (laneCount - laneTotal(fixed) < minOpenLanes) {
    return false;
  }
  let occupied = new Set([fixed]);
  for (const block of moving) {
    const next = new Set<number>();
    for (const prior of occupied) {
      for (const mask of block.occupancy ?? block.alternatives ?? [block.covered]) {
        const combined = prior | mask;
        if (laneCount - laneTotal(combined) < minOpenLanes) {
          return false;
        }
        next.add(combined);
      }
    }
    occupied = next;
  }
  if (!checkStretches) {
    return true;
  }
  if (exclusive.length === 0) {
    return !checkStretches || openStretches(laneCount, walls, darts);
  }
  const states = stretchStates(() => true, walls, darts, exclusive)!;
  return (
    !checkStretches ||
    [...states].every(([walls, darts]) =>
      [...darts].every((dart) => openStretches(laneCount, walls, dart)),
    )
  );
}

function stretchStates(
  step: () => boolean,
  walls: number,
  darts: number,
  exclusive: readonly LaneAlternativeBlock[],
): Map<number, Set<number>> | undefined {
  let states = new Map<number, Set<number>>([[walls, new Set([darts])]]);
  for (const block of exclusive) {
    const next = new Map<number, Set<number>>();
    for (const [walls, darts] of states) {
      for (const dartMask of darts) {
        for (const mask of block.alternatives ?? [block.covered]) {
          if (!step()) {
            return undefined;
          }
          const wall = walls | (block.dart ? 0 : mask);
          const dart = dartMask | (block.dart ? mask : 0);
          let row = next.get(wall);
          if (row === undefined) {
            row = new Set();
            next.set(wall, row);
          }
          row.add(dart);
        }
      }
    }
    states = next;
  }
  return states;
}

export function requiredAlternativeWalls(
  step: () => boolean,
  laneCount: number,
  blocks: readonly LaneAlternativeBlock[],
): { readonly status: "complete"; readonly mask: number } | { readonly status: "budget" } {
  let walls = 0,
    darts = 0;
  const exclusive: LaneAlternativeBlock[] = [];
  for (const block of blocks) {
    if (!step()) {
      return { status: "budget" };
    }
    if (block.alternatives !== undefined) {
      exclusive.push(block);
    } else if (block.dart) {
      darts |= block.covered;
    } else {
      walls |= block.covered;
    }
  }
  const states = stretchStates(step, walls, darts, exclusive);
  if (states === undefined) {
    return { status: "budget" };
  }
  let required = 0;
  while (true) {
    let next = required;
    for (const [walls, darts] of states) {
      for (const dart of darts) {
        if (!step()) {
          return { status: "budget" };
        }
        next |= sweptPockets(laneCount, walls | required, dart);
      }
    }
    if (next === required) {
      return { mask: required, status: "complete" };
    }
    required = next;
  }
}
