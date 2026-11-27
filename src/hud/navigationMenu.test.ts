import { fillNames, wrapWords } from "@andornaut/game-kit/runtime/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { fontFileMetrics, fontInkRows, gameFont, inkWidth } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import {
  menuItemLabel,
  menuItems,
  navigationMenuWidth,
  PAUSE_MENU_ITEMS,
  PAUSE_MENU_KEY_ORDER,
  pauseMenuItemLabel,
} from "../ui/navigationMenu.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { ACTION_LABEL_SCALE, TEXT_SCALE } from "../ui/textFit.ts";
import { NOTE_PLATE } from "./pauseMenu.ts";
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
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (width, line) =>
    wrapWords((part) => bodyTextWidth(NOTE_PLATE.scale, part), width, line),
};

it("orders navigation by label with Back to title and the primary action last, and no Quit", () => {
  expect(menuItems("home")).toEqual(["cheats", "help", "logbook", "settings", "close"]);
  expect(menuItems("page")).toEqual(["cheats", "help", "logbook", "settings", "headHome", "close"]);
  expect(menuItems("cheats")).toEqual(["help", "settings", "headHome", "close"]);
  expect(menuItems("help")).toEqual(["cheats", "settings", "headHome", "close"]);
  expect(menuItems("settings")).toEqual(["cheats", "help", "headHome", "close"]);
  expect(menuItems("end")).toEqual(["cheats", "settings", "headHome", "close"]);
  expect(PAUSE_MENU_ITEMS).toEqual(["cheats", "help", "settings", "headHome", "resume"]);
  expect(PAUSE_MENU_KEY_ORDER).toEqual(["resume", "help", "settings", "headHome", "cheats"]);
});

it.each(["cheats", "end", "help", "home", "page", "settings"] as const)(
  "lists the %s Menu's navigation after Cheats alphabetically by label",
  (context) => {
    const others = menuItems(context)
      .filter((item) => item !== "cheats" && item !== "close" && item !== "headHome")
      .map((item) => menuItemLabel(gameData, item));
    expect(others).toEqual([...others].sort((a, b) => a.localeCompare(b)));
  },
);

describe.each(["home", "pause"] as const)("%s navigation geometry", (context) => {
  const labels =
    context === "home"
      ? menuItems("page").map((item) => menuItemLabel(gameData, item))
      : PAUSE_MENU_ITEMS.map((item) => pauseMenuItemLabel(gameData, item));
  const width = navigationMenuWidth(
    gameData,
    measure,
    SCREEN_LAYOUT.screen.width - 2 * MODAL.margin,
  );
  const view = questionPanelView(measure, SCREEN_LAYOUT.walkView, {
    labels,
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

  it("keeps the first visible content clear of the title and the primary action at the bottom", () => {
    expect(width).toBeGreaterThanOrEqual(SCREEN_LAYOUT.screen.width / 2);
    expect(view.panel.width).toBe(width);
    expect(view.buttons.map((button) => button.text.text)).toEqual(labels);
    expect(view.buttons.filter(({ primary }) => primary)).toEqual([view.buttons.at(-1)]);
    const titleBottom = Math.max(
      ...view.title.map((line) => line.capTop + measure.titleInk(line.text).bottom),
    );
    const titleTop = Math.min(
      ...view.title.map((line) => line.capTop + measure.titleInk(line.text).top),
    );
    const first = view.notePlate ?? view.buttons[0]!.rect;
    const last = view.buttons.at(-1)!.rect;
    expect(titleTop - view.panel.y).toBe(MODAL.titleTop);
    expect(first.y - titleBottom).toBe(MODAL.titleTop);
    expect(view.panel.y + view.panel.height - last.y - last.height).toBe(MODAL.pad);
    expect(first.y).toBeGreaterThanOrEqual(view.close.hit.y + view.close.hit.height + MODAL.gap);
    expect(
      view.buttons.every(
        ({ rect, text }) =>
          rect.height >= BUTTON_SIZE.compact.height && text.scale === ACTION_LABEL_SCALE,
      ),
    ).toBe(true);
    for (const { rect, text } of view.buttons) {
      const ink = fontInkRows("font-title", { scale: text.scale }, text.text.toUpperCase());
      expect(text.centreX).toBe(rect.x + rect.width / 2);
      expect(text.capTop + (ink.top + ink.bottom) / 2).toBe(rect.y + rect.height / 2);
    }
    if (context === "pause") {
      const plate = view.notePlate!;
      expect(plate).toBeDefined();
      expect(view.buttons[0]!.rect.y - plate.y - plate.height).toBe(MODAL.gap);
      expect(view.note.length).toBeGreaterThan(0);
      expect(view.note.every((line) => line.scale === NOTE_PLATE.scale)).toBe(true);
    } else {
      expect(view.notePlate).toBeUndefined();
      expect(view.note).toEqual([]);
    }
  });
});

it("uses the approved shared Cheats label in both navigation contexts", () => {
  expect(menuItemLabel(gameData, "cheats")).toBe(gameData.menuText.cheats.open);
  expect(pauseMenuItemLabel(gameData, "cheats")).toBe(gameData.menuText.cheats.open);
});
