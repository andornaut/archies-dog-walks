import type { HoldRule } from "@andornaut/game-kit/runtime/input/hold";

import type { LiveTuning } from "./data/types.ts";
import { read } from "./rules/units.ts";

// Every action reads the same live duration when its press begins.
export function holdRule(tuning: LiveTuning, slopPx: number): HoldRule {
  return { holdMs: read(tuning, "seconds", "holdSeconds") * 1000, slopPx };
}

export const TILE_SLOP_PX = 10;
