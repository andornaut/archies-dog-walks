import * as random from "@andornaut/game-kit/random";
import { describe, expect, it, vi } from "vitest";

import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { moverPlace, moverTell } from "./movers";
import { moverSpec } from "./moverSpecs";
import { auditSlotPlan } from "./slotAudit";
import * as candidateDomains from "./slotCandidateDomains";
import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates";
import { apportionSlotCounts, type SlotConfiguration, type SlotKind } from "./slotConfig";
import * as constraintState from "./slotConstraintState";
import { nextCoverageRows } from "./slotCoverage";
import { slotMotionStreams } from "./slotEntropy";
import * as slotFeasibility from "./slotFeasibility";
import { makeSlotJobs } from "./slotJobs";
import { materialiseSlotPlan } from "./slotPlan";
import { planSlotCapacity, planSlotSpawns, SLOT_LIMITS } from "./slotPlanner";
import * as witnessSearch from "./slotWitnessSearch";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";
import { auditSpawnPlan } from "./spawnValidation";
import {
  compileZoneSlotInput,
  replayZoneSlots,
  type ZoneSlotInput,
  ZoneSlotPlanningError,
} from "./zoneSlotInput";

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
  pathStart: 2,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const empty = { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 0 };
const active = { ...empty, minorFixed: 3 };
const config: SlotConfiguration<string> = {
  active,
  capacity: { ...active, minorFixed: 4 },
  guarantees: [],
};
const catalogue: readonly SlotKind<string>[] = [
  {
    compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
    footprint: { lanes: 1, rows: 1 },
    kind: "bench",
    role: "minorFixed",
    weight: 1,
  },
];
const context = { limits: SLOT_LIMITS, seed: 7, zoneIndex: 0 };

