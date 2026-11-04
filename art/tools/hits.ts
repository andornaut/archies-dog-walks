// Draw the encounter hit moments: a burst over the pack per encounter, the screen-edge flash in the
// encounter's colour and the plate behind the big label. Bursts carry a 1px plum rim so they hold 3:1
// on the three light roads while their fills carry the dslate road. The flash strips pair a light ink
// (or, for mauve, a pink rim) with a dark fringe for the same reason. The encounters' hits match their
// road sprites in road.ts. The bursts are laid out on a 64x64 design and drawn 77/64 times bigger on a
// Mini (mini.ts), so they keep 1px lines 1px; their pixel maps and twinkles keep their pixels. Every
// burst opens on an impact frame (impact): an eight-point star in its colour with a white core and
// white speed lines.
//
// fx-hit-skunk       77x77  play (8 frames, 70ms)  lumpy mauve gas cloud that breaks into puffs and
//                                                   shrinks away, stink squiggles rising
// fx-hit-thief       77x77  play (8 frames, 70ms)  the tip pouch flying up out of a poof, three coins
//                                                   thrown out
// fx-hit-other-dog   77x77  play (8 frames, 70ms)  tangle cloud, fur tufts and hearts
// ui-hit-flash-sky, -amber, -mauve, -orange, -pink
//                    16x64  play (4 frames, 70ms)  left screen-edge strip, solid at x=0,
//                           4x4 ordered dither to clear by x=15; tiles vertically, the
//                           game mirrors it for the right edge
// ui-hit-label       24x24  normal, lucky (1 frame each)  nine-slice, 8px corners: a dred
//                           (normal) or blue (lucky) plate in ui.ts's chrome (a cream band),
//                           stretched to 176x32 for every label; white font-title text at 2x,
//                           centred, its line top 3px below the plate's top so the 10px caps sit
//                           in rows 11 to 20
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts, the rim, burst, twinkle and heart helpers in
// fx.ts.
import * as fx from "./fx.ts";
import { burst, HEART, SMALL } from "./fx.ts";
import { Mini, small } from "./mini.ts";
import {
  type Drawable,
  type DrawingScope,
  type Frame,
  Grid,
  main,
  raster,
  scaleOf,
  type Sprite,
  type Tag,
} from "./pixel.ts";
import { scope as roadScope } from "./road.ts";
import { plate } from "./ui.ts";

const USAGE = `Usage:
  node art/tools/hits.ts preview OUT.png   every frame of every piece on the zone roads
  node art/tools/hits.ts build             export to public/art/sprites/`;

// The grid every drawing here makes, which mini.ts's small swaps for a Mini while a burst draws.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

const BAYER: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
// A sideways wobble with an 8px period: a line rising 2px a frame loops seamlessly in 4 frames.
const WAVE: readonly number[] = [0, 1, 1, 1, 0, -1, -1, -1];

// The bursts are laid out on a 64x64 design and drawn BURST_SCALE times bigger, 77x77, on a Mini that
// keeps 1px lines 1px (burstFrame). Pixel maps, twinkles and the rim go on the drawn grid pixel for
// pixel, at the drawn place of their design position, so they keep their pixels.
export const BURST = 64;
export const BURST_SCALE = 77 / BURST;
// How much bigger frame 0's impact star is than its base radius, 16, for punch.
export const IMPACT = 1.25;

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Where design point (x, y) lands on g's pixels: scaled to the nearest pixel on a Mini, else itself.
export function drawnAt(g: Drawable, x: number, y: number): [number, number] {
  return g instanceof Mini ? [Math.round(x * g.s), Math.round(y * g.s)] : [x, y];
}

// fx.rim on the grid that holds g's pixels, so a burst's rim is 1px at its drawn size.
export function rim<G extends Drawable>(g: G, col = "plum"): G {
  fx.rim(raster(g), col);
  return g;
}

// fx.stamp pixel for pixel from the drawn place of (x0, y0).
export function stamp(
  g: Drawable,
  rows: readonly string[],
  x0: number,
  y0: number,
  cols: readonly string[] = ["red", "pink", "dred"],
): void {
  fx.stamp(raster(g), rows, ...drawnAt(g, x0, y0), cols);
}

// fx.star4 on the drawn grid, centred at the drawn place of (cx, cy), its arms r scaled.
export function star4(g: Drawable, cx: number, cy: number, r: number, col: string): void {
  fx.star4(raster(g), ...drawnAt(g, cx, cy), Math.round(r * scaleOf(g)), col);
}

