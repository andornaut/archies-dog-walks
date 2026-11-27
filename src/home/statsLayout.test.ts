import { fillLine, wrapWords } from "@andornaut/game-kit/runtime/lines";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { scrollMax } from "../input/listScroll.ts";
import { read } from "../rules/units.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, fontInk, gameFont, inkWidth, placedInk } from "../testing/fontInk.ts";
import { veteranSave } from "../testing/saves.ts";
import { lineInk } from "../ui/lineInk.ts";
import { DISMISS_FOOTER_SPACE } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalFamilyWidth } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { PAGE_LAYOUT, stackRows } from "../ui/pageLayout.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { scrollbarRects } from "../ui/scrollbar.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { BADGE_STRIP, badgeWall, earnedText, wallCell } from "./badgesView.ts";
import { type LogbookMeasure, logbookView } from "./logbookView.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";
import {
  badgesBottom,
  detailPanelHeight,
  detailTextTops,
  DOG_STATS,
  earnedBand,
  earnedCheck,
  STATS_LAYOUT,
  STATS_TABS,
  statsListFrame,
  statsTabRects,
  wallLineTops,
  wallRowHeight,
} from "./statsLayout.ts";
import { overallRows } from "./statsView.ts";

const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");
const BADGES = badgeWall(gameData, []);
const words = gameData.menuText.stats;

// The tabs span the panel's columns, side by side, over its top; each label fits its tab.
describe("the tabs", () => {
  const tabs = statsTabRects();

  it("fits every tab label", () => {
    STATS_TABS.forEach((tab, i) => {
      const label = gameData.menuText.stats.tabs[tab];
      const style = { scale: TEXT_SCALE };
      expect(inkWidth("font-title", style, label.toUpperCase())).toBeLessThan(tabs[i]?.width ?? 0);
    });
  });
});
// A wall row holds its badge and its text: the badge with room over and under it, and the
// last line's lowest ink inside the row.
describe("a wall row", () => {
  const { badgeTop } = STATS_LAYOUT.wall;
  const { lines } = STATS_LAYOUT.wallText;
  it.each(Array.from({ length: lines }, (_, i) => [i + 1] as const))(
    "holds the badge and %i lines of text",
    (count) => {
      const goal = Array.from({ length: count - 1 }, () => "goal");
      const tops = wallLineTops(BODY, { goal, name: ["name"], progress: [] });
      const height = wallRowHeight(tops);
      const lowest = (tops.at(-1) ?? 0) + inkRowsFromCapTop(BODY) * TEXT_SCALE;
      expect(lowest).toBeLessThan(height);
      expect(2 * badgeTop + BADGE_STRIP.badgeSize).toBeLessThanOrEqual(height);
    },
  );
});

// The open badge, a Large card, holds its name in the title font, its goal and its line at 2x,
// the line's lowest ink inside the panel and the panel inside the screen's margins.
describe("the open badge", () => {
  const { detailText } = STATS_LAYOUT;
  const card = modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "large");
  const textRoom = card - detailText.x - detailText.textRight;
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));

  it("holds every badge", () => {
    for (const badge of BADGES) {
      const title = { scale: 2 };
      const room = card - 2 * detailText.x;
      expect(inkWidth("font-title", title, badge.name.toUpperCase())).toBeLessThanOrEqual(room);
      const goal = wrapWords(width, textRoom, badge.goal);
      const text = fillLine(MENU_TEXT_FIELDS.stats, words, "badgeLine", { line: badge.badgeLine });
      const line = wrapWords(width, textRoom, text);
      expect(Math.max(...[...goal, ...line].map(width))).toBeLessThanOrEqual(textRoom);
      const fonts = { body: BODY, title: TITLE };
      const lineTop = detailTextTops(fonts, goal.length).line;
      const lastTop = lineTop + (line.length - 1) * BODY.lineHeight * 2;
      const inkBottom = lastTop + inkRowsFromCapTop(BODY) * 2;
      const height = detailPanelHeight(fonts, goal.length, line.length);
      expect(height).toBe(inkBottom + detailText.foot + detailText.frame);
      expect(height + DISMISS_FOOTER_SPACE).toBeLessThanOrEqual(
        SCREEN_CONFIG.height - 2 * MODAL.margin,
      );
    }
  });
});

