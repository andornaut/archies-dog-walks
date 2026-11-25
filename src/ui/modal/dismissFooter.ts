import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { BUTTON_SIZE } from "../buttonGeometry.ts";
import { MODAL, modalActionWidth } from "./layout.ts";
import type { PanelButton, PanelMeasure } from "./types.ts";
import { panelButton } from "./view.ts";

// Existing panel heights include the bottom padding; add one gap and one full target row.
export const DISMISS_FOOTER_SPACE = MODAL.gap + BUTTON_SIZE.compact.height;

export function dismissFooter(
  measure: Pick<PanelMeasure, "inkWidth" | "title" | "titleInk">,
  options: { readonly label: string; readonly primary: boolean },
  panel: Rect,
): PanelButton {
  const width = modalActionWidth(measure.inkWidth("title", options.label));
  if (width > panel.width - 2 * MODAL.pad) {
    throw new RangeError("Dismiss label exceeds the panel's fixed-font action room");
  }
  return {
    ...panelButton(
      measure,
      {
        height: BUTTON_SIZE.compact.height,
        width,
        x: panel.x + (panel.width - width) / 2,
        y: panel.y + panel.height - MODAL.pad - BUTTON_SIZE.compact.height,
      },
      options.primary,
      options.label,
    ),
    secondary: !options.primary,
  };
}
