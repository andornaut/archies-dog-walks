import { afterEach, describe, expect, it, vi } from "vitest";

import * as audit from "./slotAudit.ts";
import type { SlotKind } from "./slotConfig.ts";
import {
  planSlotCapacity,
  planSlotSpawns,
  SLOT_LIMITS,
  type SlotPlanningContext,
} from "./slotPlanner.ts";
import * as witnessSearch from "./slotWitnessSearch.ts";
import type { SpawnPlan } from "./spawning.ts";

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

const config = {
  active: { encounterFixed: 0, encounterMoving: 0, minorFixed: 8, minorMoving: 0 },
  capacity: { encounterFixed: 0, encounterMoving: 0, minorFixed: 8, minorMoving: 0 },
  guarantees: [{ count: 1, kind: "wall", role: "minorFixed" as const }],
};
const context: SlotPlanningContext = {
  delivery: "runtime-90",
  limits: { ...SLOT_LIMITS, candidateChecks: 65536 },
  runtimeSearch: "original-then-balanced",
  seed: 7,
  zoneIndex: 0,
};
const catalogue = (): SlotKind<string>[] => [
  {
    compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
    footprint: { lanes: 1, rows: 1 },
    kind: "wall",
    role: "minorFixed",
    weight: 1,
  },
];
const rewards = [{ blocksLane: false, count: 2, kind: "tip" }];
afterEach(() => vi.restoreAllMocks());

describe("bounded runtime ordering portfolio", () => {
  it.each(["complete", "soft-partial", "hard-partial"] as const)(
    "does not retry a certified primary layout (%s)",
    (mode) => {
      const partial = mode !== "complete";
      const search = vi.spyOn(witnessSearch, "createSlotWitnessSearch");
      const result = planSlotSpawns(
        mode === "hard-partial"
          ? { ...context, limits: { ...context.limits, candidateChecks: 2000 } }
          : context,
        geometry,
        catalogue(),
        partial
          ? [
              { blocksLane: false, count: 1, kind: "tip", within: [100000, 100000] },
              { blocksLane: false, count: 1, kind: "tip" },
            ]
          : rewards,
        config,
      );
      expect(result.status).toBe(partial ? "partial" : "complete");
      expect(search).toHaveBeenCalledTimes(1);
      expect(result.diagnostics.attempts).toEqual([
        expect.objectContaining({
          ordering: "original",
          reserveRestart: false,
          status: partial ? "partial" : "compatible",
        }),
      ]);
      const [attempt] = result.diagnostics.attempts!;
      expect(attempt!.firstFloor!.candidateChecks).toBeLessThanOrEqual(attempt!.candidateChecks);
      expect(attempt!.firstFloor!.propagationChecks).toBeLessThanOrEqual(
        attempt!.propagationChecks,
      );
    },
  );

  it("retains frozen jobs and domains but restores state and provenance across a soft cutoff", () => {
    const create = witnessSearch.createSlotWitnessSearch;
    const roots: unknown[] = [],
      domainsSeen: unknown[] = [],
      jobsSeen: unknown[] = [],
      preparedSeen: unknown[] = [];
    let calls = 0;
    vi.spyOn(witnessSearch, "createSlotWitnessSearch").mockImplementation(
      (road, path, domains, jobs, work) => {
        const first = calls++ === 0;
        domainsSeen.push(domains);
        jobsSeen.push(jobs);
        preparedSeen.push([...jobs[0]!.preparations()][0]);
        let state: Parameters<ReturnType<typeof create>["solve"]>[0];
        const search = create(road, path, domains, jobs, {
          ...work,
          check() {
            if (first && state.entries().length > 0) {
              while (work.propagate!()) {
                /* Consume the real shared allowance. */
              }
              return false;
            }
            return work.check();
          },
        });
        return {
          ...search,
          solve(value) {
            state = value;
            roots.push(value);
            expect(state.entries()).toEqual([]);
            const result = search.solve(state);
            expect(state.entries()).toEqual([]);
            return result;
          },
        };
      },
    );
    const result = planSlotSpawns(context, geometry, catalogue(), rewards, config);
    expect(result.status).toBe("complete");
    expect(roots).toHaveLength(2);
    expect(roots[0]).not.toBe(roots[1]);
    expect(domainsSeen[0]).toBe(domainsSeen[1]);
    expect(jobsSeen[0]).toBe(jobsSeen[1]);
    expect(preparedSeen[0]).toBe(preparedSeen[1]);
    expect(result.diagnostics.profileCompiles).toBe(10);
    expect(result.diagnostics.attempts).toEqual([
      expect.objectContaining({ ordering: "original", propagationChecks: 32768, status: "budget" }),
      expect.objectContaining({ ordering: "balanced", status: "compatible" }),
    ]);
    expect(
      result.diagnostics.attempts!.reduce((sum, attempt) => sum + attempt.candidateChecks, 0),
    ).toBe(result.diagnostics.candidateChecks);
    expect(
      result.diagnostics.attempts!.reduce((sum, attempt) => sum + attempt.propagationChecks, 0),
    ).toBe(result.diagnostics.propagationChecks);
    expect(result.diagnostics.propagationChecks).toBeGreaterThan(32768);
    expect(result.diagnostics.propagationChecks).toBeLessThanOrEqual(65536);
    if (result.status !== "complete") {
      throw new Error("Missing independently audited layout");
    }
    expect(result.activeAudit.status).toBe("valid");
    expect(result.delivery.delivered).toBe(10);
  });

  it("never resets the cumulative candidate allowance", () => {
    const create = witnessSearch.createSlotWitnessSearch;
    vi.spyOn(witnessSearch, "createSlotWitnessSearch").mockImplementation(
      (road, path, domains, jobs, work) =>
        create(road, path, domains, jobs, {
          ...work,
          check() {
            while (work.check()) {
              /* Consume the real shared allowance. */
            }
            return false;
          },
        }),
    );
    const result = planSlotSpawns(context, geometry, catalogue(), rewards, config);
    expect(result.status).toBe("unsupported");
    expect(result.diagnostics.candidateChecks).toBe(65536);
    expect(result.diagnostics.attempts).toEqual([
      expect.objectContaining({ candidateChecks: 32768, ordering: "original" }),
      expect.objectContaining({ candidateChecks: 32768, ordering: "balanced" }),
    ]);
  });

  it("does not retry a hard anchor failure", () => {
    const create = witnessSearch.createSlotWitnessSearch;
    const search = vi
      .spyOn(witnessSearch, "createSlotWitnessSearch")
      .mockImplementation((road, path, domains, jobs, work) =>
        create(road, path, domains, jobs, {
          ...work,
          check() {
            while (work.anchor()) {
              /* Consume the real shared allowance. */
            }
            return false;
          },
        }),
      );
    const result = planSlotSpawns(context, geometry, catalogue(), rewards, config);
    expect(result.status).toBe("unsupported");
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.anchors).toBe(32768);
  });

  it("does not retry a hard template failure", () => {
    const search = vi.spyOn(witnessSearch, "createSlotWitnessSearch");
    const result = planSlotSpawns(
      { ...context, limits: { ...context.limits, compiledTemplates: 1 } },
      geometry,
      catalogue(),
      rewards,
      config,
    );
    expect(result.status).toBe("unsupported");
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.compiledTemplates).toBe(1);
  });

  it.each(["capacity", "numeric-only"] as const)("does not enable fallback for %s", (mode) => {
    const create = witnessSearch.createSlotWitnessSearch;
    const search = vi
      .spyOn(witnessSearch, "createSlotWitnessSearch")
      .mockImplementation((road, path, domains, jobs, work) =>
        create(road, path, domains, jobs, {
          ...work,
          check() {
            while (work.propagate!()) {
              /* Consume the real shared allowance. */
            }
            return false;
          },
        }),
      );
    const numeric = { ...context };
    delete numeric.runtimeSearch;
    const result =
      mode === "capacity"
        ? planSlotCapacity(context, geometry, catalogue(), rewards, config)
        : planSlotSpawns(numeric, geometry, catalogue(), rewards, config);
    expect(result.status).toBe("unsupported");
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.propagationChecks).toBe(mode === "capacity" ? 32768 : 65536);
    expect(result.diagnostics.attempts).toBeUndefined();
  });
});

