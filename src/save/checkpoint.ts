import type { DogId, EncounterId, OptionPicks, WalkerId, ZoneId } from "../data/types.ts";
import {
  type AchievementData,
  type RunCounters,
  type RunFacts,
} from "../rules/achievements.ts";
import { newWalkers } from "../rules/walkers.ts";
import type { EndReason } from "../state/runState.ts";
import { addCents, type Cents, cents } from "../units.ts";
import type { Checkpoint, DogRun, DogStats, LastWalk, SaveDocument, SaveStats } from "./schema.ts";
import { bestWalkCents, ZERO_DOG_STATS } from "./stats.ts";

// What banking a run and awarding its badges need: the achievements and the content their
// "all" counts.
export interface AwardContext {
  readonly data: AchievementData;
}

// A finished run. earnedCents is what the run banks, and lostCents the cash it carried and lost
// by ending early (walkEarnings). lastHeartOwners is how many walking owners ended it
// on their last heart. zone is the zone in progress when the run ended, counting from 1; between
// zones it is the next one. A finished run ends in its last zone.
export interface RunResult {
  counters: RunCounters;
  dogs: DogRun[];
  earnedCents: Cents;
  lastHeartOwners: number;
  lostCents: Cents;
  outcome: EndReason;
  // The zones the run walked, in order, the one it ended in included.
  route: ZoneId[];
  walker: WalkerId;
  zone: number;
}

// Only finished zones count: heading home or running out of dogs in zone 3 finishes 2.
export function zonesFinishedBy(result: Pick<RunResult, "outcome" | "zone">): number {
  return result.outcome === "finished" ? result.zone : result.zone - 1;
}

// The dogs still walking at the end of a finished walk: those whose owner never fired you, which
// are the dogs the last zone paid and the Walk bonus counts (packDogs), since an owner at 0 hearts
// fires you at once. null for a walk not finished: headed home or every owner having fired you.
export function dogsFinishedWith(run: Pick<RunResult, "dogs" | "outcome">): number | null {
  if (run.outcome !== "finished") {
    return null;
  }
  return run.dogs.filter(({ firedInZone }) => firedInZone === null).length;
}

// Lifetime counts with a run's added, key by key: the tallies, the bumps by kind, or an
// encounter's option picks.
function addCounts<Key extends string>(
  lifetime: Readonly<Partial<Record<Key, number>>>,
  run: Readonly<Partial<Record<Key, number>>>,
): Partial<Record<Key, number>> {
  const sum: Partial<Record<Key, number>> = { ...lifetime };
  for (const [key, count] of Object.entries(run) as [Key, number][]) {
    sum[key] = (sum[key] ?? 0) + count;
  }
  return sum;
}

// Lifetime option picks with a run's added, option by option.
function addPicks(lifetime: OptionPicks, run: OptionPicks): OptionPicks {
  const sum: OptionPicks = { ...lifetime };
  for (const [encounter, picks] of Object.entries(run) as [EncounterId, Record<string, number>][]) {
    // Every option addCounts returns has a count.
    sum[encounter] = addCounts(sum[encounter] ?? {}, picks) as Record<string, number>;
  }
  return sum;
}

// The streak of finished walks with no firing after a walk: a firing ends it, a walk finished
// from the first zone adds one, and any other walk, headed home early, leaves it as it was.
function nextNoFiringStreak(streak: number, finished: boolean, firings: number): number {
  if (firings > 0) {
    return 0;
  }
  return finished ? streak + 1 : streak;
}

// Whether a walk of packSize dogs banking earnedCents beats every walk yet with that many
// dogs; the end screen flags it.
export function isNewBestWalk(
  stats: Pick<SaveStats, "bestCentsByPackSize">,
  packSize: number,
  earnedCents: Cents,
): boolean {
  const best = stats.bestCentsByPackSize[packSize];
  return best === undefined || earnedCents > best;
}

// Whether a run banking earnedCents beats the best walk the logbook shows, whatever its dogs.
function beatsBestWalk(
  stats: Pick<SaveStats, "bestCentsByPackSize" | "bestWalk">,
  earnedCents: Cents,
): boolean {
  return stats.bestWalk === null || earnedCents > bestWalkCents(stats);
}

// walker is null for a checkpoint, which banks as heading home and so finishes no walk.
type BankedRun = Pick<
  Checkpoint,
  "counters" | "dogs" | "earnedCents" | "route" | "zonesFinished"
> & {
  lastHeartOwners: number;
  outcome: EndReason;
  walker: WalkerId | null;
};

