import { writeFileSync } from "node:fs";

import { type Random, randomPick, randomStream } from "@andornaut/game-kit/runtime/random";

import { sign, signWidth } from "../fonts.ts";
import { dk, LAYOUT } from "../pixel.ts";
import { Canvas } from "../scene.ts";

// A painter of the band's flat parts: a colour name per pixel.
type Paint = (px: number, py: number) => string;
// A painter of the street's stub: a colour name per pixel, from its world position x across and z
// along, the length of road span its row covers, and the pixel.
type RoadPaint = (x: number, z: number, span: number, px: number, py: number) => string;

// ---------- randomness ----------

// The seed every texture's stream splits from.
const SEED = 0;

// A texture's own stream, by name.
function stream(name: string): Random {
  return randomStream(SEED, name);
}

// A number in [a, b).
function uniform(rnd: Random, a: number, b: number): number {
  return a + (b - a) * rnd();
}

// ---------- the band and the camera ----------
// Everything below is drawn from these, read from the game's layout export. The camera is the
// game's: the horizon and foot rows on screen, the focal length F in road pixels and the road's
// centre column. The road below the band then shows VISIBLE road pixels, F (1 / s - 1) for the
// scale s on screen row BAR + H.
const BAND = LAYOUT.regions.backdrop;
// the band: screen rows BAR to BAR + H - 1
const W = BAND.width;
const H = BAND.height;
// the status bar's height: band row y is screen row BAR + y
const BAR = BAND.y;
const CAMERA = LAYOUT.camera;
// the road's centre column, and its vanishing point's
const CX = CAMERA.centreX;
const YH = CAMERA.horizonY;
const FOOT = CAMERA.footY;
const F = CAMERA.focal;

// Sign lettering: the yard sign's letters at scale in col, a 1px ink outline and a dred shadow
// (fonts.sign), 8 rows at 1x from the outline's top on row y to the shadow, centred on column mid
// without the shadow.
function word(
  cv: Canvas,
  s: string,
  mid: number,
  y: number,
  col: string,
  { scale = 1 }: { scale?: number } = {},
): void {
  const [px] = sign(s, scale, col);
  const x = Math.round(mid - signWidth(s, scale) / 2);
  for (const [key, c] of px) {
    const [pxX = 0, pxY = 0] = key.split(",").map(Number);
    cv.fill(x + pxX, y + pxY, 1, 1, c);
  }
}

// A cloud as (x, base row, width, puff): puff is the tallest lobe's radius.
type Cloud = readonly [x: number, y: number, w: number, puff: number];

// The sky: top, flat, down to row CALM, then low, with clouds.
function sky(
  cv: Canvas,
  {
    clouds = [],
    low = "sky",
    top = "cyan",
  }: { clouds?: readonly Cloud[]; low?: string; top?: string } = {},
): void {
  cv.fill(0, 0, W, FAR_WALK, low);
  cv.fill(0, 0, W, CALM, top);
  for (let i = 0; i < W; i += 5) {
    cv.fill(i, CALM + (Math.floor(i / 5) % 2), 5, 1, top);
  }
  clouds.forEach(([x, y, w, puff], k) => {
    cloud(cv, x, y, w, puff, k);
  });
}

// A cumulus on a flat base at row y: a low body the full width with rounded ends, one big dome of
// radius puff off centre and smaller ones beside it; lgrey on the base row and on each dome's lower
// right.
function cloud(cv: Canvas, x: number, y: number, w: number, puff: number, seed: number): void {
  const rnd = stream(`cloud-${seed}`);
  const big = x + w * uniform(rnd, 0.35, 0.6);
  const d1 = x + w * uniform(rnd, 0.12, 0.25);
  const d2 = x + w * uniform(rnd, 0.7, 0.85);
  const r2 = Math.max(2, puff * uniform(rnd, 0.6, 0.75));
  const domes: [number, number][] = [
    [big, puff],
    [d1, Math.max(2, puff * 0.55)],
    [d2, r2],
  ];
  const body = Math.max(2, Math.round(puff * 0.4));
  for (let py = y - puff - 1; py < y + 1; py++) {
    for (let px = x; px < x + w; px++) {
      const dxEnd = Math.min(px + 0.5 - x, x + w - px - 0.5);
      const inBody = py > y - body && dxEnd >= (y - py) * 0.8;
      const oy = py + 0.5 - (y - body + 1);
      const hit = domes.find(([cx, r]) => (px + 0.5 - cx) ** 2 + oy ** 2 <= r * r);
      const dome = hit ? ([px + 0.5 - hit[0], oy, hit[1]] as const) : undefined;
      if (!inBody && dome === undefined) {
        continue;
      }
      const shade =
        py === y || (dome !== undefined && dome[0] + dome[1] > dome[2] * 0.6 && py > y - body - 2);
      cv.fill(px, py, 1, 1, shade ? "lgrey" : "white");
    }
  }
}

// A banded sky down to row bottom whose top band also fills the calm rows above CALM.
function sunset(cv: Canvas, cols: readonly string[], bottom: number): [number, number][] {
  cv.fill(0, 0, W, CALM, cols[0]!);
  return bands(cv, CALM, bottom, cols);
}

