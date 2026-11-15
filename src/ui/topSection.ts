import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

import { HOME_SCREEN, MIN_PRESS, TOP_BAR_SIZES, WALK_BAR_PARTS } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { TEXT_SCALE, TITLE_CAP_ROWS } from "./textFit.ts";
import {
  TOP_BAR_FACE,
  TOP_BAR_HEIGHT,
  TOP_BAR_MID,
  TOP_BAR_WELL,
  wellCapsTop,
} from "./topBarTrim.ts";

// Visibility removes a control from the flow; every section uses this order and pitch.
export const TOP_SECTION_ORDER = ["mute", "menu", "pause"] as const;
export type TopSectionButton = (typeof TOP_SECTION_ORDER)[number];
export interface TopSectionControl {
  face: Point;
  hit: Rect;
}

export function topSectionGapLeft(left: number, right: number, width: number): number {
  return left + Math.floor((right - left - width) / 2);
}

// Sections share one placement algorithm. Controls compact at the right; effects fill the
// space between currency and controls. Hidden controls consume no columns.
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
  const first = controls[0]?.[1];
  const effects = sections.effects ?? 0;
  const cash = WALK_BAR_PARTS.cash;
  const minimumCurrencyWidth = cash.room + 2 * TOP_BAR_SIZES.well.padding + TOP_BAR_WELL.lip;
  const maxCurrencyWidth =
    effects > 0
      ? minimumCurrencyWidth
      : (first?.hit.x ?? SCREEN_CONFIG.width) - HOME_SCREEN.topBar.wellClear - TOP_BAR_WELL.x;
  const currency = sections.currency
    ? { height: TOP_BAR_WELL.height, width: maxCurrencyWidth, x: TOP_BAR_WELL.x, y: TOP_BAR_WELL.y }
    : undefined;
  const style = WALK_BAR_PARTS.effects;
  const span = effects * style.size + Math.max(0, effects - 1) * style.gap;
  const effectsX = topSectionGapLeft(0, SCREEN_CONFIG.width, span);
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
    heading: {
      scale: TEXT_SCALE,
      x: SCREEN_CONFIG.width / 2,
      y: TOP_BAR_MID - (TITLE_CAP_ROWS * TEXT_SCALE) / 2,
    },
  };
}

// Currency follows the same full-size metrics with or without an effects section.
export function topSectionCurrency(
  layout: { currency: Rect | undefined; effectWells: readonly Rect[] },
  inkWidth: number,
) {
  const cash = WALK_BAR_PARTS.cash;
  const maximum = layout.currency;
  if (maximum === undefined) {
    throw new Error("This top section has no currency");
  }
  const fixed = layout.effectWells.length > 0;
  const well = {
    ...maximum,
    width: fixed
      ? maximum.width
      : Math.min(
          maximum.width,
          Math.max(
            cash.room + 2 * TOP_BAR_SIZES.well.padding + TOP_BAR_WELL.lip,
            inkWidth + 2 * TOP_BAR_SIZES.well.padding + TOP_BAR_WELL.lip,
          ),
        ),
  };
  return {
    left: well.x + Math.floor((well.width - inkWidth) / 2),
    room: maximum.width - TOP_BAR_WELL.lip - 2 * TOP_BAR_SIZES.well.padding,
    scale: cash.scale,
    top: wellCapsTop(TITLE_CAP_ROWS * cash.scale),
    well,
  };
}

// Rendering and input consume the same compacted control positions.
export function topSectionButtonAt<T extends TopSectionButton>(
  visible: readonly T[],
  x: number,
  y: number,
): T | undefined {
  return topSectionLayout(visible).controls.find(([, { hit }]) => containsPoint(hit, x, y))?.[0];
}
