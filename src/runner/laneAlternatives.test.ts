import { expect, it } from "vitest";

import {
  alternativeLanesOpen,
  deterministicOccupancyMasks,
  reactiveLaneMasks,
} from "./laneAlternatives";
import { drawnLanes, type MoverPath, moverPlace } from "./movers";
import { LaneBlocks } from "./spawnCells";
import type { SpawnPlan } from "./spawning";

const reactive: MoverPath = {
  burst: 64,
  lane: 1,
  lengths: [40],
  motion: "approach",
  movement: "approach",
  pending: [{ at: 200, kind: "after" }],
  reach: { count: 3, first: 0 },
  rows: 1,
  steps: [],
  stopTravel: 500,
  warning: 100,
};

it("preserves every reactive position and transition without counting exclusive branches together", () => {
  const alternatives = reactiveLaneMasks(2, reactive);
  expect(alternatives).toEqual([0, 3, 7, 6, 14, 12]);
  const block = { alternatives, covered: 15, dart: false };
  expect(alternativeLanesOpen(5, 2, true, [block])).toBe(true);
  expect(alternativeLanesOpen(5, 2, true, [{ covered: 15, dart: false }])).toBe(false);
  // A second actor can coexist with any branch, including the three-lane transition.
  expect(alternativeLanesOpen(5, 2, true, [block, { covered: 1, dart: false }])).toBe(false);
});

it("checks each wall and dart combination against the existing stretch rule", () => {
  expect(
    alternativeLanesOpen(5, 2, true, [
      { alternatives: [2, 8], covered: 10, dart: false },
      { covered: 1, dart: true },
    ]),
  ).toBe(false);
  expect(
    alternativeLanesOpen(5, 2, false, [
      { alternatives: [2, 8], covered: 10, dart: false },
      { covered: 1, dart: true },
    ]),
  ).toBe(true);
});

it("does not use a possibly absent reactive wall to hide a dart-only stretch", () => {
  const walls = { covered: 10, dart: false };
  const dart = { covered: 4, dart: true };
  expect(
    alternativeLanesOpen(5, 2, true, [walls, { alternatives: [4], covered: 4, dart: false }, dart]),
  ).toBe(true);
  expect(
    alternativeLanesOpen(5, 2, true, [
      walls,
      { alternatives: [0, 4], covered: 4, dart: false },
      dart,
    ]),
  ).toBe(false);
});

it("counts a crosser's physical footprint while retaining its complete dodge sweep", () => {
  const path: MoverPath = {
    direction: 1,
    enterTravel: 400,
    idle: 280,
    lanesPerPixel: 0.0176,
    motion: "cross",
    movement: "dart",
    stopAfter: null,
    tilt: 0,
    turnAfter: 4.87,
    warning: 400,
  };
  const occupancy = deterministicOccupancyMasks(5, 1, 15, path);
  const dart = { covered: 15, dart: true, occupancy };
  expect(alternativeLanesOpen(5, 2, true, [dart])).toBe(true);
  expect(alternativeLanesOpen(5, 2, true, [dart, { covered: 3, dart: false }])).toBe(false);
  // A full-road dart sweep cannot acquire dodge clearance from a narrow current footprint.
  expect(alternativeLanesOpen(5, 2, true, [{ covered: 31, dart: true, occupancy }])).toBe(false);
});

it("counts deterministic step and merge bodies without losing their full sweeps or joint conflicts", () => {
  const step: MoverPath = {
    lane: 0,
    motion: "steps",
    movement: "step",
    steps: [0, 1, 2].map((index) => ({ at: 100 + index * 80, lanes: 1, length: 40, travel: 0 })),
    warning: 60,
  };
  const occupancy = deterministicOccupancyMasks(5, 1, 15, step)!;
  const block = { covered: 15, dart: false, occupancy };
  expect(alternativeLanesOpen(5, 2, true, [block])).toBe(true);
  expect(alternativeLanesOpen(5, 2, true, [block, { covered: 24, dart: false }])).toBe(false);
  expect(
    alternativeLanesOpen(5, 2, true, [
      block,
      {
        ...block,
        covered: 30,
        occupancy: deterministicOccupancyMasks(5, 1, 30, { ...step, lane: 1 }),
      },
    ]),
  ).toBe(false);
  // Open stretches still see the complete wall sweep and its remaining dart-only lane.
  expect(alternativeLanesOpen(5, 2, true, [block, { covered: 16, dart: true }])).toBe(false);

  const merge: MoverPath = {
    lane: 0,
    lanes: 2,
    merge: { at: 100, cue: 60, lanes: 1, length: 40 },
    motion: "ride",
    movement: "merge",
    speedMultiplier: 0.5,
    warning: 60,
  };
  const merged = {
    covered: 7,
    dart: false,
    occupancy: deterministicOccupancyMasks(5, 2, 7, merge),
  };
  expect(alternativeLanesOpen(5, 2, true, [merged])).toBe(true);
  expect(alternativeLanesOpen(5, 2, true, [merged, { covered: 8, dart: false }])).toBe(false);
  expect(deterministicOccupancyMasks(5, 1, 7, merge)).toBeUndefined();
  expect(deterministicOccupancyMasks(5, 2, 15, reactive)).toBeUndefined();
  expect(
    deterministicOccupancyMasks(5, 2, 15, { motion: "signature" } as MoverPath),
  ).toBeUndefined();

  for (const { covered, path, times, width } of [
    {
      covered: 15,
      path: step,
      times: step.steps.flatMap(({ at, length }) => [at, at + length / 2, at + length]),
      width: 1,
    },
    { covered: 7, path: merge, times: [100, 120, 140], width: 2 },
  ]) {
    const masks = deterministicOccupancyMasks(5, width, covered, path)!;
    let widest = 0;
    for (const since of times) {
      const place = moverPlace(5, path, since);
      const left = place.lanePosition * 64 + 12;
      const right = (place.lanePosition + drawnLanes(width, path)) * 64 - 12;
      const lanes = [0, 1, 2, 3, 4].filter((lane) => left < (lane + 1) * 64 && right > lane * 64);
      const mask = lanes.reduce((mask, lane) => mask | (1 << lane), 0);
      expect(masks.some((allowed) => (allowed & mask) === mask)).toBe(true);
      widest = Math.max(widest, lanes.length);
    }
    expect(widest).toBe(width + 1);
  }
});

