import { randomStream } from "@andornaut/game-kit/random";

import { type DrawnMover, type PlannerStreams, sameMoverMotion } from "./moverPlanning";
import type { MoverPath } from "./movers";
import { type AdmissionReport, SpawnCapacityError } from "./spawnAdmission";
import type { PlannedSpawns, SpawnPlan } from "./spawning";

export interface SpawnSearchContext {
  readonly seed: number;
  readonly zoneIndex: number;
}

// JSON canonicalizes signed zero; null maxEmptyRows represents an unbounded empty-row limit.
export interface SpawnPlanSnapshot<Kind extends string = string> {
  readonly context: SpawnSearchContext;
  readonly draws: { readonly movers: readonly number[]; readonly spawns: readonly number[] };
  readonly plan: Omit<SpawnPlan<Kind>, "maxEmptyRows"> & { readonly maxEmptyRows: number | null };
}

export class SpawnPlanningError extends Error {
  constructor(
    message: string,
    readonly snapshot: SpawnPlanSnapshot,
  ) {
    super(message);
    this.name = "SpawnPlanningError";
  }
}

export interface SpawnConstruction {
  readonly admitted: readonly boolean[][];
  // Original quota index, then member index: reorderings never change request identity.
  readonly drawn: readonly DrawnMover[][];
  readonly exact: boolean;
  readonly incumbent?: PlannedSpawns<string>;
  readonly motion?: readonly (readonly (MoverPath | undefined)[])[];
  readonly partial?: true;
  readonly order: "constrained-first" | "original" | "requested-row";
}

type Strategy = "constrained-first" | "guarded-requested-row" | "original";

export interface MissingSpawn<Kind extends string> {
  readonly count: number;
  readonly kind: Kind;
  readonly movement: AdmissionReport<Kind>["counts"][number]["movement"];
  readonly requests: readonly { readonly memberIndex: number; readonly quotaIndex: number }[];
  // Observations for this kind's candidates, not a proof of why no arrangement exists.
  readonly observedRejections: AdmissionReport<Kind>["rejections"];
}

interface SearchAttempt<Kind extends string> {
  readonly admission: AdmissionReport<Kind>;
  readonly missing: readonly MissingSpawn<Kind>[];
  readonly strategy: Strategy;
}

export type ConstructiveSpawnResult<Kind extends string> =
  | {
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly planned: PlannedSpawns<Kind>;
      readonly snapshot: SpawnPlanSnapshot<Kind>;
      readonly status: "complete";
      readonly strategy: Strategy;
    }
  | {
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly missing: readonly MissingSpawn<Kind>[];
      readonly planned: PlannedSpawns<Kind>;
      readonly reason: string;
      readonly snapshot: SpawnPlanSnapshot<Kind>;
      readonly status: "partial";
      readonly strategy: Strategy;
    }
  | {
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly reason: string;
      readonly status: "capacity-impossible";
      readonly snapshot: SpawnPlanSnapshot<Kind>;
    }
  | {
      readonly admission: AdmissionReport<Kind>;
      readonly attempts: readonly SearchAttempt<Kind>[];
      readonly missing: readonly MissingSpawn<Kind>[];
      readonly reason: string;
      readonly status: "planner-unable";
      readonly snapshot: SpawnPlanSnapshot<Kind>;
    };

function missingFrom<Kind extends string>(
  construction: SpawnConstruction,
  plan: SpawnPlan<Kind>,
  admission: AdmissionReport<Kind>,
): MissingSpawn<Kind>[] {
  const missing: {
    count: number;
    kind: Kind;
    movement: MissingSpawn<Kind>["movement"];
    observedRejections: MissingSpawn<Kind>["observedRejections"];
    requests: { memberIndex: number; quotaIndex: number }[];
  }[] = [];
  plan.quotas.forEach((quota, quotaIndex) => {
    const movement = quota.mover?.movement ?? null;
    for (let memberIndex = 0; memberIndex < quota.count; memberIndex++) {
      if (construction.admitted[quotaIndex]?.[memberIndex] === true) {
        continue;
      }
      let group = missing.find((group) => group.kind === quota.kind && group.movement === movement);
      if (group === undefined) {
        group = {
          count: 0,
          kind: quota.kind,
          movement,
          observedRejections: admission.rejections.filter(
            (rejection) => rejection.kind === quota.kind,
          ),
          requests: [],
        };
        missing.push(group);
      }
      group.count += 1;
      group.requests.push({ memberIndex, quotaIndex });
    }
  });
  return missing;
}

