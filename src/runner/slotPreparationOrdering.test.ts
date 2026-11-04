import { describe, expect, it, vi } from "vitest";

import type { MoverSpec } from "./moverPlanning";
import {
  isNativeSlotPreparation,
  nativeSlotPreparationOrderingHint,
  prepareSlotKind,
  prepareSlotKindWithin,
} from "./slotCandidates";
import type { SlotSource } from "./slotConfig";
import type { SpawnPlan } from "./spawning";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 4,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const variation = { delaySeconds: 0, lengthShare: 0, speedShare: 0 };
const profile = () => {
  const footprint = { lanes: 2, rows: 1 };
  const motion = {
    firstDelaySeconds: [0, 0] as const,
    kind: "approach" as const,
    secondRoadShare: [0.5, 0.5] as const,
    stepSeconds: 0.1,
    steps: { max: 2, min: 2 },
  };
  const compile = vi.fn(() => ({
    blocksLane: true,
    mover: { footprint, motion, movement: "approach" as const, variation, warningSeconds: 0 },
  }));
  const source: SlotSource<string> = {
    compile,
    footprint,
    kind: "following",
    role: "minorMoving",
    weight: 1,
  };
  return { compile, footprint, motion, source };
};
const work = () => ({ propagate: vi.fn(() => true) });
const streams = () => ({ movers: vi.fn(() => 0.5), spawns: vi.fn(() => 0.5) });

it("reuses a frozen full-profile minimum from native preparation without compiling or drawing again", () => {
  const { compile, source } = profile();
  const random = streams();
  const template = vi.fn(() => true);
  const result = prepareSlotKindWithin({ template }, random, geometry, source);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") {
    throw Error("Incomplete native preparation");
  }
  const prepared = result.prepared;
  expect(source.footprint.lanes).toBe(2);
  expect(Math.min(...prepared.placements.map(({ lanes }) => lanes.count))).toBe(4);
  const draws = [random.movers.mock.calls.length, random.spawns.mock.calls.length];
  const compiled = template.mock.calls.length;
  const guard = work();
  const first = nativeSlotPreparationOrderingHint(guard, prepared);
  const second = nativeSlotPreparationOrderingHint(guard, prepared);
  expect(first).toEqual({ hint: { envelopeWidth: 4 }, status: "hint" });
  expect(second).toEqual(first);
  if (first.status !== "hint" || second.status !== "hint") {
    throw Error("Missing ordering snapshot");
  }
  expect(first.hint).toBe(second.hint);
  expect(Object.isFrozen(first.hint)).toBe(true);
  expect(guard.propagate).toHaveBeenCalledTimes(2);
  expect(compile).toHaveBeenCalledTimes(1);
  expect([random.movers.mock.calls.length, random.spawns.mock.calls.length]).toEqual(draws);
  expect(template).toHaveBeenCalledTimes(compiled);
});

it("requires the original native identity, source method and borrowed profile shape", () => {
  const { footprint, motion, source } = profile();
  const prepared = prepareSlotKind(streams(), geometry, source);
  expect(isNativeSlotPreparation(prepared)).toBe(true);
  expect(isNativeSlotPreparation({ ...prepared })).toBe(false);
  footprint.rows++;
  expect(isNativeSlotPreparation(prepared)).toBe(false);
  footprint.rows--;
  motion.steps.max++;
  expect(isNativeSlotPreparation(prepared)).toBe(false);
  motion.steps.max--;
  expect(isNativeSlotPreparation(prepared)).toBe(true);
  const compile = source.compile;
  Object.defineProperty(source, "compile", { value: () => compile(streams()) });
  expect(isNativeSlotPreparation(prepared)).toBe(false);
});

describe("complete native ordering boundaries", () => {
  it("keeps the nominal fallback for empty fixed and moving catalogues", () => {
    const fixed: SlotSource<string> = {
      compile: () => ({ blocksLane: false, footprint: { lanes: 2, rows: 1 } }),
      footprint: { lanes: 2, rows: 1 },
      kind: "item",
      role: "auxiliaryFixed",
      weight: 1,
    };
    const { source } = profile();
    const outside = { ...geometry, laneCount: 1 };
    for (const prepared of [
      prepareSlotKind(streams(), geometry, fixed),
      prepareSlotKind(streams(), outside, source),
    ]) {
      expect(prepared.placements).toEqual([]);
      expect(nativeSlotPreparationOrderingHint(work(), prepared)).toEqual({
        hint: { envelopeWidth: 2 },
        status: "hint",
      });
    }
  });

  it("preserves a native zero-lane contact envelope instead of replacing it with art width", () => {
    const mover: MoverSpec = {
      footprint: { lanes: 1, rows: 1 },
      motion: {
        kind: "signature",
        profile: {
          downSeconds: 0.2,
          finishAheadSeconds: 0.1,
          kind: "turnExit",
          lanesPerSecond: 5,
          rows: 1,
          warningSeconds: 0.1,
        },
      },
      movement: "inLane",
      variation,
      warningSeconds: 0.1,
    };
    const source: SlotSource<string> = {
      compile: () => ({ blocksLane: true, mover }),
      footprint: mover.footprint,
      kind: "exit",
      role: "minorMoving",
      weight: 1,
    };
    const prepared = prepareSlotKind(streams(), geometry, source);
    expect(prepared.placements.length).toBeGreaterThan(0);
    expect(Math.min(...prepared.placements.map(({ lanes }) => lanes.count))).toBe(0);
    expect(nativeSlotPreparationOrderingHint(work(), prepared)).toEqual({
      hint: { envelopeWidth: 0 },
      status: "hint",
    });
  });
});
