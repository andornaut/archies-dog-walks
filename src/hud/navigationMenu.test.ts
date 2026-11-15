import { fillNames, wrapWords } from "@andornaut/game-kit/runtime/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, inkWidth } from "../testing/fontInk.ts";
import { MODAL } from "../ui/modal/layout.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import {
  menuItemLabel,
  menuItems,
  navigationMenuWidth,
  PAUSE_MENU_ITEMS,
  PAUSE_MENU_KEY_ORDER,
} from "../ui/navigationMenu.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { TEXT_SCALE, TITLE_CAP_ROWS } from "../ui/textFit.ts";
import { NOTE_PLATE, pauseMenuLayout } from "./pauseMenu.ts";
import { questionPanelView } from "./questionPanelView.ts";

const measure: PanelMeasure = {
  body: fontFileMetrics("font-body"),
  inkWidth: (font, line) =>
    inkWidth(
      font === "title" ? "font-title" : "font-body",
      { scale: TEXT_SCALE },
      font === "title" ? plainMarks(line).toUpperCase() : line,
    ),
  title: fontFileMetrics("font-title"),
  wrapNote: (width, line) =>
    wrapWords((part) => bodyTextWidth(NOTE_PLATE.scale, part), width, line),
};

it("keeps applicable navigation in order with the primary action last and guarded Quit", () => {
  expect(menuItems("home", true)).toEqual(["help", "logbook", "settings", "quit", "close"]);
  expect(menuItems("home", false)).toEqual(["help", "logbook", "settings", "close"]);
  expect(menuItems("help", true)).toEqual(["settings", "close"]);
  expect(menuItems("end", true)).toEqual(["settings", "headHome", "close"]);
  expect(PAUSE_MENU_ITEMS).toEqual(["help", "settings", "headHome", "resume"]);
  expect(PAUSE_MENU_KEY_ORDER).toEqual(["resume", "help", "settings", "headHome"]);
});

describe.each(["home", "pause"] as const)("%s navigation geometry", (context) => {
  const labels =
    context === "home"
      ? menuItems("home", true).map((item) => menuItemLabel(gameData, item))
      : PAUSE_MENU_ITEMS.map((item) => gameData.menuText.pause[item]);
  const width = navigationMenuWidth(
    gameData,
    measure,
    SCREEN_LAYOUT.screen.width - 2 * MODAL.margin,
  );
  const view = questionPanelView(measure, SCREEN_LAYOUT.walkView, {
    labels,
    layout: pauseMenuLayout,
    note:
      context === "home"
        ? []
        : [{ colour: 0, text: fillNames(gameData.menuText.pause.noteAll, { cash: "$1" }) }],
    panelWidth: width,
    primary: "last",
    sentenceLines: true,
    showKeyNumbers: false,
    title: context === "home" ? gameData.menuText.menu.title : gameData.menuText.pause.title,
  });

  it("shares measured fixed-font width, balanced title/content padding and a bottom primary", () => {
    expect(width).toBe(SCREEN_LAYOUT.screen.width / 2);
    expect(view.panel.width).toBe(width);
    expect(view.buttons.map((button) => button.text.text)).toEqual(labels);
    expect(view.buttons.filter(({ primary }) => primary)).toEqual([view.buttons.at(-1)]);
    const titleBottom = view.title.at(-1)!.capTop + TITLE_CAP_ROWS * TEXT_SCALE;
    expect(view.buttons[0]!.rect.y - titleBottom).toBe(MODAL.pad);
    const last = view.notePlate ?? view.buttons.at(-1)!.rect;
    expect(view.panel.y + view.panel.height - last.y - last.height).toBe(MODAL.pad);
    expect(view.buttons[0]!.rect.y).toBeGreaterThanOrEqual(
      view.close.hit.y + view.close.hit.height + MODAL.gap,
    );
  });
});
