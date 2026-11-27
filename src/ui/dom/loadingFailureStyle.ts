import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import { BUTTON_SIZE, MODAL_SPACING, MODAL_WIDTHS } from "../../data/index.ts";
import { ACTION_LABEL_SCALE, cssHex, MODAL, PALETTE, PAPER_PANEL, TEXT_SCALE } from "../index.ts";

const paper = (role: keyof typeof PAPER_PANEL.colours) =>
  cssHex(PALETTE[PAPER_PANEL.colours[role]]);

// Loading failed's look at unit CSS pixels per game pixel: the modal paper (PAPER_PANEL), as the
// crash screen draws it. Typography and inner panel spacing stay in CSS pixels; the panel's Large
// width, its screen margin and the normal action follow game fit.
export function loadingFailurePresentation(unit: number): LoadingFailurePresentation<"content"> {
  return {
    action: {
      borderWidthPx: Math.max(1, unit),
      heightPx: BUTTON_SIZE.compact.height * unit,
      highlightHeightPx: Math.max(1, unit),
      paddingBottomPx: 0,
      paddingXPx: MODAL.pad * unit,
      shadeHeightPx: 4 * unit,
      widthPx: "content",
    },
    palette: {
      action: cssHex(PALETTE.green),
      actionText: cssHex(PALETTE.ink),
      border: paper("border"),
      highlight: cssHex(PALETTE.yellow),
      lip: paper("lip"),
      panel: paper("fill"),
      panelHighlight: paper("bevel"),
      shade: cssHex(PALETTE.forest),
      shadow: paper("shadow"),
      text: paper("text"),
    },
    panel: {
      bodyActionGapPx: 24,
      borderWidthPx: PAPER_PANEL.border,
      highlightHeightPx: PAPER_PANEL.bevel,
      lipHeightPx: PAPER_PANEL.lip,
      maxWidthPx: MODAL_WIDTHS.large * unit,
      paddingBottomPx: 16,
      paddingTopPx: 24,
      paddingXPx: 16,
      safeInsetPx: MODAL_SPACING.margin * unit,
      shadowOffsetPx: PAPER_PANEL.shadow,
      titleBodyGapPx: 16,
    },
    text: {
      action: { lineHeight: 1.2, sizePx: (18 * ACTION_LABEL_SCALE) / TEXT_SCALE, weight: 700 },
      body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
      title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
    },
  };
}
