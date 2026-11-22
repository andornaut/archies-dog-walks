import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import { artPixel, type DomScale, frameRect, gridRect, gridX, gridY } from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { setBox } from "./pixelLine.ts";

// Content rules share one art-pixel stroke without changing their logical anchors or widths.
export function createContentSeparator(doc: Document): HTMLElement {
  const element = doc.createElement("span");
  element.className = "adw-framed adw-separator";
  element.setAttribute("aria-hidden", "true");
  Object.assign(element.style, {
    backgroundColor: `#${PALETTE.tan.toString(16).padStart(6, "0")}`,
    pointerEvents: "none",
    position: "absolute",
  });
  return element;
}

export function placeContentSeparator(
  scale: DomScale,
  context: { readonly origin: Point; readonly projection: "art" | "grid" },
  element: HTMLElement,
  rect: Rect,
): void {
  const box = (context.projection === "art" ? frameRect : gridRect)(scale, rect);
  setBox(element, {
    ...box,
    height: artPixel(scale),
    left: box.left - gridX(scale, context.origin.x),
    top: box.top - gridY(scale, context.origin.y),
  });
}

export function contentSeparatorPart(doc: Document, projection: "art" | "grid", rect: Rect) {
  const element = createContentSeparator(doc);
  return {
    element,
    place: (scale: DomScale) =>
      placeContentSeparator(scale, { origin: { x: 0, y: 0 }, projection }, element, rect),
  };
}
