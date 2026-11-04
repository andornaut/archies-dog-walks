import { describe, expect, it, vi } from "vitest";

import { DART_LIFTS, drawMover, moverRetries } from "./moverDraws.ts";
import { type MoverSpec } from "./moverModel.ts";
import { moverPlacements } from "./moverPlanning.ts";
import {
  compileSlotKindDomain,
  describeSlotKind,
  isNativeSlotPreparation,
  prepareSlotKind,
  slotMotionSelections,
} from "./slotCandidates.ts";
import type { SlotKind, SlotSource } from "./slotConfig.ts";
import { blockingLength, rowSpacing, type SpawnPlan } from "./spawning.ts";

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
const cross: MoverSpec = {
  footprint: { lanes: 1, rows: 1 },
  motion: {
    kind: "cross",
    lanesPerSecond: 2,
    reactionSeconds: 0,
    startRoadShare: [0, 0],
    stopLanes: { max: 1, min: 1 },
    stopShare: 0,
    tilt: [-0.1, 0.1],
    turnAtShare: [0, 0],
    turnBackShare: 0,
    vergeShare: 0,
  },
  movement: "dart",
  variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0.2 },
  warningSeconds: 0,
};
const source = (mover: MoverSpec): SlotKind<string> => ({
  compile: vi.fn(() => ({ blocksLane: true, first: true, mover })),
  footprint: mover.footprint,
  kind: "mover",
  role: "minorMoving",
  weight: 2,
});
const streams = () => ({ movers: vi.fn(() => 0.6), spawns: vi.fn(() => 0.4) });
const aliases = (values: readonly object[]) => values.map((value) => values.indexOf(value));

