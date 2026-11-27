import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { gameFont } from "../testing/fontInk.ts";
import { shownText } from "../ui/dom/pixelLine.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_COLOURS } from "../ui/selection.ts";
import { helpActionForPointer } from "./helpInput.ts";
import { HELP_LAYOUT, helpActionAt } from "./helpLayout.ts";
import { chromeFills, type HelpFill, type HelpMeasure, helpView, wellFills } from "./helpView.ts";

const title = gameFont("font-title");
const body = gameFont("font-body");

// The help measured on the game's .fnt files.
const MEASURE: HelpMeasure = {
  body: fontMetrics(body),
  inkWidth: (font, line) => inkWidth(font === "title" ? title : body, 2, shownText(font, line)),
  title: fontMetrics(title),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  titleInkBottom: () => fontMetrics(title).inkBottom,
  wrapBody: (_scale, _width, text) => [text],
  wrapNote: (_width, text) => [text],
};

describe("helpView", () => {
  const pages = gameData.help.length;
  const words = gameData.menuText.help;

  it.each([
    [0, false, words.next],
    [pages - 1, true, words.gotIt],
  ])("on page %d, Previous is available: %s, and Next reads %s", (page, previous, next) => {
    const view = helpView(gameData, MEASURE, page, "previous");
    const [back, forward] = view.buttons;
    expect([back?.available, back?.pressed]).toEqual([previous, previous]);
    expect(forward?.label).toBe(next);
    expect(view.dots.map(({ current }) => current).indexOf(true)).toBe(page);
  });

  it("lays a disabled button's label out on the raised row, in its grey", () => {
    const [enabled] = helpView(gameData, MEASURE, 1, undefined).buttons;
    const [disabled] = helpView(gameData, MEASURE, 0, undefined).buttons;
    expect(disabled?.text.capTop).toBe(enabled?.text.capTop);
    expect(disabled?.text.colour).toBe(PALETTE[BUTTON_COLOURS.disabled.label]);
  });

  it("starts the body the label gap under the title's lowest ink", () => {
    const view = helpView(gameData, MEASURE, 0, undefined);
    const { scale, y } = HELP_LAYOUT.title;
    const metrics = fontMetrics(title);
    const top = Math.round(y - metrics.capTop * scale);
    expect(view.body.capTop).toBe(top + metrics.inkBottom * scale + LABEL_HELP_GAP);
  });

  it.each(gameData.help.map((page, i) => [i, page.title] as const))(
    "titles page %d %s, amber, centred on its ink across the screen",
    (page, title) => {
      expect(helpView(gameData, MEASURE, page, undefined).title).toMatchObject({
        capTop: HELP_LAYOUT.title.y,
        centre: "ink",
        centreX: HELP_LAYOUT.screen.width / 2,
        colour: PALETTE.amber,
        font: "title",
        text: title,
      });
    },
  );

  it.each(gameData.help.map((page, i) => [i, page.caption] as const))(
    "captions page %d's picture %s, plum, centred on its ink across the well",
    (page, caption) => {
      const view = helpView(gameData, MEASURE, page, undefined);
      expect(view.caption).toMatchObject({
        capTop: HELP_LAYOUT.caption.y,
        centre: "ink",
        centreX: HELP_LAYOUT.well.x + HELP_LAYOUT.well.width / 2,
        colour: PALETTE.plum,
        font: "body",
        text: caption,
      });
      expect(view.label).toBe(words.heading);
    },
  );
});

describe("the picture's frame", () => {
  const filled = (fills: readonly HelpFill[], x: number, y: number) =>
    fills.findLast(({ rect }) => containsPoint(rect, x, y))?.colour;

  // Each corner's pixel shows the page through, and the lines, face and lip are where the house
  // chrome's are; the well's rings are an ink ring with cut corners round a plum one.
  it.each([
    ["the corner", 0, 0, undefined],
    ["the ink line", 1, 0, PALETTE.ink],
    ["the plum line's corner", 1, 1, PALETTE.plum],
    ["the face", 2, 2, PALETTE.cream],
    ["the lip's bottom row", 2, 7, PALETTE.tan],
    ["the lip's right column", 7, 2, PALETTE.tan],
  ] as const)("paints %s of the chrome", (_, x, y, colour) => {
    expect(filled(chromeFills({ height: 10, width: 10, x: 0, y: 0 }), x, y)).toBe(colour);
  });

  it.each([
    ["the corner", 0, 0, undefined],
    ["the ink ring", 1, 0, PALETTE.ink],
    ["the plum ring", 1, 1, PALETTE.plum],
  ] as const)("paints %s of the well", (_, x, y, colour) => {
    expect(filled(wellFills({ height: 10, width: 10, x: 0, y: 0 }), x, y)).toBe(colour);
  });
});

it("provides Back as the sole primary on every full-size Help page", () => {
  for (let page = 0; page < gameData.help.length; page++) {
    const view = helpView(gameData, MEASURE, page, undefined);
    expect(view.footer.label).toBe(gameData.menuText.pageBack);
    expect(view.footer.primary).toBe(true);
    expect(view.buttons.every((button) => !button.primary && button.secondary)).toBe(true);
    expect(view.footer.rect).toMatchObject({
      height: HELP_LAYOUT.footer.height,
      y: HELP_LAYOUT.footer.y,
    });
  }
});

// Art's pager table (art/layout.md): Previous, the dots 4 apart and Next in one row, 8 between
// the dots and each button, centred in the protected 328px page room; Back under it.
it.each([
  ["a middle page", 1, [24, 140], [172, 68], [248, 87]],
  ["the last page", gameData.help.length - 1, [18, 140], [166, 68], [242, 100]],
] as const)(
  "lays out the pager on %s and shares its press areas with the pointer",
  (_, page, [previousX, previousWidth], [countX, countWidth], [nextX, nextWidth]) => {
    const view = helpView(gameData, MEASURE, page, undefined);
    const [previous, next] = view.buttons;
    expect(previous!.rect).toEqual({ height: 48, width: previousWidth, x: previousX, y: 444 });
    expect(next!.rect).toEqual({ height: 48, width: nextWidth, x: nextX, y: 444 });
    expect(view.count).toEqual({ height: 8, width: countWidth, x: countX, y: 464 });
    expect(view.dots.map(({ rect }) => rect.x)).toEqual(
      Array.from({ length: gameData.help.length }, (_, i) => countX + 12 * i),
    );
    expect(view.footer.rect).toEqual({ height: 48, width: 87, x: 136.5, y: 500 });
    // The press areas are the faces and half the stacked gap round them: 4 short of the dots
    // and of Back.
    expect(previous!.hit).toEqual({
      height: 56,
      width: previousWidth + 8,
      x: previousX - 4,
      y: 440,
    });
    expect(previous!.hit.x + previous!.hit.width).toBe(countX - 4);
    expect(next!.hit.x).toBe(countX + countWidth + 4);
    expect(next!.hit.y + next!.hit.height).toBe(view.footer.rect.y - 4);
    const actions = { footer: view.footer.hit, next: next!.hit, previous: previous!.hit };
    for (const [target, expected] of [
      [actions.previous, { kind: "previous" }],
      [actions.next, { kind: "advance" }],
      [actions.footer, { kind: "close" }],
    ] as const) {
      const point = { x: target.x + 1, y: target.y + target.height / 2 };
      expect(helpActionAt(actions, point)).toEqual(expected);
      expect(helpActionForPointer(actions, point, point)).toEqual(expected);
    }
    const dot = { x: countX + 1, y: 466 };
    expect(helpActionAt(actions, dot)).toBeUndefined();
  },
);