// Far rolling hills: a silhouette of col from about row top (up to amp rows lower) down to row
// bottom, edge on its top row. Returns the top row of each column.
function hills(
  cv: Canvas,
  top: number,
  bottom: number,
  col: string,
  edge: string,
  seed: number,
  { amp = 8 }: { amp?: number } = {},
): number[] {
  const tops: number[] = [];
  for (let x = 0; x < W; x++) {
    const t = 0.5 + 0.5 * Math.sin(x * 0.017 + seed) * Math.cos(x * 0.006 + seed * 1.7);
    const y = top + Math.round(amp * t);
    cv.fill(x, y, 1, bottom - y, col);
    cv.fill(x, y, 1, 1, edge);
    tops.push(y);
  }
  return tops;
}

// A far house of a roofline: (x, w, wall rows).
type Roof = readonly [x: number, w: number, wallH: number];

// Far houses as one silhouette of col standing on row base, each under a steep gable that narrows
// a column a side per row, half as tall as the house is wide.
function roofline(cv: Canvas, base: number, roofs: readonly Roof[], col: string): void {
  for (const [x, w, wallH] of roofs) {
    cv.fill(x, base - wallH, w, wallH, col);
    for (let k = 0; k < Math.floor(w / 2) + 1; k++) {
      cv.fill(x - 1 + k, base - wallH - 1 - k, w + 2 - 2 * k, 1, col);
    }
  }
}

// Gulls far off: a 5px wing pair each, at (x, y).
function birds(
  cv: Canvas,
  spots: readonly (readonly [number, number])[],
  { col = "plum" }: { col?: string } = {},
): void {
  for (const [x, y] of spots) {
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [2, 1],
      [3, 0],
      [4, 1],
    ] as const) {
      cv.fill(x + dx, y + dy, 1, 1, col);
    }
  }
}

// The rows of n sky bands from top down to bottom, each ratio times the height of the one above
// it, as (first row, row after the last).
function bandRows(
  top: number,
  bottom: number,
  n: number,
  { ratio = 0.7 }: { ratio?: number } = {},
): [number, number][] {
  const weights = Array.from({ length: n }, (_, i) => ratio ** i);
  const total = weights.reduce((sum, wt) => sum + wt, 0);
  const edges = [top];
  let acc = 0;
  for (const wt of weights) {
    acc += wt;
    edges.push(top + Math.round(((bottom - top) * acc) / total));
  }
  return edges.slice(1).map((e, i) => [edges[i]!, e]);
}

// A banded sunset sky: hard-edged stripes of cols from row top down to the horizon at bottom,
// shrinking toward it. Above each seam the lower band's colour runs a 1-row line 2 rows up, and on
// a band 12 rows or taller a second one 5 rows up, so the bands interleave.
function bands(
  cv: Canvas,
  top: number,
  bottom: number,
  cols: readonly string[],
  { ratio = 0.7, w = W, x0 = 0 }: { ratio?: number; w?: number; x0?: number } = {},
): [number, number][] {
  const rows = bandRows(top, bottom, cols.length, { ratio });
  rows.forEach(([y0, y1], i) => {
    cv.fill(x0, y0, w, y1 - y0, cols[i]!);
  });
  for (let i = 0; i + 1 < rows.length && i + 1 < cols.length; i++) {
    const [a0, a1] = rows[i]!;
    const [b0] = rows[i + 1]!;
    for (const up of a1 - a0 >= 12 ? [2, 5] : [2]) {
      if (b0 - up > a0) {
        cv.fill(x0, b0 - up, w, 1, cols[i + 1]!);
      }
    }
  }
  return rows;
}

// A striped sun: a disc of col centred on cx, cy, its visible part ending on row low (the disc's
// bottom by default). Horizontal gaps cut the lower half of the visible part, the bars between them
// thinning and the gaps widening toward low, and show the sky behind.
function sun(
  cv: Canvas,
  cx: number,
  cy: number,
  r: number,
  col: string,
  low: number = cy + r,
): void {
  const mid = (cy - r + low) / 2;
  const gaps = new Set<number>();
  let y = mid;
  let k = 0;
  const bar = Math.max(2, Math.round((low - mid) / 4));
  while (y <= low) {
    y += Math.max(1, bar - k);
    const gap = 1 + Math.floor(k / 2);
    for (let g = Math.round(y); g < Math.round(y) + gap; g++) {
      gaps.add(g);
    }
    y += gap;
    k += 1;
  }
  for (let dy = -r; dy < r + 1; dy++) {
    if (gaps.has(cy + dy)) {
      continue;
    }
    for (let dx = -r; dx < r + 1; dx++) {
      if (dx * dx + dy * dy <= r * (r + 1)) {
        cv.fill(cx + dx, cy + dy, 1, 1, col);
      }
    }
  }
}

// The lawn yard rows deep from row 104, then the sidewalk (15 rows, slabs every 24px), the curb and
// the gutter: 24 rows in all.
function ground(
  cv: Canvas,
  { lawn = "green", yard = 26 }: { lawn?: string; yard?: number } = {},
): void {
  cv.fill(0, 104, W, yard, lawn);
  for (let i = 0; i < 70; i++) {
    cv.fill((i * 37) % W, 106 + ((i * 11) % (yard - 4)), 1, 2, dk(lawn));
  }
  const walk = 104 + yard;
  cv.fill(0, walk, W, 15, "lgrey");
  for (let x = 0; x < W; x += 24) {
    cv.fill(x, walk, 1, 15, "grey");
  }
  cv.fill(0, walk + 15, W, 3, "grey");
  cv.fill(0, walk + 18, W, 2, "slate");
}

