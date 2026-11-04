import { describe, expect, it } from "vitest";

import { TEST_TUNING } from "../testing/tuning";
import { moverSpec } from "./moverSpecs";
import { createSlotCandidateDomains, type SlotCandidate } from "./slotCandidateDomains";
import { type PreparedSlotKind, prepareSlotKind } from "./slotCandidates";
import { projectSlotWalls, type SlotPocketScope } from "./slotConstraintState";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

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
  pathStart: 4,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const work = { anchor: () => true, check: () => true, propagate: () => true, stopped: () => false };
const streams = () => ({ movers: () => 0.9, spawns: () => 0.9 });

function fixture() {
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
  const fixed = prepareSlotKind(streams(), geometry, {
    compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 1, rows: 2 } }),
    footprint: { lanes: 1, rows: 2 },
    kind: "fixed",
    role: "minorFixed",
    weight: 1,
  });
  const reactive = prepareSlotKind(streams(), geometry, {
    compile: (random) => ({
      blocksLane: true,
      mover: moverSpec(
        { tuning: TEST_TUNING },
        random,
        { lanes: 1, rows: 1 },
        { kind: "approach", steps: { max: 3, min: 2 } },
      ),
    }),
    footprint: { lanes: 1, rows: 1 },
    kind: "reactive",
    role: "minorMoving",
    weight: 1,
  });
  const rider = prepareSlotKind(streams(), geometry, {
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
    kind: "rider",
    role: "minorMoving",
    weight: 1,
  });
  const stopped = prepareSlotKind(streams(), geometry, {
    compile: () => ({
      blocksLane: false,
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
    kind: "stopped",
    role: "auxiliaryMoving",
    weight: 1,
  });
  // Leading zero profiles must not change identities of later positive profiles.
  const pool: PreparedSlotKind<string>[] = [reactive, fixed, stopped, rider];
  const owner = { key: "owner", phase: "active" as const, preparations: () => pool };
  const domains = createSlotCandidateDomains(geometry, path);
  const scope = domains.pocketScope([owner]);
  return { domains, fixed, owner, path, pool, reactive, rider, scope, stopped };
}

type Domains = ReturnType<typeof createSlotCandidateDomains<string>>;
type Owner = ReturnType<typeof fixture>["owner"];

function originalOracle(
  domains: Domains,
  scope: SlotPocketScope,
  path: ReturnType<typeof fixture>["path"],
  row: number,
  owner: Owner,
) {
  const full: SlotCandidate<string>[] = [];
  const positive: { value: SlotCandidate<string>; guaranteedWalls: number }[] = [];
  let complete = false;
  for (const step of domains.completeOwnerDomain(work, scope, owner)) {
    if (step.status === "candidate") {
      full.push(step.value);
      const mask = projectSlotWalls(work.propagate, geometry, path, row, step.value.entry);
      expect(mask).toBeDefined();
      if (mask !== 0) {
        positive.push({ guaranteedWalls: mask!, value: step.value });
      }
    } else {
      expect(step.status).toBe("complete");
      complete = step.status === "complete";
    }
  }
  expect(complete).toBe(true);
  return { full, positive };
}

function frontier(test: ReturnType<typeof fixture>, row: number, port = work) {
  const steps = [...test.domains.completeOwnerWalls(port, test.scope, row, test.owner)];
  const values = steps.flatMap((step) => (step.status === "candidate" ? [step] : []));
  const end = steps.at(-1);
  if (end?.status !== "complete") {
    throw new Error("Expected genuine complete wall frontier");
  }
  return { token: end.token, values };
}

describe("native row-wall frontier", () => {
  it("matches the original full-domain native projection without losing positive identities", () => {
    const test = fixture();
    const oracleDomains = createSlotCandidateDomains(geometry, test.path);
    const oracleScope = oracleDomains.pocketScope([test.owner]);
    const row = 4;
    const oracle = originalOracle(oracleDomains, oracleScope, test.path, row, test.owner);
    const result = frontier(test, row);
    expect(
      result.values.map(({ guaranteedWalls, value }) => ({ guaranteedWalls, id: value.id })),
    ).toEqual(
      oracle.positive.map(({ guaranteedWalls, value }) => ({ guaranteedWalls, id: value.id })),
    );
    expect(oracle.positive.some(({ value }) => value.prepared === test.fixed)).toBe(true);
    expect(oracle.positive.some(({ value }) => value.prepared === test.rider)).toBe(true);
    expect(oracle.full.some((value) => value.prepared === test.reactive)).toBe(true);
    expect(oracle.full.some((value) => value.prepared === test.stopped)).toBe(true);
    expect(
      oracle.positive.some(
        ({ value }) => value.prepared === test.reactive || value.prepared === test.stopped,
      ),
    ).toBe(false);
    expect(test.stopped.placements.some((placement) => placement.stop !== undefined)).toBe(true);
    for (const { value } of result.values) {
      const anchor =
        value.entry.trace.placement?.block.row ??
        test.path.findIndex(({ distance }) => distance === value.entry.event.distance);
      expect(
        test.domains.at(test.owner.key, value.prepared, anchor, value.entry.event.lane),
      ).toContain(value);
    }
    expect(
      test.domains.attestOwnerWalls(work, test.scope, row, test.owner, result.values, result.token),
    ).toBe(true);
    expect(
      test.domains.attestOwnerWalls(
        work,
        test.scope,
        row + 1,
        test.owner,
        result.values,
        result.token,
      ),
    ).toBe(false);
    expect(
      test.domains.attestOwnerWalls(
        work,
        test.scope,
        row,
        test.owner,
        result.values.slice(1),
        result.token,
      ),
    ).toBe(false);
    const oldLane = test.path[1]!.lane;
    expect(() => {
      test.path[1]!.lane = (oldLane + 1) % geometry.laneCount;
    }).toThrow(TypeError);
    expect(
      test.domains.attestOwnerWalls(work, test.scope, row, test.owner, result.values, result.token),
    ).toBe(true);
  });

  it("cannot complete or attest a stopped, budgeted or unattested frontier", () => {
    const test = fixture();
    let stopped = false;
    const port = { ...work, stopped: () => stopped };
    const cursor = test.domains.completeOwnerWalls(port, test.scope, 4, test.owner);
    let first = cursor.next();
    while (!first.done && first.value.status === "progress") {
      first = cursor.next();
    }
    expect(first.value?.status).toBe("candidate");
    stopped = true;
    expect([...cursor].some((step) => step.status === "complete")).toBe(false);
    expect([
      ...test.domains.completeOwnerWalls(
        { ...work, propagate: () => false },
        test.scope,
        4,
        test.owner,
      ),
    ]).toEqual([{ status: "budget" }]);
    const foreign = { ...test.fixed };
    const foreignOwner = { ...test.owner, preparations: () => [foreign] };
    const scope = test.domains.pocketScope([foreignOwner]);
    expect([...test.domains.completeOwnerWalls(work, scope, 4, foreignOwner)]).toEqual([
      { status: "unknown" },
    ]);
  });

  it("treats a zero-profile progress event as neither a value nor a complete proof", () => {
    const test = fixture();
    const empty = prepareSlotKind(streams(), geometry, {
      compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind: "pickup",
      role: "auxiliaryFixed",
      weight: 1,
    });
    const owner = { key: "empty-walls", phase: "active" as const, preparations: () => [empty] };
    const scope = test.domains.pocketScope([owner]);
    const cursor = test.domains.completeOwnerWalls(work, scope, 4, owner);
    const first = cursor.next();
    expect(first).toEqual({ done: false, value: { status: "progress" } });
    expect(Object.keys(first.value!)).toEqual(["status"]);
    const tail = [...cursor];
    const end = tail.at(-1);
    expect(end?.status).toBe("complete");
    if (end?.status !== "complete") {
      throw new Error("Expected genuine EOF after the zero profile");
    }
    expect(test.domains.attestOwnerWalls(work, scope, 4, owner, [], end.token)).toBe(true);
    expect(test.domains.attestOwnerWalls(work, scope, 4, owner, [], { ...end.token })).toBe(false);
    const abandoned = test.domains.completeOwnerWalls(work, scope, 4, owner);
    expect(abandoned.next().value).toEqual({ status: "progress" });
    expect(abandoned.return(undefined)).toEqual({ done: true, value: undefined });

    let stopped = false;
    const interrupted = test.domains.completeOwnerWalls(
      { ...work, stopped: () => stopped },
      scope,
      4,
      owner,
    );
    expect(interrupted.next().value).toEqual({ status: "progress" });
    stopped = true;
    expect([...interrupted]).toEqual([{ status: "budget" }]);
    const old = [...test.domains.completeOwnerDomain(work, scope, owner)];
    expect(old.map((step) => step.status)).not.toContain("progress");
    expect(old.at(-1)?.status).toBe("complete");
  });

  it.each(["rejected profile mutation", "appended supplier"] as const)(
    "keeps completeness only while the suppliers are unchanged after a %s",
    (change) => {
      const test = fixture();
      const result = frontier(test, 4);
      expect(
        test.domains.attestOwnerWalls(work, test.scope, 4, test.owner, result.values, result.token),
      ).toBe(true);
      if (change === "rejected profile mutation") {
        expect(() => Object.assign(test.reactive.request.mover!, { warningSeconds: 9 })).toThrow(
          TypeError,
        );
      } else {
        test.pool.push(
          prepareSlotKind(streams(), geometry, {
            compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 2, rows: 1 } }),
            footprint: { lanes: 2, rows: 1 },
            kind: "appended",
            role: "minorFixed",
            weight: 1,
          }),
        );
      }
      expect(
        test.domains.attestOwnerWalls(work, test.scope, 4, test.owner, result.values, result.token),
      ).toBe(change === "rejected profile mutation");
    },
  );
});
