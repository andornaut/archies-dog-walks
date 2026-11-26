import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { LABEL_VALUE_GAP, LOGBOOK_PAGE, MIN_PRESS } from "../data/index.ts";
import { helpCapDy } from "../ui/labelHelpGap.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { BADGE_STRIP, type WallCellLines } from "./badgesView.ts";
import { SHOP_LAYOUT, shopListFrame, shopTabRects } from "./shopLayout.ts";

export type StatsTab = "badges" | "dogs" | "runs";

// The Dogs tab's rows under each dog's face and name, top to bottom; each one's label is
// menuText.stats.dogColumns[stat].
export type DogStat = "fired" | "walks" | "zones";
export const DOG_STATS: readonly DogStat[] = ["walks", "zones", "fired"];

// The tabs, left to right; each one's label is menuText.stats.tabs[tab]. The Logbook opens on
// the first.
export const STATS_TABS: readonly StatsTab[] = ["badges", "dogs", "runs"];

// The Logbook wears the Pet shop's page: its fill, heading, tab span and Back, and every tab's
// content scrolling in the shop's list area beside the pages' scrollbar.
const PANEL = SHOP_LAYOUT.panel;
const VIEW = SHOP_LAYOUT.list.rect;
// Each tab's first heading, level with the shop's.
const TOP = SHOP_LAYOUT.list.firstHeadingY;
const STATS = LOGBOOK_PAGE;
const PITCH = STATS.pitch;
// Between the Dogs tab's blocks and the Walks tab's sections, under the last row's pitch.
const BLOCK_GAP = STATS.blockGap;
// Label and value rows run across the shop's rows: from the headings' left edge to the rows'
// right edge, clear of the scrollbar's room (statsListFrame).
const ROWS = {
  gap: LABEL_VALUE_GAP,
  left: SHOP_LAYOUT.headingX,
  pitch: PITCH,
  right: SHOP_LAYOUT.row.x + SHOP_LAYOUT.row.width,
};

// The Logbook's geometry.
export const STATS_LAYOUT = {
  // In the open badge, which the end screen opens too, from its top: the badge's centre at
  // badgeY, the name's capitals at nameY, the status's LABEL_HELP_GAP clear rows under the title
  // font's lowest ink (helpCapDy) and the goal's goalDy under the status's, then the goal and the
  // badge's line at 2x, centred and wrapped between x in from its left edge and textRight in from
  // its right, a line of the body font apart and gap between them; foot rows of cream under the
  // line's lowest ink, then the ui-panel's frame, frame rows deep, end the panel.
  detailText: {
    badgeY: STATS.detailText.badgeY,
    foot: MODAL.pad - STATS.detailText.frame,
    frame: STATS.detailText.frame,
    gap: STATS.detailText.gap,
    goalDy: STATS.detailText.goalDy,
    nameY: STATS.detailText.nameY,
    textRight: STATS.detailText.textRight,
    x: STATS.detailText.x,
  },
  // The Dogs tab: a block per dog from top, each its 32x32 face at the rows' left, the name in
  // the title font nameDx right of the face's left with its capitals nameY under the block's
  // top, then a row per DOG_STATS from rowsY, and gap under the last before the next block.
  // A 1px tan rule runs ruleAbove over each block after the first, ruleDx past the rows' ends.
  dogs: {
    faceSize: STATS.dogs.faceSize,
    gap: BLOCK_GAP,
    nameDx: STATS.dogs.nameDx,
    nameY: STATS.dogs.nameY,
    rowsY: STATS.dogs.rowsY,
    ruleAbove: STATS.dogs.ruleAbove,
    ruleDx: STATS.dogs.ruleDx,
    top: TOP,
  },
  panel: PANEL,
  // Label and value rows, pitch apart: the label's ink from left and the value's ink up to right,
  // clear of the scrollbar's room (statsListFrame).
  rows: ROWS,
  // Content scrolled to its end keeps the shop list's padBottom of cream under its last row. A
  // page key moves it the view's height less pageOverlap; an arrow key moves it keyStep.
  scroll: {
    keyStep: 2 * PITCH,
    padBottom: SHOP_LAYOUT.list.padBottom,
    pageOverlap: SHOP_LAYOUT.list.pageOverlap,
  },
  view: VIEW,
  // The Walks tab: the first section's heading with its capitals at top, level with the Dogs
  // tab's first block, each section's rows rowsY under its heading, and the next heading
  // sectionGap under the last row's pitch, as far as the Dogs tab's blocks are apart.
  walks: { rowsY: STATS.walks.rowsY, sectionGap: BLOCK_GAP, top: TOP },
  // The badge wall: the earned count at the rows' right with its capitals at headingY, then one
  // badge per row from y, gap apart, each the badge badgeTop under the row's top then a text
  // column of up to lines lines at 2x from x (the name, the goal, then a locked badge's
  // progress across walks, wallLineTops), its capitals' top y under the row's top and its last
  // line's pitch and pad over the row's bottom. The wall ends foot under its last row. An
  // earned badge's row lies on a band in earned.fill with a 1px earned.outline frame, across
  // the view: bandWidth wide from bandLeft left of the row, and bandY over and under it. The
  // ui-check tick, checkSize square, sits over the badge's top-right corner, its top-left
  // checkDx right of the row's left and checkDy below its top.
  wall: {
    badgeTop: STATS.wall.badgeTop,
    earned: {
      bandLeft: ROWS.left - VIEW.x,
      bandWidth: VIEW.width,
      bandY: STATS.wall.earned.bandY,
      checkDx: STATS.wall.earned.checkDx,
      checkDy: STATS.wall.earned.checkDy,
      checkSize: STATS.wall.earned.checkSize,
      fill: "yellow",
      outline: "amber",
    },
    foot: STATS.wall.foot,
    gap: STATS.wall.gap,
    headingY: TOP,
    width: ROWS.right - ROWS.left,
    x: ROWS.left,
    y: TOP + STATS.wall.rowsDy,
  },
  wallText: {
    ...STATS.wallText,
    width: ROWS.right - ROWS.left - STATS.wallText.x,
  },
} as const;

