import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  type BitmapFont,
  type FontMetrics,
  fontMetrics,
  inkRowsFromCapTop,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { DOG_SLOTS } from "../data/dogSlots.ts";
import { BODY_PITCH, LABEL_VALUE_GAP, SHOP_PAGE } from "../data/layout.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { PAGE_LAYOUT } from "../ui/pageLayout.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { SELECT_OUTSET } from "../ui/selection.ts";
import { TEXT_SCALE, TEXT_STYLE, TITLE_CAP_ROWS } from "../ui/textFit.ts";
import { FEEDBACK } from "./feedback.ts";

// The Pet shop page under the home screen's top bar, which stays in view with the bank: a
// frameless page (PAGE_LAYOUT) with its heading, the Dogs and Gear tabs, each tab's lists and
// Back. Rows are hit areas at least MIN_PRESS tall; tabs draw 28 tall in a MIN_PRESS-tall hit
// area. The lists scroll in the list area under the tabs, laid out here as they sit scrolled to
// the top. The Logbook wears the same page (src/home/statsLayout.ts).
const SHOP = SHOP_PAGE;
const PANEL = PAGE_LAYOUT.rect;
const PAGE_TITLE = cardTitleRow(PANEL);
const BACK = PAGE_LAYOUT.back;
const TRACK_X = PAGE_LAYOUT.scrollbar.x;
// The tabs span the page's inset. Rows start at the inset and stop scrollGap short of the
// scrollbar's track whether or not the list scrolls, so its room is always reserved.
const ROW_X = PANEL.x + PAGE_LAYOUT.inset;
const TAB_SPAN = PANEL.width - 2 * PAGE_LAYOUT.inset;
const ROW_WIDTH = TRACK_X - SHOP.row.scrollGap - ROW_X;
// The tabs' targets sit under the heading, each selected face lifted below it and centred in its
// target.
const TAB_Y =
  PANEL.y + MODAL.header - (SHOP.tab.height - SHOP.tab.drawHeight) / 2 + FEEDBACK.liftPx;
const TAB = {
  drawHeight: SHOP.tab.drawHeight,
  drawY: TAB_Y + Math.floor((SHOP.tab.height - SHOP.tab.drawHeight) / 2),
  gap: SHOP.tab.gap,
  height: SHOP.tab.height,
  span: TAB_SPAN,
  x: ROW_X,
  y: TAB_Y,
};
// A selected tab's shadow ends SELECT_OUTSET under its face, within its target.
const TAB_BOTTOM = TAB.drawY + TAB.drawHeight + SELECT_OUTSET;
const TAB_GAP = SHOP.tab.listGap;
// The list area: from listClear rows under the tabs' targets to the group gap over Back, from the
// page's left edge to trackGap short of the scrollbar's track.
const LIST_Y = Math.max(TAB_BOTTOM, TAB.y + TAB.height) + SHOP.tab.listClear;
const LIST = {
  height: BACK.y - MODAL.gap - LIST_Y,
  width: TRACK_X - SHOP.list.trackGap - PANEL.x,
  x: PANEL.x,
  y: LIST_Y,
};
// The message's plate across the tabs' span at the list's top. Each tab's first heading takes
// the plate's strip, its capitals centred on it as the message's are, and the first rows start
// TAB_GAP under the plate, so a message never covers a row.
const PLATE = { height: SHOP.plateHeight, width: TAB.span, x: TAB.x, y: LIST.y };
const HEADING_CAP_OFFSET = Math.floor((PLATE.height - TITLE_CAP_ROWS * TEXT_SCALE) / 2);
const FIRST_HEADING_Y = PLATE.y + HEADING_CAP_OFFSET;
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
  gap: BUTTON_SIZE.stackGap,
  height,
  pitch: height + BUTTON_SIZE.stackGap,
});
const SLOT_ROWS = { ...listRows(SHOP.slotRows), y: FIRST_ROWS_Y };
const DOG_HEADING_Y =
  SLOT_ROWS.y + (DOG_SLOTS.length - 1) * SLOT_ROWS.pitch + SLOT_ROWS.height + ROWS_TO_HEADING;

export const SHOP_LAYOUT = {
  // Back, the page's only leave, fixed under the list.
  back: BACK,
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
  // Headings sit on the page at the rows' left, a note right-aligned at their right.
  headingX: ROW_X,
  // The headings and rows scroll in rect, masked to it, with padBottom of page under the last
  // row when scrolled to the bottom. A page key moves the list its height less pageOverlap,
  // keeping the row at the edge in view.
  // firstHeadingY is where each tab's first heading puts its capitals.
  list: {
    firstHeadingY: FIRST_HEADING_Y,
    padBottom: SHOP.list.padBottom,
    pageOverlap: SHOP.list.pageOverlap,
    rect: LIST,
  },
  // The last tap's message: one line on the ui-hint plate across the tabs' span at the list's
  // top, over the first heading, from textDx inside the plate's left and right edges, its
  // capitals centred on the plate. The plate's frame is frame pixels thick.
  message: {
    frame: SHOP.message.frame,
    plate: PLATE,
    textDx: SHOP.message.textDx,
  },
  // The page under the top bar, one cream fill to the screen's edges.
  panel: PANEL,
  // In a row: the 36x36 art box and the art in it, the badge over the row's top-left
  // corner, the name and line, and the price plate or OWNED (ownedDx left of the tick's right
  // edge) plateInset inside the right edge, the name and line keeping textGap clear of it. A
  // row is width wide, its right edge clear of the scrollbar's room.
  row: {
    art: SHOP.row.art,
    badge: SHOP.row.badge,
    box: SHOP.row.box,
    ownedDx: SHOP.row.ownedDx,
    plateInset: SHOP.row.plateInset,
    textDx: SHOP.row.textDx,
    textGap: LABEL_VALUE_GAP,
    width: ROW_WIDTH,
    x: ROW_X,
  },
  // The tabs split span, the rows' width from x, their faces gap apart, each a hit area height
  // tall at y with its face drawHeight tall at drawY (shopTabRects, shopTabFace).
  tab: TAB,
  title: { capTop: PAGE_TITLE.y, row: PAGE_TITLE },
} as const;

