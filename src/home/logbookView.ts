import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { dogFaceKey } from "../assets/index.ts";
import type { GameData } from "../data/index.ts";
import type { SaveDocument } from "../save/index.ts";
import { PALETTE, stackRows, TEXT_SCALE } from "../ui/index.ts";
import {
  BADGE_STRIP,
  BADGE_TEXT_COLOURS,
  badgeProgress,
  type BadgeView,
  earnedText,
  wallCell,
} from "./badgesView.ts";
import type {
  DetailArt,
  DetailFramed,
  DetailMeasure,
  DetailText,
} from "./details/detailCardView.ts";
import { type PageFill, type ShopPageView, shopPageView } from "./shopPageView.ts";
import {
  badgesBottom,
  DOG_STATS,
  type DogStat,
  earnedBand,
  earnedCheck,
  STATS_LAYOUT,
  STATS_TABS,
  statsListFrame,
  type StatsTab,
  wallLineTops,
  wallRowHeight,
} from "./statsLayout.ts";
import { dogRows, overallRows, type StatsRow } from "./statsView.ts";

// The Logbook laid out as one view the HTML interface draws (src/hud/dom/logbook.ts). Every rect
// and text origin is in game pixels; the open tab's content is laid out from the list's
// unscrolled top, and the page moves it up by the scroll and clips it to the list's frame.

// A row of the open tab, drawn as one group: its fills and framed bands under its art under its
// text, laid out in rect. A badge's row is its control, named label, that opens the badge at
// index on the wall.
export interface LogbookRow {
  readonly art: readonly DetailArt[];
  readonly badge?: { readonly index: number; readonly label: string };
  readonly fills: readonly PageFill[];
  readonly framed: readonly DetailFramed[];
  readonly rect: Rect;
  readonly texts: readonly DetailText[];
}

// The open tab's content: its rows top to bottom, which is their focus order, the 1px rules
// between them, and its bottom.
export interface LogbookContent {
  readonly bottom: number;
  readonly rows: readonly LogbookRow[];
  readonly separators: readonly Rect[];
}

export interface LogbookView {
  readonly content: LogbookContent;
  // The list's frame, which clips the content, and its values' right edge.
  readonly frame: { readonly rect: Rect; readonly right: number };
  readonly page: ShopPageView;
}

// Beyond the detail card's measures: a 2x body line's visible ink, its top and bottom rows from
// the line's capitals' top.
export type LogbookMeasure = Pick<
  DetailMeasure,
  "art" | "body" | "hasTag" | "inkWidth" | "title" | "titleInk" | "wrapNote"
> & {
  readonly bodyInk: (line: string) => { readonly bottom: number; readonly top: number };
};

const LEFT = STATS_LAYOUT.rows.left;
const PITCH = STATS_LAYOUT.rows.pitch;
const DOGS = STATS_LAYOUT.dogs;
const WALL = STATS_LAYOUT.wall;
const EARNED = WALL.earned;
const WALL_TEXT = STATS_LAYOUT.wallText;
const BADGE_SIZE = BADGE_STRIP.badgeSize;

type Data = Parameters<typeof badgeProgress>[0] & Pick<GameData, "dogs" | "menuText">;

// A row as a tab lays it out: the parts it adds to it, in rect.
interface Parts {
  readonly art: DetailArt[];
  readonly fills: PageFill[];
  readonly framed: DetailFramed[];
  readonly rect: Rect;
  readonly texts: DetailText[];
}

// An empty row across the rows from the left to right, height tall from y.
function row(right: number, y: number, height: number): Parts {
  return {
    art: [],
    fills: [],
    framed: [],
    rect: { height, width: right - LEFT, x: LEFT, y },
    texts: [],
  };
}

// Body text at 2x in plum unless told otherwise, left-aligned with its pen, or a title label's
// ink, at x, or its ink ending at x (inkRight).
function text(
  parts: Parts,
  at: { x: number; y: number },
  value: string,
  style: {
    align?: "inkRight";
    colour?: number;
    focusColour?: number;
    font?: "body" | "title";
  } = {},
): void {
  parts.texts.push({
    ...(style.align === undefined ? {} : { align: style.align }),
    capTop: at.y,
    colour: style.colour ?? PALETTE.plum,
    ...(style.focusColour === undefined ? {} : { focusColour: style.focusColour }),
    ...(style.font === undefined ? {} : { font: style.font }),
    lines: [value],
    scale: TEXT_SCALE,
    x: at.x,
  });
}

// Body text whose ink ends at right, as a label the canvas moves there (placeInkRight).
function textInkRight(
  parts: Parts,
  at: { right: number; y: number },
  value: string,
  colour: number = PALETTE.plum,
): void {
  text(parts, { x: at.right, y: at.y }, value, { align: "inkRight", colour });
}