const { dogs, panel, rows, view, wall, wallText } = STATS_LAYOUT;
const { scrollbar } = PAGE_LAYOUT;
const STYLE = { scale: TEXT_SCALE };
// The least gap between a label's ink and its value's, and between any ink and the scrollbar.
const GAP = 4;
const BAR_LEFT = scrollbar.x - GAP;
// The lowest ink of a body line whose capitals' top is at y.
const inkBottom = (y: number) => y + inkRowsFromCapTop(BODY) * TEXT_SCALE;
const bodyRight = (x: number, text: string) => x + fontInk("font-body", STYLE, text).right;
const titleRight = (x: number, text: string) =>
  x + placedInk("font-title", STYLE, text.toUpperCase()).right;
const valueLeft = (value: string) => rows.right - inkWidth("font-body", STYLE, value);

// The Walks tab's rows with the widest figures: four-digit counts and dollars, three-digit
// firings by the owner with the widest name, and the best walk's first dog as the dog with the
// widest name. The best walk's later dogs have no label, so the first dog's row covers them.
const save = veteranSave();
const widest = (texts: readonly string[]) =>
  texts.reduce((a, b) =>
    inkWidth("font-body", STYLE, b) > inkWidth("font-body", STYLE, a) ? b : a,
  );
const ownerName = widest(Object.values(gameData.dogs).map(({ owner }) => owner.name));
const DOG_NAMES = Object.values(gameData.dogs).map(({ name }) => name);
const WIDEST_DOG = widest(DOG_NAMES);
// The dog whose name's title ink reaches farthest right in a Dogs tab block.
const WIDEST_DOG_TITLE = DOG_NAMES.reduce((a, b) => (titleRight(0, b) > titleRight(0, a) ? b : a));
const walksRows = Object.values(overallRows(gameData, save.stats))
  .flat()
  .filter(({ label }) => label !== "")
  .flatMap(({ label, value }) => {
    if (label === words.overall.timesFired) {
      return [
        {
          label,
          value: fillLine(MENU_TEXT_FIELDS.stats, words, "timesFiredBy", {
            count: "999",
            owner: ownerName,
          }),
        },
      ];
    }
    if (label === words.overall.bestRunDogs) {
      return [{ label, value: WIDEST_DOG }];
    }
    return [{ label, value: value.startsWith("$") ? "$9,999" : "9999" }];
  });
// The badge wall's rows with every badge locked and showing the veteran save's progress.
const bodyInk = (line: string) => inkWidth("font-body", STYLE, line);
const dogStatRows = DOG_STATS.map((stat) => ({ label: words.dogColumns[stat], value: "9999" }));
// The Walks tab's rows with a best walk with the fullest pack.
const fullPack = keysOf(gameData.dogs).slice(0, read(gameData.tuning, "counts", "packSizeMax"));
const fullestSave = {
  ...save,
  owned: { ...save.owned, dogs: keysOf(gameData.dogs) },
  stats: {
    ...save.stats,
    bestCentsByPackSize: { [fullPack.length]: cents(999_900) },
    bestWalk: { dogs: fullPack, zonesFinished: 4 },
  },
};
const measure: LogbookMeasure = {
  art: () => undefined,
  body: BODY,
  bodyInk: (line) => lineInk(gameFont("font-body"), line),
  hasTag: () => false,
  inkWidth: (font, line) =>
    inkWidth(`font-${font}`, STYLE, font === "title" ? line.toUpperCase() : line),
  title: TITLE,
  titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (room, text) => wrapWords((line) => inkWidth("font-body", STYLE, line), room, text),
};
const actualTab = (tab: Parameters<typeof logbookView>[2]["tab"]) =>
  logbookView(measure, gameData, {
    badges: BADGES,
    save: fullestSave,
    tab,
  });
const tabTexts = (tab: Parameters<typeof logbookView>[2]["tab"]) =>
  actualTab(tab).content.rows.flatMap((row) => row.texts);

