// The planner acceptance verdict: pure checks over each plan's independently gathered evidence.
// The criteria follow gameplay/design.md (Spawning details) and the gameplay acceptance rule.

import { minimumSlotDelivery } from "../../runner/slotDelivery.ts";

export const ACCEPTANCE_PACK = ["ginger", "lady", "kilo"] as const;
export const ACCEPTANCE_ROUTES = ["left", "straight", "right"] as const;
export const ACCEPTANCE_SEEDS = [
  584548801, 567771182, 550993563, 534215944, 651659277, 634881658,
] as const;
// Each walk plans one neighbourhood per walk position.
export const PLANS_PER_WALK = 4;
// The share of the per-attempt allowance a plan's peak search may use.
export const SEARCH_SHARE = 3 / 4;

export interface AttemptEvidence {
  readonly candidateChecks: number;
  readonly ordering: "balanced" | "original";
  readonly propagationChecks: number;
  readonly reserveRestart: boolean;
  readonly status: string;
}

export interface PlanEvidence {
  readonly attempts: readonly AttemptEvidence[];
  // The fresh independent audit of the planner's certificate.
  readonly certificate: {
    readonly equalsSupplied: boolean;
    readonly geometryValid: boolean;
    readonly kind: "auditSlotPartialPlan" | "auditSlotPlan";
    readonly status: string;
  };
  readonly configured: number;
  readonly delivered: number;
  readonly guarantees: readonly {
    readonly count: number;
    readonly kind: string;
    readonly role: string;
    readonly selected: number;
  }[];
  readonly kinds: readonly {
    readonly activeSelected: number;
    readonly kind: string;
    readonly role: string;
    readonly visibleCertified: number;
  }[];
  // The simulator's own native audit of the zone it walked.
  readonly nativeAuditValid: boolean;
  readonly position: number;
  readonly quietOver: number;
  readonly required: number;
  readonly route: string;
  readonly rush: boolean;
  readonly seed: number;
  readonly status: "complete" | "partial";
  readonly substitution: {
    readonly capacityEmitted: number;
    readonly downgrades: readonly string[];
    readonly overBudgetRoles: readonly string[];
    readonly roadEmissionsMatch: boolean;
    readonly substitutes: readonly string[];
  };
  readonly zone: string;
}

const PLAN_CRITERIA = {
  certificates: (_allowance: number, plan: PlanEvidence) =>
    plan.certificate.status === "valid" && plan.certificate.equalsSupplied && plan.nativeAuditValid,
  complete: (_allowance: number, plan: PlanEvidence) =>
    plan.status === "complete" && plan.delivered === plan.configured,
  fallbacks: (_allowance: number, plan: PlanEvidence) =>
    plan.attempts.every((attempt) => attempt.ordering === "original"),
  floor: (_allowance: number, plan: PlanEvidence) =>
    plan.required === minimumSlotDelivery("runtime-90", plan.configured) &&
    plan.delivered >= plan.required,
  guarantees: (_allowance: number, plan: PlanEvidence) =>
    plan.guarantees.every((guarantee) => guarantee.selected >= guarantee.count),
  safety: (_allowance: number, plan: PlanEvidence) =>
    plan.certificate.geometryValid && plan.quietOver === 0,
  search: (allowance: number, plan: PlanEvidence) =>
    plan.attempts.length > 0 &&
    plan.attempts.every((attempt) => !attempt.reserveRestart) &&
    peakChecks(plan) <= SEARCH_SHARE * allowance,
  substitutes: (_allowance: number, plan: PlanEvidence) =>
    plan.substitution.capacityEmitted === 0 &&
    plan.substitution.downgrades.length === 0 &&
    plan.substitution.overBudgetRoles.length === 0 &&
    plan.substitution.roadEmissionsMatch &&
    plan.substitution.substitutes.length === 0,
  visibility: (_allowance: number, plan: PlanEvidence) =>
    plan.kinds.length > 0 &&
    plan.kinds.every((kind) => kind.activeSelected >= 1 && kind.visibleCertified >= 1),
} satisfies Record<string, (allowance: number, plan: PlanEvidence) => boolean>;

export type PlanCriterion = keyof typeof PLAN_CRITERIA;

