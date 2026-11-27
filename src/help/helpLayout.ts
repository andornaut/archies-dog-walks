import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { arrangePager, type PagerArrangement } from "@andornaut/game-kit/runtime/ui/pager";

import { BUTTON_SIZE, HELP_SCREEN, LABEL_HELP_GAP, MIN_PRESS, PAGE } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import {
  BODY_ASCENT_ROWS,
  BODY_INK_ROWS,
  MODAL,
  PAGE_LAYOUT,
  TEXT_SCALE,
  TITLE_CAP_ROWS,
} from "../ui/index.ts";
import type { HelpAction } from "./helpPaging.ts";

const { screen: SCREEN } = SCREEN_LAYOUT;
const { width } = SCREEN;
const HELP = HELP_SCREEN;

// The frame's lines, an ink line round a plum one, as the house chrome's, and the well's rings
// round the picture, an ink ring round a plum one.
export const FRAME_LINES = 2;
export const WELL_RINGS = 2;

// Help is a page under the live top bar: it covers the screen from the bar's foot down.
const PAGE_RECT = PAGE_LAYOUT.rect;
// The picture at full size, centred across the screen, its columns those of the walk screen
// under it; its well's rings round it, the cream pad round them and the frame's lines round that.
const PICTURE = {
  ...HELP.picture,
  x: (width - HELP.picture.width) / 2,
  y: PAGE_RECT.y + HELP.frame.top + FRAME_LINES + HELP.frame.pad + WELL_RINGS,
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
// The pager's room: the Large panel's body columns.
const PAGER_X = MODAL.margin;
const BODY_Y = TITLE_Y + TITLE_CAP_ROWS * TEXT_SCALE + LABEL_HELP_GAP;
// Each body line's slot, lineHeight rows from its letters' top, holds the line's whole ink; the
// viewport shows whole slots only.
const BODY_TOP = BODY_Y - BODY_ASCENT_ROWS * HELP.body.scale;
const BODY_HEIGHT =
  Math.floor((BUTTONS_Y - MODAL.gap - BODY_TOP) / HELP.body.lineHeight) * HELP.body.lineHeight;
const BODY_VIEWPORT = { height: BODY_HEIGHT, width, x: 0, y: BODY_TOP } as const;

// The help page's geometry at the render resolution. A text position is its capitals' top and
// its first line's left edge, or the centre its ink is centred on.
// The page has no heading and no close control: the top bar over it is the screen's own.
// The framed picture comes first, its caption centred across the well under it, then the page's
// title and body, then the pager: Previous, the page dots and Next in one row centred in its room,
// over Back. The body's lines, at most maxLines of them, are lineHeight apart, its capitals
// the label gap under the title's actual ink, and stop PAGE.trackGap short of the pages'
// scrollbar track.
// The body scrolls in its viewport, whole lines at a time.
// The page's own presses (swipes and taps) start under the top bar's press columns, which reach
// MIN_PRESS rows down.
export const HELP_LAYOUT = {
  body: {
    ...HELP.body,
    viewport: BODY_VIEWPORT,
    width: PAGE_LAYOUT.scrollbar.x - PAGE.trackGap - HELP.body.x,
    y: BODY_Y,
  },
  caption: { centreX: WELL.x + WELL.width / 2, y: CAPTION_Y },
  // Back, the pages' own.
  footer: PAGE_LAYOUT.back,
  frame: FRAME,
  illustration: PICTURE,
  page: PAGE_RECT,
  // The pager's row: its room, the row's top, and the dots' side and gap.
  pager: {
    dots: HELP.dots,
    height: BUTTON_SIZE.compact.height,
    width: width - 2 * PAGER_X,
    x: PAGER_X,
    y: BUTTONS_Y,
  },
  presses: { ...PAGE_RECT, height: PAGE_RECT.y + PAGE_RECT.height - MIN_PRESS, y: MIN_PRESS },
  screen: SCREEN,
  // The page's title, centred across the screen on its visible ink.
  title: { ...HELP.title, centreX: width / 2, y: TITLE_Y },
  well: WELL,
} as const;

// The pager for pageCount pages, Previous previousWidth wide and Next nextWidth: the dots' row,
// each dot its side and gap apart, between the buttons in the pager's room (arrangePager). Each
// button's press area is its face and half the stacked gap round it, as a stacked button's is, so
// it stops short of the dots and of Back the stacked gap below.
export function helpPager(
  pageCount: number,
  widths: { readonly next: number; readonly previous: number },
): PagerArrangement {
  const { dots, height, width, x, y } = HELP_LAYOUT.pager;
  return arrangePager(
    { origin: { x, y }, press: { margin: BUTTON_SIZE.stackGap / 2 }, width },
    {
      count: { height: dots.size, width: pageCount * dots.size + (pageCount - 1) * dots.gap },
      next: { height, width: widths.next },
      previous: { height, width: widths.previous },
    },
  );
}

// The dots in the pager's count, left to right.
export function dotRects(count: Rect, pageCount: number): Rect[] {
  const { gap, size } = HELP_LAYOUT.pager.dots;
  return Array.from({ length: pageCount }, (_, i) => ({
    height: size,
    width: size,
    x: count.x + i * (size + gap),
    y: count.y,
  }));
}

export interface HelpActionBounds {
  readonly footer: Rect;
  readonly next: Rect;
  readonly previous: Rect;
}

// The rendered button under a tap, if any.
export function helpActionAt(actions: HelpActionBounds, { x, y }: Point): HelpAction | undefined {
  if (containsPoint(actions.footer, x, y)) {
    return { kind: "close" };
  }
  if (containsPoint(actions.previous, x, y)) {
    return { kind: "previous" };
  }
  if (containsPoint(actions.next, x, y)) {
    return { kind: "advance" };
  }
  return undefined;
}
