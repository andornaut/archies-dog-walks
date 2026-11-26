import type { Point } from "@andornaut/game-kit/runtime/rect";

import { ICON_LABEL_GAP, LABEL_ICON } from "../data/index.ts";

// A 16px icon beside its label: its art cell ICON_LABEL_GAP before the label's first ink column,
// centred down the label's capitals with equal rows over and under them, an odd row under.
export function iconBesideLabel(label: {
  readonly capHeight: number;
  readonly capTop: number;
  readonly inkLeft: number;
}): Point {
  return {
    x: label.inkLeft - ICON_LABEL_GAP - LABEL_ICON,
    y: label.capTop - Math.floor((LABEL_ICON - label.capHeight) / 2),
  };
}
