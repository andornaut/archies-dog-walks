import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { BUTTON_SIZE } from "./buttonGeometry.ts";
import { MODAL } from "./modalGeometry.ts";

// Modal close faces sit 6px inside the top-right corner, within a MIN_PRESS square corner target,
// and a title clears the whole target. Pages have no close control.
const FACE_SIZE = BUTTON_SIZE.icon.face;
const HIT_SIZE = BUTTON_SIZE.icon.target;

export interface CloseControl {
  readonly hit: Rect;
  // The face's top-left corner.
  readonly x: number;
  readonly y: number;
}

// The close control in a card's or panel's top-right corner.
export function closeControl(frame: Rect): CloseControl {
  const frameRight = frame.x + frame.width;
  return {
    hit: { height: HIT_SIZE, width: HIT_SIZE, x: frameRight - HIT_SIZE, y: frame.y },
    x: frameRight - MODAL.closeInset - FACE_SIZE,
    y: frame.y + MODAL.closeInset,
  };
}

// The face's own rect, for a focus ring.
export function closeFace(control: CloseControl): Rect {
  return { height: FACE_SIZE, width: FACE_SIZE, x: control.x, y: control.y };
}
