import {
  type ConditionKind,
  type Judge,
  judge,
  type Progress,
  resolveThreshold,
} from "@andornaut/game-kit/achievements";
import { assertNever } from "@andornaut/game-kit/assertNever";

import type {
  Achievement,
  AchievementCondition,
  DebuffId,
  EncounterId,
  GameData,
  MinorObstacleId,
  OptionPicks,
  TallyId,
  Threshold,
} from "../data/types.ts";
import { minorObstacleNames } from "../runner/obstacleLooks.ts";
import type { SaveDocument, SaveStats } from "../save/schema.ts";
import { lifetimeEarnedNet, timesFired, walksFinished, walksPlayed } from "../save/stats.ts";
import type { RunState } from "../state/runState.ts";
import { type Cents, dollarsToCents } from "../units.ts";
import { walkLength } from "./route.ts";

export type AchievementData = Pick<
  GameData,
  "achievements" | "debuffs" | "dogs" | "encounters" | "shopGear" | "walkers" | "world"
>;

// The counters a run keeps for its achievements, copied out of the run state for the save.
// Zones before firstZone were skipped by a dev start: they are neither finished nor clean.
// startCents is the money the run began with, which a money goal leaves out. bumpsByKind,
// optionPicks and tallies are this run's share of the lifetime ones.
export interface RunCounters {
  bumpsByKind: Partial<Record<MinorObstacleId, number>>;
  bumpsByZone: number[];
  debuffsGot: Partial<Record<DebuffId, number>>;
  firstZone: number;
  optionPicks: OptionPicks;
  startCents: Cents;
  tallies: Partial<Record<TallyId, number>>;
}

// What the run conditions judge: the run's counters, what it banked (starting money
// included), how many dogs set out and got home unfired, how many walking owners ended it on
// their last heart, and how many zones it finished.
export interface RunFacts extends RunCounters {
  readonly dogsHome: number;
  readonly earnedCents: Cents;
  readonly lastHeartOwners: number;
  readonly packSize: number;
  readonly zonesFinished: number;
}

export function runCountersOf(
  run: Pick<
    RunState,
    | "bumpsByKind"
    | "bumpsByZone"
    | "debuffsGot"
    | "firstZone"
    | "optionPicks"
    | "startMoney"
    | "tallies"
  >,
): RunCounters {
  const { bumpsByKind, bumpsByZone, debuffsGot, firstZone, optionPicks, startMoney, tallies } = run;
  return {
    bumpsByKind: { ...bumpsByKind },
    bumpsByZone: [...bumpsByZone],
    debuffsGot: { ...debuffsGot },
    firstZone,
    optionPicks: { ...optionPicks },
    startCents: startMoney,
    tallies: { ...tallies },
  };
}

// How many walking owners are on their last heart.
export function lastHeartOwnersOf(run: Pick<RunState, "pack">): number {
  return run.pack.filter((slot) => slot.status === "walking" && slot.hearts === 1).length;
}

// A money goal counts what the walk banked net of its starting money.
function earnedNet(facts: RunFacts): number {
  return facts.earnedCents - facts.startCents;
}

// Whether achievement is a money goal, one walk's or every walk's, which is checked only when
// the walk is banked.
export function isMoneyGoal(achievement: Pick<Achievement, "conditions">): boolean {
  return achievement.conditions.some(isMoneyCondition);
}

// Whether condition counts dollars earned, in one walk or every walk.
export function isMoneyCondition(condition: AchievementCondition): boolean {
  return condition.kind === "earnings" || condition.kind === "lifetimeEarnings";
}

// Whether a run walked every zone up to the ones it finished: a dev start did not skip any.
export function walkedFromTheStart(counters: Pick<RunCounters, "firstZone">): boolean {
  return counters.firstZone === 0;
}

// The zones a run finished that it walked, leaving out those a dev start skipped.
function zonesWalked(facts: RunFacts): number {
  return Math.max(0, facts.zonesFinished - facts.firstZone);
}

