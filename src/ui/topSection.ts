import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import {
  ACTION_GAPS,
  type ActionArrangement,
  arrangeActions,
  type PlacedAction,
  pressedAction,
} from "@andornaut/game-kit/runtime/ui/actionGroup";

import {
  BUTTON_SIZE,
  MIN_PRESS,
  SCREEN_CONFIG,
  TOP_BAR_SIZES,
  WALK_BAR_PARTS,
} from "../data/index.ts";
import { TITLE_CAP_ROWS } from "./textFit.ts";
import { TOP_BAR_FACE, TOP_BAR_HEIGHT, TOP_BAR_WELL, wellCapsTop } from "./topBarTrim.ts";

// The currency's text in its well, the walk's cash and the home bank alike: its scale and its
// capitals' top row.
export const TOP_SECTION_CURRENCY_TEXT = {
  capsY: wellCapsTop(TITLE_CAP_ROWS * WALK_BAR_PARTS.cash.scale),
  scale: WALK_BAR_PARTS.cash.scale,
} as const;

// Visibility removes a control from the flow; every section uses this order and spacing.
export const TOP_SECTION_ORDER = ["mute", "menu", "pause", "exit"] as const;
export type TopSectionButton = (typeof TOP_SECTION_ORDER)[number];

// The left edge of a section width wide set between left and right (the first column past the
// section before it and the first of the section after it) with an equal gap on either side,
// an odd leftover column going to the gap on its right.
export function topSectionGapLeft(left: number, right: number, width: number): number {
  return left + Math.floor((right - left - width) / 2);
}

// A control's face (its ui-icon-button-normal's top-left), its hit (its full MIN_PRESS press
// area) and owned, the part of hit where its face's centre is nearer than a neighbour's, which
// its DOM button covers.
export interface TopSectionControl {
  face: Point;
  hit: Rect;
  owned: Rect;
}

// The shown controls, left to right: TOP_BAR_FACE faces the small-button gap apart on row
// TOP_BAR_FACE.y, the last one's press ending at the screen's right edge (arrangeActions). Each
// press is the full MIN_PRESS square centred across its face from the bar's top row, so
// neighbours' presses overlap, and a press in the overlap goes to the face whose centre is
// nearest (pressOverlap "nearest"), the earlier on a tie.
function topSectionControls<T extends TopSectionButton>(shown: readonly T[]) {
  const size = TOP_BAR_FACE.size;
  const width = shown.length * size + Math.max(0, shown.length - 1) * ACTION_GAPS.small.row;
  const right = SCREEN_CONFIG.width - (MIN_PRESS - size) / 2;
  const arrangement = arrangeActions(
    {
      axis: "row",
      gap: "small",
      origin: { x: right - width, y: TOP_BAR_FACE.y },
      pressOverlap: "nearest",
      width,
    },
    shown.map((key) => ({ key, role: "navigation", size: { height: size, width: size } }) as const),
  );
  const rows = (rect: Rect): Rect => ({ ...rect, height: MIN_PRESS, y: 0 });
  const placed = arrangement.actions.filter((action): action is PlacedAction<T> => !action.hidden);
  const presses: Pick<ActionArrangement<T>, "actions"> = {
    actions: placed.map((action) => ({ ...action, press: rows(action.press) })),
  };
  const controls = placed.map(
    ({ face, key, outset, press }) =>
      [
        key,
        {
          face: { x: face.x, y: face.y },
          hit: rows(press),
          owned: rows({
            ...press,
            width: face.width + outset.left + outset.right,
            x: face.x - outset.left,
          }),
        } satisfies TopSectionControl,
      ] as const,
  );
  return { controls, presses };
}

// Currency and controls keep fixed dimensions. Visible effects centre within their pinned region
// (WALK_BAR_PARTS.effects.right), moving only with the effect count and never with the displayed
// amount or the controls.
export function topSectionLayout<T extends TopSectionButton>(
  visible: readonly T[],
  sections: { currency?: boolean; effects?: number } = {},
) {
  if (visible.includes("menu" as T) && visible.includes("pause" as T)) {
    throw new Error("Menu and Pause share one top-section control");
  }
  const shown = TOP_SECTION_ORDER.filter((id): id is T => visible.includes(id as T));
  const { controls, presses } = topSectionControls(shown);
  const effects = sections.effects ?? 0;
  const cash = WALK_BAR_PARTS.cash;
  const currencyWidth = cash.room + 2 * TOP_BAR_SIZES.well.padding + TOP_BAR_WELL.lip;
  const currency = sections.currency
    ? { height: TOP_BAR_WELL.height, width: currencyWidth, x: TOP_BAR_WELL.x, y: TOP_BAR_WELL.y }
    : undefined;
  const style = WALK_BAR_PARTS.effects;
  const span = effects * style.size + Math.max(0, effects - 1) * style.gap;
  const effectsX = topSectionGapLeft(TOP_BAR_WELL.x + currencyWidth, style.right, span);
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
    presses,
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

// art: where a top bar button's glyph sits on its face, in from the face's corner.
const TOP_BAR_GLYPH = { x: 2, y: 1 } as const;

// A top bar button's glyph on its face at face, sunk with the face while pressed: the top bar's
// and the standalone Sound's.
export function topBarGlyphRect(face: Point, pressed = false): Rect {
  return {
    height: BUTTON_SIZE.icon.glyph,
    width: BUTTON_SIZE.icon.glyph,
    x: face.x + TOP_BAR_GLYPH.x,
    y: face.y + TOP_BAR_GLYPH.y + (pressed ? BUTTON_SIZE.press : 0),
  };
}

// The effect wells as drawn while a press is down on the one at pressed, if any: that well sunk
// with its press, its frame, press fill, icon and spare treat pip with it.
export function pressedEffectWells(wells: readonly Rect[], pressed: number | undefined): Rect[] {
  return wells.map((well, index) =>
    index === pressed ? { ...well, y: well.y + BUTTON_SIZE.press } : well,
  );
}

// Currency follows the same full-size metrics with or without an effects section.
export function topSectionCurrency(layout: { currency: Rect | undefined }, inkWidth: number) {
  const maximum = layout.currency;
  if (maximum === undefined) {
    throw new Error("This top section has no currency");
  }
  const well = maximum;
  return {
    // The well's flat face, less its lip column.
    left: well.x + Math.floor((well.width - TOP_BAR_WELL.lip - inkWidth) / 2),
    room: maximum.width - TOP_BAR_WELL.lip - 2 * TOP_BAR_SIZES.well.padding,
    scale: TOP_SECTION_CURRENCY_TEXT.scale,
    top: TOP_SECTION_CURRENCY_TEXT.capsY,
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

// The control a press at (x, y) lands on: of the shown controls whose hit takes it in, the one
// whose face's centre is nearest (pressedAction), as rendering places them.
export function topSectionButtonAt<T extends TopSectionButton>(
  visible: readonly T[],
  x: number,
  y: number,
): T | undefined {
  return pressedAction(topSectionLayout(visible).presses, { x, y });
}
