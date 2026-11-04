import { afterEach, describe, expect, it, vi } from "vitest";

import type { MoverSpec } from "./moverModel.ts";
import * as audits from "./slotAudit.ts";
import {
  isNativeSlotPreparation,
  prepareSlotKind,
  prepareSlotKindWithin,
} from "./slotCandidates.ts";
import type { SlotKind } from "./slotConfig.ts";
import * as entropy from "./slotEntropy.ts";
import { planSlotSpawns, SLOT_LIMITS } from "./slotPlanner.ts";
import type { SpawnPlan, SpawnQuota } from "./spawning.ts";

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
const context = { seed: 7, zoneIndex: 0 };
const variation = { delaySeconds: 0, lengthShare: 0, speedShare: 0 };
const prefix: MoverSpec = {
  footprint: { lanes: 1, rows: 1 },
  motion: {
    count: { max: 2, min: 2 },
    kind: "steps",
    sequences: [
      [
        { lanes: 1, travel: 0 },
        { lanes: 1, travel: 0 },
      ],
      [
        { lanes: 1, travel: 0 },
        { lanes: -1, travel: 0 },
      ],
      [
        { lanes: -1, travel: 0 },
        { lanes: 1, travel: 0 },
      ],
    ],
    stepSeconds: 1,
  },
  movement: "step",
  variation,
  warningSeconds: 0,
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
    tilt: [0, 0],
    turnAtShare: [0, 0],
    turnBackShare: 0,
    vergeShare: 0,
  },
  movement: "dart",
  variation,
  warningSeconds: 0,
};
function source(kind: string, mover = prefix): SlotKind<string> {
  return {
    compile: () => ({ blocksLane: true, first: true, mover }),
    footprint: mover.footprint,
    kind,
    role: "minorMoving",
    weight: 1,
  };
}
const streams = () => ({ movers: vi.fn(() => 0.5), spawns: vi.fn(() => 0.5) });
function allowance(limit: number, initial = 0) {
  let used = initial;
  return {
    template: vi.fn(() => {
      if (used >= limit) {
        return false;
      }
      used++;
      return true;
    }),
    used: () => used,
  };
}
const aliases = (values: readonly object[]) => values.map((value) => values.indexOf(value));

afterEach(() => vi.restoreAllMocks());

describe("bounded native preparation", () => {
  it.each([
    source("prefix"),
    source("cross", cross),
    source("rider", {
      ...prefix,
      motion: { kind: "ride", speedMultiplier: 1.5 },
      movement: "inLane",
    }),
    source("signature", {
      ...prefix,
      motion: {
        kind: "signature",
        profile: {
          finishAheadSeconds: 0.1,
          kind: "rectangle",
          lanes: 1,
          legSeconds: 0.1,
          rows: 1,
          warningSeconds: 0.1,
        },
      },
    }),
  ])(
    "bills each unique $kind template and preserves complete native output and aliases",
    (kind) => {
      const originalStreams = streams(),
        boundedStreams = streams();
      const original = prepareSlotKind(originalStreams, geometry, kind);
      expect(original.placements.length).toBeGreaterThan(0);
      const work = allowance(original.compiledCount);
      const result = prepareSlotKindWithin(work, boundedStreams, geometry, kind);
      expect(result.status).toBe("complete");
      if (result.status !== "complete") {
        throw Error("Expected a complete preparation");
      }
      expect(result.prepared).toEqual(original);
      expect(aliases(result.prepared.placements)).toEqual(aliases(original.placements));
      expect(work.used()).toBe(original.compiledCount);
      expect(work.template).toHaveBeenCalledTimes(original.compiledCount);
      expect(isNativeSlotPreparation(result.prepared)).toBe(true);
      expect(boundedStreams.movers.mock.calls).toEqual(originalStreams.movers.mock.calls);
      expect(boundedStreams.spawns.mock.calls).toEqual(originalStreams.spawns.mock.calls);
      const tail = allowance(original.compiledCount - 1);
      expect(prepareSlotKindWithin(tail, streams(), geometry, kind)).toEqual({ status: "budget" });
      expect(tail.used()).toBe(original.compiledCount - 1);
    },
  );

  it("stops before a seventh native allocation in the six-template remaining tail", () => {
    let created = 0;
    const observed = source("observed", {
      ...prefix,
      get movement() {
        created++;
        return "step" as const;
      },
    });
    const originalStreams = streams(),
      boundedStreams = streams();
    expect(prepareSlotKind(originalStreams, geometry, source("observed")).compiledCount).toBe(8);
    const work = allowance(65536, 65530);
    const result = prepareSlotKindWithin(work, boundedStreams, geometry, observed);
    expect(result).toEqual({ status: "budget" });
    expect(result).not.toHaveProperty("prepared");
    expect(work.used()).toBe(65536);
    expect(work.template).toHaveBeenCalledTimes(7);
    expect(created).toBe(6);
    expect(boundedStreams.movers.mock.calls).toEqual(originalStreams.movers.mock.calls);
    expect(boundedStreams.spawns.mock.calls).toEqual(originalStreams.spawns.mock.calls);
  });

  it("bills the one-unit fixed, herring and empty-profile floors without exposing a partial preparation", () => {
    const fixed: SlotKind<string> = {
      compile: () => ({ blocksLane: false }),
      footprint: { lanes: 1, rows: 1 },
      kind: "fixed",
      role: "minorFixed",
      weight: 1,
    };
    const herring = source("herring", {
      ...cross,
      motion: {
        ...(cross.motion as Extract<MoverSpec["motion"], { kind: "cross" }>),
        herring: { endRoadShare: 0.5, share: 1 },
      },
    });
    const empty = source("empty", {
      ...prefix,
      motion: {
        ...(prefix.motion as Extract<MoverSpec["motion"], { kind: "steps" }>),
        count: { max: 0, min: 0 },
        sequences: [],
      },
    });
    for (const kind of [fixed, herring, empty]) {
      const work = allowance(1);
      const result = prepareSlotKindWithin(work, streams(), geometry, kind);
      expect(result.status, kind.kind).toBe("complete");
      expect(work.used(), kind.kind).toBe(1);
      expect(prepareSlotKindWithin(allowance(0), streams(), geometry, kind)).toEqual({
        status: "budget",
      });
    }
  });
});