// A house's windows and door: the window frame's offset below the eaves, its width and height, and
// the door's height.
type HouseParts = readonly [off: number, ww: number, wh: number, doorH: number];
const HOUSE: HouseParts = [6, 12, 10, 18];
// SLIM is the slim house's windows and door: tall windows either side of the door.
const SLIM: HouseParts = [4, 8, 10, 13];

interface HouseOptions {
  base?: number;
  curtains?: string | undefined;
  door?: string;
  dormer?: boolean;
  eave?: number;
  glass?: string;
  parts?: HouseParts;
  rake?: string | undefined;
  roofH?: number;
  top?: number;
}

// A house facing the camera, standing on row base: a gable roof roofH rows tall from top, its eaves
// eave pixels past the walls. curtains, a colour, draws the windows' curtains closed, lamplight in
// the gap between them; glass is the windows' colour otherwise. rake, a colour, lights the roof's
// left edge, which faces the top-left light. dormer puts a dormer window in the roof's middle.
function house(
  cv: Canvas,
  x: number,
  w: number,
  wall: string,
  roof: string,
  {
    base = 104,
    curtains,
    door = "dred",
    dormer = false,
    eave = 3,
    glass = "cyan",
    parts = HOUSE,
    rake,
    roofH = 26,
    top = 40,
  }: HouseOptions = {},
): void {
  const wallY = top + roofH;
  const [off, ww, wh, doorH] = parts;
  cv.fill(x, wallY, w, base - wallY, wall);
  cv.fill(x + w - 3, wallY, 3, base - wallY, dk(wall));
  const half = w / 2 + eave;
  for (let i = 0; i < roofH; i++) {
    const inset = Math.round((i * half) / roofH);
    const left = x - eave + (Math.floor(w / 2) + eave) - inset;
    cv.fill(left, top + i, inset * 2, 1, roof);
    if (rake && inset) {
      cv.fill(left, top + i, 1, 1, rake);
    }
  }
  cv.fill(x - eave, wallY - 1, w + 2 * eave, 2, dk(roof));
  cv.fill(x + w - 14, top + Math.round(roofH * 0.15), 6, Math.round(roofH * 0.46), "brown");
  cv.fill(x + w - 15, top + Math.round(roofH * 0.08), 8, 2, "dbrown");
  if (dormer) {
    dormerWindow(
      cv,
      x + Math.floor(w / 2),
      top + Math.round(roofH * 0.42),
      wallY - 2,
      wall,
      roof,
      curtains,
    );
  }
  for (const wx of [x + Math.floor(ww / 2), x + w - ww - Math.floor(ww / 2)]) {
    window(cv, wx, wallY + off, ww, wh, { curtains, glass });
  }
  const dx = x + Math.floor(w / 2) - 5;
  cv.fill(dx, base - doorH, 10, doorH, door);
  cv.fill(dx + 7, base - Math.floor(doorH / 2), 1, 2, "amber");
  cv.fill(dx - 2, base - 2, 14, 2, "lgrey");
}

// A window in a plum frame on a white sill: glass (cyan) with white glazing bars, or curtains drawn
// closed with lamplight between them.
function window(
  cv: Canvas,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  { curtains, glass = "cyan" }: { curtains?: string | undefined; glass?: string } = {},
): void {
  cv.fill(wx, wy, ww, wh, "plum");
  if (curtains) {
    cv.fill(wx + 1, wy + 1, ww - 2, wh - 2, curtains);
    cv.fill(wx + 1, wy + 1, ww - 2, 1, dk(curtains));
    cv.fill(wx + Math.floor(ww / 2) - 1, wy + 2, 2, wh - 3, "yellow");
    cv.fill(wx + 2, wy + 2, 1, wh - 3, dk(curtains));
    cv.fill(wx + ww - 3, wy + 2, 1, wh - 3, dk(curtains));
  } else {
    cv.fill(wx + 1, wy + 1, ww - 2, wh - 2, glass);
    cv.fill(wx + Math.floor(ww / 2), wy + 1, 1, wh - 2, "white");
    cv.fill(wx + 1, wy + Math.floor(wh / 2), ww - 2, 1, "white");
  }
  cv.fill(wx - 1, wy + wh, ww + 2, 2, "white");
}

// A dormer centred on column cx, its cap from row top and its front down to row bottom: a small
// gable of roof over a wall front holding one window.
function dormerWindow(
  cv: Canvas,
  cx: number,
  top: number,
  bottom: number,
  wall: string,
  roof: string,
  curtains?: string,
): void {
  const fx = cx - 5;
  const fw = 10;
  const frontY = top + 4;
  cv.fill(fx, frontY, fw, bottom - frontY, wall);
  cv.fill(fx + fw - 2, frontY, 2, bottom - frontY, dk(wall));
  for (let k = 0; k < 5; k++) {
    const wide = k === 4 ? 1 : 0;
    cv.fill(cx - 1 - k - wide, top + k, 2 + 2 * k + 2 * wide, 1, k < 4 ? roof : dk(roof));
  }
  window(cv, fx + 2, frontY + 1, 6, bottom - frontY - 3, { curtains });
}

interface TreeOptions {
  base?: number;
  girth?: number;
  leaf?: string;
  r?: number;
  shade?: string;
  trunk?: string;
}

