import {
  type BitmapFont,
  fontMetrics,
  laidGlyphs,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { TEXT_SCALE } from "./textFit.ts";

// A line's visible ink at a scale: its left and right columns from the pen's start, and its top
// and bottom rows from the font's first capital, each 0 for a line with no ink.
export interface LineInk {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// The ink of text as font draws it in one line at scale.
export function lineInk(font: BitmapFont, text: string, scale = TEXT_SCALE): LineInk {
  const cap = fontMetrics(font).capTop;
  const columns = laidGlyphs(font, scale, text).flatMap(({ ink }) => (ink === null ? [] : [ink]));
  const glyphs = [...text].flatMap((char) => {
    const glyph = font.glyphs.get(char);
    return glyph !== undefined && glyph.width > 0 && glyph.height > 0 ? [glyph] : [];
  });
  return {
    bottom:
      glyphs.length === 0
        ? 0
        : (Math.max(...glyphs.map((glyph) => glyph.yOffset + glyph.height)) - cap) * scale,
    left: columns.length === 0 ? 0 : Math.min(...columns.map((ink) => ink.left)),
    right: columns.length === 0 ? 0 : Math.max(...columns.map((ink) => ink.right)),
    top:
      glyphs.length === 0 ? 0 : (Math.min(...glyphs.map((glyph) => glyph.yOffset)) - cap) * scale,
  };
}
