import { newlyEarned } from "@andornaut/game-kit/achievements";

import type { AchievementId, GameData } from "../data/types.ts";
import { achievementJudge, isMoneyGoal } from "../rules/achievements.ts";
import type { RunState } from "../state/runState.ts";
import { type AwardContext, recordRunEnd, runEndFacts, type RunResult } from "./checkpoint.ts";
import { runResultOf } from "./runSlices.ts";
import type { SaveDocument } from "./schema.ts";

// The achievements banking result into save would newly earn beside earned, without writing
// anything.
export function earnedIfBanked(
  context: AwardContext,
  earned: readonly AchievementId[],
  save: SaveDocument,
  result: RunResult,
): AchievementId[] {
  const facts = { run: runEndFacts(result), save: recordRunEnd(context, save, result) };
  const { data } = context;
  return newlyEarned(achievementJudge(data), data.achievements, "bank", facts, earned);
}

// A walk's mid-run badge lines preview what heading home at that moment would earn, each badge
// once a walk (the game kit's previewAchievements), leaving out money goals, which are checked
// only on the total the walk banks. They award nothing: the run's end (or its checkpoint, banked
// on the next launch) does, and the end screen celebrates every badge the walk earned, announced
// or not.

// Mid-run, only a finished zone, a debuff got, a tally, an option pick, a landed bump or a
// firing can earn a previewed badge, so the bank is looked at again only when one of them has
// changed. Finished walks count only at the end, and an ended run is left to the end screen.
export function previewKey(run: RunState): string {
  const fired = run.pack.filter((slot) => slot.status === "fired").length;
  return [
    run.zoneIndex,
    JSON.stringify(run.debuffsGot),
    JSON.stringify(run.tallies),
    JSON.stringify(run.optionPicks),
    JSON.stringify(run.bumpsByKind),
    fired,
  ].join(":");
}

// What banking run now would newly earn (banked), money goals left out; nothing for an ended run.
export function previewedEarned(
  data: Pick<GameData, "achievements" | "world">,
  banked: (result: RunResult) => readonly AchievementId[],
  run: RunState,
): AchievementId[] {
  if (run.phase.kind === "ended") {
    return [];
  }
  const money = new Set(data.achievements.filter(isMoneyGoal).map(({ id }) => id));
  return banked(runResultOf(data, run)).filter((id) => !money.has(id));
}