// A round tree on row base, its crown centred on row top.
function tree(
  cv: Canvas,
  cx: number,
  top: number,
  {
    base = 104,
    girth = 6,
    leaf = "green",
    r = 16,
    shade = "dgreen",
    trunk = "dbrown",
  }: TreeOptions = {},
): void {
  cv.fill(cx - Math.floor(girth / 2), top + r, girth, base - top - r, trunk);
  for (let dy = -r; dy < r + 1; dy++) {
    for (let dx = -r; dx < r + 1; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        const c =
          dx + dy > r * 0.5 ? shade : leaf === "green" && dx + dy < -r * 1.1 ? "yellow" : leaf;
        cv.fill(cx + dx, top + dy, 1, 1, c);
      }
    }
  }
}

// A bush's three lobes, (x, y, radius); SHRUB is the backdrops' smaller one.
type Lobes = readonly (readonly [dx: number, dy: number, r: number])[];
const BUSH: Lobes = [
  [0, 0, 6],
  [8, -2, 7],
  [16, 0, 6],
];
const SHRUB: Lobes = [
  [0, 0, 4],
  [5, -1, 5],
  [10, 0, 4],
];

function bush(
  cv: Canvas,
  x: number,
  y: number,
  { col = "dgreen", lobes = BUSH }: { col?: string; lobes?: Lobes } = {},
): void {
  for (const [dx, dy, r] of lobes) {
    for (let yy = -r; yy < r + 1; yy++) {
      for (let xx = -r; xx < r + 1; xx++) {
        if (xx * xx + yy * yy <= r * r && y + dy + yy <= y + 4) {
          cv.fill(x + dx + xx, y + dy + yy, 1, 1, xx + yy < 3 ? col : dk(col));
        }
      }
    }
  }
}

function flowers(
  cv: Canvas,
  x0: number,
  x1: number,
  y: number,
  { cols = ["red", "yellow", "pink", "white"] }: { cols?: readonly string[] } = {},
): void {
  for (let i = 0, x = x0; x < x1; i++, x += 4) {
    cv.fill(x, y + (i % 2), 2, 2, cols[i % cols.length]!);
    cv.fill(x, y + 2 + (i % 2), 1, 2, "dgreen");
  }
}

// ---------- the street and the junction ----------
// The road below the band recedes: a point z road pixels ahead of the walker's feet draws at scale
// s = F / (F + z), on screen row YH + KS s. The band's rows from STUB down continue that projection
// exactly, so the street's edges keep the road's slope across the band's bottom edge. World units
// are road pixels at scale 1: x across from the road's centre line, z along the road ahead of the
// feet, h up from the ground.

const KS = FOOT - YH;
// scale on the band's bottom row
const S0 = (BAR + H - 0.5 - YH) / KS;
// road in view below the band, to its bottom edge
const VISIBLE = (F * KS) / (BAR + H - YH) - F;
// the road distance on the band's bottom row
const Z0 = F / S0 - F;
// half the road, then the outer edges of the curb and the sidewalk, across from the road's centre,
// as Cabbagetown's verge (VERGES)
const ROAD = Math.floor(LAYOUT.regions.road.width / 2);
const CURB = 164;
const WALK = 208;
// lane divider lines, from the road's centre
const DIVIDERS: readonly number[] = LAYOUT.lanes.dividers.map((x) => x - CX);
// The cross street, in band rows from the far side down: the far sidewalk, the far curb, the road,
// the near curb and the near sidewalk, which the street's stub (rows STUB to the bottom) opens into.
// These rows are drawn flat rather than to the projection, which would spread the cross street over
// most of the band; across, they keep the projection's scale per row, so lines along the street
// (curbs, slab seams) still lean toward the road's centre line. The stub is the band's part of the
// approach region. The near curb and sidewalk are the junction region's rows above it, where the
// game's road raster starts, drawing only the road surface between the near corners, so the corners
// stay the backdrop's.
const STUB = LAYOUT.regions.approach.y - BAR;
const NEAR_CURB = LAYOUT.regions.junction.y - BAR;
const FAR_WALK = STUB - 20;
const FAR_CURB = STUB - 16;
const CROSS = STUB - 14;
// the cross street's centre line
const LINE = STUB - 10;
// the near corners' curb radius, in pixels
const CORNER = 5;
// the far side's ground row: the houses stand on it
const BASE = STUB - 24;
// The sky above row CALM, 70 rows over the far side's ground row, is one flat colour: the debuff
// bars and the message strip (band rows 6 to 57 while a message shows) lie over it, so each
// neighbourhood's main read stays below it. Any neighbourhood's skyline may rise above it, reading
// half covered while a message shows: Cabbagetown's old trees, chapel spire, far downtown towers and
// stars; High Park's oaks, ridge and clouds; the Distillery District's chimney stack, water tower and
// condo towers; The Beaches' high clouds and tall trees; and Yonge Street's skyline, moon and stars.
const CALM = BASE - 70;

// Scale of the ground at row centre yc (y + 0.5).
function scale(yc: number): number {
  return (BAR + yc - YH) / KS;
}

// Band position of the ground point x across, z along, and its scale.
function at(x: number, z: number): [number, number, number] {
  const s = F / (F + z);
  return [CX + x * s, YH + KS * s - BAR, s];
}

