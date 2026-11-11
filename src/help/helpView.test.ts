import { fontMetrics, inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { gameFont } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { shownText } from "../ui/dom/pixelLine.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_COLOURS } from "../ui/selection.ts";
import { HELP_LAYOUT } from "./helpLayout.ts";
import { type HelpMeasure, helpView } from "./helpView.ts";

const title = gameFont("font-title");
const body = gameFont("font-body");

// The help measured on the game's .fnt files.
const MEASURE: HelpMeasure = {
  body: fontMetrics(body),
  inkWidth: (font, line) => inkWidth(font === "title" ? title : body, 2, shownText(font, line)),
  title: fontMetrics(title),
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
});
