import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import {
  type BitmapFont,
  fontMetrics,
  inkWidth,
  laidGlyphs,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { TEXT_SCALE } from "../ui/textFit.ts";

export interface OwnerNameInk {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export interface OwnerNameLine {
  readonly ink: OwnerNameInk;
  readonly text: string;
}

// An owner name wrapped only at spaces into room; a word wider than room keeps a whole line.
export function ownerNameWrap(font: BitmapFont, room: number, name: string): OwnerNameLine[] {
  const width = (text: string) => inkWidth(font, TEXT_SCALE, text);
  return wrapWords(width, room, name).map((text) => ({ ink: ownerNameInk(font, text), text }));
}

// Visible ink bounds relative to the first capital for the shared owner-name role.
export function ownerNameInk(font: BitmapFont, text: string, scale = TEXT_SCALE): OwnerNameInk {
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
