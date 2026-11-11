import type { Rect } from "@andornaut/game-kit/rect";

import { dogFaceKey } from "../assets/spriteKeys.ts";
import type { GameData } from "../data/types.ts";
import { scrollMax } from "../input/listScroll.ts";
import type { SaveDocument } from "../save/schema.ts";
import { PALETTE } from "../ui/palette.ts";
import type { ScrollbarRects } from "../ui/scrollbar.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import {
  BADGE_STRIP,
  BADGE_TEXT_COLOURS,
  badgeProgress,
  type BadgeView,
  earnedText,
  wallCell,
  wallRects,
} from "./badgesView.ts";
import type { DetailArt, DetailFramed, DetailMeasure, DetailText } from "./detailCardView.ts";
import { type PageFill, type ShopPageView, shopPageView } from "./shopPageView.ts";
import {
  badgesBottom,
  DOG_STATS,
  dogBlockTop,
  dogsBottom,
  type DogStat,
  earnedBand,
  earnedCheck,
  STATS_LAYOUT,
  STATS_TABS,
  statsListFrame,
  statsScrollbar,
  type StatsTab,
  walksBottom,
  walksHeadingTops,
  wallLineTops,
  wallRowHeight,
} from "./statsLayout.ts";
import { dogRows, overallRows, type StatsRow } from "./statsView.ts";

// The Logbook laid out as one view both renderers draw: the canvas's (src/scenes/StatsScene.ts)
// and the HTML interface's (src/hud/dom/logbook.ts). Every rect and text origin is in game
// pixels; the open tab's content is laid out from the list's unscrolled top, and the scene moves
// it up by the scroll and clips it to the list's frame.

// The open tab's content: fills and framed bands under art under text, and its bottom.
export interface LogbookContent {
  readonly art: readonly DetailArt[];
  readonly bottom: number;
  readonly fills: readonly PageFill[];
  readonly framed: readonly DetailFramed[];
  readonly texts: readonly DetailText[];
}

export interface LogbookView {
  readonly content: LogbookContent;
  // The list's frame, which clips the content, and its values' right edge.
  readonly frame: { readonly rect: Rect; readonly right: number };
  readonly page: ShopPageView;
  // The badge wall's rows, each badge's tap target, on the badges tab.
  readonly wallRows: readonly Rect[];
}

export type LogbookMeasure = Pick<
  DetailMeasure,
  "art" | "body" | "hasTag" | "inkWidth" | "title" | "wrapNote"
>;

const LEFT = STATS_LAYOUT.rows.left;
const PITCH = STATS_LAYOUT.rows.pitch;
const DOGS = STATS_LAYOUT.dogs;
const WALL = STATS_LAYOUT.wall;
const EARNED = WALL.earned;
const WALL_TEXT = STATS_LAYOUT.wallText;
const BADGE_SIZE = BADGE_STRIP.badgeSize;

type Data = Parameters<typeof badgeProgress>[0] & Pick<GameData, "dogs" | "menuText">;

// What a tab adds its parts to as it lays them out.
interface Parts {
  readonly art: DetailArt[];
  readonly fills: PageFill[];
  readonly framed: DetailFramed[];
  readonly texts: DetailText[];
}

// Body text at 2x in plum unless told otherwise, left-aligned with its pen, or a title label's
// ink, at x.
function text(
  parts: Parts,
  at: { x: number; y: number },
  value: string,
  style: { colour?: number; font?: "body" | "title" } = {},
): void {
  parts.texts.push({
    capTop: at.y,
    colour: style.colour ?? PALETTE.plum,
    ...(style.font === undefined ? {} : { font: style.font }),
    lines: [value],
    scale: TEXT_SCALE,
    x: at.x,
  });
}

// Body text whose ink ends at right, as a label the canvas moves there (placeInkRight).
function textInkRight(
  parts: Parts,
  measure: LogbookMeasure,
  at: { right: number; y: number },
  value: string,
  colour: number = PALETTE.plum,
): void {
  text(parts, { x: Math.round(at.right - measure.inkWidth("body", value)), y: at.y }, value, {
    colour,
  });
}

