import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { gameFont } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { shownText } from "../ui/dom/pixelLine.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { MODAL } from "../ui/modal/layout.ts";
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

  it("sets a disabled button's label pressed, in its grey", () => {
    const [enabled] = helpView(gameData, MEASURE, 1, undefined).buttons;
    const [disabled] = helpView(gameData, MEASURE, 0, undefined).buttons;
    expect(disabled?.text.capTop).toBe((enabled?.text.capTop ?? 0) + BUTTON_SIZE.press);
    expect(disabled?.text.colour).toBe(PALETTE[BUTTON_COLOURS.disabled.label]);
  });

  it("starts the body the label gap under the title's lowest ink", () => {
    const view = helpView(gameData, MEASURE, 0, undefined);
    const { scale, y } = HELP_LAYOUT.title;
    const metrics = fontMetrics(title);
    const top = Math.round(y - metrics.capTop * scale);
    expect(view.body.capTop).toBe(top + metrics.inkBottom * scale + LABEL_HELP_GAP);
  });

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

it("sizes Help actions from full-font ink and shares their exact rendered pointer bounds", () => {
  for (const page of [0, gameData.help.length - 1]) {
    const view = helpView(gameData, MEASURE, page, undefined);
    const [previous, next] = view.buttons;
    const actions = { footer: view.footer.hit, next: next!.hit, previous: previous!.hit };
    for (const [button, anchor] of [
      [previous!, HELP_LAYOUT.previous],
      [next!, HELP_LAYOUT.next],
      [view.footer, HELP_LAYOUT.footer],
    ] as const) {
      expect(button.rect.width).toBe(
        Math.max(48, Math.ceil(MEASURE.inkWidth("title", button.label) + 2 * MODAL.pad)),
      );
      expect(button.rect).toMatchObject({ height: anchor.height, y: anchor.y });
      expect(button.hit).toEqual(button.rect);
      expect(button.text.scale).toBe(2);
      expect(button.text.centreX).toBe(button.rect.x + button.rect.width / 2);
    }
    expect(next!.rect.x - previous!.rect.x - previous!.rect.width).toBe(BUTTON_SIZE.gap);
    expect((previous!.rect.x + next!.rect.x + next!.rect.width) / 2).toBe(
      HELP_LAYOUT.screen.width / 2,
    );
    expect(view.footer.rect.x + view.footer.rect.width / 2).toBe(HELP_LAYOUT.screen.width / 2);
    for (const [target, expected] of [
      [actions.previous, { kind: "previous" }],
      [actions.next, { kind: "advance" }],
      [actions.footer, { kind: "close" }],
    ] as const) {
      const point = { x: target.x + 1, y: target.y + target.height / 2 };
      expect(helpActionAt(gameData.help.length, actions, point)).toEqual(expected);
      expect(helpActionForPointer(gameData.help.length, actions, point, point)).toEqual(expected);
    }
    const oldFooterEdge = { x: HELP_LAYOUT.footer.x + 1, y: view.footer.rect.y + 1 };
    expect(helpActionAt(gameData.help.length, actions, oldFooterEdge)).toBeUndefined();
    expect(
      helpActionForPointer(gameData.help.length, actions, oldFooterEdge, oldFooterEdge),
    ).toBeUndefined();
    const point = { x: next!.rect.x + 1, y: next!.rect.y + 1 };
    expect(
      helpActionForPointer(gameData.help.length, actions, point, { ...point, x: point.x + 50 }),
    ).toEqual({ kind: "previous" });
  }
});