// [dx, dy, colour] pixels from the drawn place of (x0, y0), pixel for pixel.
export function dots(
  g: Drawable,
  x0: number,
  y0: number,
  pts: readonly (readonly [number, number, string])[],
): void {
  const [x, y] = drawnAt(g, x0, y0);
  for (const [dx, dy, c] of pts) {
    raster(g).p(x + dx, y + dy, c);
  }
}

// A burst's frame step: draw(step) laid out on BURST x BURST and drawn BURST_SCALE times bigger.
export function burstFrame(draw: (step: number) => Drawable, step: number): Drawable {
  return small(roadScope, scope, BURST_SCALE, draw, step);
}

// Copy src's opaque pixels over dst.
export function layer<G extends Drawable>(dst: G, src: Drawable): G {
  src.px.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c) {
        dst.px[y]![x] = c;
      }
    }),
  );
  return dst;
}

// Draw one part on its own grid, rim it and lay it over dst, so overlapping parts stay apart.
export function piece<G extends Drawable>(
  dst: G,
  draw: (p: Drawable) => unknown,
  { col = "plum", size = 64 }: { col?: string; size?: number } = {},
): G {
  const g = scope.Grid(size, size);
  draw(g);
  return layer(dst, rim(g, col));
}

// Frame 0 of every burst: an eight-point star in the encounter's colour with a white core, IMPACT
// times 16 in radius, and a white speed line flying out between each pair of its points.
export function impact(g: Drawable, outer: string, cx = 32, cy = 32): void {
  const r = 16 * IMPACT;
  for (let k = 0; k < 8; k++) {
    // between the points, as burst turns them 11 degrees
    const a = radians(k * 45 + 11 - 90 + 22.5);
    const [[x0, y0], [x1, y1]] = [r, r * 1.3].map((d) =>
      drawnAt(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d),
    ) as [[number, number], [number, number]];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i < n + 1; i++) {
      raster(g).p(
        Math.round(x0 + ((x1 - x0) * i) / n),
        Math.round(y0 + ((y1 - y0) * i) / n),
        "white",
      );
    }
  }
  burst(g, cx, cy, r, r * 0.4, 8, outer, 11);
  burst(g, cx, cy, r * 0.62, r * 0.25, 8, "yellow", 11);
  g.ell(cx, cy, r * 0.25, r * 0.25, "white");
}

// ---------- hit bursts ----------

type Lobe = readonly [cx: number, cy: number, r: number, a: number];
type Puff = readonly [cx: number, cy: number, r: number];

