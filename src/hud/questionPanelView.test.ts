import { fillNames, wrapWords } from "@andornaut/game-kit/lines";
import { containsPoint, rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { dollarText } from "../home/home.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, inkWidth } from "../testing/fontInk.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { homeQuestionLayout, NOTE_PLATE, PAUSE_MENU_ITEMS, pauseMenuLayout } from "./pauseMenu.ts";
import { type PanelMeasure, type PanelText, questionPanelView } from "./questionPanelView.ts";

// The view measured on the .fnt files the canvas loads, the title font in capitals as it draws.
const MEASURE: PanelMeasure = {
  body: fontFileMetrics("font-body"),
  inkWidth: (font, line) =>
    font === "title"
      ? inkWidth("font-title", { scale: TEXT_SCALE }, plainMarks(line).toUpperCase())
      : inkWidth("font-body", { scale: TEXT_SCALE }, line),
  title: fontFileMetrics("font-title"),
  wrapNote: (width, text) =>
    wrapWords((line) => bodyTextWidth(NOTE_PLATE.scale, line), width, text),
};

const { walkView } = SCREEN_LAYOUT;
const words = gameData.menuText.pause;
const cash = dollarText(cents(99_900));

// A line's ink span across, as the renderers centre it.
function inkSpan(line: PanelText): { left: number; right: number } {
  const half = MEASURE.inkWidth(line.font, line.text) / 2;
  return { left: line.centreX - half, right: line.centreX + half };
}

const PANELS = [
  {
    labels: PAUSE_MENU_ITEMS.map((item) => words[item]),
    layout: pauseMenuLayout,
    name: "the pause menu",
    note: fillNames(words.note, { cash, kept: cash }),
    sentenceLines: true,
    title: words.title,
  },
  {
    labels: [gameData.runText.homeQuestion.keepWalking, gameData.runText.homeQuestion.headHome],
    layout: homeQuestionLayout,
    name: "the Home question",
    note: fillNames(words.note, { cash, kept: cash }),
    sentenceLines: false,
    title: gameData.runText.homeQuestion.title,
  },
] as const;

// Both renderers place every part where the view says, so each part must sit inside its box.
describe.each(PANELS)("questionPanelView for $name", ({ note, ...question }) => {
  const view = questionPanelView(MEASURE, walkView, {
    ...question,
    note: [{ colour: 0, text: note }],
  });

  it("labels each button in order, the first the call to action", () => {
    expect(view.buttons.map(({ label }) => label)).toEqual(question.labels);
    expect(view.buttons.map(({ primary }) => primary)).toEqual(
      question.labels.map((_, i) => i === 0),
    );
  });

  it("keeps every line's ink inside its box and the title clear of the close control", () => {
    for (const { rect, text } of view.buttons) {
      const ink = inkSpan(text);
      expect(ink.left, text.text).toBeGreaterThanOrEqual(rect.x);
      expect(ink.right, text.text).toBeLessThanOrEqual(rect.x + rect.width);
      expect(text.capTop).toBeGreaterThan(rect.y);
      expect(text.capTop + MEASURE.title.capHeight * text.scale).toBeLessThan(rect.y + rect.height);
    }
    for (const line of view.title) {
      const ink = inkSpan(line);
      expect(ink.left).toBeGreaterThanOrEqual(view.panel.x);
      expect(ink.right).toBeLessThanOrEqual(view.close.hit.x);
    }
    const plate = view.notePlate;
    expect(plate).toBeDefined();
    for (const line of view.note) {
      const ink = inkSpan(line);
      expect(plate && ink.left >= plate.x && ink.right <= plate.x + plate.width, line.text).toBe(
        true,
      );
      expect(plate && containsPoint(plate, line.centreX, line.capTop), line.text).toBe(true);
    }
  });

  it("covers the panel's rim, every button and the close control, clear of the walk bar", () => {
    const [rim, ...hits] = view.covered;
    expect(rim && containsPoint(rim, view.panel.x - 1, view.panel.y - 1)).toBe(true);
    expect(hits).toEqual(view.buttons.map(({ hit }) => hit));
    expect(rim && containsPoint(rim, view.close.hit.x, view.close.hit.y)).toBe(true);
    expect(view.covered.some((rect) => rectsOverlap(rect, SCREEN_LAYOUT.topBar))).toBe(false);
  });
});
