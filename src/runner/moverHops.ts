import { itemAt } from "@andornaut/game-kit/arrays";
import { type Random, randomInt, seededRandom } from "@andornaut/game-kit/random";

import type { StepShape } from "./movers.ts";

// A step a lane to either side, left first.
export const SIDESTEPS: readonly StepShape[] = [
  { lanes: -1, travel: 0 },
  { lanes: 1, travel: 0 },
];

// Every hop of 1 to most spots one way: lanes to either side or, unless sideways, a row up the
// road, away from the pack, or diagonally up. A hop never goes down toward the pack. The planner
// picks among those that keep the road passable.
export function hopShapes(most: number, sideways: boolean): StepShape[] {
  const ways: readonly StepShape[] = sideways
    ? SIDESTEPS
    : [...SIDESTEPS, { lanes: 0, travel: -1 }, { lanes: -1, travel: -1 }, { lanes: 1, travel: -1 }];
  return Array.from({ length: most }, (_, i) => i + 1).flatMap((spots) =>
    ways.map(({ lanes, travel }) => ({ lanes: lanes * spots, travel: travel * spots })),
  );
}

// How many spots a step covers.
export function stepSpots(shape: StepShape): number {
  return Math.max(Math.abs(shape.lanes), Math.abs(shape.travel));
}

// The most hop sequences of one count a hopper takes. There are as many as its hop shapes to the
// power of the count, and the planner tries each one of a mover's drawn count at every start lane
// and row, so this bounds the planner's work.
export const HOP_SEQUENCES_MOST = 1000;

// The sequences of times hops, each hop one of hopShapes(most, sideways), in order as numbers in
// base shapes.length, the first hop the most significant digit: every one when there are at most
// HOP_SEQUENCES_MOST, and otherwise that many distinct ones, drawn from a stream seeded with one
// draw from random, the only draw it makes.
export function hopSequences(
  random: Random,
  most: number,
  sideways: boolean,
  times: number,
): StepShape[][] {
  const shapes = hopShapes(most, sideways);
  const total = shapes.length ** times;
  const indices =
    total <= HOP_SEQUENCES_MOST
      ? Array.from({ length: total }, (_, i) => i)
      : drawnIndices(random, total);
  return indices.map((index) =>
    Array.from({ length: times }, (_, hop) =>
      itemAt(shapes, Math.floor(index / shapes.length ** (times - 1 - hop)) % shapes.length),
    ),
  );
}

// HOP_SEQUENCES_MOST distinct indices below total, ascending, each set of them as likely (Floyd's
// sampling, one draw per index).
function drawnIndices(random: Random, total: number): number[] {
  const drawn = seededRandom(Math.floor(random() * 2 ** 32));
  const picked = new Set<number>();
  for (let top = total - HOP_SEQUENCES_MOST; top < total; top++) {
    const index = randomInt(drawn, 0, top + 1);
    picked.add(picked.has(index) ? top : index);
  }
  return [...picked].sort((a, b) => a - b);
}
