import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";

import { HELP_SCREEN, MIN_PRESS, SHOP_PAGE } from "../data/layout.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { MODAL } from "../ui/modalGeometry.ts";
import { PAGE_LAYOUT } from "../ui/pageLayout.ts";
import { type ScrollbarRects, scrollbarRects } from "../ui/scrollbar.ts";
import { BODY_ASCENT_ROWS, BODY_INK_ROWS, TEXT_SCALE, TITLE_CAP_ROWS } from "../ui/textFit.ts";
import type { HelpAction } from "./helpPaging.ts";

const { screen: SCREEN } = SCREEN_LAYOUT;
const { height, width } = SCREEN;
const HELP = HELP_SCREEN;

// The frame's lines, an ink line round a plum one, as the house chrome's, and the well's rings
// round the picture, an ink ring round a plum one.
export const FRAME_LINES = 2;
export const WELL_RINGS = 2;

// Help is a page under the live top bar: it covers the screen from the bar's foot down.
const PAGE = PAGE_LAYOUT.rect;
// The picture at full size, centred across the screen, its columns those of the walk screen
// under it; its well's rings round it, the cream pad round them and the frame's lines round that.
const PICTURE = {
  ...HELP.picture,
  x: (width - HELP.picture.width) / 2,
  y: PAGE.y + HELP.frame.top + FRAME_LINES + HELP.frame.pad + WELL_RINGS,
} as const;
const grow = (rect: Rect, by: number): Rect => ({
  height: rect.height + 2 * by,
  width: rect.width + 2 * by,
  x: rect.x - by,
  y: rect.y - by,
});
const WELL = grow(PICTURE, WELL_RINGS);
// The caption's capitals the caption gap under the well, and the face's foot as far under its
// lowest ink.
const CAPTION_Y = WELL.y + WELL.height + HELP.frame.captionGap;
const FACE_BOTTOM = CAPTION_Y + BODY_INK_ROWS * TEXT_SCALE + HELP.frame.captionGap;
const FRAME_TOP = grow(WELL, HELP.frame.pad + FRAME_LINES);
const FRAME: Rect = { ...FRAME_TOP, height: FACE_BOTTOM + FRAME_LINES - FRAME_TOP.y };
const TITLE_Y = FRAME.y + FRAME.height - 1 + HELP.titleGap;
const BUTTONS_Y = PAGE_LAYOUT.back.y - BUTTON_SIZE.stackGap - BUTTON_SIZE.compact.height;
const DOTS_Y = BUTTONS_Y - BUTTON_SIZE.smallGap - HELP.dots.size;
const BODY_Y = TITLE_Y + TITLE_CAP_ROWS * TEXT_SCALE + LABEL_HELP_GAP;
// Each body line's slot, lineHeight rows from its letters' top, holds the line's whole ink; the
// viewport shows whole slots only.
const BODY_TOP = BODY_Y - BODY_ASCENT_ROWS * HELP.body.scale;
const DOTS_HIT_TOP = DOTS_Y - (MIN_TAP_SIZE - HELP.dots.size) / 2;
const BODY_HEIGHT =
  Math.floor((DOTS_HIT_TOP - MODAL.gap - BODY_TOP) / HELP.body.lineHeight) * HELP.body.lineHeight;
const BODY_VIEWPORT = { height: BODY_HEIGHT, width, x: 0, y: BODY_TOP } as const;
// The Logbook's and the Pet shop's scrollbar, at the pages' track.
const SCROLLBAR = { ...SHOP_PAGE.scrollbar, x: PAGE_LAYOUT.trackX } as const;

// The help page's geometry at the render resolution. A text position is its first line's
// left edge and capitals' top.
// The page has no heading and no close control: the top bar over it is the screen's own.
// The framed picture comes first, its caption centred across the well under it, then the page's
// title and body. The body's lines, at most maxLines of them, are lineHeight apart, its capitals
// the label gap under the title's actual ink, and stop scrollGap short of the scrollbar's track.
// The body scrolls in its viewport, whole lines at a time.
// The page's own presses (swipes and taps) start under the top bar's press columns, which reach
// MIN_PRESS rows down.
export const HELP_LAYOUT = {
  body: {
    ...HELP.body,
    viewport: BODY_VIEWPORT,
    width: SCROLLBAR.x - HELP.body.scrollGap - HELP.body.x,
    y: BODY_Y,
  },
  caption: { centreX: WELL.x + WELL.width / 2, y: CAPTION_Y },
  // A tap target apart, so each dot's target is its own slot, ending above Previous's and
  // Next's, the small button gap over their faces.
  dots: {
    centreX: width / 2,
    size: HELP.dots.size,
    spacing: MIN_TAP_SIZE,
    y: DOTS_Y,
  },
  // Back, the pages' own.
  footer: PAGE_LAYOUT.back,
  frame: FRAME,
  illustration: PICTURE,
  next: {
    ...BUTTON_SIZE.compact,
    x: width / 2 + BUTTON_SIZE.gap / 2,
    y: BUTTONS_Y,
  },
  page: PAGE,
  presses: { ...PAGE, height: PAGE.y + PAGE.height - MIN_PRESS, y: MIN_PRESS },
  previous: {
    ...BUTTON_SIZE.compact,
    x: width / 2 - BUTTON_SIZE.gap / 2 - BUTTON_SIZE.compact.width,
    y: BUTTONS_Y,
  },
  screen: SCREEN,
  scrollbar: SCROLLBAR,
  title: { ...HELP.title, y: TITLE_Y },
  well: WELL,
} as const;

// The art's rect grown about its centre to at least MIN_TAP_SIZE each way, then shifted back
// onto the screen, so small art keeps a full-size target.
export function tapRect(art: Rect): Rect {
  const grow = (start: number, size: number, limit: number) => {
    const grown = Math.max(size, MIN_TAP_SIZE);
    const from = start - (grown - size) / 2;
    return { from: Math.min(Math.max(0, from), limit - grown), grown };
  };
  const across = grow(art.x, art.width, width);
  const down = grow(art.y, art.height, height);
  return { height: down.grown, width: across.grown, x: across.from, y: down.from };
}

// The body's scrollbar for a body max rows taller than its viewport, scrolled y, or null for one
// that fits.
export function helpScrollbar(max: number, y: number): ScrollbarRects | null {
  return scrollbarRects(SCROLLBAR, BODY_VIEWPORT, max, y);
}

// One dot per page, centred as a row.
export function dotRects(pageCount: number): Rect[] {
  const { centreX, size, spacing, y } = HELP_LAYOUT.dots;
  const left = centreX - (pageCount * spacing) / 2 + (spacing - size) / 2;
  return Array.from({ length: pageCount }, (_, i) => ({
    height: size,
    width: size,
    x: Math.round(left + i * spacing),
    y,
  }));
}

export interface HelpActionBounds {
  readonly footer: Rect;
  readonly next: Rect;
  readonly previous: Rect;
}

// The rendered button or dot under a tap, if any.
export function helpActionAt(
  pageCount: number,
  actions: HelpActionBounds,
  { x, y }: Point,
): HelpAction | undefined {
  if (containsPoint(actions.footer, x, y)) {
    return { kind: "close" };
  }
  if (containsPoint(actions.previous, x, y)) {
    return { kind: "previous" };
  }
  if (containsPoint(actions.next, x, y)) {
    return { kind: "advance" };
  }
  const page = rectIndexAt(dotRects(pageCount).map(tapRect), x, y);
  return page === undefined ? undefined : { kind: "goTo", page };
}
