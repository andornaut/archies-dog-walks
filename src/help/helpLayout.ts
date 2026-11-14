import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

import { HELP_SCREEN } from "../data/layout.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { pageCloseControl } from "../ui/closeControl.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { TEXT_SCALE, TITLE_CAP_ROWS } from "../ui/textFit.ts";
import { topSectionLayout } from "../ui/topSection.ts";
import type { HelpAction } from "./helpPaging.ts";

const { screen: SCREEN } = SCREEN_LAYOUT;
const { height, width } = SCREEN;
const HELP = HELP_SCREEN;

// The home pages' top bar: its height, and the row its buttons' faces and the heading's capitals
// centre on, the upper half of each above it.
const TOP_SECTION = topSectionLayout(["close"]);
const TOP_BAR = TOP_SECTION.bar;
const CLOSE = TOP_SECTION.controls[0]?.[1];
if (CLOSE === undefined) {
  throw new Error("Help requires its close control");
}
// The picture starts under the bar, its top rule on the bar's last trim row.
const ILLUSTRATION = { height: HELP.illustrationHeight, width, x: 0, y: TOP_BAR.height } as const;
const TITLE_Y = ILLUSTRATION.y + ILLUSTRATION.height + HELP.titleGap;
// Previous's and Next's top, buttonsFoot rows over the screen's bottom.
const BUTTONS_Y = height - HELP.buttonsFoot - BUTTON_SIZE.compact.height;

// The help screen's geometry at the render resolution. A text position is its first line's
// left edge and capitals' top.
// The top bar is the home pages' (HOME_LAYOUT.topBar), its heading's capitals centred on the
// bar's mid row as the home bar's button faces are, and the close control's face where the home
// bar's last face is (Exit's, or Settings' where Exit is hidden), in its MIN_TAP_SIZE square
// target in the screen's top-right corner.
// The body's lines, at most maxLines of them, are lineHeight apart, its capitals the label gap
// under the title's actual ink. The picture is the walk screen's
// width, ruled off a row above and below.
export const HELP_LAYOUT = {
  body: {
    ...HELP.body,
    y: TITLE_Y + TITLE_CAP_ROWS * TEXT_SCALE + LABEL_HELP_GAP,
  },
  close: { ...pageCloseControl(SCREEN), ...CLOSE.face, hit: CLOSE.hit },
  // A tap target apart, so each dot's target is its own slot, ending above Previous's and
  // Next's, the small button gap over their faces.
  dots: {
    centreX: width / 2,
    size: HELP.dots.size,
    spacing: MIN_TAP_SIZE,
    y: BUTTONS_Y - BUTTON_SIZE.smallGap - HELP.dots.size,
  },
  heading: { x: TOP_SECTION.heading.x, y: TOP_SECTION.heading.y },
  illustration: ILLUSTRATION,
  next: {
    ...BUTTON_SIZE.compact,
    x: width / 2 + BUTTON_SIZE.gap / 2,
    y: BUTTONS_Y,
  },
  previous: {
    ...BUTTON_SIZE.compact,
    x: width / 2 - BUTTON_SIZE.gap / 2 - BUTTON_SIZE.compact.width,
    y: BUTTONS_Y,
  },
  screen: SCREEN,
  title: { ...HELP.title, y: TITLE_Y },
  topBar: TOP_BAR,
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

// The close control's tap target.
export const CLOSE_HIT_RECT = HELP_LAYOUT.close.hit;

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
  if (containsPoint(CLOSE_HIT_RECT, x, y)) {
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
