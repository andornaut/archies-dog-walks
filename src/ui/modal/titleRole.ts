import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { lineInk } from "../lineInk.ts";
import { plainMarks } from "../pixelFont.ts";
import { MODAL_TITLE_SCALE, TEXT_SCALE } from "../textFit.ts";

export interface TitleInk {
  readonly top: number;
  readonly bottom: number;
}

// Heading geometry uses the actual visible glyph rows, including punctuation and accents.
export function modalTitleInk(font: BitmapFont, text: string): TitleInk {
  const { bottom, top } = lineInk(font, plainMarks(text).toUpperCase(), MODAL_TITLE_SCALE);
  return { bottom, top };
}

// Existing text probes measure title-font action text at TEXT_SCALE.
export function modalTitleWidthAtScale(ink: number): number {
  return (ink * MODAL_TITLE_SCALE) / TEXT_SCALE;
}
