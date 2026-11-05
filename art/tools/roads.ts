// Draw the per-zone road strips and the transitions between zones.
//
// road-<zone>        320x64 images, one per zone. They tile vertically with no
//                    seam: every pattern repeats in 64 rows (or a divisor of it)
//                    and anything drawn near the top or bottom edge wraps.
// road-<zone>-start  320x64 images, one per zone. Rows 20 to 63 are a neutral cross
//                    street in dslate asphalt (CROSSING) and rows 0 to 19
//                    this zone's strip, so a start strip follows any zone at a
//                    fork: the road reads up the screen as the previous zone's
//                    strip, the start strip, then this zone's strip.
//
// Each strip keeps its zone's road colour (the game data's roadColour) as the base, so
// the game's shadows (one ramp step darker) still match. The four lane dividers sit
// at x = 64k-1 (2px wide) and share one look per zone (Kensington Market's are
// painted a colour each), so lane edges stay readable at speed; the outer 5 to 8 px
// of each side is a curb or verge, which an outer lane's 56px sprite (4 px in from
// its 64px lane's edge) overlaps by up to 4 px.
//
// Every texture draws from game-kit's randomStream, one stream per strip named after it, so a
// build is the same on every run.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.
import { mkdirSync, writeFileSync } from "node:fs";

import { rgb } from "@andornaut/art-kit/colour";
import {
  type Random,
  randomInt,
  randomPick,
  randomStream,
  shuffled,
} from "@andornaut/game-kit/random";

