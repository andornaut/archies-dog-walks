// The grid that draws a sprite at another size: Mini takes coordinates at full size and scales every
// rect, ellipse and triangle before it rasterizes, so a small version keeps 1px lines and gets its own
// full outline instead of losing pixels to a nearest-neighbour downscale. small() runs a drawing module's
// function with that module's grid swapped for a Mini, and with road.ts's faceFront drawn at the small
// size (pixel.ts's DrawingScope). The depth steps (STEPS) come from shared/depth-steps.json. minis.ts
// draws the depth variants.
import {
  type Colour,
  depthScales,
  type Drawable,
  type DrawingScope,
  type FaceOptions,
  type Frame,
  Grid,
  type Point,
  raster,
  swapped,
} from "./pixel.ts";

// A Mini's scale: one factor, or [columns, rows].
export type Scale = number | readonly [number, number];

// [suffix, scale] for every depth step below full size (pixel.ts's depthScales), the suffix without
// its @: ["94", 0.9375], ["88", 0.875] and so on.
export const STEPS: readonly (readonly [string, number])[] = [...depthScales()].map(
  ([suffix, scale]) => [suffix.replace(/^@+/, ""), scale] as const,
);
// The steps hazards.ts builds itself.
export const SCALES: readonly (readonly [string, number])[] = STEPS.filter(
  ([, s]) => s === 0.75 || s === 0.5,
);

// v at scale s in whole pixels, halves rounding up as the game rounds them.
export function scaled(v: number, s: number): number {
  return Math.floor(v * s + 0.5);
}

// A frame side v at scale s, as scaled, but with a hair to spare at a half: a scale with no exact
// binary form (1.4) can land a whole side a hair under a half, and the frame must be the size rule's.
export function side(v: number, s: number): number {
  return Math.floor(v * s + 0.5 + 1e-9);
}

// Python's list indexing: a negative index counts from the end, and one past either end fails.
function at<T>(items: readonly T[], i: number): T {
  const j = i < 0 ? items.length + i : i;
  if (j < 0 || j >= items.length) {
    throw new RangeError(`index ${i} is out of range`);
  }
  return items[j]!;
}

function sameFrame(a: Frame, b: Frame): boolean {
  return a.every((row, y) => row.every((c, x) => c === b[y]![x]));
}

// A Grid that takes coordinates at full size and draws them s times smaller (or bigger, above 1). sy,
// if given, scales the rows instead of s, for a drawing that grows taller than it grows wide. No shape
// shrinks to nothing: a primitive that covers no pixel sets the one at its centre. A single-pixel
// highlight never paints over a shape that has shrunk to 1px (an eye or a stud would otherwise turn
// into its own glint).
export class Mini implements Drawable {
  readonly g: Grid;
  h: number;
  keep = new Set<string>();
  readonly s: number;
  readonly sy: number;
  w: number;

  constructor(s: number, w = 32, h = 32, sy?: number) {
    this.s = s;
    this.sy = sy ?? s;
    this.w = w;
    this.h = h;
    this.g = new Grid(side(w, s), side(h, this.sy));
  }

  get px(): Frame {
    return this.g.px;
  }

  private edgeX(v: number): number {
    return scaled(v, this.s);
  }

  private edgeY(v: number): number {
    return scaled(v, this.sy);
  }

  // Run draw; if it set no pixel, set the one at design point (x, y). Kept pixels it changed are no
  // longer kept.
  private set(draw: () => void, x: number, y: number, c: Colour): void {
    const before = this.g.px.map((row) => [...row]);
    draw();
    if (sameFrame(before, this.g.px)) {
      this.g.p(Math.floor(x * this.s), Math.floor(y * this.sy), c);
    }
    const kept = new Set<string>();
    for (const cell of this.keep) {
      const [xx, yy] = cell.split(",").map(Number) as [number, number];
      if (at(at(this.g.px, yy), xx) === at(at(before, yy), xx)) {
        kept.add(cell);
      }
    }
    this.keep = kept;
  }

  p(x: number, y: number, c: Colour): void {
    const xx = Math.floor((x + 0.5) * this.s);
    const yy = Math.floor((y + 0.5) * this.sy);
    if (!this.keep.has(`${xx},${yy}`)) {
      this.g.p(xx, yy, c);
    }
  }