it.each(["source", "geometry", "cyclic-geometry"] as const)(
  "falls back through frozen %s facts",
  (change) => {
    const create = witnessSearch.createSlotWitnessSearch;
    const road = { ...geometry };
    const kinds = catalogue();
    const compile = kinds[0]!.compile;
    const rejected: unknown[] = [];
    const searchSpy = vi
      .spyOn(witnessSearch, "createSlotWitnessSearch")
      .mockImplementation((nativeRoad, path, domains, jobs, work) => {
        const primary = searchSpy.mock.calls.length === 1;
        let state: Parameters<ReturnType<typeof create>["solve"]>[0];
        const search = create(nativeRoad, path, domains, jobs, {
          ...work,
          check() {
            if (primary && state.entries().length > 0) {
              if (rejected.length === 0) {
                try {
                  if (change === "source") {
                    Object.defineProperty(kinds[0]!, "compile", {
                      value: () => ({ blocksLane: false }),
                    });
                  } else if (change === "geometry") {
                    road.cellInset++;
                  } else {
                    Object.assign(road, { changed: road });
                  }
                } catch (error) {
                  rejected.push(error);
                }
              }
              while (work.propagate!()) {
                /* Consume the real shared allowance. */
              }
              return false;
            }
            return work.check();
          },
        });
        return {
          ...search,
          solve(value) {
            state = value;
            return search.solve(value);
          },
        };
      });
    const result = planSlotSpawns(context, road, kinds, rewards, config);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toBeInstanceOf(TypeError);
    expect(kinds[0]!.compile).toBe(compile);
    expect(road).toEqual(geometry);
    expect(searchSpy).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("complete");
  },
);

it("does not mask an independent audit invariant with a fallback", () => {
  const certify = audit.auditSlotPartialPlan;
  const search = vi.spyOn(witnessSearch, "createSlotWitnessSearch");
  vi.spyOn(audit, "auditSlotPartialPlan").mockImplementation((...args) => ({
    ...certify(...args),
    failure: "invariant",
    status: "invalid",
    violations: ["injected-native-invariant"],
  }));
  const result = planSlotSpawns(context, geometry, catalogue(), rewards, config);
  expect(result).toMatchObject({ stage: "invariant", status: "unsupported" });
  expect(search).toHaveBeenCalledTimes(1);
});