function emittedWithinQuotas<Kind extends string>(
  plan: SpawnPlan<Kind>,
  planned: PlannedSpawns<Kind>,
): boolean {
  const counts = new Map<string, number>();
  const key = (kind: Kind, movement: string | null) => JSON.stringify([kind, movement]);
  for (const quota of plan.quotas) {
    const id = key(quota.kind, quota.mover?.movement ?? null);
    counts.set(id, (counts.get(id) ?? 0) + quota.count);
  }
  for (const event of [...planned.events, ...planned.herrings]) {
    const id = key(event.kind, event.mover?.movement ?? null);
    const remaining = counts.get(id) ?? 0;
    if (remaining === 0) {
      return false;
    }
    counts.set(id, remaining - 1);
  }
  return true;
}

function emittedRequestsMatch<Kind extends string>(
  plan: SpawnPlan<Kind>,
  planned: PlannedSpawns<Kind>,
): boolean {
  if (planned.visibility.length !== planned.events.length + planned.herrings.length) {
    return false;
  }
  const used = new Set<string>();
  return planned.visibility.every((trace) => {
    if (trace.quotaIndex === undefined || trace.memberIndex === undefined) {
      return false;
    }
    const quota = plan.quotas[trace.quotaIndex];
    const event = planned[trace.source][trace.index];
    const key = `${trace.quotaIndex}:${trace.memberIndex}`;
    if (
      quota === undefined ||
      event === undefined ||
      used.has(key) ||
      trace.memberIndex < 0 ||
      trace.memberIndex >= quota.count ||
      event.kind !== quota.kind ||
      trace.entry !== event.distance ||
      trace.lane !== event.lane ||
      (event.mover?.movement ?? null) !== (quota.mover?.movement ?? null)
    ) {
      return false;
    }
    used.add(key);
    return true;
  });
}

function withPlacementReport<Kind extends string>(
  requested: number,
  missing: readonly MissingSpawn<Kind>[],
  planned: PlannedSpawns<Kind>,
): PlannedSpawns<Kind> {
  const placed = planned.events.length + planned.herrings.length;
  return {
    ...planned,
    admission: {
      ...planned.admission,
      placement: {
        missing: missing.map(({ count, kind, movement, observedRejections }) => ({
          count,
          kind,
          movement,
          reasons: observedRejections.map(({ reason }) => reason),
        })),
        placed,
        ratio: requested === 0 ? 1 : placed / requested,
        requested,
      },
    },
  };
}

function incumbentMotion(
  planned: PlannedSpawns<string> | undefined,
  quotaCount: number,
): (MoverPath | undefined)[][] {
  const motion = Array.from({ length: quotaCount }, (): (MoverPath | undefined)[] => []);
  for (const trace of planned?.visibility ?? []) {
    if (trace.quotaIndex !== undefined && trace.memberIndex !== undefined) {
      motion[trace.quotaIndex]![trace.memberIndex] = planned![trace.source][trace.index]?.mover;
    }
  }
  return motion;
}

function preservesIncumbent(
  incumbent: PlannedSpawns<string>,
  planned: PlannedSpawns<string>,
): boolean {
  const entries = new Map(
    planned.visibility.map((trace) => [
      `${trace.quotaIndex}:${trace.memberIndex}`,
      planned[trace.source][trace.index],
    ]),
  );
  return incumbent.visibility.every((trace) => {
    const prior = incumbent[trace.source][trace.index];
    const current = entries.get(`${trace.quotaIndex}:${trace.memberIndex}`);
    return (
      prior !== undefined &&
      current !== undefined &&
      prior.kind === current.kind &&
      (prior.mover === undefined
        ? current.mover === undefined
        : current.mover !== undefined && sameMoverMotion(prior.mover, current.mover))
    );
  });
}