// A row per stat from y, each its label from the left in dark brown, wrapped clear of its value,
// and its value's ink up to right, a pitch per label line. Returns the rows and the last one's
// bottom.
function statRows(
  measure: LogbookMeasure,
  right: number,
  y: number,
  stats: readonly StatsRow[],
): { bottom: number; rows: Parts[] } {
  let top = y;
  const rows = stats.map(({ label, value }) => {
    const room = right - LEFT - measure.inkWidth("body", value) - STATS_LAYOUT.rows.gap;
    const lines = measure.wrapNote(room, label);
    const parts = row(right, top, Math.max(1, lines.length) * PITCH);
    lines.forEach((line, i) =>
      text(parts, { x: LEFT, y: top + i * PITCH }, line, { colour: PALETTE.darkBrown }),
    );
    textInkRight(parts, { right, y: top }, value);
    top += parts.rect.height;
    return parts;
  });
  return { bottom: top, rows };
}

// Overall figures, then walks by outcome: each section's heading row, then its stat rows.
function runsTab(
  measure: LogbookMeasure,
  data: Data,
  save: Pick<SaveDocument, "stats">,
  right: number,
): LogbookContent {
  const { outcomes, overall } = overallRows(data, save.stats);
  const words = data.menuText.stats;
  const sections = [
    { heading: words.sections.overall, rows: overall },
    { heading: words.sections.runs, rows: outcomes },
  ];
  const rows: Parts[] = [];
  let top = STATS_LAYOUT.walks.top;
  let bottom = top;
  for (const section of sections) {
    const heading = row(right, top, STATS_LAYOUT.walks.rowsY);
    text(heading, { x: LEFT, y: top }, section.heading, { font: "title" });
    const stats = statRows(measure, right, top + STATS_LAYOUT.walks.rowsY, section.rows);
    rows.push(heading, ...stats.rows);
    bottom = stats.bottom;
    top = bottom + STATS_LAYOUT.walks.sectionGap;
  }
  return { bottom: bottom + STATS_LAYOUT.scroll.padBottom, rows, separators: [] };
}

// A block per dog: a row of its face and name, then a row each for its walks, neighbourhoods and
// firings, with a rule between blocks.
function dogsTab(
  measure: LogbookMeasure,
  data: Data,
  save: Pick<SaveDocument, "owned" | "stats">,
  right: number,
): LogbookContent {
  const labels = data.menuText.stats.dogColumns;
  const dogs = dogRows(data, save.owned, save.stats);
  const rows: Parts[] = [];
  const separators: Rect[] = [];
  let top = DOGS.top;
  let bottom = top;
  dogs.forEach((dog, i) => {
    if (i > 0) {
      separators.push({
        height: 1,
        width: right - LEFT + 2 * DOGS.ruleDx,
        x: LEFT - DOGS.ruleDx,
        y: top - DOGS.ruleAbove,
      });
    }
    const named = row(right, top, DOGS.rowsY);
    const face = dogFaceKey(data, dog.dog);
    const size = measure.art(face);
    if (size !== undefined) {
      const tag = measure.hasTag(face, "happy") ? "happy" : undefined;
      named.art.push({ key: face, scale: 1, sheet: { tag }, size, x: LEFT, y: top });
    }
    text(named, { x: LEFT + DOGS.nameDx, y: top + DOGS.nameY }, dog.name, { font: "title" });
    const values: Record<DogStat, number> = {
      fired: dog.timesFired,
      walks: dog.walks,
      zones: dog.zonesFinished,
    };
    const stats = statRows(
      measure,
      right,
      top + DOGS.rowsY,
      DOG_STATS.map((stat) => ({ label: labels[stat], value: String(values[stat]) })),
    );
    rows.push(named, ...stats.rows);
    bottom = stats.bottom;
    top = bottom + DOGS.gap;
  });
  return { bottom: bottom + STATS_LAYOUT.scroll.padBottom, rows, separators };
}

