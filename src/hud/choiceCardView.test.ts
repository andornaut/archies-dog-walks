import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { helpPicture } from "../help/helpPictures.ts";
import { CARD_LAYOUT, cardRowIn } from "../layout/cardLayout.ts";
import { MAX_CARD_OPTIONS } from "../rules/choices.ts";
import { gameFont } from "../testing/fontInk.ts";
import { choiceCardSurface } from "./choiceCardView.ts";

it("projects disabled cards without changing choices and retains the full-size held view", () => {
  const view = helpPicture(gameData, "cards").card!;
  const option = view.options[0]!;
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  const entry = { choice: option.index, enabled: false, option };
  const rect = cardRowIn(SCREEN_LAYOUT.walkView, MAX_CARD_OPTIONS, view.options.length)[0]!;
  const small = choiceCardSurface(gameData, fonts, view, entry, rect);
  const large = choiceCardSurface(gameData, fonts, view, entry, SCREEN_LAYOUT.walkView, true);
  expect(small.rect).toEqual(rect);
  expect(small.grey).toBe(true);
  expect(small.label).toBe(option.label);
  expect(small.illustration.key).toBe(option.art);
  expect(large.grey).toBe(false);
  expect(large.rect.width).toBe(CARD_LAYOUT.large.width);
  expect(large.texts.some((text) => text.font === "body" && text.scale === 2)).toBe(true);
  expect(option.availability.enabled).toBe(true);
});
