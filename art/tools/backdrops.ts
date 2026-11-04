// Draw the zone backdrops: the neighbourhood band between the top bar and the road.
//
// backdrop-<zone>: 360x158 images in the house palette, drawn on screen rows 48 to 205. The
// street ends at a T-junction: the bottom rows continue the pseudo-3D road below the band (the
// same projection, so the same road, curb and sidewalk edges at the same slope) up to a cross
// street that runs flat across the band. Beyond it the far side faces the camera: the zone's
// houses, park or shops, the scenery behind them (hills, rooftops, water, a skyline) and the sky.
// The band, the approach and the camera come from the game's layout export. The backdrops draw
// no static scenery on the near corners or the stub's verges, where the game's road begins and
// its items spawn: only the verge's ground.
//
// Rows, in band rows (0 to 157): the sky is one flat colour above row 45 (CALM), under the message
// strip (band rows 6 to 57 while a message shows), but any neighbourhood's skyline may rise above
// it (Cabbagetown's old trees, chapel spire, far downtown towers and stars; High Park's oaks,
// ridge and clouds; the Distillery District's chimney stack, water tower and condo towers; The
// Beaches' high clouds and tall trees; and Yonge Street's skyline, moon and stars); the far side's
// ground row 115 (BASE), the far sidewalk 119 to 122, the far curb 123 to 124, the cross street
// 125 to 133 with its centre line on row 129, the near curb 134 to 135 (none where the cross
// street has none), the near sidewalk 136 to 138, and the stub from row 139 (STUB, the approach)
// to the bottom row, 157, which continues the game's road (the 320-wide strip on columns 100 to
// 259, lane dividers on 132, 164, 195 and 227, verge outside). The two sidewalks' middles run from
// (87, 157) to (93, 138) and from (273, 157) to (267, 138) (node art/tools/backdrops.ts camera
// prints them for the current constants).
//
// Every seeded texture (clouds, ridges, oaks, lit windows, passers-by, soot streaks, rough lawn)
// draws from game-kit's randomStream, one stream per texture named after it, so a build is the
// same on every run.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { filledImage, paste, resizeNearest } from "@andornaut/art-kit/raster";
import { type Random, randomInt, randomPick, randomStream } from "@andornaut/game-kit/random";

import { sign, signWidth } from "./fonts.ts";
import { dk, K, MURAL, rgbPng } from "./pixel.ts";
import { LANE_PAINT } from "./roads.ts";
import { Canvas, LAYOUT as SCENE_LAYOUT, rgb } from "./scene.ts";

export { MURAL };

const USAGE = `Usage:
  node art/tools/backdrops.ts preview OUT.png   all six, stacked, scaled up
  node art/tools/backdrops.ts camera            print the camera, the join with the road and the sidewalks
  node art/tools/backdrops.ts verges [--write]  print the verges (VERGES) as JSON, or write
                                                them to shared/verges.json, which build also writes
  node art/tools/backdrops.ts build             write art/backdrops/*.aseprite and
                                                public/art/images/*.png`;

// A painter of the band's flat parts: a colour name per pixel.
export type Paint = (px: number, py: number) => string;
// A painter of the street's stub: a colour name per pixel, from its world position x across and z
// along, the length of road span its row covers, and the pixel.
export type RoadPaint = (x: number, z: number, span: number, px: number, py: number) => string;

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
interface Region {
  height: number;
  width: number;
  y: number;
}
interface BackdropLayout {
  camera: { centreX: number; focal: number; footY: number; horizonY: number };
  lanes: { dividers: number[] };
  regions: { approach: Region; backdrop: Region; junction: Region; road: Region };
}
const LAYOUT = SCENE_LAYOUT as unknown as BackdropLayout;
const BAND = LAYOUT.regions.backdrop;
// the band: screen rows BAR to BAR + H - 1
export const W = BAND.width;
export const H = BAND.height;
// the status bar's height: band row y is screen row BAR + y
export const BAR = BAND.y;
const CAMERA = LAYOUT.camera;
// the road's centre column, and its vanishing point's
export const CX = CAMERA.centreX;
export const YH = CAMERA.horizonY;
export const FOOT = CAMERA.footY;
export const F = CAMERA.focal;