// Each row holds its own parts: every text's capitals and every picture start inside it. The
// rows run top to bottom without overlapping, each badge's row its own control in the wall's
// order, and each rule lies in a gap between two rows.
describe("each tab's rows", () => {
  it.each(STATS_TABS)(
    "%s: holds each row's parts, in order, with its rules between rows",
    (tab) => {
      const { rows, separators } = actualTab(tab).content;
      const bottom = (row: (typeof rows)[number]) => row.rect.y + row.rect.height;
      rows.forEach((row, i) => {
        for (const y of [...row.texts.map((text) => text.capTop), ...row.art.map((art) => art.y)]) {
          expect(y).toBeGreaterThanOrEqual(row.rect.y);
          expect(y).toBeLessThan(bottom(row));
        }
        const next = rows[i + 1];
        if (next !== undefined) {
          expect(bottom(row)).toBeLessThanOrEqual(next.rect.y);
        }
      });
      expect(rows.flatMap((row) => (row.badge === undefined ? [] : [row.badge.index]))).toEqual(
        tab === "badges" ? BADGES.map((_, i) => i) : [],
      );
      for (const rule of separators) {
        expect(
          rows.some(
            (row, i) =>
              bottom(row) <= rule.y && (rows[i + 1]?.rect.y ?? -1) >= rule.y + rule.height,
          ),
        ).toBe(true);
      }
    },
  );
});

describe("the Walks and Dogs tabs' rows", () => {
  it.each([...walksRows, ...dogStatRows].map((row) => [row.label, row.value] as const))(
    "keeps %s a gap clear of its value, %s",
    (label, value) => {
      const room = valueLeft(value) - rows.left - rows.gap;
      const lines = wrapWords((line) => inkWidth("font-body", STYLE, line), room, label);
      for (const line of lines) {
        expect(bodyRight(rows.left, line) + GAP).toBeLessThanOrEqual(valueLeft(value));
      }
    },
  );
});

describe("the Dogs tab's blocks", () => {
  // Each block: the face left of the name, the widest name clear of the scrollbar, the face and
  // the name's ink over the rows, the last row's ink over the rule above the next block.
  it(`keeps each block's face, name (${WIDEST_DOG_TITLE}'s at widest), rows and rule in order`, () => {
    expect(titleRight(rows.left + dogs.nameDx, WIDEST_DOG_TITLE)).toBeLessThanOrEqual(BAR_LEFT);
    const texts = tabTexts("dogs");
    const headings = texts.filter((line) => line.font === "title");
    const top = headings[0]!.capTop - dogs.nameY;
    const next = headings[1]!.capTop - dogs.nameY;
    const lastRowInk = Math.max(
      ...texts
        .filter((line) => line.font !== "title" && line.capTop < next)
        .map((line) => inkBottom(line.capTop)),
    );
    const nameInk = headings[0]!.capTop + inkRowsFromCapTop(TITLE) * TEXT_SCALE;
    expect(dogs.faceSize).toBeLessThanOrEqual(dogs.nameDx);
    expect(Math.max(top + dogs.faceSize, nameInk)).toBeLessThan(top + dogs.rowsY);
    expect(lastRowInk).toBeLessThan(next - dogs.ruleAbove);
  });
});

// A tab's values end at the rows' right edge, as the shop's rows do, whether or not it scrolls.
// The earned count with every badge earned, ending there, starts inside the rows.
describe("the rows' right edge", () => {
  it("ends the values short of the scrollbar's track", () => {
    expect(statsListFrame().right).toBe(rows.right);
    expect(rows.right).toBe(scrollbar.x - 6);
  });

  it("fits the earned count between the rows' edges", () => {
    const all = badgeWall(
      gameData,
      BADGES.map(({ id }) => id),
    );
    const text = earnedText(gameData, all);
    const left = statsListFrame().right - inkWidth("font-body", STYLE, text);
    expect(left).toBeGreaterThanOrEqual(rows.left);
  });
});

