import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gameData } from "../../data/index.ts";
import { SLOT_LIMITS } from "../../runner/slotPlanner.ts";
import type { ZonePlanObservation } from "../../runner/zonePlan.ts";
import { type RunResult, simulateRun } from "../../sim/simulate.ts";
import { SKILL_PRESETS } from "../../sim/skills.ts";
import type { ZoneWalkEvents } from "../../sim/walkEvents.ts";
import type { RunState } from "../../state/runState.ts";
import { certifyPlan, geometryValid } from "./certify.ts";
import {
  ACCEPTANCE_PACK,
  ACCEPTANCE_ROUTES,
  ACCEPTANCE_SEEDS,
  batchVerdict,
  peakChecks,
  type PlanEvidence,
  planFailures,
  type WalkEvidence,
} from "./verdict.ts";

interface Observed {
  readonly evidence?: ReturnType<typeof certifyPlan>;
  readonly observation: ZonePlanObservation;
  readonly run: RunState;
}

// Defects in the simulator's own record of a walk's zones against what the planner certified.
function walkErrors(observed: readonly Observed[], zones: readonly ZoneWalkEvents[]): string[] {
  const errors: string[] = [];
  if (observed.length !== zones.length || observed.some((entry) => !entry.evidence)) {
    errors.push("Unobserved or uncertified zone plan");
  }
  for (const zone of zones) {
    const { audit, slots } = zone;
    if (slots === undefined || zone.configured !== slots.delivery.configured) {
      errors.push(`${zone.zone}: configured mismatch`);
    }
    const delivered = slots?.delivery.delivered;
    if (
      audit !== undefined &&
      (audit.requested !== delivered ||
        audit.placed !== delivered ||
        audit.validPlaced !== delivered)
    ) {
      errors.push(`${zone.zone}: delivered and valid counts differ`);
    }
    for (const [kind, flow] of Object.entries(zone.kinds)) {
      const counts = audit?.counts.filter((count) => count.kind === kind) ?? [];
      const emitted = counts.reduce((total, count) => total + count.emitted, 0);
      const valid = counts.reduce((total, count) => total + count.validPlaced, 0);
      if (flow.admitted !== emitted || flow.valid !== valid || flow.admitted !== flow.valid) {
        errors.push(`${zone.zone}/${kind}: emitted and valid counts differ`);
      }
    }
  }
  return errors;
}

function walkEvidence(observed: readonly Observed[], result: RunResult): WalkEvidence {
  const plans: PlanEvidence[] = observed.flatMap(({ evidence }, index) => {
    if (evidence === undefined) {
      return [];
    }
    const audit = result.spawnEvents[index]?.audit;
    return [{ ...evidence, nativeAuditValid: audit !== undefined && geometryValid(audit) }];
  });
  return {
    errors: walkErrors(observed, result.spawnEvents),
    finished: result.finished,
    plans,
  };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// Runs the fixed acceptance batch into out, route outer and seed inner, and stops at the first
// walk with a failed criterion or evidence defect, keeping that walk's observations. Returns
// whether the batch passed.
export function runBatch(commit: string | null, out: string): boolean {
  if (existsSync(out) && readdirSync(out).length > 0) {
    throw new Error(`${out} is not empty; give each batch a new output folder`);
  }
  mkdirSync(out, { recursive: true });
  const allowance = SLOT_LIMITS.candidateChecks;
  const player = { kind: "skill", sight: "sight", skill: SKILL_PRESETS.expert } as const;
  writeFileSync(
    join(out, "batch.json"),
    json({
      allowance,
      commit,
      gear: null,
      pack: ACCEPTANCE_PACK,
      player: { ...player, preset: "expert" },
      policy: "mixed",
      routes: ACCEPTANCE_ROUTES,
      seeds: ACCEPTANCE_SEEDS,
      walker: gameData.defaultWalker,
    }),
  );
  writeFileSync(join(out, "plans.jsonl"), "");
  const walks: WalkEvidence[] = [];
  const batchStarted = performance.now();
  let stopped = false;
  for (const route of ACCEPTANCE_ROUTES) {
    for (const seed of ACCEPTANCE_SEEDS) {
      const observed: Observed[] = [];
      const started = performance.now();
      const walkNumber = walks.length + 1;
      const keep = (failure: object) => {
        writeFileSync(join(out, "failure.json"), json({ commit, route, seed, ...failure }));
        writeFileSync(
          join(out, `observations-${route}-${seed}.json`),
          JSON.stringify(observed.map(({ observation, run }) => ({ observation, run }))),
        );
        console.error(JSON.stringify({ route, seed, walk: walkNumber, ...failure }));
      };
      let result: RunResult;
      try {
        result = simulateRun(gameData, seed, {
          gear: null,
          observeSpawnPlan: (observation, run) => {
            const entry: Observed = { observation, run };
            observed.push(entry);
            observed[observed.length - 1] = {
              ...entry,
              evidence: certifyPlan({ route, seed }, run, observation),
            };
          },
          pack: ACCEPTANCE_PACK,
          player,
          policy: "mixed",
          route,
          walker: gameData.defaultWalker,
        });
      } catch (error) {
        keep({
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        stopped = true;
        break;
      }
      if (result.planningFailure !== undefined) {
        const { kind, message } = result.planningFailure;
        writeFileSync(join(out, "planning-failure.json"), JSON.stringify(result.planningFailure));
        keep({ planningFailure: { kind, message } });
        stopped = true;
        break;
      }
      const walk = walkEvidence(observed, result);
      walks.push(walk);
      for (const plan of walk.plans) {
        appendFileSync(join(out, "plans.jsonl"), `${JSON.stringify(plan)}\n`);
      }
      const failed = walk.plans
        .map((plan) => ({
          failures: planFailures(allowance, plan),
          position: plan.position,
          zone: plan.zone,
        }))
        .filter((plan) => plan.failures.length > 0);
      if (walk.errors.length > 0 || failed.length > 0) {
        keep({ errors: walk.errors, failedPlans: failed });
        stopped = true;
        break;
      }
      console.log(
        JSON.stringify({
          delivered: walk.plans.map((plan) => `${plan.delivered}/${plan.configured}`),
          elapsedMs: Math.round(performance.now() - started),
          peak: walk.plans.map(peakChecks),
          route,
          seed,
          walk: walkNumber,
        }),
      );
    }
    if (stopped) {
      break;
    }
  }
  const plans = walks.flatMap((walk) => walk.plans);
  const summary = {
    commit,
    ...batchVerdict(allowance, walks),
    batchMs: Math.round(performance.now() - batchStarted),
    stopped,
    topSearch: [...plans]
      .sort((a, b) => peakChecks(b) - peakChecks(a))
      .slice(0, 5)
      .map((plan) => ({
        attempts: plan.attempts,
        peak: peakChecks(plan),
        position: plan.position,
        route: plan.route,
        rush: plan.rush,
        seed: plan.seed,
        zone: plan.zone,
      })),
  };
  writeFileSync(join(out, "summary.json"), json(summary));
  const { acceptance, batch, delivery, failedPlans, search } = summary;
  console.log(JSON.stringify({ acceptance, batch, delivery, failedPlans, search }, null, 1));
  for (const zone of summary.coverage) {
    console.log(
      `${zone.zone}: ${zone.complete}/${zone.plans} complete; ${zone.strata
        .map((stratum) => `${stratum.position}/${stratum.mode} ${stratum.plans}`)
        .join(", ")}`,
    );
  }
  return summary.acceptance === "PASS";
}
