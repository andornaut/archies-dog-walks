import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { TOP_BAR_HEIGHT, TOP_BAR_SIZES } from "../data/layout.ts";

// Every top bar (the start screen's, the walk bar, Help's) is flat fill with one trim: line's
// colour across its row, and the bar's last rows in edge's colours, top to bottom. Its wells sit
// clearance rows clear of the plum's top and of the edge (topBarWellRows).
export const TOP_BAR_TRIM = {
  clearance: TOP_BAR_SIZES.trim.clearance,
  edge: ["brown", "darkBrown", "ink"],
  fill: "plum",
  line: { colour: "darkBrown", row: TOP_BAR_SIZES.trim.lineRow },
} as const;

type TrimColour =
  (typeof TOP_BAR_TRIM.edge)[number] | typeof TOP_BAR_TRIM.fill | typeof TOP_BAR_TRIM.line.colour;

// A palette colour name and the rect it fills.
interface TrimRect {
  colour: TrimColour;
  rect: Rect;
}

// The bar's fill, then its trim, as rects to fill in that order.
export function topBarRects(bar: Rect): TrimRect[] {
  const { edge, fill, line } = TOP_BAR_TRIM;
  const row = (y: number): Rect => ({ ...bar, height: 1, y: bar.y + y });
  return [
    { colour: fill, rect: bar },
    { colour: line.colour, rect: row(line.row) },
    ...edge.map((colour, i) => ({ colour, rect: row(bar.height - edge.length + i) })),
  ];
}

// The plum rows a bar height tall shows, from its top row to its edge (the HTML bar draws no trim
// line): top, the first, and bottom, one past the last.
export function topBarContentRows(height: number): { bottom: number; top: number } {
  return { bottom: height - TOP_BAR_TRIM.edge.length, top: 0 };
}

// A well's top row and height on a bar height tall: clearance rows clear of the plum's top and
// of the edge, so it is centred down the plum.
function topBarWellRows(height: number): { height: number; y: number } {
  const { bottom, top } = topBarContentRows(height);
  const { clearance } = TOP_BAR_TRIM;
  return { height: bottom - top - 2 * clearance, y: top + clearance };
}

// Every top bar's height: the start screen's, the walk bar and Help's.
export { TOP_BAR_HEIGHT };

// The top bar's plum rows and their middle row, which each button's 20-row ui-icon-button-normal
// face is centred on, the upper half of the face above it, so any odd row is left under the face.
const TOP_BAR_ROWS = topBarContentRows(TOP_BAR_HEIGHT);
export const TOP_BAR_MID =
  TOP_BAR_ROWS.top + Math.floor((TOP_BAR_ROWS.bottom - TOP_BAR_ROWS.top) / 2);
const FACE_SIZE = TOP_BAR_SIZES.faceSize;
// art: fill is ui-icon-button-normal's navy face inside its tan rim, from its highlight row to its
// lip; ui-icon-button-pressed has it BUTTON_SIZE.press rows lower.
export const TOP_BAR_FACE = {
  fill: { height: 16, width: 18, x: 1, y: 1 },
  size: FACE_SIZE,
  y: TOP_BAR_MID - FACE_SIZE / 2,
} as const;

// The well at a top bar's left that shows the money (the start screen's bank, the walk's cash):
// clear of the trim, x columns in from the bar's left, ink on all but its lip's last row.
export const TOP_BAR_WELL = {
  ...topBarWellRows(TOP_BAR_HEIGHT),
  lip: TOP_BAR_SIZES.well.lip,
  x: TOP_BAR_SIZES.well.x,
} as const;

// The top row of text capRows tall set in the well: centred on its ink rows (the well less its
// lip's row), a half row lower where their parities differ.
export function wellCapsTop(capRows: number): number {
  const { height, lip, y } = TOP_BAR_WELL;
  return y + Math.ceil((height - lip - capRows) / 2);
}