// A fixed pseudo-random value in [0, 1) per pixel: a mixed integer hash, so picks fall irregularly
// and no lattice or diagonal rhythm shows. x and y are integers.
function noise(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 0xffff) / 65536;
}

// About one pixel in n, picked irregularly.
function hashed(x: number, y: number, n: number): boolean {
  return noise(x, y) * n < 1;
}

// The colour of the band's pixel x, y as "r,g,b".
function pixelAt(cv: Canvas, x: number, y: number): string {
  const i = (y * cv.img.width + x) * 4;
  return `${cv.img.data[i]},${cv.img.data[i + 1]},${cv.img.data[i + 2]}`;
}

// Paint the street's stub, rows STUB to the bottom.
function street(cv: Canvas, paint: RoadPaint): void {
  for (let py = STUB; py < H; py++) {
    const s = scale(py + 0.5);
    const z = F / s - F;
    const span = z - (F / scale(py + 1.5) - F);
    for (let px = 0; px < W; px++) {
      cv.fill(px, py, 1, 1, paint((px + 0.5 - CX) / s, z, span, px, py));
    }
  }
}

// Whether a line every period along the road falls in this row.
function crosses(z: number, span: number, period: number): boolean {
  return Math.floor(z / period) !== Math.floor((z - Math.max(span, 1)) / period);
}

type Dash = readonly [on: number, period: number];

// The stub's lane dividers, 1px wide; dashes stop where a row spans too much road. mark and edge are
// a colour, or one per divider, left to right.
function lanes(
  cv: Canvas,
  mark: string | readonly string[],
  {
    dash = [12, 32],
    edge = null,
    span = 6,
  }: { dash?: Dash | null; edge?: string | readonly string[] | null; span?: number } = {},
): void {
  const marks = typeof mark === "string" ? DIVIDERS.map(() => mark) : mark;
  const edges = edge === null || typeof edge === "string" ? DIVIDERS.map(() => edge) : edge;
  const n = Math.min(DIVIDERS.length, marks.length, edges.length);
  for (let py = STUB; py < H; py++) {
    const s = scale(py + 0.5);
    const z = F / s - F;
    const z1 = F / scale(py + 1.5) - F;
    if (z - z1 > span || (dash && z % dash[1] >= dash[0])) {
      continue;
    }
    for (let i = 0; i < n; i++) {
      const x = Math.round(CX + DIVIDERS[i]! * s - 0.5);
      cv.fill(x, py, 1, 1, marks[i]!);
      const e = edges[i];
      if (e) {
        cv.fill(x + 1, py, 1, 1, e);
      }
    }
  }
}

// How far pixel px, py lies inside a near corner, in pixels, or below 0 on the road. The corners are
// the blocks either side of the stub, below the cross street, rounded where the stub's curb turns
// into the near curb.
function cornerDepth(px: number, py: number): number {
  const dx = Math.abs(px + 0.5 - CX) - ROAD * scale(py + 0.5);
  const dy = py + 0.5 - NEAR_CURB;
  if (dx < CORNER && dy < CORNER) {
    return CORNER - Math.hypot(CORNER - dx, CORNER - dy);
  }
  return Math.min(dx, dy);
}

// Cabbagetown's cross street sidewalk, plain stone without seams, as its verge's.
function slabs(): string {
  return "stone";
}

// A flat lawn: 2-row tufts of the darker green, placed irregularly.
function grass(lawn = "green", rate = 0.03): Paint {
  return (px, py) => (noise(px, py) < rate || noise(px, py - 1) < rate ? dk(lawn) : lawn);
}

type Bend = (px: number) => number;

function noBend(): number {
  return 0;
}

