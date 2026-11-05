import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SLOT_LIMITS } from "../runner/slotPlanner.ts";
import { SpawnPlanningError, type SpawnPlanSnapshot } from "../runner/spawnSearch.ts";
import { type SpawnAudit } from "../runner/spawnValidation.ts";
import type { WalkItemKind } from "../runner/walkItems.ts";
import type { ZoneSlotDelivery } from "../runner/zonePlan.ts";
import {
  replayZoneSlots,
  type ZoneSlotInput,
  ZoneSlotPlanningError,
} from "../runner/zoneSlotInput.ts";
import { step, walkWith } from "../testing/walk.ts";
import { sumDeliveries, zoneDelivery } from "./delivery.ts";
import {
  attachSpawnAudit,
  capturePlanningFailure,
  plannedWalkEvents,
  recordWalkEvents,
} from "./walkEvents.ts";

const snapshot: SpawnPlanSnapshot<WalkItemKind> = {
  context: { seed: 7, zoneIndex: 3 },
  draws: { movers: [0.2], spawns: [0.4] },
  plan: {
    cellInset: 0,
    cellLength: 10,
    fixedKinds: [],
    laneCount: 5,
    laneInset: 0,
    laneMoveSeconds: 0.1,
    maxEmptyRows: null,
    minOpenLanes: 2,
    minSpacing: 20,
    moverCaps: { darts: 6, slowVehicles: 4, total: 10 },
    packHitLength: 10,
    packLength: 10,
    pathLaneMoveSeconds: 0.3,
    pathStart: 2,
    quotas: [],
    reactionSeconds: 0.5,
    riderFollowGap: 10,
    roadLength: 100,
    scrollSpeed: 100,
    sightLength: 90,
    stepSeconds: 1 / 60,
    zoneLength: 1000,
  },
};

function slotInput(): ZoneSlotInput<WalkItemKind> {
  const { quotas: auxiliary, ...geometry } = snapshot.plan;
  return {
    actualRun: walkWith(["ginger"]).run,
    auxiliary,
    catalogue: [
      {
        footprint: { lanes: 1, rows: 1 },
        kind: "tip",
        movement: null,
        role: "minorFixed",
        spec: { blocksLane: false },
        weight: 1,
      },
    ],
    config: {
      active: { encounterFixed: 0, encounterMoving: 0, minorFixed: 1, minorMoving: 0 },
      capacity: { encounterFixed: 0, encounterMoving: 0, minorFixed: 2, minorMoving: 0 },
      guarantees: [],
    },
    context: { limits: SLOT_LIMITS, seed: 7, zoneIndex: 3 },
    geometry,
    tuning: gameData.tuning,
  };
}

