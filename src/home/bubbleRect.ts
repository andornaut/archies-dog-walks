import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { FontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { HOME_LAYOUT, SPEECH_ROOM, speechBubbleHeight } from "./homeLayout.ts";

const OWNER = HOME_LAYOUT.speech.owner;

// The walker's speech bubble: centred on x at the given top, moved left when it is tall enough
// to reach the Pet shop's board so it ends clear of it by clearance, and kept margin from the
// screen's left edge.
export function bubbleRect(
  keepClear: Rect,
  sizes: { clearance: number; margin: number },
  at: { x: number; y: number },
  size: { height: number; width: number },
): Rect {
  const centred = Math.round(at.x - size.width / 2);
  const reaches = at.y + size.height > keepClear.y;
  const left = reaches ? Math.min(centred, keepClear.x - sizes.clearance - size.width) : centred;
  return { ...size, x: Math.max(sizes.margin, left), y: at.y };
}

// The bubble's lines: each paragraph in turn wrapped at spaces to room as width measures a line,
// each starting on a new line, however many lines they take: the bubble grows to hold them.
export function speechLines(
  width: (line: string) => number,
  room: number,
  paragraphs: readonly string[],
): string[] {
  return paragraphs.flatMap((paragraph) => wrapWords(width, room, paragraph));
}

// The owner's column beside their parting line: their face's width or their name's ink,
// whichever is wider.
export function ownerColumn(nameInk: number): number {
  return Math.max(OWNER.size, nameInk);
}

// The bubble's lines, as speechLines wraps them, beside an owner's column column wide when the
// last paragraph is their parting line (faced), the text then wrapping roomCut narrower than
// the column; else (column null) across the bubble's whole width.
export function bubbleLines(
  width: (line: string) => number,
  column: number | null,
  paragraphs: readonly string[],
): { faced: boolean; lines: string[] } {
  const room = column === null ? SPEECH_ROOM : SPEECH_ROOM - column - OWNER.roomCut;
  return { faced: column !== null, lines: speechLines(width, room, paragraphs) };
}

// The bubble's size for its widest speech line and, where present, the owner's measured column.
export function bubbleSize(
  body: FontMetrics,
  lines: readonly string[],
  widest: number,
  owner: { column: number; inkHeight: number } | null,
): { height: number; width: number } {
  const { padBottom, padX } = HOME_LAYOUT.speech;
  const natural = speechBubbleHeight(body, lines);
  if (owner === null) {
    return { height: natural, width: widest + 2 * padX };
  }
  return {
    height: Math.max(natural, OWNER.top + OWNER.size + OWNER.nameGap + owner.inkHeight + padBottom),
    width: padX + widest + OWNER.gap + owner.column + OWNER.inset,
  };
}

// Where the owner's face and name go in a bubble at rect with their column column wide: the
// face's square, and the name's centre column and first visible ink row.
export function ownerPlace(
  rect: Rect,
  column: number,
): { face: Rect; name: { inkY: number; x: number } } {
  const left = rect.x + rect.width - OWNER.inset - column;
  const face = {
    height: OWNER.size,
    width: OWNER.size,
    x: left + Math.floor((column - OWNER.size) / 2),
    y: rect.y + OWNER.top,
  };
  return { face, name: { inkY: face.y + OWNER.size + OWNER.nameGap, x: left + column / 2 } };
}
