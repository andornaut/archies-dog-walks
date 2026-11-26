import { weightedPick } from "@andornaut/game-kit/runtime/random";

import {
  type PreparedSlotKind,
  prepareSlotKindWithin,
  SlotProfileError,
} from "./slotCandidates.ts";
import type { SlotFailure, SlotLimits, SlotSource } from "./slotConfig.ts";
import { slotMotionStreams } from "./slotEntropy.ts";
import type { SlotJob } from "./slotJobs.ts";
import type { SlotPlanningContext, SlotPlanningFailure } from "./slotPlanner.ts";
import type { WitnessJob } from "./slotWitnessSearch.ts";
import type { SpawnPlan } from "./spawning.ts";

export function createSlotPreparationCache<Kind extends string>(
  limits: SlotLimits,
  context: SlotPlanningContext,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  stats: { compiledTemplates: number; profileCompiles: number },
  stopped: () => boolean,
  fail: (stage: SlotPlanningFailure<Kind>["stage"], failure: SlotFailure<Kind>) => void,
) {
  const preparedCache = new Map<string, PreparedSlotKind<Kind>>();
  const prepareSource = (
    job: SlotJob<Kind>,
    source: SlotSource<Kind>,
  ): PreparedSlotKind<Kind> | undefined => {
    if (stopped()) {
      return undefined;
    }
    const key = `${job.key}:${source.kind}`;
    const cached = preparedCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (stats.compiledTemplates >= limits.compiledTemplates) {
      fail("construction", {
        available: limits.compiledTemplates,
        code: "template-budget",
        kind: source.kind,
        role: job.role,
      });
      return undefined;
    }
    try {
      const before = stats.compiledTemplates;
      stats.profileCompiles++;
      const prepared = prepareSlotKindWithin(
        {
          template() {
            if (stats.compiledTemplates >= limits.compiledTemplates) {
              return false;
            }
            stats.compiledTemplates++;
            return true;
          },
        },
        slotMotionStreams(context, job.key, source.kind),
        geometry,
        source,
      );
      if (prepared.status === "budget") {
        fail("construction", {
          available: limits.compiledTemplates,
          code: "template-budget",
          kind: source.kind,
          role: job.role,
        });
        return undefined;
      }
      const option = prepared.prepared;
      if (
        stats.compiledTemplates > limits.compiledTemplates ||
        stats.compiledTemplates - before !== option.compiledCount
      ) {
        fail("invariant", { code: "template-accounting" });
        return undefined;
      }
      preparedCache.set(key, option);
      return option;
    } catch (error) {
      if (!(error instanceof SlotProfileError)) {
        throw error;
      }
      fail("configuration", { code: "invalid-profile", kind: source.kind, role: job.role });
      return undefined;
    }
  };

  return { cachedPreparations: () => preparedCache.values(), prepareSource };
}

export function createSlotWitnessJobs<Kind extends string>(
  fork: (name: string) => () => number,
  stopped: () => boolean,
  prepareSource: (
    job: SlotJob<Kind>,
    source: SlotSource<Kind>,
  ) => PreparedSlotKind<Kind> | undefined,
  originalJobs: readonly SlotJob<Kind>[],
): WitnessJob<Kind>[] {
  const layouts = new Map<string, number>();
  const sourceOrders = new Map<SlotJob<Kind>, readonly SlotSource<Kind>[]>();
  const orderSources = (job: SlotJob<Kind>) => {
    let ordered = sourceOrders.get(job);
    if (ordered === undefined) {
      const remaining = [...job.sources];
      const values: SlotSource<Kind>[] = [];
      const draw = fork(`${job.key}-source-order`);
      while (remaining.length > 0) {
        const selected = weightedPick(
          draw,
          remaining,
          remaining.map((source) => source.weight),
        );
        values.push(selected);
        remaining.splice(remaining.indexOf(selected), 1);
      }
      ordered = Object.freeze(values);
      sourceOrders.set(job, ordered);
    }
    return ordered;
  };
  return originalJobs.map((job) => ({
    columnPick: () => {
      let draw = layouts.get(job.key);
      if (draw === undefined) {
        draw = fork(`${job.key}-layout`)();
        layouts.set(job.key, draw);
      }
      return draw;
    },
    fixed: job.role === "encounterFixed" || job.role === "minorFixed",
    guaranteed: job.guaranteed === true,
    key: job.key,
    laneEffect: job.laneEffect,
    ...(job.guaranteed ? {} : { optional: true as const }),
    ordinal: job.ordinal,
    phase: job.phase,
    *preparations() {
      if (stopped()) {
        return;
      }
      for (const source of orderSources(job)) {
        const prepared = prepareSource(job, source);
        if (prepared === undefined) {
          return;
        }
        yield prepared;
      }
    },
    total: job.total,
  }));
}
