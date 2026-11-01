import type { HoldRule } from "@andornaut/game-kit/input/hold";

import type { LiveTuning } from "../data/types";
import { read } from "../rules/units";

export {
  type HoldPress,
  type HoldRule,
  moveHold,
  releaseHold,
  startHold,
  tickHold,
} from "@andornaut/game-kit/input/hold";

// Every hold lasts seconds.holdSeconds, read at the press; each rule sets only its slop.
export function holdRule(tuning: LiveTuning, slopPx: number): HoldRule {
  return { holdMs: read(tuning, "seconds", "holdSeconds") * 1000, slopPx };
}

// The home screen's and Pet shop's tiles: a hold opens the item's detail card.
export const TILE_SLOP_PX = 10;