// The fonts the open badge's text is set in: its name in title, the rest in body.
interface BadgeDetailFonts {
  readonly body: FontMetrics;
  readonly title: FontMetrics;
}

// The capitals' tops of the open badge's status, goal and line, from its top, under a goal
// goalLines lines long.
export function detailTextTops(
  fonts: BadgeDetailFonts,
  goalLines: number,
): { goal: number; line: number; status: number } {
  const { gap, goalDy, nameY } = STATS_LAYOUT.detailText;
  const status = nameY + helpCapDy(fonts.title, TEXT_SCALE);
  const goal = status + goalDy;
  return { goal, line: goal + goalLines * fonts.body.lineHeight * TEXT_SCALE + gap, status };
}

// The open badge's content height, its frame detailText.foot under its line's lowest ink, under
// a goal goalLines lines long and a line lineLines lines long, all at 2x.
export function detailPanelHeight(
  fonts: BadgeDetailFonts,
  goalLines: number,
  lineLines: number,
): number {
  const { detailText } = STATS_LAYOUT;
  const line = detailTextTops(fonts, goalLines).line;
  const inkBottom = line + inkRowsOfLines(fonts.body, lineLines) * TEXT_SCALE;
  return inkBottom + detailText.foot + detailText.frame;
}

// A tab's view, its mask, and where its values' ink ends (rows.right), as the shop's list runs,
// the same whether or not the tab scrolls.
export function statsListFrame(): { rect: Rect; right: number } {
  const { headingRight, rect } = shopListFrame();
  return { rect, right: headingRight };
}

// The tabs' hit areas, in the shop's tab span.
export function statsTabRects(): Rect[] {
  return shopTabRects(STATS_TABS.length);
}

export function badgesBottom(rows: readonly Rect[]): number {
  const { foot, y } = STATS_LAYOUT.wall;
  const last = rows.at(-1);
  return (last === undefined ? y : last.y + last.height) + foot;
}

// The band under an earned badge's row.
export function earnedBand(row: Rect): Rect {
  const { bandLeft, bandWidth, bandY } = STATS_LAYOUT.wall.earned;
  return {
    height: row.height + 2 * bandY,
    width: bandWidth,
    x: row.x - bandLeft,
    y: row.y - bandY,
  };
}

// The tick over an earned badge's top-right corner.
export function earnedCheck(row: Rect): Rect {
  const { checkDx, checkDy, checkSize } = STATS_LAYOUT.wall.earned;
  return { height: checkSize, width: checkSize, x: row.x + checkDx, y: row.y + checkDy };
}

// The capitals' top of each line of a wall cell's text, from its row's top: the name's lines from
// y, a lineHeight apart, then the goal's and the progress's, the first LABEL_HELP_GAP clear rows
// under the body font's lowest ink on the name's last line (helpCapDy) and each after it a
// lineHeight under the one before.
export function wallLineTops(
  body: FontMetrics,
  cell: Pick<WallCellLines, "goal" | "name" | "progress">,
): number[] {
  const { lineHeight, y } = STATS_LAYOUT.wallText;
  const name = cell.name.map((_, i) => y + i * lineHeight);
  const below = y + (cell.name.length - 1) * lineHeight + helpCapDy(body, TEXT_SCALE);
  const rest = [...cell.goal, ...cell.progress].map((_, i) => below + i * lineHeight);
  return [...name, ...rest];
}

// A wall row's height for a badge whose text lines' capitals' tops are tops (wallLineTops): as
// tall as the badge with badgeTop over and under it, as the text with its last line's pitch and
// pad under it, or as a press area (MIN_PRESS), whichever is tallest.
export function wallRowHeight(tops: readonly number[]): number {
  const { badgeTop } = STATS_LAYOUT.wall;
  const { lineHeight, pad, y } = STATS_LAYOUT.wallText;
  const last = tops.at(-1) ?? y - lineHeight;
  return Math.max(BADGE_STRIP.badgeSize + 2 * badgeTop, last + lineHeight + pad, MIN_PRESS);
}
