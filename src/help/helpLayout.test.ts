import { wrapWords } from "@andornaut/game-kit/lines";
import { rectsOverlap } from "@andornaut/game-kit/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { HOME_BAR_LAST_FACE, HOME_LAYOUT } from "../home/homeLayout.ts";
import { TITLE_CAP_ROWS } from "../hud/walkHud.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, gameFont, placedInk } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { closeFace } from "../ui/closeControl.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { topBarContentRows, topBarRects } from "../ui/topBarTrim.ts";
import { helpBody } from "./helpBody.ts";
import { CLOSE_HIT_RECT, dotRects, HELP_LAYOUT, helpActionAt, tapRect } from "./helpLayout.ts";
import type { HelpAction } from "./helpPaging.ts";

// Help's top bar is the home pages': as tall, trimmed alike, its heading's capitals and close
// face centred down the rows between the trim's line and edge as the home bar's button faces
// are, the close face where the home bar's last face is (Exit's, or Settings' where Exit is
// hidden).
describe("help's top bar", () => {
  const { close, heading, topBar } = HELP_LAYOUT;
  const home = HOME_LAYOUT.topBar;
  const homeBar = { height: home.height, width: topBar.width, x: 0, y: 0 };
  const rows = topBarContentRows(topBar.height);
  const capRows = TITLE_CAP_ROWS * TEXT_SCALE;
  const homeFace = { ...HOME_BAR_LAST_FACE, height: home.faceSize, width: home.faceSize };
  // How many more rows a part leaves below it than above it, between the trim's line and edge.
  const offCentre = (top: number, size: number) => rows.bottom - (top + size) - (top - rows.top);

  it.each([
    ["the bar's rect", topBar, homeBar],
    ["the bar's trim", topBarRects(topBar), topBarRects(homeBar)],
    ["the close face", closeFace(close), homeFace],
    [
      "the heading's centring",
      offCentre(heading.y, capRows),
      offCentre(homeFace.y, homeFace.height),
    ],
  ] as const)("matches the home bar's in %s", (_, help, homeValue) => {
    expect(help).toEqual(homeValue);
  });
});

describe("tapRect", () => {
  it("grows small art about its centre to the minimum, keeps a larger side and stays on screen", () => {
    expect(tapRect({ height: 8, width: 8, x: 44, y: 478 })).toEqual({
      height: 44,
      width: 44,
      x: 26,
      y: 460,
    });
    expect(tapRect({ height: 44, width: 110, x: 8, y: 504 }).width).toBe(110);
    expect(tapRect({ height: 4, width: 4, x: 358, y: 558 })).toEqual({
      height: 44,
      width: 44,
      x: 316,
      y: 516,
    });
  });
});

describe("help tap targets", () => {
  const targets = [
    CLOSE_HIT_RECT,
    tapRect(HELP_LAYOUT.previous),
    tapRect(HELP_LAYOUT.next),
    ...dotRects(7).map(tapRect),
  ];

  it("are at least the minimum tap size each way, enclose their art and never overlap", () => {
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    }
    expect(inside(closeFace(HELP_LAYOUT.close), CLOSE_HIT_RECT)).toBe(true);
    dotRects(7).forEach((dot) => expect(inside(dot, tapRect(dot))).toBe(true));
    targets.forEach((a, i) => {
      targets.slice(i + 1).forEach((b) => expect(rectsOverlap(a, b)).toBe(false));
    });
  });
});

describe("helpActionAt", () => {
  // Taps at the edges of each target and just outside them.
  it("maps a tap on each target to its action, and one outside them to none", () => {
    const dotTop = tapRect(dotRects(7)[0]!).y;
    const taps: [number, number, HelpAction | undefined][] = [
      [330, 20, { kind: "close" }],
      [HELP_LAYOUT.previous.x, HELP_LAYOUT.previous.y, { kind: "previous" }],
      [HELP_LAYOUT.next.x, HELP_LAYOUT.next.y, { kind: "advance" }],
      [26, dotTop, { kind: "goTo", page: 0 }],
      [333, dotTop + MIN_TAP_SIZE / 2, { kind: "goTo", page: 6 }],
      [180, 200, undefined],
      [180, dotTop - 1, undefined],
    ];
    for (const [x, y, expected] of taps) {
      expect(helpActionAt(7, { x, y }), `${x}, ${y}`).toEqual(expected);
    }
  });
});

const BODY = fontFileMetrics("font-body");

// Previous and Next are a pair of standard buttons, and the page dots small ones over them.
it.each([
  [
    "Previous to Next",
    HELP_LAYOUT.next.x - HELP_LAYOUT.previous.x - HELP_LAYOUT.previous.width,
    BUTTON_SIZE.gap,
  ],
  [
    "the dots to the buttons",
    HELP_LAYOUT.next.y - HELP_LAYOUT.dots.y - HELP_LAYOUT.dots.size,
    BUTTON_SIZE.smallGap,
  ],
])("keeps the button gap from %s", (_name, gap, expected) => {
  expect(gap).toBe(expected);
});

describe("help pages", () => {
  const { lineHeight, maxLines, scale, width, y } = HELP_LAYOUT.body;
  const dotsTop = Math.min(...dotRects(gameData.help.length).map((dot) => dot.y));
  it("starts body capitals one label gap below the measured title ink", () => {
    const title = fontFileMetrics("font-title");
    const { glyphs } = gameFont("font-title");
    for (const page of gameData.help) {
      const bottom = Math.max(
        ...[...page.title.toUpperCase()].map((char) => {
          const glyph = glyphs.get(char);
          return glyph === undefined || glyph.width === 0 ? 0 : glyph.yOffset + glyph.height;
        }),
      );
      const inkBottom = HELP_LAYOUT.title.y + (bottom - title.capTop) * HELP_LAYOUT.title.scale;
      expect(y - inkBottom, page.title).toBe(LABEL_HELP_GAP);
    }
  });
  it("fits every page's body in its lines above the page dots, and its title across the screen", () => {
    const { scale: titleScale, x } = HELP_LAYOUT.title;
    const inkBottom = y + (maxLines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    expect(inkBottom).toBeLessThanOrEqual(dotsTop);
    const offenders = gameData.help.filter((page) => {
      const lines = wrapWords(
        (line) => bodyTextWidth(scale, line),
        width,
        helpBody(gameData, page),
      );
      const title = placedInk("font-title", { scale: titleScale }, page.title.toUpperCase());
      return (
        lines.some((line) => bodyTextWidth(scale, line) > width) ||
        lines.length > maxLines ||
        x + title.right > HELP_LAYOUT.screen.width - x
      );
    });
    expect(offenders.map(({ title }) => title)).toEqual([]);
  });
});
