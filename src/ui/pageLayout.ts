import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { PAGE, SHOP_PAGE, TOP_BAR_HEIGHT } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { BUTTON_SIZE } from "./buttonGeometry.ts";
import { arrangePanelActions } from "./modal/actionGroup.ts";
import type { PanelButton, PanelMeasure } from "./modal/types.ts";
import { panelButton } from "./modal/view.ts";

const { height, width } = SCREEN_CONFIG;
const RECT = { height: height - TOP_BAR_HEIGHT, width, x: 0, y: TOP_BAR_HEIGHT } as const;
const BACK = {
  ...BUTTON_SIZE.compact,
  x: (width - BUTTON_SIZE.compact.width) / 2,
  y: height - PAGE.backFoot - BUTTON_SIZE.compact.height,
} as const;

// The Help, Logbook and Pet shop pages share this geometry. Each page fills the screen under the
// live top bar edge to edge, with no frame, border, margin or close control. Its content takes
// inset columns from each side, its scrollbar's track ends inset columns in from the screen's
// right edge, beside a list or body longer than its view, and the primary Back button, its only
// leave, is centred backFoot rows over the screen's foot.
export const PAGE_LAYOUT = {
  back: BACK,
  inset: PAGE.inset,
  rect: RECT,
  scrollbar: { ...SHOP_PAGE.scrollbar, x: width - PAGE.inset - SHOP_PAGE.scrollbar.trackWidth },
} as const;

// A page's Back: its label's button centred across the page in the Back slot.
export function pageBack(
  measure: Pick<PanelMeasure, "inkWidth" | "title" | "titleInk">,
  label: string,
): PanelButton {
  const [back] = arrangePanelActions(measure, RECT, "row", [
    panelButton(measure, BACK, true, label),
  ]);
  return back!;
}

// A page's rows from spec.y down, one per height, spec.width wide from spec.x and spec.gap apart.
export function stackRows(
  spec: { readonly gap: number; readonly width: number; readonly x: number; readonly y: number },
  heights: readonly number[],
): Rect[] {
  let y = spec.y;
  return heights.map((height) => {
    const rect = { height, width: spec.width, x: spec.x, y };
    y += height + spec.gap;
    return rect;
  });
}