// A finite construction portfolio, not a seed sweep or an empirical capacity threshold. The
// baseline keeps normal draws and choices; repairs reuse its requested movers and draw only
// layout choices from isolated streams. A complete baseline returns without a repair.
export function searchSpawnAdmission<Kind extends string>(
  attempt: (construction: SpawnConstruction, streams: PlannerStreams) => PlannedSpawns<Kind>,
  context: SpawnSearchContext,
  streams: PlannerStreams,
  plan: SpawnPlan<Kind>,
): ConstructiveSpawnResult<Kind> {
  const sourceDraws = { movers: [] as number[], spawns: [] as number[] };
  const recording = (source: keyof PlannerStreams) => () => {
    const value = streams[source]();
    sourceDraws[source].push(value);
    return value;
  };
  const original = { movers: recording("movers"), spawns: recording("spawns") };
  const snapshot = {
    context: { seed: context.seed, zoneIndex: context.zoneIndex },
    draws: sourceDraws,
    plan: { ...plan, maxEmptyRows: Number.isFinite(plan.maxEmptyRows) ? plan.maxEmptyRows : null },
  };
  const drawn = plan.quotas.map((): DrawnMover[] => []);
  const attempts: SearchAttempt<Kind>[] = [];
  let best: SearchAttempt<Kind> | undefined;
  let bestValid: (SearchAttempt<Kind> & { readonly planned: PlannedSpawns<Kind> }) | undefined;
  const requested = plan.quotas.reduce((sum, quota) => sum + quota.count, 0);
  const missingTotal = (items: readonly MissingSpawn<Kind>[]) =>
    items.reduce((sum, item) => sum + item.count, 0);
  try {
    for (const strategy of ["original", "constrained-first", "guarded-requested-row"] as const) {
      const repair = strategy !== "original";
      if (repair) {
        plan.quotas.forEach((quota, index) => {
          if (quota.mover !== undefined && drawn[index]?.length !== quota.count) {
            throw new Error(`Missing frozen mover requests for quota ${index}`);
          }
        });
      }
      const layout = repair
        ? {
            movers: randomStream(context.seed, `repair-movers-${context.zoneIndex}-${strategy}`),
            spawns: randomStream(context.seed, `repair-spawns-${context.zoneIndex}-${strategy}`),
          }
        : original;
      const incumbent = strategy === "guarded-requested-row" ? bestValid?.planned : undefined;
      const construction: SpawnConstruction = {
        admitted: plan.quotas.map(() => []),
        drawn,
        exact: repair,
        ...(incumbent === undefined ? {} : { incumbent }),
        motion: incumbentMotion(incumbent, plan.quotas.length),
        order: strategy === "guarded-requested-row" ? "requested-row" : strategy,
        partial: true,
      };
      const planned = attempt(construction, layout);
      const missing = missingFrom(construction, plan, planned.admission);
      const report = { admission: planned.admission, missing, strategy };
      attempts.push(report);
      const validKinds =
        planned.admission.substitutions.length === 0 &&
        emittedWithinQuotas(plan, planned) &&
        planned.events.length + planned.herrings.length + missingTotal(missing) === requested &&
        emittedRequestsMatch(plan, planned) &&
        (incumbent === undefined || preservesIncumbent(incumbent, planned));
      if (
        missing.length === 0 &&
        validKinds &&
        planned.events.length + planned.herrings.length === requested
      ) {
        return {
          attempts,
          planned: withPlacementReport(requested, missing, planned),
          snapshot,
          status: "complete",
          strategy,
        };
      }
      if (
        validKinds &&
        (bestValid === undefined ||
          planned.events.length + planned.herrings.length >
            bestValid.planned.events.length + bestValid.planned.herrings.length)
      ) {
        bestValid = { ...report, planned };
      }
      if (best === undefined || missingTotal(missing) < missingTotal(best.missing)) {
        best = report;
      }
    }
  } catch (error) {
    if (!(error instanceof SpawnCapacityError)) {
      throw error;
    }
    return { attempts, reason: error.message, snapshot, status: "capacity-impossible" };
  }
  if (
    bestValid !== undefined &&
    (bestValid.planned.events.length + bestValid.planned.herrings.length) * 5 >= requested * 4
  ) {
    return {
      attempts,
      missing: bestValid.missing,
      planned: withPlacementReport(requested, bestValid.missing, bestValid.planned),
      reason: `Partial admission: ${bestValid.missing
        .map(({ count, kind, movement }) => `${count} ${kind} (${movement ?? "standing"})`)
        .join(", ")}`,
      snapshot,
      status: "partial",
      strategy: bestValid.strategy,
    };
  }
  if (best === undefined) {
    throw new Error("No spawn construction attempted");
  }
  const descriptions = best.missing.map(({ count, kind, movement, observedRejections }) => {
    const reasons =
      observedRejections.map(({ reason }) => reason).join(", ") || "no legal candidate";
    return `${count} ${kind} (${movement ?? "standing"}; ${reasons})`;
  });
  return {
    admission: best.admission,
    attempts,
    missing: best.missing,
    reason: `Planner unable after ${attempts.length} constructions: ${descriptions.join(", ")}`,
    snapshot,
    status: "planner-unable",
  };
}