// The message at 2x on one line inside its plate.
export const SHOP_MESSAGE_FIT = {
  room: PLATE.width - 2 * SHOP_LAYOUT.message.textDx,
  style: TEXT_STYLE,
} as const;

// The bottom of a list of count rows, with the list area's padding under it. A list with no
// rows keeps one row's room, for the line saying so.
export function shopListBottom(
  spec: { height: number; pitch: number; y: number },
  count: number,
): number {
  return spec.y + (Math.max(1, count) - 1) * spec.pitch + spec.height + SHOP_LAYOUT.list.padBottom;
}

// The list's area (its mask and hit area), its rows' width and its heading notes' right edge,
// the same whether or not the list scrolls.
export function shopListFrame(): { headingRight: number; rect: Rect; rowWidth: number } {
  const { list, row } = SHOP_LAYOUT;
  return { headingRight: row.x + row.width, rect: list.rect, rowWidth: row.width };
}

// A heading's strip, the plate's height, across the rows: its ink from their left edge and its
// note's ink up to their right.
export function shopHeadingBand(capTop: number): Rect {
  const { row } = SHOP_LAYOUT;
  return { height: PLATE.height, width: row.width, x: row.x, y: capTop - HEADING_CAP_OFFSET };
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

// The end of the visible row content, excluding the authored gap to its next section.
export function shopRowsBottom(spec: { y: number }, rects: readonly Rect[]): number {
  const last = rects.at(-1);
  return last === undefined ? spec.y : last.y + last.height;
}

export function shopNextHeading(spec: { y: number }, rects: readonly Rect[]): number {
  return shopRowsBottom(spec, rects) + ROWS_TO_HEADING;
}

const SHOP_ROW_TEXT_GAP = 4;
const SHOP_ROW_TEXT_PAD = 4;

function shopInkRows(font: BitmapFont, text: string): { bottom: number; top: number } {
  const glyphs = [...plainMarks(text)].flatMap((char) => {
    const glyph = font.glyphs.get(char);
    return glyph !== undefined && glyph.width > 0 && glyph.height > 0 ? [glyph] : [];
  });
  const { capTop } = fontMetrics(font);
  return glyphs.length === 0
    ? { bottom: 0, top: 0 }
    : {
        bottom:
          (Math.max(...glyphs.map(({ height, yOffset }) => yOffset + height)) - capTop) *
          TEXT_SCALE,
        top: (Math.min(...glyphs.map(({ yOffset }) => yOffset)) - capTop) * TEXT_SCALE,
      };
}

// Centre the name and wrapped description's visible ink, growing only for the measured block.
export function shopRowTextLayout(
  font: BitmapFont,
  minimum: number,
  { descriptions, name }: { readonly descriptions: readonly string[]; readonly name: string },
): { descriptions: readonly number[]; height: number; name: number } {
  const label = shopInkRows(font, name);
  const pitch = BODY_PITCH;
  const lines = descriptions.map((text, index) => {
    const ink = shopInkRows(font, text);
    return { bottom: ink.bottom + index * pitch, top: ink.top + index * pitch };
  });
  const descriptionY =
    lines.length === 0
      ? 0
      : label.bottom + SHOP_ROW_TEXT_GAP - Math.min(...lines.map(({ top }) => top));
  const bottom =
    lines.length === 0
      ? label.bottom
      : descriptionY + Math.max(...lines.map(({ bottom }) => bottom));
  const block = bottom - label.top;
  const height = Math.max(minimum, block + 2 * SHOP_ROW_TEXT_PAD);
  const nameY = Math.floor((height - block) / 2) - label.top;
  return {
    descriptions: descriptions.map((_, i) => nameY + descriptionY + i * pitch),
    height,
    name: nameY,
  };
}

// The message grows from the authored one-line plate; callers reserve its extra rows.
export function shopMessageLayout(
  body: FontMetrics,
  lineCount: number,
): {
  capTops: number[];
  extraHeight: number;
  plate: Rect;
} {
  const pitch = body.lineHeight * TEXT_SCALE;
  const extraHeight = Math.max(0, lineCount - 1) * pitch;
  const plate = { ...PLATE, height: PLATE.height + extraHeight };
  const blockHeight = inkRowsFromCapTop(body) * TEXT_SCALE + extraHeight;
  const top = plate.y + Math.floor((plate.height - blockHeight) / 2);
  return {
    capTops: Array.from({ length: lineCount }, (_, i) => top + i * pitch),
    extraHeight,
    plate,
  };
}

// How wide the name and line of a row rowWidth wide may be beside the price plate or OWNED,
// rightWidth wide from its left edge to the row's right edge less plateInset.
export function shopRowTextRoom(rowWidth: number, rightWidth: number): number {
  const { plateInset, textDx, textGap } = SHOP_LAYOUT.row;
  return rowWidth - plateInset - rightWidth - textGap - textDx;
}
