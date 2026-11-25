import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { type LineInk, lineInk } from "../ui/lineInk.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";

export interface OwnerNameLine {
  readonly ink: LineInk;
  readonly text: string;
}

// An owner name wrapped only at spaces into room; a word wider than room keeps a whole line.
export function ownerNameWrap(font: BitmapFont, room: number, name: string): OwnerNameLine[] {
  const width = (text: string) => inkWidth(font, TEXT_SCALE, text);
  return wrapWords(width, room, name).map((text) => ({ ink: lineInk(font, text), text }));
}
