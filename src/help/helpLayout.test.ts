import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MIN_PRESS, TOP_BAR_HEIGHT } from "../data/layout.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, gameFont, placedInk } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { MODAL } from "../ui/modalGeometry.ts";
import { BODY_ASCENT_ROWS, BODY_INK_ROWS, TEXT_SCALE } from "../ui/textFit.ts";
import { helpBody } from "./helpBody.ts";
import { dotRects, HELP_LAYOUT, helpActionAt, helpScrollbar, tapRect } from "./helpLayout.ts";
import type { HelpAction } from "./helpPaging.ts";

// Help is a page under the live top bar: the framed picture at full size with its caption, then
// the title and body, at the rows Art's framed option sets.
describe("help's page", () => {
  const { body, caption, frame, illustration, page, presses, scrollbar, title, well } = HELP_LAYOUT;

  it.each([
    ["the page", page, { height: 520, width: 360, x: 0, y: TOP_BAR_HEIGHT }],
    ["the frame", frame, { height: 234, width: 344, x: 8, y: 48 }],
    ["the well", well, { height: 200, width: 332, x: 14, y: 54 }],
    ["the picture", illustration, { height: 196, width: 328, x: 16, y: 56 }],
    ["the caption's capitals and centre", caption, { centreX: 180, y: 260 }],
    ["the title's capitals", title.y, 307],
    ["the body's capitals", body.y, 327],
    ["the body's viewport", body.viewport, { height: 54, width: 360, x: 0, y: 325 }],
    ["the body's width", body.width, 330],
    ["the scrollbar's track", [scrollbar.x, scrollbar.trackWidth], [344, 8]],
    ["the title's and body's left edge", [title.x, body.x], [frame.x, frame.x]],
    ["the track's right edge", scrollbar.x + scrollbar.trackWidth, frame.x + frame.width],
    ["the page presses' top", presses.y, MIN_PRESS],
  ] as const)("places %s", (_, help, expected) => {
    expect(help).toEqual(expected);
  });

  it("takes the body font's ink rows and ascent from the font", () => {
    expect(BODY_INK_ROWS).toBe(inkRowsFromCapTop(BODY));
    expect(BODY_ASCENT_ROWS).toBe(BODY.capTop - BODY.letterTop);
  });

  // The viewport shows whole lines only: each line's slot, from its letters' top, holds all its
  // ink, and the viewport is whole slots from the first line's.
  it("shows whole body lines in its viewport, and the next line not at all", () => {
    const { lineHeight, scale, viewport } = body;
    const slotTop = body.y - BODY_ASCENT_ROWS * scale;
    expect(viewport.y).toBe(slotTop);
    expect(viewport.height % lineHeight).toBe(0);
    expect((BODY_ASCENT_ROWS + BODY_INK_ROWS) * scale).toBeLessThanOrEqual(lineHeight);
  });

  // The Logbook's scrollbar rule: shown only for a body longer than its viewport, the lines
  // stopping their gap short of its track.
  it("draws the scrollbar only for a body that overflows, clear of the lines", () => {
    expect(helpScrollbar(0, 0)).toBeNull();
    const bar = helpScrollbar(body.lineHeight * 3, body.lineHeight * 3);
    expect(bar?.track).toEqual({ ...body.viewport, width: scrollbar.trackWidth, x: scrollbar.x });
    expect(bar?.thumb.y).toBe(
      body.viewport.y + body.viewport.height - scrollbar.thumbInset - (bar?.thumb.height ?? 0),
    );
    expect(body.x + body.width + body.scrollGap).toBe(scrollbar.x);
  });

  it("fits every page's caption on one line across the picture", () => {
    const offenders = gameData.help.filter((shown) => {
      const ink = placedInk("font-body", { scale: TEXT_SCALE }, shown.caption);
      return ink.right - ink.left > illustration.width;
    });
    expect(offenders.map(({ caption: text }) => text)).toEqual([]);
  });
});

describe("tapRect", () => {
  it("grows small art about its centre to the minimum, keeps a larger side and stays on screen", () => {
    const side = MIN_TAP_SIZE;
    expect(tapRect({ height: 8, width: 8, x: 44, y: 478 })).toEqual({
      height: side,
      width: side,
      x: 48 - side / 2,
      y: 482 - side / 2,
    });
    expect(tapRect({ height: side, width: 110, x: 8, y: 504 }).width).toBe(110);
    expect(tapRect({ height: 4, width: 4, x: 358, y: 558 })).toEqual({
      height: side,
      width: side,
      x: 360 - side,
      y: 560 - side,
    });
  });
});

describe("help tap targets", () => {
  const targets = [
    tapRect(HELP_LAYOUT.previous),
    tapRect(HELP_LAYOUT.next),
    HELP_LAYOUT.footer,
    ...dotRects(7).map(tapRect),
  ];

  it("are at least the minimum tap size each way, enclose their art and never overlap", () => {
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    }
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
      [330, 20, undefined],
      [HELP_LAYOUT.previous.x, HELP_LAYOUT.previous.y, { kind: "previous" }],
      [HELP_LAYOUT.next.x, HELP_LAYOUT.next.y, { kind: "advance" }],
      [HELP_LAYOUT.footer.x, HELP_LAYOUT.footer.y, { kind: "close" }],
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
  it("retains every page's full body in its scroll content above fixed controls, and its full-size title", () => {
    const { scale: titleScale, x } = HELP_LAYOUT.title;
    const inkBottom = y + (maxLines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    const viewport = HELP_LAYOUT.body.viewport;
    expect(viewport.y).toBe(y - BODY_ASCENT_ROWS * scale);
    expect(viewport.height).toBeGreaterThanOrEqual(lineHeight);
    expect(viewport.height % lineHeight).toBe(0);
    expect(viewport.y + viewport.height + MODAL.gap).toBeLessThanOrEqual(
      dotsTop - (MIN_TAP_SIZE - HELP_LAYOUT.dots.size) / 2,
    );
    expect(inkBottom).toBeLessThanOrEqual(viewport.y + maxLines * lineHeight);
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

it("keeps Close centred beneath fixed page navigation with full nonoverlapping targets", () => {
  const { footer, next, previous, screen } = HELP_LAYOUT;
  expect(footer.x + footer.width / 2).toBe(screen.width / 2);
  expect(footer.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
  expect(footer.y - (next.y + next.height)).toBe(BUTTON_SIZE.stackGap);
  expect(footer.y - (previous.y + previous.height)).toBe(BUTTON_SIZE.stackGap);
  expect(footer.y + footer.height).toBeLessThanOrEqual(screen.height);
});
