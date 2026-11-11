import type { Rect } from "@andornaut/game-kit/rect";

import { deviceRect, type DomScale } from "../domScale.ts";
import { setBox } from "./pixelLine.ts";

// The HTML interface's one modal shade: ink at the canvas's modal shade's alpha (MODAL_DIM's
// fallbackAlpha, in uiStyle.ts) over a game rect, its edges on the device grid. A panel draws it
// first, under its own parts and over every panel before it, in place of a dim on the canvas,
// which cannot dim HTML.
export function shadePart(
  doc: Document,
  rect: Rect,
): { readonly element: HTMLElement; readonly place: (scale: DomScale) => void } {
  const element = doc.createElement("div");
  element.className = "adw-shade";
  element.setAttribute("aria-hidden", "true");
  return { element, place: (scale) => setBox(element, deviceRect(scale, rect)) };
}
