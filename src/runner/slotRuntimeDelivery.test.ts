import { describe, expect, it, vi } from "vitest";

import { createSlotCandidateDomains } from "./slotCandidateDomains";
import { prepareSlotKind } from "./slotCandidates";
import type { SlotKind } from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import { SLOT_OMISSION_ATTEMPTS } from "./slotDelivery";
import { planSlotCapacity, planSlotSpawns, SLOT_LIMITS } from "./slotPlanner";
import { createSlotWitnessSearch, type WitnessJob } from "./slotWitnessSearch";
import { rowSpacing, type SpawnPlan, type SpawnQuota, zoneRows } from "./spawning";

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
function fixture(missing: number | undefined, guaranteed = 0) {
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
  const jobs: WitnessJob<string>[] = Array.from({ length: 10 }, (_, ordinal) => {
    const prepared = prepareSlotKind({ movers: () => 0, spawns: () => 0 }, geometry, {
      compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind: `wall-${ordinal}`,
      role: "minorFixed",
      weight: 1,
    });
    return {
      columnPick: () => 0,
      fixed: true,
      guaranteed: ordinal === guaranteed,
      key: `wall-${ordinal}`,
      laneEffect: "possible",
      ...(ordinal === guaranteed ? {} : { optional: true as const }),
      ordinal,
      phase: "active",
      preparations: () => (ordinal === missing ? [] : [prepared]),
      total: 10,
    };
  });
  const state = createSlotConstructionState(geometry, path);
  const domains = createSlotCandidateDomains(geometry, path);
  return { domains, jobs, path, state };
}

// Rejects wall-4's first native commits while its cursor still holds valid values.
function rejectingFixture(failures: number = SLOT_OMISSION_ATTEMPTS.reserve) {
  const value = fixture(undefined);
  let rejected = 0;
  const state: typeof value.state = {
    ...value.state,
    commit(owner, entry) {
      if (owner === value.jobs[4] && rejected < failures) {
        rejected++;
        return {
          accepted: false,
          failure: { classification: "intrinsic", owners: [], rule: "test-rejection" },
        };
      }
      return value.state.commit(owner, entry);
    },
  };
  return { ...value, rejected: () => rejected, state };
}
// Each rejected commit also spends its intrinsic and commit checks.
const REJECTION_CHECKS = 2 * SLOT_OMISSION_ATTEMPTS.reserve + 200;
// A spent exploring share starts the attempt in its reserve pass.
const RESERVE_DUE = { progress: () => 1 };

