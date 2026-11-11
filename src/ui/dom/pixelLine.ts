import type { Rect } from "@andornaut/game-kit/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
  laidGlyphs,
} from "@andornaut/game-kit/text/bitmapFont";

import { deviceRect, deviceX, deviceY, type DomScale, fontPixel } from "../domScale.ts";
import { plainMarks } from "../pixelFont.ts";
import { WEB_FONTS } from "./uiLayer.ts";

// A line of pixel text in the HTML interface: its web font draws the bitmap font's glyphs, so it
// is laid out by them. The capitals' top and the middle across are game pixels, as the canvas
// places its labels: the middle of the ink, or of the glyphs' advances where the canvas centres a
// label on its width. line is its index in a block of lines a font line apart, which sit
// lineHeight font pixels apart in device pixels too.
export interface DomTextLine {
  readonly capTop: number;
  readonly centre: "advance" | "ink";
  readonly centreX: number;
  readonly colour: number;
  readonly font: keyof typeof WEB_FONTS;
  readonly line?: number;
  readonly scale: number;
  readonly text: string;
}

type Origin = { readonly x: number; readonly y: number };

// The text as the font draws it: capitals in the title font, typographic marks made plain.
export function shownText(font: DomTextLine["font"], text: string): string {
  const plain = plainMarks(text);
  return font === "title" ? plain.toUpperCase() : plain;
}

// Where line's element goes and its font size, in whole device pixels from its container's
// corner at origin game pixels: one font pixel is fontPixel device pixels, the ink's middle on the
// device column nearest centreX, and the capitals' top on the row nearest capTop, or, for a later
// line of a block, whole font lines under its first line's.
export function textPlace(
  bitmap: BitmapFont,
  scale: DomScale,
  origin: Origin,
  line: DomTextLine,
): {
  readonly fontSize: number;
  readonly left: number;
  readonly lineHeight: number;
  readonly top: number;
} {
  const pixel = fontPixel(scale, line.scale);
  const text = shownText(line.font, line.text);
  const inked = laidGlyphs(bitmap, 1, text).flatMap(({ ink }) => (ink === null ? [] : [ink]));
  // The first and last columns the line inks, in font pixels from the pen's start, or the pen's
  // start and its last advance.
  const ink = line.centre === "ink" && inked.length > 0;
  const first = ink ? Math.min(...inked.map(({ left }) => left)) : 0;
  const last = ink ? Math.max(...inked.map(({ right }) => right)) : advanceWidth(bitmap, 1, text);
  const half = Math.round(((last - first) * pixel) / 2);
  const left = deviceX(scale, line.centreX) - half - first * pixel - deviceX(scale, origin.x);
  const index = line.line ?? 0;
  const blockTop = line.capTop - index * bitmap.lineHeight * line.scale;
  const top =
    deviceY(scale, blockTop) +
    (index * bitmap.lineHeight - fontMetrics(bitmap).capTop) * pixel -
    deviceY(scale, origin.y);
  // The web fonts' em is 8 font pixels and their line the bitmap font's.
  return { fontSize: 8 * pixel, left, lineHeight: bitmap.lineHeight * pixel, top };
}

// Places element over rect, in device pixels from its container's corner at origin.
export function placeBox(scale: DomScale, origin: Origin, element: HTMLElement, rect: Rect): void {
  const box = deviceRect(scale, rect);
  setBox(element, {
    ...box,
    left: box.left - deviceX(scale, origin.x),
    top: box.top - deviceY(scale, origin.y),
  });
}

// Sets element's place and size, in device pixels.
export function setBox(
  element: HTMLElement,
  box: {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
  },
): void {
  Object.assign(element.style, {
    height: `${box.height}px`,
    left: `${box.left}px`,
    top: `${box.top}px`,
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
  origin: Origin,
  element: HTMLElement,
  line: DomTextLine,
): void {
  const place = textPlace(bitmap, scale, origin, line);
  Object.assign(element.style, {
    fontSize: `${place.fontSize}px`,
    left: `${place.left}px`,
    lineHeight: `${place.lineHeight}px`,
    top: `${place.top}px`,
  });
}
