import {
  type ConditionKind,
  type Judge,
  judge,
  type Progress,
  resolveThreshold,
} from "@andornaut/game-kit/runtime/achievements";

import type { MinorObstacleId } from "../data/ids.ts";
import type { AchievementCondition } from "../data/index.ts";
import {
  type AchievementData,
  picksOf,
  type RunFacts,
  thresholdWholes,
  walkLength,
} from "../rules/index.ts";
import { dollarsToCents } from "../units.ts";
import type { SaveDocument, SaveStats } from "./schema.ts";
import { lifetimeEarnedNet, timesFired, walksFinished, walksPlayed } from "./stats.ts";

// A money goal counts what the walk banked net of its starting money.
function earnedNet(facts: RunFacts): number {
  return facts.earnedCents - facts.startCents;
}

// The zones a run finished that it walked, leaving out those before a cheat start's first.
function zonesWalked(facts: RunFacts): number {
  return Math.max(0, facts.zonesFinished - facts.firstZone);
}

// Whether the walk was finished: its last zone finished, from whichever zone it began in.
function finishedWalk(facts: RunFacts, zones: number): boolean {
  return facts.zonesFinished >= zones;
}

function cleanZones(facts: RunFacts): number {
  let clean = 0;
  for (let zone = facts.firstZone; zone < facts.zonesFinished; zone++) {
    if ((facts.bumpsByZone[zone] ?? 0) === 0) {
      clean += 1;
    }
  }
  return clean;
}

// The landed plain hits across walks by an obstacle of any of kinds.
function landedBumps(
  stats: Pick<SaveStats, "bumpsByKind">,
  kinds: readonly MinorObstacleId[],
): number {
  return kinds.reduce((total, kind) => total + (stats.bumpsByKind[kind] ?? 0), 0);
}

// The owners who have fired you at least once. Each dog has an owner of its own.
function firedByOwners(stats: Pick<SaveStats, "dogs">): number {
  return Object.values(stats.dogs).filter((dog) => dog.timesFired > 0).length;
}

// Where badges are judged. bank: a run as it is banked, on the save after it and the run's
// facts. profile: on launch and after a purchase, on the save alone. run: one run's facts alone,
// which the simulator counts. Run conditions hold only with a run's facts, and the conditions on
// the save (what it owns, and what it counts across walks) only with a save.
export type AchievementScope = "bank" | "profile" | "run";

// What a badge is judged on: the run's facts at bank and run, and the save at bank and profile.
export interface AchievementFacts {
  readonly run?: RunFacts;
  readonly save?: Pick<SaveDocument, "owned" | "stats">;
}

export type AchievementJudge = Judge<AchievementCondition, AchievementScope, AchievementFacts>;

type Kind<Cond> = ConditionKind<Cond, AchievementScope, AchievementFacts>;

const RUN_SCOPES: readonly AchievementScope[] = ["bank", "run"];
const SAVE_SCOPES: readonly AchievementScope[] = ["bank", "profile"];

// Its scopes always pass the facts a kind reads, so a missing one is a programming error.
function present<T>(what: string, value: T | undefined): T {
  if (value === undefined) {
    throw new Error(`A badge condition is judged without ${what}`);
  }
  return value;
}

// A condition on one run's facts.
function onRun<Cond>(holds: (facts: RunFacts, condition: Cond) => boolean): Kind<Cond> {
  return {
    holds: (facts, condition) => holds(present("a run", facts.run), condition),
    scopes: RUN_SCOPES,
  };
}

// A condition on what the save owns.
function onOwned<Cond>(
  holds: (owned: SaveDocument["owned"], condition: Cond) => boolean,
): Kind<Cond> {
  return {
    holds: (facts, condition) => holds(present("a save", facts.save).owned, condition),
    scopes: SAVE_SCOPES,
  };
}

// A condition counted across walks, which holds once its progress is complete.
function acrossWalks<Cond>(count: (stats: SaveStats, condition: Cond) => Progress): Kind<Cond> {
  const progress = (facts: AchievementFacts, condition: Cond) =>
    count(present("a save", facts.save).stats, condition);
  return {
    holds: (facts, condition) => {
      const { have, need } = progress(facts, condition);
      return have >= need;
    },
    progress,
    scopes: SAVE_SCOPES,
  };
}

