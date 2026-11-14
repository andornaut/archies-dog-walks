// Treat, tip, wallet and bark drawings.

import { type Drawable, edged, raster, scaleOf } from "../pixel.ts";
import { hopped, LIT, lit, rim, type Rims, scope } from "./primitives.ts";

// ---------- pickups ----------

// The treat's idle: it bobs a pixel up and back, its heart glinting at the top of the bob.
export const TREAT_IDLE: readonly { lift: number }[] = [{ lift: 0 }, { lift: -1 }];

// The heart on the treat's bone, by its width in drawn pixels: 1 red, d dred, l the lit pixel (pink,
// white when it glints; the 3-wide heart is too small for one). treatHeart picks the widest that
// suits the scale it is drawn at.
const TREAT_HEARTS: ReadonlyMap<number, readonly string[]> = new Map([
  [7, [".11.11.", "1l11111", "111111d", ".1111d.", "..11d..", "...1..."]],
  [5, ["11.11", "1l11d", ".11d.", "..1.."]],
  [3, ["1.1", "111", ".1."]],
]);

// A TREAT_HEARTS heart centred on (cx, cy) in design pixels, drawn pixel for pixel at g's scale (as
// faceFront draws a face) so it keeps its shape at every size: 7 wide from 1.3x, 5 from 0.9x, else 3.
function treatHeart(g: Drawable, cx: number, cy: number, glint: boolean): void {
  const s = scaleOf(g);
  let w = 3;
  if (s >= 1.3) {
    w = 7;
  } else if (s >= 0.9) {
    w = 5;
  }
  const rows = TREAT_HEARTS.get(w)!;
  const x0 = Math.floor(cx * s + 0.5 - w / 2);
  const y0 = Math.floor(cy * s + 0.5 - rows.length / 2);
  const cols: Readonly<Record<string, string>> = {
    1: "red",
    d: "dred",
    l: glint ? "white" : "pink",
  };
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== ".") {
        raster(g).p(x0 + x, y0 + y, cols[ch]!);
      }
    });
  });
}

// A white bone, a fill no road uses, so it shows on every road, with a red heart on the middle of its
// shaft: a treat that gives a heart. The heart's lit pixel glints white at the top of the bob. The
// road outline holds it on the light roads and LIT's rim lights the heart where it stands proud of the
// bone. lift moves the drawn treat whole pixels (lift x the scale, rounded) after it is drawn, so the
// bone keeps its shape at the top of the bob.
export function treat({ lift = 0 }: { lift?: number } = {}): Drawable {
  const g = edged(scope.Grid(16, 16));
  const y = 6;
  g.rect(4, y, 8, 3, "white");
  // each end two round knobs with a notch between them, so the bone reads as a bone and not a bow
  for (const [cx, cy] of [
    [3, y - 0.2],
    [3, y + 3.2],
    [13, y - 0.2],
    [13, y + 3.2],
  ] as const) {
    g.ell(cx, cy, 1.7, 1.7, "white", "lgrey");
  }
  g.rect(4, y + 2, 8, 1, "lgrey");
  treatHeart(g, 8, y + 1.5, lift < 0);
  const inner = raster(lit(g));
  inner.px = hopped(inner.px, Math.round(-lift * scaleOf(g)));
  return g;
}

// A coin spinning: rx is its half-width as it turns, with the road outline and a white glint on its
// lit edge.
export function tip(rx: number): Drawable {
  const g = edged(scope.Grid(16, 16));
  if (rx < 1.5) {
    g.rect(7, 3, 2, 10, "orange");
    g.rect(7, 3, 1, 10, "amber");
    g.p(7, 4, "white");
    return g;
  }
  g.ell(8, 8, rx, 5.5, "amber", "orange", "yellow");
  if (rx > 2) {
    g.rect(8, 5, 1, 6, "orange");
    g.p(7, 6, "orange");
    g.p(9, 9, "orange");
  }
  g.p(Math.round(8 - rx * 0.55), 5, "white");
  return g;
}

// The $ on the wallet's bill, in drawn pixels so it stays exact at any scale: 3x7 down to the 1.1x
// depth step, a 1px stroke below that, where the bill is too short for it.
const WALLET_DOLLAR: readonly string[] = [".1.", "111", "1..", "111", "..1", "111", ".1."];

// The wallet's rim: LIT, with a dimmer brown down the leather's shaded sides.
const WALLET_RIM: Rims = { ...LIT, dbrown: ["skin2", "brown"], plum: ["skin2", "brown"] };

// The lost wallet, with the road outline: one green bill lit along its top edge stands up out of a
// brown leather wallet, a white $ on it; the wallet's flap tab on the right has an amber snap. The
// leather takes a light rim so it holds on the dslate road: tan along its top edge, brown down the
// shaded sides. glint twinkles a white sparkle at its top right.
export function wallet(glint: boolean): Drawable {
  const g = edged(scope.Grid(16, 16));
  g.rect(3, 1.5, 9, 7.5, "green");
  g.rect(3, 1.5, 9, 1, "lgrey");
  g.rect(1.5, 7, 13, 7.5, "brown");
  g.rect(1.5, 13.5, 13, 1, "dbrown");
  g.rect(13.5, 7, 1, 7.5, "dbrown");
  g.rect(1.5, 7, 13, 1, "tan");
  g.rect(9, 9, 5.5, 3, "dbrown");
  g.rect(12, 10, 2, 1, "amber");
  const s = scaleOf(g);
  const px = raster(g);
  const rows = s >= 1.1 ? WALLET_DOLLAR : ["1", "1", "1"];
  const bx = Math.floor(7.5 * s) - Math.floor(rows[0]!.length / 2);
  const by = Math.floor(2.4 * s);
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === "1") {
        px.p(bx + x, by + y, "white");
      }
    });
  });
  if (glint) {
    // a 3x3 cross centred on layout pixel (14, 1), drawn in pixels so it stays a cross at any scale
    const cx = Math.floor(14.5 * s);
    const cy = Math.floor(1.5 * s);
    px.rect(cx - 1, cy, 3, 1, "white");
    px.rect(cx, cy - 1, 1, 3, "white");
  }
  return rim(g, WALLET_RIM);
}

// The bark pop: a white bubble with red sound arcs, one arc and then, popped bigger, a second outside
// it, outlined in plum on every side so it holds on the light roads.
export function bark(isBig: boolean): Drawable {
  const g = edged(scope.Grid(16, 16), "plum");
  const r = isBig ? 6 : 5;
  g.ell(8.5, 7, r, r - 0.5, "white", "lgrey");
  g.tri([4, 10], [2, 15], [7, 11], "white");
  const arcs: (readonly [number, number, number])[] = [[7, 5, 3]];
  if (isBig) {
    arcs.push([10, 4, 5]);
  }
  for (const [x, top, h] of arcs) {
    g.p(x - 1, top, "red");
    g.rect(x, top + 1, 1, h, "red");
    g.p(x - 1, top + h + 1, "red");
  }
  return g;
}