// Each row's label from the left in dark brown and its value's ink up to right, from y.
function rows(
  parts: Parts,
  measure: LogbookMeasure,
  right: number,
  y: number,
  stats: readonly StatsRow[],
): void {
  stats.forEach(({ label, value }, i) => {
    const top = y + i * PITCH;
    text(parts, { x: LEFT, y: top }, label, { colour: PALETTE.darkBrown });
    textInkRight(parts, measure, { right, y: top }, value);
  });
}

// Overall figures, then walks by outcome, each under its heading.
function runsTab(
  parts: Parts,
  measure: LogbookMeasure,
  data: Data,
  save: Pick<SaveDocument, "stats">,
  right: number,
): number {
  const { outcomes, overall } = overallRows(data, save.stats);
  const words = data.menuText.stats;
  const sections = [
    { heading: words.sections.overall, rows: overall },
    { heading: words.sections.runs, rows: outcomes },
  ];
  const counts = sections.map((section) => section.rows.length);
  const tops = walksHeadingTops(counts);
  sections.forEach(({ heading, rows: shown }, i) => {
    const y = tops[i] ?? 0;
    text(parts, { x: LEFT, y }, heading, { font: "title" });
    rows(parts, measure, right, y + STATS_LAYOUT.walks.rowsY, shown);
  });
  return walksBottom(counts);
}

// A block per dog: its face and name, then its walks, neighbourhoods and firings, one per row,
// with a rule between blocks.
function dogsTab(
  parts: Parts,
  measure: LogbookMeasure,
  data: Data,
  save: Pick<SaveDocument, "owned" | "stats">,
  right: number,
): number {
  const labels = data.menuText.stats.dogColumns;
  const dogs = dogRows(data, save.owned, save.stats);
  dogs.forEach((row, i) => {
    const top = dogBlockTop(i);
    if (i > 0) {
      parts.fills.push({
        colour: PALETTE.tan,
        rect: {
          height: 1,
          width: right - LEFT + 2 * DOGS.ruleDx,
          x: LEFT - DOGS.ruleDx,
          y: top - DOGS.ruleAbove,
        },
      });
    }
    const face = dogFaceKey(data, row.dog);
    const size = measure.art(face);
    if (size !== undefined) {
      const tag = measure.hasTag(face, "happy") ? "happy" : undefined;
      parts.art.push({ key: face, scale: 1, sheet: { tag }, size, x: LEFT, y: top });
    }
    text(parts, { x: LEFT + DOGS.nameDx, y: top + DOGS.nameY }, row.name, { font: "title" });
    const values: Record<DogStat, number> = {
      fired: row.timesFired,
      walks: row.walks,
      zones: row.zonesFinished,
    };
    rows(
      parts,
      measure,
      right,
      top + DOGS.rowsY,
      DOG_STATS.map((stat) => ({ label: labels[stat], value: String(values[stat]) })),
    );
  });
  return dogsBottom(dogs.length);
}

