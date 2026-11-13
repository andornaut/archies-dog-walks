import type { Point, Rect } from "@andornaut/game-kit/rect";

import { HELP_SCREEN, HOME_SCREEN, MIN_PRESS, WALK_BAR_PARTS } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { TEXT_SCALE } from "./textFit.ts";
import {
  TOP_BAR_FACE,
  TOP_BAR_HEIGHT,
  TOP_BAR_MID,
  TOP_BAR_WELL,
  wellCapsTop,
} from "./topBarTrim.ts";

// Visibility removes a control from the flow; every section uses this order and pitch.
export const TOP_SECTION_ORDER = [
  "logbook",
  "help",
  "mute",
  "settings",
  "exit",
  "pause",
  "close",
] as const;
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
  const maxCurrencyWidth =
    effects > 0
      ? cash.ink.right + 1 + TOP_BAR_WELL.lip - TOP_BAR_WELL.x
      : Math.min(
          SCREEN_CONFIG.width -
            5 * MIN_PRESS +
            (MIN_PRESS - TOP_BAR_FACE.size) / 2 -
            HOME_SCREEN.topBar.wellClear -
            TOP_BAR_WELL.x,
          (first?.face.x ?? SCREEN_CONFIG.width) - HOME_SCREEN.topBar.wellClear - TOP_BAR_WELL.x,
        );
  const currency = sections.currency
    ? { height: TOP_BAR_WELL.height, width: maxCurrencyWidth, x: TOP_BAR_WELL.x, y: TOP_BAR_WELL.y }
    : undefined;
  const style = WALK_BAR_PARTS.effects;
  const span = effects * style.size + Math.max(0, effects - 1) * style.gap;
  const effectsX = topSectionGapLeft(
    currency === undefined ? TOP_BAR_WELL.x : currency.x + currency.width,
    first?.hit.x ?? SCREEN_CONFIG.width,
    span,
  );
  const effectWells = Array.from({ length: effects }, (_, i) => ({
    height: style.size,
    width: style.size,
    x: effectsX + i * (style.size + style.gap),
    y: TOP_BAR_FACE.y - (style.size - TOP_BAR_FACE.size) / 2,
  }));
  const starts = effectWells.map((well, i) => well.x - (i === 0 ? style.holdInset : 0));
  const effectHolds = starts.map((x, i) => ({
    height: TOP_BAR_HEIGHT,
    width: (starts[i + 1] ?? first?.hit.x ?? SCREEN_CONFIG.width) - x,
    x,
    y: 0,
  }));
  return {
    bar: { height: TOP_BAR_HEIGHT, width: SCREEN_CONFIG.width, x: 0, y: 0 },
    controls,
    currency,
    effectHolds,
    effectWells,
    heading: { scale: TEXT_SCALE, x: HELP_SCREEN.headingX, y: TOP_BAR_MID - (5 * TEXT_SCALE) / 2 },
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
      : Math.min(maximum.width, inkWidth + 2 * HOME_SCREEN.topBar.bankPad + TOP_BAR_WELL.lip),
  };
  return {
    left: fixed
      ? Math.floor((cash.ink.left + cash.ink.right) / 2 - (inkWidth - 1) / 2)
      : well.x + HOME_SCREEN.topBar.bankPad,
    room: fixed ? cash.room : maximum.width - TOP_BAR_WELL.lip - 2 * HOME_SCREEN.topBar.bankPad,
    scale: cash.scale,
    top: wellCapsTop(5 * cash.scale),
    well,
  };
}
