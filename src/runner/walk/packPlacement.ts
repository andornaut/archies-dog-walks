import { itemAt } from "@andornaut/game-kit/runtime/arrays";

import type { DogId } from "../../data/ids.ts";
import { formationOrder } from "../../layout/index.ts";
import { packDogs, type RunState } from "../../state/index.ts";
import type { Box, DogBox, PackBoxes, RoadPoint } from "../collision.ts";
import type { RoadGeometry } from "../walkGeometry.ts";
import { type LaneMotion, laneMotionX } from "./laneMotion.ts";

// The pack's place across the road, in road pixels from its left edge: the walker's lane
// centre, moving linearly between lanes.
function packX(cellLength: number, laneCount: number, motion: LaneMotion): number {
  const centres = Array.from({ length: laneCount }, (_, lane) => (lane + 0.5) * cellLength);
  return laneMotionX(centres, motion);
}

// The pack's outline and hit rectangles swept across the road from its place in one motion to
// its place in another: each spans every place between, so a quick lane change passes nothing
// by between two steps. The walking dogs' rectangles are in pack order.
export function sweptPackBoxes(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "lens" | "packParts">,
  from: LaneMotion,
  to: LaneMotion,
  run: Pick<RunState, "pack">,
): PackBoxes<DogId> {
  const fromX = packX(geometry.cell.length, geometry.laneCount, from);
  const toX = packX(geometry.cell.length, geometry.laneCount, to);
  const across = <Part extends Box>(part: Part): Part => ({
    ...part,
    left: Math.min(fromX, toX) + part.left,
    right: Math.max(fromX, toX) + part.right,
  });
  const { packParts } = geometry;
  return {
    centreX: geometry.lens.centreX,
    dogs: formationOrder(packDogs(run)).map((dog, index): DogBox<DogId> => ({
      ...across(itemAt(packParts.dogs, index)),
      dog,
    })),
    outline: across(packParts.outline),
    walker: across(packParts.walker),
  };
}

// The pack's outline and hit rectangles at its place on the road.
export function packBoxes(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "lens" | "packParts">,
  motion: LaneMotion,
  run: Pick<RunState, "pack">,
): PackBoxes<DogId> {
  return sweptPackBoxes(geometry, motion, motion, run);
}

// The pack's centre on the road: across from where its lane motion has it, and half way down its
// band.
export function packCentre(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "packBand">,
  motion: LaneMotion,
): RoadPoint {
  const { cell, laneCount, packBand } = geometry;
  return { x: packX(cell.length, laneCount, motion), y: (packBand.top + packBand.bottom) / 2 };
}
