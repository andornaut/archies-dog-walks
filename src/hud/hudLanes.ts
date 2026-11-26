import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { CHANGE_CHIP, HUD_LANES, LABEL_ICON } from "../data/index.ts";
import type { ScreenLayout } from "../layout/screenLayout.ts";
import { centredInkOffsets } from "../ui/centredInkBlock.ts";
import { TEXT_STYLE } from "../ui/textFit.ts";
import { OWNER_TAB } from "./walkHud.ts";

// Each transient layer of the walk's HUD keeps to its own lane, so none covers another. The
// message strip (messageStrip.ts) runs across the top of the backdrop band under the walk bar,
// and carries hints, badges and the walk's events. A money change pops where it changed hands,
// a tip's by the cash, and flies to the cash (moneyLabels.ts), in no lane. The lanes:
// - ownerTabs: the row the owners' photo tabs pop into, over the road's last rows and the cards'
//   tops. A heart change's number keeps above it.
// - heartLabels: a heart change, by slot, on the card's bottom rows.
export interface HudLanes {
  heartLabels: Rect[];
  ownerTabs: Rect;
}

const HEART_LABEL = HUD_LANES.heartLabel;
const MARGIN = HEART_LABEL.margin;
const HEART_LABEL_HEIGHT = HEART_LABEL.height;

export function hudLanes(layout: Pick<ScreenLayout, "dogRow" | "dogSlots">): HudLanes {
  const { dogRow, dogSlots } = layout;
  const cardTop = Math.min(...dogSlots.map((slot) => slot.y));
  return {
    heartLabels: dogSlots.map((slot) => ({
      height: HEART_LABEL_HEIGHT,
      width: slot.width - MARGIN,
      x: slot.x + MARGIN / 2,
      y: slot.y + slot.height - HEART_LABEL_HEIGHT - HEART_LABEL.foot,
    })),
    ownerTabs: {
      height: -OWNER_TAB.y,
      width: dogRow.width,
      x: dogRow.x,
      y: cardTop + OWNER_TAB.y,
    },
  };
}

// A change label: its text on a cream chip, padX either side, at least height tall and padY
// over and under the text's ink, the ink centred in it. A heart label sits at its lane's middle.
export { CHANGE_CHIP };

// At 2x on one line: a change label says its amount alone.
export const CHANGE_LABEL_STYLE = TEXT_STYLE;

// How wide a change label's ink may be in a lane width wide.
export function changeLabelRoom(laneWidth: number): number {
  return laneWidth - 2 * CHANGE_CHIP.padX;
}

// A change label's chip at the top-left of at, and where its ink's left edge and capitals' top
// go, for text on lines lines at scale, its ink width wide: the text's measured ink (ink, or its
// lines' rows from the capitals' top) centred inside the chip's 1-pixel frame, any odd row under
// it.
export function changeChipAt(
  body: FontMetrics,
  at: Point,
  text: ChipText,
): { chip: Rect; text: Point } {
  const { height: least, padX, padY } = CHANGE_CHIP;
  const rows = inkRowsOfLines(body, text.lines) * text.scale;
  const height = Math.max(least, rows + 2 * padY);
  const chip = { height, width: text.width + 2 * padX, x: at.x, y: at.y };
  const ink = text.ink ?? { rows, top: 0 };
  return {
    chip,
    text: { x: at.x + padX, y: at.y + 1 + Math.floor((height - 2 - ink.rows) / 2) - ink.top },
  };
}

// The text a change label's chip is placed for: on lines lines at scale, its ink width wide, and
// its measured ink's rows and top under the first line's capitals' top where it is known.
export interface ChipText {
  ink?: { readonly rows: number; readonly top: number };
  lines: number;
  scale: number;
  width: number;
}

// A reached pickup's change label shows the reaching buff's icon, size square, inside its chip at
// its left, gap columns left of its text; the chip widens by span to hold it.
const REACH_ICON_SIZE = LABEL_ICON;
const REACH_ICON_GAP = HUD_LANES.reachIconGap;
export const REACH_ICON = {
  gap: REACH_ICON_GAP,
  size: REACH_ICON_SIZE,
  span: REACH_ICON_SIZE + REACH_ICON_GAP,
} as const;

// A change label's chip as place puts it, and where its ink's left edge and capitals' top go,
// for text; with reached, its chip widened by REACH_ICON.span and placed as place places a chip
// that wide, the icon's top-left at its left and the text's ink past the icon. The icon and the
// text's ink are one group on the chip's flat fill inside its 1-row frame: place centres the
// text's ink down the fill and the icon is centred down it too (centredInkOffsets), so the group
// is, any odd row under. icon is null without reached.
export function reachChipPlace(
  place: (text: ChipText) => { chip: Rect; text: Point },
  reached: boolean,
  text: ChipText,
): { chip: Rect; icon: Point | null; text: Point } {
  if (!reached) {
    return { ...place(text), icon: null };
  }
  const { size, span } = REACH_ICON;
  const { chip, text: ink } = place({ ...text, width: text.width + span });
  const fill = { height: chip.height - 2, width: chip.width - 2, x: chip.x + 1, y: chip.y + 1 };
  const [offset] = centredInkOffsets(fill, [{ height: size, width: size, x: 0, y: 0 }]);
  return {
    chip,
    icon: { x: ink.x, y: offset!.y },
    text: { x: ink.x + span, y: ink.y },
  };
}

// A change label's chip in the middle of lane, and where its ink's left edge and capitals' top
// go, for text on lines lines at scale, its ink width wide.
export function changeChipPlace(
  body: FontMetrics,
  lane: Rect,
  text: { lines: number; scale: number; width: number },
): { chip: Rect; text: Point } {
  const { height } = changeChipAt(body, lane, text).chip;
  return changeChipAt(
    body,
    { x: lane.x, y: lane.y + Math.floor((lane.height - height) / 2) },
    text,
  );
}