describe("optional native slot delivery", () => {
  it("retains a qualifying native incumbent through budget rollback without full-universe proofs", () => {
    const { domains, jobs, path, state } = fixture(4);
    let checks = 0;
    let stopped = false;
    const check = () => {
      if (checks === 300) {
        stopped = true;
        return false;
      }
      checks++;
      return true;
    };
    const certify = vi.fn(() => true);
    const support = vi.fn(() => ({ status: "unknown" as const }));
    const attestRefutation = vi.fn(() => ({ status: "unknown" as const }));
    const snapshots: string[][] = [];
    const certifyPartial = vi.fn((selected: readonly { readonly job: WitnessJob<string> }[]) => {
      snapshots.push(selected.map(({ job }) => job.key));
      expect(state.checkComplete().accepted).toBe(true);
      return true;
    });
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      anchor: () => true,
      attestRefutation,
      certify,
      certifyPartial,
      check,
      minimumDelivery: 9,
      propagate: () => true,
      stopped: () => stopped,
      support,
    }).solve(state);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") {
      throw new Error("Expected a retained native incumbent");
    }
    expect(checks).toBe(300);
    expect(stopped).toBe(true);
    expect(result.selections).toHaveLength(9);
    expect(result.selections.some(({ job }) => job === jobs[0])).toBe(true);
    expect(result.omissions).toEqual([{ job: jobs[4], reason: "domain-exhausted" }]);
    expect(result.selections.map(({ job }) => job.key)).toEqual(snapshots[0]);
    expect(Object.isFrozen(result.selections)).toBe(true);
    expect(Object.isFrozen(result.omissions)).toBe(true);
    expect(result.selections.map(({ entry }) => entry.trace.quotaIndex)).toEqual(
      Array.from({ length: 9 }, (_, index) => index),
    );
    expect(certifyPartial).toHaveBeenCalledOnce();
    expect(certify).not.toHaveBeenCalled();
    expect(support).not.toHaveBeenCalled();
    expect(attestRefutation).not.toHaveBeenCalled();
    expect(state.entries()).toEqual([]);
  });

  it("certifies full delivery on its last available check instead of downgrading the incumbent", () => {
    const { domains, jobs, path, state } = fixture(undefined);
    const certifyPartial = vi.fn(() => true);
    const certify = vi.fn(() => true);
    let lastCheck = false;
    let refused = 0;
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      anchor: () => true,
      certify,
      certifyPartial,
      check: () => {
        if (lastCheck) {
          refused++;
          return false;
        }
        lastCheck = state.entries().length === jobs.length;
        return true;
      },
      minimumDelivery: 9,
      propagate: () => true,
    }).solve(state);
    expect(certifyPartial).toHaveBeenCalledOnce();
    expect(certify).toHaveBeenCalledOnce();
    expect(lastCheck).toBe(true);
    expect(refused).toBe(0);
    expect(result.status).toBe("compatible");
    if (result.status === "compatible") {
      expect(result.selections).toHaveLength(10);
    }
    expect(state.entries()).toEqual([]);
  });

  it("cannot omit a protected owner even when nine other owners have native values", () => {
    const { domains, jobs, path, state } = fixture(4, 4);
    const certifyPartial = vi.fn(() => true);
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      anchor: () => true,
      certifyPartial,
      check: () => true,
      minimumDelivery: 9,
      propagate: () => true,
    }).solve(state);
    expect(result.status).toBe("blocked");
    expect(certifyPartial).not.toHaveBeenCalled();
    expect(state.entries()).toEqual([]);
  });

  it.each([
    { failures: 1, next: "wall-4", pass: "exploring", progress: 0 },
    { failures: SLOT_OMISSION_ATTEMPTS.reserve, next: "wall-4", pass: "exploring", progress: 0 },
    { failures: 1, next: "wall-4", pass: "reserve", progress: 1 },
    { failures: SLOT_OMISSION_ATTEMPTS.reserve, next: "wall-5", pass: "reserve", progress: 1 },
  ])(
    "in the $pass pass, after $failures failed attempts of optional wall-4, next places $next",
    ({ failures, next, progress }) => {
      const { domains, jobs, path, rejected, state } = rejectingFixture(failures);
      const placed: string[] = [];
      const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
        anchor: () => true,
        certifyPartial: () => true,
        check: () => true,
        minimumDelivery: 9,
        progress: () => progress,
        propagate: () => true,
      }).solve({
        ...state,
        commit(owner, entry) {
          const trial = state.commit(owner, entry);
          if (trial.accepted && rejected() === failures) {
            placed.push(owner.key);
          }
          return trial;
        },
      });
      expect(rejected()).toBe(failures);
      expect(placed[0]).toBe(next);
      expect(result.status).toBe("compatible");
      if (result.status === "compatible") {
        expect(result.selections.map(({ owner }) => owner)).toEqual(jobs);
      }
      expect(state.entries()).toEqual([]);
    },
  );

  it("resumes a better original placement after its certified omission subtree is dominated", () => {
    const { domains, jobs, path, state } = rejectingFixture();
    let checks = 0;
    let certified = false;
    let repaired = false;
    const afterAudit: string[] = [];
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      anchor: () => true,
      certifyPartial: () => {
        certified = true;
        return true;
      },
      check: () => ++checks <= REJECTION_CHECKS,
      minimumDelivery: 9,
      ...RESERVE_DUE,
      propagate: () => true,
    }).solve({
      ...state,
      commit(owner, entry) {
        if (certified && !repaired) {
          afterAudit.push(owner.key);
        }
        const trial = state.commit(owner, entry);
        if (owner === jobs[4] && trial.accepted) {
          repaired = true;
        }
        return trial;
      },
    });
    expect(certified).toBe(true);
    expect(afterAudit.length).toBeGreaterThan(0);
    expect(new Set(afterAudit)).toEqual(new Set([jobs[4]!.key]));
    expect(repaired).toBe(true);
    expect(result.status).toBe("compatible");
    if (result.status === "compatible") {
      expect(result.selections).toHaveLength(10);
      expect(result.selections.map(({ owner }) => owner)).toEqual(jobs);
    }
    expect(checks).toBeLessThanOrEqual(REJECTION_CHECKS);
    expect(state.entries()).toEqual([]);
  });

  it("does not bound an omission branch using a native-valid but uncertified prefix", () => {
    const { domains, jobs, path, state } = rejectingFixture();
    let checks = 0;
    let ineligible = false;
    const afterAudit: string[] = [];
    const certifyPartial = vi.fn(() => {
      ineligible = true;
      return false;
    });
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      anchor: () => true,
      certifyPartial,
      check: () => ++checks <= REJECTION_CHECKS,
      minimumDelivery: 9,
      ...RESERVE_DUE,
      propagate: () => true,
    }).solve({
      ...state,
      commit(owner, entry) {
        if (ineligible) {
          afterAudit.push(owner.key);
        }
        return state.commit(owner, entry);
      },
    });
    expect(certifyPartial.mock.calls.length).toBeGreaterThan(1);
    expect(afterAudit).toContain(jobs[9]!.key);
    expect(result.status).toBe("budget");
    expect(state.entries()).toEqual([]);
  });

  it("preserves a fatal native failure instead of returning its earlier incumbent", () => {
    const { domains, jobs, path, state } = fixture(undefined);
    const failure = {
      classification: "unattributed" as const,
      owners: [],
      rule: "native-invariant",
    };
    const certifyPartial = vi.fn(() => true);
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      anchor: () => true,
      certifyPartial,
      check: () => true,
      minimumDelivery: 9,
      propagate: () => true,
    }).solve({
      ...state,
      commit(owner, entry) {
        return owner === jobs[9] ? { accepted: false, failure } : state.commit(owner, entry);
      },
    });
    expect(certifyPartial).toHaveBeenCalledOnce();
    expect(result).toEqual({ failure, status: "blocked" });
    expect(state.entries()).toEqual([]);
  });
});

