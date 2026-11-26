import type { AchievementDef, Threshold } from "@andornaut/game-kit/runtime/achievements";

import type {
  AchievementId,
  CardOptionIdOf,
  DebuffId,
  EncounterId,
  MinorObstacleId,
} from "../ids.ts";
import type { TallyId } from "./content.ts";

// An option on an encounter's card, by its encounter and its id.
type OptionPick = {
  [Id in EncounterId]: [CardOptionIdOf<Id>] extends [never]
    ? never
    : { readonly encounter: Id; readonly option: CardOptionIdOf<Id> };
}[EncounterId];

// How many a condition needs: a number, or "all" of what the game data has.
export type { Threshold };

// What earns an achievement. Run conditions are judged on one run as it is banked: zones it
// finished (all: every zone of a walk), zones it finished without a bump, dogs it set out
// with, dollars it banked, times it got the debuff, a finished walk with a walking owner on
// their last heart, and a finished walk that paid the Walk bonus for a pack of at least
// packSize. Profile conditions are judged on the save after a run or a purchase: dogs, gear
// and walkers owned (all: every one in the data), the current streak of finished walks with no
// owner firing you, times fired, distinct owners who fired you (all: every dog's owner),
// distinct dogs that finished a walk without firing you (all: every dog), distinct walkers who
// finished a walk (all: every walker), distinct zones finished across walks (all: every zone of
// the world), walks played, walks finished (every zone walked from the first), dollars earned
// across walks net of their starting cash, landed plain bumps by any of kinds across walks, a
// lifetime tally, and picks of one card option across walks.
export type AchievementCondition =
  | {
      readonly count: number;
      readonly kind: "bumps";
      readonly kinds: readonly [MinorObstacleId, ...MinorObstacleId[]];
    }
  | { readonly count: number; readonly debuff: DebuffId; readonly kind: "debuffsGot" }
  | { readonly count: number; readonly kind: "noFiringStreak" }
  | ({ readonly count: number; readonly kind: "optionPicks" } & OptionPick)
  | { readonly count: number; readonly kind: "packSize" }
  | { readonly count: number; readonly kind: "tally"; readonly tally: TallyId }
  | { readonly count: number; readonly kind: "timesFired" }
  | { readonly count: number; readonly kind: "walksPlayed" }
  | { readonly count: number; readonly kind: "walksFinished" }
  | { readonly count: Threshold; readonly kind: "cleanZones" }
  | { readonly count: Threshold; readonly kind: "dogsFinishedWith" }
  | { readonly count: Threshold; readonly kind: "dogsOwned" }
  | { readonly count: Threshold; readonly kind: "firedByOwners" }
  | { readonly count: Threshold; readonly kind: "gearOwned" }
  | { readonly count: Threshold; readonly kind: "walkersFinishedWith" }
  | { readonly count: Threshold; readonly kind: "walkersUnlocked" }
  | { readonly count: Threshold; readonly kind: "zonesEverFinished" }
  | { readonly count: Threshold; readonly kind: "zonesFinished" }
  | { readonly dollars: number; readonly kind: "earnings" }
  | { readonly dollars: number; readonly kind: "lifetimeEarnings" }
  | { readonly kind: "finishOnLastHeart" }
  | { readonly kind: "fullPackBonus"; readonly packSize: number };

// A badge on the Logbook's wall, earned once every condition holds. Celebration only: it
// changes nothing in play. The badge art is badge-<id in kebab case>.
export type AchievementTier = "easy" | "medium" | "hard";

export interface Achievement extends AchievementDef<
  AchievementId,
  AchievementCondition,
  AchievementTier
> {
  readonly badgeLine: string;
  // The goal and short goal name what the first condition needs as {count}, or for a money
  // condition as {amount}, "all" resolved to its whole.
  readonly goal: string;
  readonly name: string;
  // The goal on the badge wall when the full goal does not fit beside the name.
  readonly shortGoal?: string;
}
