import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { BAR_TITLE_INSET } from "../data/index.ts";
import type { CloseControl } from "./closeControl.ts";
import { MODAL } from "./modalGeometry.ts";

// Modal titles reserve the full close hit plus its gap symmetrically on both sides.
// A title is centred within its available row, or begins at the inset when too wide.
export const BAR_TITLE = { closeGap: MODAL.gap, inset: BAR_TITLE_INSET } as const;

function titleRange(bar: Rect, close: CloseControl | undefined): { left: number; right: number } {
  const right = close === undefined ? bar.x + bar.width : close.hit.x - BAR_TITLE.closeGap;
  return { left: close === undefined ? bar.x : 2 * bar.x + bar.width - right, right };
}

// The title's actual ink room after the relevant corner clearance.
export function barTitleRoom(bar: Rect, close: CloseControl | undefined): number {
  const { left, right } = titleRange(bar, close);
  return right - left - BAR_TITLE.inset;
}

// The first ink column, centred in the title's available row.
export function barTitleLeft(bar: Rect, close: CloseControl | undefined, inkWidth: number): number {
  const { left, right } = titleRange(bar, close);
  const clear = Math.floor((right - left - inkWidth) / 2);
  return left + Math.max(clear, BAR_TITLE.inset);
}