// The cloud swells in seven lobes, each with a scalloped rim of smaller puffs, then the lobes drift
// apart and shrink as the gas clears, solid to the last frame. Mauve, as skunk-cloud: the puffs mauve,
// shaded purple on their lower right and lit pink on their upper left, so the pink carries the dslate
// road and the plum rim the light roads. Stink squiggles rise out of it, pink with a plum side, so
// they read over the cloud and on every road.
export function hitSkunk(step: number): Drawable {
  const g = scope.Grid(64, 64);
  if (step === 0) {
    impact(g, "mauve");
    return rim(g, "plum");
  }
  const d = [0, 6, 10, 13, 16, 19, 22, 25][step]!;
  const r = [0, 7, 9, 10, 9, 7, 5, 3][step]!;
  const core = [0, 9, 12, 13, 10, 5, 0, 0][step]!;
  const lobes: Lobe[] = [];
  for (let k = 0; k < 7; k++) {
    const a = radians((k * 360) / 7 + 20 + step * 4);
    lobes.push([
      32 + Math.cos(a) * d,
      33 + Math.sin(a) * d * 0.9,
      r * (1 + 0.15 * ((k % 3) - 1)),
      a,
    ]);
  }
  // puffs round each lobe's outer side, so the cloud's edge is scalloped, not one smooth curve
  const puffs: Puff[] = [];
  for (const [cx, cy, rk, a] of lobes) {
    if (rk >= 3) {
      for (const j of [-2, -1, 0, 1, 2]) {
        const b = a + j * 0.6 + ((((step + j) % 2) + 2) % 2) * 0.15;
        puffs.push([
          cx + Math.cos(b) * rk * 1.1,
          cy + Math.sin(b) * rk * 1.1,
          rk * (j % 2 ? 0.45 : 0.55),
        ]);
      }
    }
  }
  const coreLobe: Puff[] = core ? [[32, 33, core]] : [];
  puffs.push(...lobes.map(([cx, cy, rk]): Puff => [cx, cy, rk]), ...coreLobe);
  for (const [cx, cy, pr] of puffs) {
    g.ell(cx, cy, pr, pr, "mauve");
  }
  // a purple seam along the lower right of the core and every other lobe, where it lies inside the
  // cloud, so the puffs in front read over the ones behind; the seams, shading and squiggles are laid
  // on the drawn pixels
  const px = raster(g);
  const { h, w } = px;
  const mass: Frame = px.px.map((row) => [...row]);
  const front: Puff[] = [
    ...lobes.filter((_, k) => k % 2 === 0).map(([cx, cy, rk]): Puff => [cx, cy, rk]),
    ...coreLobe,
  ];
  for (const [cx, cy, pr] of front) {
    for (let deg = 0; deg < 100; deg += 2) {
      const a = radians(deg);
      const [x, y] = drawnAt(g, cx + Math.cos(a) * (pr - 0.5), cy + Math.sin(a) * (pr - 0.5));
      if (
        x >= 2 &&
        x < w - 2 &&
        y >= 2 &&
        y < h - 2 &&
        [-2, 0, 2].every((dx) => [-2, 0, 2].every((dy) => mass[y + dy]![x + dx]))
      ) {
        px.p(x, y, "purple");
      }
    }
  }
  // shade the lower-right edge of every puff, so the lumps read and overlapping lobes read as one
  // mass, and light the mass's upper-left edge pink
  const lit: Frame = px.px.map((row) => [...row]);
  for (let y = 0; y < h - 2; y++) {
    for (let x = 0; x < w - 2; x++) {
      if (lit[y]![x] && !(lit[y + 1]![x + 1] && lit[y + 2]![x + 2])) {
        px.p(x, y, "purple");
      } else if (lit[y]![x] && (x === 0 || y === 0 || !lit[y - 1]![x] || !lit[y]![x - 1])) {
        px.p(x, y, "pink");
      }
    }
  }
  if (step >= 1 && step < 4) {
    g.ell(32 - core * 0.35, 33 - core * 0.4, core * 0.3, core * 0.2, "pink");
    g.ell(32 - core * 0.3, 33 - core * 0.3, core * 0.3, core * 0.2, "mauve");
  }
  rim(g, "plum");
  if (step >= 1) {
    // five rising S-lines: 2px a frame up over an 8px wave, the outer ones leaning out, gone with
    // the cloud
    const rise = [0, 0, 4, 8, 12, 15, 18, 20][step]!;
    const length = [0, 5, 8, 9, 9, 7, 0, 0][step]!;
    const sc = scaleOf(g);
    const lines: readonly (readonly [number, number, number])[] = [
      [14, 26, -1],
      [22, 20, -0.5],
      [32, 17, 0],
      [42, 20, 0.5],
      [50, 26, 1],
    ];
    lines.forEach(([x0, y0, lean], j) => {
      for (let t = 0; t < Math.round(length * sc); t++) {
        const [dx, dy] = drawnAt(g, x0 + lean * (rise + t / sc) * 0.4, y0 - rise);
        const x = dx + WAVE[(t + j * 3 + step * 2) % 8]!;
        const y = dy - t;
        if (y >= 1 && y < h - 1) {
          px.p(x, y, "pink");
          px.p(x + 1, y, "plum");
        }
      }
    });
  }
  return g;
}

// The walker's tip pouch as road.ts's thief carries it, about 11x15: a green cloth body lit lime and
// shaded forest, its neck gathered under a cream drawstring, the frill above it flared, the
// drawstring's two ends tied off at the top and a yellow coin with an amber centre on its face; tilt
// swings the neck and frill a pixel as the pouch tumbles.
function pouch(g: Drawable, cx: number, cy: number, tilt: number): void {
  g.cel(cx, cy, 5.5, 5, "green", "forest", "lime");
  g.rect(cx - 1.5 + tilt / 2, cy - 6.5, 3, 2, "green");
  g.tri(
    [cx - 3.5 + tilt, cy - 9.5],
    [cx + 3.5 + tilt, cy - 9.5],
    [cx + tilt / 2, cy - 5.5],
    "green",
  );
  g.rect(cx - 3 + tilt, cy - 9.5, 2, 1, "lime");
  g.rect(cx + 1.5 + tilt, cy - 9.5, 2, 1, "forest");
  g.rect(cx - 2 + tilt / 2, cy - 6, 4, 1, "cream");
  g.p(cx - 3 + tilt, cy - 11, "cream");
  g.p(cx + 2 + tilt, cy - 11, "cream");
  g.p(cx - 2 + tilt, cy - 10.2, "cream");
  g.p(cx + 1 + tilt, cy - 10.2, "cream");
  g.cel(cx - 0.5, cy + 0.5, 2.5, 2.5, "yellow", "amber");
  const [x, y] = drawnAt(g, cx - 0.5, cy + 0.5);
  raster(g).p(x, y, "amber");
}

