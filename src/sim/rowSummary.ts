import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { keysOf } from "@andornaut/game-kit/runtime/records";

import type {
  DebuffId,
  EncounterId,
  GearId,
  MinorObstacleId,
  WalkerId,
  ZoneId,
} from "../data/ids.ts";
import type { AchievementCondition, GameData, TallyId } from "../data/index.ts";
import { type AchievementData, picksOf, type RunFacts } from "../rules/index.ts";
import { blocksLane, isPullObstacle, itemCategory, type WalkItemKind } from "../runner/index.ts";
import { achievementJudge, MAX_RUN_DOGS, TALLY_IDS } from "../save/index.ts";
import { sumDeliveries, type ZoneDelivery } from "./delivery.ts";
import type { MatrixCell, MatrixPlayer } from "./matrix.ts";
import type { PolicyId, RoutePolicyId } from "./policies.ts";
import { mean, percentile } from "./reportStats.ts";
import type { ItemCount, RunResult } from "./simulate.ts";
import {
  type RoadObstacleSummary,
  type SpawnEventSummary,
  type SpawnRunReport,
  sumRoadObstacleEvents,
  sumSpawnEvents,
} from "./spawnReport.ts";

// Earnings are in cents. Shares are from 0 to 1, of the items that reached the pack, and null
// when none did: hitShare of the obstacles that are encounters, but for pull obstacles such as
// squirrels, which touching does nothing to, and bumpShare of minor obstacles, both moving or
// not, luckyShare of lucky encounters collected, kindHitShares of each kind of obstacle that
// does not move, minor or not, and moverHitShares of each obstacle that moves, minor or not,
// both but pull obstacles.
// meanTips counts the tips collected per run, meanDrops the gear drops that reached the pack per
// run and meanGrabs those grabbed. delivery sums every run's zone plans by walk
// position and zone: what they asked for and what they placed, by group and by kind.
export interface MatrixRow extends BadgeCounters {
  readonly requestedRuns: number;
  readonly planningFailedRuns: number;
  // Only completed simulator executions enter gameplay statistics. Empty statistics are
  // non-finite in memory and serialize as null; the text tables render them unavailable.
  readonly gameplayStatus: "measured" | "unavailable";
  readonly spawnRuns: readonly SpawnRunReport[];
  readonly spawnWeightVariation: "not measured";
  readonly spawnSummary: readonly SpawnEventSummary[];
  readonly roadObstacleSummary: readonly RoadObstacleSummary[];
  // Of the obstacle hits, minor ones and movers included, those that came right after a pull.
  readonly afterPullShare: number | null;
  readonly bumpShare: number | null;
  // Each debuff's cost per walk: the landed bumps while it lasted, and the cents it took from
  // tips and bumps (DebuffCost in simulate.ts).
  readonly debuffCosts: Readonly<
    Record<DebuffId, { readonly meanBumpsWhile: number; readonly meanCentsLost: number }>
  >;
  // Each zone's walking by the debuffs on the pack, per walk (ZoneDebuffs in simulate.ts): with
  // none, the landed bumps and walking seconds; for each debuff, the landed bumps while it
  // lasted, the times the pack got it and the walking seconds it lasted.
  readonly debuffsByZone: Readonly<
    Partial<
      Record<
        ZoneId,
        {
          readonly clear: { readonly meanBumps: number; readonly meanSeconds: number };
          readonly debuffs: Readonly<
            Partial<
              Record<
                DebuffId,
                {
                  readonly meanBumpsWhile: number;
                  readonly meanPeriods: number;
                  readonly meanSeconds: number;
                }
              >
            >
          >;
        }
      >
    >
  >;
  readonly delivery: readonly ZoneDelivery[];
  readonly finishedShare: number;
  // The share of walks with at least one firing.
  readonly firedShare: number;
  // The gear equipped, or none.
  readonly gear: string;
  readonly hitShare: number | null;
  readonly kindHitShares: Readonly<Partial<Record<WalkItemKind, number | null>>>;
  readonly luckyShare: number | null;
  // Achievements a run earns on its own facts, per run.
  readonly meanBadges: number;
  readonly meanCardsSeen: number;
  // The cash a walk carried and lost by ending early, in cents per walk; meanEarnings
  // and the percentiles count only what walks banked.
  readonly meanCashLost: number;
  readonly meanDrops: number;
  readonly meanEarnings: number;
  readonly meanFirings: number;
  readonly meanGrabs: number;
  // Spare treats per walk, such as the Fanny pack's (RunState.spareTreats): held when grabbed
  // with every owner at their max, and given back on a heart lost.
  readonly meanSpareTreatsSpent: number;
  readonly meanSpareTreatsStored: number;
  readonly meanTipCents: number;
  readonly meanTips: number;
  readonly meanZones: number;
  // The share of choices that cost money, or null with no choice made.
  readonly moneyShare: number | null;
  readonly moverHitShares: Readonly<Partial<Record<WalkItemKind, number | null>>>;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly pack: string;
  readonly player: string;
  readonly policy: PolicyId;
  // Of the cards chosen, the share the policy fell back on, playing as mixed: for debuffs, those
  // with no safe debuff option, and for noDebuffs, those with no safe option that gives no
  // debuff. null for a policy with no fallback, or with no card chosen.
  readonly policyFallbackShare: number | null;
  readonly route: RoutePolicyId;
  readonly runs: number;
  readonly walker: WalkerId;
}

