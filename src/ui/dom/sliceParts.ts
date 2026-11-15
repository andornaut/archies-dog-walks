import { artPixel, type DeviceRect, type DomScale, gridX, gridY } from "../domScale.ts";

// A nine-slice's part: where it goes in the slice's box, and the part of the art frame it shows,
// in art pixels from the frame's corner.
export interface SlicePart {
  readonly box: DeviceRect;
  readonly from: { readonly height: number; readonly width: number; x: number; y: number };
}

// A nine-slice's parts over a box width by height device pixels: the corners and edges whole art
// pixels, as the art's slices (left, right, top, bottom, in art pixels) set them, and the middle
// columns and rows stretched, as the canvas stretches them. Parts with no art or no room are left
// out. An explicit layout rect projects cap edges onto that same logical grid.
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
  layout?: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  },
): SlicePart[] {
  const pixel = artPixel(scale);
  const spans = (
    length: number,
    frameLength: number,
    start: number,
    end: number,
    nearSize = start * pixel,
    farSize = end * pixel,
  ): { at: number; from: number; length: number; size: number }[] => {
    const near = Math.min(nearSize, length);
    const far = Math.min(farSize, length - near);
    return [
      { at: 0, from: 0, length: start, size: near },
      { at: near, from: start, length: frameLength - start - end, size: length - near - far },
      { at: length - far, from: frameLength - end, length: end, size: far },
    ];
  };
  const columns = spans(
    size.width,
    frame.width,
    slices.left,
    slices.right,
    layout === undefined
      ? undefined
      : gridX(scale, layout.x + slices.left) - gridX(scale, layout.x),
    layout === undefined
      ? undefined
      : gridX(scale, layout.x + layout.width) -
          gridX(scale, layout.x + layout.width - slices.right),
  );
  const rows = spans(
    size.height,
    frame.height,
    slices.top,
    slices.bottom,
    layout === undefined ? undefined : gridY(scale, layout.y + slices.top) - gridY(scale, layout.y),
    layout === undefined
      ? undefined
      : gridY(scale, layout.y + layout.height) -
          gridY(scale, layout.y + layout.height - slices.bottom),
  );
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
