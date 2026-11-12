import { clamp01 } from "@andornaut/game-kit/numbers";
import type { Point } from "@andornaut/game-kit/rect";

import { LOADING_TRACK, LOADING_WALKER_START } from "../data/layout.ts";

// The loading screen's art (LOADING_ART) is placed as art/tools/screens.ts draws it, in screen
// pixels.
export { LOADING_TRACK };

// ui-loading's frame size, 98x84, with its feet on screen row 460.
export const LOADING_WALKER_SIZE = { height: 84, width: 98 };

// The walker's top-left at progress 0, and how far right it walks by 1: from the screen's
// left margin until its right edge meets the track's end at the gate.
const WALKER = LOADING_WALKER_START;
export const LOADING_WALKER = {
  travel: LOADING_TRACK.x + LOADING_TRACK.width - LOADING_WALKER_SIZE.width - WALKER.margin,
  x: WALKER.x,
  y: WALKER.y,
};

// Where the loading walker stands at progress, from 0 at the start to 1 at the gate.
export function loadingWalkerAt(progress: number): Point {
  return {
    x: LOADING_WALKER.x + Math.round(LOADING_WALKER.travel * clamp01(progress)),
    y: LOADING_WALKER.y,
  };
}