// The counters the badges read, per walk, each judged by the achievements' own condition.
// Shares are of walks, from 0 to 1.
interface BadgeCounters {
  // Every zone of the walk walked and finished without a landed bump.
  readonly allCleanShare: number;
  // At least one zone walked and finished without a landed bump.
  readonly cleanZoneShare: number;
  // Each debuff: the mean, and the 90th percentile, of the times one walk got it.
  readonly debuffsGot: Readonly<Record<DebuffId, { readonly mean: number; readonly p90: number }>>;
  // A walk finished with every dog of a full pack (MAX_RUN_DOGS) home: the Walk bonus. null for
  // a smaller pack, which never earns it.
  readonly fullPackBonusShare: number | null;
  // A walk finished with a walking owner on their last heart.
  readonly lastHeartShare: number;
  // Landed bumps per walk, by minor obstacle kind.
  readonly meanBumpsByKind: Readonly<Record<MinorObstacleId, number>>;
  // Each card option's picks per walk, by encounter and option id.
  readonly meanOptionPicks: Readonly<
    Partial<Record<EncounterId, Readonly<Record<string, number>>>>
  >;
  // Each lifetime tally's count per walk.
  readonly meanTallies: Readonly<Record<TallyId, number>>;
}

function gearName(gear: GearId | null): string {
  return gear ?? "none";
}

function playerName(player: MatrixPlayer): string {
  return player.preset;
}

// The runs' debuffsByZone as means per walk, over every zone and debuff any run met: a run that
// did not counts 0.
function meanDebuffsByZone(results: readonly RunResult[]): MatrixRow["debuffsByZone"] {
  const zones = [...new Set(results.flatMap((result) => keysOf(result.debuffsByZone)))];
  return Object.fromEntries(
    zones.map((zone) => {
      const runs = results.map((result) => result.debuffsByZone[zone]);
      const debuffs = [...new Set(runs.flatMap((run) => keysOf(run?.debuffs ?? {})))];
      return [
        zone,
        {
          clear: {
            meanBumps: mean(runs.map((run) => run?.clear.bumps ?? 0)),
            meanSeconds: mean(runs.map((run) => run?.clear.seconds ?? 0)),
          },
          debuffs: Object.fromEntries(
            debuffs.map((debuff) => {
              const held = runs.map((run) => run?.debuffs[debuff]);
              return [
                debuff,
                {
                  meanBumpsWhile: mean(held.map((cost) => cost?.bumpsWhile ?? 0)),
                  meanPeriods: mean(held.map((cost) => cost?.periods ?? 0)),
                  meanSeconds: mean(held.map((cost) => cost?.seconds ?? 0)),
                },
              ];
            }),
          ),
        },
      ];
    }),
  );
}