// The earned count's row, at the rows' right, then a row per badge: earned ones in colour with a
// green name on a gold band, ticked, locked ones greyed; each with its goal, or its short goal
// where the full one does not fit, and a locked one that counts across walks with its progress.
function badgesTab(
  measure: LogbookMeasure,
  data: Data,
  save: Pick<SaveDocument, "owned" | "stats">,
  badges: readonly BadgeView[],
  right: number,
): LogbookContent {
  const earned = row(right, WALL.headingY, WALL.y - WALL.headingY);
  textInkRight(earned, { right, y: WALL.headingY }, earnedText(data, badges), PALETTE.darkBrown);
  const inkWidth = (line: string) => measure.inkWidth("body", line);
  const cells = badges.map((badge) => {
    const cell = wallCell(WALL_TEXT, inkWidth, badge, badgeProgress(data, save, badge));
    return {
      ...cell,
      label: cell.name.join(" "),
      name: [...cell.name, data.menuText.stats.badgeDifficulty[badge.tier]],
    };
  });
  // Each line's capitals' top, the goal's clear of the name's line, and each row as tall as its
  // badge or its text, whichever is taller.
  const tops = cells.map((cell) => wallLineTops(measure.body, cell));
  const wallRows = stackRows(WALL, tops.map(wallRowHeight));
  const rows = badges.flatMap((badge, i): LogbookRow[] => {
    const rect = wallRows[i];
    const cell = cells[i];
    if (rect === undefined || cell === undefined) {
      return [];
    }
    const parts: Parts = { art: [], fills: [], framed: [], rect, texts: [] };
    if (badge.earned) {
      parts.framed.push({
        border: PALETTE[EARNED.outline],
        fill: PALETTE[EARNED.fill],
        rect: earnedBand(rect),
      });
    }
    // The badge and the text block each centred on the row's height.
    const half = BADGE_SIZE / 2;
    const centre = { x: Math.round(rect.x + half), y: Math.round(rect.y + rect.height / 2) };
    // The text block is its lines' visible ink; an odd spare row goes under it.
    const lineTops = tops[i] ?? [];
    const lineTexts = [...cell.name, ...cell.goal, ...cell.progress];
    const inks = lineTexts.map((line, n) => {
      const ink = measure.bodyInk(line);
      return { bottom: (lineTops[n] ?? 0) + ink.bottom, top: (lineTops[n] ?? 0) + ink.top };
    });
    const inkTop = Math.min(...inks.map(({ top }) => top));
    const inkBottom = Math.max(...inks.map(({ bottom }) => bottom));
    const textDy = Math.floor((rect.height - (inkBottom - inkTop)) / 2) - inkTop;
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
    // The tick keeps its place on the badge's top-right corner.
    const placed = earnedCheck(rect);
    const check = { ...placed, y: placed.y + centre.y - half - rect.y - WALL.badgeTop };
    const tick = measure.art("ui-check");
    if (badge.earned && tick !== undefined && measure.hasTag("ui-check", "tick")) {
      parts.art.push({ key: "ui-check", scale: 1, sheet: { tag: "tick" }, size: tick, ...check });
    }
    const colours = BADGE_TEXT_COLOURS[badge.earned ? "earned" : "locked"];
    const focusedGoal = badge.earned ? undefined : BADGE_TEXT_COLOURS.locked.focusedGoal;
    const lines = [
      ...cell.name.map((line) => [line, colours.name, undefined] as const),
      ...[...cell.goal, ...cell.progress].map((line) => [line, colours.goal, focusedGoal] as const),
    ];
    lines.forEach(([line, colour, focus], n) => {
      const at = { x: rect.x + WALL_TEXT.x, y: rect.y + (lineTops[n] ?? 0) + textDy };
      text(parts, at, line, {
        colour: PALETTE[colour],
        ...(focus === undefined ? {} : { focusColour: PALETTE[focus] }),
      });
    });
    return [{ ...parts, badge: { index: i, label: cell.label } }];
  });
  return { bottom: badgesBottom(wallRows), rows: [earned, ...rows], separators: [] };
}

// The open tab's content laid out in frame (statsListFrame).
function tabContent(
  measure: LogbookMeasure,
  data: Data,
  state: LogbookState,
  right: number,
): LogbookContent {
  switch (state.tab) {
    case "runs":
      return runsTab(measure, data, state.save, right);
    case "dogs":
      return dogsTab(measure, data, state.save, right);
    case "badges":
      return badgesTab(measure, data, state.save, state.badges, right);
    default:
      return state.tab satisfies never;
  }
}

// What the Logbook shows: the open tab, the save it reads, the badge wall, and what is pressed.
export interface LogbookState {
  readonly badges: readonly BadgeView[];
  // The tab pressed, by index, or undefined.
  readonly pressedTab: number | undefined;
  readonly save: Pick<SaveDocument, "owned" | "stats">;
  readonly tab: StatsTab;
}

// The Logbook's page, tabs and open tab, laid out clear of the scrollbar's room.
export function logbookView(measure: LogbookMeasure, data: Data, state: LogbookState): LogbookView {
  const words = data.menuText.stats;
  const page = shopPageView(measure, {
    tabs: STATS_TABS.map((tab, i) => ({
      label: words.tabs[tab],
      open: tab === state.tab,
      pressed: state.pressedTab === i,
    })),
    title: words.title,
  });
  const frame = statsListFrame();
  return { content: tabContent(measure, data, state, frame.right), frame, page };
}