// Paint the cross street from row top down to the stub: walk paints the sidewalks (and the far
// side's ground above them), road the road and edge the road's pixels beside a curb. curb null
// leaves the road without curbs, as the park's paths are. bend(px) raises the far side by that many
// rows at column px, for a street that curves away. The road is one flat colour, road's most common,
// with no texture: flecks or seams across the far street read as artefacts.
function cross(
  cv: Canvas,
  road: Paint,
  edge: string,
  walk: Paint,
  {
    bend = noBend,
    curb = "grey",
    top = FAR_WALK,
  }: { bend?: Bend; curb?: string | null; top?: number } = {},
): void {
  const counts = new Map<string, number>();
  for (let py = CROSS; py < STUB; py++) {
    for (let px = 0; px < W; px++) {
      const c = road(px, py);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  // the most common, the first seen on a tie
  let flatRoad = "";
  let most = 0;
  for (const [c, n] of counts) {
    if (n > most) {
      flatRoad = c;
      most = n;
    }
  }
  let lift = -Infinity;
  for (let px = 0; px < W; px++) {
    lift = Math.max(lift, bend(px));
  }
  for (let py = top - lift; py < STUB; py++) {
    for (let px = 0; px < W; px++) {
      const b = bend(px);
      if (py < top - b) {
        continue;
      }
      let c: string;
      if (py < FAR_CURB - b) {
        c = walk(px, py);
      } else if (py < CROSS - b) {
        c = curb ?? walk(px, py);
      } else {
        const d = cornerDepth(px, py);
        if (d >= (curb ? 2 : 0)) {
          c = walk(px, py);
        } else if (d >= 0) {
          c = curb!;
        } else if (d >= -1 || py === CROSS - b) {
          c = edge;
        } else {
          c = flatRoad;
        }
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
}

// The cross street's centre line on row LINE, dashed at world x like the stub's dividers, with edge
// on the row below it; raised by half the far side's bend.
function crossLine(
  cv: Canvas,
  mark: string,
  {
    bend = noBend,
    dash = [12, 32],
    edge = null,
  }: { bend?: Bend; dash?: Dash | null; edge?: string | null } = {},
): void {
  const s = scale(LINE + 0.5);
  for (let px = 0; px < W; px++) {
    if (dash) {
      const u = (px + 0.5 - CX) / s;
      if (((u % dash[1]) + dash[1]) % dash[1] >= dash[0]) {
        continue;
      }
    }
    const y = LINE - Math.floor(bend(px) / 2);
    cv.fill(px, y, 1, 1, mark);
    if (edge) {
      cv.fill(px, y + 1, 1, 1, edge);
    }
  }
}

// Far treetops or rooftops along row, rising lo to hi rows.
function treeline(
  cv: Canvas,
  row: number,
  cols: readonly [string, string],
  seed: number,
  lo = 2,
  hi = 7,
): void {
  for (let x = 0; x < W; x++) {
    const t = (x * 0.21 + seed) % 6.283;
    const hgt = lo + Math.round((hi - lo) * (0.5 + 0.5 * Math.sin(t) * Math.cos(t * 2.3 + seed)));
    cv.fill(x, row - hgt + 1, 1, hgt, cols[0]);
    cv.fill(x, row - hgt + 1, 1, 1, cols[1]);
  }
}

// Paint the far side's ground, rows y0 to y1.
function yard(cv: Canvas, y0: number, y1: number, paint: Paint): void {
  for (let py = y0; py < y1; py++) {
    for (let px = 0; px < W; px++) {
      cv.fill(px, py, 1, 1, paint(px, py));
    }
  }
}

// A front path from a door on row y0 down to the sidewalk on row y1, widening as it nears.
function path(cv: Canvas, x: number, y0: number, y1: number, col = "lgrey", edge = "grey"): void {
  for (let py = y0; py < y1; py++) {
    const grow = Math.floor((py - y0) / 3);
    cv.fill(x - grow, py, 12 + 2 * grow, 1, col);
    cv.fill(x - grow, py, 1, 1, edge);
  }
}

// Lawn texture follows the road strips' rule: mown stripes run along the street and converge toward
// its centre line (stripes across it band and shimmer as rows span more lawn), their widths vary,
// and each ends where it would draw under 4px wide. Tufts are 2-row marks, placed irregularly and
// thinning out with distance.
const MOWN: readonly number[] = [44, 62, 36, 70, 50, 58, 40, 66];

// Whether the lawn at x across falls in a darker mown stripe, at ground scale s. Only the front
// lawns, out to 300 past the sidewalk, are mown.
function mown(x: number, s: number): boolean {
  let a = Math.abs(x) - WALK;
  let i = 0;
  if (a >= 300) {
    return false;
  }
  while (a >= MOWN[i % MOWN.length]!) {
    a -= MOWN[i % MOWN.length]!;
    i += 1;
  }
  return i % 2 === 1 && MOWN[i % MOWN.length]! * s >= 4;
}

// A 2-row grass mark here: about rate of pixels on the band's bottom row, fewer further off.
function tuft(px: number, py: number, s: number, rate = 0.03): boolean {
  const p = rate * (s / S0) ** 2;
  return noise(px, py) < p || noise(px, py - 1) < p;
}

// A rough patch as a world ellipse (x, z, rx, rz).
type Patch = readonly [x: number, z: number, rx: number, rz: number];

// n rough patches either side of the street, dropping any that would draw under 6 rows tall.
function rough(seed: string, n: number, x0: number, x1: number, z0: number, z1: number): Patch[] {
  const rnd = stream(seed);
  const out: Patch[] = [];
  while (out.length < n) {
    const x = randomPick(rnd, [-1, 1]) * uniform(rnd, x0, x1);
    const z = uniform(rnd, z0, z1);
    const rx = uniform(rnd, 30, 90);
    const rz = uniform(rnd, 16, 40);
    if (at(x, Math.max(z - rz, Z0))[1] - at(x, z + rz)[1] >= 6) {
      out.push([x, z, rx, rz]);
    }
  }
  return out;
}

// A stub road painter as the cross street's: its middle, with no lines across.
function flat(road: RoadPaint): Paint {
  return (px, py) => road(0, 0, 99, px, py);
}

// Flat rays of a and b from cx, cy over rows 0 to y1: n of each round the half turn. With r, (rx,
// ry), the rays end on that ellipse round cx, cy and b fills the rest.
function sunburst(
  cv: Canvas,
  cx: number,
  cy: number,
  n: number,
  a: string,
  b: string,
  y1: number,
  { r, w = W }: { r?: readonly [number, number]; w?: number } = {},
): void {
  for (let py = 0; py < y1; py++) {
    for (let px = 0; px < w; px++) {
      if (r !== undefined && ((px + 0.5 - cx) / r[0]) ** 2 + ((py + 0.5 - cy) / r[1]) ** 2 > 1) {
        cv.fill(px, py, 1, 1, b);
        continue;
      }
      const ang = Math.atan2(px + 0.5 - cx, cy - py - 0.5);
      const ray = Math.floor(ang / (Math.PI / (2 * n)) + 0.5);
      cv.fill(px, py, 1, 1, ((ray % 2) + 2) % 2 ? a : b);
    }
  }
}

function outlineBox(cv: Canvas, x: number, y: number, w: number, h: number, col: string): void {
  cv.fill(x, y, w, 1, col);
  cv.fill(x, y + h - 1, w, 1, col);
  cv.fill(x, y, 1, h, col);
  cv.fill(x + w - 1, y, 1, h, col);
}

// A shopfront facing the camera, rows top to base, drawn as a toy box: flat colour blocks inside a
// 1px line, a shaded top and right side, a sign board in the sign letters, an awning striped awn and
// stripe, the shop window in glass and the door.
function shopfront(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wallC: string,
  awn: string,
  signText: string,
  board: string,
  letters: string,
  {
    glass = "cyan",
    line = "plum",
    stripe = "white",
  }: { glass?: string; line?: string; stripe?: string } = {},
): void {
  cv.fill(x, top, w, base - top, wallC);
  cv.fill(x + w - 3, top, 3, base - top, dk(wallC));
  cv.fill(x, top, w, 3, dk(wallC));
  outlineBox(cv, x, top, w, base - top + 1, line);
  cv.fill(x + 5, base - 32, w - 10, 13, line);
  cv.fill(x + 6, base - 31, w - 12, 11, board);
  word(cv, signText, x + w / 2, base - 29, letters);
  for (let i = 0; i < w - 4; i += 8) {
    cv.fill(x + 2 + i, base - 18, 4, 5, awn);
    cv.fill(x + 6 + i, base - 18, 4, 5, stripe);
  }
  cv.fill(x + 1, base - 18, w - 2, 1, line);
  cv.fill(x + 2, base - 13, w - 4, 1, dk(awn));
  for (let i = 2; i < w - 4; i += 4) {
    cv.fill(x + i, base - 12, 2, 1, awn);
  }
  cv.fill(x + 6, base - 11, w - 34, 11, line);
  cv.fill(x + 7, base - 10, w - 36, 9, glass);
  cv.fill(x + 9, base - 8, 6, 1, "white");
  cv.fill(x + 9, base - 6, 3, 1, "white");
  cv.fill(x + w - 22, base - 12, 12, 12, line);
  cv.fill(x + w - 21, base - 11, 10, 11, "dbrown");
  cv.fill(x + w - 13, base - 6, 1, 2, "amber");
}

// A cat sitting on a far fence, side-on, its tail curled up: x body, o its lit back.
const FENCE_CAT: readonly string[] = ["x.x...", "xxx...", "xxx..x", ".xxx.x", ".xoxxx", ".xxxx."];

// A small cat sitting on a fence top, its feet on row y.
function fenceCat(cv: Canvas, x: number, y: number, col = "plum", lit = "purple"): void {
  FENCE_CAT.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        cv.fill(x + i, y - FENCE_CAT.length + j, 1, 1, ch === "o" ? lit : col);
      }
    });
  });
}

