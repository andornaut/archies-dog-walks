import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";

import { MIN_PRESS, TOP_BAR_SIZES, WALK_BAR_PARTS } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { TITLE_CAP_ROWS } from "./textFit.ts";
import {
  TOP_BAR_FACE,
  TOP_BAR_HEIGHT,
  TOP_BAR_WELL,
  topBarContentRows,
  wellCapsTop,
} from "./topBarTrim.ts";

// Visibility removes a control from the flow; every section uses this order and pitch.
export const TOP_SECTION_ORDER = ["mute", "menu", "pause", "exit"] as const;
export type TopSectionButton = (typeof TOP_SECTION_ORDER)[number];
export interface TopSectionControl {
  face: Point;
  hit: Rect;
}

// The left edge of a section width wide set between left and right (the first column past the
// section before it and the first of the section after it) with an equal gap on either side,
// an odd leftover column going to the gap on its right.
export function topSectionGapLeft(left: number, right: number, width: number): number {
  return left + Math.floor((right - left - width) / 2);
}

// Currency and controls keep fixed dimensions. Visible effects centre within their reserved
// region, moving only with the effect count and never with the displayed amount.
export function topSectionLayout<T extends TopSectionButton>(
  visible: readonly T[],
  sections: { currency?: boolean; effects?: number } = {},
) {
  if (visible.includes("menu" as T) && visible.includes("pause" as T)) {
    throw new Error("Menu and Pause share one top-section control");
  }
  const shown = TOP_SECTION_ORDER.filter((id): id is T => visible.includes(id as T));
  const controls = shown.map((id, i) => {
    const x = SCREEN_CONFIG.width - (shown.length - i) * MIN_PRESS;
    return [
      id,
      {
        face: { x: x + (MIN_PRESS - TOP_BAR_FACE.size) / 2, y: TOP_BAR_FACE.y },
        hit: { height: MIN_PRESS, width: MIN_PRESS, x, y: 0 },
      },
    ] as const;
  });
  const effects = sections.effects ?? 0;
  const cash = WALK_BAR_PARTS.cash;
  const currencyWidth = cash.room + 2 * TOP_BAR_SIZES.well.padding + TOP_BAR_WELL.lip;
  const currency = sections.currency
    ? { height: TOP_BAR_WELL.height, width: currencyWidth, x: TOP_BAR_WELL.x, y: TOP_BAR_WELL.y }
    : undefined;
  const style = WALK_BAR_PARTS.effects;
  const span = effects * style.size + Math.max(0, effects - 1) * style.gap;
  const effectsX = topSectionGapLeft(
    TOP_BAR_WELL.x + currencyWidth,
    controls[0]?.[1].hit.x ?? SCREEN_CONFIG.width,
    span,
  );
  const effectWells = Array.from({ length: effects }, (_, i) => ({
    height: style.size,
    width: style.size,
    x: effectsX + i * (style.size + style.gap),
    y: TOP_BAR_FACE.y - (style.size - TOP_BAR_FACE.size) / 2,
  }));
  const effectHolds = effectWells.map((well) => ({
    height: TOP_BAR_HEIGHT,
    width: well.width + 2 * style.holdInset,
    x: well.x - style.holdInset,
    y: 0,
  }));
  return {
    bar: { height: TOP_BAR_HEIGHT, width: SCREEN_CONFIG.width, x: 0, y: 0 },
    controls,
    currency,
    effectHolds,
    effectWells,
  };
}

// Button backings share the currency well's vertical extent without changing faces or hits.
export function topSectionButtonBacking(face: Point): Rect {
  return {
    height: TOP_BAR_WELL.height,
    width: TOP_BAR_WELL.height,
    x: face.x + (TOP_BAR_FACE.size - TOP_BAR_WELL.height) / 2,
    y: TOP_BAR_WELL.y,
  };
}

// The top row of a toggle's state word, capRows tall, under a control's face: centred down the
// plum rows between the face's bottom and the bar's edge, so it sits directly below the face.
export function topSectionStateCapTop(face: Point, capRows: number): number {
  return Math.floor(
    (face.y + TOP_BAR_FACE.size + topBarContentRows(TOP_BAR_HEIGHT).bottom - capRows) / 2,
  );
}

// Currency follows the same full-size metrics with or without an effects section.
export function topSectionCurrency(layout: { currency: Rect | undefined }, inkWidth: number) {
  const cash = WALK_BAR_PARTS.cash;
  const maximum = layout.currency;
  if (maximum === undefined) {
    throw new Error("This top section has no currency");
  }
  const well = maximum;
  return {
    left: well.x + Math.floor((well.width - inkWidth) / 2),
    room: maximum.width - TOP_BAR_WELL.lip - 2 * TOP_BAR_SIZES.well.padding,
    scale: cash.scale,
    top: wellCapsTop(TITLE_CAP_ROWS * cash.scale),
    well,
  };
}

// Which of the currency's texts, without its "$", the section shows: full where "$" and it at the
// currency's scale fit its room, as inkWidth measures them at that scale, else short.
export function topSectionCurrencyText(
  inkWidth: (scale: number, text: string) => number,
  layout: { currency: Rect | undefined },
  texts: { readonly full: string; readonly short: string },
): string {
  const { room, scale } = topSectionCurrency(layout, 0);
  return inkWidth(scale, `$${texts.full}`) <= room ? texts.full : texts.short;
}

// Rendering and input consume the same compacted control positions.
export function topSectionButtonAt<T extends TopSectionButton>(
  visible: readonly T[],
  x: number,
  y: number,
): T | undefined {
  return topSectionLayout(visible).controls.find(([, { hit }]) => containsPoint(hit, x, y))?.[0];
}
