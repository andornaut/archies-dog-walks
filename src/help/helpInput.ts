import type { Point } from "@andornaut/game-kit/runtime/rect";

import { gameData } from "../data/index.ts";
import {
  exceedsTapDistance,
  isConfirmKey,
  isPauseKey,
  laneDirectionForKey,
  swipeDirection,
} from "../input/index.ts";
import { read } from "../rules/index.ts";
import { helpActionAt, type HelpActionBounds } from "./helpLayout.ts";
import type { HelpAction } from "./helpPaging.ts";

// A swipe turns a page once it travels this far.
const SWIPE_MIN_DISTANCE = 40;

// The lane keys turn pages: arrows, A/D and H/L. Enter and Space press Next; Escape or P closes.
// A key's auto-repeat turns pages but never presses Next or closes, so a held Enter cannot
// run through the pages and out of the help.
export function helpActionForKey(repeat: boolean, code: string): HelpAction | undefined {
  if (isPauseKey(code)) {
    return repeat ? undefined : { kind: "close" };
  }
  if (isConfirmKey(code)) {
    return repeat ? undefined : { kind: "advance" };
  }
  const direction = laneDirectionForKey(code);
  if (direction === undefined) {
    return undefined;
  }
  return direction === 1 ? { kind: "next" } : { kind: "previous" };
}

// Read on release. A swipe left brings in the next page, as if dragging the page aside;
// a tap acts on the button where it started.
export function helpActionForPointer(
  actions: HelpActionBounds,
  start: Point,
  end: Point,
): HelpAction | undefined {
  const swipe = swipeDirection(SWIPE_MIN_DISTANCE, start, end);
  if (swipe !== undefined) {
    return swipe === -1 ? { kind: "next" } : { kind: "previous" };
  }
  if (exceedsTapDistance(read(gameData.tuning, "pixels", "tapMaxDistance"), start, end)) {
    return undefined;
  }
  return helpActionAt(actions, start);
}