function coin(g: Drawable, x: number, y: number, spin: number): void {
  const rx = [3, 2, 0.8, 2][spin % 4]!;
  g.ell(x, y, rx + 0.5, 3.5, "amber", "orange", "yellow");
  if (spin % 4 !== 2) {
    g.p(x - 1, y - 1, "white");
  }
}

// A dust poof; the snatched tip pouch shoots straight up out of it while three coins fly out and
// fall. No second ring of puffs, so the pouch carries the moment.
export function hitThief(step: number): Drawable {
  const g = scope.Grid(64, 64);
  const [cx, cy] = [32, 40];
  if (step === 0) {
    impact(g, "amber", cx, cy);
    return rim(g);
  }
  const pr = [0, 10, 13, 14, 11, 7, 0, 0][step]!;
  if (pr) {
    const poof: readonly (readonly [number, number])[] = [
      [-7, 2],
      [7, 2],
      [0, -5],
      [0, 5],
      [-4, -3],
      [4, -3],
    ];
    piece(g, (p) => {
      for (const [dx, dy] of poof) {
        p.ell(cx + (dx * pr) / 12, cy + (dy * pr) / 12, pr * 0.55, pr * 0.5, "white", "lgrey");
      }
    });
  }
  const wy = [0, 32, 23, 17, 14, 13, 13, 14][step]!;
  const tilt = [0, 0, 1, 0, -1, 0, 1, 0][step]!;
  const t = step - 0.5;
  const throws: readonly (readonly [number, number])[] = [
    [-9, -6],
    [9, -6],
    [-5, -9.5],
  ];
  throws.forEach(([vx, vy], i) => {
    const x = cx + vx * t * 0.85;
    const y = cy - 4 + vy * t * 0.85 + 1.2 * t * t;
    if (y >= 3 && y < 60 && x >= 3 && x < 61) {
      piece(g, (p) => coin(p, x, y, step + i));
    }
  });
  piece(g, (p) => pouch(p, cx, wy + 2, tilt));
  return g;
}

export const TUFTS: readonly string[] = ["cream", "white", "tan", "lgrey", "brown", "grey"];

// A fur tuft, 2px thick so it reads as a clump in a few frames: two prongs over a base, or (flipped) a
// diagonal wisp.
const TUFT: readonly (readonly [number, number])[] = [
  [0, 0],
  [3, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
  [2, 2],
];
const TUFT_FLIP: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [2, 2],
  [3, 2],
];

export function tuft(g: Drawable, x: number, y: number, col: string, flip: number | boolean): void {
  dots(
    g,
    x,
    y,
    (flip ? TUFT_FLIP : TUFT).map(([dx, dy]) => [dx, dy, col] as const),
  );
}

// A cartoon tangle: a jostling dust cloud with leash loops in it, fur tufts flying off, then hearts
// popping up as the dogs make friends.
export function hitOtherDog(step: number): Drawable {
  const g = scope.Grid(64, 64);
  const [cx, cy] = [32, 38];
  if (step === 0) {
    impact(g, "pink", cx, cy);
    return rim(g);
  }
  const r = [0, 9, 12, 13, 13, 11, 0, 0][step]!;
  if (r) {
    piece(g, (p) => {
      for (let k = 0; k < 6; k++) {
        const a = radians(k * 60 + step * 23);
        const d = r * 0.75;
        p.ell(
          cx + Math.cos(a) * d,
          cy + Math.sin(a) * d * 0.75,
          r * 0.6,
          r * 0.55,
          "white",
          "lgrey",
        );
      }
      p.ell(cx, cy, r * 0.8, r * 0.65, "white", "lgrey");
      for (let k = 0; k < 3; k++) {
        const a = radians(k * 120 + step * 50);
        const [lx, ly] = [cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.35];
        p.ell(lx, ly, 3, 3, "brown");
        p.ell(lx, ly, 1.8, 1.8, "white");
      }
    });
  } else if (step === 6) {
    piece(g, (p) => {
      for (let k = 0; k < 5; k++) {
        const a = radians(k * 72 + 10);
        p.ell(cx + Math.cos(a) * 15, cy + Math.sin(a) * 11, 3.5, 3, "white", "lgrey");
      }
    });
  }
  if (step >= 2) {
    const t = step - 1;
    TUFTS.forEach((col, i) => {
      const a = radians(i * 60 + 15);
      const x = cx + Math.cos(a) * (9 + t * 4.5);
      const y = cy + Math.sin(a) * (7 + t * 3.5) + t * t * 0.5;
      if (x >= 2 && x < 59 && y >= 2 && y < 59) {
        piece(g, (p) => tuft(p, x, y, col, (step + i) % 2));
      }
    });
  }
  if (step >= 3) {
    const t = step - 3;
    for (const [x0, delay] of [
      [24, 0],
      [36, 1],
      [30, 2],
    ] as const) {
      const tt = t - delay;
      if (tt < 0) {
        continue;
      }
      const y = cy - 12 - tt * 6;
      if (y < 2) {
        continue;
      }
      if (tt === 0) {
        piece(g, (p) => stamp(p, SMALL, x0, y));
      } else {
        piece(g, (p) => stamp(p, HEART, x0 - 1, y));
      }
    }
  }
  return g;
}