// A plain hit landed in the current zone; a dodge or a card obstacle does not count.
export function countBump(state: RunState): RunState {
  const bumpsByZone = [...state.bumpsByZone];
  while (bumpsByZone.length <= state.zoneIndex) {
    bumpsByZone.push(0);
  }
  bumpsByZone[state.zoneIndex] = (bumpsByZone[state.zoneIndex] ?? 0) + 1;
  return { ...state, bumpsByZone };
}

// A plain hit by an obstacle of kind that landed, forgiven or not, counted in the run until it
// is banked. A dodged hit never lands.
export function countLandedBump(kind: MinorObstacleId, state: RunState): RunState {
  return {
    ...state,
    bumpsByKind: { ...state.bumpsByKind, [kind]: (state.bumpsByKind[kind] ?? 0) + 1 },
  };
}

// One more toward a lifetime tally, counted in the run until it is banked.
export function countTally(tally: TallyId, state: RunState): RunState {
  return { ...state, tallies: { ...state.tallies, [tally]: (state.tallies[tally] ?? 0) + 1 } };
}

// How many times picks counts the option with id option on encounter's card.
export function picksOf(picks: OptionPicks, encounter: EncounterId, option: string): number {
  return picks[encounter]?.[option] ?? 0;
}

// One more pick of the option with id option on encounter's card, counted in the run until it
// is banked.
export function countOptionPick(encounter: EncounterId, option: string, state: RunState): RunState {
  const picks = state.optionPicks[encounter] ?? {};
  return {
    ...state,
    optionPicks: {
      ...state.optionPicks,
      [encounter]: { ...picks, [option]: picksOf(state.optionPicks, encounter, option) + 1 },
    },
  };
}

