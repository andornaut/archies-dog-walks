import type { Rect } from "@andornaut/game-kit/rect";

import {
  artPixel,
  type DeviceRect,
  type DomScale,
  gridX,
  gridY,
  wholeArtPixels,
} from "../domScale.ts";

// Where the display mirror (src/scenes/htmlMirror.ts) puts what a scene draws, in whole device
// pixels from the HTML screen's root. Every edge lies on the screen's art-pixel grid (gridX, gridY
// and gridRect in src/ui/domScale.ts, as every HTML screen's parts do): a game point's exact
// device place rounded to whole art pixels, so parts that share an edge in game
// pixels share it in HTML, and a part in a tile or a row sits whole art pixels from its snapped
// corner. A container's motion (a dip, a shake, a lift) is whole game pixels, moved as that many
// art pixels; a scrolled list moves by whole device pixels while it moves and whole art pixels
// once it settles.

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

// Art scaled by (x, y) at its top-left corner. An axis scaled as the other is (a picture drawn
// larger or smaller) keeps whole art pixels, scale times as many; an axis stretched alone (a
// well's middle column across its width) spans its game length on the grid, so it meets the
// parts beside it.
export function scaledArtBox(
  scale: DomScale,
  at: { readonly x: number; readonly y: number },
  size: { readonly height: number; readonly width: number },
  by: { readonly x: number; readonly y: number },
): DeviceRect {
  const box = artBox(scale, at, { height: size.height * by.y, width: size.width * by.x });
  if (by.x === by.y) {
    return box;
  }
  const pixel = artPixel(scale);
  return {
    ...box,
    ...(by.x === 1
      ? {}
      : { width: Math.max(pixel, gridX(scale, at.x + size.width * by.x) - box.left) }),
    ...(by.y === 1
      ? {}
      : { height: Math.max(pixel, gridY(scale, at.y + size.height * by.y) - box.top) }),
  };
}

// A fill a graphics draws: its colour, its alpha and its rect in game pixels.
export interface GraphicsFill {
  readonly alpha: number;
  readonly colour: number;
  readonly rect: Rect;
}

// Phaser's Graphics commands a fill of rects uses: a line style (every graphics starts with its
// default, which no fill draws with), a fill style, then rects in it.
const LINE_STYLE = 6;
const FILL_STYLE = 7;
const FILL_RECT = 3;

// A graphics' command buffer as its fills of rects, each moved by offset (the graphics' own
// position), or undefined where it draws anything else. A fill at alpha 0 draws nothing.
export function graphicsFills(
  commands: readonly number[],
  offset: { readonly x: number; readonly y: number },
): GraphicsFill[] | undefined {
  const fills: GraphicsFill[] = [];
  let style = { alpha: 1, colour: 0 };
  for (let i = 0; i < commands.length;) {
    const command = commands[i];
    if (command === LINE_STYLE) {
      i += 4;
    } else if (command === FILL_STYLE) {
      style = { alpha: commands[i + 2] ?? 1, colour: commands[i + 1] ?? 0 };
      i += 3;
    } else if (command === FILL_RECT) {
      const [x = 0, y = 0, width = 0, height = 0] = commands.slice(i + 1, i + 5);
      if (style.alpha > 0) {
        fills.push({ ...style, rect: { height, width, x: x + offset.x, y: y + offset.y } });
      }
      i += 5;
    } else {
      return undefined;
    }
  }
  return fills;
}

// A tiled sprite's texture over its box: each tile whole art pixels, the first tilePosition art
// pixels left of and above the box's corner, as the canvas tiles it from the sprite's corner.
export function tileBackground(
  scale: DomScale,
  tile: { readonly height: number; readonly width: number },
  tilePosition: { readonly x: number; readonly y: number },
): { readonly position: string; readonly size: string } {
  const pixel = artPixel(scale);
  const offset = (position: number, length: number) =>
    -(((Math.round(position) % length) + length) % length) * pixel;
  return {
    position: `${offset(tilePosition.x, tile.width)}px ${offset(tilePosition.y, tile.height)}px`,
    size: `${tile.width * pixel}px ${tile.height * pixel}px`,
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