  // Drawn bigger (s above 1), a 1px line whose full-size pixel spans output pixels a to b - 1 keeps to
  // one of them: the last when what it is drawn over ends just past b - 1 and carries on before a (a
  // seam along a shape's lower or right edge), else the first. cells are [x, null] for a row or
  // [null, y] for a column.
  private hug(
    a: number,
    b: number,
    cells: readonly (readonly [number | null, number | null])[],
  ): number {
    const { h, px, w } = this.g;
    const cellAt = (
      cell: readonly [number | null, number | null],
      v: number,
    ): Colour | undefined => {
      const [x, y] = cell[1] === null ? [cell[0]!, v] : [v, cell[1]];
      return x >= 0 && x < w && y >= 0 && y < h ? px[y]![x]! : undefined;
    };
    let before = 0;
    let after = 0;
    for (const c of cells) {
      before += cellAt(c, a - 1) === cellAt(c, a) ? 1 : 0;
      after += cellAt(c, b) === cellAt(c, b - 1) ? 1 : 0;
    }
    return after < before ? b - 1 : a;
  }

  // A rect too thin to cover a pixel's edge-to-edge span takes the pixel at its centre. A 1px line (a
  // seam or a shaded edge) does not paint over a shape that shrank to 1px either, and drawn bigger it
  // stays 1px wide (see hug).
  rect(x: number, y: number, w: number, h: number, c: Colour): void {
    let x0 = this.edgeX(x);
    let y0 = this.edgeY(y);
    let x1 = this.edgeX(x + w);
    let y1 = this.edgeY(y + h);
    if (x1 <= x0) {
      x0 = Math.floor((x + w / 2) * this.s);
      x1 = x0 + 1;
    }
    if (y1 <= y0) {
      y0 = Math.floor((y + h / 2) * this.sy);
      y1 = y0 + 1;
    }
    const line = w === 1 || h === 1;
    const shrunk = (w > 1 && x1 - x0 === 1) || (h > 1 && y1 - y0 === 1);
    if (this.sy > 1 && h === 1 && y1 - y0 > 1) {
      const cols: [number, null][] = [];
      for (let xx = x0; xx < x1; xx++) {
        cols.push([xx, null]);
      }
      y0 = this.hug(y0, y1, cols);
      y1 = y0 + 1;
    }
    if (this.s > 1 && w === 1 && x1 - x0 > 1) {
      const rows: [null, number][] = [];
      for (let yy = y0; yy < y1; yy++) {
        rows.push([null, yy]);
      }
      x0 = this.hug(x0, x1, rows);
      x1 = x0 + 1;
    }
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const cell = `${xx},${yy}`;
        if (line && this.keep.has(cell)) {
          continue;
        }
        this.g.p(xx, yy, c);
        if (shrunk) {
          this.keep.add(cell);
        } else {
          this.keep.delete(cell);
        }
      }
    }
  }

  // Under 3px of radius an ellipse grows a 1px nub at each tip, so it is drawn a little squarer.
  ell(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh: Colour = null,
    li: Colour = null,
  ): void {
    const { s, sy } = this;
    if (Math.min(rx * s, ry * sy) < 3) {
      this.set(() => this.g.blob(cx * s, cy * sy, rx * s, ry * sy, c, sh, li, 3), cx, cy, c);
    } else {
      this.set(() => this.g.ell(cx * s, cy * sy, rx * s, ry * sy, c, sh, li), cx, cy, c);
    }
  }

  // As ell, a little squarer under 3px of radius so it grows no nub at its tips.
  cel(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh: Colour = null,
    li: Colour = null,
    power = 2,
  ): void {
    const { s, sy } = this;
    const p = Math.min(rx * s, ry * sy) < 3 ? Math.max(power, 3) : power;
    this.set(() => this.g.cel(cx * s, cy * sy, rx * s, ry * sy, c, sh, li, p), cx, cy, c);
  }

  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh: Colour = null,
    li: Colour = null,
    power = 2.6,
  ): void {
    const { s, sy } = this;
    this.set(() => this.g.blob(cx * s, cy * sy, rx * s, ry * sy, c, sh, li, power), cx, cy, c);
  }

  tri(a: Point, b: Point, c: Point, col: Colour): void {
    const { s, sy } = this;
    const mx = (a[0] + b[0] + c[0]) / 3;
    const my = (a[1] + b[1] + c[1]) / 3;
    const [pa, pb, pc] = [a, b, c].map(([x, y]) => [x * s, y * sy] as const) as [
      Point,
      Point,
      Point,
    ];
    this.set(() => this.g.tri(pa, pb, pc, col), mx, my, col);
  }

  outlined(outline = true): Frame {
    return this.g.outlined(outline);
  }
}

