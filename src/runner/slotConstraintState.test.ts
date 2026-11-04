import { describe, expect, it, vi } from "vitest";

import { TEST_TUNING } from "../testing/tuning";
import { moverSpec } from "./moverSpecs";
import { createSlotCandidateDomains } from "./slotCandidateDomains";
import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates";
import {
  createSlotConstraintState,
  createSlotConstructionState,
  createSlotIntrinsicProbe,
} from "./slotConstraintState";
import { slotMotionStreams } from "./slotEntropy";
import { materialiseSlotPlan } from "./slotPlan";
import { SpawnBoard } from "./spawnBoard";
import { LaneBlocks, SpawnCells } from "./spawnCells";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";
import { auditSpawnPlan } from "./spawnValidation";
import * as visibility from "./spawnVisibility";

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
const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
  distance,
  lane: 4,
}));
const context = { seed: 7, zoneIndex: 0 };
function fixed(kind: string, row: number, lane: number, width = 1) {
  const prepared = prepareSlotKind(slotMotionStreams(context, kind, kind), geometry, {
    compile: () => ({ blocksLane: false, footprint: { lanes: width, rows: 1 } }),
    footprint: { lanes: width, rows: 1 },
    kind,
    role: "minorFixed",
    weight: 1,
  });
  return slotPlacementsAt(
    geometry,
    { distance: path[row]!.distance, lane, row, slot: 0 },
    prepared,
  )[0]!;
}
function hopper() {
  const prepared = prepareSlotKind(slotMotionStreams(context, "hopper", "hopper"), geometry, {
    compile: (streams) => ({
      blocksLane: true,
      mover: moverSpec(
        {
          tuning: {
            ...TEST_TUNING,
            seconds: {
              ...TEST_TUNING.seconds,
              moverHopSeconds: 1,
              moverMoveSecondsJitter: 0,
              moverTimingJitter: 0,
              moverWarningSeconds: 0,
            },
          },
        },
        streams,
        { lanes: 1, rows: 1 },
        { kind: "hop", most: 1, sideways: true, times: { max: 2, min: 2 } },
      ),
    }),
    footprint: { lanes: 1, rows: 1 },
    kind: "hopper",
    role: "minorMoving",
    weight: 1,
  });
  return slotPlacementsAt(
    geometry,
    { distance: path[4]!.distance, lane: prepared.columns[0]!, row: 4, slot: 0 },
    prepared,
  )[0]!;
}

