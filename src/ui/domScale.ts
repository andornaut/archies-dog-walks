import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN_CONFIG } from "../data/screen.ts";

// The HTML interface's scale: how the #ui layer over the canvas maps game pixels to device
// pixels. The layer covers the canvas's box, so a game pixel is the canvas's own fractional fit
// (unit CSS px), and every rect and number in src/data/layout.ts means the same over the canvas as
// in it. An HTML screen lays out in whole device pixels: its root is sized in device pixels and
// scaled by 1/dpr onto the page's device grid (gridTransform), since a browser lays CSS lengths
// out in 1/64 px steps, which no fraction of a pixel at a DPR such as 3 lands on.
export interface DomScale {
  // Device pixels per CSS pixel.
  readonly dpr: number;
  // The layer's top-left corner on the page, in CSS px.
  readonly origin: { readonly x: number; readonly y: number };
  // CSS px per game pixel.
  readonly unit: number;
}

// A rect in whole device pixels from an HTML screen's root.
export interface DeviceRect {
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

// The page's device column or row nearest a CSS coordinate.
const onGrid = (scale: DomScale, page: number) => Math.round(page * scale.dpr);

// The device pixels from the root's left edge to the column nearest game column x.
export function deviceX(scale: DomScale, x: number): number {
  return onGrid(scale, scale.origin.x + x * scale.unit) - onGrid(scale, scale.origin.x);
}

// The device pixels from the root's top edge to the row nearest game row y.
export function deviceY(scale: DomScale, y: number): number {
  return onGrid(scale, scale.origin.y + y * scale.unit) - onGrid(scale, scale.origin.y);
}

// A game rect in device pixels, each edge snapped on its own, so rects that share an edge in game
// pixels share it on the device grid too.
export function deviceRect(scale: DomScale, rect: Rect): DeviceRect {
  const left = deviceX(scale, rect.x);
  const top = deviceY(scale, rect.y);
  return {
    height: deviceY(scale, rect.y + rect.height) - top,
    left,
    top,
    width: deviceX(scale, rect.x + rect.width) - left,
  };
}

// A frame's rect in device pixels: deviceRect's corner, its width and height the nearest whole
// number of art pixels (at least one), so the bands of its far edges sit on the same art-pixel
// phase as its near edges'.
export function frameRect(scale: DomScale, rect: Rect): DeviceRect {
  const box = deviceRect(scale, rect);
  const pixel = artPixel(scale);
  const snap = (length: number) => Math.max(1, Math.round(length / pixel)) * pixel;
  return { ...box, height: snap(box.height), width: snap(box.width) };
}

// The device pixels one art pixel takes: the fit rounded down to whole device pixels, at least
// one, so every pixel of a frame, a rim or an icon is the same size.
export function artPixel(scale: DomScale): number {
  return Math.max(1, Math.floor(scale.unit * scale.dpr + 1e-9));
}

// The lengths a screen's stylesheet reads as --adw-slice-<n>: n art pixels in device pixels, for
// a pixel (a rim, a focus keyline), a press's sink and the focus band, and the nine-slice edges
// (ui-button's 3 and 5, ui-panel's 4, ui-detail-card's 8), so each art pixel of a frame is
// artPixel device pixels.
export function sliceLengths(scale: DomScale): readonly (readonly [string, string])[] {
  return [1, 2, 3, 4, 5, 8].map((n) => [`--adw-slice-${n}`, `${n * artPixel(scale)}px`] as const);
}

// The device pixels one font pixel takes in text at textScale: floor(textScale x unit x dpr), at
// least one, so glyph edges fall on the device grid and HTML text is never wider than the canvas
// draws it, whose fit checks therefore hold for both.
export function fontPixel(scale: DomScale, textScale: number): number {
  return Math.max(1, Math.floor(textScale * scale.unit * scale.dpr + 1e-9));
}

// The CSS transform that lays a root sized in device pixels onto the page's device grid from the
// layer's top-left corner: the move to the nearest device pixel, then 1/dpr.
export function gridTransform(scale: DomScale): string {
  const shift = (page: number) => (onGrid(scale, page) - page * scale.dpr) / scale.dpr;
  return `translate(${shift(scale.origin.x)}px, ${shift(scale.origin.y)}px) scale(${1 / scale.dpr})`;
}

// The root's size in device pixels over a layer width by height CSS px.
export function deviceSize(
  scale: DomScale,
  size: { readonly height: number; readonly width: number },
): { readonly height: number; readonly width: number } {
  return { height: Math.ceil(size.height * scale.dpr), width: Math.ceil(size.width * scale.dpr) };
}