function producerFixture(compiledTemplates: number, invalidLateProfile = false) {
  const alpha = source("alpha");
  const badDraw = entropy.slotMotionStreams(context, "active:minorMoving:7", "alpha").movers();
  expect(entropy.slotMotionStreams(context, "active:minorMoving:0", "alpha").movers()).not.toBe(
    badDraw,
  );
  const catalogue = [
    invalidLateProfile
      ? {
          ...alpha,
          compile: (draws: Parameters<SlotKind<string>["compile"]>[0]) => {
            if (draws.movers() === badDraw) {
              throw Error("Invalid late profile");
            }
            return alpha.compile(draws);
          },
        }
      : alpha,
    source("beta"),
  ];
  // Balanced source heads admit the nine-entry incumbent before a new alternate profile is needed.
  const nativeRandom = entropy.slotRandom;
  vi.spyOn(entropy, "slotRandom").mockImplementation((context, name) =>
    name.endsWith("-source-order")
      ? () => (Number(/minorMoving:(\d+)-source-order$/.exec(name)?.[1]) % 2 === 1 ? 0.99 : 0)
      : nativeRandom(context, name),
  );
  const counts = { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 8 };
  const auxiliary: readonly SpawnQuota<string>[] = [
    { blocksLane: false, count: 1, kind: "tip", within: [100000, 100000] },
    { blocksLane: false, count: 1, kind: "tip" },
  ];
  return planSlotSpawns(
    {
      ...context,
      limits: { ...SLOT_LIMITS, anchors: 4000, candidateChecks: 4000, compiledTemplates },
    },
    geometry,
    catalogue,
    auxiliary,
    {
      active: counts,
      capacity: counts,
      guarantees: [
        { count: 1, kind: "alpha", role: "minorMoving" },
        { count: 1, kind: "beta", role: "minorMoving" },
      ],
    },
  );
}

describe("template-budget incumbent retention", () => {
  it("returns a budget stop with full attempted-profile/template accounting before any incumbent", () => {
    const result = producerFixture(6);
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") {
      throw Error("Expected preparation budget exhaustion");
    }
    expect(result.stage).toBe("construction");
    expect(result.failures).toContainEqual(expect.objectContaining({ code: "template-budget" }));
    expect(result.diagnostics).toMatchObject({
      audits: 0,
      compiledTemplates: 6,
      profileCompiles: 1,
    });
  });

  it("retains an independently certified nine-of-ten incumbent through a partial eight-template preparation", () => {
    const result = producerFixture(72);
    expect(result.status, JSON.stringify(result)).toBe("partial");
    if (result.status !== "partial") {
      throw Error("Expected the earlier certified incumbent");
    }
    expect(result.partialAudit.status).toBe("valid");
    expect(result.delivery).toMatchObject({ configured: 10, delivered: 9, required: 9 });
    expect(result.diagnostics.compiledTemplates).toBe(72);
    expect(result.diagnostics.profileCompiles).toBe(11);
    expect(
      result.assignments.filter(
        (a) => a.key === "active:minorMoving:0" || a.key === "active:minorMoving:1",
      ),
    ).toHaveLength(2);
    expect(result.diagnostics.audits).toBeGreaterThanOrEqual(2);
  });

  it("keeps a genuine late profile exception fatal after a native incumbent has been certified", () => {
    const audit = vi.spyOn(audits, "auditSlotPartialPlan");
    const result = producerFixture(SLOT_LIMITS.compiledTemplates, true);
    expect(
      audit.mock.results.some(({ value }) => value.status === "valid"),
      JSON.stringify(result),
    ).toBe(true);
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") {
      throw Error("Expected the genuine profile failure");
    }
    expect(result.stage).toBe("configuration");
    expect(result.diagnostics).toMatchObject({ compiledTemplates: 66, profileCompiles: 11 });
    expect(result.failures).toContainEqual({
      code: "invalid-profile",
      kind: "alpha",
      role: "minorMoving",
    });
  });
});
