import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import { BUTTON_SIZE, MODAL_SPACING, MODAL_WIDTHS } from "../../data/layout.ts";
import { MODAL } from "../modalGeometry.ts";
import { cssHex, PALETTE } from "../palette.ts";
import { PAPER_PANEL } from "../paperPanel.ts";

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
      paddingBottomPx: 4 * unit,
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
      shade: cssHex(PALETTE.forest),
      shadow: paper("shadow"),
      text: paper("text"),
    },
    panel: {
      bodyActionGapPx: 24,
      borderWidthPx: PAPER_PANEL.border,
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
      action: { lineHeight: 1.2, sizePx: 18, weight: 700 },
      body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
      title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
    },
  };
}

// CLEANUP (added 2026-11-25): remove once Game Kit's loading failure panel draws a bevel row, and
// pass PAPER_PANEL's bevel to it instead. Adds the modal paper's bevel row, under the top border,
// to the shadows the kit gives panel; call it after each presentation the kit applies.
export function paintPaperBevel(panel: HTMLElement): void {
  const bevel = `inset 0 ${PAPER_PANEL.bevel}px 0 ${paper("bevel")}`;
  const shadow = panel.style.getPropertyValue("box-shadow");
  if (!shadow.startsWith(bevel)) {
    panel.style.setProperty(
      "box-shadow",
      shadow === "" ? bevel : `${bevel}, ${shadow}`,
      panel.style.getPropertyPriority("box-shadow"),
    );
  }
}