// road.ts's faceFront at scale s on the Mini g, drawn at the small size: scaled, its eyes lose their
// glint and its mouth swells into a dark blot. Each eye is 2 x s square, rounded, at least 1px,
// centred where it is at full size, with its white glint at the top-left when it is 2px. The mouth is
// 2 x s wide on the row under the mouth's full-size row; from 0.75x it keeps its upturned corners,
// unless they would touch the eyes.
export function faceFront(
  s: number,
  g: Drawable,
  cx: number,
  y: number,
  { eyes = "ink", lips = "dbrown", mouth = 4, spread = 4 }: FaceOptions = {},
): void {
  const px = raster(g);
  const n = Math.max(1, scaled(2, s));
  const top = Math.floor((y + 1) * s + 0.5 - n / 2);
  for (const x of [cx - spread, cx + spread]) {
    const x0 = Math.floor(x * s + 0.5 - n / 2);
    px.rect(x0, top, n, n, eyes);
    if (n > 1) {
      px.p(x0, top, "white");
    }
  }
  const m = Math.max(1, scaled(2, s));
  const row = Math.floor((y + mouth + 1.5) * s);
  const left = Math.floor(cx * s + 0.5 - m / 2);
  px.rect(left, row, m, 1, lips);
  if (s >= 0.75 && row - 1 > top + n) {
    px.p(left - 1, row - 1, lips);
    px.p(left + m, row - 1, lips);
  }
}

// Run module's draw(...args) with its Grid swapped for a Mini at scale s, or [sx, sy] for one that
// scales its columns by sx and its rows by sy. Meanwhile road's faceFront (module's too, where it is
// road's) is faceFront at scale s. road is road.ts's scope, module the drawing module's.
export function small<A extends unknown[], R>(
  road: DrawingScope,
  module: DrawingScope,
  s: Scale,
  draw: (...args: A) => R,
  ...args: A
): R {
  const fullFace = road.faceFront;
  const [sx, sy] = typeof s === "number" ? [s, s] : s;
  const face = (g: Drawable, cx: number, y: number, options?: FaceOptions): void =>
    faceFront(sx, g, cx, y, options);
  const faced = [...new Set([road, module])].filter((m) => m.faceFront === fullFace);
  const patches = new Map<DrawingScope, Partial<DrawingScope>>(
    faced.map((m) => [m, { faceFront: face }]),
  );
  patches.set(module, {
    ...patches.get(module),
    Grid: (w = 32, h = 32) => new Mini(sx, w, h, sy),
  });
  return swapped(patches, () => draw(...args));
}

// The pose keys whose downward offsets round down to nothing (see snap).
const FEET = new Set(["bl", "bob", "br", "fl", "fr"]);

// A pose whose offsets move whole pixels at scale s, rounded down. Sideways and upward offsets still
// move at least one, so a 1px bob, step or wag shows, and up rounds them up instead; downward ones
// always round down, maybe to nothing, because the feet already sit on the frame's bottom row and a
// lower foot would lose its outline.
export function snap(
  q: Readonly<Record<string, boolean | number>>,
  s: number,
  up = false,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, value] of Object.entries(q)) {
    // A flag counts as 1, as Python's True does.
    const v = Number(value);
    let n = Math.floor(Math.abs(v) * s);
    if (v < 0 || !FEET.has(k)) {
      if (up) {
        n = Math.ceil(Math.abs(v) * s - 1e-9);
      }
      n = v ? Math.max(1, n) : 0;
    }
    // Python's math.copysign: a zero offset keeps its sign.
    out[k] = (Object.is(v, -0) || v < 0 ? -n : n) / s;
  }
  return out;
}
