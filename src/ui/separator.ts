import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { BUTTON_SIZE } from "./buttonGeometry.ts";

// The one content separator: a 1px line across the full content width with the stacked gap clear
// of the boxes above and below it, SEPARATOR_BAND rows in all.
export const SEPARATOR = { clear: BUTTON_SIZE.stackGap, height: 1 } as const;
export const SEPARATOR_BAND = 2 * SEPARATOR.clear + SEPARATOR.height;

// The separator under a box whose last row ends at bottom, across content, and the top of the
// box under it.
export function separatorBetween(
  content: Pick<Rect, "width" | "x">,
  bottom: number,
): { readonly line: Rect; readonly next: number } {
  const y = bottom + SEPARATOR.clear;
  return {
    line: { height: SEPARATOR.height, width: content.width, x: content.x, y },
    next: y + SEPARATOR.height + SEPARATOR.clear,
  };
}