// Banks the earnings, counts the outcome and updates every stat and the logbook. A dev start's
// zone is the run's first, so its zone counts leave out the zones before it, which it never
// walked. Unlocks the walkers that a finished walk's dogs still
// walking at its end reach (dogsFinishedWith). Clears the checkpoint, since the run it belonged
// to is now banked. The badges it earns are judged on its facts (runFacts).
function bankRun(context: AwardContext, run: BankedRun, save: SaveDocument): SaveDocument {
  const { stats } = save;
  const walkedOf = (zones: number) => Math.max(0, zones - run.counters.firstZone);
  const { outcome, zonesFinished } = run;
  const earnedCents = cents(Math.max(0, run.earnedCents));
  const dogs: Partial<Record<DogId, DogStats>> = { ...stats.dogs };
  for (const { firedInZone, id } of run.dogs) {
    const current = dogs[id] ?? ZERO_DOG_STATS;
    // A dog fired in a zone was paid for the zones before it.
    const paid = firedInZone === null ? zonesFinished : firedInZone - 1;
    dogs[id] = {
      timesFired: current.timesFired + (firedInZone === null ? 0 : 1),
      walks: current.walks + 1,
      zonesFinished: current.zonesFinished + walkedOf(paid),
    };
  }

  const walkDogs = run.dogs.map(({ id }) => id);
  const firedBy = run.dogs.flatMap(({ firedInZone, id }) => (firedInZone === null ? [] : [id]));
  const lastWalk: LastWalk = {
    dogs: walkDogs,
    earnedCents,
    firings: firedBy,
    outcome,
    route: run.route,
    zonesFinished,
  };
  const finished = outcome === "finished";
  const stayed = run.dogs.flatMap(({ firedInZone, id }) => (firedInZone === null ? [id] : []));
  const { owned } = save;
  return {
    ...save,
    bankCents: addCents(save.bankCents, earnedCents),
    checkpoint: null,
    owned: {
      ...owned,
      walkers: [
        ...owned.walkers,
        ...newWalkers(context.data, owned.walkers, dogsFinishedWith(run)),
      ],
    },
    stats: {
      ...stats,
      bestCentsByPackSize:
        isNewBestWalk(stats, walkDogs.length, earnedCents)
          ? { ...stats.bestCentsByPackSize, [walkDogs.length]: earnedCents }
          : stats.bestCentsByPackSize,
      bestWalk:
        beatsBestWalk(stats, earnedCents)
          ? { dogs: walkDogs, zonesFinished }
          : stats.bestWalk,
      bestZoneFinished: Math.max(stats.bestZoneFinished, walkedOf(zonesFinished)),
      bumpsByKind: addCounts(stats.bumpsByKind, run.counters.bumpsByKind),
      dogs,
      dogsFinishedWith: finished
        ? [...new Set([...stats.dogsFinishedWith, ...stayed])]
        : stats.dogsFinishedWith,
      lastWalk,
      lifetimeCents: addCents(stats.lifetimeCents, earnedCents),
      lifetimeStartCents: addCents(stats.lifetimeStartCents, run.counters.startCents),
      noFiringStreak: nextNoFiringStreak(stats.noFiringStreak, finished, firedBy.length),
      optionPicks: addPicks(stats.optionPicks, run.counters.optionPicks),
      runs: { ...stats.runs, [outcome]: stats.runs[outcome] + 1 },
      tallies: addCounts(stats.tallies, run.counters.tallies),
      walkersFinishedWith:
        finished && run.walker !== null
          ? [...new Set([...stats.walkersFinishedWith, run.walker])]
          : stats.walkersFinishedWith,
      zonesEverFinished: [
        ...new Set([
          ...stats.zonesEverFinished,
          ...run.route.slice(run.counters.firstZone, zonesFinished),
        ]),
      ],
    },
  };
}

// What the badges judge a banked run on: its counters, what it banked (never below 0), how many
// dogs set out and got home unfired, its walking owners on their last heart and the zones it
// finished.
function runFacts(run: BankedRun): RunFacts {
  return {
    ...run.counters,
    dogsHome: run.dogs.filter(({ firedInZone }) => firedInZone === null).length,
    earnedCents: cents(Math.max(0, run.earnedCents)),
    lastHeartOwners: run.lastHeartOwners,
    packSize: run.dogs.length,
    zonesFinished: run.zonesFinished,
  };
}

export function recordCheckpoint(save: SaveDocument, slice: Checkpoint): SaveDocument {
  return { ...save, checkpoint: slice };
}

// Banks an unfinished run as if the player had headed home after the checkpoint's zone. Only a
// finished walk counts the owners on their last heart, and a checkpoint never is one: the walk's
// last zone ends the run, which then saves no checkpoint.
export function bankCheckpoint(context: AwardContext, save: SaveDocument): SaveDocument {
  const { checkpoint } = save;
  return checkpoint === null ? save : bankRun(context, checkpointRun(checkpoint), save);
}

function checkpointRun(checkpoint: Checkpoint): BankedRun {
  return { ...checkpoint, lastHeartOwners: 0, outcome: "wentHome", walker: null };
}

// What the badges judge a checkpoint's run on as bankCheckpoint banks it.
export function checkpointFacts(checkpoint: Checkpoint): RunFacts {
  return runFacts(checkpointRun(checkpoint));
}

// Banks a run that ended.
export function recordRunEnd(
  context: AwardContext,
  save: SaveDocument,
  result: RunResult,
): SaveDocument {
  return bankRun(context, endedRun(result), save);
}

function endedRun(result: RunResult): BankedRun {
  return {
    counters: result.counters,
    dogs: result.dogs,
    earnedCents: result.earnedCents,
    lastHeartOwners: result.lastHeartOwners,
    outcome: result.outcome,
    route: result.route,
    walker: result.walker,
    zonesFinished: zonesFinishedBy(result),
  };
}

// What the badges judge a run that ended on as recordRunEnd banks it.
export function runEndFacts(result: RunResult): RunFacts {
  return runFacts(endedRun(result));
}
