import { describe, expect, it } from "vitest";

import { SpawnPlanningError, type SpawnPlanSnapshot } from "../runner/spawnSearch";
import { type SpawnAudit } from "../runner/spawnValidation";
import { step, walkWith } from "../testing/walk";
import {
  attachSpawnAudit,
  capturePlanningFailure,
  plannedWalkEvents,
  recordWalkEvents,
} from "./walkEvents";

const snapshot: SpawnPlanSnapshot = {
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

describe("simulator spawn observations", () => {
  it("preserves planning failures and replay draws without swallowing unrelated errors", () => {
    const state = { modifiers: ["rushHour"], visited: ["highPark"] };
    const failure = capturePlanningFailure(7, () => {
      state.visited.push("cabbagetown");
      throw new SpawnPlanningError("unfilled quota", snapshot);
    });
    expect(failure).toEqual({ message: "unfilled quota", seed: 7, snapshot });
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
    recordWalkEvents(events, before, step(before, 0));
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
    recordWalkEvents(events, before, moved);
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
});