const catalogue: readonly SlotKind<string>[] = [
  {
    compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
    footprint: { lanes: 1, rows: 1 },
    kind: "wall",
    role: "minorFixed",
    weight: 1,
  },
];
const counts = { encounterFixed: 0, encounterMoving: 0, minorFixed: 8, minorMoving: 0 };
const configuration = {
  active: counts,
  capacity: counts,
  guarantees: [{ count: 1, kind: "wall", role: "minorFixed" as const }],
};
const context = {
  delivery: "runtime-90" as const,
  limits: { ...SLOT_LIMITS, anchors: 2000, candidateChecks: 2000 },
  seed: 7,
  zoneIndex: 0,
};

describe("runtime delivery producer", () => {
  it("audits the original ten-job denominator and retains original auxiliary identities", () => {
    const auxiliary: readonly SpawnQuota<string>[] = [
      { blocksLane: false, count: 1, kind: "tip", within: [100000, 100000] },
      { blocksLane: false, count: 1, kind: "tip" },
    ];
    const result = planSlotSpawns(context, geometry, catalogue, auxiliary, configuration);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") {
      throw new Error("Expected a qualifying independently audited partial composition");
    }
    expect(result.partialAudit.status).toBe("valid");
    expect(result.partialAudit.purpose).toBe("runtime-partial");
    expect(result.delivery).toMatchObject({ configured: 10, delivered: 9, required: 9 });
    expect(result.delivery.omissions).toEqual([
      {
        auxiliary: { memberIndex: 0, requestIndex: 0 },
        key: "auxiliary:0:0",
        kind: "tip",
        reason: "domain-exhausted",
        role: "auxiliaryFixed",
      },
    ]);
    expect(result.assignments.at(-1)).toMatchObject({
      auxiliary: { memberIndex: 0, requestIndex: 1 },
      entry: { trace: { memberIndex: 0, quotaIndex: 8 } },
      key: "auxiliary:1:0",
    });
    expect(result.planned.admission!.placement).toMatchObject({
      placed: 9,
      ratio: 0.9,
      requested: 10,
    });
    expect(result).not.toHaveProperty("activeAudit");
    expect(result.diagnostics.candidateChecks).toBeLessThanOrEqual(2000);
    expect(result.diagnostics.propagationChecks).toBeLessThanOrEqual(2000);
    expect(
      planSlotSpawns(
        { ...context, delivery: "exact" },
        geometry,
        catalogue,
        auxiliary,
        configuration,
      ).status,
    ).toBe("unsupported");
    expect(planSlotCapacity(context, geometry, catalogue, auxiliary, configuration).status).toBe(
      "unsupported",
    );
  });

  it("returns strict complete delivery when the last optional reward also fits", () => {
    const result = planSlotSpawns(
      context,
      geometry,
      catalogue,
      [{ blocksLane: false, count: 2, kind: "tip" }],
      configuration,
    );
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error("Expected all original jobs to fit");
    }
    expect(result.activeAudit.status).toBe("valid");
    expect(result.delivery).toMatchObject({
      configured: 10,
      delivered: 10,
      omissions: [],
      policy: "runtime-90",
    });
    expect(result).not.toHaveProperty("partialAudit");
  });
});
