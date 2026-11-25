import { registerPixelFont } from "@andornaut/game-kit/runtime/text/phaser/registerPixelFont";
import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import shippedManifest from "../../../public/art/manifest.json" with { type: "json" };
import { parseManifest } from "../../assets/manifest.ts";
import { fontInk, phaserFontData } from "../../testing/fontInk.ts";
import { GLYPH_HEIGHT, glyphAdvance, LINE_HEIGHT, PIXEL_GLYPHS } from "../pixelFont.ts";
import { addPixelText, type FontRole, registerFallbackPixelFont } from "./pixelText.ts";

vi.mock("@andornaut/game-kit/runtime/text/phaser/registerPixelFont", () => ({
  registerPixelFont: vi.fn(),
}));

it("registers its fallback glyphs with the game key, white ink and line spacing", () => {
  const scene = {} as Scene;
  registerFallbackPixelFont(scene);
  const [supplied, options, atlas] = vi.mocked(registerPixelFont).mock.calls[0] ?? [];
  expect(supplied).toBe(scene);
  expect(options).toEqual({
    colour: "#ffffff",
    key: "font-pixel-fallback",
    lineHeight: LINE_HEIGHT,
    size: GLYPH_HEIGHT,
    spaceAdvance: glyphAdvance(" "),
  });
  expect(atlas?.height).toBe(GLYPH_HEIGHT);
  expect(atlas?.glyphs.map(({ char }) => char)).toEqual(PIXEL_GLYPHS.map(({ char }) => char));
});

// The kit throws when the fallback's texture key is already in use, so no texture Boot loads
// before registering it may take that key.
it("registers its fallback under a key no shipped texture or atlas page uses", () => {
  registerFallbackPixelFont({} as Scene);
  const key = vi.mocked(registerPixelFont).mock.calls.at(-1)?.[1].key;
  const { fonts, images, sprites } = parseManifest(shippedManifest);
  const loaded = [...fonts, ...images, ...sprites].map((entry) => entry.key);
  expect(key).toBeDefined();
  expect(loaded).not.toContain(key);
  expect(key).not.toMatch(/^atlas:/);
});

const FONTS: Readonly<Record<FontRole, string>> = { body: "font-body", title: "font-title" };

// A scene whose cache holds the game's fonts as Phaser parses them, and which records where each
// label is drawn.
function fakeScene(): { drawn: { x: number }[]; scene: Scene } {
  const drawn: { x: number }[] = [];
  const scene = sceneStub(vi.fn, {
    add: {
      bitmapText: (x: number) => {
        drawn.push({ x });
        const label = {
          setData: () => label,
          setOrigin: () => label,
          setScale: () => label,
          setTint: () => label,
        };
        return label;
      },
    },
  });
  for (const key of Object.values(FONTS)) {
    scene.cache.bitmapFont.add(key, { data: phaserFontData(key) });
  }
  return { drawn, scene: scene as unknown as Scene };
}

// A word starting with each capital and digit, and with "$" and "+" for amounts.
const FIRSTS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+"];

describe("addPixelText", () => {
  // The shift reads only where the first glyph's ink starts in each font, so at 1x the first
  // glyph of each pair of title and body ink starts covers every glyph; and at 2x, where the
  // shift scales with the label, one whose title ink starts right of its origin and one whose
  // ink starts at it.
  const inkStart = (font: FontRole, first: string) =>
    fontInk(FONTS[font], { scale: 1 }, font === "title" ? `${first}OW` : first).left;
  const starts = (first: string) => `${inkStart("title", first)},${inkStart("body", first)}`;
  const oneX = FIRSTS.filter(
    (first, i) => FIRSTS.findIndex((other) => starts(other) === starts(first)) === i,
  );
  const twoX = [
    FIRSTS.find((first) => inkStart("title", first) > 0),
    FIRSTS.find((first) => inkStart("title", first) === 0),
  ].flatMap((first) => (first === undefined ? [] : [first]));
  it.each([
    ...oneX.map((first) => ({ scale: 1, text: `${first}ow` })),
    ...twoX.map((first) => ({ scale: 2, text: `${first}ow` })),
  ])(
    "starts left-aligned title and body $text's ink in one column at scale $scale",
    ({ scale, text }) => {
      const { drawn, scene } = fakeScene();
      const x = 12;
      const style = { scale };
      const inkLeft = (["title", "body"] as const).map((font) => {
        addPixelText(scene, x, 0, text, { colour: 0, font, scale });
        const shown = font === "title" ? text.toUpperCase() : text;
        return (drawn.at(-1)?.x ?? 0) + fontInk(FONTS[font], style, shown).left;
      });
      expect(inkLeft).toEqual([x, x]);
    },
  );
});