describe("fresh slot descriptors and domains", () => {
  it("compiles and draws once while a plain full domain remains outside producer attestation", () => {
    const kind = source(cross);
    const draws = streams();
    const descriptor = describeSlotKind(draws, kind);
    const moverCalls = draws.movers.mock.calls.length;
    const spawnCalls = draws.spawns.mock.calls.length;
    expect(kind.compile).toHaveBeenCalledExactlyOnceWith(draws);
    const expectedStreams = streams();
    expect(descriptor.draws).toEqual(drawMover(expectedStreams));
    expect(moverCalls).toBe(expectedStreams.movers.mock.calls.length);
    expect(spawnCalls).toBe(expectedStreams.spawns.mock.calls.length);
    const work = { beforePlacement: vi.fn() };
    const domain = compileSlotKindDomain(work, geometry, descriptor);
    expect(domain.placements.length).toBeGreaterThan(0);
    expect(domain.request).toBe(descriptor.request);
    expect(domain.draws).toBe(descriptor.draws);
    expect(domain.source).toBe(kind);
    expect(isNativeSlotPreparation(domain)).toBe(false);
    expect(Object.isFrozen(domain)).toBe(false);
    expect(Object.isFrozen(domain.request)).toBe(false);
    expect(Object.isFrozen(domain.placements)).toBe(false);
    expect(work.beforePlacement).toHaveBeenCalledTimes(domain.compiledCount);
    expect(draws.movers).toHaveBeenCalledTimes(moverCalls);
    expect(draws.spawns).toHaveBeenCalledTimes(spawnCalls);
    expect(kind.compile).toHaveBeenCalledTimes(1);
    const prepared = prepareSlotKind(streams(), geometry, kind);
    expect(domain).toEqual(prepared);
    expect(aliases(domain.placements)).toEqual(aliases(prepared.placements));
    expect(isNativeSlotPreparation(prepared)).toBe(true);
    expect(isNativeSlotPreparation(domain)).toBe(false);
    expect(kind.compile).toHaveBeenCalledTimes(2);
  });

  it.each([
    cross,
    {
      ...cross,
      motion: { kind: "ride" as const, speedMultiplier: 1.5 },
      movement: "inLane" as const,
    },
  ])("preserves the exact coupled $motion.kind draw and lift order", (mover) => {
    const descriptor = describeSlotKind(streams(), source(mover));
    const draws = descriptor.draws!;
    const legal = [draws, ...moverRetries(mover, draws)];
    expect(legal.length).toBeGreaterThan(1);
    const lifts = mover.motion.kind === "cross" ? [0, ...DART_LIFTS] : [0];
    const selections = slotMotionSelections(descriptor);
    expect(selections).toEqual(legal.flatMap((draws) => lifts.map((lift) => ({ draws, lift }))));
    expect(selections[0]?.draws).toBe(draws);
    for (const [index, selection] of selections.entries()) {
      expect(selection.draws).toBe(
        selections[Math.floor(index / lifts.length) * lifts.length]!.draws,
      );
      expect(
        Object.keys(draws).filter(
          (key) => draws[key as keyof typeof draws] !== selection.draws[key as keyof typeof draws],
        ).length,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the original reactive count and complete native rank domain without recompiling", () => {
    const mover: MoverSpec = {
      ...cross,
      motion: {
        firstDelaySeconds: [0, 0],
        kind: "approach",
        secondRoadShare: [0.25, 0.5],
        stepSeconds: 0.1,
        steps: { max: 3, min: 2 },
      },
      movement: "approach",
    };
    const kind = source(mover);
    const draws = streams();
    const descriptor = describeSlotKind(draws, kind);
    expect(slotMotionSelections(descriptor)).toEqual([{ draws: descriptor.draws, lift: 0 }]);
    const raw = moverPlacements(
      {
        ...geometry,
        rowSpacing: rowSpacing({ ...geometry, quotas: [] }),
        window: blockingLength(geometry, 1),
      },
      mover,
      descriptor.draws,
    );
    const rank = Math.max(...raw.map((placement) => placement.rank ?? 0));
    expect(rank).toBeGreaterThan(0);
    const calls = [draws.movers.mock.calls.length, draws.spawns.mock.calls.length];
    const domain = compileSlotKindDomain(undefined, geometry, descriptor);
    expect(domain.compiledCount).toBe(new Set(raw).size);
    expect(domain.placements).toEqual(raw.filter((placement) => placement.rank === rank));
    expect(domain.placements.every((placement) => placement.path.motion === "approach")).toBe(true);
    expect([draws.movers.mock.calls.length, draws.spawns.mock.calls.length]).toEqual(calls);
    expect(kind.compile).toHaveBeenCalledTimes(1);
    expect(isNativeSlotPreparation(domain)).toBe(false);
  });

  it("rejects role and footprint mismatches before drawing movement", () => {
    const kind = source(cross);
    const invalid: readonly [SlotKind<string>, RegExp][] = [
      [{ ...kind, compile: () => ({ ...kind.compile(streams()), hazard: false }) }, /hazard role/],
      [{ ...kind, footprint: { lanes: 2, rows: 1 } }, /footprint mismatch/],
      [{ ...kind, role: "minorFixed" }, /profile role/],
    ];
    for (const [source, message] of invalid) {
      const draws = streams();
      expect(() => describeSlotKind(draws, source)).toThrow(message);
      expect(draws.movers).not.toHaveBeenCalled();
      expect(draws.spawns).not.toHaveBeenCalled();
    }
  });

  it("keeps fixed and herring descriptors out of placement-selection retries", () => {
    const fixed: SlotSource<string> = {
      compile: vi.fn(() => ({ blocksLane: false })),
      footprint: { lanes: 1, rows: 1 },
      kind: "tip",
      role: "auxiliaryFixed",
      weight: 1,
    };
    const draws = streams();
    const descriptor = describeSlotKind(draws, fixed);
    expect(descriptor).toMatchObject({ herring: false, request: { hazard: false } });
    expect(descriptor.draws).toBeUndefined();
    expect(draws.movers).not.toHaveBeenCalled();
    expect(draws.spawns).not.toHaveBeenCalled();
    const herring = source({
      ...cross,
      motion: {
        ...(cross.motion as Extract<MoverSpec["motion"], { kind: "cross" }>),
        herring: { endRoadShare: 0.5, share: 1 },
      },
    });
    const herringDescriptor = describeSlotKind(draws, herring);
    expect(herringDescriptor.herring).toBe(true);
    for (const value of [descriptor, herringDescriptor]) {
      expect(slotMotionSelections(value)).toEqual([]);
      const work = { beforePlacement: vi.fn() };
      const domain = compileSlotKindDomain(work, geometry, value);
      expect(domain.compiledCount).toBe(1);
      expect(domain.placements).toEqual([]);
      expect(work.beforePlacement).toHaveBeenCalledTimes(1);
      expect(isNativeSlotPreparation(domain)).toBe(false);
    }
    expect(fixed.compile).toHaveBeenCalledTimes(1);
    expect(herring.compile).toHaveBeenCalledTimes(1);
  });
});