// The judge of every condition kind. The counts across walks are a lifetime tally, option
// picks, landed bumps, whole dollars earned net of starting cash, walks played or finished,
// times fired, the current streak of finished walks with no firing, distinct owners who fired
// you, distinct dogs and walkers that finished a walk, and distinct zones finished; only they
// report progress.
export function achievementJudge(data: AchievementData): AchievementJudge {
  const zones = walkLength(data);
  const wholes = thresholdWholes(data);
  return judge<AchievementCondition, AchievementScope, AchievementFacts>({
    bumps: acrossWalks((stats, { count, kinds }) => ({
      have: landedBumps(stats, kinds),
      need: count,
    })),
    cleanZones: onRun(
      (facts, { count }) => cleanZones(facts) >= resolveThreshold(wholes.cleanZones, count),
    ),
    debuffsGot: onRun((facts, { count, debuff }) => (facts.debuffsGot[debuff] ?? 0) >= count),
    dogsFinishedWith: acrossWalks((stats, { count }) => ({
      have: stats.dogsFinishedWith.length,
      need: resolveThreshold(wholes.dogsFinishedWith, count),
    })),
    dogsOwned: onOwned(
      (owned, { count }) => owned.dogs.length >= resolveThreshold(wholes.dogsOwned, count),
    ),
    earnings: onRun((facts, { dollars }) => earnedNet(facts) >= dollarsToCents(dollars)),
    finishOnLastHeart: onRun((facts) => finishedWalk(facts, zones) && facts.lastHeartOwners > 0),
    firedByOwners: acrossWalks((stats, { count }) => ({
      have: firedByOwners(stats),
      need: resolveThreshold(wholes.firedByOwners, count),
    })),
    fullPackBonus: onRun(
      (facts, { packSize }) =>
        finishedWalk(facts, zones) &&
        facts.dogsHome === facts.packSize &&
        facts.packSize >= packSize,
    ),
    gearOwned: onOwned(
      (owned, { count }) => owned.gear.length >= resolveThreshold(wholes.gearOwned, count),
    ),
    lifetimeEarnings: acrossWalks((stats, { dollars }) => ({
      have: Math.max(0, Math.floor(lifetimeEarnedNet(stats) / dollarsToCents(1))),
      need: dollars,
    })),
    noFiringStreak: acrossWalks((stats, { count }) => ({
      have: stats.noFiringStreak,
      need: count,
    })),
    optionPicks: acrossWalks((stats, { count, encounter, option }) => ({
      have: picksOf(stats.optionPicks, encounter, option),
      need: count,
    })),
    packSize: onRun((facts, { count }) => facts.packSize >= count),
    tally: acrossWalks((stats, { count, tally }) => ({
      have: stats.tallies[tally] ?? 0,
      need: count,
    })),
    timesFired: acrossWalks((stats, { count }) => ({ have: timesFired(stats), need: count })),
    walkersFinishedWith: acrossWalks((stats, { count }) => ({
      have: stats.walkersFinishedWith.length,
      need: resolveThreshold(wholes.walkersFinishedWith, count),
    })),
    walkersUnlocked: onOwned(
      (owned, { count }) => owned.walkers.length >= resolveThreshold(wholes.walkersUnlocked, count),
    ),
    walksFinished: acrossWalks((stats, { count }) => ({
      have: walksFinished(stats),
      need: count,
    })),
    walksPlayed: acrossWalks((stats, { count }) => ({ have: walksPlayed(stats), need: count })),
    zonesEverFinished: acrossWalks((stats, { count }) => ({
      have: stats.zonesEverFinished.length,
      need: resolveThreshold(wholes.zonesEverFinished, count),
    })),
    zonesFinished: onRun(
      (facts, { count }) => zonesWalked(facts) >= resolveThreshold(wholes.zonesFinished, count),
    ),
  });
}