// Sign lettering: the yard sign's letters at scale in col, a 1px ink outline and a dred shadow
// (fonts.sign), 8 rows at 1x from the outline's top on row y to the shadow, centred on column mid
// without the shadow.
export function word(
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
export type Cloud = readonly [x: number, y: number, w: number, puff: number];

// The sky: top, flat, down to row CALM, then low, with clouds.
export function sky(
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
export function cloud(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  puff: number,
  seed: number,
): void {
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
export function sunset(cv: Canvas, cols: readonly string[], bottom: number): [number, number][] {
  cv.fill(0, 0, W, CALM, cols[0]!);
  return bands(cv, CALM, bottom, cols);
}

// Far rolling hills: a silhouette of col from about row top (up to amp rows lower) down to row
// bottom, edge on its top row. Returns the top row of each column.
export function hills(
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
export type Roof = readonly [x: number, w: number, wallH: number];

// Far houses as one silhouette of col standing on row base, each under a steep gable that narrows
// a column a side per row, half as tall as the house is wide.
export function roofline(cv: Canvas, base: number, roofs: readonly Roof[], col: string): void {
  for (const [x, w, wallH] of roofs) {
    cv.fill(x, base - wallH, w, wallH, col);
    for (let k = 0; k < Math.floor(w / 2) + 1; k++) {
      cv.fill(x - 1 + k, base - wallH - 1 - k, w + 2 - 2 * k, 1, col);
    }
  }
}

// Gulls far off: a 5px wing pair each, at (x, y).
export function birds(
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
export function bandRows(
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
export function bands(
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
export function sun(
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
export function ground(
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
export type HouseParts = readonly [off: number, ww: number, wh: number, doorH: number];
export const HOUSE: HouseParts = [6, 12, 10, 18];
// SLIM is the slim house's windows and door: tall windows either side of the door.
export const SLIM: HouseParts = [4, 8, 10, 13];

export interface HouseOptions {
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
export function house(
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
export function window(
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
export function dormerWindow(
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

export interface TreeOptions {
  base?: number;
  girth?: number;
  leaf?: string;
  r?: number;
  shade?: string;
  trunk?: string;
}

// A round tree on row base, its crown centred on row top.
export function tree(
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
export type Lobes = readonly (readonly [dx: number, dy: number, r: number])[];
export const BUSH: Lobes = [
  [0, 0, 6],
  [8, -2, 7],
  [16, 0, 6],
];
export const SHRUB: Lobes = [
  [0, 0, 4],
  [5, -1, 5],
  [10, 0, 4],
];

export function bush(
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

export function flowers(
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

export const KS = FOOT - YH;
// scale on the band's bottom row
export const S0 = (BAR + H - 0.5 - YH) / KS;
// road in view below the band, to its bottom edge
export const VISIBLE = (F * KS) / (BAR + H - YH) - F;
// the road distance on the band's bottom row
export const Z0 = F / S0 - F;
// half the road, then the outer edges of the curb and the sidewalk, across from the road's centre,
// as Cabbagetown's verge (VERGES)
export const ROAD = Math.floor(LAYOUT.regions.road.width / 2);
export const CURB = 164;
export const WALK = 208;
// lane divider lines, from the road's centre
export const DIVIDERS: readonly number[] = LAYOUT.lanes.dividers.map((x) => x - CX);
// The cross street, in band rows from the far side down: the far sidewalk, the far curb, the road,
// the near curb and the near sidewalk, which the street's stub (rows STUB to the bottom) opens into.
// These rows are drawn flat rather than to the projection, which would spread the cross street over
// most of the band; across, they keep the projection's scale per row, so lines along the street
// (curbs, slab seams) still lean toward the road's centre line. The stub is the band's part of the
// approach region. The near curb and sidewalk are the junction region's rows above it, where the
// game's road raster starts, drawing only the road surface between the near corners, so the corners
// stay the backdrop's.
export const STUB = LAYOUT.regions.approach.y - BAR;
export const NEAR_CURB = LAYOUT.regions.junction.y - BAR;
export const FAR_WALK = STUB - 20;
export const FAR_CURB = STUB - 16;
export const CROSS = STUB - 14;
// the cross street's centre line
export const LINE = STUB - 10;
// the near corners' curb radius, in pixels
export const CORNER = 5;
// the far side's ground row: the houses stand on it
export const BASE = STUB - 24;
// The sky above row CALM, 70 rows over the far side's ground row, is one flat colour: the debuff
// bars and the message strip (band rows 6 to 57 while a message shows) lie over it, so each
// neighbourhood's main read stays below it. Any neighbourhood's skyline may rise above it, reading
// half covered while a message shows: Cabbagetown's old trees, chapel spire, far downtown towers and
// stars; High Park's oaks, ridge and clouds; the Distillery District's chimney stack, water tower and
// condo towers; The Beaches' high clouds and tall trees; and Yonge Street's skyline, moon and stars.
export const CALM = BASE - 70;

// Scale of the ground at row centre yc (y + 0.5).
export function scale(yc: number): number {
  return (BAR + yc - YH) / KS;
}

// Band position of the ground point x across, z along, and its scale.
export function at(x: number, z: number): [number, number, number] {
  const s = F / (F + z);
  return [CX + x * s, YH + KS * s - BAR, s];
}

// A fixed pseudo-random value in [0, 1) per pixel: a mixed integer hash, so picks fall irregularly
// and no lattice or diagonal rhythm shows. x and y are integers.
export function noise(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 0xffff) / 65536;
}

// About one pixel in n, picked irregularly.
export function hashed(x: number, y: number, n: number): boolean {
  return noise(x, y) * n < 1;
}

// The colour of the band's pixel x, y as "r,g,b".
function pixelAt(cv: Canvas, x: number, y: number): string {
  const i = (y * cv.img.width + x) * 4;
  return `${cv.img.data[i]},${cv.img.data[i + 1]},${cv.img.data[i + 2]}`;
}

// Paint the street's stub, rows STUB to the bottom.
export function street(cv: Canvas, paint: RoadPaint): void {
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
export function crosses(z: number, span: number, period: number): boolean {
  return Math.floor(z / period) !== Math.floor((z - Math.max(span, 1)) / period);
}

export type Dash = readonly [on: number, period: number];

// The stub's lane dividers, 1px wide; dashes stop where a row spans too much road. mark and edge are
// a colour, or one per divider, left to right.
export function lanes(
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
export function cornerDepth(px: number, py: number): number {
  const dx = Math.abs(px + 0.5 - CX) - ROAD * scale(py + 0.5);
  const dy = py + 0.5 - NEAR_CURB;
  if (dx < CORNER && dy < CORNER) {
    return CORNER - Math.hypot(CORNER - dx, CORNER - dy);
  }
  return Math.min(dx, dy);
}

// Cabbagetown's cross street sidewalk, plain stone without seams, as its verge's.
export function slabs(): string {
  return "stone";
}

// A flat lawn: 2-row tufts of the darker green, placed irregularly.
export function grass(lawn = "green", rate = 0.03): Paint {
  return (px, py) => (noise(px, py) < rate || noise(px, py - 1) < rate ? dk(lawn) : lawn);
}

export type Bend = (px: number) => number;

export function noBend(): number {
  return 0;
}

// Paint the cross street from row top down to the stub: walk paints the sidewalks (and the far
// side's ground above them), road the road and edge the road's pixels beside a curb. curb null
// leaves the road without curbs, as the park's paths are. bend(px) raises the far side by that many
// rows at column px, for a street that curves away. The road is one flat colour, road's most common,
// with no texture: flecks or seams across the far street read as artefacts.
export function cross(
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
export function crossLine(
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
export function treeline(
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
export function yard(cv: Canvas, y0: number, y1: number, paint: Paint): void {
  for (let py = y0; py < y1; py++) {
    for (let px = 0; px < W; px++) {
      cv.fill(px, py, 1, 1, paint(px, py));
    }
  }
}

// A front path from a door on row y0 down to the sidewalk on row y1, widening as it nears.
export function path(
  cv: Canvas,
  x: number,
  y0: number,
  y1: number,
  col = "lgrey",
  edge = "grey",
): void {
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
export const MOWN: readonly number[] = [44, 62, 36, 70, 50, 58, 40, 66];

// Whether the lawn at x across falls in a darker mown stripe, at ground scale s. Only the front
// lawns, out to 300 past the sidewalk, are mown.
export function mown(x: number, s: number): boolean {
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
export function tuft(px: number, py: number, s: number, rate = 0.03): boolean {
  const p = rate * (s / S0) ** 2;
  return noise(px, py) < p || noise(px, py - 1) < p;
}

// A rough patch as a world ellipse (x, z, rx, rz).
export type Patch = readonly [x: number, z: number, rx: number, rz: number];

// n rough patches either side of the street, dropping any that would draw under 6 rows tall.
export function rough(
  seed: string,
  n: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
): Patch[] {
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
export function flat(road: RoadPaint): Paint {
  return (px, py) => road(0, 0, 99, px, py);
}

// Flat rays of a and b from cx, cy over rows 0 to y1: n of each round the half turn. With r, (rx,
// ry), the rays end on that ellipse round cx, cy and b fills the rest.
export function sunburst(
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

export function outlineBox(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
): void {
  cv.fill(x, y, w, 1, col);
  cv.fill(x, y + h - 1, w, 1, col);
  cv.fill(x, y, 1, h, col);
  cv.fill(x + w - 1, y, 1, h, col);
}

// A shopfront facing the camera, rows top to base, drawn as a toy box: flat colour blocks inside a
// 1px line, a shaded top and right side, a sign board in the sign letters, an awning striped awn and
// stripe, the shop window in glass and the door.
export function shopfront(
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
export const FENCE_CAT: readonly string[] = [
  "x.x...",
  "xxx...",
  "xxx..x",
  ".xxx.x",
  ".xoxxx",
  ".xxxx.",
];

// A small cat sitting on a fence top, its feet on row y.
export function fenceCat(cv: Canvas, x: number, y: number, col = "plum", lit = "purple"): void {
  FENCE_CAT.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        cv.fill(x + i, y - FENCE_CAT.length + j, 1, 1, ch === "o" ? lit : col);
      }
    });
  });
}

// The crescent's far side rises 5 rows at the street's end and none at the band's edges.
export function crescentBend(px: number): number {
  return Math.round(5 * Math.max(0.0, 1 - ((px + 0.5 - CX) / (W / 2)) ** 2));
}

// ---------- the six neighbourhoods ----------
// The six Toronto neighbourhoods, sharing the cross street. Their darkness ranges from the open sand
// of The Beaches to Yonge Street's evening and Kensington Market's Pedestrian Sunday at twilight, and
// each has its own sky.

export interface VergeDots {
  colours: string[];
  share: number;
}
export interface Verge {
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
export const VERGES: Readonly<Record<string, Verge>> = {
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
export function dotted(dots: readonly VergeDots[], value: number): string | null {
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
export function vergePaving(zone: string): Paint {
  const v = VERGES[zone]!;
  return (px, py) => dotted(v.walkDots, noise(px, py)) ?? v.walkColour;
}

// A stub painter for a Toronto neighbourhood: road inside the road, then its verge (VERGES), with
// rough patches as world ellipses.
export function verge(zone: string, road: RoadPaint, patches: readonly Patch[] = []): RoadPaint {
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

export const VERGES_JSON = "shared/verges.json";

// Write VERGES to VERGES_JSON, keyed by art id, colours by K name, for the game.
export function writeVerges(): void {
  writeFileSync(VERGES_JSON, `${JSON.stringify(VERGES, null, 2)}\n`);
}

// A wrought-iron front fence whose bars end on row y + 3: a bar every 3 columns under a top rail,
// every other bar topped with a spear.
export function ironFence(
  cv: Canvas,
  y: number,
  x0: number,
  x1: number,
  { col = "coal", h = 9 }: { col?: string; h?: number } = {},
): void {
  for (let i = 0, x = x0; x < x1; i++, x += 3) {
    cv.fill(x, y + 4 - h, 1, h, col);
    if (i % 2 === 0) {
      cv.fill(x, y + 3 - h, 1, 1, col);
    }
  }
  cv.fill(x0, y + 5 - h, x1 - x0, 1, col);
  cv.fill(x0, y + 1, x1 - x0, 1, col);
}

// A heritage street lamp whose post stands on row y: a lantern lit gold.
export function gasLamp(cv: Canvas, x: number, y: number, post = "coal"): void {
  cv.fill(x, y - 22, 2, 22, post);
  cv.fill(x - 1, y - 2, 4, 2, post);
  cv.fill(x - 2, y - 28, 6, 6, post);
  cv.fill(x - 1, y - 27, 4, 4, "gold");
  cv.fill(x - 1, y - 30, 4, 2, post);
}

// A Victorian bay-and-gable house on row base: a steep gable trimmed along both rakes, a two-storey
// bay window on its left half, a door on its right.
export function bayGable(
  cv: Canvas,
  cx: number,
  w: number,
  wall: string,
  roof: string,
  door: string,
  base: number,
  { curtains, trim = "white" }: { curtains?: string | undefined; trim?: string } = {},
): void {
  const x = cx - Math.floor(w / 2);
  const top = base - 50;
  const roofH = 22;
  house(cv, x, w, wall, roof, { base, curtains, door, eave: 2, parts: SLIM, roofH, top });
  const half = w / 2 + 2;
  for (let i = 1; i < roofH; i++) {
    const inset = Math.round((i * half) / roofH);
    const left = x - 2 + (Math.floor(w / 2) + 2) - inset;
    cv.fill(left, top + i, 1, 1, trim);
    cv.fill(left + 2 * inset - 1, top + i, 1, 1, trim);
  }
  cv.fill(cx - 2, top + 8, 4, 5, "plum");
  cv.fill(cx - 1, top + 9, 2, 3, curtains || "cyan");
  // the bay: a box standing proud of the wall, three windows a storey, its right side in shade
  const bx = x + 2;
  const bw = Math.floor(w / 2) - 1;
  cv.fill(bx, top + roofH + 2, bw, base - top - roofH - 2, wall);
  cv.fill(bx + bw - 2, top + roofH + 2, 2, base - top - roofH - 2, dk(wall));
  cv.fill(bx - 1, top + roofH + 1, bw + 2, 1, trim);
  for (const wy of [top + roofH + 4, top + roofH + 16]) {
    for (let k = 0; k < 3; k++) {
      window(
        cv,
        bx + 1 + Math.floor((k * (bw - 2)) / 3),
        wy,
        Math.max(3, Math.floor((bw - 2) / 3) - 1),
        8,
        { curtains },
      );
    }
  }
  cv.fill(bx - 1, top + roofH + 14, bw + 2, 1, trim);
}

// The Necropolis chapel's tower between the roofs, from row top down to row base: red brick banded in
// stone under its belfry, buttresses below, lit lancets, a pinnacle on each corner, a slate spire
// spire rows tall narrowing in steps, and a cream cross.
export function necropolis(cv: Canvas, cx: number, top: number, base: number, spire = 26): void {
  cv.fill(cx - 4, top, 9, base - top, "brick");
  cv.fill(cx + 3, top, 2, base - top, "dbrick");
  for (const y of [top + 2, top + 12, top + 13]) {
    cv.fill(cx - 4, y, 9, 1, "stone");
  }
  for (const x of [cx - 5, cx + 5]) {
    cv.fill(x, top + 14, 1, base - top - 14, "dbrick");
  }
  for (const [y, col] of [
    [top + 5, "gold"],
    [top + 18, "gold"],
    [base - 9, "walnut"],
  ] as const) {
    cv.fill(cx - 1, y, 3, 6, col);
    cv.fill(cx, y - 1, 1, 1, col);
  }
  cv.fill(cx - 5, top - 1, 11, 2, "dslate");
  for (const x of [cx - 5, cx + 5]) {
    cv.fill(x, top - 5, 1, 4, "dslate");
  }
  for (let k = 0; k < spire; k++) {
    const half = 3 - Math.floor((k * 4) / (spire + 1));
    cv.fill(cx - half, top - 2 - k, 2 * half + 1, 1, "dslate");
    cv.fill(cx - half, top - 2 - k, 1, 1, "slate");
  }
  cv.fill(cx, top - spire - 5, 1, 4, "cream");
  cv.fill(cx - 1, top - spire - 4, 3, 1, "cream");
}

// A mature street tree on row base: a 4-wide trunk under a wide crown of three lobes whose top row
// is top, the big one radius r over two smaller ones low on each side, shaded lower right.
export function oldTree(
  cv: Canvas,
  cx: number,
  top: number,
  r: number,
  base: number,
  {
    leaf = "canopy",
    shade = "pine",
    trunk = "bark",
  }: { leaf?: string; shade?: string; trunk?: string } = {},
): void {
  const cy = top + r;
  const lobes = [
    [cx, cy, r],
    [cx - Math.round(r * 0.75), cy + Math.round(r * 0.45), Math.round(r * 0.7)],
    [cx + Math.round(r * 0.75), cy + Math.round(r * 0.5), Math.round(r * 0.68)],
  ] as const;
  cv.fill(cx - 2, cy, 4, base - cy, trunk);
  for (let px = cx - 2 * r; px < cx + 2 * r + 1; px++) {
    for (let py = top; py < cy + 2 * r; py++) {
      if (lobes.some(([lx, ly, lr]) => (px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2 <= lr * lr)) {
        const lit = px - cx + 1.2 * (py - cy);
        cv.fill(px, py, 1, 1, lit > r * 0.55 ? shade : leaf);
      }
    }
  }
}

// The downtown towers far off to the southwest, one flat silhouette of col standing on row base:
// flat-topped slabs of differing heights and the CN Tower's antenna, SkyPod, main pod and shaft.
export function downtown(cv: Canvas, base: number, col = "violet"): void {
  for (const [x, w, top] of [
    [100, 8, 56],
    [108, 6, 50],
    [124, 8, 46],
    [132, 6, 52],
    [138, 8, 44],
    [146, 6, 54],
    [152, 8, 48],
    [160, 6, 56],
    [166, 8, 52],
    [174, 10, 58],
  ] as const) {
    cv.fill(x, top, w, base - top, col);
  }
  const tx = 118;
  cv.fill(tx - 1, 34, 2, base - 34, col);
  cv.fill(tx - 4, 36, 8, 3, col);
  cv.fill(tx - 3, 35, 6, 1, col);
  cv.fill(tx - 3, 39, 6, 1, col);
  cv.fill(tx - 2, 26, 4, 3, col);
  cv.fill(tx - 1, 29, 2, 5, col);
  cv.fill(tx - 1, 12, 1, 14, col);
}

// the Necropolis chapel's column: the gap between the second and third houses, left treeless
export const CHAPEL = 87;
// the old trees behind the houses, in the gaps between them: (column, crown's top row, radius)
export const OLD_TREES: readonly (readonly [number, number, number])[] = [
  [25, 42, 15],
  [211, 44, 14],
  [273, 40, 16],
  [335, 44, 14],
];
// the gap in front of the downtown towers, a young tree that leaves them in view
export const YOUNG_TREE = 149;

export function cabbagetown(): Canvas {
  const cv = new Canvas(W, H);
  // a lavender dusk, a last gold glow over the hills, a crescent moon and the first stars
  cv.fill(0, 0, W, CALM, "lilac");
  const rows = bands(cv, CALM, BASE - 36, ["lilac", "pink", "peach", "gold"]);
  cv.fill(0, BASE - 36, W, 36, "gold");
  for (let dy = -6; dy < 7; dy++) {
    for (let dx = -6; dx < 7; dx++) {
      if (dx * dx + dy * dy <= 36 && (dx + 3) ** 2 + (dy - 2) ** 2 > 25) {
        cv.fill(CX - 128 + dx, CALM + 10 + dy, 1, 1, "cream");
      }
    }
  }
  for (const [x, y] of [
    [40, 4],
    [96, 9],
    [162, 2],
    [212, 7],
    [262, 1],
    [344, 11],
    [120, 16],
    [300, 14],
    [186, 12],
  ] as const) {
    if (CALM - 12 + y < rows[0]![1] - 6) {
      cv.fill(x, CALM - 12 + y, 1, 1, "white");
    }
  }
  // far off, the downtown towers; then the old neighbourhood: brick roofs up a leafy rise, the
  // Necropolis chapel's spire
  downtown(cv, BASE - 30);
  hills(cv, BASE - 40, BASE, "canopy", "olive", 3.1, { amp: 6 });
  roofline(
    cv,
    BASE - 28,
    [
      [10, 16, 8],
      [40, 14, 6],
      [150, 16, 8],
      [212, 16, 9],
      [258, 16, 7],
      [282, 14, 9],
      [326, 18, 8],
    ],
    "dbrick",
  );
  necropolis(cv, CHAPEL, BASE - 56, BASE);

  const road: RoadPaint = (x, _z, _span, px, py) => {
    if (Math.abs(x) >= ROAD - 4) {
      return "stone";
    }
    return hashed(px, py, 53) ? "slate" : "grey";
  };

  const homes = [
    [-6, 44, "brick", "shale", "forest", undefined],
    [56, 44, "cream", "slate", "ttc", undefined],
    [118, 46, "brick", "dslate", "navy", "gold"],
    [180, 48, "dbrick", "shale", "forest", "gold"],
    [242, 46, "brick", "slate", "navy", undefined],
    [304, 44, "clay", "shale", "ttc", "gold"],
    [366, 44, "brick", "dslate", "forest", undefined],
  ] as const;
  for (const [cx, top, r] of OLD_TREES) {
    const rise = crescentBend(cx);
    oldTree(cv, cx, top - rise, r, BASE - rise);
  }
  const lift = crescentBend(YOUNG_TREE);
  tree(cv, YOUNG_TREE, BASE - 34 - lift, {
    base: BASE - lift,
    girth: 4,
    leaf: "canopy",
    r: 11,
    shade: "pine",
  });
  for (const [cx, w, wallC, roof, door, curtains] of homes) {
    bayGable(cv, cx, w, wallC, roof, door, BASE - crescentBend(cx), { curtains });
  }
  const lawn = grass("olive");
  yard(cv, BASE, FAR_WALK, lawn);
  for (let px = 0; px < W; px++) {
    for (let py = BASE - crescentBend(px); py < BASE; py++) {
      cv.fill(px, py, 1, 1, lawn(px, py));
    }
  }
  for (const [cx, w] of homes) {
    const x = cx - Math.floor(w / 2);
    path(cv, cx + 4, BASE - crescentBend(cx), FAR_WALK, "stone", "dstone");
    ironFence(cv, FAR_WALK - 4 - crescentBend(x), Math.max(0, x - 6), cx + 2);
    ironFence(cv, FAR_WALK - 4 - crescentBend(x + w), cx + 18, x + w + 6);
  }
  for (const [x, col, lit] of [
    [CX - 70, "plum", "purple"],
    [CX + 30, "orange", "amber"],
  ] as const) {
    fenceCat(cv, x, FAR_WALK - 9 - crescentBend(x + 3), col, lit);
  }
  for (const x of [CX - 150, CX - 30, CX + 92]) {
    gasLamp(cv, x, FAR_WALK + 1 - crescentBend(x));
  }
  cross(cv, flat(road), "stone", slabs, { bend: crescentBend, curb: "dstone" });
  crossLine(cv, "white", { bend: crescentBend, dash: [8, 64] });
  street(cv, verge("cabbagetown", road));
  lanes(cv, "white", { dash: [12, 64], edge: "slate" });
  return cv;
}

// A cherry tree in blossom on row base: a dark trunk under a wide crown of pink lobes, mauve on the
// lower right, white petals picked out on the lit upper left.
export function cherry(cv: Canvas, cx: number, cy: number, r: number, base: number): void {
  cv.fill(cx - 1, cy, 2, base - cy, "dbrown");
  const lobes = [
    [cx - r, cy + 1, r * 0.8],
    [cx + r, cy + 1, r * 0.8],
    [cx, cy - 2, r],
  ] as const;
  for (let px = cx - 2 * r - 1; px < cx + 2 * r + 2; px++) {
    for (let py = cy - 2 * r; py < cy + r + 1; py++) {
      const d = Math.min(
        ...lobes.map(([lx, ly, lr]) => ((px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2) / lr ** 2),
      );
      if (d <= 1) {
        const lit = px - cx + 1.5 * (py - cy);
        const c = lit > r ? "mauve" : lit < -r * 1.2 && hashed(px, py, 3) ? "white" : "pink";
        cv.fill(px, py, 1, 1, c);
      }
    }
  }
}

// The castle playground's wooden towers over the trees, centred on cx and standing on row base: two
// round-topped towers under red cones with pennants, a crenellated wall between them, a lookout door.
export function castle(cv: Canvas, cx: number, base: number): void {
  cv.fill(cx - 10, base - 14, 20, 14, "brown");
  for (let x = cx - 10; x < cx + 10; x += 4) {
    cv.fill(x, base - 16, 2, 2, "brown");
  }
  for (let x = cx - 9; x < cx + 10; x += 3) {
    cv.fill(x, base - 13, 1, 13, "dbrown");
  }
  cv.fill(cx - 2, base - 9, 4, 9, "walnut");
  for (const [tx, h] of [
    [cx - 13, 26],
    [cx + 10, 22],
  ] as const) {
    cv.fill(tx - 3, base - h, 7, h, "tan");
    cv.fill(tx + 2, base - h, 2, h, "brown");
    cv.fill(tx - 1, base - h + 5, 3, 4, "walnut");
    for (let k = 0; k < 7; k++) {
      const step = Math.floor(k / 2);
      cv.fill(tx - 4 + step, base - h - 1 - k, 9 - 2 * step, 1, "red");
    }
    cv.fill(tx - 4, base - h - 1, 9, 1, "dred");
    cv.fill(tx, base - h - 11, 1, 4, "coal");
    cv.fill(tx + 1, base - h - 11, 3, 2, "gold");
  }
}

// A hot dog cart by the zoo gate, side on with its wheels on row base: a stainless box with a
// counter, ketchup and mustard on it, under a red and yellow striped umbrella.
export function hotDogCart(cv: Canvas, cx: number, base: number): void {
  for (let k = 0; k < 4; k++) {
    for (let x = cx - 2 - 2 * k; x < cx + 3 + 2 * k; x++) {
      cv.fill(x, base - 22 + k, 1, 1, Math.floor((x - cx + 9) / 3) % 2 ? "red" : "yellow");
    }
  }
  cv.fill(cx - 9, base - 18, 19, 1, "dred");
  cv.fill(cx, base - 18, 1, 8, "coal");
  cv.fill(cx - 7, base - 10, 15, 7, "lgrey");
  cv.fill(cx + 5, base - 10, 3, 7, "grey");
  cv.fill(cx - 7, base - 10, 15, 1, "white");
  cv.fill(cx - 6, base - 7, 9, 2, "red");
  cv.fill(cx - 5, base - 7, 2, 1, "yellow");
  cv.fill(cx - 5, base - 12, 1, 2, "red");
  cv.fill(cx - 3, base - 12, 1, 2, "yellow");
  for (const x of [cx - 5, cx + 4]) {
    cv.fill(x - 1, base - 3, 3, 3, "coal");
    cv.fill(x, base - 2, 1, 1, "ash");
  }
}

// A far wooded ridge in col: round treetops of radius about r along a rolling crest from row top
// (amp rows lower at its dips), filled down to row bottom.
export function ridge(
  cv: Canvas,
  top: number,
  bottom: number,
  col: string,
  seed: number,
  { amp = 6, r = 4 }: { amp?: number; r?: number } = {},
): void {
  const rnd = stream(`ridge-${seed}`);
  const crest = Array.from(
    { length: W },
    (_, x) =>
      top + amp * (0.5 + 0.5 * Math.sin(x * 0.011 + seed) * Math.cos(x * 0.027 + seed * 2.1)),
  );
  const tops = Array<number>(W).fill(bottom);
  let cx = -r;
  while (cx < W + r) {
    const rr = r + randomPick(rnd, [-1, 0, 0, 1]);
    const cy = crest[Math.min(W - 1, Math.max(0, Math.round(cx)))]! + rr;
    for (let x = Math.max(0, Math.round(cx - rr)); x < Math.min(W, Math.round(cx + rr) + 1); x++) {
      const d = (x + 0.5 - cx) / rr;
      if (Math.abs(d) <= 1) {
        tops[x] = Math.min(tops[x]!, Math.round(cy - rr * Math.sqrt(1 - d * d)));
      }
    }
    cx += rr * 1.5;
  }
  for (let x = 0; x < W; x++) {
    cv.fill(x, tops[x]!, 1, bottom - tops[x]!, col);
  }
}

// A tall black oak of the savannah: a trunk on row base forking under a broad, ragged crown w wide
// of flat-bottomed lobes, its top on row top; hi on the lit upper left, shade on the lower right and
// along each lobe's underside.
export function oak(
  cv: Canvas,
  cx: number,
  top: number,
  w: number,
  base: number,
  seed: number,
  {
    hi = "olive",
    lit = "canopy",
    shade = "pine",
    trunk = "bark",
  }: { hi?: string; lit?: string; shade?: string; trunk?: string } = {},
): void {
  const rnd = stream(`oak-${seed}`);
  const h = Math.round(w * 0.62);
  const lobes: [number, number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const lx = cx + ((i - 2.5) / 2.5) * w * 0.36 + uniform(rnd, -2, 2);
    const ly = top + h * 0.5 + Math.abs(i - 2.5) * h * 0.08 + uniform(rnd, -2, 2);
    const rx = w * uniform(rnd, 0.2, 0.26);
    const ry = h * uniform(rnd, 0.32, 0.4);
    lobes.push([lx, ly, rx, ry]);
  }
  lobes.push([cx + uniform(rnd, -3, 3), top + h * 0.36, w * 0.24, h * 0.36]);
  const under = top + h;
  cv.fill(cx - 2, under - 6, 4, base - under + 6, trunk);
  for (let k = 0; k < 8; k++) {
    cv.fill(cx - 3 - k, under - 2 - k, 2, 2, trunk);
    cv.fill(cx + 2 + k, under - 3 - k, 2, 2, trunk);
  }
  for (let py = top - 2; py < under + 2; py++) {
    for (let px = Math.round(cx - w / 2) - 3; px < Math.round(cx + w / 2) + 4; px++) {
      const inside = lobes.filter(
        ([lx, ly, rx, ry]) =>
          ((px + 0.5 - lx) / rx) ** 2 + ((py + 0.5 - ly) / ry) ** 2 <= 1 && py < ly + ry * 0.6,
      );
      if (inside.length === 0) {
        continue;
      }
      // the highest lobe, the first on a tie
      const [lx, ly, rx, ry] = inside.reduce((best, q) => (q[1] < best[1] ? q : best));
      const u = (px + 0.5 - lx) / rx;
      const v = (py + 0.5 - ly) / ry;
      const c = v > 0.25 || u + v > 0.9 ? shade : u + v < -0.75 && v < -0.2 ? hi : lit;
      cv.fill(px, py, 1, 1, c);
    }
  }
}

// The zoo's animals, side on and facing left, as rows of fills: a bison (walnut forequarters and
// hump, bark hindquarters, a cream horn) and a llama (cream, driftwood on its shaded right and
// underside and its far legs).
export const BISON: readonly string[] = [
  "......wwww..........",
  "....wwwwwwww........",
  "...wwwwwwwwwwbbbbb..",
  "..wwwwwwwwwwwbbbbbbb",
  ".hwwwwwwwwwwwbbbbbbb",
  "hwwwwwwwwwwwwbbbbbbd",
  "wwwwwwwwwwwwwbbbbbbd",
  "wwwww.wwwwwwwbbbbbd.",
  ".www..wwwwwwwddddd..",
  ".ww...ww.ww...dd.dd.",
  "......ww.ww...dd.dd.",
  "......ww.ww...dd.dd.",
];
export const BISON_COLOURS: Readonly<Record<string, string>> = {
  b: "bark",
  d: "walnut",
  h: "cream",
  w: "walnut",
};
export const LLAMA: readonly string[] = [
  ".c.c........",
  ".ccc........",
  "cccc........",
  ".ccs........",
  ".ccs........",
  ".ccs........",
  ".ccs........",
  ".cccccccccc.",
  "cccccccccccs",
  ".ccccccccccs",
  "..ssssssssss",
  "..cs.....cs.",
  "..cs.....cs.",
  "..cs.....cs.",
];
export const LLAMA_COLOURS: Readonly<Record<string, string>> = { c: "cream", s: "driftwood" };

// A figure drawn from rows of characters, its left column on x and its bottom row on row base: each
// character a colour from cols, '.' left clear.
export function figure(
  cv: Canvas,
  x: number,
  base: number,
  rows: readonly string[],
  cols: Readonly<Record<string, string>>,
): void {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        cv.fill(x + i, base - rows.length + j, 1, 1, cols[ch]!);
      }
    });
  });
}

// A split-rail paddock fence on row base, columns x0 to x1 - 1: bark posts h rows tall every every
// columns and at the far end, two tan rails with brown under them.
export function splitRail(
  cv: Canvas,
  x0: number,
  x1: number,
  base: number,
  { every = 10, h = 10 }: { every?: number; h?: number } = {},
): void {
  for (const y of [base - h + 2, base - Math.floor(h / 2) + 1]) {
    cv.fill(x0, y, x1 - x0, 1, "tan");
    cv.fill(x0, y + 1, x1 - x0, 1, "brown");
  }
  const posts: number[] = [];
  for (let x = x0; x < x1 - 1; x += every) {
    posts.push(x);
  }
  for (const x of [...posts, x1 - 2]) {
    cv.fill(x, base - h, 2, h, "bark");
  }
}

// The High Park Zoo's entrance at the trail's end, standing on row BASE + 6: grazed olive paddocks
// behind split rails either side, a bison in the left one and a llama in the right; a closed plank
// double gate, each leaf Z-braced, between two log posts under a log crossbeam with cut ends; and a
// plank sign hung from the beam, HIGH PARK ZOO in cream.
export function zooGate(cv: Canvas): void {
  for (let py = BASE - 12; py < BASE + 6; py++) {
    for (let px = 118; px < 244; px++) {
      cv.fill(px, py, 1, 1, noise(px, py) < 0.04 || noise(px, py - 1) < 0.04 ? "dolive" : "olive");
    }
  }
  splitRail(cv, 118, 244, BASE - 10, { every: 12, h: 7 });
  figure(cv, 126, BASE - 1, BISON, BISON_COLOURS);
  figure(cv, 216, BASE - 1, LLAMA, LLAMA_COLOURS);
  for (const [x0, x1] of [
    [118, CX - 30],
    [CX + 30, 244],
  ] as const) {
    splitRail(cv, x0, x1, BASE + 6);
  }
  for (const gx of [CX - 26, CX]) {
    cv.fill(gx, BASE - 6, 26, 12, "tan");
    for (let k = gx + 3; k < gx + 26; k += 4) {
      cv.fill(k, BASE - 6, 1, 12, "brown");
    }
    cv.fill(gx, BASE - 5, 26, 2, "brown");
    cv.fill(gx, BASE + 2, 26, 2, "brown");
    cv.line(gx + 1, BASE + 2, gx + 24, BASE - 4, "brown");
  }
  cv.fill(CX - 1, BASE - 6, 2, 12, "walnut");
  for (const x of [CX - 31, CX + 27]) {
    cv.fill(x, BASE - 34, 5, 40, "bark");
    cv.fill(x + 4, BASE - 34, 1, 40, "walnut");
    cv.fill(x, BASE - 34, 5, 1, "tan");
  }
  cv.fill(CX - 38, BASE - 38, 76, 4, "bark");
  cv.fill(CX - 38, BASE - 35, 76, 1, "walnut");
  for (const x of [CX - 38, CX + 35]) {
    cv.fill(x, BASE - 38, 3, 4, "tan");
    cv.fill(x + 1, BASE - 37, 1, 2, "skin2");
  }
  for (const x of [CX - 30, CX + 29]) {
    cv.fill(x, BASE - 34, 1, 3, "walnut");
  }
  cv.fill(CX - 41, BASE - 31, 82, 12, "walnut");
  cv.fill(CX - 40, BASE - 30, 80, 10, "brown");
  cv.fill(CX - 40, BASE - 30, 80, 1, "tan");
  word(cv, "HIGH PARK ZOO", CX, BASE - 29, "cream");
}

export function highPark(): Canvas {
  const cv = new Canvas(W, H);
  // a deep clear blue, two white clouds high over the oaks
  sky(cv, {
    clouds: [
      [CX - 70, 30, 46, 8],
      [CX + 62, 22, 40, 6],
    ],
    low: "sky",
    top: "azure",
  });
  // a far wooded ridge, dturq in the haze, then the park's dense canopy over the near hills: dark
  // green rises and a fir tree line
  ridge(cv, BASE - 70, BASE - 40, "dturq", 1.3, { amp: 12, r: 5 });
  hills(cv, BASE - 54, BASE - 18, "pine", "canopy", 0.4, { amp: 8 });
  treeline(cv, BASE - 34, ["fir", "pine"], 0.9, 3, 8);
  // the black oaks of the savannah stand tall over the canopy at the band's edges and by the pond
  for (const [cx, top, w, seed] of [
    [40, BASE - 92, 64, 1],
    [CX + 150, BASE - 86, 58, 2],
    [112, BASE - 72, 36, 3],
  ] as const) {
    oak(cv, cx, top, w, BASE - 26, seed);
  }
  const patches = [
    [60, BASE - 26, 30, 2],
    [CX + 40, BASE - 24, 24, 2],
    [CX - 50, BASE - 12, 26, 3],
    [CX - 24, BASE - 10, 20, 2],
    [CX + 100, BASE - 5, 30, 3],
    [CX + 128, BASE - 2, 18, 3],
    [40, BASE + 6, 24, 2],
  ] as const;

  const lawn: Paint = (px, py) => {
    let c = "pine";
    if (patches.some(([qx, qy, rx, ry]) => ((px - qx) / rx) ** 2 + ((py - qy) / ry) ** 2 <= 1)) {
      c = "canopy";
    }
    return grass(c, 0.03 * (Math.max(0, py - (BASE - 40)) / (H - BASE + 40)) ** 2)(px, py);
  };

  yard(cv, BASE - 33, CROSS, lawn);
  treeline(cv, BASE - 20, ["pine", "canopy"], 2.5, 3, 9);
  // Grenadier Pond on the left, reeds along its near bank, a cherry in blossom over it
  for (let py = BASE - 16; py < BASE - 1; py++) {
    for (let px = 0; px < 118; px++) {
      const e = ((px + 0.5 - 54) / 60) ** 2 + ((py + 0.5 - (BASE - 8)) / 7.5) ** 2;
      if (e <= 1) {
        const c = py < BASE - 13 ? "dlake" : e > 0.4 ? "lake" : "shallow";
        cv.fill(px, py, 1, 1, hashed(Math.floor(px / 2), py, 13) && py % 2 === 0 ? "foam" : c);
      }
    }
  }
  for (let x = 6; x < 110; x += 5) {
    const h = 3 + ((x * 7) % 4);
    cv.fill(x, BASE - 1 - h, 1, h, "olive");
    cv.fill(x + 2, BASE - h, 1, h - 1, "moss");
  }
  for (const [cx, top, r, leaf, shade] of [
    [8, BASE - 30, 10, "pink", "mauve"],
    [118, BASE - 30, 9, "pine", "fir"],
    [CX + 100, BASE - 30, 9, "olive", "dolive"],
    [352, BASE - 28, 9, "pine", "fir"],
  ] as const) {
    tree(cv, cx, top, { base: BASE - 14, girth: 4, leaf, r, shade });
  }
  castle(cv, CX + 112, BASE - 15);
  for (const [cx, r] of [
    [CX - 30, 8],
    [CX + 30, 8],
    [CX + 64, 8],
    [CX + 84, 6],
    [CX + 166, 7],
  ] as const) {
    tree(cv, cx, BASE - 17 - 2 * r - (r < 8 ? 2 : 0), {
      base: BASE - 14 - (r < 8 ? 4 : 0),
      girth: 3,
      leaf: cx % 2 ? "canopy" : "pine",
      r,
      shade: "fir",
    });
  }
  // the cherry trees in blossom along Grenadier Pond's far bank, their petals on the water
  for (const [cx, r] of [
    [34, 6],
    [62, 7],
    [92, 6],
  ] as const) {
    cherry(cv, cx, BASE - 16 - r, r, BASE - 14);
  }
  for (let px = 20; px < 104; px++) {
    for (let py = BASE - 13; py < BASE - 9; py++) {
      if (hashed(px, py, 17) && Math.abs(((px - 20) % 29) - 14) < 9) {
        cv.fill(px, py, 1, 1, "pink");
      }
    }
  }
  for (const [cx, top, r, leaf, shade] of [
    [CX - 80, BASE - 28, 13, "canopy", "pine"],
    [CX + 150, BASE - 30, 14, "canopy", "pine"],
    [-2, BASE - 24, 15, "olive", "dolive"],
  ] as const) {
    tree(cv, cx, top, { base: BASE + 4, leaf, r, shade, trunk: "bark" });
  }
  // the High Park Zoo at the end of the trail, its sign facing the street, lamps either side
  zooGate(cv);
  for (const x of [CX - 66, CX + 66]) {
    cv.fill(x, BASE - 18, 2, 24, "coal");
    cv.fill(x - 4, BASE - 24, 10, 7, "coal");
    cv.fill(x - 2, BASE - 22, 6, 4, "gold");
  }
  hotDogCart(cv, CX + 84, BASE + 3);

  // The trail's packed earth: tan, flecked brown and skin2, skin1 where feet wear it.
  function dirt(px: number, py: number, worn = false): string {
    if (hashed(px, py, 31)) {
      return "brown";
    }
    if (hashed(px, py + 5, 37)) {
      return "skin2";
    }
    return worn ? "skin1" : "tan";
  }

  const trail: RoadPaint = (x, _z, _span, px, py) => {
    const a = Math.abs(x);
    if (a >= ROAD - 5) {
      return "pine";
    }
    if (a >= ROAD - 6) {
      return "brown";
    }
    const lane = ((x + ROAD) % 64) - 32;
    return dirt(px, py, Math.abs(lane) < 5 && noise(Math.floor(px / 3), Math.floor(py / 2)) < 0.7);
  };

  // the trail up to the zoo gate's foot, where it ends, its worn middle drifting, ragged brown edges
  for (let py = BASE + 6; py < CROSS; py++) {
    const half = 18 + Math.floor((py - BASE + 8) / 3) + (hashed(0, py, 3) ? 1 : 0);
    cv.fill(CX - half, py, 2 * half, 1, "brown");
    for (let px = CX - half + 1; px < CX + half - 1; px++) {
      const drift = py % 7 > 3 ? 1 : 0;
      cv.fill(
        px,
        py,
        1,
        1,
        dirt(px, py, Math.abs(px + 0.5 - CX - drift) < 6 + Math.floor((py - BASE) / 4)),
      );
    }
  }
  // the cross path, packed earth with no line painted on it: a skin1 strip worn along its middle,
  // broken where the grass edges hold
  cross(cv, () => "tan", "brown", lawn, { curb: null, top: CROSS });
  for (let px = 0; px < W; px++) {
    if (noise(Math.floor(px / 6), 3) < 0.75) {
      cv.fill(px, LINE - 1, 1, 2, "skin1");
    }
    if (hashed(px, LINE + 2, 9)) {
      cv.fill(px, LINE + 2 + (px % 3 === 0 ? 1 : 0), 1, 1, "skin2");
    }
  }
  // grass tufts break the path's edges
  const brown = rgb("brown").join(",");
  for (let py = CROSS; py < STUB; py++) {
    for (let px = 0; px < W; px++) {
      if (pixelAt(cv, px, py) === brown && hashed(px, py, 4)) {
        cv.fill(px, py, 1, 1, "pine");
      }
    }
  }
  const roughPatches = rough("high-park-lawn", 10, ROAD + 30, ROAD + 460, Z0 + 10, Z0 + 90);
  street(cv, verge("high-park", trail, roughPatches));
  return cv;
}

// A brick warehouse facing the camera, rows top to base: a cornice, arched windows in rows, its
// right side in shade.
export function warehouse(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wall: string,
  trim = "stone",
  glass = "gold",
  { rows = 2 }: { rows?: number } = {},
): void {
  cv.fill(x, top, w, base - top, wall);
  cv.fill(x + w - 3, top, 3, base - top, dk(wall));
  cv.fill(x - 1, top, w + 2, 3, dk(wall));
  cv.fill(x - 1, top + 3, w + 2, 1, trim);
  for (let r = 0; r < rows; r++) {
    const wy = top + 7 + r * 13;
    if (wy + 10 > base - 2) {
      break;
    }
    for (let wx = x + 4; wx < x + w - 8; wx += 10) {
      cv.fill(wx, wy + 1, 6, 9, trim);
      cv.fill(wx + 1, wy, 4, 1, trim);
      cv.fill(wx + 1, wy + 1, 4, 8, glass);
      cv.fill(wx + 1, wy + 1, 4, 1, dk(glass));
      cv.fill(wx + 3, wy + 2, 1, 7, trim);
    }
  }
}

// The Gooderham & Worts chimney stack standing on row BASE: brick stepping in a column a side at 30
// and 62 rows below its top, its right 3 columns in shade, a dbrick cap, a band below it and another
// at the lower step.
export function chimney(cv: Canvas, x: number, top: number, w = 12): void {
  const steps = [
    [top, w - 4],
    [top + 30, w - 2],
    [top + 62, w],
  ] as const;
  steps.forEach(([y0, sw], k) => {
    const y1 = k + 1 < steps.length ? steps[k + 1]![0] : BASE;
    const x0 = x + Math.floor((w - sw) / 2);
    cv.fill(x0, y0, sw, y1 - y0, "brick");
    cv.fill(x0 + sw - 3, y0, 3, y1 - y0, "dbrick");
  });
  cv.fill(x + 1, top - 2, w - 2, 3, "dbrick");
  cv.fill(x + 1, top + 7, w - 2, 1, "dbrick");
  cv.fill(x, top + 62, w, 1, "dbrick");
}

// A rooftop water tower whose feet stand on row low: two dstone legs legs rows tall, X-braced, under
// a bark wooden tank on a walnut ledge and a stepped walnut cap.
export function waterTower(cv: Canvas, tx: number, low: number, legs = 13): void {
  const tank = low - legs;
  for (const lx of [tx - 7, tx + 6]) {
    cv.fill(lx, tank, 2, legs, "dstone");
  }
  cv.line(tx - 6, tank + 2, tx + 6, low - 4, "dstone");
  cv.line(tx + 6, tank + 2, tx - 6, low - 4, "dstone");
  cv.fill(tx - 9, tank - 12, 20, 12, "bark");
  cv.fill(tx + 7, tank - 12, 4, 12, "walnut");
  cv.fill(tx - 10, tank - 1, 22, 1, "walnut");
  for (let k = 0; k < 4; k++) {
    cv.fill(tx - 7 + 2 * k, tank - 13 - k, 16 - 4 * k, 1, "walnut");
  }
}

// A far glass condo tower from row top down to row BASE, dim in the haze: a flat body, its right
// quarter in shade, a 2-row crown, and floor lines every 4 rows a step lighter across the lit part.
export function condo(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  body = "skin2",
  shade = "brown",
  glint = "tan",
): void {
  const sw = Math.max(3, Math.floor(w / 4));
  cv.fill(x, top, w, BASE - top, body);
  cv.fill(x + w - sw, top, sw, BASE - top, shade);
  for (let y = top + 5; y < BASE; y += 4) {
    cv.fill(x + 2, y, w - sw - 4, 1, glint);
  }
  cv.fill(x + 2, top - 2, w - 4, 2, shade);
}

// A sign board centred on column mid from row y: a coal frame round a board of 9 rows, the text in
// sign lettering.
export function signBoard(
  cv: Canvas,
  mid: number,
  y: number,
  text: string,
  board: string,
  letters: string,
): void {
  const w = signWidth(text) + 8;
  const x = Math.round(mid - w / 2);
  cv.fill(x - 1, y - 1, w + 2, 11, "coal");
  cv.fill(x, y, w, 9, board);
  word(cv, text, mid, y + 1, letters);
}

// The chocolate shop's painted bar, as rows of fills: a milk chocolate bar of scored squares in a
// coal outline, its foil peeled back at the right over a red wrapper with a cream band.
export const CHOCOLATE_BAR: readonly string[] = [
  "kkkkkkkkk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kdddddddk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kdddddddkk..",
  "kbbbdbbflk..",
  "kbbbdbffllk.",
  "kbbbdfflllkk",
  "krrrrrrkkk..",
  "kcccccccck..",
  "krrrrrrrk...",
  "krrrrrrrk...",
  "kkkkkkkkk...",
];
export const CHOCOLATE_COLOURS: Readonly<Record<string, string>> = {
  b: "brown",
  c: "cream",
  d: "dbrown",
  f: "lgrey",
  k: "coal",
  l: "white",
  r: "red",
};

// The paintings hung in a gallery's windows: (sky or ground, lower field, a spot of colour).
export type Scheme = readonly [string, string, string];
export const PAINTINGS: readonly Scheme[] = [
  ["azure", "moss", "red"],
  ["mauve", "peach", "gold"],
  ["teal", "lilac", "white"],
  ["ochre", "dturq", "cream"],
];

// A painting in a gold frame shaded ochre on its right and bottom: two fields and a spot of colour.
export function painting(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  scheme: Scheme,
): void {
  const [a, b, c] = scheme;
  cv.fill(x, y, w, h, "gold");
  cv.fill(x + w - 1, y, 1, h, "ochre");
  cv.fill(x, y + h - 1, w, 1, "ochre");
  cv.fill(x + 1, y + 1, w - 2, h - 2, a);
  const upper = Math.floor((h - 2) / 2);
  cv.fill(x + 1, y + 1 + upper, w - 2, h - 2 - upper, b);
  cv.fill(x + 1 + Math.floor((w - 2) / 2), y + 2, 2, 2, c);
}

// A brick warehouse whose ground floor is an art gallery: two tall coal-framed shop windows lit
// skin1, framed paintings hung in them, a GALLERY board over a dturq door between them, the upper
// floor's arched windows above.
export function gallery(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wall = "brick",
): void {
  warehouse(cv, x, w, top, base, wall, "stone", "skin1", { rows: 1 });
  const gy = base - 26;
  cv.fill(x + 2, gy - 1, w - 6, 1, "stone");
  signBoard(cv, x + w / 2, gy - 10, "GALLERY", "walnut", "cream");
  const ww = Math.floor((w - 26) / 2);
  let k = 0;
  for (const wx of [x + 4, x + w - 7 - ww]) {
    cv.fill(wx, gy + 2, ww, 22, "coal");
    cv.fill(wx + 1, gy, ww - 2, 2, "coal");
    cv.fill(wx + 1, gy + 2, ww - 2, 21, "cream");
    cv.fill(wx + 2, gy + 1, ww - 4, 1, "cream");
    for (let px = wx + 3; px < wx + ww - 8; px += 10) {
      painting(cv, px, gy + 6, 7, 9, PAINTINGS[k % PAINTINGS.length]!);
      k += 1;
    }
    cv.fill(wx + 1, gy + 18, ww - 2, 1, "dstone");
  }
  const dx = x + Math.floor(w / 2) - 6;
  cv.fill(dx, base - 18, 9, 18, "coal");
  cv.fill(dx + 1, base - 17, 7, 17, "dturq");
  cv.fill(dx + 4, base - 17, 1, 17, "coal");
}

// The Young Centre, a tank house turned theatre: dark brick with two rows of arched windows, its
// ground floor a glazed lobby lit gold with theatregoers' silhouettes inside, and a marquee over the
// doors, its THEATRE board in gold letters edged with yellow bulbs.
export function theatre(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wall = "dbrick",
): void {
  warehouse(cv, x, w, top, base, wall, "stone", "gold", { rows: 2 });
  const ly = base - 20;
  cv.fill(x + 3, ly, w - 6, 20, "coal");
  cv.fill(x + 4, ly + 1, w - 8, 19, "gold");
  for (let mx = x + 13; mx < x + w - 6; mx += 10) {
    cv.fill(mx, ly + 1, 1, 19, "coal");
  }
  const rnd = stream("theater-lobby");
  for (let px = x + 8; px < x + w - 10; px += 13) {
    const h = randomPick(rnd, [7, 8, 9]);
    cv.fill(px, base - h, 4, h, "dbrown");
    cv.fill(px + 1, base - h - 3, 2, 3, "dbrown");
  }
  const mw = Math.min(w - 10, 70);
  const mx0 = x + Math.floor((w - mw) / 2);
  const my = ly - 12;
  cv.fill(mx0 - 2, my + 10, mw + 4, 3, "coal");
  cv.fill(mx0, my, mw, 10, "coal");
  cv.fill(mx0 + 1, my + 1, mw - 2, 8, "dbrick");
  word(cv, "THEATRE", mx0 + mw / 2, my + 1, "gold");
  for (let bx = mx0; bx < mx0 + mw; bx += 3) {
    cv.fill(bx, my - 1, 1, 1, "yellow");
    cv.fill(bx + 1, my + 10, 1, 1, "yellow");
  }
}

// A café's market umbrella on a cream pole from row base: a canopy of col widening to 21 columns
// over 4 rows, its eave a ramp step darker with a valance dotted in trim, and a finial.
export function cafeUmbrella(
  cv: Canvas,
  cx: number,
  base: number,
  col: string,
  trim: string,
  top = 16,
): void {
  cv.fill(cx, base - top, 1, top, "cream");
  cv.fill(cx, base - top - 6, 1, 2, "cream");
  (
    [
      [-4, 9],
      [-7, 15],
      [-9, 19],
      [-10, 21],
    ] as const
  ).forEach(([dx, w], k) => {
    cv.fill(cx + dx, base - top - 4 + k, w, 1, col);
  });
  cv.fill(cx - 10, base - top, 21, 2, dk(col));
  for (let vx = cx - 10; vx < cx + 11; vx += 4) {
    cv.fill(vx, base - top + 2, 2, 1, trim);
  }
}

// A round bistro table with a red flower and a cream cup, and a chair either side, in coal iron on
// row base.
export function bistroSet(cv: Canvas, cx: number, base: number): void {
  cv.fill(cx - 4, base - 6, 9, 1, "lgrey");
  cv.fill(cx, base - 5, 1, 5, "coal");
  cv.fill(cx - 2, base - 1, 5, 1, "coal");
  for (const [sx, seat] of [
    [cx - 8, cx - 7],
    [cx + 7, cx + 5],
  ] as const) {
    cv.fill(sx, base - 8, 1, 8, "coal");
    cv.fill(seat, base - 4, 2, 1, "coal");
    cv.fill(seat, base - 3, 1, 3, "coal");
  }
  cv.fill(cx - 2, base - 8, 2, 2, "red");
  cv.fill(cx + 1, base - 7, 1, 1, "cream");
}

// A restaurant patio from column x0 to x1 on row base: bistro sets under umbrellas every 26 columns,
// their canopies alternating the two cols, behind a low coal rail with a geranium planter at each
// end.
export function bistroPatio(
  cv: Canvas,
  x0: number,
  x1: number,
  base: number,
  cols: readonly [string, string],
): void {
  for (let k = 0, cx = x0 + 12; cx < x1 - 8; k++, cx += 26) {
    const [col, trim] = k % 2 === 0 ? cols : [cols[1], cols[0]];
    cafeUmbrella(cv, cx, base, col, trim);
    bistroSet(cv, cx, base);
  }
  cv.fill(x0, base - 5, x1 - x0, 1, "coal");
  for (let px = x0; px < x1; px += 4) {
    cv.fill(px, base - 5, 1, 5, "coal");
  }
  for (const px of [x0, x1 - 6]) {
    cv.fill(px, base - 6, 6, 6, "bark");
    cv.fill(px + 4, base - 6, 2, 6, "walnut");
    for (let gx = px; gx < px + 6; gx += 2) {
      cv.fill(gx, base - 8, 2, 2, "canopy");
    }
    cv.fill(px + 2, base - 9, 1, 1, "pink");
  }
}

// Still Dancing's loops of track, from the top: (rows below the cupola, radius, colour, tilt).
export const DANCING_LOOPS: readonly (readonly [number, number, string, number])[] = [
  [6, 9, "red", 0.35],
  [18, 11, "turquoise", -0.3],
  [31, 10, "lilac", 0.25],
  [43, 8, "cream", -0.2],
];

// Still Dancing, Dennis Oppenheim's sculpture in the square, standing on row base: a coal mast on a
// tripod, lit ash on its left, ringed by four tilted loops of coloured track, their far halves a ramp
// step darker behind it, under a gold cupola on row top.
export function stillDancing(cv: Canvas, cx: number, base: number, top: number): void {
  for (const fx of [-10, 0, 10]) {
    cv.line(cx + fx, base, cx, base - 22, "coal");
  }

  function loops(near: boolean): void {
    for (const [dy, r, col, tilt] of DANCING_LOOPS) {
      for (let a = 0; a < 360; a += 2) {
        const t = a * (Math.PI / 180);
        if (Math.sin(t) > 0 !== near) {
          continue;
        }
        const x = cx + r * Math.cos(t);
        const y = top + 4 + dy + r * (0.32 * Math.sin(t) + tilt * Math.cos(t));
        cv.fill(Math.round(x), Math.round(y), 1, 2, near ? col : dk(col));
      }
    }
  }

  loops(false);
  cv.fill(cx - 1, top + 3, 3, base - 25 - top, "coal");
  cv.fill(cx - 1, top + 3, 1, base - 25 - top, "ash");
  loops(true);
  cv.fill(cx - 3, top - 1, 7, 4, "gold");
  cv.fill(cx + 2, top - 1, 2, 4, "ochre");
  cv.fill(cx - 1, top - 3, 3, 2, "gold");
}

// The LOVE sign's heart, beside its letters.
export const LOVE_HEART: readonly string[] = [
  ".##.##.",
  "#######",
  "#######",
  ".#####.",
  "..###..",
  "...#...",
];

// The LOVE sign standing on row base, centred on column cx: a ttc heart and the red letters LOVE on
// a coal rail on two posts, padlocks hung along the rail.
export function loveSign(cv: Canvas, cx: number, base: number): void {
  const w = signWidth("LOVE") + 12;
  const x0 = Math.round(cx - w / 2);
  const top = base - 17;
  cv.fill(x0, top + 9, w, 2, "coal");
  for (const px of [x0 + 1, x0 + w - 3]) {
    cv.fill(px, top + 9, 2, base - top - 9, "coal");
  }
  LOVE_HEART.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        cv.fill(x0 + i, top + 1 + j, 1, 1, "ttc");
      }
    });
  });
  word(cv, "LOVE", x0 + 9 + signWidth("LOVE") / 2, top, "red");
  for (let k = 0, px = x0 + 2; px < x0 + w - 2; k++, px += 3) {
    cv.fill(px, top + 11, 1, 2, ["gold", "lgrey", "amber", "turquoise"][k % 4]!);
  }
}

// Far passers-by on row base, one at each column in spots: 3 columns wide and 10 rows tall, coal
// legs, a top of a mixed colour shaded on its right column, a face and hair.
export function strollers(cv: Canvas, spots: readonly number[], base: number, seed: string): void {
  const rnd = stream(seed);
  for (const x of spots) {
    const top = randomPick(rnd, ["dred", "teal", "cream", "mauve", "navy", "ochre", "forest"]);
    cv.fill(x, base - 3, 1, 3, "coal");
    cv.fill(x + 2, base - 3, 1, 3, "coal");
    cv.fill(x, base - 7, 3, 4, top);
    cv.fill(x + 2, base - 7, 1, 4, dk(top));
    cv.fill(x, base - 9, 3, 2, randomPick(rnd, ["skin1", "skin2", "brown"]));
    cv.fill(x, base - 10, 3, 1, randomPick(rnd, ["walnut", "dbrown", "ochre", "coal"]));
  }
}

// The golden-hour sky's bands, from the top, down to the square's roof.
export const DISTILLERY_SKY: readonly string[] = ["peach", "orange", "amber"];

export function distillery(): Canvas {
  const cv = new Canvas(W, H);
  // Trinity Square at golden hour: bands of peach, orange and amber, the striped sun low over the
  // square's far side, gulls
  sunset(cv, DISTILLERY_SKY, BASE - 36);
  sun(cv, CX + 4, BASE - 49, 12, "yellow", BASE - 37);
  // glass condo towers rising behind the old brick either side of the sun, the chimney stack, and
  // the water tower on the right warehouse's roof
  for (const [x, w, top] of [
    [132, 22, 22],
    [206, 26, 10],
    [236, 18, 32],
  ] as const) {
    condo(cv, x, w, top);
  }
  birds(cv, [
    [30, BASE - 64],
    [84, BASE - 60],
    [290, BASE - 76],
  ]);
  chimney(cv, CX - 121, 12);
  waterTower(cv, CX + 142, BASE - 46);
  // round the square: the gallery and an old limestone mill on the left, the chocolate shop in the
  // long low warehouse across it, its CHOCOLATE sign and a painted bar beside it, the theatre and
  // another warehouse on the right
  gallery(cv, -10, 80, BASE - 44, BASE);
  warehouse(cv, 70, 56, BASE - 36, BASE, "driftwood", "dstone");
  warehouse(cv, CX - 54, 108, BASE - 36, BASE, "brick", "stone", "gold", { rows: 0 });
  signBoard(cv, CX, BASE - 30, "CHOCOLATE", "dbrick", "cream");
  figure(cv, CX + 38, BASE - 14, CHOCOLATE_BAR, CHOCOLATE_COLOURS);
  theatre(cv, CX + 54, 80, BASE - 50, BASE);
  warehouse(cv, CX + 134, 56, BASE - 46, BASE, "brick", "stone", "gold", { rows: 3 });

  // the square's paving, café tables under umbrellas, Still Dancing, the LOVE sign, lamps and
  // passers-by
  const paving: Paint = (px, py) => (hashed(px, py, 19) ? "brick" : "brown");

  yard(cv, BASE, FAR_WALK, paving);
  bistroPatio(cv, CX - 50, CX + 46, FAR_WALK - 1, ["cream", "forest"]);
  stillDancing(cv, CX - 72, FAR_WALK - 1, CALM + 4);
  loveSign(cv, 104, FAR_WALK - 1);
  for (const x of [8, CX + 60, CX + 132]) {
    gasLamp(cv, x, FAR_WALK - 1);
  }
  strollers(cv, [40, 52, CX + 70, CX + 100, CX + 110, 330], FAR_WALK - 1, "distillery");

  const road: RoadPaint = (x, z, span, px, py) => {
    const a = Math.abs(x);
    if (a >= ROAD - 4) {
      return "brick";
    }
    if (span < 6 && crosses(z, span, 8)) {
      return "navy";
    }
    return hashed(px, py, 31) ? "slate" : "dslate";
  };

  // the lane across is cobbled and car-free: dslate setts between brick gutters, with no curbs and
  // no centre line
  cross(cv, () => "dslate", "brick", paving, { curb: null });
  street(cv, verge("distillery-district", road));
  lanes(cv, "lgrey", { dash: [22, 64], edge: "stone" });
  return cv;
}

// Worn paint: each Kensington wall a darker, greyer tone of its colour, none green; roofs dark;
// awnings sun-faded, their stripes stone.
export const WORN_WALL: Readonly<Record<string, string>> = {
  dturq: "teal",
  mauve: "dbrick",
  ochre: "clay",
  olive: "brick",
  violet: "purple",
};
export const WORN_ROOF: Readonly<Record<string, string>> = {
  dbrick: "bark",
  dolive: "bark",
  navy: "shale",
  plum: "walnut",
};
export const FADED: ReadonlyMap<string, string> = new Map([
  ["dred", "brick"],
  ["dturq", "slate"],
  ["lake", "slate"],
  ["ochre", "clay"],
  ["red", "brick"],
]);

// n soot streaks 2px wide running down from row y, each 3 to 8 rows long, between columns x0 and x1.
export function streaks(
  cv: Canvas,
  x0: number,
  x1: number,
  y: number,
  col: string,
  seed: string,
  n: number,
): void {
  const rnd = stream(seed);
  for (let i = 0; i < n; i++) {
    const x = randomInt(rnd, x0, x1 - 2);
    cv.fill(x, y, 2, randomInt(rnd, 3, 9), col);
  }
}

// A throw-up: two bubble letters in one fill inside a 1px coal outline, a 2x2 counter in each, so
// every mark is 2px or more.
export const THROWUP: readonly string[] = [
  ".xxxx.xxxx.",
  "xoooxxooox.",
  "xoxxoxoxxox",
  "xoxxoxoxxox",
  "xoooxxooox.",
  ".xxxx.xxxx.",
];

// A throw-up with its top left at x, y, mirrored with flip.
export function throwUp(cv: Canvas, x: number, y: number, fill: string, flip = false): void {
  THROWUP.forEach((row, j) => {
    const chars = [...row];
    (flip ? chars.reverse() : chars).forEach((ch, i) => {
      if (ch !== ".") {
        cv.fill(x + i, y + j, 1, 1, ch === "x" ? "coal" : fill);
      }
    });
  });
}

// A worn two-storey Victorian over a shopfront, standing on BASE: a shallow gable with a round attic
// vent, two tall sashes in stone trim upstairs (lamplight in the left), the shopfront below under a
// faded awning, soot streaks down the wall and a dirty band along its foot; tag, a colour, sprays a
// throw-up between the sashes. Its paint is worn (WORN_WALL, WORN_ROOF, FADED).
export function victorian(
  cv: Canvas,
  cx: number,
  w: number,
  wall: string,
  roof: string,
  awn: string,
  signText: string,
  board: string,
  letters: string,
  tag?: string,
): void {
  const wallC = WORN_WALL[wall]!;
  const roofC = WORN_ROOF[roof]!;
  const x = cx - Math.floor(w / 2);
  const top = BASE - 66;
  const roofH = 11;
  const half = w / 2 + 2;
  for (let i = 0; i < roofH; i++) {
    const inset = Math.round((i * half) / roofH);
    cv.fill(x - 2 + (Math.floor(w / 2) + 2) - inset, top + i, inset * 2, 1, roofC);
  }
  cv.fill(x - 2, top + roofH - 1, w + 4, 2, dk(roofC));
  const wallY = top + roofH + 1;
  cv.fill(x, wallY, w, BASE - wallY, wallC);
  cv.fill(x + w - 3, wallY, 3, BASE - wallY, dk(wallC));
  cv.fill(x + Math.floor(w / 2) - 2, top + 4, 4, 4, "stone");
  cv.fill(x + Math.floor(w / 2) - 1, top + 5, 2, 2, "coal");
  [x + 7, x + w - 17].forEach((wx, k) => {
    cv.fill(wx - 1, wallY + 3, 12, 15, "stone");
    cv.fill(wx, wallY + 4, 10, 13, k ? "dlake" : "ochre");
    cv.fill(wx, wallY + 10, 10, 1, "stone");
    cv.fill(wx + 4, wallY + 4, 2, 13, "stone");
    cv.fill(wx - 2, wallY + 18, 14, 2, "dstone");
  });
  shopfront(cv, x, w, BASE - 33, BASE, wallC, FADED.get(awn) ?? awn, signText, board, letters, {
    glass: "dlake",
    stripe: "stone",
  });
  if (tag) {
    throwUp(cv, x + Math.floor(w / 2) - 5, wallY + 12, tag, cx > CX);
  }
  streaks(cv, x + 2, x + w - 3, wallY + 20, dk(wallC), `victorian-${cx}`, 3);
  cv.fill(x + 1, BASE - 2, w - 2, 2, dk(wallC));
}

export type Point = readonly [x: number, y: number];

// A wooden hydro pole 2 wide from the far sidewalk up to just under CALM, a crossarm near its top.
// Returns the crossarm's left and right ends, where the wires hang.
export function hydroPole(cv: Canvas, x: number): [Point, Point] {
  cv.fill(x, CALM + 3, 2, FAR_WALK - CALM - 4, "bark");
  cv.fill(x - 4, CALM + 6, 10, 2, "walnut");
  return [
    [x - 3, CALM + 8],
    [x + 4, CALM + 8],
  ];
}

// A hydro wire 2 rows thick from a to b, sagging sag rows in the middle.
export function wire(cv: Canvas, a: Point, b: Point, sag: number): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  for (let x = x0; x < x1 + 1; x++) {
    const t = (x - x0) / Math.max(1, x1 - x0);
    cv.fill(x, Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), 1, 2, "walnut");
  }
}

// Empty produce crates stacked n high on row base, each offset a column: clay with bark slats and
// ends.
export function crateStack(cv: Canvas, x: number, base: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const y = base - 5 * (k + 1);
    cv.fill(x + (k % 2), y, 12, 5, "clay");
    cv.fill(x + (k % 2), y, 12, 1, "bark");
    cv.fill(x + (k % 2), y + 2, 12, 1, "bark");
    cv.fill(x + 11 + (k % 2), y, 1, 5, "bark");
  }
}

// A laneway wall 16 wide, rows top to base, painted with a mural: diagonal bands of MURAL's paint a
// ramp step darker, so the walls at the band's edges sit behind the shopfronts, under a walnut
// coping, a dog's face looking out of them, the paint stopping short of the ground.
export function mural(cv: Canvas, x0: number, top: number, base: number, flip: boolean): void {
  for (let py = top; py < base; py++) {
    for (let px = x0; px < x0 + 16; px++) {
      const u = flip ? x0 + 15 - px : px - x0;
      const c = py < base - 4 ? dk(MURAL[Math.floor((u + py) / 5) % MURAL.length]!) : "coal";
      cv.fill(px, py, 1, 1, c);
    }
  }
  cv.fill(x0, top, 16, 2, "walnut");
  const fy = top + 34;
  for (let dy = -6; dy < 7; dy++) {
    for (let dx = -6; dx < 7; dx++) {
      if ((dx / 6.5) ** 2 + (dy / 6) ** 2 <= 1) {
        cv.fill(x0 + 8 + dx, fy + dy, 1, 1, "cream");
      }
    }
  }
  for (const dx of [-6, 4]) {
    cv.fill(x0 + 8 + dx, fy - 7, 3, 7, "brown");
  }
  for (const dx of [-3, 2]) {
    cv.fill(x0 + 8 + dx, fy - 2, 2, 2, "coal");
  }
  cv.fill(x0 + 7, fy + 2, 3, 2, "coal");
  cv.fill(x0 + 8, fy + 5, 1, 2, "ttc");
}

// A 1px circle of radius r round cx, cy.
export function ring(cv: Canvas, cx: number, cy: number, r: number, col: string): void {
  for (let a = 0; a < 360; a += 6) {
    const t = a * (Math.PI / 180);
    cv.fill(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), 1, 1, col);
  }
}

// A bicycle side on, 15 wide and 9 tall, its wheels on row base: coal tires round ash hubs, a
// diamond frame, a saddle, and the handlebars at the front (right, or left when flipped).
export function bike(cv: Canvas, x: number, base: number, frame = "red", flip = false): void {
  const atX = (dx: number): number => x + (flip ? 14 - dx : dx);

  for (const wx of [2, 12]) {
    ring(cv, atX(wx), base - 3, 3, "coal");
    cv.fill(atX(wx), base - 3, 1, 1, "ash");
  }
  for (const [[x0, y0], [x1, y1]] of [
    [
      [2, 3],
      [6, 7],
    ],
    [
      [6, 7],
      [11, 7],
    ],
    [
      [6, 7],
      [7, 3],
    ],
    [
      [7, 3],
      [2, 3],
    ],
    [
      [7, 3],
      [11, 7],
    ],
    [
      [11, 7],
      [12, 3],
    ],
  ] as const) {
    cv.line(atX(x0), base - y0, atX(x1), base - y1, frame);
  }
  cv.fill(Math.min(atX(4), atX(7)), base - 9, 4, 1, "coal");
  cv.fill(atX(6), base - 8, 1, 1, "coal");
  cv.fill(atX(11), base - 9, 1, 2, "coal");
  cv.fill(Math.min(atX(10), atX(13)), base - 9, 3, 1, "coal");
}

export const GARMENTS: readonly string[] = [
  "red",
  "dturq",
  "gold",
  "lilac",
  "pink",
  "moss",
  "orange",
  "cream",
];

// A vintage clothes rail out front, w wide: two coal posts and a rail 14 rows up, hung with shirts
// and dresses in GARMENTS from the first, each 3 wide on a hanger, every third a dress flaring at the
// hem, its right column in shade.
export function clothesRack(cv: Canvas, x: number, w: number, base: number, first = 0): void {
  const top = base - 14;
  cv.fill(x, top, 1, 14, "coal");
  cv.fill(x + w - 1, top, 1, 14, "coal");
  cv.fill(x, top, w, 1, "coal");
  for (let k = first, gx = x + 2; gx < x + w - 4; k++, gx += 4) {
    const c = GARMENTS[k % GARMENTS.length]!;
    const n = k % 3 === 1 ? 9 : 6;
    cv.fill(gx + 1, top + 1, 1, 1, "ash");
    cv.fill(gx, top + 2, 3, n, c);
    cv.fill(gx + 2, top + 2, 1, n, dk(c));
    if (k % 3 === 1) {
      cv.fill(gx - 1, top + n, 5, 2, c);
      cv.fill(gx + 3, top + n, 1, 2, dk(c));
    }
  }
}

// A busker's pitch with no one at it, on row base: an amp and a guitar leaning on it beside its open
// case, below the shop's sign board.
export function busker(cv: Canvas, x: number, base: number): void {
  cv.fill(x, base - 8, 8, 8, "coal");
  cv.fill(x + 1, base - 7, 6, 5, "ash");
  cv.fill(x + 3, base - 5, 2, 2, "coal");
  cv.fill(x + 1, base - 9, 6, 1, "coal");
  const gx = x + 10;
  for (let dy = -3; dy < 4; dy++) {
    for (let dx = -3; dx < 4; dx++) {
      if ((dx / 3.4) ** 2 + (dy / 3.4) ** 2 <= 1) {
        cv.fill(gx + dx, base - 4 + dy, 1, 1, dx + dy < 2 ? "ochre" : "brown");
      }
    }
  }
  cv.fill(gx, base - 4, 1, 1, "walnut");
  cv.line(gx, base - 7, gx - 2, base - 17, "walnut");
  cv.fill(gx - 3, base - 18, 2, 2, "walnut");
  cv.fill(x + 15, base - 3, 12, 3, "walnut");
  cv.fill(x + 16, base - 2, 10, 1, "dred");
}

// A cafe table under an umbrella striped a and b, a chair each side, on row base.
export function patio(cv: Canvas, cx: number, base: number, a: string, b: string): void {
  umbrella(cv, cx, base, a, b);
  cv.fill(cx - 4, base - 5, 9, 1, "walnut");
  cv.fill(cx, base - 4, 1, 4, "walnut");
  for (const sx of [cx - 7, cx + 6]) {
    cv.fill(sx, base - 4, 2, 1, "walnut");
    cv.fill(sx, base - 3, 2, 3, "walnut");
  }
}

// Kensington Market's road and paving, as its road strip (roads.ts) and its verge (VERGES) paint
// them.
export const KENSINGTON_ROAD = "stone";
export const KENSINGTON_GUTTER = "dstone";

export function kensington(): Canvas {
  const cv = new Canvas(W, H);
  // a Pedestrian Sunday at twilight: a sunburst of purple rays from the end of the street, flat
  // violet beyond its arc
  sunburst(cv, CX, BASE + 6, 7, "purple", "violet", FAR_WALK, { r: [W * 0.65, BASE + 6 - CALM] });
  // rooftops of the back lanes behind the houses
  roofline(
    cv,
    BASE - 34,
    [
      [24, 18, 10],
      [76, 16, 8],
      [228, 18, 9],
      [300, 16, 10],
    ],
    "walnut",
  );
  // a worn row of two-storey Victorians turned shops across the street, throw-ups on two of them
  for (const [cx, w, wallC, roof, awn, signText, board, letters, tag] of [
    [47, 56, "dturq", "navy", "dred", "FRUIT", "forest", "gold", "white"],
    [CX - 69, 60, "violet", "plum", "ochre", "RECORDS", "navy", "gold", undefined],
    [CX, 68, "ochre", "dbrick", "dturq", "VINTAGE", "purple", "cream", undefined],
    [CX + 69, 60, "olive", "dolive", "red", "CHEESE", "dbrick", "gold", "lime"],
    [313, 56, "mauve", "plum", "lake", "TACOS", "coal", "cream", undefined],
  ] as const) {
    victorian(cv, cx, w, wallC, roof, awn, signText, board, letters, tag);
  }
  // hydro poles in the gaps between the houses, two wires sagging across the band over the roofs
  const ends: [Point, Point][] = [
    [
      [-2, CALM + 10],
      [-2, CALM + 10],
    ],
    ...[78, 216].map((x) => hydroPole(cv, x)),
    [
      [W + 2, CALM + 10],
      [W + 2, CALM + 10],
    ],
  ];
  for (let i = 0; i + 1 < ends.length; i++) {
    const a = ends[i]![1];
    const b = ends[i + 1]![0];
    wire(cv, a, b, 5);
    wire(cv, [a[0], a[1] + 4], [b[0], b[1] + 4], 6);
  }

  const paving = vergePaving("kensington-market");
  yard(cv, BASE, FAR_WALK, paving);
  // out front: empty crates, two vintage rails, a busker's pitch, a bike and a patio
  crateStack(cv, 3, FAR_WALK - 1, 3);
  crateStack(cv, 17, FAR_WALK - 1, 2);
  clothesRack(cv, 56, 22, FAR_WALK - 1, 1);
  crateStack(cv, 82, FAR_WALK - 1, 3);
  clothesRack(cv, CX - 28, 22, FAR_WALK - 1, 5);
  busker(cv, CX + 6, FAR_WALK - 1);
  bike(cv, CX + 40, FAR_WALK - 1, "lilac");
  crateStack(cv, CX + 60, FAR_WALK - 1, 2);
  patio(cv, CX + 96, FAR_WALK - 1, "red", "cream");
  // the laneway walls at both ends of the street, painted with murals and tagged at their feet
  for (const x0 of [0, W - 16]) {
    mural(cv, x0, BASE - 66, FAR_WALK, x0 > 0);
    throwUp(cv, x0 + 3, FAR_WALK - 11, x0 ? "lime" : "pink", x0 > 0);
  }

  const road: RoadPaint = (x, z, span) => {
    const a = Math.abs(x);
    if (a >= ROAD - 4) {
      return KENSINGTON_GUTTER;
    }
    if (a >= ROAD - 5) {
      return "coal";
    }
    if (span < 4 && crosses(z, span, 32)) {
      return KENSINGTON_GUTTER;
    }
    return KENSINGTON_ROAD;
  };

  cross(cv, flat(road), KENSINGTON_GUTTER, paving, {
    curb: VERGES["kensington-market"]!.curbColour,
  });
  crossLine(cv, "plum", { dash: [12, 64] });
  street(cv, verge("kensington-market", road));
  lanes(cv, LANE_PAINT, { dash: [10, 32], edge: LANE_PAINT.map((c) => dk(c)) });
  return cv;
}

// A white clapboard lifeguard station with a red hipped roof and a lookout, on stilts, on row base.
export function leuty(cv: Canvas, cx: number, base: number): void {
  for (const x of [cx - 9, cx + 7]) {
    cv.fill(x, base - 8, 2, 8, "driftwood");
  }
  cv.fill(cx - 11, base - 22, 22, 14, "white");
  cv.fill(cx + 8, base - 22, 3, 14, "lgrey");
  for (let y = base - 20; y < base - 8; y += 3) {
    cv.fill(cx - 11, y, 22, 1, "lgrey");
  }
  cv.fill(cx - 4, base - 18, 8, 6, "dlake");
  cv.fill(cx - 3, base - 17, 6, 4, "foam");
  for (let k = 0; k < 6; k++) {
    cv.fill(cx - 13 + k, base - 23 - k, 26 - 2 * k, 1, "ttc");
  }
  cv.fill(cx - 4, base - 34, 8, 6, "white");
  cv.fill(cx - 3, base - 33, 6, 3, "dlake");
  for (let k = 0; k < 3; k++) {
    cv.fill(cx - 5 + k, base - 35 - k, 10 - 2 * k, 1, "ttc");
  }
  cv.fill(cx, base - 41, 1, 4, "coal");
  cv.fill(cx + 1, base - 41, 3, 2, "ttc");
}

// A striped beach umbrella on row base.
export function umbrella(cv: Canvas, cx: number, base: number, a: string, b: string): void {
  cv.fill(cx, base - 12, 1, 12, "driftwood");
  for (let k = 0; k < 5; k++) {
    for (let x = cx - 8 + k; x < cx + 9 - k; x++) {
      const stripe = Math.floor((x - cx) / 3);
      cv.fill(x, base - 13 - k, 1, 1, ((stripe % 2) + 2) % 2 ? a : b);
    }
  }
}

// The R.C. Harris Water Treatment Plant on its lawn at the east end of the beach, standing on row
// base: buff brick Art Deco halls under hipped copper roofs, the grand middle hall raised high over
// its wings, tall arched windows under a tan string course, a stone plinth and the main doors in a
// stone surround.
export function rcHarris(cv: Canvas, x0: number, base: number): void {
  cv.fill(x0 - 8, base - 1, W - x0 + 8, 4, "moss");
  cv.fill(x0 - 8, base + 2, W - x0 + 8, 1, "olive");
  for (const [x, w, wallH, roofH] of [
    [x0, 18, 16, 5],
    [x0 + 18, 34, 30, 8],
    [x0 + 52, 20, 16, 5],
  ] as const) {
    const top = base - wallH;
    cv.fill(x, top, w, wallH, "cream");
    cv.fill(x + w - 2, top, 2, wallH, "tan");
    cv.fill(x, base - 2, w, 2, "stone");
    for (let k = 0; k < roofH; k++) {
      cv.fill(x - 1 + k, top - 1 - k, w + 2 - 2 * k, 1, k ? "turquoise" : "dturq");
    }
    cv.fill(x - 1 + roofH - 1, top - roofH, 2, 1, "foam");
    for (let wx = x + 3; wx < x + w - 4; wx += 4) {
      cv.fill(wx, top + 4, 2, wallH - 8, "dlake");
      cv.fill(wx, top + 4, 2, 1, "cream");
      cv.fill(wx, top + 5, 1, 1, "foam");
    }
    cv.fill(x, top + 1, w - 2, 1, "tan");
  }
  const door = x0 + 33;
  cv.fill(door - 1, base - 12, 6, 10, "walnut");
  cv.fill(door - 3, base - 13, 10, 1, "stone");
  cv.fill(door - 3, base - 13, 1, 11, "stone");
  cv.fill(door + 6, base - 13, 1, 11, "stone");
}

// A broad shade tree, a maple or an oak, on row base: a trunk under a crown of five round lobes about
// row cy, shade on the lower right and lit flecks on the upper left.
export function shadeTree(
  cv: Canvas,
  cx: number,
  cy: number,
  r: number,
  base: number,
  leaf: string,
  shade: string,
  lit: string,
  { girth = 4, trunk = "dbrown" }: { girth?: number; trunk?: string } = {},
): void {
  cv.fill(cx - Math.floor(girth / 2), cy, girth, base - cy, trunk);
  cv.fill(cx + Math.floor(girth / 2) - 1, cy, 1, base - cy, dk(trunk));
  const lobes = [
    [cx - r * 0.8, cy + r * 0.25, r * 0.7],
    [cx + r * 0.8, cy + r * 0.25, r * 0.7],
    [cx - r * 0.3, cy - r * 0.45, r * 0.75],
    [cx + r * 0.35, cy - r * 0.35, r * 0.7],
    [cx, cy + r * 0.1, r * 0.8],
  ] as const;
  for (let px = Math.trunc(cx - 2 * r); px < Math.trunc(cx + 2 * r + 1); px++) {
    for (let py = Math.trunc(cy - 2 * r); py < Math.trunc(cy + r + 1); py++) {
      const d = Math.min(
        ...lobes.map(([lx, ly, lr]) => ((px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2) / lr ** 2),
      );
      if (d <= 1) {
        const t = px - cx + 1.4 * (py - cy);
        const c = t > r * 0.55 ? shade : t < -r && hashed(px, py, 2) ? lit : leaf;
        cv.fill(px, py, 1, 1, c);
      }
    }
  }
}

// A weeping willow on row base: a round crown on row cy whose streamers flare 2 columns past it and
// hang to ragged tips above the ground; olive, moss on the lit left, dolive on the right and in the
// gaps between streamers, lime along the crown's lit top.
export function willow(
  cv: Canvas,
  cx: number,
  cy: number,
  r: number,
  base: number,
  trunk = "dbrown",
): void {
  cv.fill(cx - 2, cy, 4, base - cy, trunk);
  cv.fill(cx + 1, cy, 1, base - cy, dk(trunk));
  for (let px = cx - r - 2; px < cx + r + 3; px++) {
    const dx = (px + 0.5 - cx) / r;
    const out = Math.abs(px - cx) - r;
    const top =
      out > 0
        ? cy + 2 * out + 1
        : cy - Math.round(r * 0.75 * Math.sqrt(Math.max(0.0, 1 - dx * dx)));
    const hem =
      base - 5 - Math.round(7 * dx * dx) - (px % 2 ? 4 : 0) - Math.round(3 * noise(px, 7));
    for (let py = top; py < hem; py++) {
      const gap = py > cy + 2 && px % 3 === 2;
      const c = gap || dx > 0.6 ? "dolive" : dx + (py - cy) / (2 * r) < -0.35 ? "moss" : "olive";
      cv.fill(px, py, 1, 1, py === top && dx < 0.3 && out <= 0 ? "lime" : c);
    }
  }
}

// Beach volleyball players side on, facing right: rows from the top down to the feet, h hair, s
// skin, t swimsuit. block and spike are jumps, drawn in the air.
export const PLAYER: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "block",
    [
      "...s.s",
      "...s.s",
      "..hhss",
      "..hss.",
      "..ttt.",
      "..tt..",
      "..tt..",
      "..tt..",
      "..s.s.",
      "..s.s.",
      ".s..s.",
    ],
  ],
  ["dig", ["..hh..", "..hs..", ".ttt..", ".tttss", ".ttt.s", ".s..s.", "s...s."]],
  [
    "ready",
    [
      "..hh..",
      "..hs..",
      "..ss..",
      ".ttt..",
      ".ttts.",
      ".ttt.s",
      ".ttt..",
      ".s..s.",
      ".s..s.",
      "s...s.",
    ],
  ],
  [
    "spike",
    [
      ".....s",
      "....s.",
      "..hhs.",
      "..hs..",
      ".ttt..",
      "sttt..",
      "..tt..",
      "..tt..",
      ".s..s.",
      "s...s.",
      "s.....",
    ],
  ],
]);

// A beach volleyball player (PLAYER) from column x, feet on row base, or lift rows above it in a
// jump; flip faces left.
export function player(
  cv: Canvas,
  x: number,
  base: number,
  pose: string,
  hair: string,
  skin: string,
  suit: string,
  { flip = false, lift = 0 }: { flip?: boolean; lift?: number } = {},
): void {
  const rows = PLAYER.get(pose)!;
  const w = rows[0]!.length;
  const cols: Readonly<Record<string, string>> = { h: hair, s: skin, t: suit };
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== ".") {
        cv.fill(x + (flip ? w - 1 - dx : dx), base - lift - rows.length + 1 + dy, 1, 1, cols[ch]!);
      }
    });
  });
}

// A volleyball net seen end on, running away from the camera between posts at near and far, (column,
// ground row): white posts, the far one lgrey and a row shorter, and between their tops a white tape
// over deep rows of coal mesh, its bottom cord coal.
export function net(
  cv: Canvas,
  near: Point,
  far: Point,
  { deep = 4, top = 13 }: { deep?: number; top?: number } = {},
): void {
  const [x0, g0] = near;
  const [x1, g1] = far;
  cv.fill(x1, g1 - top + 1, 1, top, "lgrey");
  for (let i = 0; i < x1 - x0 + 1; i++) {
    const x = x0 + i;
    const t = Math.round(g0 - top + ((g1 - g0 + 1) * i) / (x1 - x0));
    cv.fill(x, t, 1, 1, "white");
    for (let y = t + 1; y < t + deep; y++) {
      if ((x + y) % 2 === 0) {
        cv.fill(x, y, 1, 1, "coal");
      }
    }
    cv.fill(x, t + deep, 1, 1, "coal");
  }
  cv.fill(x0, g0 - top, 1, top + 1, "white");
}

// A beach volleyball game mid-rally, two against two, on a court roped in lake blue whose near left
// corner is column x on row base: the net runs away from the camera across the court's middle, a red
// player digs at the back and a red player jumps to block as a blue player leaps to spike the ball
// over the net, the blue partner ready behind.
export function volleyball(cv: Canvas, x: number, base: number): void {
  cv.fill(x, base, 80, 1, "lake");
  cv.fill(x + 12, base - 8, 74, 1, "lake");
  cv.line(x, base, x + 12, base - 8, "lake");
  cv.line(x + 79, base, x + 85, base - 8, "lake");
  player(cv, x + 14, base - 4, "dig", "dbrown", "brown", "ttc");
  player(cv, x + 51, base - 6, "spike", "walnut", "clay", "cobalt", { flip: true, lift: 5 });
  net(cv, [x + 38, base], [x + 50, base - 8]);
  player(cv, x + 29, base - 2, "block", "gold", "skin2", "ttc", { lift: 3 });
  player(cv, x + 67, base - 2, "ready", "plum", "skin2", "cobalt", { flip: true });
  // the ball: a white plus shaded lgrey on its lower right, never yellow, so it reads as a ball and
  // not a sparkle
  cv.fill(x + 45, base - 25, 3, 1, "white");
  cv.fill(x + 46, base - 26, 1, 3, "white");
  cv.fill(x + 47, base - 25, 1, 1, "lgrey");
  cv.fill(x + 46, base - 24, 1, 1, "lgrey");
}

export function beaches(): Canvas {
  const cv = new Canvas(W, H);
  // a warm yellow late afternoon over the lake: two high summer cumulus in the gold, small clouds
  // low over the water, and gulls
  sky(cv, {
    clouds: [
      [58, BASE - 58, 26, 4],
      [CX + 70, BASE - 60, 30, 4],
    ],
    low: "yellow",
    top: "gold",
  });
  cloud(cv, 86, 34, 64, 11, 11);
  cloud(cv, 232, 22, 40, 7, 12);
  birds(cv, [
    [100, BASE - 50],
    [112, BASE - 46],
    [232, BASE - 52],
  ]);
  // Lake Ontario out to the horizon: dark far water, then lake and shallows, foam lines, sails
  for (let py = BASE - 40; py < BASE - 12; py++) {
    for (let px = 0; px < W; px++) {
      let c = py < BASE - 34 ? "dlake" : py < BASE - 22 ? "lake" : "shallow";
      if (hashed(Math.floor(px / 3), py, 9) && py % 3 === 0) {
        c = c === "lake" ? "shallow" : c === "shallow" ? "foam" : "lake";
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
  cv.fill(0, BASE - 41, W, 1, "lake");
  for (const [sx, sy] of [
    [CX - 96, BASE - 36],
    [CX + 40, BASE - 38],
    [CX + 2, BASE - 30],
  ] as const) {
    cv.fill(sx - 4, sy + 6, 10, 2, "white");
    for (let k = 0; k < 8; k++) {
      cv.fill(sx, sy - 2 + k, 1 + Math.floor(k / 2), 1, "white");
    }
    cv.fill(sx - 1, sy - 3, 1, 9, "coal");
  }
  for (let py = BASE - 12; py < BASE; py++) {
    cv.fill(0, py, W, 1, py === BASE - 12 ? "foam" : "driftwood");
  }
  for (let px = 0; px < W; px++) {
    if (hashed(px, BASE - 11, 5)) {
      cv.fill(px, BASE - 11, 1, 1, "foam");
    }
  }
  // tall shade trees that frame the lake: two in Kew-Balmy Beach park behind the plant, the nearer
  // one in olive so it sits back, and a maple and a willow by the boardwalk at the west end, their
  // crowns rising under the message strip
  shadeTree(cv, 352, BASE - 70, 16, BASE - 10, "canopy", "pine", "green");
  shadeTree(cv, 318, BASE - 62, 13, BASE - 10, "olive", "dolive", "moss");
  leuty(cv, CX + 96, BASE - 2);
  rcHarris(cv, CX + 114, BASE - 9);
  shadeTree(cv, 8, BASE - 66, 22, BASE, "green", "dgreen", "lime", { girth: 6 });
  willow(cv, 50, BASE - 36, 17, BASE);
  for (const [cx, a, b] of [
    [CX - 100, "ttc", "white"],
    [CX + 30, "gold", "dlake"],
  ] as const) {
    umbrella(cv, cx, BASE - 1, a, b);
  }
  volleyball(cv, CX - 82, BASE - 1);

  const sand: Paint = (px, py) =>
    hashed(px, py, 43) ? "stone" : hashed(px, py + 7, 150) ? "white" : "driftwood";

  yard(cv, BASE, FAR_WALK, sand);

  const boards: RoadPaint = (x, _z, _span, px, py) => {
    const a = Math.abs(x);
    if (a >= ROAD - 4) {
      return "driftwood";
    }
    if ((a % 16) * scale(py + 0.5) < 1) {
      return "tan";
    }
    return hashed(px, py, 27) ? "tan" : "cream";
  };

  const crossBoards: Paint = (px, py) => {
    const s = scale(py + 0.5);
    const u = (px + 0.5 - CX) / s;
    if ((((u % 16) + 16) % 16) * s < 2) {
      return "tan";
    }
    return hashed(px, py, 27) ? "tan" : "cream";
  };

  cross(cv, crossBoards, "tan", sand, { curb: null });
  crossLine(cv, "dbrown", { dash: [10, 64] });
  street(cv, verge("the-beaches", boards));
  lanes(cv, "dbrown", { dash: [20, 64] });
  return cv;
}

// The CN Tower close up, each row's half-width from the top: the SkyPod, then the main pod, a cap
// over a skirt of window rings, its underside narrowing into the shaft.
export const CN_SKY_POD: readonly number[] = [3, 5, 6, 6, 5, 4];
export const CN_POD: readonly number[] = [
  9, 14, 17, 19, 20, 21, 21, 21, 21, 20, 18, 15, 12, 9, 7, 5,
];

// The CN Tower at night, huge and close, the tallest structure in the city, centred on column cx, in
// an ink outline, lgrey lit white on its left and grey in shade on its right: its antenna, 2 columns
// wide, runs off the band's top down to the SkyPod (CN_SKY_POD) on row skyPod, with its ring of lit
// 2x2 windows; a 7-column shaft on to the main pod (CN_POD), 43 wide, on row pod, a white cap, a ring
// of lit 2x2 windows gold and amber at its widest, a ring of cream ones under a grey band, its
// underside in shade; then the shaft flares from 9 columns under the pod to 29 at the street,
// widening faster toward its foot as the real tower's three legs do, down to row base.
export function cnTower(cv: Canvas, cx: number, base: number, skyPod: number, pod: number): void {
  const rows = new Map<number, number>();
  for (let y = 0; y < skyPod; y++) {
    rows.set(y, 0);
  }
  CN_SKY_POD.forEach((half, k) => rows.set(skyPod + k, half));
  for (let y = skyPod + CN_SKY_POD.length; y < pod; y++) {
    rows.set(y, 3);
  }
  CN_POD.forEach((half, k) => rows.set(pod + k, half));
  const low = pod + CN_POD.length;
  for (let y = low; y < base; y++) {
    rows.set(y, 4 + Math.round(10 * ((y - low) / Math.max(1, base - 1 - low)) ** 1.6));
  }
  const inside = new Set<string>();
  for (const [y, half] of rows) {
    for (let x = cx - half; x < cx + Math.max(half, 1) + 1; x++) {
      inside.add(`${x},${y}`);
    }
  }
  for (const key of inside) {
    const [x = 0, y = 0] = key.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (!inside.has(`${x + dx},${y + dy}`) && y + dy >= 0) {
        cv.fill(x + dx, y + dy, 1, 1, "ink");
      }
    }
  }
  for (const [y, half] of rows) {
    const right = Math.max(half, 1);
    cv.fill(cx - half, y, half + right + 1, 1, "lgrey");
    cv.fill(cx - half, y, 1 + (half > 2 ? 1 : 0), 1, "white");
    const shade = Math.max(1, Math.min(right, Math.floor(right / 3) + 1));
    cv.fill(cx + right - shade + 1, y, shade, 1, "grey");
  }
  // the SkyPod's window ring
  for (let k = 0, x = cx - 4; x < cx + 5; k++, x += 3) {
    cv.fill(x, skyPod + 2, 2, 2, ["cream", "gold"][k % 2]!);
  }
  // the pod: a white cap, a ring of gold and amber windows at its widest, a grey band, a ring of
  // cream windows, the underside in shade
  cv.fill(cx - 14, pod + 2, 29, 2, "white");
  for (let k = 0, x = cx - 19; x < cx + 19; k++, x += 3) {
    cv.fill(x, pod + 5, 2, 2, ["gold", "amber"][k % 2]!);
  }
  cv.fill(cx - 21, pod + 8, 43, 1, "grey");
  for (let x = cx - 18; x < cx + 18; x += 3) {
    cv.fill(x, pod + 10, 2, 2, "cream");
  }
  CN_POD.slice(12).forEach((half, k) => {
    cv.fill(cx - half, pod + 12 + k, 2 * half + 1, 1, "grey");
  });
}

// A rooftop antenna h rows tall from row top, a red light at its tip.
export function mast(cv: Canvas, cx: number, top: number, h: number): void {
  cv.fill(cx, top, 1, h, "ash");
  cv.fill(cx, top, 1, 1, "red");
}

// Scotia Plaza: red granite in brick and dbrick facets, its top stepped down to a chevron notch, a
// few windows lit.
export function scotia(cv: Canvas, x: number, w: number, top: number): void {
  for (let k = 0; k < Math.floor(w / 2); k++) {
    const notch = Math.floor(Math.abs(Math.floor(w / 4) - k) / 2);
    cv.fill(x + k, top + notch, 1, BASE - top, "brick");
    cv.fill(x + w - 1 - k, top + notch, 1, BASE - top, "dbrick");
  }
  for (let c = x + 2; c < x + w - 2; c += 3) {
    cv.fill(c, top + 6, 1, BASE - top - 6, "dbrick");
  }
  lit(cv, x + 3, x + w - 3, top + 7, BASE, "scotia", 0.15, ["gold", "amber"]);
  cv.fill(x, top, 1, BASE - top, "coal");
  cv.fill(x + w - 1, top, 1, BASE - top, "coal");
}

// A full moon: a haze disc lit white on its upper left, three lgrey seas.
export function fullMoon(cv: Canvas, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy < r + 1; dy++) {
    for (let dx = -r; dx < r + 1; dx++) {
      if (dx * dx + dy * dy <= r * (r + 1)) {
        cv.fill(cx + dx, cy + dy, 1, 1, dx + dy < -r ? "white" : "haze");
      }
    }
  }
  for (const [dx, dy, w] of [
    [0, -2, 2],
    [-2, 1, 2],
    [1, 2, 2],
  ] as const) {
    cv.fill(cx + dx, cy + dy, w, 1, "lgrey");
  }
}

// Lit windows across columns x0..x1 and rows y0..y1 in blocks, never speckle: a floor every 4 rows,
// a 2x2 window every 3 columns, lit in runs of 2 to 4 windows of one colour; rate sets how many.
export function lit(
  cv: Canvas,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  seed: string,
  rate: number,
  cols: readonly string[] = ["gold", "amber", "cream"],
): void {
  const rnd = stream(`lit-${seed}`);
  for (let y = y0; y < y1 - 1; y += 4) {
    let run = 0;
    let col = "";
    for (let x = x0; x < x1 - 1; x += 3) {
      if (run === 0 && rnd() < rate * 0.45) {
        run = randomInt(rnd, 2, 5);
        col = randomPick(rnd, cols);
      }
      if (run) {
        cv.fill(x, y, 2, 2, col);
        run -= 1;
      }
    }
  }
}

// A tower behind the front row: (x, w, top, wall).
export type Tower = readonly [x: number, w: number, top: number, wall: string];

// The towers behind the front row: silhouettes standing on BASE, with runs of lit windows, gold and
// amber and a few pink and cyan.
export function skyline(cv: Canvas, towers: readonly Tower[]): void {
  towers.forEach(([x, w, top, wall], k) => {
    cv.fill(x, top, w, BASE - top, wall);
    lit(cv, x + 2, x + w - 1, top + 3, BASE, `far-${k}`, 0.3, [
      "gold",
      "amber",
      "gold",
      "amber",
      "pink",
      "cyan",
    ]);
  });
}

// The SkyDome far off, in the far landmarks' haze: a dome ry rows tall on row wall, its four panels'
// seams lgrey arcs nested at its right foot, lit white along its upper left, an ink line along its
// top arc so it reads apart from light scenery behind it. Its foot stays hidden behind the nearer
// towers.
export function skydome(cv: Canvas, x: number, w: number, wall: number, ry: number): void {
  const rx = w / 2;

  function inside(px: number, py: number, r: number): boolean {
    const dx = (px + 0.5 - (x + w - r)) / r;
    const dy = (py + 0.5 - wall) / (ry * (r / rx) ** 0.5);
    return dx * dx + dy * dy <= 1;
  }

  for (let py = wall - ry; py < wall; py++) {
    for (let px = x; px < x + w; px++) {
      if (!inside(px, py, rx)) {
        continue;
      }
      let c = !inside(px - 1, py - 1, rx) && px < x + w * 0.6 ? "white" : "haze";
      for (const r of [rx * 0.75, rx * 0.5, rx * 0.25]) {
        if (inside(px, py, r) && !inside(px - 1, py, r)) {
          c = "lgrey";
        }
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
  for (let px = x; px < x + w; px++) {
    let rim: number | undefined;
    for (let py = wall - ry; py < wall; py++) {
      if (inside(px, py, rx)) {
        rim = py;
        break;
      }
    }
    if (rim !== undefined) {
      cv.fill(px, rim - 1, 1, 1, "ink");
      if (px > x && !inside(px - 1, rim, rx)) {
        cv.fill(px - 1, rim, 1, 1, "ink");
      }
      if (px < x + w - 1 && !inside(px + 1, rim, rx)) {
        cv.fill(px + 1, rim, 1, 1, "ink");
      }
    }
  }
}

// A tower's stepped top: steps rows each 2 columns narrower a side, above row top.
export function crown(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  wall: string,
  line = "coal",
  steps = 2,
): void {
  for (let k = 1; k < steps + 1; k++) {
    cv.fill(x + 2 * k, top - k, w - 4 * k, 1, line);
    cv.fill(x + 2 * k + 1, top - k + 1, w - 4 * k - 2, 1, wall);
  }
}

// A Royal Bank Plaza tower: gold glass in sawtooth facets, a gold and amber pair lit and ochre in
// shade every 4 columns, ochre floors every 3 rows.
export function royalBank(cv: Canvas, x: number, w: number, top: number): void {
  crown(cv, x, w, top, "gold");
  for (let c = x + 1; c < x + w - 1; c++) {
    cv.fill(c, top + 1, 1, BASE - top - 1, ["gold", "gold", "amber", "ochre"][(c - x) % 4]!);
  }
  for (let y = top + 3; y < BASE; y += 3) {
    cv.fill(x + 1, y, w - 2, 1, "ochre");
  }
  cv.fill(x + w - 3, top + 1, 2, BASE - top - 1, "ochre");
  outlineBox(cv, x, top, w, BASE - top + 1, "coal");
}

// First Canadian Place: white marble, grey fins every 3 columns, its notched corners in grey, the red
// BMO band at the top.
export function firstCanadian(cv: Canvas, x: number, w: number, top: number): void {
  crown(cv, x, w, top, "lgrey", "coal", 1);
  cv.fill(x, top, w, BASE - top, "lgrey");
  for (let c = x + 3; c < x + w - 3; c += 3) {
    cv.fill(c, top + 5, 1, BASE - top - 5, "grey");
  }
  cv.fill(x + 1, top + 1, 2, BASE - top - 1, "white");
  cv.fill(x + w - 3, top + 1, 2, BASE - top - 1, "grey");
  cv.fill(x + 2, top + 1, w - 4, 3, "ttc");
  cv.fill(x + Math.floor(w / 2) - 3, top + 2, 6, 1, "white");
  lit(cv, x + 4, x + w - 4, top + 7, BASE, "fcp", 0.18, ["cream", "gold"]);
  outlineBox(cv, x, top, w, BASE - top + 1, "slate");
}

// A TD Centre tower: black steel and bronze glass, coal in an ink grid every 3 columns and rows,
// whole runs of each floor lit, the green logo near the top and an ash edge to the light.
export function dominion(cv: Canvas, x: number, w: number, top: number, seed: number): void {
  cv.fill(x, top, w, BASE - top, "coal");
  for (let c = x + 3; c < x + w - 1; c += 3) {
    cv.fill(c, top + 1, 1, BASE - top - 1, "ink");
  }
  const rnd = stream(`td-${seed}`);
  for (let y = top + 6; y < BASE; y += 3) {
    let run = 0;
    for (let c = x + 1; c < x + w - 2; c += 3) {
      run = run === 0 && rnd() < 0.4 ? randomInt(rnd, 2, 6) : Math.max(0, run - 1);
      if (run) {
        cv.fill(c, y, 2, 1, randomPick(rnd, ["gold", "amber", "cream"]));
      }
    }
  }
  cv.fill(x + 2, top + 2, 3, 3, "green");
  cv.fill(x + 3, top + 3, 1, 1, "white");
  outlineBox(cv, x, top, w, BASE - top + 1, "ink");
  cv.fill(x, top, 1, BASE - top, "ash");
  cv.fill(x, top, w - 1, 1, "ash");
}

// A glass tower at night: dark glass, a floor line every 3 rows, its right side in shade, some
// floors' windows lit.
export function glassTower(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  seed: number,
  glass = "dlake",
  line = "ink",
): void {
  cv.fill(x, top, w, BASE - top, glass);
  for (let y = top + 2; y < BASE; y += 3) {
    cv.fill(x + 1, y, w - 2, 1, dk(glass));
  }
  cv.fill(x + w - 3, top, 3, BASE - top, dk(glass));
  lit(cv, x + 2, x + w - 3, top + 3, BASE, `glass-${seed}`, 0.35, ["gold", "amber", "foam"]);
  outlineBox(cv, x, top, w, BASE - top + 1, line);
  cv.fill(x + 1, top + 1, 1, BASE - top - 1, "lake");
}

// Screen art: drawn on the screen x, y, w, h in big shapes.
export type ScreenArt = (cv: Canvas, x: number, y: number, w: number, h: number) => void;

// A video screen: back inside an ink frame 1px round it, and art on it.
export function screen(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  back: string,
  art?: ScreenArt,
): void {
  cv.fill(x - 1, y - 1, w + 2, h + 2, "ink");
  cv.fill(x, y, w, h, back);
  if (art) {
    art(cv, x, y, w, h);
  }
}

// A paw print, 11 by 10: four toe beans over the pad.
export const PAW: readonly string[] = [
  "..##...##..",
  ".####.####.",
  ".####.####.",
  "..##...##..",
  "##.......##",
  "##..###..##",
  "...#####...",
  "..#######..",
  "..#######..",
  "...##.##...",
];

// A white paw print in the middle of a screen.
export function pawArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const px = x + Math.floor((w - PAW[0]!.length) / 2);
  const py = y + Math.floor((h - PAW.length) / 2);
  PAW.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        cv.fill(px + i, py + j, 1, 1, "white");
      }
    });
  });
}

// Screen art: text in the sign letters, centred on the screen.
export function wordArt(text: string, col: string): ScreenArt {
  return (cv, x, y, w, h) => {
    word(cv, text, x + w / 2, y + Math.floor((h - 8) / 2), col);
  };
}

// The Yonge-Dundas tower: shale from row top with runs of lit windows over its wall of screens, low
// enough to show while a message is up: the giant LIVE! screen at 2x on cobalt over blue from row 62
// and, under it, three ads (EAT on red, a paw print on turquoise, NEW on hot pink).
export function dundasScreens(cv: Canvas, x: number, w: number, top: number): void {
  cv.fill(x, top, w, BASE - top, "shale");
  outlineBox(cv, x, top, w, BASE - top + 1, "ink");
  lit(cv, x + 2, x + w - 3, top + 3, 59, "dundas", 0.5, ["gold", "amber"]);
  const sx = x + 3;
  const sw = w - 6;
  const sy = 62;
  const sh = 17;
  screen(cv, sx, sy, sw, sh, "cobalt");
  cv.fill(sx, sy + sh - 6, sw, 6, "blue");
  word(cv, "LIVE!", x + w / 2, sy, "gold", { scale: 2 });
  const ay = sy + sh + 3;
  const aw = Math.floor((sw - 4) / 3);
  (
    [
      ["ttc", wordArt("EAT", "white")],
      ["turquoise", pawArt],
      ["hot", wordArt("NEW", "white")],
    ] as const
  ).forEach(([back, art], k) => {
    screen(cv, sx + k * (aw + 2), ay, aw, 11, back, art);
  });
}

// A tower's lit podium seen from far off, rows BASE - 18 to BASE: coal under an ash top edge, its
// floors lit in runs of 2x2 windows, gold, amber and cream, with no doors or shopfronts; and over it
// a neon sign, (word, colour), on an ink board edged in its colour.
export function streetLevel(
  cv: Canvas,
  x: number,
  w: number,
  seed: number,
  signOf?: readonly [string, string] | null,
): void {
  cv.fill(x, BASE - 18, w, 18, "coal");
  cv.fill(x, BASE - 18, w, 1, "ash");
  lit(cv, x + 2, x + w - 2, BASE - 14, BASE, `podium-${seed}`, 1.2, ["gold", "amber", "cream"]);
  if (signOf) {
    const [s, col] = signOf;
    const bw = signWidth(s) + 4;
    const bx = Math.round(x + w / 2 - bw / 2);
    cv.fill(bx, BASE - 17, bw, 9, "ink");
    outlineBox(cv, bx, BASE - 17, bw, 9, col);
    word(cv, s, x + w / 2, BASE - 17, col);
  }
}

// A lit podium's light on the far sidewalk, rows BASE to FAR_WALK, under columns x0 to x1: stone on
// its first 2 rows inside a dstone edge, each row out a column wider a side, with no pixel in the
// column ranges skip (the side street's mouth).
export function frontPool(
  cv: Canvas,
  x0: number,
  x1: number,
  skip: readonly (readonly [number, number])[] = [],
): void {
  const rows = FAR_WALK - BASE;
  for (let k = 0; k < rows; k++) {
    const a = x0 + (rows - 1 - k);
    const z = x1 - (rows - 1 - k);
    for (let x = Math.max(0, a); x < Math.min(W, z); x++) {
      if (skip.some(([lo, hi]) => lo <= x && x <= hi)) {
        continue;
      }
      cv.fill(x, BASE + k, 1, 1, k < 2 && a + 2 <= x && x < z - 2 ? "stone" : "dstone");
    }
  }
}

// A 2px-deep border of marquee bulbs round the box x, y, w, h: 2x2 bulbs every 4 px on ink, the
// colours in turn.
export function bulbs(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: readonly string[] = ["gold", "cream"],
): void {
  for (const [fx, fy, fw, fh] of [
    [x, y, w, 2],
    [x, y + h - 2, w, 2],
    [x, y, 2, h],
    [x + w - 2, y, 2, h],
  ] as const) {
    cv.fill(fx, fy, fw, fh, "ink");
  }
  let k = 0;
  for (let px = x; px < x + w - 1; px += 4) {
    for (const py of [y, y + h - 2]) {
      cv.fill(px, py, 2, 2, cols[k % cols.length]!);
    }
    k += 1;
  }
  for (let py = y + 4; py < y + h - 3; py += 4) {
    for (const px of [x, x + w - 2]) {
      cv.fill(px, py, 2, 2, cols[k % cols.length]!);
    }
    k += 1;
  }
}

// A vertical neon sign hung from a wall: an ink board from row top with text read down it, a letter
// every 7 rows, edged in col.
export function blade(cv: Canvas, x: number, top: number, text: string, col: string): void {
  const h = 7 * [...text].length + 3;
  cv.fill(x, top, 9, h, "ink");
  outlineBox(cv, x, top, 9, h, col);
  [...text].forEach((ch, k) => {
    word(cv, ch, x + 4.5, top + 1 + 7 * k, col);
  });
}

// The Eaton Centre seen from far off, one huge mall mass with no entrance: the galleria's long barrel
// vault of lake glass on white ribs across its whole width, then a dlake glass facade from the vault
// down to the street, its right 3 columns navy in shade, white-foam mullions every 4 columns and 4
// rows, its floors lit gold and amber in long runs of 3x3 panes; and on the roof the EATON CENTRE
// sign: cyan letters on an ink board in a 2px border of marquee bulbs, on coal legs.
export function eatonCentre(cv: Canvas, x: number, w: number, top: number): void {
  const vault = 7;
  for (let dy = 0; dy < vault; dy++) {
    const half = Math.round((w / 2) * Math.sqrt(1 - ((vault - dy) / vault) ** 2));
    cv.fill(Math.round(x + w / 2 - half), top + dy, 2 * half, 1, "lake");
  }
  for (let c = x + 4; c < x + w - 2; c += 8) {
    cv.fill(c, top + 2, 1, vault - 2, "white");
  }
  cv.fill(x, top + vault, w, BASE - top - vault, "dlake");
  cv.fill(x + w - 3, top + vault, 3, BASE - top - vault, "navy");
  const rnd = stream("eaton");
  for (let y = top + vault + 1; y < BASE - 2; y += 4) {
    let run = 0;
    let col = "";
    for (let c = x + 1; c < x + w - 4; c += 4) {
      if (run === 0 && rnd() < 0.3) {
        run = randomInt(rnd, 2, 6);
        col = randomPick(rnd, ["gold", "amber", "gold"]);
      }
      if (run) {
        cv.fill(c, y, 3, 3, col);
        run -= 1;
      }
    }
    cv.fill(x, y + 3, w - 3, 1, "foam");
  }
  for (let c = x + 4; c < x + w - 3; c += 4) {
    cv.fill(c, top + vault, 1, BASE - top - vault, "foam");
  }
  outlineBox(cv, x, top + vault, w, BASE - top - vault + 1, "navy");
  const text = "EATON CENTRE";
  const bw = signWidth(text) + 8;
  const bx = Math.round(x + w / 2 - bw / 2);
  const by = top - 17;
  for (const c of [bx + 6, bx + bw - 7]) {
    cv.fill(c, by + 13, 2, top - by - 13 + 2, "coal");
  }
  cv.fill(bx, by, bw, 14, "ink");
  bulbs(cv, bx, by, bw, 14, ["gold", "cream", "hot", "cream"]);
  word(cv, text, x + w / 2, by + 3, "cyan");
}

// A car in a jam far down a side street, w columns wide on row y: from behind, a slate body with red
// tail lights at its corners; from the front, gold headlights.
export function carLights(cv: Canvas, cx: number, y: number, w: number, back: boolean): void {
  const h = Math.max(2, Math.round(w * 0.6));
  const x = cx - Math.floor(w / 2);
  cv.fill(x, y - h + 1, w, h, "slate");
  if (h > 3) {
    cv.fill(x + 1, y - h + 1, w - 2, 1, "ink");
  }
  const lamp = back ? "red" : "gold";
  const size = 1 + (w >= 6 ? 1 : 0);
  cv.fill(x, y - Math.floor(h / 2), size, 1, lamp);
  cv.fill(x + w - size, y - Math.floor(h / 2), size, 1, lamp);
}

// A TTC bus from behind at the mouth of the side street: white over red, a dark back window, red
// tail lights low at its corners and an amber route sign.
export function busBack(cv: Canvas, cx: number, y: number): void {
  cv.fill(cx - 6, y - 12, 13, 13, "ink");
  cv.fill(cx - 5, y - 11, 11, 6, "white");
  cv.fill(cx - 5, y - 5, 11, 5, "ttc");
  cv.fill(cx - 4, y - 10, 9, 4, "dslate");
  cv.fill(cx - 2, y - 11, 5, 1, "amber");
  cv.fill(cx - 5, y - 3, 2, 2, "red");
  cv.fill(cx + 4, y - 3, 2, 2, "red");
  cv.fill(cx - 5, y - 6, 11, 1, "white");
}

// A side street running away between two towers, columns x0 to x1, in one-point perspective to a
// vanishing point on row vy: its two side walls, rise rows tall at the mouth, the right one shale and
// the left coal, both in the canyon's shade, with rows of lit windows running to the vanishing point;
// a far block at its end; a shale road between stone curbs; and gridlock on it, cars going away
// showing their tail lights on the left, cars coming in their headlights on the right, a TTC bus at
// the mouth.
export function sideStreet(cv: Canvas, x0: number, x1: number, vy: number, rise = 34): void {
  const mid = (x0 + x1 + 1) / 2;
  const floor = FAR_WALK - 1;
  const half = (x1 - x0 + 1) / 2;
  const depth = floor + 0.5 - vy;
  const rnd = stream("side-street");
  for (let px = x0; px < x1 + 1; px++) {
    const d = px + 0.5 - mid;
    // 0 at the vanishing point, 1 at the mouth
    const k = Math.abs(d) / half;
    const top = vy - rise * k;
    const foot = vy + depth * k;
    const floors = new Set(
      [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f) => Math.floor(vy - rise * k * f)),
    );
    for (let py = Math.floor(top); py < floor + 1; py++) {
      let c: string;
      if (py + 0.5 < foot) {
        c = d < 0 ? "coal" : "shale";
        if (floors.has(py) && px % 2 && rnd() < 0.55) {
          c = randomPick(rnd, ["gold", "amber", "cream"]);
        }
      } else {
        const t = (py + 0.5 - vy) / depth;
        c =
          Math.abs(d) < half * t * 0.75
            ? "shale"
            : Math.abs(d) < half * t * 0.8
              ? "stone"
              : "dstone";
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
  cv.fill(Math.round(mid) - 3, vy - 7, 6, 7, "dslate");
  lit(cv, Math.round(mid) - 2, Math.round(mid) + 3, vy - 6, vy, "side-end", 0.6, ["gold", "cream"]);
  for (const t of [0.12, 0.2, 0.3, 0.42, 0.56, 0.72]) {
    const y = Math.round(vy + depth * t);
    const w = Math.max(2, Math.round(11 * t));
    carLights(cv, Math.round(mid - half * t * 0.38), y, w, true);
    carLights(cv, Math.round(mid + half * t * 0.38), y, w, false);
  }
  busBack(cv, Math.round(mid - half * 0.38), floor);
}

// A theatre's vertical blade sign, 13 columns wide from row top: text read down it in col on cream,
// a letter every step rows, in a 2px border of marquee bulbs, on a coal bracket down to row base.
export function elgin(
  cv: Canvas,
  x: number,
  top: number,
  base: number,
  { col = "red", step = 8, text = "ELGIN" }: { col?: string; step?: number; text?: string } = {},
): void {
  const h = step * [...text].length + 6;
  cv.fill(x, top, 13, h, "cream");
  bulbs(cv, x, top, 13, h);
  [...text].forEach((ch, k) => {
    word(cv, ch, x + 6.5, top + 3 + step * k, col);
  });
  cv.fill(x + 5, top + h, 3, base - top - h, "coal");
}

// A theatre marquee over a street level, columns x to x + w - 1, rows BASE - 25 to BASE - 11: text in
// col on a cream board in a 2px border of marquee bulbs.
export function marquee(cv: Canvas, x: number, w: number, text: string, col: string): void {
  const y = BASE - 25;
  cv.fill(x, y, w, 15, "ink");
  cv.fill(x + 2, y + 2, w - 4, 11, "cream");
  bulbs(cv, x, y, w, 15);
  word(cv, text, x + w / 2, y + 4, col);
}

// One ramp step lighter, for the street's glow on the towers' feet.
export const UP: ReadonlyMap<string, string> = new Map([
  ["navy", "dslate"],
  ["dslate", "slate"],
  ["dlake", "lake"],
  ["shale", "ash"],
  ["coal", "shale"],
  ["ink", "coal"],
  ["lake", "shallow"],
  ["blue", "cobalt"],
  ["purple", "mauve"],
  ["dbrick", "brick"],
  ["brick", "rust"],
  ["ochre", "amber"],
  ["slate", "grey"],
  ["ash", "stone"],
  ["teal", "dturq"],
]);
// Each house colour's name by "r,g,b", the first name for a colour two names share.
export const NAMES: ReadonlyMap<string, string> = new Map(
  Object.entries(K)
    .reverse()
    .map(([n, h]) => [rgb(h).join(","), n]),
);

// The street's glow on the towers' feet: every pixel on rows y0 to y1 with a lighter step in UP takes
// it.
export function uplight(cv: Canvas, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const n = NAMES.get(pixelAt(cv, x, y));
      const up = n === undefined ? undefined : UP.get(n);
      if (up !== undefined) {
        cv.fill(x, y, 1, 1, up);
      }
    }
  }
}

// A crosswalk over the cross street, w columns centred on mid: white bars along the street on every
// other row, the road between them clear of the centre line.
export function crosswalk(cv: Canvas, mid: number, w: number, road: string): void {
  const x = Math.round(mid - w / 2);
  cv.fill(x, CROSS + 1, w, NEAR_CURB - CROSS - 1, road);
  for (let py = CROSS + 1; py < NEAR_CURB; py += 2) {
    cv.fill(x, py, w, 1, "white");
  }
}

export const YONGE_SKY: readonly string[] = ["slate", "dslate", "purple", "mauve"];

export function yonge(): Canvas {
  const cv = new Canvas(W, H);
  // an evening sky, slate down to dslate and purple, a mauve city glow at the horizon, a full moon
  // and a few stars
  sunset(cv, YONGE_SKY, BASE);
  for (const [x, y] of [
    [8, 6],
    [62, 2],
    [108, 9],
    [150, 4],
    [196, 11],
    [232, 3],
    [288, 22],
    [318, 4],
    [352, 12],
  ] as const) {
    cv.fill(x, y, 1, 1, "white");
  }
  fullMoon(cv, 304, 14, 5);
  // downtown seen from far off, its towers stepping up toward the top third, the CN Tower huge and
  // close over them all: its antenna running off the band's top over the SkyPod and the main pod,
  // the shaft flaring down to the street. The message strip covers the band's top rows while a
  // message shows, so the screens and signs stay below row 57. Far back, dark towers in navy and
  // dslate with runs of windows lit, those either side of the tower's shaft kept low
  skyline(cv, [
    [-2, 16, 30, "navy"],
    [40, 14, 62, "dslate"],
    [78, 16, 52, "navy"],
    [114, 22, 26, "navy"],
    [150, 18, 16, "dslate"],
    [170, 20, 30, "navy"],
    [196, 16, 24, "dslate"],
    [214, 14, 18, "navy"],
    [228, 18, 28, "navy"],
    [268, 16, 36, "dslate"],
    [300, 18, 30, "navy"],
    [322, 16, 22, "dslate"],
    [342, 20, 34, "navy"],
  ]);
  for (const [cx, top, h] of [
    [122, 26, 6],
    [156, 22, 5],
    [178, 30, 6],
    [220, 24, 4],
    [348, 34, 6],
  ] as const) {
    mast(cv, cx, top - h, h);
  }
  // the SkyDome off to the tower's right, its foot behind the Eaton Centre; lit towers behind it;
  // then the CN Tower, its shaft clear down to the street
  skydome(cv, 84, 70, BASE - 32, 16);
  glassTower(cv, 10, 30, 36, 7);
  scotia(cv, 96, 24, 30);
  dominion(cv, 120, 22, 40, 5);
  glassTower(cv, -4, 16, 22, 4);
  cnTower(cv, 56, BASE, 8, 26);
  // the nearer towers: dark glass on the left and up to the SkyDome's lower half; then, down to the
  // street, the Yonge-Dundas screens, the Royal Bank Plaza's gold pair, First Canadian Place, a TD
  // Centre tower and glass under a turquoise crown, the street's glow on their feet and most with
  // neon over a lit street level; in front, the Eaton Centre under its sign, a HOTEL sign down the
  // left tower, screens on the glass, the TD tower and the crowned tower, and the theatre: the ELGIN
  // blade over a marquee in front of the Royal Bank pair
  dundasScreens(cv, CX - 32, 64, 34);
  royalBank(cv, 210, 20, 30);
  royalBank(cv, 230, 14, 50);
  firstCanadian(cv, 246, 22, 20);
  dominion(cv, 270, 34, 28, 1);
  glassTower(cv, 332, 32, 32, 3);
  crown(cv, 332, 32, 32, "turquoise", "turquoise", 3);
  uplight(cv, BASE - 24, BASE - 18);
  uplight(cv, BASE - 21, BASE - 18);
  const fronts = [
    [-4, 18, null],
    [14, 30, ["CAFE", "turquoise"]],
    [44, 30, null],
    [74, 14, null],
    [CX - 32, 64, ["PIZZA", "gold"]],
    [210, 20, null],
    [230, 14, null],
    [246, 22, null],
    [270, 34, ["BOOKS", "lilac"]],
    [332, 32, ["BAR", "pink"]],
  ] as const;
  fronts.forEach(([x, w, signOf], k) => {
    streetLevel(cv, x, w, k, signOf);
  });
  eatonCentre(cv, 72, 76, BASE - 36);
  blade(cv, 3, 62, "HOTEL", "pink");
  screen(cv, 14, 72, 30, 18, "turquoise", wordArt("WOOF!", "white"));
  screen(cv, 274, 70, 26, 18, "azure", pawArt);
  screen(cv, 334, 72, 26, 18, "hot", wordArt("SALE", "white"));
  elgin(cv, 236, BASE - 25 - 41, BASE - 25, { step: 7 });
  marquee(cv, 208, 40, "SHOW", "red");
  // the subway entrance sign
  const sx = 64;
  cv.fill(sx, BASE - 4, 2, FAR_WALK - BASE + 4, "coal");
  cv.fill(sx - 9, BASE - 14, 20, 12, "coal");
  cv.fill(sx - 8, BASE - 13, 18, 10, "ttc");
  word(cv, "TTC", sx + 1, BASE - 12, "white");

  const paving: Paint = (px, py) => (hashed(px, py, 67) ? "slate" : "dslate");

  yard(cv, BASE, FAR_WALK, paving);
  // the lit podiums' and the Eaton Centre's light on the far sidewalk
  for (const [x0, x1] of [
    ...fronts.map(([x, w]): [number, number] => [x + 1, x + w - 1]),
    [79, 153] as const,
  ]) {
    frontPool(cv, x0, x1, [[300, 334]]);
  }
  // a side street jammed with traffic between the TD tower and the glass, down to the far sidewalk
  sideStreet(cv, 304, 331, BASE - 26, 18);

  const road: RoadPaint = (x, z, span, px, py) => {
    if (Math.abs(x) >= ROAD - 5) {
      return "dstone";
    }
    if (span < 6 && crosses(z, span, 32)) {
      return "coal";
    }
    return hashed(px, py, 41) ? "ash" : "shale";
  };

  cross(cv, flat(road), "dstone", paving, { curb: "grey" });
  crossLine(cv, "amber", { dash: [14, 64], edge: "coal" });
  // crosswalks over the cross street from the stub's two sidewalks
  for (const mid of [94, 266]) {
    crosswalk(cv, mid, 14, "shale");
  }
  street(cv, verge("yonge-street", road));
  lanes(cv, "white", { dash: [14, 64], edge: "coal" });
  return cv;
}

// Each backdrop's key and drawing.
export const ZONES: ReadonlyMap<string, () => Canvas> = new Map([
  ["backdrop-cabbagetown", cabbagetown],
  ["backdrop-high-park", highPark],
  ["backdrop-distillery-district", distillery],
  ["backdrop-kensington-market", kensington],
  ["backdrop-the-beaches", beaches],
  ["backdrop-yonge-street", yonge],
]);

// Print the camera, the bottom row's join with the road and the sidewalks, in band pixels.
export function camera(): void {
  const column = (x: number, py: number): number => CX + x * scale(py + 0.5);
  console.log(
    `camera: yH ${YH}, footY ${FOOT}, r ${(KS / F).toFixed(4)}, f ${F.toFixed(1)}, centre x ${CX}; ` +
      `${VISIBLE.toFixed(1)} road px in view below the band, scale ${S0.toFixed(4)} on row ${H - 1}`,
  );
  const road: number[] = [];
  for (let px = 0; px < W; px++) {
    if (Math.abs(px + 0.5 - CX) < ROAD * S0) {
      road.push(px);
    }
  }
  const lines = DIVIDERS.map((d) => Math.round(CX + d * S0 - 0.5));
  console.log(
    `row ${H - 1}: road columns ${road[0]}..${road.at(-1)}, lane dividers [${lines.join(", ")}]`,
  );
  const mid = (CURB + WALK) / 2;
  for (const side of [-1, 1]) {
    const ends = [H - 1, STUB - 1].map((py) => `(${Math.round(column(side * mid, py))}, ${py})`);
    console.log(`sidewalk middle: ${ends[0]} to ${ends[1]}`);
  }
}

export function preview(out: string, scaleBy = 3): void {
  const sheet = filledImage([...rgb("ink"), 255], W * scaleBy, (H + 6) * ZONES.size * scaleBy);
  [...ZONES.values()].forEach((draw, i) => {
    const img = resizeNearest(W * scaleBy, H * scaleBy, draw().img);
    paste({ at: { x: 0, y: i * (H + 6) * scaleBy } }, img, sheet);
  });
  writeFileSync(out, rgbPng(sheet));
}

export function build(): void {
  mkdirSync("art/backdrops", { recursive: true });
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of ZONES) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(draw().img));
    execFileSync("aseprite", ["-b", png, "--save-as", `art/backdrops/${key}.aseprite`], {
      stdio: "inherit",
    });
  }
  console.log("built", [...ZONES.keys()].join(", "));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 2 && argv[0] === "preview") {
    preview(argv[1]!);
  } else if (argv.length === 1 && argv[0] === "camera") {
    camera();
  } else if (argv.length === 1 && argv[0] === "verges") {
    console.log(JSON.stringify(VERGES, null, 2));
  } else if (argv.length === 2 && argv[0] === "verges" && argv[1] === "--write") {
    writeVerges();
  } else if (argv.length === 1 && argv[0] === "build") {
    build();
    writeVerges();
  } else {
    console.error(USAGE);
    process.exit(1);
  }
}
