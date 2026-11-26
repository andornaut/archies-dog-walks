import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { ZONE_PILL_SIZES } from "../data/index.ts";
import { debuffBarRects } from "./walkHud.ts";

// The neighbourhood pill (ui-zone-pill, a three-slice with 4px ends): the zone's name and its
// place in the walk ("n of N"), in the standard body role, centred across the screen gap rows under
// the walk bar, or under the last debuff bar while any is up, height rows tall. The name inks
// in cream from pad columns in, the count in light grey ends its ink pad columns before the
// pill's right edge, textGap columns between their inks, with both ink blocks centred vertically.
// It takes no presses, and the message strip draws over it.
const PILL = ZONE_PILL_SIZES;
export const ZONE_PILL = {
  gap: PILL.gap,
  key: "ui-zone-pill",
  pad: PILL.pad,
  padY: PILL.padY,
  textGap: PILL.textGap,
} as const;

// Where the pill and its texts go: the pill, the left edge of the name's ink and the column past
// the count's ink. Each text's ink is centred down the pill (its backing).
interface ZonePillLayout {
  readonly countRight: number;
  readonly nameLeft: number;
  readonly pill: Rect;
}

// The pill for a name nameInk columns wide and a count countInk wide, under bar and debuffs
// debuff bars, centred across screen (a half column rounded left).
export function zonePillLayout(
  bar: Rect,
  screen: Rect,
  debuffs: number,
  ink: {
    readonly count: { readonly bottom: number; readonly top: number; readonly width: number };
    readonly name: { readonly bottom: number; readonly top: number; readonly width: number };
  },
): ZonePillLayout {
  const { gap, pad, padY, textGap } = ZONE_PILL;
  const nameHeight = ink.name.bottom - ink.name.top;
  const countHeight = ink.count.bottom - ink.count.top;
  const height = Math.max(nameHeight, countHeight) + 2 * padY;
  const above = debuffBarRects(bar, debuffs).at(-1) ?? bar;
  const width = pad + ink.name.width + textGap + ink.count.width + pad;
  const pill = {
    height,
    width,
    x: screen.x + Math.floor((screen.width - width) / 2),
    y: above.y + above.height + gap,
  };
  return {
    countRight: pill.x + width - pad,
    nameLeft: pill.x + pad,
    pill,
  };
}

// The widest a name's ink can be beside a count countInk wide, the pill inside screen.
export function zonePillNameRoom(screen: Rect, countInk: number): number {
  const { pad, textGap } = ZONE_PILL;
  return screen.width - 2 * pad - textGap - countInk;
}