// The earned count at the rows' right, then a badge per row: earned ones in colour with a green
// name on a gold band, ticked, locked ones greyed; each with its goal, or its short goal where the
// full one does not fit, and a locked one that counts across walks with its progress. Returns the
// content's bottom and the rows.
function badgesTab(
  parts: Parts,
  measure: LogbookMeasure,
  data: Data,
  save: Pick<SaveDocument, "owned" | "stats">,
  badges: readonly BadgeView[],
  right: number,
): { bottom: number; wallRows: Rect[] } {
  textInkRight(
    parts,
    measure,
    { right, y: WALL.headingY },
    earnedText(data, badges),
    PALETTE.darkBrown,
  );
  const inkWidth = (line: string) => measure.inkWidth("body", line);
  const cells = badges.map((badge) => {
    const cell = wallCell(WALL_TEXT, inkWidth, badge, badgeProgress(data, save, badge));
    return { ...cell, name: [...cell.name, data.menuText.stats.badgeDifficulty[badge.tier]] };
  });
  // Each line's capitals' top, the goal's clear of the name's line, and each row as tall as its
  // badge or its text, whichever is taller.
  const tops = cells.map((cell) => wallLineTops(measure.body, cell));
  const wallRows = wallRects(WALL, tops.map(wallRowHeight));
  badges.forEach((badge, i) => {
    const rect = wallRows[i];
    const cell = cells[i];
    if (rect === undefined || cell === undefined) {
      return;
    }
    if (badge.earned) {
      parts.framed.push({
        border: PALETTE[EARNED.outline],
        fill: PALETTE[EARNED.fill],
        rect: earnedBand(rect),
      });
    }
    const half = BADGE_SIZE / 2;
    const centre = { x: Math.round(rect.x + half), y: Math.round(rect.y + WALL.badgeTop + half) };
    const tag = badge.earned ? "earned" : "locked";
    const size = measure.art(badge.art);
    if (size !== undefined && measure.hasTag(badge.art, tag)) {
      parts.art.push({
        key: badge.art,
        scale: 1,
        sheet: { tag },
        size,
        x: centre.x - size.width / 2,
        y: centre.y - size.height / 2,
      });
    } else {
      parts.fills.push({
        colour: badge.earned ? PALETTE.amber : PALETTE.grey,
        rect: { height: BADGE_SIZE, width: BADGE_SIZE, x: centre.x - half, y: centre.y - half },
      });
    }
    const check = earnedCheck(rect);
    const tick = measure.art("ui-check");
    if (badge.earned && tick !== undefined && measure.hasTag("ui-check", "tick")) {
      parts.art.push({ key: "ui-check", scale: 1, sheet: { tag: "tick" }, size: tick, ...check });
    }
    const colours = BADGE_TEXT_COLOURS[badge.earned ? "earned" : "locked"];
    const lines = [
      ...cell.name.map((line) => [line, colours.name] as const),
      ...[...cell.goal, ...cell.progress].map((line) => [line, colours.goal] as const),
    ];
    lines.forEach(([line, colour], n) => {
      const at = { x: rect.x + WALL_TEXT.x, y: rect.y + (tops[i]?.[n] ?? 0) };
      text(parts, at, line, { colour: PALETTE[colour] });
    });
  });
  return { bottom: badgesBottom(wallRows), wallRows };
}

// The open tab's content laid out in frame (statsListFrame), and the wall's rows on the badges
// tab.
function tabContent(
  measure: LogbookMeasure,
  data: Data,
  state: LogbookState,
  right: number,
): { content: LogbookContent; wallRows: Rect[] } {
  const parts: Parts = { art: [], fills: [], framed: [], texts: [] };
  const done = (bottom: number, wallRows: Rect[] = []) => ({
    content: { ...parts, bottom },
    wallRows,
  });
  switch (state.tab) {
    case "runs":
      return done(runsTab(parts, measure, data, state.save, right));
    case "dogs":
      return done(dogsTab(parts, measure, data, state.save, right));
    case "badges": {
      const { bottom, wallRows } = badgesTab(parts, measure, data, state.save, state.badges, right);
      return done(bottom, wallRows);
    }
    default:
      return state.tab satisfies never;
  }
}

// What the Logbook shows: the open tab, the save it reads, the badge wall, and what is pressed.
export interface LogbookState {
  readonly badges: readonly BadgeView[];
  readonly closePressed: boolean;
  // The tab pressed, by index, or undefined.
  readonly pressedTab: number | undefined;
  readonly save: Pick<SaveDocument, "owned" | "stats">;
  readonly tab: StatsTab;
}

// The Logbook's page, tabs and open tab, laid out without a scrollbar, then again beside one in
// the narrower frame if the tab is longer than the list's view.
export function logbookView(measure: LogbookMeasure, data: Data, state: LogbookState): LogbookView {
  const words = data.menuText.stats;
  const page = shopPageView(measure, {
    closePressed: state.closePressed,
    tabs: STATS_TABS.map((tab, i) => ({
      label: words.tabs[tab],
      open: tab === state.tab,
      pressed: state.pressedTab === i,
    })),
    title: words.title,
  });
  const fits = statsListFrame(false);
  const unscrolled = tabContent(measure, data, state, fits.right);
  const scrolls = scrollMax(STATS_LAYOUT.view, unscrolled.content.bottom) > 0;
  const frame = scrolls ? statsListFrame(true) : fits;
  const laid = scrolls ? tabContent(measure, data, state, frame.right) : unscrolled;
  return { ...laid, frame, page };
}

// The scrollbar beside a tab max pixels longer than its view, scrolled y, or null for one that
// fits.
export function logbookScrollbar(max: number, y: number): ScrollbarRects | null {
  return statsScrollbar(max, y);
}
