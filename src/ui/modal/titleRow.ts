import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { MODAL } from "../modalGeometry.ts";

// The title row inside a modal card, clear of its separate corner close control.
export function cardTitleRow(card: Rect): Rect {
  const height = MODAL.header - 2 * MODAL.titleTop;
  const inset = MODAL.pad;
  return { height, width: card.width - 2 * inset, x: card.x + inset, y: card.y + MODAL.titleTop };
}
