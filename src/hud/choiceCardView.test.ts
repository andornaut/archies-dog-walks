import { fontMetrics, laidGlyphs } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { helpPicture } from "../help/helpPictures.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { CARD_LAYOUT, cardEffectArea, cardRowIn } from "../presentation/cardLayout.ts";
import { cardFor } from "../rules/cardViews.ts";
import { MAX_CARD_OPTIONS } from "../rules/choices.ts";
import { fontInkRows, gameFont, inkWidth } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { activeModifier, testState } from "../testing/runState.ts";
import { blockPlace } from "../ui/dom/pixelLine.ts";
import { artPixel, domScale, exactDeviceX, fontPixel } from "../ui/domScale.ts";
import { hasPill } from "../ui/namePills.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { type ChoiceCardSurface, choiceCardSurface } from "./choiceCardView.ts";

function expectCentredOutcomes(surface: ChoiceCardSurface): void {
  const fit = domScale(1, { height: 1280, width: 575, x: 0, y: 0 });
  const centre = exactDeviceX(fit, surface.rect.x + surface.rect.width / 2);
  for (const { align, capTop, colour, font = "body", lines, scale = 2, x } of surface.texts) {
    expect(align).toBe("inkCentreWithPills");
    const bitmap = gameFont(`font-${font}`);
    for (const line of lines) {
      const rendered = blockPlace(bitmap, fit, {
        anchor: "inkCentreWithPills",
        capTop,
        colour,
        font,
        lines: [line],
        scale,
        x,
      });
      const pixel = fontPixel(fit, scale);
      const spans = [
        ...rendered.runs.flatMap((run) =>
          laidGlyphs(bitmap, pixel, run.text).flatMap(({ ink }) =>
            ink === null ? [] : [{ left: run.left + ink.left, right: run.left + ink.right }],
          ),
        ),
        ...rendered.pills.map(({ box }) => ({ left: box.left, right: box.left + box.width })),
      ];
      const left = Math.min(...spans.map((span) => span.left));
      const right = Math.max(...spans.map((span) => span.right));
      expect(Math.abs((left + right) / 2 - centre), line).toBeLessThanOrEqual(artPixel(fit) / 2);
    }
  }
}

it("centres each ordinary outcome line, including the inline debuff pill", () => {
  const view = helpPicture(gameData, "cards").card!;
  const option = view.options.find(({ text }) => text.includes(gameData.debuffs.stinky.name))!;
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  const entry = { choice: option.index, enabled: true, option };
  const walk = SCREEN_LAYOUT.walkView;
  const place = cardRowIn(walk, MAX_CARD_OPTIONS, view.options.length)[1]!;
  for (const [area, held] of [
    [place, false],
    [walk, true],
  ] as const) {
    const surface = choiceCardSurface(gameData, fonts, view, entry, area, held);
    const lines = surface.texts.flatMap((text) => text.lines);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.some(hasPill)).toBe(true);
    expectCentredOutcomes(surface);
  }
});

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
  expectCentredOutcomes(surface);
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

it("fits every dog's forgiven or charged outcome at Body 2 with one title-only attribution", () => {
  const perk = gameData.walkers.casey.perk;
  const effect = gameData.walkerPerks[perk].effects[0]!;
  if (effect.kind !== "modifier") {
    throw new Error("Expected Casey's heart forgiveness modifier");
  }
  const name = gameData.walkerPerks[perk].name;
  const dogs = ["archie", "ginger", "sequoia"] as const;
  const run = testState(
    { archie: 1, ginger: 1, sequoia: 1 },
    { modifiers: [activeModifier({ kind: "walker", walker: "casey" }, effect)] },
  );
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  const walk = SCREEN_LAYOUT.walkView;
  const style = { scale: 2 };
  for (const affected of [[dogs[2]], dogs] as const) {
    const view = cardFor(gameData, run, { affected, encounter: "skunk", kind: "encounter" });
    const option = view.options.find(({ forgivenHearts }) => forgivenHearts !== undefined)!;
    const entry = { choice: option.index, enabled: true, option };
    const place = cardRowIn(walk, MAX_CARD_OPTIONS, view.options.length)[0]!;
    const compactArea = cardEffectArea(fontMetrics(fonts.body), option.fires.length > 0);
    for (const area of [place, walk]) {
      const held = area === walk;
      const surface = choiceCardSurface(gameData, fonts, view, entry, area, held);
      expectCentredOutcomes(surface);
      const outcome = surface.texts.find(({ font, scale }) => font === "body" && scale === 2)!;
      const lines = affected.map(
        (dog, index) => `${index === 0 ? "0" : "−1"}♥ ${gameData.dogs[dog].name}`,
      );
      expect(outcome.lines).toEqual(lines);
      expect(surface.attribution).toBe(name);
      expect(surface.charms).toHaveLength(1);
      const plate = surface.charms[0]!;
      expect(plate.charm).toMatchObject({ effect: null, item: { kind: "perk", perk }, name });
      expect(plate.labels.every(({ font }) => font === "body")).toBe(true);
      expect(plate.labels.map(({ text }) => text).join(" ")).toBe(name);
      expect(inside(plate.rect, walk)).toBe(true);
      expect(surface.marker !== undefined).toBe(affected.length > 1);
      const room = held ? CARD_LAYOUT.large.body.width : compactArea.width;
      const bottom = held
        ? surface.rect.y + surface.rect.height - CARD_LAYOUT.large.bodyGap
        : place.y + compactArea.y + compactArea.height;
      for (const [index, line] of outcome.lines.entries()) {
        expect(inkWidth("font-body", style, plainMarks(line))).toBeLessThanOrEqual(room);
        const capTop = outcome.capTop + index * fonts.body.lineHeight * style.scale;
        expect(
          capTop + fontInkRows("font-body", style, plainMarks(line)).bottom,
        ).toBeLessThanOrEqual(bottom);
      }
    }
  }
});