// Whether the walk was finished: every zone of it walked, none skipped by a dev start.
function finishedWalk(facts: RunFacts, zones: number): boolean {
  return walkedFromTheStart(facts) && facts.zonesFinished >= zones;
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

// The condition kinds whose count may be "all", each of which counts toward a whole.
type ThresholdCondition = AllCount<AchievementCondition>;
type AllCount<C> = C extends { readonly count: infer N } ? ("all" extends N ? C : never) : never;

// The whole an "all" threshold of each kind counts: the zones of a walk, every dog (or its
// owner), gear item, walker or zone of the city.
function thresholdWholes(data: AchievementData): Record<ThresholdCondition["kind"], number> {
  const zones = walkLength(data);
  const dogs = Object.keys(data.dogs).length;
  const walkers = Object.keys(data.walkers).length;
  return {
    cleanZones: zones,
    dogsFinishedWith: dogs,
    dogsOwned: dogs,
    firedByOwners: dogs,
    gearOwned: Object.keys(data.shopGear).length,
    walkersFinishedWith: walkers,
    walkersUnlocked: walkers,
    zonesEverFinished: data.world.zones.length,
    zonesFinished: zones,
  };
}

// What condition needs: its dollars, pack size or count, "all" resolved to its whole; null for
// a condition with no number.
export function conditionTarget(
  data: AchievementData,
  condition: AchievementCondition,
): number | null {
  switch (condition.kind) {
    case "earnings":
    case "lifetimeEarnings":
      return condition.dollars;
    case "finishOnLastHeart":
      return null;
    case "fullPackBonus":
      return condition.packSize;
    case "cleanZones":
    case "dogsFinishedWith":
    case "dogsOwned":
    case "firedByOwners":
    case "gearOwned":
    case "walkersFinishedWith":
    case "walkersUnlocked":
    case "zonesEverFinished":
    case "zonesFinished":
      return resolveThreshold(thresholdWholes(data)[condition.kind], condition.count);
    default:
      return condition.count;
  }
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

// A badge's name with its tier, as a celebration and the message strip name it.
export function achievementLabel(
  data: Pick<GameData, "menuText">,
  achievement: Pick<Achievement, "name" | "tier">,
): string {
  return `${achievement.name} (${data.menuText.stats.badgeDifficulty[achievement.tier]})`;
}

// Each tally in plain words, for the data page.
const TALLY_NAMES: Readonly<Record<TallyId, string>> = {
  dodges: "dodges by any dog",
  neighboursMet: "friendly neighbours met",
  squirrelPulls: "squirrel pulls landed",
  tips: "tips grabbed",
  treats: "treats grabbed",
  walletsFound: "lost wallets found",
};

function thresholdText(threshold: Threshold, unit: string): string {
  return threshold === "all" ? `all ${unit}` : `${threshold} ${unit}`;
}

// The name of the option with id option on encounter's card. Throws for an option the card
// does not have.
function optionName(
  data: Pick<GameData, "encounters">,
  encounter: EncounterId,
  option: string,
): string {
  const { name, resolution } = data.encounters[encounter];
  const found =
    resolution.kind === "card" ? resolution.options.find(({ id }) => id === option) : undefined;
  if (found === undefined) {
    throw new Error(`${name} has no card option ${option}`);
  }
  return found.name;
}

// A condition in plain words, for the data page.
export function achievementConditionText(
  data: Pick<GameData, "debuffs" | "encounters" | "minorObstacles">,
  condition: AchievementCondition,
): string {
  switch (condition.kind) {
    case "bumps": {
      const names = condition.kinds
        .flatMap((kind) => minorObstacleNames(data, kind))
        .map((name) => name.toLowerCase());
      return `${condition.count} landed bumps in total, by any of: ${names.join(", ")}`;
    }
    case "cleanZones":
      return `${thresholdText(condition.count, "neighbourhoods")} of a walk finished without a bump`;
    case "debuffsGot":
      return `${data.debuffs[condition.debuff].name} ${condition.count} times in one walk`;
    case "dogsFinishedWith":
      return `${thresholdText(condition.count, "dogs")} each finished a walk without firing you`;
    case "dogsOwned":
      return `own ${thresholdText(condition.count, "dogs")}`;
    case "earnings":
      return `bank $${condition.dollars} in one walk, net of starting cash`;
    case "finishOnLastHeart":
      return "finish a walk with a walking owner on their last heart";
    case "firedByOwners":
      return `fired by ${thresholdText(condition.count, "owners")}, each at least once`;
    case "fullPackBonus":
      return `finish a walk with every dog of a pack of ${condition.packSize} or more home`;
    case "gearOwned":
      return `own ${thresholdText(condition.count, "gear items")}`;
    case "lifetimeEarnings":
      return `bank $${condition.dollars} in total, net of starting cash`;
    case "noFiringStreak":
      return (
        `${condition.count} finished walks in a row with no firing; ` +
        "heading home early neither counts nor breaks the streak"
      );
    case "optionPicks": {
      const { name } = data.encounters[condition.encounter];
      const option = optionName(data, condition.encounter, condition.option);
      return `${option} picked ${condition.count} times in total, on the ${name.toLowerCase()} card`;
    }
    case "packSize":
      return `start a walk with ${condition.count} dogs`;
    case "tally":
      return `${condition.count} ${TALLY_NAMES[condition.tally]} in total`;
    case "timesFired":
      return `fired ${condition.count} times in total`;
    case "walkersFinishedWith":
      return `${thresholdText(condition.count, "walkers")} each finished a walk`;
    case "walkersUnlocked":
      return `unlock ${thresholdText(condition.count, "walkers")}`;
    case "walksFinished":
      return `${condition.count} walks finished, every neighbourhood of each walked`;
    case "walksPlayed":
      return `${condition.count} walks played`;
    case "zonesEverFinished":
      return `${thresholdText(condition.count, "neighbourhoods")} each finished, across walks`;
    case "zonesFinished":
      return `${thresholdText(condition.count, "neighbourhoods")} of a walk finished`;
    default:
      return assertNever(condition);
  }
}
