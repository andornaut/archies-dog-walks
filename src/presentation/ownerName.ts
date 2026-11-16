import { splitBalancedGraphemes, wrapWords } from "@andornaut/game-kit/runtime/lines";
import {
  type BitmapFont,
  fontMetrics,
  inkWidth,
  laidGlyphs,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { TEXT_SCALE } from "../ui/textFit.ts";

export interface OwnerNameLine {
  readonly ink: {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  };
  readonly text: string;
}

// Owner captions share one full-size body role and a two-line space in both card layouts.
export function ownerNameLayout(font: BitmapFont, room: number, name: string): OwnerNameLine[] {
  const width = (text: string) => inkWidth(font, TEXT_SCALE, text);
  const lines = wrapWords(width, room, name).flatMap((text) => {
    if (width(text) <= room) {
      return [text];
    }
    return splitBalancedGraphemes(width, text) ?? [text];
  });
  if (lines.length > 2 || lines.some((text) => width(text) > room)) {
    throw new RangeError("Owner name exceeds its full-size two-line room");
  }
  const cap = fontMetrics(font).capTop;
  return lines.map((text) => {
    const columns = laidGlyphs(font, TEXT_SCALE, text).flatMap(({ ink }) =>
      ink === null ? [] : [ink],
    );
    const glyphs = [...text].flatMap((char) => {
      const glyph = font.glyphs.get(char);
      return glyph !== undefined && glyph.width > 0 && glyph.height > 0 ? [glyph] : [];
    });
    return {
      ink: {
        bottom:
          glyphs.length === 0
            ? 0
            : (Math.max(...glyphs.map((glyph) => glyph.yOffset + glyph.height)) - cap) * TEXT_SCALE,
        left: columns.length === 0 ? 0 : Math.min(...columns.map((ink) => ink.left)),
        right: columns.length === 0 ? 0 : Math.max(...columns.map((ink) => ink.right)),
        top:
          glyphs.length === 0
            ? 0
            : (Math.min(...glyphs.map((glyph) => glyph.yOffset)) - cap) * TEXT_SCALE,
      },
      text,
    };
  });
}