import { dk, Grid, PALETTE64, PREVIEW_BACKGROUND, rgbPng, run, toImage } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/roads.ts preview OUT.png   each zone's road scrolling up: two strips of the zone
                                            before it in ZONES, the start strip, then three of this zone
  node art/tools/roads.ts build             write public/art/images/*.png`;

export const W = 320;
export const H = 64;
const LANE = 64;
// The period of every joint or seam across the road: the road scrolls up to 11 px a frame at 30 fps, and a
// pattern that repeats in under twice that strobes like a wagon wheel, its motion seeming to reverse.
const SEAM_PERIOD = 32;
export const DIVIDERS: readonly number[] = [1, 2, 3, 4].map((k) => k * LANE - 1);

// ---------- randomness ----------

// The seed every strip's stream splits from.
const SEED = 0;

// The strip's own texture stream, by name.
function stream(name: string): Random {
  return randomStream(SEED, name);
}

// An integer in lo..hi, both included.
function randint(rnd: Random, lo: number, hi: number): number {
  return randomInt(rnd, lo, hi + 1);
}

// k distinct items in a random order.
function sample<T>(rnd: Random, items: readonly T[], k: number): T[] {
  return shuffled(rnd, items).slice(0, k);
}

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = start; v < stop; v += step) {
    out.push(v);
  }
  return out;
}

// ---------- drawing ----------

// A pixel that wraps top to bottom, so features crossing the edge stay seamless.
function wp(g: Grid, x: number, y: number, c: string): void {
  g.p(x, ((y % H) + H) % H, c);
}

function wrect(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      wp(g, x + i, y + j, c);
    }
  }
}

// Scatter n texture specks; a share of them (wide) are 2px wide.
function specks(g: Grid, rnd: Random, n: number, col: string, x0 = 0, x1 = W, wide = 0): void {
  for (let i = 0; i < n; i++) {
    const x = randomInt(rnd, x0, x1);
    const y = randomInt(rnd, 0, H);
    wp(g, x, y, col);
    if (rnd() < wide) {
      wp(g, x + 1, y, col);
    }
  }
}

type Spot = readonly [number, number];

interface ScatterOptions {
  ok?: (x: number, y: number) => boolean;
  y0?: number;
  y1?: number;
}

// Up to n points at least gap apart (wrapping top to bottom) where ok(x, y) holds, so
// texture never falls into a regular rhythm or a clump.
function scatter(
  rnd: Random,
  n: number,
  x0: number,
  x1: number,
  gap: number,
  { ok = () => true, y0 = 0, y1 = H }: ScatterOptions = {},
): Spot[] {
  const pts: Spot[] = [];
  for (let i = 0; i < n * 40 && pts.length < n; i++) {
    const x = randomInt(rnd, x0, x1);
    const y = randomInt(rnd, y0, y1);
    if (
      ok(x, y) &&
      pts.every(
        ([px, py]) =>
          Math.abs(x - px) >= gap || Math.min(Math.abs(y - py), H - Math.abs(y - py)) >= gap,
      )
    ) {
      pts.push([x, y]);
    }
  }
  return pts;
}

// A width that wobbles down the strip and repeats every 64 rows.
function wave(y: number, seed: number, base: number, amp: number): number {
  const t = (2 * Math.PI * y) / H;
  return base + Math.round(amp * (0.6 * Math.sin(t + seed) + 0.4 * Math.sin(3 * t + seed * 2.3)));
}

// Run draw(scratch) and keep only its rows y0..y1-1 on g.
function clip(g: Grid, y0: number, y1: number, draw: (s: Grid) => void): void {
  const s = new Grid(W, H);
  draw(s);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      if (s.px[y]![x]) {
        g.px[y]![x] = s.px[y]![x]!;
      }
    }
  }
}

// ---------- lane lines ----------

// A per-row offset for each of the 64 rows, wrapping: a walk between lo and hi that steps 1px at a
// time and holds each value hold rows or more, so a wobbling edge keeps runs long enough to read as a
// line along the road, its steps falling at irregular rows.
function meander(
  rnd: Random,
  lo: number,
  hi: number,
  hold: readonly [number, number] = [8, 14],
): number[] {
  for (;;) {
    let vals: number[] = [];
    let v = randint(rnd, lo, hi);
    while (vals.length < H) {
      vals.push(...Array<number>(randint(rnd, ...hold)).fill(v));
      v = Math.min(hi, Math.max(lo, v + randomPick(rnd, [-1, 1])));
    }
    vals = vals.slice(0, H);
    const last = vals[H - 1]!;
    let tail = 1;
    while (tail < H && vals[H - 1 - tail] === last) {
      tail += 1;
    }
    if (last === vals[0] || (Math.abs(last - vals[0]!) === 1 && tail >= hold[0])) {
      return vals;
    }
  }
}

// High Park's path has no lines between its lanes: a dirt path, unlike the streets.
function highParkLines(): void {}

// Pedestrian Sunday's painted lane lines, one colour per divider, left to right: dark paint, each holding 3:1
// or more on Kensington Market's stone asphalt, and none gold, amber or orange, which read as coins.
export const LANE_PAINT = ["dbrick", "navy", "fir", "plum"] as const;

// A 10-row painted dash every SEAM_PERIOD rows from row 24, wrapping, each divider its own colour, a
// ramp step darker down its right edge. Rows 35 to 55 stay bare: screen-end shows rows 36 to 39 below its
// button.
function kensingtonLines(g: Grid): void {
  DIVIDERS.forEach((x, i) => {
    const c = LANE_PAINT[i]!;
    for (let y = 24; y < 24 + H; y += SEAM_PERIOD) {
      wrect(g, x, y, 2, 10, c);
      wrect(g, x + 2, y + 1, 1, 10, dk(c));
    }
  });
}

// fallen leaves (never gold, amber or orange, which read as the tip coin): a pointed blade, lit (f) on
// the upper left of a dark vein (v) that runs on out as the stem and shaded (s) below it, so each
// reads as a leaf and not a round fleck
const TILTED = ["..fff", ".ffvf", "ffvss", "fvss.", "v...."];
const SMALL = ["..ff", ".fvf", "fvs.", "v..."];
const mirrored = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(""));
const LEAF_SHAPES: readonly (readonly string[])[] = [
  TILTED,
  mirrored(TILTED),
  SMALL,
  mirrored(SMALL),
  [".ff.", "fvfs", "fvss", ".vs.", ".v.."],
];

// A leaf's lit, shade and vein colours.
type Tones = readonly [f: string, s: string, v: string];

// n leaves spaced apart, clear of the lane dividers, each in one of tones (lit, shade, vein).
function leaves(
  g: Grid,
  rnd: Random,
  n: number,
  x0: number,
  x1: number,
  tones: readonly Tones[],
): void {
  for (const [x, y] of scatter(rnd, n, x0, x1, 18, { ok: (px) => (px + 7) % LANE >= 9 })) {
    const [f, s, v] = randomPick(rnd, tones);
    const tone: Readonly<Record<string, string>> = { f, s, v };
    randomPick(rnd, LEAF_SHAPES).forEach((row, j) => {
      [...row].forEach((ch, k) => {
        if (ch !== ".") {
          wp(g, x + k, y + j, tone[ch]!);
        }
      });
    });
  }
}

function cabbagetownLines(g: Grid): void {
  const rnd = stream("road-cabbagetown-lines");
  for (const x of DIVIDERS) {
    const y = 10;
    // faded white (2.8:1 on the grey) with a slate edge, chipped where the paint wore
    g.rect(x, y, 2, 12, "white");
    g.rect(x + 2, y + 1, 1, 12, "slate");
    for (let i = 0; i < 2; i++) {
      g.p(x + randomInt(rnd, 0, 2), y + randomInt(rnd, 1, 11), "lgrey");
    }
  }
}

function beachesLines(g: Grid): void {
  for (const x of DIVIDERS) {
    // dbrown (5.9:1 on the boards), 20 rows in 64: a longer rhythm than High Park's
    g.rect(x, 6, 2, 20, "dbrown");
  }
}

// ---------- the six neighbourhoods ----------
// Each strip's base is its zone's road colour, which the game's road shadow steps down from.

// Sparse 2px grit spaced apart, 1x2 or 2x1.
function grit(g: Grid, rnd: Random, n: number, cols: readonly string[]): void {
  for (const [x, y] of scatter(rnd, n, 6, W - 7, 7)) {
    const col = randomPick(rnd, cols);
    if (rnd() < 0.7) {
      wrect(g, x, y, 1, 2, col);
    } else {
      wrect(g, x, y, 2, 1, col);
    }
  }
}

// A crack's start column and row, and its length in rows.
type Run = readonly [x: number, y: number, steps: number];

// Cracks running along the road, 1 to 2px wide, kept inside lanes.
function cracks(g: Grid, rnd: Random, runs: readonly Run[], col: string): void {
  for (const [startX, startY, steps] of runs) {
    let x = startX;
    let y = startY;
    for (let i = 0; i < steps; i++) {
      wp(g, x, y, col);
      if (rnd() < 0.25) {
        x += randomPick(rnd, [-1, 1]);
        wp(g, x, y, col);
      }
      y -= 1;
    }
  }
}

// Pale asphalt with sparse 2px slate grit, a few cracks and green leaves, and granite gutters in stone, their
// joints every 32 rows. No grit lighter than the asphalt: light flecks shimmer like rain as the road scrolls.
function cabbagetownGround(g: Grid): void {
  const rnd = stream("road-cabbagetown");
  g.rect(0, 0, W, H, "grey");
  grit(g, rnd, 30, ["slate", "slate", "dslate"]);
  cracks(
    g,
    rnd,
    [
      [43, 12, 10],
      [100, 40, 12],
      [160, 62, 9],
      [224, 50, 14],
      [286, 30, 8],
    ],
    "dslate",
  );
  leaves(g, rnd, 4, 10, W - 10, [["moss", "olive", "dolive"]]);
  for (const [x0, edge] of [
    [0, 4],
    [W - 4, W - 5],
  ] as const) {
    g.rect(x0, 0, 4, H, "stone");
    g.rect(edge, 0, 1, H, "slate");
    for (let y = 0; y < H; y += SEAM_PERIOD) {
      g.rect(x0, y, 4, 2, "dstone");
    }
  }
  g.rect(0, 0, 1, H, "lgrey");
  g.rect(W - 1, 0, 1, H, "dstone");
}

// A ragged oval w by h with its top left at x, y, wrapping: each row's ends nudged by up to a pixel.
function oval(g: Grid, rnd: Random, x: number, y: number, w: number, h: number, col: string): void {
  for (let j = 0; j < h; j++) {
    const half = (w / 2) * Math.sqrt(Math.max(0, 1 - ((j + 0.5 - h / 2) / (h / 2)) ** 2));
    const left = Math.round(w / 2 - half) + randomPick(rnd, [-1, 0, 0, 1]);
    const right = Math.round(w / 2 + half) + randomPick(rnd, [-1, 0, 0, 1]);
    if (right - left >= 1) {
      wrect(g, x + left, y + j, right - left, 1, col);
    }
  }
}

// A root creeping in from the undergrowth: a bark line 2px wide stepping dx across on most rows as it
// runs down the strip, its top rows lit clay, thinning to a 1px tip.
function root(g: Grid, rnd: Random, x0: number, y0: number, dx: number, steps: number): void {
  const pts: (readonly [number, number, number])[] = [];
  let x = x0;
  let y = y0;
  for (let k = 0; k < steps; k++) {
    pts.push([x, y, k < steps - 3 ? 2 : 1]);
    if (rnd() < 0.6) {
      x += dx;
    }
    y += 1;
  }
  for (const [px, py, w] of pts) {
    wrect(g, dx > 0 || w === 1 ? px : px - 1, py, w, 1, "bark");
  }
  for (const [px, py] of pts.slice(0, -3)) {
    wp(g, px + (dx > 0 ? 1 : -1), py - 1, "clay");
  }
}

// Packed earth on High Park's trail: skin1 worn patches down the middle of each lane where feet go,
// scuffed cream; skin2 damp patches and 2px grit; roots creeping in from the undergrowth; stones,
// needles and fallen leaves, with no single-pixel specks; ragged pine undergrowth along both edges with grass
// spilling onto the dirt.
function highParkGround(g: Grid): void {
  const rnd = stream("road-high-park");
  g.rect(0, 0, W, H, "tan");
  // worn ground down each lane where feet go: skin1 patches chained along the lane's middle, drifting
  // side to side, overlapping or leaving a gap, so the lane wears unevenly rather than in a stripe;
  // swept clean of the grit around them but for a cream scuff
  const worn = new Grid(W, H);
  for (let k = 0; k < W / LANE; k++) {
    const cx = k * LANE + LANE / 2;
    let drift = randint(rnd, -3, 3);
    const y0 = randomInt(rnd, 0, H);
    let y = y0;
    while (y < y0 + H - 6) {
      const w = randint(rnd, 7, 13);
      const h = randint(rnd, 14, 26);
      oval(worn, rnd, cx + drift - Math.floor(w / 2), y, w, h, "skin1");
      const sx = cx + drift + randint(rnd, -2, 1);
      const sy = y + randint(rnd, 3, h - 6);
      wrect(worn, sx, sy, 1, randint(rnd, 2, 3), "cream");
      drift = Math.max(-8, Math.min(8, drift + randint(rnd, -4, 4)));
      y += randint(rnd, Math.floor(h / 2), h + 8);
    }
  }
  specks(g, rnd, 30, "skin2", 9, W - 9, 1);
  for (let y = 0; y < H; y++) {
    const row = g.px[y]!;
    const wornRow = worn.px[y]!;
    for (let x = 0; x < W; x++) {
      if (wornRow[x]) {
        row[x] = wornRow[x]!;
      }
    }
    // a tan crease splits any row of a patch 8 or more wide, so none reads as a seam across the road
    let x = 0;
    while (x < W) {
      let run = 1;
      while (x + run < W && wornRow[x + run] && row[x + run] === row[x]) {
        run += 1;
      }
      if (wornRow[x] && run >= 8) {
        run = Math.min(7, Math.floor(run / 2) + wave(y, 1.7, 0, 1));
        g.p(x + run, y, "tan");
      }
      x += run;
    }
  }
  // damp patches, long along the road so each looks round in the view, under 8 columns wide so none
  // reads as a seam across the road, with a brown wet spot
  for (const [x, y] of scatter(rnd, 9, 10, W - 16, 16, {
    ok: (px) => (px + 2) % LANE > 4 && (px + 2) % LANE < 54,
  })) {
    const w = randint(rnd, 4, 7);
    const h = randint(rnd, 6, 12);
    oval(g, rnd, x, y, w, h, "skin2");
    wp(g, x + Math.floor(w / 2), y + Math.floor(h / 2), "brown");
  }
  // stones half sunk in the dirt, lit on the top left, and loose pebbles
  for (const [x, y] of scatter(rnd, 7, 12, W - 14, 16, {
    ok: (px) => (px + 2) % LANE > 4 && (px + 2) % LANE < 58,
  })) {
    wrect(g, x, y, 3, 2, "driftwood");
    wp(g, x, y, "lgrey");
    wp(g, x + 2, y + 1, "stone");
    wrect(g, x, y + 2, 3, 1, "brown");
  }
  // fallen needles in pairs, clear of the lane lines
  for (const [x, y] of scatter(rnd, 14, 10, W - 12, 9, { ok: (px) => (px + 4) % LANE >= 8 })) {
    wp(g, x, y, "bark");
    wp(g, x + 1, y + 1, "bark");
    wp(g, x + 2, y + 1, "bark");
  }
  leaves(g, rnd, 5, 10, W - 10, [
    ["moss", "olive", "dolive"],
    ["skin2", "brown", "dbrown"],
  ]);

  // the undergrowth along each edge keeps to the outer 8 columns, clear of a sprite's margin: pine
  // with fir blades, a ragged brown margin of damp earth, and grass clumps spilling onto the dirt
  const col = (side: number, x: number): number => (side === 0 ? x : W - 1 - x);
  for (const side of [0, 1]) {
    const width = meander(rnd, 2, 5, [2, 6]);
    for (let y = 0; y < H; y++) {
      const w = width[y]!;
      for (let x = 0; x < w; x++) {
        g.p(col(side, x), y, "pine");
      }
      g.p(col(side, w), y, "brown");
      if (width.at(y - 1)! < w || rnd() < 0.3) {
        g.p(col(side, w + 1), y, "skin2");
      }
    }
    let y = randomInt(rnd, 0, H);
    while (y < H * 2) {
      wrect(g, col(side, randomInt(rnd, 0, 3)), y, 1, 2, "fir");
      y += randomInt(rnd, 3, 7);
    }
    for (const [, cy] of scatter(rnd, 9, 0, 1, 5)) {
      // a clump: blades spilling over the margin onto the dirt, out to column 7 at most, canopy
      // with a lit moss or olive tip
      const edge = width[cy]!;
      const reach = randint(rnd, 1, 7 - edge);
      for (let b = 0; b < reach; b++) {
        wrect(g, col(side, edge + b), cy - (b % 2), 1, 3 - (b % 2), "canopy");
      }
      wp(
        g,
        col(side, edge + reach - 1),
        cy - 1 - ((reach - 1) % 2),
        randomPick(rnd, ["moss", "olive"]),
      );
    }
  }
  // roots creeping in from the undergrowth, two a side, each reaching a dozen or so columns onto the dirt
  for (const side of [0, 1]) {
    const starts = [randomInt(rnd, 0, 20), randomInt(rnd, 30, 50)];
    for (const y of starts) {
      const dx = side === 0 ? 1 : -1;
      const x = side === 0 ? 5 : W - 6;
      root(g, rnd, x, y, dx, randint(rnd, 7, 11));
    }
  }
}

// Dslate cobbles laid long along the road: columns 16 wide, each cobble 30 rows long over a 2-row navy
// joint, so a column's joints repeat every 32 rows (SEAM_PERIOD); each column starts its cobbles at its own
// multiple of 4, never within 4 rows of its neighbour's, so no joint runs across the road. Each cobble's
// corners are rounded off in navy and its top left glints slate; 1px navy joints between the columns, a
// navy pit in some cobbles; brick gutters along both sides.
function distilleryGround(g: Grid): void {
  const rnd = stream("road-distillery-district");
  g.rect(0, 0, W, H, "dslate");
  let phase = 0;
  for (let x = 0; x < W; x += 16) {
    const prev = phase;
    phase = randomPick(
      rnd,
      range(0, SEAM_PERIOD, 4).filter(
        (p) => Math.min(Math.abs(p - prev), SEAM_PERIOD - Math.abs(p - prev)) > 4,
      ),
    );
    g.rect(x + 15, 0, 1, H, "navy");
    for (let y = phase; y < phase + H; y += SEAM_PERIOD) {
      wrect(g, x, y + SEAM_PERIOD - 2, 15, 2, "navy");
      for (const [cx, cy] of [
        [x, y],
        [x + 14, y],
        [x, y + SEAM_PERIOD - 3],
        [x + 14, y + SEAM_PERIOD - 3],
      ] as const) {
        wp(g, cx, cy, "navy");
      }
      wrect(g, x + 1, y + 1, 3, 1, "slate");
      wp(g, x + 1, y + 2, "slate");
      if (rnd() < 0.5) {
        const px = x + randomInt(rnd, 4, 13);
        wp(g, px, y + randomInt(rnd, 4, 26), "navy");
      }
    }
  }
  for (const [x0, edge] of [
    [0, 4],
    [W - 4, W - 5],
  ] as const) {
    g.rect(x0, 0, 4, H, "brick");
    g.rect(edge, 0, 1, H, "navy");
    for (let y = 0; y < H; y += SEAM_PERIOD) {
      g.rect(x0, y + 6, 4, 2, "dbrick");
    }
  }
  g.rect(0, 0, 1, H, "rust");
}

// A pale granite curbstone on each lane line every 64 rows: lgrey, 22 rows long, a stone edge.
function distilleryLines(g: Grid): void {
  for (const x of DIVIDERS) {
    g.rect(x, 0, 2, 22, "lgrey");
    g.rect(x + 1, 0, 1, 22, "stone");
  }
}

// Worn stone asphalt with no joints across it: long dstone patches, 2px or more even in the far rows, which
// sample the strip shrunk 4x; sparse 2px dstone grit and irregular dstone cracks along the road; dstone gutters
// on the outer 4 columns inside a coal seam, a coal joint every 32 rows.
function kensingtonGround(g: Grid): void {
  const rnd = stream("road-kensington-market");
  g.rect(0, 0, W, H, "stone");
  // patches 4 or 5 wide (7 at most where a ragged row spreads), so none reads as a seam across the road, and
  // 14 to 22 long, so the far rows still show them 2px or more; one to a lane and half of the strip
  const bands = [
    [18, 44],
    [50, 76],
  ] as const;
  const slots = range(0, W / LANE).flatMap((lane) => [0, 1].map((band) => [lane, band] as const));
  for (const [lane, band] of sample(rnd, slots, 6)) {
    const h = randint(rnd, 14, 22);
    const w = randint(rnd, 4, 5);
    const [lo, hi] = bands[band]!;
    const x = lane * LANE + randint(rnd, 10, LANE - 18);
    oval(g, rnd, x, randint(rnd, lo, hi - h), w, h, "dstone");
  }
  grit(g, rnd, 24, ["dstone"]);
  cracks(
    g,
    rnd,
    [
      [40, 20, 9],
      [98, 61, 12],
      [150, 50, 11],
      [206, 33, 10],
      [230, 12, 8],
      [282, 44, 9],
    ],
    "dstone",
  );
  for (const [x0, inner] of [
    [0, 4],
    [W - 4, W - 5],
  ] as const) {
    g.rect(x0, 0, 4, H, "dstone");
    g.rect(inner, 0, 1, H, "coal");
    for (let y = 0; y < H; y += SEAM_PERIOD) {
      g.rect(x0, y, 4, 2, "coal");
    }
  }
}

// A boardwalk, weathered: some boards skin1, sand drifted in skin1 along the edge beams, the
// beams driftwood.
function beachesGround(g: Grid): void {
  const rnd = stream("road-the-beaches");
  g.rect(0, 0, W, H, "cream");
  const boards = range(0, W, 16);
  let tinted = false;
  for (const x0 of boards) {
    tinted = !tinted && rnd() < 0.05;
    if (tinted) {
      g.rect(x0, 0, 15, H, "skin1");
    }
    const grains = randomInt(rnd, 1, 3);
    for (let i = 0; i < grains; i++) {
      const x = x0 + randomInt(rnd, 1, 14);
      const y = randomInt(rnd, 0, H);
      wrect(g, x, y, 1, randomInt(rnd, 5, 12), "tan");
    }
  }
  for (const x0 of boards.slice(1)) {
    g.rect(x0 - 1, 0, 1, H, "tan");
  }
  for (const x0 of boards) {
    const y = randomInt(rnd, 0, H);
    wrect(g, x0, y, 15, 2, "tan");
    wp(g, x0 + 3, y - 2, "driftwood");
    wp(g, x0 + 11, y + 3, "driftwood");
  }
  for (const [x, y] of scatter(rnd, 7, 8, W - 8, 20, { ok: (px) => px % 16 < 13 })) {
    wrect(g, x, y, 2, 2, "tan");
    wp(g, x + 1, y + 1, "brown");
  }
  // sand drifted onto the boards beside each beam, 1 to 3 columns, wobbling down the strip
  for (let y = 0; y < H; y++) {
    for (const [side, seed] of [
      [0, 0.8],
      [1, 3.3],
    ] as const) {
      const w = wave(y, seed, 2, 1.2);
      if (w > 0) {
        g.rect(side === 0 ? 4 : W - 4 - w, y, w, 1, "skin1");
      }
    }
  }
  for (const [x0, outer] of [
    [0, 0],
    [W - 4, W - 1],
  ] as const) {
    g.rect(x0, 0, 4, H, "driftwood");
    g.rect(outer, 0, 1, H, "stone");
  }
}

// Dark concrete: shale slabs a lane wide and 32 rows long, their 2-row expansion joints in coal
// across the road and 1px along it under the lane lines, sparse ash and coal grit, a few coal cracks;
// dstone granite gutters, their joints in shale every 32 rows.
function yongeGround(g: Grid): void {
  const rnd = stream("road-yonge-street");
  g.rect(0, 0, W, H, "shale");
  grit(g, rnd, 30, ["ash", "coal", "coal", "dslate"]);
  cracks(
    g,
    rnd,
    [
      [40, 20, 9],
      [150, 50, 11],
      [230, 12, 8],
    ],
    "coal",
  );
  for (const y of [14, 46]) {
    g.rect(0, y, W, 2, "coal");
  }
  for (const x of DIVIDERS) {
    g.rect(x, 0, 1, H, "coal");
  }
  for (const [x0, line] of [
    [0, 5],
    [W - 5, W - 6],
  ] as const) {
    g.rect(x0, 0, 5, H, "dstone");
    for (let y = 0; y < H; y += SEAM_PERIOD) {
      g.rect(x0, y, 5, 2, "shale");
    }
    g.rect(line, 0, 1, H, "coal");
  }
  g.rect(0, 0, 1, H, "stone");
  g.rect(W - 1, 0, 1, H, "shale");
}

// White dashes 14 rows long in 64 (11.3:1 on the shale) with a coal edge.
function yongeLines(g: Grid): void {
  for (const x of DIVIDERS) {
    g.rect(x, 2, 2, 14, "white");
    g.rect(x + 2, 2, 1, 14, "coal");
  }
}

type Draw = (g: Grid) => void;

// Each zone's ground and lane lines, easiest to hardest, as the fork cards sort them.
export const ZONES: ReadonlyMap<string, readonly [ground: Draw, lines: Draw]> = new Map([
  ["cabbagetown", [cabbagetownGround, cabbagetownLines]],
  ["high-park", [highParkGround, highParkLines]],
  ["distillery-district", [distilleryGround, distilleryLines]],
  ["kensington-market", [kensingtonGround, kensingtonLines]],
  ["the-beaches", [beachesGround, beachesLines]],
  ["yonge-street", [yongeGround, yongeLines]],
]);

// The zone's strip; with y0..y1, only those rows are drawn (the rest stay empty).
function strip(zone: string, y0 = 0, y1 = H): Grid {
  const [ground, lines] = ZONES.get(zone)!;
  const g = new Grid(W, H);
  clip(g, y0, y1, (s) => {
    ground(s);
    lines(s);
  });
  return g;
}

// ---------- the cross street every start strip begins with ----------

// Strip rows of the cross street, first and past-last: the zone's own strip is above it and
// the game draws the previous zone's strip below it.
const CROSSING = [20, 64] as const;

// A neutral cross street in dslate asphalt, so a start strip follows any zone. Up
// the road: the near curb's top (rows 60 to 63) and rounded edge (58, 59), the asphalt with a
// zebra crossing (35 to 48), then the far curb's shadow (24, 25), face (22, 23) and lit top
// (20, 21). Every curb band is 2 rows but the near curb's 4-row top, each step 3.4:1 or less.
function crossing(g: Grid): void {
  const [y0, y1] = CROSSING;
  const rnd = stream("road-crossing");
  g.rect(0, y0, W, y1 - y0, "dslate");
  for (const [x, y] of scatter(rnd, 30, 0, W, 7, { y0: 27, y1: 56 })) {
    g.rect(x, y, 1, 2, randomPick(rnd, ["slate", "navy", "navy"]));
  }
  for (let x = 12; x < W - 12; x += 12) {
    g.rect(x, 35, 7, 14, "white");
    g.rect(x + 6, 35, 1, 14, "lgrey");
    g.rect(x, 47, 7, 2, "lgrey");
  }
  g.rect(0, 20, W, 2, "lgrey");
  g.rect(0, 22, W, 2, "slate");
  g.rect(0, 24, W, 2, "navy");
  g.rect(0, 58, W, 2, "grey");
  g.rect(0, 60, W, 4, "lgrey");
  // curbstone joints at uneven spacing, along the road
  let x = randomInt(rnd, 10, 30);
  while (x < W) {
    g.rect(x, 60, 1, 4, "grey");
    g.rect(x + randomInt(rnd, -6, 7), 20, 1, 4, "grey");
    x += randomInt(rnd, 22, 38);
  }
}

function start(zone: string): Grid {
  const g = strip(zone, 0, CROSSING[0]);
  crossing(g);
  return g;
}

// Every image's key and grid.
function images(): [string, Grid][] {
  const zones = [...ZONES.keys()];
  return [
    ...zones.map((zone): [string, Grid] => [`road-${zone}`, strip(zone)]),
    ...zones.map((zone): [string, Grid] => [`road-${zone}-start`, start(zone)]),
  ];
}

// Every pixel is opaque and on the palette, at the inventory size.
function check(key: string, g: Grid): void {
  if (g.w !== W || g.h !== H) {
    throw new Error(key);
  }
  const bad = new Set(g.px.flat().filter((c) => !c || !PALETTE64.includes(c)));
  if (bad.size > 0) {
    throw new Error(`${key}: ${[...bad].join(", ")}`);
  }
}

function preview(out: string, scale = 2, gap = 8): void {
  const tiles = new Map(images());
  for (const [key, g] of tiles) {
    check(key, g);
  }
  const zones = [...ZONES.keys()];
  const colH = 6 * H;
  const width = (W + gap) * zones.length * scale;
  const height = colH * scale;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set([...PREVIEW_BACKGROUND, 255], i * 4);
  }
  zones.forEach((zone, i) => {
    // bottom to top, the order the road scrolls into view
    const before = `road-${zones.at(i - 1)!}`;
    const column = [before, before, `road-${zone}-start`, ...Array<string>(3).fill(`road-${zone}`)];
    column.forEach((key, j) => {
      const y0 = (colH - (j + 1) * H) * scale;
      const x0 = i * (W + gap) * scale;
      tiles.get(key)!.px.forEach((row, y) =>
        row.forEach((c, x) => {
          const px = [...rgb(c!), 255];
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              data.set(px, ((y0 + y * scale + dy) * width + x0 + x * scale + dx) * 4);
            }
          }
        }),
      );
    });
  });
  writeFileSync(out, rgbPng({ data, height, width }));
}

function build(): void {
  mkdirSync("public/art/images", { recursive: true });
  const built: string[] = [];
  for (const [key, g] of images()) {
    check(key, g);
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(toImage(g.px)));
    built.push(key);
  }
  console.log("built", built.join(", "));
}

if (import.meta.main) {
  await run({
    commands: { build: () => build(), "preview OUT.png": (out) => preview(out) },
    doc: USAGE,
  });
}
