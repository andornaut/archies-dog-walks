import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MIN_PRESS, PAGE, TOP_BAR_HEIGHT } from "../data/layout.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, gameFont, placedInk } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { MODAL } from "../ui/modalGeometry.ts";
import { PAGE_LAYOUT } from "../ui/pageLayout.ts";
import { scrollbarRects } from "../ui/scrollbar.ts";
import { BODY_ASCENT_ROWS, BODY_INK_ROWS, TEXT_SCALE } from "../ui/textFit.ts";
import { helpBody } from "./helpBody.ts";
import { HELP_LAYOUT } from "./helpLayout.ts";

// Help is a page under the live top bar: the framed picture at full size with its caption, then
// the title and body, at the rows Art's framed option sets.
describe("help's page", () => {
  const { body, caption, frame, illustration, page, presses, title, well } = HELP_LAYOUT;
  const { scrollbar } = PAGE_LAYOUT;

  it.each([
    ["the page", page, { height: 520, width: 360, x: 0, y: TOP_BAR_HEIGHT }],
    ["the frame", frame, { height: 234, width: 344, x: 8, y: 48 }],
    ["the well", well, { height: 200, width: 332, x: 14, y: 54 }],
    ["the picture", illustration, { height: 196, width: 328, x: 16, y: 56 }],
    ["the caption's capitals and centre", caption, { centreX: 180, y: 260 }],
    ["the title's capitals", title.y, 307],
    ["the body's capitals", body.y, 327],
    ["the body's viewport", body.viewport, { height: 108, width: 360, x: 0, y: 325 }],
    ["the body's width", body.width, 330],
    ["the scrollbar's track", [scrollbar.x, scrollbar.trackWidth], [344, 8]],
    ["the title's centre", title.centreX, frame.x + frame.width / 2],
    ["the body's left edge", body.x, frame.x],
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
    expect(scrollbarRects(scrollbar, body.viewport, 0, 0)).toBeNull();
    const bar = scrollbarRects(scrollbar, body.viewport, body.lineHeight * 3, body.lineHeight * 3);
    expect(bar?.track).toEqual({ ...body.viewport, width: scrollbar.trackWidth, x: scrollbar.x });
    expect(bar?.thumb.y).toBe(
      body.viewport.y + body.viewport.height - scrollbar.thumbInset - (bar?.thumb.height ?? 0),
    );
    expect(body.x + body.width + PAGE.trackGap).toBe(scrollbar.x);
  });

  it("fits every page's caption on one line across the picture", () => {
    const offenders = gameData.help.filter((shown) => {
      const ink = placedInk("font-body", { scale: TEXT_SCALE }, shown.caption);
      return ink.right - ink.left > illustration.width;
    });
    expect(offenders.map(({ caption: text }) => text)).toEqual([]);
  });
});

const BODY = fontFileMetrics("font-body");

describe("help pages", () => {
  const { lineHeight, maxLines, scale, width, y } = HELP_LAYOUT.body;
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
    const { scale: titleScale } = HELP_LAYOUT.title;
    const inkBottom = y + (maxLines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    const viewport = HELP_LAYOUT.body.viewport;
    expect(viewport.y).toBe(y - BODY_ASCENT_ROWS * scale);
    expect(viewport.height).toBeGreaterThanOrEqual(lineHeight);
    expect(viewport.height % lineHeight).toBe(0);
    expect(viewport).toEqual({ height: 108, width: 360, x: 0, y: 325 });
    expect(viewport.height).toBe(maxLines * lineHeight);
    expect(viewport.y + viewport.height + MODAL.gap).toBeLessThanOrEqual(HELP_LAYOUT.pager.y);
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
        title.right - title.left > HELP_LAYOUT.frame.width
      );
    });
    expect(offenders.map(({ title }) => title)).toEqual([]);
  });
});

it("keeps Back centred beneath the pager, the stacked gap under its row", () => {
  const { footer, pager, screen } = HELP_LAYOUT;
  expect(footer.x + footer.width / 2).toBe(screen.width / 2);
  expect(footer.height).toBeGreaterThanOrEqual(MIN_PRESS);
  expect(footer.y - (pager.y + pager.height)).toBe(BUTTON_SIZE.stackGap);
  expect(footer.y + footer.height).toBeLessThanOrEqual(screen.height);
  expect([pager.x, pager.x + pager.width]).toEqual([MODAL.margin, screen.width - MODAL.margin]);
});