// The badge counters of a cell's walks, from each walk's facts. packSize is the cell's dogs.
export function badgeCounters(
  data: AchievementData & Pick<GameData, "minorObstacles">,
  packSize: number,
  facts: readonly RunFacts[],
): BadgeCounters {
  const judge = achievementJudge(data);
  const share = (condition: AchievementCondition) =>
    mean(facts.map((walk) => (judge.holds("run", { run: walk }, condition) ? 1 : 0)));
  const meanOf = (count: (walk: RunFacts) => number) => mean(facts.map(count));
  const debuffs = keysOf(data.debuffs);
  const kinds = keysOf(data.minorObstacles);
  return {
    allCleanShare: share({ count: "all", kind: "cleanZones" }),
    cleanZoneShare: share({ count: 1, kind: "cleanZones" }),
    debuffsGot: Object.fromEntries(
      debuffs.map((debuff) => {
        const got = facts.map((walk) => walk.debuffsGot[debuff] ?? 0).sort((a, b) => a - b);
        return [debuff, { mean: mean(got), p90: percentile(got, 0.9) }];
      }),
    ) as BadgeCounters["debuffsGot"],
    fullPackBonusShare:
      packSize < MAX_RUN_DOGS ? null : share({ kind: "fullPackBonus", packSize: MAX_RUN_DOGS }),
    lastHeartShare: share({ kind: "finishOnLastHeart" }),
    meanBumpsByKind: Object.fromEntries(
      kinds.map((kind) => [kind, meanOf((walk) => walk.bumpsByKind[kind] ?? 0)]),
    ) as BadgeCounters["meanBumpsByKind"],
    meanOptionPicks: Object.fromEntries(
      keysOf(data.encounters).flatMap((encounter) => {
        const { resolution } = data.encounters[encounter];
        if (resolution.kind !== "card") {
          return [];
        }
        const picks = resolution.options.map(({ id }) => [
          id,
          meanOf((walk) => picksOf(walk.optionPicks, encounter, id)),
        ]);
        return [[encounter, Object.fromEntries(picks)]];
      }),
    ),
    meanTallies: Object.fromEntries(
      TALLY_IDS.map((tally) => [tally, meanOf((walk) => walk.tallies[tally] ?? 0)]),
    ) as BadgeCounters["meanTallies"],
  };
}

// Every obstacle kind, those that open a card first, then the minor ones, but pull obstacles
// such as squirrels, which touching does nothing to: the kinds that block a lane.
export function obstacleKinds(
  data: Pick<GameData, "encounters" | "minorObstacles">,
): WalkItemKind[] {
  const kinds = [
    ...Object.keys(data.encounters),
    ...Object.keys(data.minorObstacles),
  ] as WalkItemKind[];
  return kinds.filter((kind) => blocksLane(data, kind));
}

function touchedShare(counts: readonly ItemCount[]): number | null {
  const met = counts.reduce((sum, count) => sum + count.met, 0);
  return met === 0 ? null : counts.reduce((sum, count) => sum + count.touched, 0) / met;
}

