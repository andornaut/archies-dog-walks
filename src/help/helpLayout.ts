import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";

import { HELP_SCREEN, MIN_PRESS, TOP_BAR_HEIGHT } from "../data/layout.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { MODAL } from "../ui/modalGeometry.ts";
import { BODY_INK_ROWS, TEXT_SCALE, TITLE_CAP_ROWS } from "../ui/textFit.ts";
import type { HelpAction } from "./helpPaging.ts";

const { screen: SCREEN } = SCREEN_LAYOUT;
const { height, width } = SCREEN;
const HELP = HELP_SCREEN;

// The frame's lines, an ink line round a plum one, as the house chrome's, and the well's rings
// round the picture, an ink ring round a plum one.
export const FRAME_LINES = 2;
export const WELL_RINGS = 2;

// Help is a page under the live top bar: it covers the screen from the bar's foot down.
const PAGE = { height: height - TOP_BAR_HEIGHT, width, x: 0, y: TOP_BAR_HEIGHT } as const;
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
const FOOTER_Y = height - HELP.buttonsFoot - BUTTON_SIZE.compact.height;
const BUTTONS_Y = FOOTER_Y - BUTTON_SIZE.stackGap - BUTTON_SIZE.compact.height;
const DOTS_Y = BUTTONS_Y - BUTTON_SIZE.smallGap - HELP.dots.size;
const BODY_Y = TITLE_Y + TITLE_CAP_ROWS * TEXT_SCALE + LABEL_HELP_GAP;
const DOTS_HIT_TOP = DOTS_Y - (MIN_TAP_SIZE - HELP.dots.size) / 2;
const BODY_HEIGHT =
  Math.floor((DOTS_HIT_TOP - MODAL.gap - BODY_Y) / HELP.body.lineHeight) * HELP.body.lineHeight;

// The help page's geometry at the render resolution. A text position is its first line's
// left edge and capitals' top.
// The page has no heading and no close control: the top bar over it is the screen's own.
// The framed picture comes first, its caption centred across the well under it, then the page's
// title and body. The body's lines, at most maxLines of them, are lineHeight apart, its capitals
// the label gap under the title's actual ink.
// The page's own presses (swipes and taps) start under the top bar's press columns, which reach
// MIN_PRESS rows down.
export const HELP_LAYOUT = {
  body: {
    ...HELP.body,
    viewport: { height: BODY_HEIGHT, width, x: 0, y: BODY_Y },
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
  footer: { ...BUTTON_SIZE.compact, x: (width - BUTTON_SIZE.compact.width) / 2, y: FOOTER_Y },
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

// The button or dot under a tap, if any.
export function helpActionAt(pageCount: number, { x, y }: Point): HelpAction | undefined {
  if (containsPoint(HELP_LAYOUT.footer, x, y)) {
    return { kind: "close" };
  }
  if (containsPoint(tapRect(HELP_LAYOUT.previous), x, y)) {
    return { kind: "previous" };
  }
  if (containsPoint(tapRect(HELP_LAYOUT.next), x, y)) {
    return { kind: "advance" };
  }
  const page = rectIndexAt(dotRects(pageCount).map(tapRect), x, y);
  return page === undefined ? undefined : { kind: "goTo", page };
}
