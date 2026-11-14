// Shared neighbourhood-character drawing scope, pose and limb primitives.

import { scaled } from "../mini.ts";
import { type Drawable, type DrawingScope, Grid, raster, rowScaleOf, scaleOf } from "../pixel.ts";
import { humanLegs, type WalkerPose } from "../road.ts";

// The grid every drawing here makes, which mini.ts's small swaps while it runs. Faces are drawn
// through road.ts's scope, so small swaps them there.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

export function range(start: number, stop: number): number[] {
  const out: number[] = [];
  for (let i = start; i < stop; i++) {
    out.push(i);
  }
  return out;
}

// A walk pose's legs and bob, the ones it sets, without its arm swing.
export function stride(q: WalkerPose): Pick<WalkerPose, "bob" | "lf" | "rf"> {
  const out: Pick<WalkerPose, "bob" | "lf" | "rf"> = {};
  for (const k of ["bob", "lf", "rf"] as const) {
    if (q[k] !== undefined) {
      out[k] = q[k];
    }
  }
  return out;
}

// The group's identity-specific clothing over planted support and bent recovery legs.
export function frontLegs(
  g: Drawable,
  x0: number,
  b: number,
  lf: number,
  rf: number,
  legs: readonly [string, string],
  shoes: string,
  top = 33,
): void {
  humanLegs(g, lf, rf, b, legs[0], legs[1], shoes, { top, x0 });
}

// A character map with its top-left at design (x, y), one drawn pixel per character.
export function bitmapAt(
  g: Drawable,
  rows: readonly string[],
  x: number,
  y: number,
  c: string,
): void {
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const px = raster(g);
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        px.p(scaled(x, s) + i, scaled(y, sy) + j, c);
      }
    });
  });
}

// An arm reaching from (x0, y0) to (x1, y1), w square at each step: parts are [share, colour] along
// it from the shoulder.
export function limb(
  g: Drawable,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  parts: readonly (readonly [number, string])[],
): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const c = parts.find(([share]) => f <= share + 1e-9)![1];
    g.rect(x0 + (x1 - x0) * f - w / 2, y0 + (y1 - y0) * f - w / 2, w, w, c);
  }
}
