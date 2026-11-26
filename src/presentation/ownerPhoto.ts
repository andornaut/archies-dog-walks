import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import { DOG_CARD_PARTS } from "../data/index.ts";

// The owner's photo round their size-square face, its top-left at face: the face inside the
// walk card's mat and frame.
export function ownerPhotoRect(size: number, face: Point): Rect {
  const { photo } = DOG_CARD_PARTS.owner;
  const outset = photo.frame + photo.mat;
  const side = size + 2 * outset;
  return { height: side, width: side, x: face.x - outset, y: face.y - outset };
}
