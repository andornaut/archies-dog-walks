import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import { BUTTON_SIZE, MODAL_SPACING, MODAL_WIDTHS } from "../../data/layout.ts";
import { MODAL } from "../modalGeometry.ts";
import { PALETTE } from "../palette.ts";

// Loading failed's look at unit CSS pixels per game pixel. Typography and inner panel spacing
// stay in CSS pixels; the panel's Large width, its screen margin and the normal action follow
// game fit.
export function loadingFailurePresentation(unit: number): LoadingFailurePresentation<"content"> {
  const colour = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
  return {
    action: {
      borderWidthPx: Math.max(1, unit),
      heightPx: BUTTON_SIZE.compact.height * unit,
      highlightHeightPx: Math.max(1, unit),
      paddingBottomPx: 4 * unit,
      paddingXPx: MODAL.pad * unit,
      shadeHeightPx: 4 * unit,
      widthPx: "content",
    },
    palette: {
      action: colour(PALETTE.green),
      actionText: colour(PALETTE.ink),
      border: colour(PALETTE.ink),
      highlight: colour(PALETTE.yellow),
      lip: colour(PALETTE.tan),
      panel: colour(PALETTE.cream),
      shade: colour(PALETTE.forest),
      shadow: colour(PALETTE.ink),
      text: colour(PALETTE.plum),
    },
    panel: {
      bodyActionGapPx: 24,
      borderWidthPx: 1,
      lipHeightPx: 4,
      maxWidthPx: MODAL_WIDTHS.large * unit,
      paddingBottomPx: 16,
      paddingTopPx: 24,
      paddingXPx: 16,
      safeInsetPx: MODAL_SPACING.margin * unit,
      shadowOffsetPx: 4,
      titleBodyGapPx: 16,
    },
    text: {
      action: { lineHeight: 1.2, sizePx: 18, weight: 700 },
      body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
      title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
    },
  };
}