// The crescent's far side rises 5 rows at the street's end and none at the band's edges.
function crescentBend(px: number): number {
  return Math.round(5 * Math.max(0.0, 1 - ((px + 0.5 - CX) / (W / 2)) ** 2));
}

// ---------- the six neighbourhoods ----------
// The six Toronto neighbourhoods, sharing the cross street. Their darkness ranges from the open sand
// of The Beaches to Yonge Street's evening and Kensington Market's Pedestrian Sunday at twilight, and
// each has its own sky.

interface VergeDots {
  colours: string[];
  share: number;
}
interface Verge {
  curbColour: string;
  curbTo: number;
  leaves: boolean;
  lawn: "mown" | "none" | "rough";
  lawnColours: [lawn: string, dark: string, tufted: string] | null;
  seamColour: string;
  seamEvery: number;
  strips: { colour: string; dots: VergeDots[]; to: number }[];
  walkColour: string;
  walkDots: VergeDots[];
  walkTo: number | null;
}

// The game's verge beside each road, keyed by art id, with colours by K name (shared/verges.json):
// the curb to curbTo, the strips (each to its to), the sidewalk or paving with a seam every
// seamEvery to walkTo (null: paving on out, with no lawn), then the lawn, mown or rough. lawnColours
// are the lawn's base, its mown stripes and rough patches, and its 2-row tufts, which draw their own
// colour rather than darkening the pixel under them; null where there is no lawn. walkDots are single
// pixels that shimmer as the road scrolls, so together they cover 6% or less of the paving. The keys
// keep the JSON's order.
/* eslint-disable sort-keys */
const VERGES: Readonly<Record<string, Verge>> = {
  cabbagetown: {
    curbColour: "dstone",
    curbTo: CURB,
    strips: [],
    walkColour: "stone",
    walkDots: [],
    seamColour: "dstone",
    seamEvery: 32,
    walkTo: WALK,
    lawn: "mown",
    lawnColours: ["olive", "dolive", "pine"],
    leaves: false,
  },
  "high-park": {
    curbColour: "pine",
    curbTo: 160,
    strips: [],
    walkColour: "pine",
    walkDots: [],
    seamColour: "pine",
    seamEvery: 32,
    walkTo: 160,
    lawn: "rough",
    lawnColours: ["pine", "bark", "fir"],
    leaves: false,
  },
  "distillery-district": {
    curbColour: "dstone",
    curbTo: 164,
    strips: [],
    walkColour: "brown",
    walkDots: [
      { colours: ["brick"], share: 0.036 },
      { colours: ["dbrown"], share: 0.015 },
      { colours: ["rust"], share: 0.008 },
    ],
    seamColour: "dbrown",
    seamEvery: 32,
    walkTo: null,
    lawn: "none",
    lawnColours: null,
    leaves: false,
  },
  "kensington-market": {
    curbColour: "driftwood",
    curbTo: 162,
    strips: [{ colour: "dstone", dots: [], to: 166 }],
    walkColour: "walnut",
    walkDots: [],
    seamColour: "coal",
    seamEvery: 32,
    walkTo: null,
    lawn: "none",
    lawnColours: null,
    leaves: false,
  },
  "the-beaches": {
    curbColour: "clay",
    curbTo: 164,
    strips: [],
    walkColour: "driftwood",
    walkDots: [{ colours: ["stone"], share: 0.025 }],
    seamColour: "driftwood",
    seamEvery: 32,
    walkTo: null,
    lawn: "none",
    lawnColours: null,
    leaves: false,
  },
  "yonge-street": {
    curbColour: "grey",
    curbTo: 164,
    strips: [],
    walkColour: "dslate",
    walkDots: [{ colours: ["slate"], share: 0.012 }],
    seamColour: "navy",
    seamEvery: 32,
    walkTo: null,
    lawn: "none",
    lawnColours: null,
    leaves: false,
  },
};
/* eslint-enable sort-keys */

