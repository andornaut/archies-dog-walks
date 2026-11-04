// The UI kit's chrome: panels, bubbles, plates, tiles and card frames share one frame (chromeShape);
// hits.ts, moments.ts, scene.ts and cards.ts draw their plates, callouts and frames with it.
import type { Drawable } from "./pixel.ts";

export interface ChromeColours {
  // The face, under any text.
  face?: string;
  // The inner line, or null to leave it out, for shapes too small to hold it.
  line?: string | null;
  // The lip along the face's bottom row and right column.
  lip?: string;
}

const SIDES: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// Frame the shape inside(x, y) on g in the UI chrome: a 1px ink outer line, a 1px inner line (plum;
// null leaves it out, for shapes too small to hold it), the face, and the lip (tan on cream) along the
// face's bottom row and right column. openEdge(x, y) is true for points off the grid that continue
// the shape, so a tail laid over a bubble's rim stays open on that side. Ink holds 3:1 on the light
// roads, the cream face on navy, ink and dark wood; text sits on the face.
export function chromeShape<G extends Drawable>(
  {
    face = "cream",
    line = "plum",
    lip = "tan",
    openEdge,
  }: ChromeColours & { openEdge?: (x: number, y: number) => boolean },
  g: G,
  inside: (x: number, y: number) => boolean,
): G {
  const solid = (x: number, y: number): boolean =>
    x >= 0 && x < g.w && y >= 0 && y < g.h ? inside(x, y) : Boolean(openEdge?.(x, y));
  const key = (x: number, y: number): string => `${x},${y}`;
  // Each inside pixel by position: 0 on the outer line, 1 on the inner line, null on the face.
  const ring = new Map<string, [number, number, 0 | 1 | null]>();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (inside(x, y)) {
        ring.set(key(x, y), [x, y, SIDES.some(([dx, dy]) => !solid(x + dx, y + dy)) ? 0 : null]);
      }
    }
  }
  const depth = (x: number, y: number): 0 | 1 | null | -1 => {
    const cell = ring.get(key(x, y));
    return cell ? cell[2] : -1;
  };
  for (const cell of ring.values()) {
    const [x, y, d] = cell;
    if (line && d === null && SIDES.some(([dx, dy]) => depth(x + dx, y + dy) === 0)) {
      cell[2] = 1;
    }
  }
  for (const [x, y, d] of ring.values()) {
    if (d === 0) {
      g.p(x, y, "ink");
    } else if (d === 1) {
      g.p(x, y, line);
    } else {
      const framed = [depth(x, y + 1), depth(x + 1, y)];
      g.p(x, y, framed.some((v) => v !== null && v >= 0) ? lip : face);
    }
  }
  return g;
}

// A box with each corner cut on a diagonal r pixels long, as an inside(x, y) test.
export function roundedInside(
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
): (x: number, y: number) => boolean {
  return (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (!(i >= 0 && i < w && j >= 0 && j < h)) {
      return false;
    }
    return Math.min(i, w - 1 - i) + Math.min(j, h - 1 - j) >= r;
  };
}

// A chrome box (chromeShape) at x, y, w x h, its corners cut r pixels.
export function chrome<G extends Drawable>(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  { r = 1, ...colours }: ChromeColours & { r?: number } = {},
): G {
  return chromeShape(colours, g, roundedInside(x, y, w, h, r));
}