describe("safe slot planning", () => {
  it("defaults real seeded planning to original draws and retains the explicit comparison policy", () => {
    const moving: SlotKind<string> = {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: { kind: "ride", speedMultiplier: 1.5 },
          movement: "inLane",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0.1,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "rider",
      role: "minorMoving",
      weight: 1,
    };
    const requested = { ...empty, minorMoving: 1 };
    const configuration = {
      active: requested,
      capacity: requested,
      guarantees: [{ count: 1, kind: moving.kind, role: moving.role }],
    };
    const flags: (boolean | undefined)[] = [];
    const factory = witnessSearch.createSlotWitnessSearch;
    const forwarded = vi
      .spyOn(witnessSearch, "createSlotWitnessSearch")
      .mockImplementation((...args) => {
        flags.push(args[4].originalDrawsFirst);
        return factory(...args);
      });
    let frontierCalls = 0;
    const createDomains = candidateDomains.createSlotCandidateDomains;
    const observed = vi
      .spyOn(candidateDomains, "createSlotCandidateDomains")
      .mockImplementation((...args) => {
        const domains = createDomains(...args);
        return {
          ...domains,
          frontierSequence(...values) {
            frontierCalls++;
            return domains.frontierSequence(...values);
          },
        };
      });
    try {
      const results = [undefined, true, false].map((originalDrawsFirst) => {
        frontierCalls = 0;
        const result = planSlotSpawns(
          originalDrawsFirst === undefined ? context : { ...context, originalDrawsFirst },
          geometry,
          [moving],
          [],
          configuration,
        );
        expect(result.status).toBe("complete");
        if (result.status !== "complete") {
          throw Error("Expected native seeded fixture completion");
        }
        expect(result.activeAudit.status).toBe("valid");
        expect(result.assignments).toHaveLength(1);
        return { frontierCalls, result };
      });
      expect(flags).toEqual([true, true, false]);
      expect(results[0]).toEqual(results[1]);
      expect(results[0]!.frontierCalls).toBeGreaterThan(0);
      expect(results[2]!.frontierCalls).toBe(0);
    } finally {
      forwarded.mockRestore();
      observed.mockRestore();
    }
  });

  it("solves only actual guarantees and auxiliary members in one native call", () => {
    const compiled: string[] = [];
    const sources: SlotKind<string>[] = [
      {
        compile: () => {
          compiled.push("pickup");
          return { blocksLane: false, footprint: { lanes: 1, rows: 1 } };
        },
        footprint: { lanes: 1, rows: 1 },
        kind: "pickup",
        role: "minorFixed",
        weight: 1,
      },
      {
        compile: () => {
          compiled.push("wall");
          return { blocksLane: true, footprint: { lanes: 3, rows: 1 } };
        },
        footprint: { lanes: 3, rows: 1 },
        kind: "wall",
        role: "minorFixed",
        weight: 1,
      },
    ];
    const budget = { ...empty, minorFixed: 2 };
    const configuration = {
      active: budget,
      capacity: { ...budget, minorFixed: 3 },
      guarantees: sources.map(({ kind, role }) => ({ count: 1, kind, role })),
    };
    expect(
      makeSlotJobs(
        sources,
        [
          { blocksLane: false, count: 1, kind: "tip" },
          { blocksLane: true, count: 1, kind: "barrier" },
        ],
        { ...configuration, capacity: budget },
      ).map(({ laneEffect }) => laneEffect),
    ).toEqual(["possible", "possible", "none", "possible"]);
    const create = witnessSearch.createSlotWitnessSearch;
    let solves = 0;
    const roots: number[] = [];
    const observed = vi
      .spyOn(witnessSearch, "createSlotWitnessSearch")
      .mockImplementation((...args) => {
        const actual = create(...args);
        return {
          ...actual,
          solve(...values) {
            solves++;
            roots.push(values[0].entries().length);
            return actual.solve(...values);
          },
        };
      });
    try {
      const result = planSlotSpawns(
        context,
        { ...geometry, pathStart: 4 },
        sources,
        [{ blocksLane: false, count: 2, kind: "tip", moversPassOver: true, moversRestOn: true }],
        configuration,
      );
      expect(result.status).toBe("complete");
      expect(solves).toBe(1);
      expect(roots).toEqual([0]);
      expect(compiled).toEqual(expect.arrayContaining(["pickup", "wall"]));
      if (result.status !== "complete") {
        throw new Error("Expected the complete actual configuration");
      }
      expect(
        result.assignments
          .filter(({ role }) => role === "minorFixed")
          .map(({ binding }) => binding.kind)
          .sort(),
      ).toEqual(["pickup", "wall"]);
      expect(
        result.assignments
          .filter(({ auxiliary }) => auxiliary !== undefined)
          .map(({ auxiliary }) => auxiliary),
      ).toEqual([
        { memberIndex: 0, requestIndex: 0 },
        { memberIndex: 1, requestIndex: 0 },
      ]);
      expect(result.planned.events).toHaveLength(4);
      expect(result).not.toHaveProperty("capacityWitness");
      expect(result).not.toHaveProperty("capacityAudit");
      expect(result.diagnostics.audits).toBe(1);
      expect(result.activeAudit.status).toBe("valid");
    } finally {
      observed.mockRestore();
    }
  });

  it("replays frozen production inputs with complete profiles and deterministic private streams", () => {
    const input: ZoneSlotInput<string> = {
      actualRun: testState({ archie: 3 }),
      auxiliary: [],
      catalogue: [
        {
          footprint: { lanes: 1, rows: 1 },
          kind: "bench",
          movement: null,
          role: "minorFixed",
          spec: { blocksLane: true, footprint: { lanes: 1, rows: 1 } },
          weight: 1,
        },
        {
          footprint: { lanes: 1, rows: 1 },
          kind: "rider",
          movement: { factor: 1.5, kind: "inLane" },
          movingHitLength: 30,
          role: "minorMoving",
          spec: { blocksLane: true, hitLength: 30 },
          weight: 1,
        },
      ],
      config: {
        active: { ...empty, minorFixed: 3, minorMoving: 2 },
        capacity: { ...empty, minorFixed: 4, minorMoving: 3 },
        guarantees: [{ count: 1, kind: "bench", role: "minorFixed" }],
      },
      context,
      geometry: { ...geometry, maxEmptyRows: 10 },
      tuning: TEST_TUNING,
    };
    const calls = new Map<string, { readonly seed: number; readonly values: number[] }>();
    const stream = random.randomStream;
    const observed = vi.spyOn(random, "randomStream").mockImplementation((seed, key) => {
      const draw = stream(seed, key);
      let record = calls.get(key);
      if (record === undefined) {
        record = { seed, values: [] };
        calls.set(key, record);
      }
      return () => {
        const value = draw();
        record.values.push(value);
        return value;
      };
    });
    try {
      const compiled = compileZoneSlotInput(input);
      for (const purpose of ["active", "capacity"] as const) {
        const run = () =>
          purpose === "active"
            ? replayZoneSlots(input)
            : planSlotCapacity(
                input.context,
                compiled.geometry,
                compiled.catalogue,
                input.auxiliary,
                input.config,
              );
        calls.clear();
        const baseline = run();
        const baselineCalls = structuredClone(calls);
        calls.clear();
        const replayed = run();
        expect(baseline.status).toBe("complete");
        expect(replayed).toEqual(baseline);
        expect(calls).toEqual(baselineCalls);
        expect([...calls.values()].every(({ seed }) => seed === context.seed)).toBe(true);
        if (replayed.status !== "complete") {
          throw new Error("Expected complete production-profile certification");
        }
        const moving = replayed.assignments.find(({ entry }) => entry.event.mover !== undefined);
        expect(moving, purpose).toBeDefined();
        for (const suffix of ["motion", "steps"]) {
          const key = `slots-0-${moving!.key}-${moving!.binding.kind}-${suffix}`;
          expect(calls.get(key)?.values.length, key).toBeGreaterThan(0);
        }
        for (const { binding, entry, key } of replayed.assignments) {
          const source = compiled.catalogue.find(
            (candidate) => candidate.kind === binding.kind && candidate.role === binding.role,
          )!;
          const prepared = prepareSlotKind(
            {
              movers: stream(context.seed, `slots-0-${key}-${source.kind}-motion`),
              spawns: stream(context.seed, `slots-0-${key}-${source.kind}-steps`),
            },
            compiled.geometry,
            source,
          );
          expect(entry.request).toEqual(prepared.request);
          if (entry.event.mover !== undefined) {
            expect(prepared.placements.map(({ path }) => path)).toContainEqual(entry.event.mover);
            expect(entry.trace.requestedDraws).toEqual(prepared.draws);
          }
        }
        expect(replayed).toHaveProperty(
          purpose === "active" ? "activeAudit.status" : "capacityAudit.status",
          "valid",
        );
        expect(replayed.assignments.every(({ phase }) => phase === "active")).toBe(true);
        expect(replayed).not.toHaveProperty("capacityWitness");
      }
    } finally {
      observed.mockRestore();
    }
  });

  it("uses declared weights to order every available source", () => {
    const stream = random.randomStream;
    const draws = vi
      .spyOn(random, "randomStream")
      .mockImplementation((seed, key) =>
        key.endsWith("-source-order") ? () => 0.5 : stream(seed, key),
      );
    const orders: string[][] = [];
    const restorePreparations: (() => void)[] = [];
    const create = witnessSearch.createSlotWitnessSearch;
    const observed = vi
      .spyOn(witnessSearch, "createSlotWitnessSearch")
      .mockImplementation((...args) => {
        for (const job of args[3]) {
          const read = job.preparations.bind(job);
          const prepared = vi.spyOn(job, "preparations").mockImplementation(function* () {
            const available = [...read()];
            if (available.length > 1) {
              orders.push(available.map(({ source }) => source.kind));
            }
            yield* available;
          });
          restorePreparations.push(() => prepared.mockRestore());
        }
        return create(...args);
      });
    const solve = (weights: readonly number[]) => {
      const sources = ["light", "heavy"].map((kind, index) => ({
        ...catalogue[0]!,
        kind,
        weight: weights[index]!,
      }));
      const budget = { ...empty, minorFixed: 3 };
      return planSlotSpawns(context, geometry, sources, [], {
        active: budget,
        capacity: budget,
        guarantees: sources.map(({ kind, role }) => ({ count: 1, kind, role })),
      });
    };
    try {
      expect(solve([1, 9]).status).toBe("complete");
      expect(orders.length).toBeGreaterThan(0);
      for (const order of orders) {
        expect(order).toEqual(["heavy", "light"]);
      }
      orders.length = 0;
      expect(solve([9, 1]).status).toBe("complete");
      expect(orders.length).toBeGreaterThan(0);
      for (const order of orders) {
        expect(order).toEqual(["light", "heavy"]);
      }
    } finally {
      restorePreparations.forEach((restore) => restore());
      observed.mockRestore();
      draws.mockRestore();
    }
  });

  it("rounds the total once and apportions every slot with stable role ties", () => {
    expect(
      apportionSlotCounts(182, {
        encounterFixed: 30,
        encounterMoving: 19,
        minorFixed: 26,
        minorMoving: 65,
      }),
    ).toEqual({ encounterFixed: 39, encounterMoving: 25, minorFixed: 34, minorMoving: 84 });
    expect(apportionSlotCounts(1, { ...empty, encounterFixed: 1, minorFixed: 1 })).toEqual({
      ...empty,
      encounterFixed: 1,
    });
  });

  it("certifies the maximum composition independently without changing the actual result", () => {
    const result = planSlotSpawns(context, geometry, catalogue, [], config);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      return;
    }
    const capacity = planSlotCapacity(context, geometry, catalogue, [], config);
    expect(capacity.status).toBe("complete");
    if (capacity.status !== "complete") {
      throw new Error("Expected independent maximum certification");
    }
    expect(result.planned.events).toHaveLength(3);
    expect(capacity.planned.events).toHaveLength(4);
    expect(result.activeAudit.status).toBe("valid");
    expect(capacity.capacityAudit.status).toBe("valid");
    expect(result).not.toHaveProperty("capacityAudit");
    expect(result).not.toHaveProperty("capacityWitness");
    expect(capacity).not.toHaveProperty("activeAudit");
    expect(capacity.assignments.every(({ phase }) => phase === "active")).toBe(true);
    expect(capacity.diagnostics.audits).toBe(1);
    expect(planSlotSpawns(context, geometry, catalogue, [], config)).toEqual(result);
    const changed = result.assignments.map((assignment, index) =>
      index === 0
        ? { ...assignment, binding: { ...assignment.binding, role: "encounterFixed" as const } }
        : assignment,
    );
    expect(
      auditSlotPlan(
        context,
        geometry,
        result.planned.path,
        catalogue,
        [],
        config,
        "active",
        changed,
      ).status,
    ).toBe("invalid");
  });

  it("returns the audited actual layout when independent maximum construction is exhausted", () => {
    const road = { ...geometry, zoneLength: 300 };
    const configuration = {
      active: { ...empty, minorFixed: 2 },
      capacity: { ...empty, minorFixed: 3 },
      guarantees: [],
    };
    const actual = planSlotSpawns(context, road, catalogue, [], configuration);
    expect(actual.status).toBe("complete");
    if (actual.status !== "complete") {
      throw new Error("Expected the independently valid actual composition");
    }
    expect(actual.activeAudit.status).toBe("valid");
    expect(actual.assignments).toHaveLength(2);
    expect(actual.diagnostics.audits).toBe(1);
    const maximum = planSlotCapacity(context, road, catalogue, [], configuration);
    expect(maximum.status).toBe("unsupported");
    if (maximum.status !== "unsupported") {
      throw new Error("Expected bounded maximum construction to fail");
    }
    expect(maximum.stage).toBe("construction");
    expect(maximum).not.toHaveProperty("plan");
    expect(planSlotSpawns(context, road, catalogue, [], configuration)).toEqual(actual);
    const invalid = planSlotSpawns(context, road, catalogue, [], {
      ...configuration,
      active: { ...empty, minorFixed: 4 },
    });
    expect(invalid).toMatchObject({
      failures: expect.arrayContaining([expect.objectContaining({ code: "role-capacity" })]),
      stage: "configuration",
      status: "unsupported",
    });
  });

  it("reserves quiet-row coverage before committing remaining slots", () => {
    const counts = { ...empty, minorFixed: 6 };
    const result = planSlotSpawns(context, { ...geometry, maxEmptyRows: 3 }, catalogue, [], {
      active: counts,
      capacity: counts,
      guarantees: [],
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      return;
    }
    expect(result.assignments).toHaveLength(counts.minorFixed);
    expect(result.activeAudit.geometry.missingCoverage).toEqual([]);
    expect(result.activeAudit.status).toBe("valid");
  });

  it("tries the full coverage window and derives later windows from actual coverage", () => {
    const coveredGeometry = { ...geometry, maxEmptyRows: 3 };
    expect(nextCoverageRows(coveredGeometry, [])).toEqual([1, 0]);
    expect(nextCoverageRows({ ...coveredGeometry, firstContactSeconds: 2 }, [])).toEqual([0]);
    const prepared = prepareSlotKind(
      slotMotionStreams(context, "coverage", "bench"),
      coveredGeometry,
      catalogue[0]!,
    );
    const rows = zoneRows(coveredGeometry, rowSpacing({ ...coveredGeometry, quotas: [] }));
    const entry = slotPlacementsAt(
      coveredGeometry,
      { distance: rows[0]!, lane: 0, row: 0, slot: 0 },
      prepared,
    )[0]!;
    const reservation = {
      binding: { kind: "bench", role: "minorFixed" as const, weight: 1 },
      entry,
      key: "coverage",
      phase: "active" as const,
      role: "minorFixed" as const,
    };
    expect(nextCoverageRows(coveredGeometry, [reservation])).toEqual([4, 3, 2, 1]);
  });

  it("uses an earlier legal coverage row without losing the final quiet bound", () => {
    const coveredGeometry = { ...geometry, maxEmptyRows: 3 };
    const rows = zoneRows(coveredGeometry, rowSpacing({ ...coveredGeometry, quotas: [] }));
    const create = constraintState.createSlotIntrinsicProbe;
    const blocked = vi
      .spyOn(constraintState, "createSlotIntrinsicProbe")
      .mockImplementation((plan, path) => {
        const probe = create(plan, path);
        return (entry) =>
          entry.event.mover === undefined && entry.event.distance === rows[1]
            ? { accepted: false as const, rule: "body" }
            : probe(entry);
      });
    try {
      const budget = { ...empty, minorFixed: 6 };
      const result = planSlotSpawns(context, coveredGeometry, catalogue, [], {
        active: budget,
        capacity: budget,
        guarantees: [],
      });
      expect(result.status).toBe("complete");
      if (result.status !== "complete") {
        return;
      }
      expect(result.assignments.some(({ entry }) => entry.event.distance === rows[0])).toBe(true);
      expect(result.assignments.some(({ entry }) => entry.event.distance === rows[1])).toBe(false);
      expect(result.planned.events).toHaveLength(6);
      expect(result.activeAudit.status).toBe("valid");
    } finally {
      blocked.mockRestore();
    }
  });

  it("reserves guaranteed full profiles before quiet coverage and binds auxiliary identities", () => {
    const moving: readonly SlotKind<string>[] = [
      {
        compile: () => ({
          blocksLane: true,
          mover: {
            footprint: { lanes: 1, rows: 1 },
            motion: { kind: "ride", speedMultiplier: 1.5 },
            movement: "inLane",
            variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
            warningSeconds: 0,
          },
        }),
        footprint: { lanes: 1, rows: 1 },
        kind: "rider",
        role: "minorMoving",
        weight: 1,
      },
    ];
    const budget = { ...empty, minorFixed: 6, minorMoving: 2 };
    const auxiliary = [
      { blocksLane: false, count: 2, kind: "tip", moversPassOver: true, moversRestOn: true },
    ];
    const result = planSlotSpawns(
      context,
      { ...geometry, maxEmptyRows: 3 },
      [...catalogue, ...moving],
      auxiliary,
      {
        active: budget,
        capacity: budget,
        guarantees: [{ count: 1, kind: "rider", role: "minorMoving" }],
      },
    );
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      return;
    }
    expect(result.assignments[0]?.binding.kind).toBe("rider");
    expect(result.assignments[0]?.entry.event.mover).toBeDefined();
    expect(result.planned.events.filter(({ kind }) => kind === "rider")).toHaveLength(2);
    expect(result.planned.events.filter(({ kind }) => kind === "tip")).toHaveLength(2);
    expect(result.activeAudit.geometry.missingCoverage).toEqual([]);
    expect(result.activeAudit.status).toBe("valid");
  });

  it("certifies enabled logical kinds across roles using active obstacles only", () => {
    const result = planSlotSpawns(context, geometry, catalogue, [], config);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      return;
    }
    const sources: readonly SlotKind<string>[] = [
      ...catalogue,
      { ...catalogue[0]!, role: "encounterFixed" },
      { ...catalogue[0]!, kind: "retired", weight: 0 },
    ];
    const audit = (entries: typeof result.assignments, pool = sources) =>
      auditSlotPlan(context, geometry, result.planned.path, pool, [], config, "active", entries);
    expect(audit(result.assignments).status).toBe("valid");
    expect(
      audit(result.assignments, [...sources, { ...catalogue[0]!, kind: "missing" }]).violations,
    ).toContain("missing-enabled-kind:missing");
    expect(
      audit(result.assignments.map((assignment) => ({ ...assignment, phase: "capacity" })))
        .violations,
    ).toContain("missing-enabled-kind:bench");
    expect(
      audit(
        result.assignments.map((assignment) => ({
          ...assignment,
          role: "auxiliaryFixed",
        })),
      ).violations,
    ).toContain("missing-enabled-kind:bench");
  });

  it("replays JSON structural inputs and retains typed failure evidence", () => {
    const input: ZoneSlotInput<string> = {
      actualRun: testState({ archie: 3 }),
      auxiliary: [],
      catalogue: [
        {
          footprint: { lanes: 1, rows: 1 },
          kind: "bench",
          movement: null,
          role: "minorFixed",
          spec: { blocksLane: true, footprint: { lanes: 1, rows: 1 } },
          weight: 1,
        },
        {
          footprint: { lanes: 1, rows: 1 },
          kind: "rider",
          movement: { factor: 1.5, kind: "inLane" },
          movingHitLength: 30,
          role: "minorMoving",
          spec: { blocksLane: true, hitLength: 30 },
          weight: 1,
        },
      ],
      config: {
        ...config,
        active: { ...config.active, minorMoving: 1 },
        capacity: { ...config.capacity, minorMoving: 1 },
      },
      context,
      geometry: { ...geometry, maxEmptyRows: null },
      tuning: TEST_TUNING,
    };
    const serialized = JSON.parse(JSON.stringify(input)) as ZoneSlotInput<string>;
    const expected = replayZoneSlots(input);
    expect(JSON.parse(JSON.stringify(replayZoneSlots(serialized)))).toEqual(
      JSON.parse(JSON.stringify(expected)),
    );
    expect(expected.status).toBe("complete");
    const failedInput = {
      ...serialized,
      context: { ...context, limits: { ...SLOT_LIMITS, candidateChecks: 1 } },
    };
    const failed = replayZoneSlots(failedInput);
    expect(failed.status).toBe("unsupported");
    if (failed.status !== "unsupported") {
      return;
    }
    const error = new ZoneSlotPlanningError(failedInput, failed);
    const captured = JSON.parse(JSON.stringify({ input: error.input, result: error.result }));
    expect(captured.input.actualRun).toEqual(input.actualRun);
    expect(replayZoneSlots(captured.input)).toEqual(failed);
    expect(captured.result.stage).toBe("construction");
    expect(captured.result.provisional.path.length).toBeGreaterThan(0);
    expect(captured.result.provisional.assignments).toEqual([]);
    expect(captured.result.planned).toBeUndefined();
  });

  it("validates multi-cell profiles against their moving shape", () => {
    const input: ZoneSlotInput<string> = {
      actualRun: testState({ archie: 3 }),
      auxiliary: [],
      catalogue: [
        {
          footprint: { lanes: 2, rows: 2 },
          kind: "skunk",
          movement: { kind: "approach", steps: { max: 6, min: 3 } },
          movingHitLength: 58,
          role: "encounterMoving",
          spec: { blocksLane: true, first: true, hazard: true, hitLength: 58 },
          weight: 1,
        },
      ],
      config: {
        active: { ...empty, encounterMoving: 1 },
        capacity: { ...empty, encounterMoving: 1 },
        guarantees: [],
      },
      context,
      geometry: { ...geometry, maxEmptyRows: null },
      tuning: TEST_TUNING,
    };
    const compiled = compileZoneSlotInput(input);
    const source = compiled.catalogue[0]!;
    const streams = () => slotMotionStreams(context, "active:encounterMoving:0", source.kind);
    const prepared = prepareSlotKind(streams(), compiled.geometry, source);
    expect(prepared.request.footprint).toBeUndefined();
    expect(prepared.request.mover?.footprint).toEqual(source.footprint);
    expect(prepared.placements.length).toBeGreaterThan(0);
    expect(() =>
      prepareSlotKind(streams(), compiled.geometry, {
        ...source,
        footprint: { lanes: 1, rows: 1 },
      }),
    ).toThrow("Slot footprint mismatch");
  });

  it("fits full two-cell reactive reach with two open lanes for every branch", () => {
    const input: ZoneSlotInput<string> = {
      actualRun: testState({ archie: 3 }),
      auxiliary: [],
      catalogue: [
        {
          footprint: { lanes: 2, rows: 2 },
          kind: "skunk",
          movement: { kind: "approach", steps: { max: 6, min: 3 } },
          movingHitLength: 58,
          role: "encounterMoving",
          spec: { blocksLane: true, first: true, hazard: true, hitLength: 58 },
          weight: 1,
        },
      ],
      config: {
        active: { ...empty, encounterMoving: 1 },
        capacity: { ...empty, encounterMoving: 1 },
        guarantees: [{ count: 1, kind: "skunk", role: "encounterMoving" }],
      },
      context,
      geometry: {
        ...geometry,
        cellInset: -18.79754601226989,
        cellLength: 64,
        firstContactSeconds: 2,
        laneInset: 12,
        maxEmptyRows: null,
        minOpenLanes: 2,
        minSpacing: 213,
        packHitLength: 162.1538461538462,
        packLength: 166.1538461538462,
        pathLaneMoveSeconds: 0.33670033670033667,
        reactionSeconds: 0.5,
        roadLength: 724,
        scrollSpeed: 200,
        sightLength: 553.8461538461538,
        stepSeconds: 1 / 60,
        zoneLength: 29600,
      },
      tuning: TEST_TUNING,
    };
    const compiled = compileZoneSlotInput(input);
    const source = compiled.catalogue[0]!;
    const key = "active:encounterMoving:0";
    const prepared = prepareSlotKind(
      slotMotionStreams(context, key, source.kind),
      compiled.geometry,
      source,
    );
    expect(
      prepared.placements.every(
        (placement) =>
          placement.path.motion === "approach" &&
          placement.path.reach.count === 3 &&
          placement.lanes.count === 4,
      ),
    ).toBe(true);
    const rows = zoneRows(compiled.geometry, rowSpacing({ ...compiled.geometry, quotas: [] }));
    const path = rows.map((distance, index) => ({ distance, lane: index < 2 ? 2 : 4 }));
    const entry = slotPlacementsAt(
      compiled.geometry,
      { distance: rows[10]!, lane: 1, row: 10, slot: 0 },
      prepared,
    )[0]!;
    const board = slotFeasibility.createSlotFeasibility(compiled.geometry, path);
    expect(board.commit(entry)).toEqual({ accepted: true });
    const assignments = [
      {
        binding: { kind: source.kind, role: source.role, weight: source.weight },
        entry,
        key,
        phase: "active" as const,
        role: source.role,
      },
    ];
    const audit = auditSlotPlan(
      context,
      compiled.geometry,
      path,
      compiled.catalogue,
      [],
      input.config,
      "active",
      assignments,
    );
    expect(audit.geometry.findings.every((finding) => finding.reasons.length === 0)).toBe(true);
    expect(audit.geometry.status).toBe("valid");
    expect(audit.violations).toEqual(["quiet-row-coverage"]);
  });

  it("fits an unchanged turn-back dart without treating its sweep as simultaneous occupancy", () => {
    const frozenContext = { ...context, seed: 584548801 };
    const input: ZoneSlotInput<string> = {
      actualRun: testState({ archie: 3 }),
      auxiliary: [],
      catalogue: [
        {
          footprint: { lanes: 1, rows: 1 },
          kind: "otherDog",
          movement: {
            kind: "dart",
            stopShare: 0.33,
            tilt: { max: 0, min: 0 },
            turnBackShare: 0.33,
          },
          movingHitLength: 49.1181364392678,
          role: "encounterMoving",
          spec: { blocksLane: true, first: true, hazard: true, hitLength: 64 },
          weight: 3,
        },
      ],
      config: {
        active: { ...empty, encounterMoving: 1 },
        capacity: { ...empty, encounterMoving: 1 },
        guarantees: [{ count: 1, kind: "otherDog", role: "encounterMoving" }],
      },
      context: frozenContext,
      geometry: {
        ...geometry,
        cellInset: -18.79754601226989,
        cellLength: 64,
        firstContactSeconds: 2,
        laneInset: 12,
        maxEmptyRows: null,
        minOpenLanes: 2,
        minSpacing: 213,
        packHitLength: 162.1538461538462,
        packLength: 166.1538461538462,
        pathLaneMoveSeconds: 0.33670033670033667,
        reactionSeconds: 0.5,
        roadLength: 724,
        scrollSpeed: 200,
        sightLength: 553.8461538461538,
        stepSeconds: 1 / 60,
        zoneLength: 29600,
      },
      tuning: TEST_TUNING,
    };
    const compiled = compileZoneSlotInput(input),
      source = compiled.catalogue[0]!;
    const key = "active:encounterMoving:1";
    const prepared = prepareSlotKind(
      slotMotionStreams(frozenContext, key, source.kind),
      compiled.geometry,
      source,
    );
    const original = JSON.stringify(prepared);
    expect(prepared.placements[0]?.lanes).toEqual({ count: 3, first: 2 });
    const rows = zoneRows(compiled.geometry, rowSpacing({ ...compiled.geometry, quotas: [] }));
    const path = rows.map((distance, index) => ({ distance, lane: index < 2 ? 2 : 0 }));
    const entry = slotPlacementsAt(
      compiled.geometry,
      { distance: rows[10]!, lane: 0, row: 10, slot: 0 },
      prepared,
    )[0]!;
    expect(entry.event.mover).toMatchObject({ motion: "cross", turnAfter: 4.8715919349342585 });
    const board = slotFeasibility.createSlotFeasibility(compiled.geometry, path);
    expect(board.commit(entry)).toEqual({ accepted: true });
    const audit = auditSlotPlan(
      frozenContext,
      compiled.geometry,
      path,
      compiled.catalogue,
      [],
      input.config,
      "active",
      [
        {
          binding: { kind: source.kind, role: source.role, weight: source.weight },
          entry,
          key,
          phase: "active",
          role: source.role,
        },
      ],
    );
    expect(audit.geometry.status).toBe("valid");
    expect(audit.violations).toEqual(["quiet-row-coverage"]);
    expect(JSON.stringify(prepared)).toBe(original);
  });

  it("gives a fast merging rider its full visible cue before body entry", () => {
    const captured = { ...context, seed: 584548801, zoneIndex: 2 };
    const sourceDefinition: ZoneSlotInput<string>["catalogue"][number] = {
      footprint: { lanes: 1, rows: 1 },
      kind: "deliveryCyclist",
      movement: { factor: 1.8, kind: "merge", mergeAt: 0.4, mergeSeconds: 0.4 },
      movingHitLength: 76.93779904306211,
      role: "minorMoving",
      spec: { blocksLane: true, first: false, hazard: true, hitLength: 64 },
      weight: 4.5,
    };
    const input: ZoneSlotInput<string> = {
      actualRun: testState({ archie: 3 }),
      auxiliary: [],
      catalogue: [sourceDefinition],
      config,
      context: captured,
      geometry: {
        ...geometry,
        cellLength: 64,
        laneInset: 12,
        maxEmptyRows: null,
        roadLength: 724,
        scrollSpeed: 280,
        sightLength: 553.8461538461538,
        zoneLength: 29600,
      },
      tuning: TEST_TUNING,
    };
    const compiled = compileZoneSlotInput(input),
      source = compiled.catalogue[0]!;
    const key = "active:minorMoving:5";
    const prepared = prepareSlotKind(
      slotMotionStreams(captured, key, source.kind),
      compiled.geometry,
      source,
    );
    const path = prepared.placements[0]?.path;
    expect(path?.motion).toBe("ride");
    if (path?.motion !== "ride" || path.merge === undefined) {
      return;
    }
    expect(path.speedMultiplier).toBe(2.1754283209796994);
    const { merge } = path;
    expect(merge.cue / compiled.geometry.scrollSpeed).toBe(0.6);
    expect(merge.length / compiled.geometry.scrollSpeed).toBe(0.4);
    const starts = merge.at - merge.cue;
    expect(starts).toBeGreaterThanOrEqual(0);
    expect(starts).toBeLessThan(path.warning);
    for (const since of [starts, path.warning - 1e-6, merge.at - 1e-6]) {
      expect(moverTell(path, since)).toEqual({ kind: "wander" });
    }
    expect(moverTell(path, starts - 1e-6)).toEqual({ kind: "down" });
    expect(moverPlace(5, path, starts).solid).toBe(false);
    expect(moverPlace(5, path, merge.at + merge.length).travel).toBeLessThanOrEqual(
      compiled.geometry.sightLength,
    );
    expect(path.merge.lanes).not.toBe(0);
    const impossible = compileZoneSlotInput({
      ...input,
      catalogue: [
        {
          ...sourceDefinition,
          movement: { factor: 1.8, kind: "merge", mergeAt: 0.4, mergeSeconds: 3 },
        },
      ],
    });
    expect(
      prepareSlotKind(
        slotMotionStreams(captured, key, source.kind),
        impossible.geometry,
        impossible.catalogue[0]!,
      ).placements,
    ).toEqual([]);
  });

  it("raises a full-width dart before commitment and certifies its actual frozen lift", () => {
    for (const { lift, seed } of [
      { lift: 1, seed: 567771182 },
      { lift: 0.5, seed: 534215944 },
    ]) {
      const captured = { ...context, seed };
      const input: ZoneSlotInput<string> = {
        actualRun: testState({ archie: 3 }),
        auxiliary: [],
        catalogue: [
          {
            footprint: { lanes: 2, rows: 1 },
            kind: "ferrets",
            movement: { kind: "dart", stopShare: 0, tilt: { max: 0, min: 0 }, turnBackShare: 0.3 },
            movingHitLength: 28.40480274442541,
            role: "minorMoving",
            spec: { blocksLane: true, first: false, hazard: true, hitLength: 28.40480274442541 },
            weight: 5.5,
          },
        ],
        config: {
          active: { ...empty, minorMoving: 1 },
          capacity: { ...empty, minorMoving: 1 },
          guarantees: [{ count: 1, kind: "ferrets", role: "minorMoving" }],
        },
        context: captured,
        geometry: {
          ...geometry,
          cellInset: -18.79754601226989,
          cellLength: 64,
          laneInset: 12,
          maxEmptyRows: null,
          minOpenLanes: 2,
          minSpacing: 213,
          packHitLength: 162.1538461538462,
          packLength: 166.1538461538462,
          pathLaneMoveSeconds: 0.33670033670033667,
          reactionSeconds: 0.5,
          roadLength: 724,
          scrollSpeed: 200,
          sightLength: 553.8461538461538,
          stepSeconds: 1 / 60,
          zoneLength: 29600,
        },
        tuning: TEST_TUNING,
      };
      const compiled = compileZoneSlotInput(input),
        source = compiled.catalogue[0]!;
      const key = "active:minorMoving:2";
      const prepared = prepareSlotKind(
        slotMotionStreams(captured, key, source.kind),
        compiled.geometry,
        source,
      );
      const rows = zoneRows(compiled.geometry, rowSpacing({ ...compiled.geometry, quotas: [] }));
      const entries = slotPlacementsAt(
        compiled.geometry,
        { distance: rows[10]!, lane: 0, row: 10, slot: 0 },
        prepared,
      );
      const original = entries.find((entry) => entry.trace.placement?.selection?.lift === 0)!;
      const raised = entries.find((entry) => entry.trace.placement?.selection?.lift === lift)!;
      expect(original.trace.placement?.block.lanes.count).toBe(5);
      expect(raised.herring).toBe(false);
      const safeLane = raised.trace.placement!.block.lanes.first > 0 ? 0 : 4;
      const path = rows.map((distance, index) => ({ distance, lane: index < 2 ? 2 : safeLane }));
      const before = original.event.mover,
        after = raised.event.mover;
      if (before?.motion !== "cross" || after?.motion !== "cross") {
        throw new Error("Expected frozen crossers");
      }
      for (const field of [
        "direction",
        "lanesPerPixel",
        "movement",
        "span",
        "stopAfter",
        "tilt",
        "turnAfter",
      ] as const) {
        expect(after[field]).toEqual(before[field]);
      }
      expect(after.warning - after.idle).toBe(0.6 * compiled.geometry.scrollSpeed);
      expect(after.enterTravel - (after.warning - after.idle)).toBeGreaterThanOrEqual(
        compiled.geometry.cellLength - 1e-9,
      );
      expect(moverTell(after, after.idle)).toEqual({ direction: after.direction, kind: "across" });
      const board = slotFeasibility.createSlotFeasibility(compiled.geometry, path);
      expect(board.probe(original)).toMatchObject({ accepted: false, failure: { rule: "path" } });
      expect(board.commit(raised)).toEqual({ accepted: true });
      const assignments = [
        {
          binding: { kind: source.kind, role: source.role, weight: source.weight },
          entry: raised,
          key,
          phase: "active" as const,
          role: source.role,
        },
      ];
      expect(
        auditSlotPlan(
          captured,
          compiled.geometry,
          path,
          compiled.catalogue,
          [],
          input.config,
          "active",
          assignments,
        ).status,
      ).toBe("valid");
      const forged = {
        ...raised,
        trace: {
          ...raised.trace,
          placement: { ...raised.trace.placement!, selection: { draws: prepared.draws!, lift: 0 } },
        },
      };
      expect(
        auditSlotPlan(
          captured,
          compiled.geometry,
          path,
          compiled.catalogue,
          [],
          input.config,
          "active",
          [{ ...assignments[0]!, entry: forged }],
        ).violations,
      ).toContain("slot-motion-capability");
    }
  });

  it("reserves full moving clearance for uninterrupted herring crossings", () => {
    const source: SlotKind<string> = {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 3, rows: 1 },
          hitLength: 68,
          motion: {
            herring: { endRoadShare: 0.5, share: 1 },
            kind: "cross",
            lanesPerSecond: 1.65,
            reactionSeconds: 0.5,
            startRoadShare: [0.15, 0.45],
            stopLanes: { max: 1, min: 1 },
            stopShare: 0,
            tilt: [0, 0],
            turnAtShare: [0, 0],
            turnBackShare: 0,
            vergeShare: 0,
          },
          movement: "stopAndGoAcross",
          variation: { delaySeconds: 0.6, lengthShare: 0.35, speedShare: 0.25 },
          warningSeconds: 0.6,
        },
      }),
      footprint: { lanes: 3, rows: 1 },
      kind: "train",
      role: "minorMoving",
      weight: 1,
    };
    const prepared = prepareSlotKind(
      slotMotionStreams(context, "herring", source.kind),
      geometry,
      source,
    );
    expect(prepared.herring).toBe(true);
    const entry = slotPlacementsAt(
      geometry,
      { distance: 500, lane: prepared.columns[0]!, row: 5, slot: 0 },
      prepared,
    )[0]!;
    expect(entry.trace.until - entry.trace.nativeUntil).toBe(
      geometry.roadLength - geometry.sightLength + geometry.packLength + 68,
    );
    const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
      distance,
      lane: 2,
    }));
    const materialised = materialiseSlotPlan(geometry, path, [
      {
        binding: { kind: source.kind, role: source.role, weight: source.weight },
        entry,
        key: "herring",
        phase: "active",
        role: source.role,
      },
    ]);
    expect(auditSpawnPlan(materialised.plan, materialised.planned).status).toBe("valid");
    const budget = { ...empty, minorMoving: 1 };
    expect(
      auditSlotPlan(
        context,
        geometry,
        path,
        [source],
        [],
        {
          active: budget,
          capacity: budget,
          guarantees: [{ count: 1, kind: source.kind, role: source.role }],
        },
        "active",
        [
          {
            binding: { kind: source.kind, role: source.role, weight: source.weight },
            entry,
            key: "herring",
            phase: "active",
            role: source.role,
          },
        ],
      ).status,
    ).toBe("valid");
    const shortened = {
      ...materialised.planned,
      visibility: materialised.planned.visibility.map((trace) => ({
        ...trace,
        until: trace.nativeUntil,
      })),
    };
    expect(auditSpawnPlan(materialised.plan, shortened).findings[0]?.reasons).toContain(
      "moving stopped-scenery reservation mismatch",
    );
  });

  it("reuses identical executed step prefixes without changing variant multiplicity", () => {
    const source: SlotKind<string> = {
      compile: () => ({
        blocksLane: true,
        mover: {
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
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "hopper",
      role: "minorMoving",
      weight: 1,
    };
    const prepared = prepareSlotKind(
      slotMotionStreams(context, "prefix", source.kind),
      geometry,
      source,
    );
    expect(JSON.stringify(prepared.placements.map(({ lane }) => lane))).toBe(
      JSON.stringify([0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 4]),
    );
    expect(prepared.placements[0]).toBe(prepared.placements[4]);
    expect(prepared.placements[0]).not.toBe(prepared.placements[8]);
    expect(prepared.compiledCount).toBe(8);
    expect(
      prepared.placements.every(({ path }) => path.motion === "steps" && path.steps.length === 1),
    ).toBe(true);
    const rows = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] }));
    const entries = slotPlacementsAt(
      geometry,
      { distance: rows[5]!, lane: 0, row: 5, slot: 0 },
      prepared,
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toBe(entries[1]);
    const create = candidateDomains.createSlotCandidateDomains;
    const domains: ReturnType<typeof create>[] = [];
    const observed = vi
      .spyOn(candidateDomains, "createSlotCandidateDomains")
      .mockImplementation((plan, path) => {
        const compiled = create(plan, path);
        domains.push(compiled);
        return compiled;
      });
    const createState = constraintState.createSlotConstructionState;
    const mutableProbes: string[] = [];
    let completeChecks = 0;
    const mutable = vi
      .spyOn(constraintState, "createSlotConstructionState")
      .mockImplementation((...args) => {
        const state = createState(...args);
        return {
          ...state,
          checkComplete: () => {
            completeChecks++;
            return state.checkComplete();
          },
          commit: (owner, entry) => {
            mutableProbes.push(JSON.stringify(entry));
            return state.commit(owner, entry);
          },
        };
      });
    try {
      const budget = { ...empty, minorMoving: 1 };
      const result = planSlotSpawns(context, geometry, [source], [], {
        active: budget,
        capacity: budget,
        guarantees: [],
      });
      expect(result.status).toBe("complete");
      if (result.status !== "complete") {
        return;
      }
      const unaryChecks = domains.reduce(
        (total, domain) => total + domain.statistics().unaryChecks,
        0,
      );
      expect(unaryChecks).toBeGreaterThan(0);
      expect(new Set(mutableProbes).size).toBe(mutableProbes.length);
      // Pocket support charges candidate checks in addition to native placement checks.
      expect(result.diagnostics.candidateChecks).toBeGreaterThanOrEqual(
        unaryChecks + mutableProbes.length + completeChecks,
      );
    } finally {
      mutable.mockRestore();
      observed.mockRestore();
    }
  });

  it("preserves authored hop counts when solving repeated native prefixes", () => {
    const hopData = {
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
    };
    const source: SlotKind<string> = {
      compile: (streams) => ({
        blocksLane: true,
        mover: moverSpec(
          hopData,
          streams,
          { lanes: 1, rows: 1 },
          { kind: "hop", most: 1, sideways: true, times: { max: 2, min: 2 } },
        ),
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "hopper",
      role: "minorMoving",
      weight: 1,
    };
    const budget = { ...empty, minorMoving: 1 };
    const result = planSlotSpawns(context, geometry, [source], [], {
      active: budget,
      capacity: budget,
      guarantees: [],
    });
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      const mover = result.assignments[0]!.entry.request.mover!;
      expect(mover.movement).toBe("hop");
      expect(mover.motion).toMatchObject({ count: { max: 2, min: 2 }, kind: "steps" });
      expect(result.assignments[0]!.entry.event.mover).toMatchObject({
        motion: "steps",
        steps: [expect.anything()],
      });
      expect(result.activeAudit.status).toBe("valid");
    }
  });

  it("retains rejected certificate findings and exact provisional evidence", () => {
    let compiled = 0;
    const unstable = [
      {
        ...catalogue[0]!,
        compile: () => ({
          blocksLane: true,
          footprint: { lanes: 1, rows: 1 },
          hitLength: ++compiled === 1 ? 30 : 31,
        }),
      },
    ];
    const budget = { ...empty, minorFixed: 1 };
    const result = planSlotSpawns(context, geometry, unstable, [], {
      active: budget,
      capacity: budget,
      guarantees: [],
    });
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") {
      return;
    }
    expect(result.stage).toBe("invariant");
    const captured = JSON.parse(JSON.stringify(result.certificates));
    expect(captured[0].phase).toBe("active");
    expect(captured[0].audit.violations).toContain("slot-profile-binding");
    expect(captured[0].assignments).toHaveLength(1);
    expect(captured[0].plan.quotas).toHaveLength(1);
    expect(captured[0].planned.events).toHaveLength(1);
    expect(result).not.toHaveProperty("planned");
  });

  it("rejects unavailable guarantees and bounded exhaustion without a partial plan", () => {
    const unavailable = planSlotSpawns(context, geometry, catalogue, [], {
      ...config,
      guarantees: [{ count: 1, kind: "taxi", role: "minorFixed" }],
    });
    expect(unavailable.status).toBe("unsupported");
    if (unavailable.status === "unsupported") {
      expect(unavailable.stage).toBe("configuration");
    }
    const exhausted = planSlotSpawns(
      { ...context, limits: { ...SLOT_LIMITS, candidateChecks: 1 } },
      geometry,
      catalogue,
      [],
      config,
    );
    expect(exhausted.status).toBe("unsupported");
    expect(exhausted).not.toHaveProperty("planned");
  });
});
