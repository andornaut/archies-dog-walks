import type { Rect } from "@andornaut/game-kit/rect";
import { type FontMetrics, inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";

import { DOG_SLOTS } from "../data/dogSlots.ts";
import { SHOP_PAGE } from "../data/layout.ts";
import { TITLE_CAP_ROWS } from "../hud/walkHud.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { pageCloseControl } from "../ui/closeControl.ts";
import { helpCapDy } from "../ui/labelHelpGap.ts";
import { type ScrollbarRects, scrollbarRects } from "../ui/scrollbar.ts";
import { SELECT_OUTSET } from "../ui/selection.ts";
import { TEXT_SCALE, TEXT_STYLE } from "../ui/textFit.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";

// The Pet shop page under the home screen's top bar, which stays in view with the bank:
// a card with its title and close control, the Dogs and Gear tabs, and each tab's
// lists. Rows are hit areas at least MIN_PRESS tall; tabs draw 28 tall in a MIN_PRESS-tall hit
// area. The
// lists scroll in the list area under the tabs, laid out here as they sit scrolled to the top.
// The Logbook wears the same page (src/home/statsLayout.ts).
const SHOP = SHOP_PAGE;
const PANEL = SHOP.panel;
// The framed pages keep their header above the existing tab strip.
const PAGE_TITLE = {
  height: SHOP.title.height,
  width: PANEL.width - 2 * SHOP.title.inset,
  x: PANEL.x + SHOP.title.inset,
  y: PANEL.y + SHOP.title.inset,
};
// The close control's press area starts under the top bar's, which reach over the card's top.
const CLOSE = pageCloseControl(PANEL, SHOP.closeInset);
const CLOSE_TOP = Math.max(CLOSE.hit.y, HOME_LAYOUT.topBar.hitHeight);
const PAGE_CLOSE = {
  ...CLOSE,
  hit: { ...CLOSE.hit, y: CLOSE_TOP },
  x: PANEL.x + PANEL.width - SHOP.closeInset - BUTTON_SIZE.icon.face,
  y: PANEL.y + SHOP.closeInset,
};
const ROW_X = PANEL.x + SHOP.row.inset;
// Rows run to the tabs' right edge, or with a scrollbar stop 6px short of its track.
const ROW_WIDTH = SHOP.row.width;
const ROW_SCROLL_WIDTH = SHOP.row.scrollWidth;
// Both pages keep every tab target directly below the close target, each face centred down its
// target.
const TAB_Y = PAGE_CLOSE.hit.y + PAGE_CLOSE.hit.height;
const TAB = {
  drawHeight: SHOP.tab.drawHeight,
  drawY: TAB_Y + Math.floor((SHOP.tab.height - SHOP.tab.drawHeight) / 2),
  gap: SHOP.tab.gap,
  height: SHOP.tab.height,
  span: ROW_WIDTH,
  x: ROW_X,
  y: TAB_Y,
};
// A selected tab's frame and shadow end SELECT_OUTSET under its face, within its target.
const TAB_BOTTOM = TAB.drawY + TAB.drawHeight + SELECT_OUTSET;
const TAB_GAP = SHOP.tab.listGap;
// The list area: from listClear rows under the tabs' targets to the card's inner edge, from the
// card's frame to 2px short of the scrollbar's track, or with no scrollbar to the card's frame.
const LIST_Y = Math.max(TAB_BOTTOM, TAB.y + TAB.height) + SHOP.tab.listClear;
const LIST = {
  height: PANEL.y + PANEL.height - SHOP.list.frame - LIST_Y,
  width: SHOP.list.width,
  x: PANEL.x + SHOP.list.frame,
  y: LIST_Y,
};
const LIST_UNSCROLLED = { ...LIST, width: PANEL.width - 2 * SHOP.list.frame };
// The message's plate across the tabs' span at the list's top. Each tab's first heading takes
// the plate's strip, its capitals centred on it as the message's are, and the first rows start
// TAB_GAP under the plate, so a message never covers a row.
const PLATE = { height: SHOP.plateHeight, width: TAB.span, x: TAB.x, y: LIST.y };
const FIRST_HEADING_Y = PLATE.y + Math.floor((PLATE.height - TITLE_CAP_ROWS * TEXT_SCALE) / 2);
const FIRST_ROWS_Y = PLATE.y + PLATE.height + TAB_GAP;
// Every heading sits in a strip like the first's: HEADING_TO_ROWS above its rows, and
// ROWS_TO_HEADING under the rows before it, TAB_GAP over a strip the plate's height with the
// heading's capitals centred on it as the first's are. The dogs follow however many slots there
// are.
const HEADING_TO_ROWS = FIRST_ROWS_Y - FIRST_HEADING_Y;
const ROWS_TO_HEADING = TAB_GAP + FIRST_HEADING_Y - PLATE.y;
const SLOT_HEADING_Y = FIRST_HEADING_Y;
// A list's rows, height tall, the stacked button gap apart.
const listRows = ({ height }: { height: number }) => ({
  height,
  pitch: height + BUTTON_SIZE.stackGap,
});
const SLOT_ROWS = { ...listRows(SHOP.slotRows), y: FIRST_ROWS_Y };
const DOG_HEADING_Y =
  SLOT_ROWS.y + (DOG_SLOTS.length - 1) * SLOT_ROWS.pitch + SLOT_ROWS.height + ROWS_TO_HEADING;

export const SHOP_LAYOUT = {
  close: PAGE_CLOSE,
  // The Dogs tab: the slot heading and a row for every slot, then the dog heading and rows.
  dogs: {
    dogHeadingY: DOG_HEADING_Y,
    dogRows: { ...SLOT_ROWS, y: DOG_HEADING_Y + HEADING_TO_ROWS },
    slotHeadingY: SLOT_HEADING_Y,
    slotRows: SLOT_ROWS,
  },
  // The Gear tab: its heading and rows.
  gear: {
    headingY: FIRST_HEADING_Y,
    rows: { ...listRows(SHOP.gearRows), y: FIRST_ROWS_Y },
  },
  // Headings sit on the card at the rows' left, a note right-aligned at their right.
  headingX: ROW_X,
  // The headings and rows scroll in rect, masked to it, with padBottom of card under the last
  // row when scrolled to the bottom; a list with no scrollbar is masked to unscrolledRect. A
  // page key moves the list its height less pageOverlap, keeping the row at the edge in view.
  // firstHeadingY is where each tab's first heading puts its capitals.
  list: {
    firstHeadingY: FIRST_HEADING_Y,
    padBottom: SHOP.list.padBottom,
    pageOverlap: SHOP.list.pageOverlap,
    rect: LIST,
    unscrolledRect: LIST_UNSCROLLED,
  },
  // The last tap's message: one line on the ui-hint plate across the tabs' span at the list's
  // top, over the first heading, from textDx inside the plate's left and right edges, its
  // capitals centred on the plate. The plate's frame is frame pixels thick.
  message: {
    frame: SHOP.message.frame,
    plate: PLATE,
    textDx: SHOP.message.textDx,
  },
  panel: PANEL,
  // In a row: the 36x36 art box and the art in it, the badge over the row's top-left
  // corner, the name and line, and the price plate or OWNED (ownedDx left of the tick's right
  // edge) plateInset inside the right edge, the name and line keeping textGap clear of it. A
  // row is width wide, or scrollWidth beside a scrollbar.
  row: {
    art: SHOP.row.art,
    badge: SHOP.row.badge,
    box: SHOP.row.box,
    ownedDx: SHOP.row.ownedDx,
    plateInset: SHOP.row.plateInset,
    scrollWidth: ROW_SCROLL_WIDTH,
    textDx: SHOP.row.textDx,
    textGap: SHOP.row.textGap,
    width: ROW_WIDTH,
    x: ROW_X,
  },
  // Beside a list longer than the view: a trackWidth-wide track at x, as tall as the list area,
  // and in it a thumbWidth-wide thumb thumbInset inside the track's edges, at least thumbMin
  // tall.
  scrollbar: SHOP.scrollbar,
  // The tabs split span, the rows' width from x, their faces gap apart, each a hit area height
  // tall at y with its face drawHeight tall at drawY (shopTabRects, shopTabFace).
  tab: TAB,
  title: { capTop: PAGE_TITLE.y + SHOP.title.capDy, row: PAGE_TITLE },
} as const;

// The message at 2x on one line inside its plate.
export const SHOP_MESSAGE_FIT = {
  room: PLATE.width - 2 * SHOP_LAYOUT.message.textDx,
  style: TEXT_STYLE,
} as const;

// The top of the message's capitals at scale, centred on its plate.
export function shopMessageCapTop(body: FontMetrics, scale: number): number {
  const { plate } = SHOP_LAYOUT.message;
  return plate.y + Math.floor((plate.height - body.capHeight * scale) / 2);
}

// The bottom of a list of count rows, with the list area's padding under it. A list with no
// rows keeps one row's room, for the line saying so.
export function shopListBottom(
  spec: { height: number; pitch: number; y: number },
  count: number,
): number {
  return spec.y + (Math.max(1, count) - 1) * spec.pitch + spec.height + SHOP_LAYOUT.list.padBottom;
}

// The shop list's scrollbar (scrollbarRects), or null for a list that fits.
export function shopScrollbar(max: number, y: number): ScrollbarRects | null {
  return scrollbarRects(SHOP_LAYOUT.scrollbar, LIST, max, y);
}

// The open list's area (its mask and hit area), its rows' width and its heading note's right
// edge, by whether it scrolls: a list with no scrollbar runs to the tabs' right edge.
export function shopListFrame(scrolls: boolean): {
  headingRight: number;
  rect: Rect;
  rowWidth: number;
} {
  const { list, row } = SHOP_LAYOUT;
  const rowWidth = scrolls ? row.scrollWidth : row.width;
  return {
    headingRight: row.x + rowWidth,
    rect: scrolls ? list.rect : list.unscrolledRect,
    rowWidth,
  };
}

// The faces of count tabs, left to right across the tab span, gap apart, splitting what is left
// evenly; the middle tabs take any odd pixels.
function shopTabFaces(count: number): Rect[] {
  const { drawHeight, drawY, gap, span, x } = SHOP_LAYOUT.tab;
  const room = span - (count - 1) * gap;
  const width = Math.floor(room / count);
  const odd = room - width * count;
  const extra = (i: number) => {
    const first = Math.floor((count - odd) / 2);
    return i >= first && i < first + odd ? 1 : 0;
  };
  let left = x;
  return Array.from({ length: count }, (_, i) => {
    const face = { height: drawHeight, width: width + extra(i), x: left, y: drawY };
    left += face.width + gap;
    return face;
  });
}

// The hit areas of count tabs, left to right: each its face's columns and half the gap to a
// neighbour, so they meet, the span's ends ending the first and last, height tall at y.
export function shopTabRects(count: number): Rect[] {
  const { gap, height, span, x, y } = SHOP_LAYOUT.tab;
  const faces = shopTabFaces(count);
  return faces.map((face, i) => {
    const left = i === 0 ? x : face.x - gap / 2;
    const right = i === count - 1 ? x + span : face.x + face.width + gap / 2;
    return { height, width: right - left, x: left, y };
  });
}

// A tab's face inside its hit area: the hit less half the gap on a side with a neighbour.
export function shopTabFace(hit: Rect): Rect {
  const { drawHeight, drawY, gap, span, x } = SHOP_LAYOUT.tab;
  const left = hit.x === x ? hit.x : hit.x + gap / 2;
  const right = hit.x + hit.width === x + span ? hit.x + hit.width : hit.x + hit.width - gap / 2;
  return { height: drawHeight, width: right - left, x: left, y: drawY };
}

// Rows width wide from top, pitch apart.
export function rowRects(
  width: number,
  spec: { height: number; pitch: number; y: number },
  count: number,
): Rect[] {
  const { x } = SHOP_LAYOUT.row;
  return Array.from({ length: count }, (_, i) => ({
    height: spec.height,
    width,
    x,
    y: spec.y + i * spec.pitch,
  }));
}

// The capitals' tops of a row's name and line, from the row's middle row: the line
// LABEL_HELP_GAP clear rows under the body font's lowest ink (helpCapDy), the pair from the
// name's capitals to the line's lowest ink centred down the row.
export function shopRowTextTops(body: FontMetrics): { line: number; name: number } {
  const ink = inkRowsFromCapTop(body) * 2;
  const name = -Math.floor((helpCapDy(body, 2) + ink) / 2);
  return { line: name + helpCapDy(body, 2), name };
}

// How wide the name and line of a row rowWidth wide may be beside the price plate or OWNED,
// rightWidth wide from its left edge to the row's right edge less plateInset.
export function shopRowTextRoom(rowWidth: number, rightWidth: number): number {
  const { plateInset, textDx, textGap } = SHOP_LAYOUT.row;
  return rowWidth - plateInset - rightWidth - textGap - textDx;
}