// The dot colour a noise value in [0, 1) picks, or null: each dot takes its share of the range in
// turn, its colours equal parts of that share (as the game's verge dots).
function dotted(dots: readonly VergeDots[], value: number): string | null {
  let v = value;
  for (const d of dots) {
    if (v < d.share) {
      return d.colours[Math.floor((v / d.share) * d.colours.length)]!;
    }
    v -= d.share;
  }
  return null;
}

// A painter for the far side's ground and the cross street's corners, paved as the zone's verge
// (VERGES): its sidewalk or paving colour with its dots.
function vergePaving(zone: string): Paint {
  const v = VERGES[zone]!;
  return (px, py) => dotted(v.walkDots, noise(px, py)) ?? v.walkColour;
}

// A stub painter for a Toronto neighbourhood: road inside the road, then its verge (VERGES), with
// rough patches as world ellipses.
function verge(zone: string, road: RoadPaint, patches: readonly Patch[] = []): RoadPaint {
  const v = VERGES[zone]!;
  const walkTo = v.walkTo ?? 10 ** 6;

  function groundAt(x: number, z: number, span: number): string {
    const a = Math.abs(x);
    if (a < v.curbTo) {
      return v.curbColour;
    }
    for (const strip of v.strips) {
      if (a < strip.to) {
        return dotted(strip.dots, noise(Math.floor(x), Math.floor(z))) ?? strip.colour;
      }
    }
    if (span < 16 && crosses(z, span, v.seamEvery)) {
      return v.seamColour;
    }
    return dotted(v.walkDots, noise(Math.floor(x), Math.floor(z))) ?? v.walkColour;
  }

  return (x, z, span, px, py) => {
    const a = Math.abs(x);
    if (a < ROAD) {
      return road(x, z, span, px, py);
    }
    if (a < walkTo) {
      return groundAt(x, z, span);
    }
    const [lawn, dark, tufted] = v.lawnColours!;
    const s = F / (F + z);
    let c = lawn;
    if (
      (v.lawn === "mown" && mown(x, s)) ||
      patches.some(([qx, qz, rx, rz]) => ((x - qx) / rx) ** 2 + ((z - qz) / rz) ** 2 <= 1)
    ) {
      c = dark;
    }
    return tuft(px, py, s) ? tufted : c;
  };
}

const VERGES_JSON = "shared/verges.json";

// VERGES as VERGES_JSON holds it: keyed by art id, colours by K name.
function vergesJson(): string {
  return `${JSON.stringify(VERGES, null, 2)}\n`;
}

// Write VERGES to VERGES_JSON, for the game.
function writeVerges(): void {
  writeFileSync(VERGES_JSON, vergesJson());
}

export {
  bandRows,
  bands,
  BASE,
  birds,
  bush,
  CALM,
  cloud,
  crescentBend,
  CROSS,
  cross,
  crosses,
  crossLine,
  CURB,
  CX,
  DIVIDERS,
  F,
  FAR_WALK,
  fenceCat,
  flat,
  flowers,
  FOOT,
  grass,
  ground,
  H,
  hashed,
  hills,
  house,
  type HouseParts,
  KS,
  lanes,
  LINE,
  NEAR_CURB,
  noise,
  outlineBox,
  type Paint,
  path,
  pixelAt,
  ROAD,
  type RoadPaint,
  roofline,
  rough,
  S0,
  scale,
  shopfront,
  SHRUB,
  sky,
  slabs,
  SLIM,
  stream,
  street,
  STUB,
  sun,
  sunburst,
  sunset,
  tree,
  treeline,
  uniform,
  verge,
  vergePaving,
  VERGES,
  vergesJson,
  VISIBLE,
  W,
  WALK,
  window,
  word,
  writeVerges,
  yard,
  YH,
  Z0,
};
