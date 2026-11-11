import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN_CONFIG } from "../data/screen.ts";

// The HTML interface's scale: how the #ui layer over the canvas maps game pixels to CSS pixels.
// The layer covers the canvas's box, so a game pixel is the canvas's own fractional fit (unit CSS
// px), and every rect and number in src/data/layout.ts means the same over the canvas as in it.
// Edges land on the device-pixel grid, so nine-slices and text stay crisp at any fit.
export interface DomScale {
  // Device pixels per CSS pixel.
  readonly dpr: number;
  // The layer's top-left corner on the page, in CSS px, for snapping to the page's device grid.
  readonly origin: { readonly x: number; readonly y: number };
  // CSS px per game pixel.
  readonly unit: number;
}

// A rect in CSS px from the layer's top-left corner.
export interface CssRect {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

// The scale over a canvas box (CSS px, on the page) at dpr device pixels per CSS pixel. A
// non-finite or non-positive ratio counts as 1.
export function domScale(dpr: number, canvas: Rect): DomScale {
  return {
    dpr: Number.isFinite(dpr) && dpr > 0 ? dpr : 1,
    origin: { x: canvas.x, y: canvas.y },
    unit: canvas.width / SCREEN_CONFIG.width,
  };
}

// CSS px on the device grid nearest a page coordinate.
function onGrid(scale: DomScale, page: number): number {
  return Math.round(page * scale.dpr) / scale.dpr;
}

// The CSS px from the layer's left edge to the device-pixel column nearest game column x.
export function snapX(scale: DomScale, x: number): number {
  return onGrid(scale, scale.origin.x + x * scale.unit) - scale.origin.x;
}

// The CSS px from the layer's top edge to the device-pixel row nearest game row y.
export function snapY(scale: DomScale, y: number): number {
  return onGrid(scale, scale.origin.y + y * scale.unit) - scale.origin.y;
}

// A game rect in CSS px, each edge snapped on its own, so rects that share an edge in game
// pixels share it on the device grid too.
export function snapRect(scale: DomScale, rect: Rect): CssRect {
  const left = snapX(scale, rect.x);
  const top = snapY(scale, rect.y);
  return {
    height: snapY(scale, rect.y + rect.height) - top,
    left,
    top,
    width: snapX(scale, rect.x + rect.width) - left,
  };
}

// A length of game pixels as whole device pixels, at least one: a nine-slice edge's width, a
// gap or a press's sink.
export function snapLength(scale: DomScale, length: number): number {
  return Math.max(1, Math.round(length * scale.unit * scale.dpr)) / scale.dpr;
}

// The CSS px one font pixel takes in text at textScale: its share of the fit, rounded down to
// whole device pixels and at least one, so glyph edges fall on the device grid and DOM text is
// never wider than the canvas draws it, whose fit checks therefore hold for both.
export function fontPixel(scale: DomScale, textScale: number): number {
  return Math.max(1, Math.floor(textScale * scale.unit * scale.dpr + 1e-9)) / scale.dpr;
}
