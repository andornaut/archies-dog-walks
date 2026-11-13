import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects } from "phaser";

import { centredInkOffsets } from "../centredInkBlock.ts";

// The glyph pixels as drawn, excluding the last glyph's spare advance and blank font rows.
function textInk(label: GameObjects.BitmapText): Rect {
  const characters = label
    .getTextBounds(true)
    .characters.filter((char) => char.w > 0 && char.h > 0);
  if (characters.length === 0) {
    return { height: 0, width: 0, x: label.x, y: label.y };
  }
  const left = Math.min(...characters.map((char) => char.x));
  const top = Math.min(...characters.map((char) => char.y));
  return {
    height: (Math.max(...characters.map((char) => char.y + char.h)) - top) * label.scaleY,
    width: (Math.max(...characters.map((char) => char.x + char.w)) - left) * label.scaleX,
    x: label.x + (left - label.displayOriginX) * label.scaleX,
    y: label.y + (top - label.displayOriginY) * label.scaleY,
  };
}

// Keep a backed label or note block centred on its actual glyph ink, at its existing font size.
export function centreBackedText(backing: Rect, labels: readonly GameObjects.BitmapText[]): void {
  const offsets = centredInkOffsets(backing, labels.map(textInk));
  labels.forEach((label, i) => {
    const offset = offsets[i];
    if (offset !== undefined) {
      label.setPosition(label.x + offset.x, label.y + offset.y);
    }
  });
}