export const PLAN_CRITERION_IDS = Object.keys(PLAN_CRITERIA) as PlanCriterion[];

// The most search checks of either kind any one attempt of the plan used.
export function peakChecks(plan: PlanEvidence): number {
  return Math.max(
    0,
    ...plan.attempts.map((attempt) => Math.max(attempt.candidateChecks, attempt.propagationChecks)),
  );
}

// The criteria a plan fails, given the per-attempt search allowance.
export function planFailures(allowance: number, plan: PlanEvidence): PlanCriterion[] {
  return PLAN_CRITERION_IDS.filter((id) => !PLAN_CRITERIA[id](allowance, plan));
}

export interface WalkEvidence {
  // Defects outside any one plan: an uncertified zone or a simulator audit mismatch.
  readonly errors: readonly string[];
  readonly finished: boolean;
  readonly plans: readonly PlanEvidence[];
}

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

function coverage(plans: readonly PlanEvidence[]) {
  const zones = [...new Set(plans.map((plan) => plan.zone))].sort();
  return zones.map((zone) => {
    const visits = plans.filter((plan) => plan.zone === zone);
    const strata = new Map<
      string,
      { mode: "ordinary" | "rush"; plans: number; position: number }
    >();
    for (const plan of visits) {
      const mode = plan.rush ? "rush" : "ordinary";
      const key = `${plan.position}/${mode}`;
      const stratum = strata.get(key) ?? { mode, plans: 0, position: plan.position };
      strata.set(key, { ...stratum, plans: stratum.plans + 1 });
    }
    return {
      complete: visits.filter((plan) => plan.status === "complete").length,
      plans: visits.length,
      strata: [...strata.values()].sort(
        (a, b) => a.position - b.position || a.mode.localeCompare(b.mode),
      ),
      zone,
    };
  });
}

// The batch verdict: PASS only for every walk of the fixed batch, each plan meeting every
// criterion and no walk-level error. A stopped batch fails on its missing walks.
export function batchVerdict(allowance: number, walks: readonly WalkEvidence[]) {
  const plans = walks.flatMap((walk) => walk.plans);
  const expectedWalks = ACCEPTANCE_ROUTES.length * ACCEPTANCE_SEEDS.length;
  const failures = Object.fromEntries(
    PLAN_CRITERION_IDS.map((id) => [
      id,
      plans.filter((plan) => !PLAN_CRITERIA[id](allowance, plan)).length,
    ]),
  ) as Record<PlanCriterion, number>;
  const errors = walks.flatMap((walk) => walk.errors);
  const peak = Math.max(0, ...plans.map(peakChecks));
  const batch =
    walks.length === expectedWalks &&
    plans.length === expectedWalks * PLANS_PER_WALK &&
    walks.every((walk) => walk.plans.length === PLANS_PER_WALK) &&
    errors.length === 0;
  return {
    acceptance:
      batch && PLAN_CRITERION_IDS.every((id) => failures[id] === 0)
        ? ("PASS" as const)
        : ("FAIL" as const),
    batch: { errors, expectedWalks, plans: plans.length, walks: walks.length },
    coverage: coverage(plans),
    delivery: {
      complete: plans.filter((plan) => plan.status === "complete").length,
      configured: plans.reduce((total, plan) => total + plan.configured, 0),
      delivered: plans.reduce((total, plan) => total + plan.delivered, 0),
      minMarginOverRequired: Math.min(...plans.map((plan) => plan.delivered - plan.required)),
    },
    failedPlans: failures,
    finishedWalks: walks.filter((walk) => walk.finished).length,
    search: {
      allowance,
      fallbacks: plans.filter((plan) => !PLAN_CRITERIA.fallbacks(allowance, plan)).length,
      limit: SEARCH_SHARE * allowance,
      maxCandidateChecks: Math.max(
        0,
        ...plans.flatMap((plan) => plan.attempts.map((attempt) => attempt.candidateChecks)),
      ),
      maxPropagationChecks: Math.max(
        0,
        ...plans.flatMap((plan) => plan.attempts.map((attempt) => attempt.propagationChecks)),
      ),
      peak,
      peakShare: share(peak, allowance),
    },
  };
}
