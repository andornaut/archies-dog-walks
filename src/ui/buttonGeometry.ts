import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { BUTTON_FACE_EDGE, BUTTON_LIP_PX, BUTTON_SIZE } from "../data/index.ts";

// Standard button geometry in game pixels. Text uses the existing fixed font sizes.
export { BUTTON_SIZE };

// A label's ink block: its top below its first line's capitals' top, and its rows, in game
// pixels.
export interface LabelInk {
  readonly rows: number;
  readonly top: number;
}

// The capitals' top of a label's first line on a raised face: its ink block centred down the
// face's flat fill, between the outline and lit row over it and the lip and outline under it, in
// whole art pixels, any odd row under the ink. The label sinks with a pressed or disabled face.
export function raisedLabelCapTop(face: Pick<Rect, "height" | "y">, ink: LabelInk): number {
  const fill = face.height - BUTTON_FACE_EDGE.top - BUTTON_LIP_PX - BUTTON_FACE_EDGE.bottom;
  return face.y + BUTTON_FACE_EDGE.top + Math.floor((fill - ink.rows) / 2) - ink.top;
}

// Ordinary action ink is centred on the whole painted face; the existing pressed dip is separate.
export function actionLabelCapTop(face: Pick<Rect, "height" | "y">, ink: LabelInk): number {
  return face.y + (face.height - ink.rows) / 2 - ink.top;
}