// ---------- edge flash ----------

// Each strip's ink, its dark fringe and, where the ink holds under 3:1 on the dark roads, a light rim
// one step up its ramp (mauve's pink, 3.52:1 on dslate).
const FLASH: ReadonlyMap<string, readonly [ink: string, fringe: string, light: string | null]> =
  new Map([
    ["sky", ["cyan", "navy", null]],
    ["amber", ["amber", "plum", null]],
    ["mauve", ["mauve", "plum", "pink"]],
    ["orange", ["orange", "plum", null]],
    ["pink", ["pink", "plum", null]],
  ]);

// 16x64, the left screen edge: solid at x=0, an ordered 4x4 dither that clears inward. Each lit pixel
// in the sparse inner half with a gap inward of it gets a dark fringe there, and takes the light rim
// itself where the strip has one; the light ink (or rim) carries the dark roads, 3:1 or more, and the
// dark fringe the light roads. Later frames recede toward the edge.
function flash(colour: string, step: number): Grid {
  const [ink, fringe, light] = FLASH.get(colour)!;
  const width = [16, 11, 7, 4][step]!;
  const solid = step < 2 ? 2 : 1;
  const g = new Grid(16, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < width; x++) {
      const n = x < solid ? 16 : Math.round((16 * (width - 1 - x)) / (width - solid));
      if (BAYER[y % 4]![x % 4]! < n) {
        g.p(x, y, ink);
      }
    }
  }
  const lit: Frame = g.px.map((row) => [...row]);
  for (let y = 0; y < 64; y++) {
    for (let x = Math.max(1, Math.floor(width / 2)); x < 16; x++) {
      if (!lit[y]![x] && lit[y]![x - 1]) {
        g.p(x, y, fringe);
        if (light) {
          g.p(x - 1, y, light);
        }
      }
    }
  }
  return g;
}

// ---------- label plate ----------

// The plate's face, its lit edge and its shaded edge: dred for an encounter, blue for a lucky find.
const PLATES: ReadonlyMap<string, readonly [face: string, lit: string, shade: string]> = new Map([
  ["normal", ["dred", "red", "plum"]],
  ["lucky", ["blue", "sky", "navy"]],
]);

// ui-hit-label's 24x24 nine-slice, 8px corners: ui.ts's chrome plate (dred for normal, blue for
// lucky), stretched to 176x32. White text holds 7.34:1 on dred and 8.48:1 on blue; the cream band
// carries the dslate road and the ink line the light roads.
function labelPlate(face: string, lit: string, shade: string): Grid {
  return plate(face, lit, shade);
}

// Each burst: its drawing and its frame count.
export const HITS: ReadonlyMap<
  string,
  readonly [draw: (step: number) => Drawable, frames: number]
> = new Map([
  ["fx-hit-skunk", [hitSkunk, 8]],
  ["fx-hit-thief", [hitThief, 8]],
  ["fx-hit-other-dog", [hitOtherDog, 8]],
]);

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

// Every sprite: [key, [[tag, frames, duration in ms]]].
export function* sprites(): Generator<Sprite> {
  for (const [key, [draw, frames]] of HITS) {
    yield [key, [["play", range(frames).map((i) => burstFrame(draw, i).outlined(false)), 70]]];
  }
  for (const colour of FLASH.keys()) {
    yield [
      `ui-hit-flash-${colour}`,
      [["play", range(4).map((i) => flash(colour, i).outlined(false)), 70]],
    ];
  }
  yield [
    "ui-hit-label",
    [...PLATES].map(([tag, cols]): Tag => [tag, [labelPlate(...cols).outlined(false)], 1000]),
  ];
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
