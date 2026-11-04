import {
  glyphAdvance as fontGlyphAdvance,
  pixelFontAtlas as buildPixelFontAtlas,
} from "@andornaut/game-kit/text/pixelFont";
import { describe, expect, it, vi } from "vitest";

import {
  GLYPH_HEIGHT,
  glyphAdvance,
  normalizePixelText,
  PIXEL_GLYPHS,
  pixelFontAtlas,
  plainMarks,
} from "./pixelFont";

vi.mock("@andornaut/game-kit/text/pixelFont", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@andornaut/game-kit/text/pixelFont")>();
  return {
    ...actual,
    glyphAdvance: vi.fn(actual.glyphAdvance),
    pixelFontAtlas: vi.fn(actual.pixelFontAtlas),
  };
});

describe("PIXEL_GLYPHS", () => {
  it("gives every glyph whole columns of bits, and covers every character the cards and money need", () => {
    const bad = PIXEL_GLYPHS.filter(
      ({ bits, width }) => !/^[01]+$/.test(bits) || !Number.isInteger(width),
    );
    expect(bad.map(({ char }) => char)).toEqual([]);
    const chars = new Set(PIXEL_GLYPHS.map(({ char }) => char));
    const missing = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-.,:!?'()/♥"].filter(
      (char) => !chars.has(char),
    );
    expect(missing).toEqual([]);
  });
});

it("draws the house minus as three pixels across the middle glyph row", () => {
  expect(pixelFontAtlas().glyphs.find(({ char }) => char === "-")?.pixels).toEqual([
    [0, 2],
    [1, 2],
    [2, 2],
  ]);
});

describe("plainMarks and normalizePixelText", () => {
  it("make typographic marks plain ASCII, the pixel text in capitals", () => {
    expect(plainMarks("−1 ♥ “each” × 2, don’t")).toBe('-1 ♥ "each" x 2, don\'t');
    expect(normalizePixelText("−$10 per dog’s × 2")).toBe("-$10 PER DOG'S X 2");
  });
});

describe("the game pixel font adapter", () => {
  const context = {
    glyphs: PIXEL_GLYPHS,
    height: GLYPH_HEIGHT,
    spaceWidth: 3,
    spacing: 1,
  };

  it("passes its glyph content and spacing policy to atlas construction and advance measurement", () => {
    const atlas = { glyphs: [], height: GLYPH_HEIGHT, width: 0 };
    vi.mocked(buildPixelFontAtlas).mockReturnValueOnce(atlas);
    expect(pixelFontAtlas()).toBe(atlas);
    expect(buildPixelFontAtlas).toHaveBeenCalledWith(context);
    vi.mocked(fontGlyphAdvance).mockReturnValueOnce(4);
    glyphAdvance("♥");
    expect(fontGlyphAdvance).toHaveBeenCalledWith(context, "♥");
  });
});