describe("simulator spawn observations", () => {
  it("replays an audited optional omission with the original runtime denominator and policy", () => {
    const input: ZoneSlotInput<WalkItemKind> = {
      ...slotInput(),
      auxiliary: [
        { blocksLane: false, count: 8, kind: "tip" },
        { blocksLane: false, count: 1, kind: "treat", within: [0, 0] },
      ],
    };
    const encoded = JSON.stringify(input);
    const result = replayZoneSlots(input);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") {
      throw Error("Expected an independently audited optional reward omission");
    }
    expect(result.partialAudit.status).toBe("valid");
    expect(result).not.toHaveProperty("activeAudit");
    const slots: ZoneSlotDelivery = {
      delivery: result.delivery,
      partialAudit: result.partialAudit,
      status: result.status,
    };
    const events = plannedWalkEvents(7, input.actualRun, "highPark", {
      herrings: result.planned.herrings,
      pending: result.planned.events,
      planned: result.plan.quotas,
      slots,
    });
    attachSpawnAudit(events, result.partialAudit.geometry);
    expect(events.configured).toBe(10);
    expect(events.slots?.delivery).toMatchObject({ configured: 10, delivered: 9, required: 9 });
    expect(events.kinds.tip).toMatchObject({ admitted: 9, requested: 9, valid: 9 });
    expect(events.kinds.treat).toMatchObject({ admitted: 0, requested: 1, valid: 0 });
    const counts = zoneDelivery(gameData, 1, "highPark", {
      pending: result.planned.events,
      planned: result.plan.quotas.map(({ count, kind, mover }) => ({
        count,
        kind,
        movement: mover?.movement ?? null,
      })),
      slots,
    });
    expect(sumDeliveries([counts, counts])[0]?.runtime).toEqual({
      completePlans: 0,
      configured: 20,
      delivered: 18,
      omitted: 2,
      partialPlans: 2,
    });
    const replayed = replayZoneSlots(JSON.parse(encoded) as typeof input);
    expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(result)));
    expect(JSON.stringify(input)).toBe(encoded);
  });

  it("replays actual counts below the authored maximum", () => {
    const input = slotInput();
    const actual = replayZoneSlots(input);
    expect(actual.status).toBe("complete");
    if (actual.status !== "complete") {
      throw Error("Expected a valid layout");
    }
    expect(actual.assignments).toHaveLength(1);
    expect(actual.activeAudit.status).toBe("valid");
    expect(actual).not.toHaveProperty("capacityWitness");
    expect(input.config.active.minorFixed).toBe(1);
  });

  it("preserves exact runtime slot failure input and result without a legacy quota snapshot", () => {
    const input = { ...slotInput(), catalogue: [] };
    const result = replayZoneSlots(input);
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") {
      throw Error("Expected unsupported original catalogue");
    }
    const error = new ZoneSlotPlanningError(input, result);
    const failure = capturePlanningFailure(7, () => {
      throw error;
    });
    expect(failure).toMatchObject({ kind: "slots", purpose: "runtime-actual", seed: 7 });
    if (failure?.kind !== "slots") {
      throw Error("Expected actual slot diagnostic");
    }
    expect(failure.input).toBe(input);
    expect(failure.result).toBe(result);
    expect(failure).not.toHaveProperty("snapshot");
    expect(JSON.parse(JSON.stringify(failure)).input.context).toEqual(input.context);
  });

  it("preserves planning failures and replay draws without swallowing unrelated errors", () => {
    const state = { modifiers: ["rushHour"], visited: ["highPark"] };
    const failure = capturePlanningFailure(7, () => {
      state.visited.push("cabbagetown");
      throw new SpawnPlanningError("unfilled quota", snapshot);
    });
    expect(failure).toEqual({ kind: "quota", message: "unfilled quota", seed: 7, snapshot });
    expect(state.visited).toEqual(["highPark", "cabbagetown"]);
    expect(state.modifiers).toEqual(["rushHour"]);
    expect(() =>
      capturePlanningFailure(7, () => {
        throw new Error("broken bot");
      }),
    ).toThrow("broken bot");
  });

  it("keeps frozen requests, admitted events and actual runner dispatch distinct", () => {
    const before = walkWith(["ginger"]);
    before.road.planned = [{ count: 2, kind: "touristTrain", movement: null }];
    before.road.pending = [{ distance: 0, kind: "touristTrain", lane: 0 }];
    before.road.herrings = [{ distance: 20, kind: "touristTrain", lane: 0 }];
    const events = plannedWalkEvents(7, before.run, "highPark", before.road);
    recordWalkEvents(new Map(), events, before, step(before, 0));
    expect(events.configured).toBe(2);
    expect(events.kinds.touristTrain).toMatchObject({
      admitted: 2,
      encountered: 0,
      generated: 1,
      herrings: 1,
      requested: 2,
      valid: null,
    });
  });

  it("does not treat a side departure or incomplete audit as a valid encounter", () => {
    const before = walkWith(["ginger"]);
    before.road.pending = [];
    before.road.items = [{ height: 10, id: 8, kind: "bench", lane: 0, laneSpan: 1, y: 0 }];
    before.road.planned = [{ count: 1, kind: "bench", movement: null }];
    const events = plannedWalkEvents(7, before.run, "highPark", before.road);
    const moved = step(before, 0);
    moved.walk.road.items = [];
    recordWalkEvents(new Map([[8, events]]), events, before, moved);
    const audit: SpawnAudit = {
      counts: [{ emitted: 1, kind: "bench", movement: null, requested: 1, validPlaced: 0 }],
      findings: [],
      meetsPlacementFloor: true,
      meetsValidPlacementFloor: false,
      minimumPlaced: 1,
      missingCoverage: ["moving route"],
      placed: 1,
      requested: 1,
      status: "unverified",
      validPlaced: 0,
      violations: [],
    };
    attachSpawnAudit(events, audit);
    expect(events.kinds.bench).toMatchObject({ departed: 1, encountered: 0, valid: null });
    expect(events.audit).toBe(audit);
    expect(events.validation).toBe("unverified");
  });

  it("preserves same-kind origins across zones and retires a same-frame dispatch", () => {
    const before = walkWith(["ginger"]);
    before.road.nextItemId = 10;
    before.road.planned = [
      { count: 1, kind: "bench", movement: null },
      { count: 1, kind: "thief", movement: null },
      { count: 1, kind: "tip", movement: null },
    ];
    before.road.pending = [
      { distance: 0, kind: "bench", lane: 0 },
      { distance: 0, kind: "thief", lane: 1 },
      { distance: 0, kind: "tip", lane: 2 },
    ];
    const carried = { height: 10, id: 9, kind: "bench", lane: 0, laneSpan: 1, y: 0 } as const;
    const carriedCard = { height: 10, id: 8, kind: "thief", lane: 1, laneSpan: 1, y: 0 } as const;
    before.road.items = [carried, carriedCard];
    const original = plannedWalkEvents(7, before.run, "highPark", {
      herrings: [],
      pending: [{ kind: "bench" }, { kind: "thief" }],
      planned: [
        { count: 1, kind: "bench" },
        { count: 1, kind: "thief" },
      ],
    });
    const current = plannedWalkEvents(
      7,
      { ...before.run, zoneIndex: 1 },
      "cabbagetown",
      before.road,
    );
    const origins = new Map([
      [9, original],
      [8, original],
    ]);
    const moved = step(before, 0);
    const justSpawned = moved.walk.road.items.find(({ id }) => id === 12)!;
    expect(justSpawned.kind).toBe("tip");
    moved.collected.push(justSpawned);
    moved.walk.road.items = moved.walk.road.items.filter(
      ({ id }) => id !== carried.id && id !== carriedCard.id && id !== justSpawned.id,
    );
    moved.bumps.push({ cash: null, change: null, dodged: true, dog: "ginger", item: carried });
    moved.encounterHits.push({ affected: ["ginger"], encounter: "thief", kind: "encounter" });
    moved.encounterItems = [carriedCard];
    recordWalkEvents(origins, current, before, moved);
    // Admitted, departed, encountered, generated, requested and touched.
    const counted = (events: typeof current, kind: WalkItemKind) => {
      const counts = events.kinds[kind];
      return counts === undefined
        ? undefined
        : [
            counts.admitted,
            counts.departed,
            counts.encountered,
            counts.generated,
            counts.requested,
            counts.touched,
          ];
    };
    expect({
      currentBench: counted(current, "bench"),
      currentThief: counted(current, "thief"),
      currentTip: counted(current, "tip"),
      originalBench: counted(original, "bench"),
      originalThief: counted(original, "thief"),
    }).toEqual({
      currentBench: [1, 0, 0, 1, 1, 0],
      currentThief: [1, 0, 0, 1, 1, 0],
      currentTip: [1, 1, 1, 1, 1, 1],
      originalBench: [1, 1, 1, 0, 1, 0],
      originalThief: [1, 1, 1, 0, 1, 1],
    });
    expect(current.configured).toBe(3);
    expect(origins.has(12)).toBe(false);
    expect(origins.get(10)).toBe(current);
    expect(origins.get(11)).toBe(current);
    expect(origins.has(9)).toBe(false);
    expect(origins.has(8)).toBe(false);
  });
});
