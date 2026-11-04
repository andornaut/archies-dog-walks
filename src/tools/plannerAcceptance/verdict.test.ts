import { describe, expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { SLOT_LIMITS } from "../../runner/slotPlanner.ts";
import { zoneSlotGuarantees } from "../../runner/zonePlan.ts";
import {
  ACCEPTANCE_ROUTES,
  ACCEPTANCE_SEEDS,
  batchVerdict,
  type PlanEvidence,
  planFailures,
  PLANS_PER_WALK,
  SEARCH_SHARE,
  type WalkEvidence,
} from "./verdict.ts";

const ALLOWANCE = SLOT_LIMITS.candidateChecks;
const LIMIT = SEARCH_SHARE * ALLOWANCE;
const ZONE = gameData.world.zones[0]!;
const { kind: KIND, role: ROLE } = zoneSlotGuarantees(gameData, ZONE)[0]!;

const PASSING: PlanEvidence = {
  attempts: [
    {
      candidateChecks: LIMIT - 1,
      ordering: "original",
      propagationChecks: LIMIT,
      reserveRestart: false,
      status: "compatible",
    },
  ],
  certificate: {
    equalsSupplied: true,
    geometryValid: true,
    kind: "auditSlotPlan",
    status: "valid",
  },
  configured: 20,
  delivered: 20,
  guarantees: [{ count: 1, kind: KIND, role: ROLE, selected: 1 }],
  kinds: [{ activeSelected: 1, kind: KIND, role: ROLE, visibleCertified: 1 }],
  nativeAuditValid: true,
  position: 1,
  quietOver: 0,
  required: 18,
  route: ACCEPTANCE_ROUTES[0],
  rush: false,
  seed: ACCEPTANCE_SEEDS[0],
  status: "complete",
  substitution: {
    capacityEmitted: 0,
    downgrades: [],
    overBudgetRoles: [],
    roadEmissionsMatch: true,
    substitutes: [],
  },
  zone: ZONE.id,
};

const attempt = PASSING.attempts[0]!;

function batch(plan: PlanEvidence): WalkEvidence[] {
  return ACCEPTANCE_ROUTES.flatMap(() =>
    ACCEPTANCE_SEEDS.map(() => ({
      errors: [],
      finished: true,
      plans: Array.from({ length: PLANS_PER_WALK }, () => plan),
    })),
  );
}

describe("planner acceptance verdict", () => {
  it("passes a full batch of plans meeting every criterion, the peak at the limit", () => {
    expect(planFailures(ALLOWANCE, PASSING)).toEqual([]);
    const verdict = batchVerdict(ALLOWANCE, batch(PASSING));
    expect(verdict.acceptance).toBe("PASS");
    expect(verdict.search.peak).toBe(LIMIT);
  });

  it.each<[string, Partial<PlanEvidence>, string[]]>([
    [
      "an unequal fresh certificate",
      { certificate: { ...PASSING.certificate, equalsSupplied: false } },
      ["certificates"],
    ],
    ["an invalid simulator audit", { nativeAuditValid: false }, ["certificates"]],
    ["a partial plan above the floor", { delivered: 18, status: "partial" }, ["complete"]],
    ["a plan below the floor", { delivered: 17, status: "partial" }, ["complete", "floor"]],
    [
      "a peak above the limit",
      { attempts: [{ ...attempt, candidateChecks: LIMIT + 1 }] },
      ["search"],
    ],
    ["a reserve restart", { attempts: [{ ...attempt, reserveRestart: true }] }, ["search"]],
    [
      "a fallback attempt",
      { attempts: [attempt, { ...attempt, ordering: "balanced" }] },
      ["fallbacks"],
    ],
    [
      "a missing guarantee",
      { guarantees: [{ ...PASSING.guarantees[0]!, selected: 0 }] },
      ["guarantees"],
    ],
    [
      "a kind never visible",
      { kinds: [{ ...PASSING.kinds[0]!, visibleCertified: 0 }] },
      ["visibility"],
    ],
    [
      "a substitute kind",
      { substitution: { ...PASSING.substitution, substitutes: ["k1"] } },
      ["substitutes"],
    ],
    [
      "a movement downgrade",
      { substitution: { ...PASSING.substitution, downgrades: ["k1"] } },
      ["substitutes"],
    ],
    [
      "an emitted capacity extra",
      { substitution: { ...PASSING.substitution, capacityEmitted: 1 } },
      ["substitutes"],
    ],
    ["quiet coverage exceeded", { quietOver: 1 }, ["safety"]],
  ])("fails %s", (_name, change, failures) => {
    const plan = { ...PASSING, ...change };
    expect(planFailures(ALLOWANCE, plan)).toEqual(failures);
    const verdict = batchVerdict(ALLOWANCE, batch(plan));
    expect(verdict.acceptance).toBe("FAIL");
    for (const failure of failures) {
      expect(verdict.failedPlans[failure as keyof typeof verdict.failedPlans]).toBe(
        ACCEPTANCE_ROUTES.length * ACCEPTANCE_SEEDS.length * PLANS_PER_WALK,
      );
    }
  });

  it("fails a stopped batch and a walk-level error", () => {
    expect(batchVerdict(ALLOWANCE, batch(PASSING).slice(1)).acceptance).toBe("FAIL");
    const [first, ...rest] = batch(PASSING);
    expect(
      batchVerdict(ALLOWANCE, [{ ...first!, errors: [`${ZONE.id}: configured mismatch`] }, ...rest])
        .acceptance,
    ).toBe("FAIL");
  });
});
