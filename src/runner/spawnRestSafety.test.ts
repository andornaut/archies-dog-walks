import { describe, expect, it } from "vitest";

import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import { materialiseSlotPlan } from "./slotPlan.ts";
import { moverRestSpans, rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";
import { auditSpawnPlan } from "./spawnValidation.ts";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 50,
  moverCaps: { darts: 3, slowVehicles: 3, total: 6 },
  packHitLength: 20,
  packLength: 20,
  pathLaneMoveSeconds: 0.1,
  pathStart: 0,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 300,
  scrollSpeed: 100,
  sightLength: 400,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
  distance,
  lane: 0,
}));

function fixture(moversRestOn = false) {
  const prepared = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, geometry, {
    compile: () => ({
      blocksLane: true,
      mover: {
        footprint: { lanes: 2, rows: 2 },
        hitLength: 58,
        motion: {
          count: { max: 1, min: 1 },
          kind: "steps",
          sequences: [[{ lanes: 1, travel: 32 }]],
          stepSeconds: 0.2,
        },
        movement: "step",
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
        warningSeconds: 0,
      },
    }),
    footprint: { lanes: 2, rows: 2 },
    kind: "walker",
    role: "minorMoving",
    weight: 1,
  });
  const mover = slotPlacementsAt(
    geometry,
    { distance: path[4]!.distance, lane: 2, row: 4, slot: 0 },
    prepared,
  )[0]!;
  const pickup = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, geometry, {
    compile: () => ({ blocksLane: false, moversPassOver: true, moversRestOn }),
    footprint: { lanes: 1, rows: 1 },
    kind: "pickup",
    role: "auxiliaryFixed",
    weight: 1,
  });
  const prize = slotPlacementsAt(
    geometry,
    { distance: path[5]!.distance, lane: 4, row: 5, slot: 1 },
    pickup,
  )[0]!;
  return { mover, prize, spec: prepared.request.mover! };
}

describe("native settled mover body safety", () => {
  it("rejects pickup overlap in either insertion order and independently audits the full body", () => {
    const { mover, prize, spec } = fixture();
    expect(mover).toBeDefined();
    expect(prize).toBeDefined();
    const rests = moverRestSpans(geometry, spec, mover.event);
    expect(rests).toHaveLength(1);
    const rest = rests[0]!;
    expect(rest.lanes).toBe(2);
    expect(rest.length).toBe(58);
    expect(rest.distance).toBeLessThan(prize.event.distance);
    expect(rest.distance + rest.length).toBeGreaterThan(prize.event.distance);
    expect(rest.lane + 1).toBe(prize.event.lane);
    const moverOwner = { key: "mover" },
      pickupOwner = { key: "pickup" };
    const state = createSlotConstructionState(geometry, path);
    const root = state.checkpoint();
    expect(state.commit(moverOwner, mover).accepted).toBe(true);
    expect(state.probe(pickupOwner, prize)).toMatchObject({
      accepted: false,
      failure: { classification: "conflict", owners: [moverOwner], rule: "cells" },
    });
    state.restore(root);
    expect(state.commit(pickupOwner, prize).accepted).toBe(true);
    expect(state.probe(moverOwner, mover)).toMatchObject({
      accepted: false,
      failure: { classification: "conflict", owners: [pickupOwner], rule: "pickup" },
    });
    state.restore(root);
    expect(state.entries()).toEqual([]);
    const malformed = materialiseSlotPlan(
      geometry,
      path,
      [mover, prize].map((entry, index) => ({
        binding: {
          kind: entry.event.kind,
          role: index === 0 ? "minorMoving" : "auxiliaryFixed",
          weight: 1,
        },
        entry: { ...entry, trace: { ...entry.trace, quotaIndex: index } },
        key: String(index),
        phase: "active",
        role: index === 0 ? "minorMoving" : "auxiliaryFixed",
      })),
    );
    const audit = auditSpawnPlan(malformed.plan, malformed.planned);
    expect(audit.status).toBe("invalid");
    const finding = (kind: string) =>
      audit.findings.find(
        ({ index, source }) =>
          source === "events" && malformed.planned.events[index]?.kind === kind,
      )!;
    expect(finding("walker").reasons).toContain("moving rest intersects pickup");
    expect(finding("pickup").reasons).toContain("pickup intersects moving rest");
  });

  it("retains the explicit permission for a mover to rest on a pickup", () => {
    const { mover, prize } = fixture(true);
    const state = createSlotConstructionState(geometry, path);
    expect(state.commit({ key: "mover" }, mover).accepted).toBe(true);
    expect(state.commit({ key: "pickup" }, prize).accepted).toBe(true);
    expect(state.checkComplete()).toEqual({ accepted: true });
  });
});
