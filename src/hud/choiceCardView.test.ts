import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { helpPicture } from "../help/helpPictures.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { CARD_LAYOUT, cardRowIn } from "../presentation/cardLayout.ts";
import { cardFor } from "../rules/cardViews.ts";
import { MAX_CARD_OPTIONS } from "../rules/choices.ts";
import { gameFont } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { testState } from "../testing/runState.ts";
import { plainMarks } from "../ui/pixelFont.ts";
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

it("keeps the complete seven-row held loss and firing warning inside the walk view", () => {
  const dogs = ["sequoia", "archie", "ginger"] as const;
  const run = testState({ archie: 1, ginger: 1, sequoia: 1 });
  const view = cardFor(gameData, run, { affected: dogs, encounter: "skunk", kind: "encounter" });
  const option = view.options.find(({ fires }) => fires.length === dogs.length)!;
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  const walk = SCREEN_LAYOUT.walkView;
  const entry = { choice: option.index, enabled: true, option };
  const surface = choiceCardSurface(gameData, fonts, view, entry, walk, true);
  const warning = surface.texts.find(({ font }) => font === "title")!;
  const body = surface.texts.find(({ font }) => font === "body")!;
  expect(surface.charms).toEqual([]);
  expect(inside(surface.rect, walk)).toBe(true);
  expect(body.lines).toHaveLength(7);
  expect(body.scale).toBe(2);
  const inkRows = (text: typeof body, font: typeof fonts.body) => {
    const { capTop } = fontMetrics(font);
    const scale = text.scale!;
    return text.lines.flatMap((line, index) => {
      const plain = plainMarks(line);
      const shown = text.font === "title" ? plain.toUpperCase() : plain;
      return [...shown].flatMap((char) => {
        const glyph = font.glyphs.get(char);
        if (glyph === undefined || glyph.height === 0) {
          return [];
        }
        const top = text.capTop + (index * font.lineHeight + glyph.yOffset - capTop) * scale;
        return [{ bottom: top + glyph.height * scale, top }];
      });
    });
  };
  const warningBottom = Math.max(...inkRows(warning, fonts.title).map(({ bottom }) => bottom));
  const changeRows = inkRows(body, fonts.body);
  expect(Math.min(...changeRows.map(({ top }) => top))).toBeGreaterThan(warningBottom);
  expect(Math.max(...changeRows.map(({ bottom }) => bottom))).toBeLessThan(
    surface.rect.y + surface.rect.height,
  );
});