export function summarizeCell(
  data: AchievementData & Pick<GameData, "minorObstacles">,
  cell: MatrixCell,
  attempted: readonly RunResult[],
  seeds: readonly number[],
): MatrixRow {
  if (attempted.length === 0) {
    throw new RangeError("A cell needs at least 1 run");
  }
  const results = attempted.filter((result) => result.planningFailure === undefined);
  const earnings = results.map((result) => result.earnings as number).sort((a, b) => a - b);
  const choices = results.flatMap((result) => result.choices);
  const judged = choices.filter(({ fellBack }) => fellBack !== null);
  // A mover's counts are kept under the kind it meets the pack as, for the shares by category.
  const counted = results.flatMap((result) => [
    ...Object.entries(result.items).map(([kind, count]) => ({
      count,
      kind: kind as WalkItemKind,
      mover: undefined,
    })),
    ...Object.entries(result.movers).map(([mover, count]) => ({
      count,
      kind: mover as WalkItemKind,
      mover: mover as WalkItemKind,
    })),
  ]);
  const countsOf = (keep: (entry: (typeof counted)[number]) => boolean) =>
    counted.filter(keep).map(({ count }) => count);
  const inCategory =
    (category: string) =>
    ({ kind }: (typeof counted)[number]) =>
      itemCategory(data, kind) === category;
  const drops = countsOf(inCategory("gear"));
  const obstacles = obstacleKinds(data);
  const hits = results.reduce((sum, result) => sum + result.hits.all, 0);
  const afterPull = results.reduce((sum, result) => sum + result.hits.afterPull, 0);
  return {
    gameplayStatus: results.length === 0 ? "unavailable" : "measured",
    planningFailedRuns: attempted.length - results.length,
    requestedRuns: attempted.length,
    roadObstacleSummary: sumRoadObstacleEvents(
      data,
      attempted.flatMap((result) => result.spawnEvents ?? []),
    ),
    spawnRuns: attempted.map((result, index) => ({
      failure: result.planningFailure ?? null,
      modifiers: result.run.modifiers,
      partial:
        result.planningFailure === undefined
          ? null
          : {
              cardsSeen: result.cardsSeen,
              choices: result.choices,
              earnings: result.earnings,
              facts: result.facts,
              items: result.items,
              movers: result.movers,
              zones: result.zones,
            },
      route: result.route,
      seed: result.planningFailure?.seed ?? itemAt(seeds, index),
      zoneIndex:
        result.planningFailure === undefined
          ? result.run.zoneIndex
          : result.planningFailure.input.context.zoneIndex,
      zones: result.spawnEvents ?? [],
    })),
    spawnSummary: sumSpawnEvents(
      attempted.flatMap((result) => result.spawnEvents ?? []),
      true,
      results.flatMap((result) => result.spawnEvents ?? []),
    ),
    spawnWeightVariation: "not measured",
    ...badgeCounters(
      data,
      cell.pack.dogs.length,
      results.map((result) => result.facts),
    ),
    afterPullShare: hits === 0 ? null : afterPull / hits,
    bumpShare: touchedShare(countsOf(inCategory("minor"))),
    debuffCosts: Object.fromEntries(
      keysOf(data.debuffs).map((debuff) => [
        debuff,
        {
          meanBumpsWhile: mean(results.map((result) => result.debuffCosts[debuff].bumpsWhile)),
          meanCentsLost: mean(results.map((result) => result.debuffCosts[debuff].centsLost)),
        },
      ]),
    ) as MatrixRow["debuffCosts"],
    debuffsByZone: meanDebuffsByZone(results),
    delivery: sumDeliveries(results.flatMap((result) => result.deliveries)),
    finishedShare: mean(results.map((result) => (result.finished ? 1 : 0))),
    firedShare: mean(results.map((result) => (result.firings.length > 0 ? 1 : 0))),
    gear: gearName(cell.gear),
    hitShare: touchedShare(
      countsOf((entry) => inCategory("obstacle")(entry) && !isPullObstacle(data, entry.kind)),
    ),
    kindHitShares: Object.fromEntries(
      obstacles.map((kind) => [
        kind,
        touchedShare(countsOf((entry) => entry.mover === undefined && entry.kind === kind)),
      ]),
    ),
    luckyShare: touchedShare(countsOf(inCategory("lucky"))),
    meanBadges: mean(results.map((result) => result.badges.length)),
    meanCardsSeen: mean(results.map((result) => result.cardsSeen)),
    meanCashLost: mean(results.map((result) => result.cashLost as number)),
    meanDrops: drops.reduce((sum, count) => sum + count.met, 0) / results.length,
    meanEarnings: mean(earnings),
    meanFirings: mean(results.map((result) => result.firings.length)),
    meanGrabs: drops.reduce((sum, count) => sum + count.touched, 0) / results.length,
    meanSpareTreatsSpent: mean(results.map((result) => result.run.spareTreats.spent)),
    meanSpareTreatsStored: mean(results.map((result) => result.run.spareTreats.stored)),
    meanTipCents: mean(results.map((result) => result.tips as number)),
    meanTips: mean(results.map((result) => result.items.tip?.touched ?? 0)),
    meanZones: mean(results.map((result) => result.zones.length)),
    moneyShare:
      choices.length === 0
        ? null
        : choices.filter((choice) => choice.cost > 0).length / choices.length,
    moverHitShares: Object.fromEntries(
      [...new Set(results.flatMap((result) => keysOf(result.movers)))]
        .filter((mover) => obstacles.includes(mover))
        .sort()
        .map((mover) => [mover, touchedShare(countsOf((entry) => entry.mover === mover))]),
    ),
    p10: percentile(earnings, 0.1),
    p50: percentile(earnings, 0.5),
    p90: percentile(earnings, 0.9),
    pack: cell.pack.name,
    player: playerName(cell.player),
    policy: cell.policy,
    policyFallbackShare:
      judged.length === 0
        ? null
        : judged.filter(({ fellBack }) => fellBack === true).length / judged.length,
    route: cell.route,
    runs: results.length,
    walker: cell.walker,
  };
}