describe("native slot constraint transactions", () => {
  it("reuses exact negative visibility tuples only with current attested entries and prefix owners", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const candidate = (key: string, kind: string, row: number, lane: number) => {
      const prepared = prepareSlotKind(slotMotionStreams(context, key, kind), geometry, {
        compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 } }),
        footprint: { lanes: 1, rows: 1 },
        kind,
        role: "minorFixed",
        weight: 1,
      });
      return domains.at(key, prepared, row, lane)[0]!;
    };
    const initial = candidate("initial", "shared", 2, 0);
    const incoming = candidate("incoming", "shared", 3, 0);
    const equivalent = candidate("equivalent", "shared", 3, 0);
    const unrelated = candidate("unrelated", "other", 8, 1);
    const proof = domains.intrinsic(equivalent);
    const state = createSlotConstraintState(geometry, path);
    const empty = state.checkpoint();
    const firstOwner = { key: "first" },
      nextOwner = { key: "next" };
    expect(state.commit(firstOwner, initial.entry).accepted).toBe(true);
    const coldStep = vi.fn(() => false);
    const keyQuery = vi.spyOn(SpawnBoard.prototype, "lookupNegativeVisibility");
    const serialise = vi.spyOn(JSON, "stringify");
    try {
      expect(state.lookupNegativeVisibility(coldStep, proof, nextOwner, equivalent.entry)).toEqual({
        status: "miss",
      });
      expect(coldStep).not.toHaveBeenCalled();
      expect(keyQuery).not.toHaveBeenCalled();
      expect(serialise).not.toHaveBeenCalled();
      expect(state.visibilityStatistics()).toMatchObject({
        attempts: 1,
        coldBypasses: 1,
        fingerprintBytes: 0,
        lookups: 0,
      });
    } finally {
      keyQuery.mockRestore();
      serialise.mockRestore();
    }
    const failure = state.probe({ key: "incoming" }, incoming.entry);
    expect(failure).toMatchObject({
      accepted: false,
      failure: { owners: [firstOwner], rule: "kind-lane" },
    });
    const mark = state.checkpoint();
    const step = vi.fn(() => true);
    const native = vi.spyOn(SpawnBoard.prototype, "probe");
    const predicate = vi.spyOn(visibility, "visibilityRejection");
    try {
      expect(
        state.lookupNegativeVisibility(step, proof, nextOwner, equivalent.entry),
      ).toMatchObject({
        failure: { owners: [firstOwner], rule: "kind-lane" },
        status: "blocked",
      });
      expect(native).not.toHaveBeenCalled();
      expect(predicate).not.toHaveBeenCalled();
      expect(step).toHaveBeenCalledTimes(1);
    } finally {
      native.mockRestore();
      predicate.mockRestore();
    }
    expect(state.probe({ key: "accepted" }, unrelated.entry).accepted).toBe(true);
    expect(
      state.lookupNegativeVisibility(
        () => true,
        domains.intrinsic(unrelated),
        { key: "accepted" },
        unrelated.entry,
      ),
    ).toEqual({ status: "miss" });
    expect(state.lookupNegativeVisibility(() => false, proof, nextOwner, equivalent.entry)).toEqual(
      { status: "budget" },
    );
    expect(
      state.lookupNegativeVisibility(() => true, { accepted: true }, nextOwner, equivalent.entry),
    ).toEqual({ status: "miss" });
    expect(state.lookupNegativeVisibility(() => true, proof, firstOwner, equivalent.entry)).toEqual(
      { status: "miss" },
    );
    expect(state.probe(firstOwner, equivalent.entry)).toMatchObject({
      failure: { rule: "duplicate-owner" },
    });
    const changed = Object.freeze({
      ...equivalent.entry,
      trace: Object.freeze({ ...equivalent.entry.trace, entry: -1 }),
    });
    expect(state.lookupNegativeVisibility(() => true, proof, nextOwner, changed)).toEqual({
      status: "miss",
    });
    expect(state.probe(nextOwner, changed)).toMatchObject({ failure: { rule: "trace-binding" } });
    const footprint = equivalent.entry.request.footprint!;
    Reflect.set(footprint, "lanes", 2);
    expect(state.lookupNegativeVisibility(() => true, proof, nextOwner, equivalent.entry)).toEqual({
      status: "miss",
    });
    Reflect.set(footprint, "lanes", 1);
    expect(state.commit({ key: "unrelated" }, unrelated.entry).accepted).toBe(true);
    coldStep.mockClear();
    expect(state.lookupNegativeVisibility(coldStep, proof, nextOwner, equivalent.entry)).toEqual({
      status: "miss",
    });
    expect(coldStep).not.toHaveBeenCalled();
    expect(state.lookupNegativeVisibility(() => true, proof, nextOwner, equivalent.entry)).toEqual({
      status: "miss",
    });
    state.restore(mark);
    expect(
      state.lookupNegativeVisibility(() => true, proof, nextOwner, equivalent.entry),
    ).toMatchObject({
      failure: { owners: [firstOwner] },
      status: "blocked",
    });
    state.restore(empty);
    const reboundOwner = { key: "rebound" };
    expect(state.commit(reboundOwner, initial.entry).accepted).toBe(true);
    expect(state.lookupNegativeVisibility(() => true, proof, nextOwner, equivalent.entry)).toEqual({
      status: "miss",
    });
    expect(state.probe({ key: "incoming" }, incoming.entry)).toMatchObject({
      failure: { owners: [reboundOwner] },
    });
    expect(
      state.lookupNegativeVisibility(() => true, proof, nextOwner, equivalent.entry),
    ).toMatchObject({
      failure: { owners: [reboundOwner] },
      status: "blocked",
    });
    const otherScope = createSlotConstraintState(
      { ...geometry, stepSeconds: geometry.stepSeconds * 2 },
      path,
      [{ entry: initial.entry, owner: firstOwner }],
    );
    expect(otherScope.probe({ key: "incoming" }, incoming.entry).accepted).toBe(false);
    expect(
      otherScope.lookupNegativeVisibility(() => true, proof, nextOwner, equivalent.entry),
    ).toEqual({ status: "miss" });
    expect(state.visibilityStatistics().hits).toBeGreaterThan(0);
  });

  it("keeps native outside-zone precedence when intrinsic acceptance cannot attest visibility readiness", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const prefixPrepared = prepareSlotKind(
      slotMotionStreams(context, "prefix", "shared"),
      geometry,
      {
        compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 } }),
        footprint: { lanes: 1, rows: 1 },
        kind: "shared",
        role: "minorFixed",
        weight: 1,
      },
    );
    const prefix = domains.at("prefix", prefixPrepared, 2, 0)[0]!.entry;
    const prepared = prepareSlotKind(slotMotionStreams(context, "rider", "shared"), geometry, {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: { kind: "ride", speedMultiplier: 1.5 },
          movement: "inLane",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0.2,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "shared",
      role: "minorMoving",
      weight: 1,
    });
    const entry = domains.at("rider", prepared, 3, 0)[0]!.entry;
    const proof = domains.intrinsic(domains.at("rider", prepared, 3, 0)[0]!);
    expect(proof.accepted).toBe(true);
    const state = createSlotConstraintState(geometry, path, [
      { entry: prefix, owner: { key: "prefix" } },
    ]);
    expect(state.probe({ key: "valid" }, entry)).toMatchObject({ failure: { rule: "kind-lane" } });
    expect(state.lookupNegativeVisibility(() => true, proof, { key: "valid" }, entry).status).toBe(
      "blocked",
    );
    const outside = Object.freeze({
      ...entry,
      placement: Object.freeze({ ...entry.placement!, screen: [-3000, -2999] as const }),
    });
    const outsideProof = createSlotIntrinsicProbe(geometry, path)(outside);
    expect(outsideProof).toEqual({ accepted: true });
    expect(
      state.lookupNegativeVisibility(() => true, outsideProof, { key: "outside" }, outside),
    ).toEqual({ status: "miss" });
    expect(state.probe({ key: "outside" }, outside)).toMatchObject({
      failure: { rule: "outside-zone" },
    });
  });

  it("attributes candidate-only lane failures intrinsically and overlapping blocks to their owner", () => {
    const road = { ...geometry, minOpenLanes: 2 };
    const wall = (kind: string, row: number, lane: number, width: number) => {
      const prepared = prepareSlotKind(slotMotionStreams(context, kind, kind), road, {
        compile: () => ({ blocksLane: true, footprint: { lanes: width, rows: 1 } }),
        footprint: { lanes: width, rows: 1 },
        kind,
        role: "minorFixed",
        weight: 1,
      });
      return slotPlacementsAt(
        road,
        { distance: path[row]!.distance, lane, row, slot: 0 },
        prepared,
      )[0]!;
    };
    const earlier = { key: "earlier" };
    const incoming = { key: "incoming" };
    const state = createSlotConstructionState(road, path);
    expect(state.commit(earlier, wall("earlier", 12, 0, 1)).accepted).toBe(true);
    const mark = state.checkpoint();
    const tooWide = wall("tooWide", 4, 0, 4);
    expect(state.probe(incoming, tooWide)).toEqual({
      accepted: false,
      failure: { classification: "intrinsic", owners: [], row: 4, rule: "open-lanes" },
    });
    state.restore(mark);
    const neighbour = { key: "neighbour" };
    expect(state.commit(neighbour, wall("neighbour", 4, 0, 1)).accepted).toBe(true);
    expect(state.probe(incoming, wall("shared", 4, 1, 3))).toEqual({
      accepted: false,
      failure: { classification: "conflict", owners: [neighbour], row: 4, rule: "open-lanes" },
    });
    state.restore(mark);
    expect(state.probe(incoming, tooWide)).toEqual({
      accepted: false,
      failure: { classification: "intrinsic", owners: [], row: 4, rule: "open-lanes" },
    });
  });

  it("defers only stretch clearance during construction and certifies complete boundaries without mutation", () => {
    const road: typeof geometry = {
      ...geometry,
      laneCount: 5,
      minOpenLanes: 2,
      pathStart: 0,
      zoneLength: 2000,
    };
    const path = zoneRows(road, rowSpacing({ ...road, quotas: [] })).map((distance) => ({
      distance,
      lane: 0,
    }));
    const wall = (kind: string, width: number) =>
      prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, road, {
        compile: () => ({ blocksLane: true, first: true, footprint: { lanes: width, rows: 1 } }),
        footprint: { lanes: width, rows: 1 },
        kind,
        role: "minorFixed",
        weight: 1,
      });
    const actual = wall("actual", 1);
    const earlier = wall("earlier", 2);
    const dart = prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, road, {
      compile: () => ({
        blocksLane: true,
        first: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: {
            kind: "cross",
            lanesPerSecond: 2,
            reactionSeconds: 0,
            startRoadShare: [0, 0],
            stopLanes: { max: 2, min: 2 },
            stopShare: 1,
            tilt: [0, 0],
            turnAtShare: [0.5, 0.5],
            turnBackShare: 0,
            vergeShare: 0,
          },
          movement: "dart",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "dart",
      role: "minorMoving",
      weight: 1,
    });

    const entries = [
      [actual, 2],
      [dart, 4],
      [earlier, 3],
    ].map(([raw, rawLane], slot) => {
      const prepared = raw as typeof actual;
      return slotPlacementsAt(
        road,
        { distance: path[4]!.distance, lane: rawLane as number, row: 4, slot },
        prepared,
      )[0]!;
    });
    const owners = entries.map((entry) => ({ key: entry.event.kind }));
    const strict = createSlotConstraintState(road, path);
    expect(strict.commit(owners[0]!, entries[0]!).accepted).toBe(true);
    expect(strict.commit(owners[1]!, entries[1]!)).toMatchObject({
      accepted: false,
      failure: { rule: "open-stretches" },
    });
    const state = createSlotConstructionState(road, path);
    expect(state.checkComplete()).toEqual({ accepted: true });
    expect(state.openStretchRow()).toBeUndefined();
    expect(state.commit(owners[0]!, entries[0]!).accepted).toBe(true);
    expect(state.commit(owners[1]!, entries[1]!).accepted).toBe(true);
    const prefix = state.entries();
    const saved = state.checkpoint();
    const failure = {
      accepted: false,
      failure: {
        classification: "conflict",
        owners: owners.slice(0, 2),
        row: 4,
        rule: "open-stretches",
      },
    };
    expect(state.checkComplete()).toEqual(failure);
    const beforeAdvice = JSON.stringify(state.entries());
    const visibilityBeforeAdvice = state.visibilityStatistics();
    const beforeProbe = state.probe(owners[2]!, entries[2]!);
    expect(state.openStretchRow()).toBe(4);
    expect(state.openStretchRow()).toBe(4);
    expect(JSON.stringify(state.entries())).toBe(beforeAdvice);
    expect(state.visibilityStatistics()).toEqual(visibilityBeforeAdvice);
    expect(state.probe(owners[2]!, entries[2]!)).toEqual(beforeProbe);
    expect(state.checkComplete()).toEqual(failure);
    expect(state.entries()).toEqual(prefix);
    expect(state.commit(owners[2]!, entries[2]!).accepted).toBe(true);
    expect(state.openStretchRow()).toBeUndefined();
    expect(state.checkComplete()).toEqual({ accepted: true });
    const assignments = state.entries().map(({ entry, owner }, index) => ({
      binding: {
        kind: entry.event.kind,
        role: index === 1 ? ("minorMoving" as const) : ("minorFixed" as const),
        weight: 1,
      },
      entry,
      key: owner.key,
      phase: "active" as const,
      role: index === 1 ? ("minorMoving" as const) : ("minorFixed" as const),
    }));
    const materialised = materialiseSlotPlan(road, path, assignments);
    expect(auditSpawnPlan(materialised.plan, materialised.planned)).toMatchObject({
      missingCoverage: [],
      status: "valid",
      validPlaced: 3,
      violations: [],
    });
    state.restore(saved);
    expect(state.entries()).toEqual(prefix);
    expect(state.openStretchRow()).toBe(4);
    expect(state.checkComplete()).toEqual(failure);
    expect(state.commit(owners[2]!, entries[2]!).accepted).toBe(true);
    expect(state.openStretchRow()).toBeUndefined();
    expect(state.checkComplete()).toEqual({ accepted: true });
    const wallEntry = (kind: string, width: number, lane: number) =>
      slotPlacementsAt(
        road,
        { distance: path[4]!.distance, lane, row: 4, slot: 0 },
        wall(kind, width),
      )[0]!;
    const wide = wallEntry("wide", 4, 1);
    const otherFailure = new SpawnBoard(
      "partial",
      { ...road, quotas: [wide.request] },
      path,
      undefined,
      [wide],
    );
    const rejected = vi.fn();
    expect(otherFailure.checkComplete(rejected)).toBe(false);
    expect(rejected).toHaveBeenCalledWith(expect.objectContaining({ rule: "open-lanes" }));
    expect(otherFailure.openStretchRow()).toBeUndefined();
    const native = createSlotConstructionState(road, path);
    expect(native.commit(owners[0]!, entries[0]!).accepted).toBe(true);
    expect(native.probe({ key: "collision" }, wallEntry("collision", 1, 2))).toMatchObject({
      accepted: false,
      failure: { rule: "cells" },
    });
    expect(
      createSlotConstructionState(road, path).probe({ key: "wide" }, wallEntry("wide", 4, 1)),
    ).toMatchObject({
      accepted: false,
      failure: { rule: "open-lanes" },
    });
    expect(native.probe({ key: "path" }, wallEntry("path", 1, 0))).toMatchObject({
      accepted: false,
      failure: { classification: "intrinsic", rule: "path" },
    });
  });

  it("distinguishes nonmonotone dart stretches from minimum lane failures", () => {
    const plan = { ...geometry, minOpenLanes: 2, quotas: [] };
    for (const occupancy of [undefined, [0, 8, 16, 24]]) {
      const lanes = new LaneBlocks(plan, rowSpacing(plan), new Int32Array(path.length));
      lanes.retainBlock({ lane: 2, row: 3 }, { lanes: 1, rows: 1 });
      const failed = vi.fn();
      expect(
        lanes.tryBlock(
          { lane: 3, row: 3 },
          { lanes: 2, rows: 1 },
          false,
          true,
          true,
          failed,
          "complete",
          undefined,
          occupancy,
        ),
      ).toBe(false);
      expect(failed).toHaveBeenLastCalledWith(expect.objectContaining({ rule: "open-stretches" }));
      lanes.retainBlock({ lane: 3, row: 3 }, { lanes: 2, rows: 1 }, true, undefined, occupancy);
      expect(lanes.keepsAllLanesOpen(failed, "partial")).toBe(true);
      expect(lanes.keepsAllLanesOpen(failed)).toBe(false);
      expect(failed).toHaveBeenLastCalledWith(expect.objectContaining({ rule: "open-stretches" }));
      // Adding a wall can repair the stretch without increasing the occupied union.
      lanes.retainBlock({ lane: 3, row: 3 }, { lanes: 2, rows: 1 });
      expect(lanes.keepsAllLanesOpen()).toBe(true);
      lanes.retainBlock({ lane: 1, row: 3 }, { lanes: 1, rows: 1 });
      expect(lanes.keepsAllLanesOpen(failed)).toBe(false);
      expect(failed).toHaveBeenLastCalledWith(expect.objectContaining({ rule: "open-lanes" }));
    }
  });

  it("includes elsewhere prefix owners only for nonmonotone stretch dependency", () => {
    const first = { entry: fixed("first", 2, 0), owner: { key: "first" } };
    const elsewhere = { entry: fixed("elsewhere", 8, 1), owner: { key: "elsewhere" } };
    const state = createSlotConstraintState(geometry, path, [first, elsewhere]);
    const prepared = prepareSlotKind(slotMotionStreams(context, "wall", "wall"), geometry, {
      compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind: "wall",
      role: "minorFixed",
      weight: 1,
    });
    const incoming = slotPlacementsAt(
      geometry,
      { distance: path[5]!.distance, lane: 0, row: 5, slot: 0 },
      prepared,
    )[0]!;
    const failure = vi
      .spyOn(LaneBlocks.prototype, "tryBlock")
      .mockImplementation((_cell, _footprint, _keep, _dart, _wholeZone, observer) => {
        observer?.({ row: 5, rule: "open-stretches" });
        return false;
      });
    try {
      expect(state.probe({ key: "incoming" }, incoming)).toEqual({
        accepted: false,
        failure: {
          classification: "conflict",
          owners: [first.owner, elsewhere.owner],
          row: 5,
          rule: "open-stretches",
        },
      });
      expect(state.entries().map(({ owner }) => owner)).toEqual([first.owner, elsewhere.owner]);
    } finally {
      failure.mockRestore();
    }
  });

  it("restores nested native ledgers and exact conflict owners", () => {
    const actual = { key: "actual" };
    const hypothetical = { key: "hypothetical" };
    const replacement = { key: "replacement" };
    const probeOwner = { key: "probe" };
    const initial = fixed("bench", 2, 4);
    const incoming = hopper();
    expect(incoming).toBeDefined();
    const frozen = JSON.stringify([initial, incoming]);
    const state = createSlotConstraintState(geometry, path, [{ entry: initial, owner: actual }]);
    const root = state.checkpoint();
    const kept = state.commit(hypothetical, incoming);
    expect(kept.accepted).toBe(true);
    if (!kept.accepted) {
      throw new Error("Expected the native hopper to fit");
    }
    expect(kept.entry.trace.quotaIndex).toBe(1);
    expect(kept.entry.event.mover).toBe(incoming.event.mover);
    expect(state.probe(probeOwner, incoming)).toEqual({
      accepted: false,
      failure: {
        classification: "conflict",
        owners: [hypothetical],
        rule: "kind-row",
      },
    });
    expect(state.entries()[1]!.owner).toBe(hypothetical);
    const conflict = state.probe(probeOwner, incoming);
    if (conflict.accepted) {
      throw new Error("Expected the retained native owner conflict");
    }
    expect(conflict.failure.owners[0]).toBe(hypothetical);
    const nested = state.checkpoint();
    state.restore(root);
    expect(state.entries()).toHaveLength(1);
    expect(state.commit(replacement, fixed("replacement", 12, 4)).accepted).toBe(true);
    state.restore(nested);
    expect(state.entries().map(({ owner }) => owner)).toEqual([actual, hypothetical]);
    expect(state.probe(probeOwner, incoming)).toMatchObject({
      accepted: false,
      failure: { owners: [hypothetical] },
    });
    state.restore(root);
    expect(state.probe(probeOwner, incoming).accepted).toBe(true);
    expect(state.probe({ key: "wide" }, fixed("wide", 10, 0, 2)).accepted).toBe(true);
    expect(JSON.stringify([initial, incoming])).toBe(frozen);
    expect(() => state.restore(createSlotConstraintState(geometry, path).checkpoint())).toThrow(
      RangeError,
    );
    expect(state.commit({ key: actual.key }, fixed("duplicate", 12, 4))).toMatchObject({
      accepted: false,
      failure: { classification: "intrinsic", rule: "duplicate-owner" },
    });
  });
  it("holds attributed conflict blockers only while each owner keeps its placement", () => {
    const owner = { key: "owner" };
    const incoming = hopper();
    const state = createSlotConstructionState(geometry, path);
    const root = state.checkpoint();
    expect(state.commit(owner, incoming).accepted).toBe(true);
    const conflict = state.probe({ key: "probe" }, incoming);
    if (conflict.accepted) {
      throw new Error("Expected a same-kind conflict");
    }
    const blockers = state.blockersOf(conflict.failure)!;
    expect(blockers).toEqual([[owner, incoming]]);
    const placed = state.checkpoint();
    state.restore(root);
    expect(state.blockersPlaced(blockers)).toBe(false);
    state.restore(placed);
    expect(state.blockersPlaced(blockers)).toBe(true);
    state.restore(root);
    expect(state.commit(owner, fixed("bench", 2, 4)).accepted).toBe(true);
    expect(state.blockersPlaced(blockers)).toBe(false);
    expect(
      state.blockersOf({ classification: "conflict", owners: [owner], rule: "open-stretches" }),
    ).toBeUndefined();
  });
  it("restores every native mover, prize and resting-cell ownership category", () => {
    const cells = new SpawnCells(2, 3, 0);
    cells.standOn(0, 1, true);
    const root = cells.save();
    cells.takeMover(true, 0, 0);
    cells.takeMover(true, 1, 0);
    cells.takeMover(false, 2, 0);
    cells.takeMover(false, 0, 1, true);
    cells.takePrize(false, 1, 1);
    cells.holdRest(1, 4);
    cells.reserved = 3;
    root();
    expect(cells.heldFor(0, { blocksLane: false, count: 1, kind: "pickup" })).toBe(1);
    expect(cells.heldFor(1, { blocksLane: false, count: 1, kind: "pickup" })).toBe(0);
    expect(cells.isFreeForRepair("cross", 1, 0, true)).toBe(true);
    expect(cells.isFreeForRepair("steps", 2, 0, true)).toBe(true);
    expect(cells.isFreeForRepair("steps", 0, 1, true)).toBe(true);
    expect(cells.isFreeForRepair("ride", 1, 1, false)).toBe(true);
    expect(cells.isFreeForRepair("ride", 2, 0, true)).toBe(true);
    expect(
      cells.heldFor(1, {
        blocksLane: false,
        count: 1,
        kind: "pickup",
        moversPassOver: true,
        moversRestOn: true,
      }),
    ).toBe(0);
    expect(cells.reserved).toBe(0);
    expect(cells.leavesRoom(5)).toBe(true);
    expect(cells.isFree("ride", 0, 0, true)).toBe(true);
    cells.lift(0, 1);
    expect(cells.leavesRoom(6)).toBe(true);
  });
  it("uses native immutable path checks before occupied-cell owners", () => {
    const owner = { key: "pickup" };
    const row = 4;
    const lane = 4;
    const pickup = fixed("pickup", row, lane);
    const prepared = prepareSlotKind(slotMotionStreams(context, "wall", "wall"), geometry, {
      compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind: "wall",
      role: "minorFixed",
      weight: 1,
    });
    const wall = slotPlacementsAt(
      geometry,
      { distance: path[row]!.distance, lane, row, slot: 0 },
      prepared,
    )[0]!;
    const intrinsic = createSlotIntrinsicProbe(geometry, path);
    const state = createSlotConstraintState(geometry, path, [{ entry: pickup, owner }]);
    expect(intrinsic(wall)).toEqual({ accepted: false, rule: "path" });
    expect(state.probe({ key: "wall" }, wall)).toEqual({
      accepted: false,
      failure: {
        classification: "intrinsic",
        owners: [],
        rule: "path",
      },
    });
    const other = fixed("other", 10, 0, 2);
    expect(intrinsic(other)).toEqual({ accepted: true });
    expect(state.probe({ key: "other" }, other).accepted).toBe(true);
    expect(state.entries()[0]!.owner).toBe(owner);
  });
  it("keeps unknown native owner references unattributed", () => {
    const observed = vi
      .spyOn(SpawnBoard.prototype, "probe")
      .mockImplementation((_entry, reject) => {
        reject({ classification: "conflict", conflicts: ["999:0"], rule: "cells" });
        return false;
      });
    try {
      const state = createSlotConstraintState(geometry, path);
      expect(state.probe({ key: "candidate" }, fixed("candidate", 2, 4))).toEqual({
        accepted: false,
        failure: {
          classification: "unattributed",
          owners: [],
          rule: "cells",
        },
      });
      expect(state.entries()).toEqual([]);
    } finally {
      observed.mockRestore();
    }
  });
});
