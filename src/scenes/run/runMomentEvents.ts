import type { DogId, HintId } from "../../data/ids.ts";

// An owner's line, said on the message strip.
export interface OwnerQuip {
  dog: DogId;
  text: string;
}

// A first-time hint raised for the HUD to say on the message strip.
export interface RaisedHint {
  readonly id: HintId;
  readonly text: string;
}

// Emitted on the run scene's events: ChangeLabel[] whenever money or hearts change, a
// first-time hint (RaisedHint), and OwnerQuip[] when owners react.
export const CHANGE_LABELS_EVENT = "change-labels";
export const HINT_EVENT = "hint";
export const QUIPS_EVENT = "quips";
// AchievementId[] when the walk so far has earned badges, for the message strip.
export const ACHIEVEMENTS_EVENT = "achievements";
// An EffectItem whose walk bar well glints as its charm pops.
export const BUFF_GLINT_EVENT = "buff-glint";
// A bump's border colour, for the HUD to flash round the screen.
export const BUMP_FLASH_EVENT = "bump-flash";
