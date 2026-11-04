import { describe, expect, it, vi } from "vitest";

import { TEST_TUNING } from "../testing/tuning.ts";
import { alternativeLanesOpen, requiredAlternativeWalls } from "./laneAlternatives.ts";
import { moverSpec } from "./moverSpecs.ts";
import {
  createSlotCandidateDomains,
  type SlotCandidate,
  type SlotOwnerDomainToken,
} from "./slotCandidateDomains.ts";
import {
  isNativeSlotCrossOnly,
  nativeSlotPreparationWallRows,
  prepareSlotKind,
} from "./slotCandidates.ts";
import { createSlotConstructionState, projectSlotWalls } from "./slotConstraintState.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 2,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 0,
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
  lane: 0,
}));
const work = { anchor: () => true, check: () => true, propagate: () => true, stopped: () => false };
function standing(kind: string, width = 1, blocking = true) {
  return prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
    compile: () => ({ blocksLane: blocking, first: true, footprint: { lanes: width, rows: 1 } }),
    footprint: { lanes: width, rows: 1 },
    kind,
    role: "minorFixed",
    weight: 1,
  });
}

describe("native pocket proof boundaries", () => {
  it("derives the necessary closure from the same universal reactive stretch states", () => {
    const blocks = [
      { alternatives: [0, 1, 3, 2, 6, 4], covered: 7, dart: false },
      { covered: 7, dart: true, occupancy: [0, 1, 3, 2, 6, 4] },
    ];
    expect(alternativeLanesOpen(5, 2, true, blocks)).toBe(false);
    const required = requiredAlternativeWalls(() => true, 5, blocks);
    expect(required).toEqual({ mask: 3, status: "complete" });
    if (required.status !== "complete") {
      throw new Error("Expected a complete native explanation");
    }
    expect(
      alternativeLanesOpen(5, 2, true, [...blocks, { covered: required.mask, dart: false }]),
    ).toBe(true);
    expect(
      alternativeLanesOpen(5, 2, true, [...blocks, { covered: required.mask & 1, dart: false }]),
    ).toBe(false);
    expect(requiredAlternativeWalls(() => false, 5, blocks)).toEqual({ status: "budget" });
  });

  it("attests only full owner frontiers with their exact native row projections", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const preparations = [standing("wall"), standing("pickup", 1, false)];
    const owner = {
      key: "active:fixed:0",
      phase: "active" as const,
      preparations: () => preparations,
    };
    const scope = domains.pocketScope([owner]);
    const values: { value: SlotCandidate<string>; guaranteedWalls: number }[] = [];
    let token: SlotOwnerDomainToken | undefined;
    for (const step of domains.completeOwnerDomain(work, scope, owner)) {
      if (step.status === "candidate") {
        const projected = domains.guaranteedWalls(work, scope, 4, owner, step.value);
        expect(projected.status).toBe("walls");
        if (projected.status !== "walls") {
          throw new Error("Expected owned native projection");
        }
        values.push({ guaranteedWalls: projected.mask, value: step.value });
      } else if (step.status === "complete") {
        token = step.token;
      } else {
        throw new Error(`Unexpected frontier ${step.status}`);
      }
    }
    expect(token).toBeDefined();
    expect(values.some((item) => item.guaranteedWalls === 0)).toBe(true);
    expect(values.some((item) => item.guaranteedWalls !== 0)).toBe(true);
    expect(domains.attestsOwnerDomain(work, scope, 4, owner, values, token!)).toBe(true);
    expect(domains.attestsOwnerDomain(work, scope, 4, owner, values.slice(1), token!)).toBe(false);
    expect(domains.attestsOwnerDomain(work, scope, 4, owner, values, { ...token! })).toBe(false);
    expect(domains.attestsOwnerDomain(work, scope, 4, { ...owner }, values, token!)).toBe(false);
    const interrupted = [
      ...domains.completeOwnerDomain({ ...work, stopped: () => true }, scope, owner),
    ];
    expect(interrupted).toEqual([{ status: "budget" }]);
    owner.preparations = () => preparations.slice(0, 1);
    expect(domains.attestsOwnerDomain(work, scope, 4, owner, values, token!)).toBe(false);
  });

  it("never completes an owner domain after empty or truncated producer EOF", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const prepared = standing("wall");
    let stopped = false;
    const empty = {
      key: "empty",
      phase: "active" as const,
      preparations: () => {
        stopped = true;
        return [];
      },
    };
    const emptyScope = domains.pocketScope([empty]);
    const stopWork = { ...work, stopped: () => stopped };
    expect([...domains.completeOwnerDomain(stopWork, emptyScope, empty)]).toEqual([
      { status: "budget" },
    ]);
    stopped = false;
    const partial = {
      key: "partial",
      phase: "active" as const,
      *preparations() {
        yield prepared;
        stopped = true;
      },
    };
    const scope = domains.pocketScope([partial]);
    const steps = [...domains.completeOwnerDomain(stopWork, scope, partial)];
    expect(steps.some((step) => step.status === "candidate")).toBe(true);
    expect(steps.some((step) => step.status === "complete")).toBe(false);
    expect(steps.at(-1)).toEqual({ status: "budget" });
  });

  it("projects absent reactive positions as zero guaranteed wall coverage", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const prepared = prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
      compile: (streams) => ({
        blocksLane: true,
        mover: moverSpec(
          { tuning: TEST_TUNING },
          streams,
          { lanes: 1, rows: 1 },
          { kind: "approach", steps: { max: 3, min: 2 } },
        ),
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "reactive",
      role: "minorMoving",
      weight: 1,
    });
    const owner = { key: "reactive", phase: "active" as const, preparations: () => [prepared] };
    const scope = domains.pocketScope([owner]);
    const iterator = domains.completeOwnerDomain(work, scope, owner);
    const first = iterator.next();
    expect(first.value?.status).toBe("candidate");
    if (first.done || first.value.status !== "candidate") {
      throw new Error("Expected a native reactive value");
    }
    const candidate = first.value.value;
    const row = candidate.entry.trace.placement!.block.row;
    expect(candidate.entry.trace.placement!.block.lanes.count).toBeGreaterThan(0);
    expect(domains.guaranteedWalls(work, scope, row, owner, candidate)).toEqual({
      mask: 0,
      status: "walls",
    });
    iterator.return(undefined);
  });

  it("omits authentic cross-only profiles without expanding their anchors or hiding static suppliers", () => {
    const road = { ...geometry, pathStart: geometry.laneCount - 1 };
    const nativePath = path.map((row) => ({ ...row, lane: road.pathStart }));
    const crossing = prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, road, {
      compile: () => ({
        blocksLane: true,
        first: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: {
            kind: "cross",
            lanesPerSecond: 2,
            pause: { seconds: 0.1, stops: [[2, 2]] },
            reactionSeconds: 0,
            startRoadShare: [0, 0],
            stopLanes: { max: 2, min: 2 },
            stopShare: 1,
            tilt: [0, 0],
            turnAtShare: [0.5, 0.5],
            turnBackShare: 0,
            vergeShare: 0,
          },
          movement: "stopAndGoAcross",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "crossing",
      role: "minorMoving",
      weight: 1,
    });
    const wall = standing("wall");
    expect(crossing.placements.length).toBeGreaterThan(0);
    expect(crossing.placements.some((placement) => placement.stop !== undefined)).toBe(true);
    expect(isNativeSlotCrossOnly(crossing)).toBe(true);
    expect(isNativeSlotCrossOnly(wall)).toBe(false);
    expect(isNativeSlotCrossOnly({ ...crossing })).toBe(false);
    const owner = { key: "owner", phase: "active" as const, preparations: () => [crossing, wall] };
    const oracle = createSlotCandidateDomains(road, nativePath);
    const oracleScope = oracle.pocketScope([owner]);
    const oracleWork = { ...work, anchor: vi.fn(work.anchor) };
    const expected: { guaranteedWalls: number; id: string }[] = [];
    let crossValues = 0;
    let oracleComplete = false;
    for (const step of oracle.completeOwnerDomain(oracleWork, oracleScope, owner)) {
      if (step.status === "candidate") {
        const mask = projectSlotWalls(work.propagate, road, nativePath, 4, step.value.entry);
        expect(mask).toBeDefined();
        if (step.value.prepared === crossing) {
          crossValues++;
          expect(mask).toBe(0);
        }
        if (mask !== 0) {
          expected.push({ guaranteedWalls: mask!, id: step.value.id });
        }
      } else {
        expect(step.status).toBe("complete");
        oracleComplete = step.status === "complete";
      }
    }
    expect(oracleComplete).toBe(true);
    expect(crossValues).toBeGreaterThan(0);
    const domains = createSlotCandidateDomains(road, nativePath);
    const scope = domains.pocketScope([owner]);
    const counted = { ...work, anchor: vi.fn(work.anchor) };
    const steps = [...domains.completeOwnerWalls(counted, scope, 4, owner)];
    const values = steps.flatMap((step) => (step.status === "candidate" ? [step] : []));
    const end = steps.at(-1);
    expect(end?.status).toBe("complete");
    if (end?.status !== "complete") {
      throw new Error("Expected a complete native supplier frontier");
    }
    expect(values.map(({ guaranteedWalls, value }) => ({ guaranteedWalls, id: value.id }))).toEqual(
      expected,
    );
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(({ value }) => value.prepared === wall)).toBe(true);
    expect(counted.anchor.mock.calls.length).toBeLessThan(oracleWork.anchor.mock.calls.length);
    expect(domains.statistics().projection.indexedTemplates).toBe(0);
    expect(domains.attestOwnerWalls(work, scope, 4, owner, values, end.token)).toBe(true);
    expect(Reflect.set(crossing.placements[0]!.path, "motion", "ride")).toBe(false);
    expect(isNativeSlotCrossOnly(crossing)).toBe(true);
    expect(domains.attestOwnerWalls(work, scope, 4, owner, values, end.token)).toBe(true);
  });

  it("keeps every moving supplier across its compiled block span while omitting zero-wall anchors", () => {
    const prepared = prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: { kind: "ride", speedMultiplier: 0.5 },
          movement: "inLane",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0.2,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "rider",
      role: "minorMoving",
      weight: 1,
    });
    expect(nativeSlotPreparationWallRows(prepared)).toBeGreaterThan(prepared.source.footprint.rows);
    expect(nativeSlotPreparationWallRows({ ...prepared })).toBeUndefined();
    expect(Reflect.set(prepared.placements[0]!, "rows", 1)).toBe(false);
    const owner = { key: "rider", phase: "active" as const, preparations: () => [prepared] };
    const row = 5;
    const oracle = createSlotCandidateDomains(geometry, path);
    const oracleScope = oracle.pocketScope([owner]);
    const fullWork = { ...work, anchor: vi.fn(work.anchor) };
    const expected: { guaranteedWalls: number; id: string }[] = [];
    let earlierSupplier = false;
    let completed = false;
    for (const step of oracle.completeOwnerDomain(fullWork, oracleScope, owner)) {
      if (step.status === "candidate") {
        const mask = projectSlotWalls(work.propagate, geometry, path, row, step.value.entry);
        expect(mask).toBeDefined();
        if (mask !== 0) {
          earlierSupplier ||= step.value.entry.trace.placement!.block.row < row;
          expected.push({ guaranteedWalls: mask!, id: step.value.id });
        }
      } else {
        expect(step.status).toBe("complete");
        completed = step.status === "complete";
      }
    }
    expect(completed).toBe(true);
    expect(earlierSupplier).toBe(true);
    const domains = createSlotCandidateDomains(geometry, path);
    const scope = domains.pocketScope([owner]);
    const counted = { ...work, anchor: vi.fn(work.anchor) };
    const steps = [...domains.completeOwnerWalls(counted, scope, row, owner)];
    const values = steps.flatMap((step) => (step.status === "candidate" ? [step] : []));
    const end = steps.at(-1);
    expect(end?.status).toBe("complete");
    if (end?.status !== "complete") {
      throw new Error("Expected the complete moving supplier frontier");
    }
    expect(values.map(({ guaranteedWalls, value }) => ({ guaranteedWalls, id: value.id }))).toEqual(
      expected,
    );
    expect(counted.anchor.mock.calls.length).toBeLessThan(fullWork.anchor.mock.calls.length);
    expect(domains.attestOwnerWalls(work, scope, row, owner, values, end.token)).toBe(true);
    const rows = nativeSlotPreparationWallRows(prepared);
    expect(rows).toBeDefined();
    expect(Reflect.set(prepared.placements[0]!.path, "speedMultiplier", 0.25)).toBe(false);
    expect(nativeSlotPreparationWallRows(prepared)).toBe(rows);
    expect(domains.attestOwnerWalls(work, scope, row, owner, values, end.token)).toBe(true);
  });

  it("binds pocket obligations to the exact native prefix and restores their context", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const wall = standing("wall"),
      repair = standing("repair", 2);
    const dart = prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
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
    const owners = [wall, dart, repair].map((prepared) => ({
      key: prepared.source.kind,
      phase: "active" as const,
      preparations: () => [prepared],
    }));
    const scope = domains.pocketScope(owners);
    const state = createSlotConstructionState(geometry, path);
    expect(
      state.commit(owners[0]!, domains.at(owners[0]!.key, wall, 4, 2)[0]!.entry).accepted,
    ).toBe(true);
    expect(
      state.commit(owners[1]!, domains.at(owners[1]!.key, dart, 4, 4)[0]!.entry).accepted,
    ).toBe(true);
    const context = {};
    const explanation = state.explainPocket(() => true, scope, context);
    expect(explanation.status).toBe("obligation");
    if (explanation.status !== "obligation") {
      throw new Error("Expected the native stretch failure");
    }
    expect(explanation.obligation.row).toBe(4);
    expect(explanation.obligation.requiredWalls).toBeGreaterThan(0);
    expect(state.attestsPocket(scope, context, explanation.obligation)).toBe(true);
    expect(state.attestsPocket(scope, context, { ...explanation.obligation })).toBe(false);
    const before = state.checkpoint();
    expect(
      state.commit(owners[2]!, domains.at(owners[2]!.key, repair, 4, 3)[0]!.entry).accepted,
    ).toBe(true);
    expect(state.explainPocket(() => true, scope, context)).toEqual({ status: "clear" });
    expect(state.attestsPocket(scope, context, explanation.obligation)).toBe(false);
    state.restore(before);
    expect(state.attestsPocket(scope, context, explanation.obligation)).toBe(true);
    expect(state.explainPocket(() => false, scope, context)).toEqual({ status: "budget" });
  });

  it("attests only the exact immutable native kind-row pair in its scope and context", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const prepared = standing("parked");
    const first = { key: "first", phase: "active" as const, preparations: () => [prepared] };
    const second = { key: "second", phase: "active" as const, preparations: () => [prepared] };
    const scope = domains.pocketScope([first, second]);
    const otherScope = domains.pocketScope([first, second]);
    const state = createSlotConstructionState(geometry, path);
    const a = domains.at(first.key, prepared, 4, 2)[0]!;
    const b = domains.at(second.key, prepared, 4, 3)[0]!;
    expect(state.commit(first, a.entry).accepted).toBe(true);
    const context = {};
    const ordinary = state.probe(second, b.entry);
    expect(ordinary.accepted).toBe(false);
    if (ordinary.accepted) {
      throw new Error("Expected native pair rejection");
    }
    expect(
      state.additionStable(() => true, scope, context, second, b.entry, ordinary.failure),
    ).toBe(false);
    const captured = state.capturePocket(
      () => true,
      scope,
      context,
      () => state.probe(second, b.entry),
    );
    expect(captured.status).toBe("captured");
    if (captured.status !== "captured") {
      throw new Error("Expected explicit native fact capture");
    }
    const failed = captured.result;
    expect(failed).toMatchObject({
      accepted: false,
      failure: { owners: [first], rule: "kind-row" },
    });
    if (failed.accepted) {
      throw new Error("Expected native same-row visibility rejection");
    }
    expect(state.additionStable(() => true, scope, context, second, b.entry, failed.failure)).toBe(
      true,
    );
    expect(
      state.additionStable(() => true, otherScope, context, second, b.entry, failed.failure),
    ).toBe(false);
    expect(state.additionStable(() => true, scope, {}, second, b.entry, failed.failure)).toBe(
      false,
    );
    expect(() => Object.assign(b.entry.request.footprint!, { rows: 2 })).toThrow(TypeError);
    expect(state.additionStable(() => true, scope, context, second, b.entry, failed.failure)).toBe(
      true,
    );
    expect(
      state.additionStable(() => true, scope, context, second, b.entry, { ...failed.failure }),
    ).toBe(false);
    expect(
      state.additionStable(() => false, scope, context, second, b.entry, failed.failure),
    ).toBeUndefined();
  });

  it("binds native failure support and rejects foreign attestations", () => {
    const domains = createSlotCandidateDomains(geometry, path);
    const one = standing("one"),
      two = standing("two");
    const first = { key: "first", phase: "active" as const, preparations: () => [one] };
    const second = { key: "second", phase: "active" as const, preparations: () => [two] };
    const scope = domains.pocketScope([first, second]);
    const state = createSlotConstructionState(geometry, path);
    const a = domains.at(first.key, one, 4, 2)[0]!;
    const b = domains.at(second.key, two, 4, 2)[0]!;
    expect(state.commit(first, a.entry).accepted).toBe(true);
    const context = {};
    const ordinary = state.probe(second, b.entry);
    if (ordinary.accepted) {
      throw new Error("Expected ordinary native conflict");
    }
    expect(
      state.additionStable(() => true, scope, context, second, b.entry, ordinary.failure),
    ).toBe(false);
    const captured = state.capturePocket(
      () => true,
      scope,
      context,
      () => state.commit(second, b.entry),
    );
    expect(captured.status).toBe("captured");
    if (captured.status !== "captured") {
      throw new Error("Expected explicitly captured native commitment trial");
    }
    const failure = captured.result;
    expect(failure.accepted).toBe(false);
    if (failure.accepted) {
      throw new Error("Expected native cell conflict");
    }
    expect(state.additionStable(() => true, scope, context, second, b.entry, failure.failure)).toBe(
      true,
    );
    expect(
      state.additionStable(() => true, scope, context, second, b.entry, { ...failure.failure }),
    ).toBe(false);
    expect(state.attestsPocketOwners(() => true, scope, [second])).toBe(true);
    expect(state.attestsPocketOwners(() => true, scope, [])).toBe(false);
    let ran = 0;
    const trial = () => {
      ran++;
      return state.probe(second, b.entry);
    };
    expect(state.capturePocket(() => false, scope, context, trial)).toEqual({ status: "budget" });
    expect(state.capturePocket(() => true, { ...scope }, context, trial)).toEqual({
      status: "unknown",
    });
    expect(ran).toBe(0);
    expect(() =>
      state.capturePocket(
        () => true,
        scope,
        context,
        () => {
          throw new Error("trial failed");
        },
      ),
    ).toThrow("trial failed");
    const after = state.probe(second, b.entry);
    if (after.accepted) {
      throw new Error("Expected unchanged native cell rejection");
    }
    expect(state.additionStable(() => true, scope, context, second, b.entry, after.failure)).toBe(
      false,
    );
  });
});
