import type { Rect } from "@andornaut/game-kit/rect";

import {
  artPixel,
  type DeviceRect,
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  wholeArtPixels,
} from "../domScale.ts";

// Where the display mirror (src/scenes/htmlMirror.ts) puts what a scene draws, in whole device
// pixels from the HTML screen's root. Every edge lies on the screen's art-pixel grid: a game
// point's exact device place rounded to whole art pixels, so parts that share an edge in game
// pixels share it in HTML, and a part in a tile or a row sits whole art pixels from its snapped
// corner. A container's motion (a dip, a shake, a lift) is whole game pixels, moved as that many
// art pixels; a scrolled list moves by whole device pixels while it moves and whole art pixels
// once it settles.

// A game column and row on the art-pixel grid.
export function gridX(scale: DomScale, x: number): number {
  return wholeArtPixels(scale, exactDeviceX(scale, x));
}

export function gridY(scale: DomScale, y: number): number {
  return wholeArtPixels(scale, exactDeviceY(scale, y));
}

// A filled or framed rect on the grid: each edge snapped on its own, at least an art pixel wide
// and tall, so neighbouring boxes neither gap nor overlap.
export function gridRect(scale: DomScale, rect: Rect): DeviceRect {
  const left = gridX(scale, rect.x);
  const top = gridY(scale, rect.y);
  const pixel = artPixel(scale);
  return {
    height: Math.max(pixel, gridY(scale, rect.y + rect.height) - top),
    left,
    top,
    width: Math.max(pixel, gridX(scale, rect.x + rect.width) - left),
  };
}

// Art at its top-left corner, its size in art pixels, each artPixel device pixels.
export function artBox(
  scale: DomScale,
  at: { readonly x: number; readonly y: number },
  size: { readonly height: number; readonly width: number },
): DeviceRect {
  const pixel = artPixel(scale);
  return {
    height: size.height * pixel,
    left: gridX(scale, at.x),
    top: gridY(scale, at.y),
    width: size.width * pixel,
  };
}

// A move of whole game pixels as whole art pixels.
export function motionShift(
  scale: DomScale,
  motion: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const pixel = artPixel(scale);
  return { x: Math.round(motion.x) * pixel, y: Math.round(motion.y) * pixel };
}

// A list's scroll offset in game pixels as device pixels: whole device pixels while it moves,
// whole art pixels once it settles.
export function scrollShift(scale: DomScale, offset: number, settled: boolean): number {
  const exact = offset * scale.unit * scale.dpr;
  return settled ? wholeArtPixels(scale, exact) : Math.round(exact);
}

// A nine-slice's part: where it goes in the slice's box, and the part of the art frame it shows,
// in art pixels from the frame's corner.
export interface SlicePart {
  readonly box: DeviceRect;
  readonly from: { readonly height: number; readonly width: number; x: number; y: number };
}

// A nine-slice's parts over a box width by height device pixels: the corners and edges whole art
// pixels, as the art's slices (left, right, top, bottom, in art pixels) set them, and the middle
// columns and rows stretched, as the canvas stretches them. Parts with no art or no room are left
// out.
export function sliceParts(
  scale: DomScale,
  size: { readonly height: number; readonly width: number },
  frame: { readonly height: number; readonly width: number },
  slices: {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  },
): SlicePart[] {
  const pixel = artPixel(scale);
  const spans = (
    length: number,
    frameLength: number,
    start: number,
    end: number,
  ): { at: number; from: number; length: number; size: number }[] => {
    const near = Math.min(start * pixel, length);
    const far = Math.min(end * pixel, length - near);
    return [
      { at: 0, from: 0, length: start, size: near },
      { at: near, from: start, length: frameLength - start - end, size: length - near - far },
      { at: length - far, from: frameLength - end, length: end, size: far },
    ];
  };
  const columns = spans(size.width, frame.width, slices.left, slices.right);
  const rows = spans(size.height, frame.height, slices.top, slices.bottom);
  return rows.flatMap((row) =>
    columns.flatMap((column) =>
      column.length > 0 && row.length > 0 && column.size > 0 && row.size > 0
        ? [
            {
              box: { height: row.size, left: column.at, top: row.at, width: column.size },
              from: { height: row.length, width: column.length, x: column.from, y: row.from },
            },
          ]
        : [],
    ),
  );
}
