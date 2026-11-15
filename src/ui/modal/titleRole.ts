import { type BitmapFont, fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { plainMarks } from "../pixelFont.ts";
import { MODAL_TITLE_SCALE, TEXT_SCALE } from "../textFit.ts";

export interface TitleInk {
  readonly top: number;
  readonly bottom: number;
}

// Heading geometry uses the actual visible glyph rows, including punctuation and accents.
export function modalTitleInk(font: BitmapFont, text: string): TitleInk {
  const glyphs = [...plainMarks(text).toUpperCase()].flatMap((char) => {
    const glyph = font.glyphs.get(char);
    return glyph !== undefined && glyph.width > 0 && glyph.height > 0 ? [glyph] : [];
  });
  const cap = fontMetrics(font).capTop;
  return glyphs.length === 0
    ? { bottom: 0, top: 0 }
    : {
        bottom:
          (Math.max(...glyphs.map((glyph) => glyph.yOffset + glyph.height)) - cap) *
          MODAL_TITLE_SCALE,
        top: (Math.min(...glyphs.map((glyph) => glyph.yOffset)) - cap) * MODAL_TITLE_SCALE,
      };
}

// Existing text probes measure title-font action text at TEXT_SCALE.
export function modalTitleWidthAtScale(ink: number): number {
  return (ink * MODAL_TITLE_SCALE) / TEXT_SCALE;
}