it("covers evaluated skunk, multi-lane shy and turn-back bodies at transition phases", () => {
  const laneCount = 5,
    cellLength = 64,
    inset = 12;
  const skunk: MoverPath = {
    ...reactive,
    lengths: Array.from({ length: 6 }, () => 40),
    pending: [],
    rows: 6,
    steps: [-1, 1, 1, -1, -1, 1].map((lanes, index) => ({
      at: 200 + index * 40,
      lanes,
      length: 40,
      travel: 64,
    })),
  };
  const shy: MoverPath = {
    burst: 64,
    lane: 2,
    lengths: [80, 80],
    motion: "shy",
    movement: "hop",
    pending: [],
    reach: { count: 3, first: 0 },
    rise: 2,
    shapes: [
      { lanes: -2, travel: -1 },
      { lanes: 2, travel: -1 },
    ],
    steps: [-2, 2].map((lanes, index) => ({
      at: 200 + index * 80,
      lanes,
      length: 80,
      travel: -64,
    })),
    stopTravel: 550,
    warning: 100,
  };
  const cross: MoverPath = {
    direction: 1,
    enterTravel: 400,
    idle: 280,
    lanesPerPixel: 0.0176,
    motion: "cross",
    movement: "dart",
    stopAfter: null,
    tilt: 0,
    turnAfter: 4.8715919349342585,
    warning: 400,
  };
  const stepPhases = (path: typeof skunk | typeof shy) =>
    path.steps.flatMap(({ at, length }) =>
      [0, 1 / 4, 1 / 2, 3 / 4, 1].map((phase) => at + phase * length),
    );
  // Check the whole outward/return journey, including its turn and off-road clipping.
  const distances = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, cross.turnAfter!];
  const cases = [
    { masks: reactiveLaneMasks(2, skunk)!, path: skunk, times: stepPhases(skunk), width: 2 },
    { masks: reactiveLaneMasks(1, shy)!, path: shy, times: stepPhases(shy), width: 1 },
    {
      masks: deterministicOccupancyMasks(laneCount, 1, 31, cross)!,
      path: cross,
      times: distances.flatMap((distance) =>
        [distance, 2 * cross.turnAfter! - distance].map(
          (travel) => cross.warning + travel / cross.lanesPerPixel,
        ),
      ),
      width: 1,
    },
  ];
  for (const { masks, path, times, width } of cases) {
    let widest = 0;
    for (const since of times) {
      const place = moverPlace(laneCount, path, since);
      const left = place.lanePosition * cellLength + inset,
        right = (place.lanePosition + width) * cellLength - inset;
      // Intersect actual physical hit-box intervals with road cells, independently of masks.
      const lanes = Array.from({ length: laneCount }, (_, lane) => lane).filter(
        (lane) => place.solid && left < (lane + 1) * cellLength && right > lane * cellLength,
      );
      const occupied = lanes.reduce((mask, lane) => mask | (1 << lane), 0);
      expect(masks.some((mask) => (mask & occupied) === occupied)).toBe(true);
      expect(lanes.length).toBeLessThanOrEqual(width + 1);
      widest = Math.max(widest, lanes.length);
    }
    // Each fixture actually exercises a fractional transition, not only standing endpoints.
    expect(widest).toBe(width + 1);
  }
});

it("retains the full union for the safe path and restores alternative reservations atomically", () => {
  const plan: SpawnPlan<string> = {
    cellInset: 0,
    cellLength: 64,
    fixedKinds: [],
    laneCount: 5,
    laneInset: 12,
    laneMoveSeconds: 0.1,
    maxEmptyRows: Infinity,
    minOpenLanes: 2,
    minSpacing: 300,
    moverCaps: { darts: 6, slowVehicles: 4, total: 10 },
    packHitLength: 64,
    packLength: 64,
    pathLaneMoveSeconds: 0.3,
    pathStart: 4,
    quotas: [],
    reactionSeconds: 0,
    riderFollowGap: 64,
    roadLength: 724,
    scrollSpeed: 100,
    sightLength: 550,
    stepSeconds: 1 / 60,
    zoneLength: 6000,
  };
  const alternatives = reactiveLaneMasks(2, reactive);
  const lanes = new LaneBlocks(plan, 300, new Int32Array(20).fill(16));
  const cell = { lane: 0, row: 5 },
    footprint = { lanes: 4, rows: 2 };
  expect(
    lanes.tryBlock(cell, footprint, true, false, true, undefined, "complete", alternatives),
  ).toBe(true);
  const restore = lanes.save();
  expect(lanes.tryBlock({ lane: 0, row: 5 }, { lanes: 1, rows: 1 }, true)).toBe(false);
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  lanes.remove(lanes.latest());
  restore();
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  const crossedPath = new LaneBlocks(plan, 300, new Int32Array(20).fill(2));
  expect(
    crossedPath.tryBlock(cell, footprint, true, false, true, undefined, "complete", alternatives),
  ).toBe(false);
});
