import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { PILL_IMAGE_GAP } from "../data/index.ts";
import { hasPill, pillDropUnderInk, pillRiseOverCaps, TEXT_SCALE } from "../ui/index.ts";
import { HOME_LAYOUT } from "./homeGeometry.ts";

// How wide a line of the walker's speech may be, as a label measures it: a bubble that wide
// fits between the screen's margin and the Pet shop's board, so it never reaches the board.
export const SPEECH_ROOM =
  HOME_LAYOUT.petShop.board.x -
  HOME_LAYOUT.speech.clearance -
  HOME_LAYOUT.speech.margin -
  2 * HOME_LAYOUT.speech.padX;

// The speech bubble's rows over and under lines of 2x body text: padTop to the first line's
// capitals and padBottom under the last line's lowest ink. With a pill on the first or last line,
// each end keeps PILL_IMAGE_GAP rows clear of the quip art's rim beyond the furthest the letters
// or that end's pills reach, so the text's ink centred down the cream keeps every pill clear.
export function speechPads(
  body: FontMetrics,
  lines: readonly string[],
): { bottom: number; top: number } {
  const { padBottom, padTop, rim } = HOME_LAYOUT.speech;
  const first = hasPill(lines[0] ?? "");
  const last = hasPill(lines.at(-1) ?? "");
  if (!first && !last) {
    return { bottom: padBottom, top: padTop };
  }
  const rise = Math.max(
    (body.capTop - body.letterTop) * TEXT_SCALE,
    first ? pillRiseOverCaps(body, TEXT_SCALE) : 0,
  );
  const drop = last ? pillDropUnderInk(body, TEXT_SCALE) : 0;
  return {
    bottom: Math.max(padBottom, drop + PILL_IMAGE_GAP + rim.bottom),
    top: Math.max(padTop, rim.top + PILL_IMAGE_GAP + rise),
  };
}

// The speech bubble's height for lines of 2x body text.
export function speechBubbleHeight(body: FontMetrics, lines: readonly string[]): number {
  const pads = speechPads(body, lines);
  return pads.top + inkRowsOfLines(body, lines.length) * TEXT_SCALE + pads.bottom;
}
