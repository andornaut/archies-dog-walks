import { type BitmapFont, fontMetrics, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";

import { type CssRect, type DomScale, fontPixel, snapRect, snapX, snapY } from "../domScale.ts";
import { plainMarks } from "../pixelFont.ts";
import { WEB_FONTS } from "./uiLayer.ts";

// A line of pixel text in the HTML interface: its web font draws the bitmap font's glyphs, so it
// is laid out by them. The capitals' top and the ink's middle across are game pixels, as the
// canvas places its labels.
export interface DomTextLine {
  readonly capTop: number;
  readonly centreX: number;
  readonly colour: number;
  readonly font: keyof typeof WEB_FONTS;
  readonly scale: number;
  readonly text: string;
}

// The text as the font draws it: capitals in the title font, typographic marks made plain.
export function shownText(font: DomTextLine["font"], text: string): string {
  const plain = plainMarks(text);
  return font === "title" ? plain.toUpperCase() : plain;
}

// Where line's element goes and how big its text is, in CSS px from its container's corner at
// (originX, originY) game pixels: one font pixel is whole device pixels (fontPixel), the ink's
// middle on the device column nearest centreX and the capitals' top on the row nearest capTop.
export function textPlace(
  bitmap: BitmapFont,
  scale: DomScale,
  origin: { readonly x: number; readonly y: number },
  line: DomTextLine,
): { readonly fontSize: number; readonly left: number; readonly top: number } {
  const pixel = fontPixel(scale, line.scale);
  const inked = laidGlyphs(bitmap, 1, shownText(line.font, line.text)).flatMap(({ ink }) =>
    ink === null ? [] : [ink],
  );
  // The first and last columns the line inks, in font pixels from the pen's start.
  const first = inked.length === 0 ? 0 : Math.min(...inked.map(({ left }) => left));
  const last = inked.length === 0 ? 0 : Math.max(...inked.map(({ right }) => right));
  const halfInk = Math.round(((last - first) * pixel * scale.dpr) / 2) / scale.dpr;
  const left = snapX(scale, line.centreX) - halfInk - first * pixel - snapX(scale, origin.x);
  const top =
    snapY(scale, line.capTop) - fontMetrics(bitmap).capTop * pixel - snapY(scale, origin.y);
  return { fontSize: 8 * pixel, left, top };
}

// Places element at rect, in CSS px from its container's corner at origin.
export function placeBox(
  scale: DomScale,
  origin: { readonly x: number; readonly y: number },
  element: HTMLElement,
  rect: { readonly height: number; readonly width: number; readonly x: number; readonly y: number },
): void {
  const box: CssRect = snapRect(scale, rect);
  Object.assign(element.style, {
    height: `${box.height}px`,
    left: `${box.left - snapX(scale, origin.x)}px`,
    top: `${box.top - snapY(scale, origin.y)}px`,
    width: `${box.width}px`,
  });
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// A text line's element: its text, font and colour; placeText positions it.
export function createTextLine(doc: Document, line: DomTextLine): HTMLElement {
  const element = doc.createElement("span");
  element.className = `adw-text adw-font-${line.font}`;
  element.textContent = shownText(line.font, line.text);
  element.style.color = hex(line.colour);
  return element;
}

// Positions element as line, in its container whose corner is at origin game pixels.
export function placeText(
  bitmap: BitmapFont,
  scale: DomScale,
  origin: { readonly x: number; readonly y: number },
  element: HTMLElement,
  line: DomTextLine,
): void {
  const place = textPlace(bitmap, scale, origin, line);
  Object.assign(element.style, {
    fontSize: `${place.fontSize}px`,
    left: `${place.left}px`,
    top: `${place.top}px`,
  });
}