// Nothing drawn on a tab reaches the scrollbar, which sits inside the panel's frame.
describe("the scrollbar", () => {
  it.each<[string, number]>([
    ["the rows' values", rows.right],
    ["a dog block's rule", rows.right + dogs.ruleDx],
    ["the badge rows", wall.x + wall.width],
    ["a badge's text", wall.x + wallText.x + wallText.width],
  ])("stays clear of %s", (_, right) => {
    expect(right).toBeLessThanOrEqual(BAR_LEFT);
  });

  it("sits beside the view and as tall as it", () => {
    const bar = scrollbarRects(scrollbar, view, 100, 0);
    expect(bar?.track).toMatchObject({ height: view.height, y: view.y });
    expect(view.x + view.width).toBeLessThanOrEqual(bar?.track.x ?? 0);
    expect((bar?.track.x ?? 0) + scrollbar.trackWidth).toBeLessThanOrEqual(
      panel.x + panel.width - 2,
    );
  });
});

// Actual full-font content keeps its final ink visible at the scroll boundary.
describe("each tab's scroll", () => {
  it.each(STATS_TABS)("%s: brings its last row into view", (tab) => {
    const actual = actualTab(tab);
    const { bottom } = actual.content;
    const texts = tabTexts(tab);
    const lastInk = Math.max(
      ...texts.map(
        (text) =>
          text.capTop + inkRowsFromCapTop(text.font === "title" ? TITLE : BODY) * TEXT_SCALE,
      ),
    );
    const max = scrollMax(actual.frame.rect, bottom);
    expect(lastInk - max).toBeLessThanOrEqual(actual.frame.rect.y + actual.frame.rect.height);
    expect(bottom - max).toBeLessThanOrEqual(actual.frame.rect.y + actual.frame.rect.height);
    expect(bottom).toBeGreaterThanOrEqual(lastInk);
  });
});

// The badge wall with every badge earned: a row's band and tick inside the content the view
// clips, between the view's top and the wall's bottom and left of the scrollbar's track, and
// its band clear of the next row's. A band reads only its row's rect, so the first row of each
// height and the last row cover the wall.
describe("an earned row", () => {
  const ids = gameData.achievements.map(({ id }) => id);
  const earned = badgeWall(gameData, ids);
  const earnedRows = stackRows(
    wall,
    earned.map((badge) =>
      wallRowHeight(wallLineTops(BODY, wallCell(wallText, bodyInk, badge, undefined))),
    ),
  );
  const bottom = badgesBottom(earnedRows);
  const inside = (rect: Rect) => {
    expect(rect.x).toBeGreaterThanOrEqual(view.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(scrollbar.x);
    expect(rect.y).toBeGreaterThanOrEqual(view.y);
    expect(rect.y + rect.height).toBeLessThanOrEqual(bottom);
  };
  const sampled = earnedRows.flatMap((row, i) =>
    earnedRows.findIndex((other) => other.height === row.height) === i ||
    i === earnedRows.length - 1
      ? [[earned[i]?.name, row, earnedRows[i + 1]] as const]
      : [],
  );
  it.each(sampled)(
    "%s: keeps its band and tick in the view's content, clear of the next band",
    (_, row, next) => {
      const band = earnedBand(row);
      inside(band);
      inside(earnedCheck(row));
      if (next !== undefined) {
        expect(band.y + band.height).toBeLessThan(earnedBand(next).y);
      }
    },
  );
});

// Art's row rule (art/layout.md, page rows): each wall row's text block is centred on the row by
// its lines' visible ink, an odd spare row under it.
it("centres each badge wall row's text by its visible ink", () => {
  const badgeRows = actualTab("badges").content.rows.filter((row) => row.badge !== undefined);
  for (const { rect, texts } of badgeRows) {
    const inks = texts
      .flatMap((text) =>
        text.lines.map((line) => ({ ink: lineInk(gameFont("font-body"), line), text })),
      )
      .map(({ ink, text }) => ({ bottom: text.capTop + ink.bottom, top: text.capTop + ink.top }));
    const above = Math.min(...inks.map(({ top }) => top)) - rect.y;
    const below = rect.y + rect.height - Math.max(...inks.map(({ bottom }) => bottom));
    expect(below - above).toBeGreaterThanOrEqual(0);
    expect(below - above).toBeLessThanOrEqual(1);
  }
});
