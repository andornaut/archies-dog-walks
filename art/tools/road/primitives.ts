// Shared road drawing scope, lighting, scaling and human pose primitives.

import { type Scale, small, snap } from "../mini.ts";
import {
  type Colour,
  DARKER,
  type Drawable,
  type DrawingScope,
  edged,
  type FaceFront,
  type FaceOptions,
  type Frame,
  Grid,
  hexOf,
  K,
  type Point,
  raster,
  rowScaleOf,
  scaleOf,
} from "../pixel.ts";

// m with the sign of v, a negative zero counting as negative.
function copysign(m: number, v: number): number {
  return v < 0 || Object.is(v, -0) ? -Math.abs(m) : Math.abs(m);
}

export function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    out.push(i);
  }
  return out;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

// What a sprite's frames are drawn on: each module's grid, swapped for a Mini by small(), and the
// drawings small() and minis.ts draw at the small size in its place.
interface RoadScope extends DrawingScope {
  faceFront: FaceFront;
  squirrelHead: (g: Drawable, x: number, y: number) => void;
}

// Eyes and a smile for a chibi head seen from the front; y is the eye row. lips is the mouth's
// colour; spread is each eye's centre's distance from cx; mouth is the smile's corners' row below y.
export function faceFront(
  g: Drawable,
  cx: number,
  y: number,
  { eyes = "ink", lips = "dbrown", mouth = 4, spread = 4 }: FaceOptions = {},
): void {
  g.rect(cx - spread - 1, y, 2, 2, eyes);
  g.rect(cx + spread - 1, y, 2, 2, eyes);
  g.p(cx - spread - 1, y, "white");
  g.p(cx + spread - 1, y, "white");
  g.p(cx - 2, y + mouth, lips);
  g.p(cx + 1, y + mouth, lips);
  g.rect(cx - 1, y + mouth + 1, 2, 1, lips);
}

// A face seen from the front, kept clean as the portraits are: flat skin, with a 1px shadow down its
// near (right) edge from the top to `to` of the radius below the centre, beside the eyes, never
// across the jaw or mouth. Drawn on a Mini, the shadow is 1px of the grid's own pixels.
export function faceDisc(
  g: Drawable,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  skin: string,
  shade: string,
  to = 0.35,
): void {
  g.ell(cx, cy, rx, ry, skin);
  const px = raster(g);
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const fill = hexOf(skin);
  const y1 = Math.min(px.h, Math.floor((cy + ry * to) * sy) + 1);
  for (let y = Math.max(0, Math.floor((cy - ry) * sy)); y < y1; y++) {
    let last = -1;
    for (let x = 0; x < px.w; x++) {
      if (
        px.px[y]![x] === fill &&
        ((x + 0.5 - cx * s) / (rx * s)) ** 2 + ((y + 0.5 - cy * sy) / (ry * sy)) ** 2 <= 1
      ) {
        last = x;
      }
    }
    if (last >= 0) {
      px.p(last, y, shade);
    }
  }
}

// A rim colour pair: lit where an edge faces up or left, shade (or null, leaving it dark) where it
// faces right or down.
type RimPair = readonly [lit: string, shade: string | null];

export type Rims = Readonly<Record<string, RimPair>>;

// Light a dark figure's silhouette so it holds on the dslate road: an edge pixel of a colour in rims
// takes rims[colour] = [lit, shade], lit where the edge faces up or left into the light and shade
// where it faces right or down. A shade of null leaves that side dark. On a Mini it lights the drawn
// grid, so the rim is 1px at the small size. Returns the drawn grid.
export function rim(g: Drawable, rims: Rims): Grid {
  const px = raster(g);
  const byHex = new Map(Object.entries(rims).map(([c, v]) => [K[c]!, v]));
  const edge: [number, number, string | null][] = [];
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const c = px.px[y]![x]!;
      const pair = c === null ? undefined : byHex.get(c);
      if (!pair) {
        continue;
      }
      const empty = (
        [
          [0, -1],
          [-1, 0],
          [1, 0],
          [0, 1],
        ] as const
      ).map(
        ([dx, dy]) =>
          !(x + dx >= 0 && x + dx < px.w && y + dy >= 0 && y + dy < px.h && px.px[y + dy]![x + dx]),
      );
      if (empty.some(Boolean)) {
        edge.push([x, y, empty[0] || empty[1] ? pair[0] : pair[1]]);
      }
    }
  }
  for (const [x, y, c] of edge) {
    if (c) {
      px.p(x, y, c);
    }
  }
  return px;
}

// The lit rim for every road sprite that fails 3:1 on the dslate road, for rim(): navy, ink and
// dslate take grey (slate opposite), slate lgrey, dark browns skin2, mid browns and ochre tan, greens
// green, blues cyan, and reds, mauves and purples pink.
export const LIT: Rims = {
  blue: ["cyan", null],
  brown: ["tan", null],
  dbrown: ["skin2", null],
  dgreen: ["green", null],
  dred: ["pink", null],
  dslate: ["grey", "slate"],
  forest: ["green", null],
  ink: ["grey", "slate"],
  mauve: ["pink", null],
  navy: ["grey", "slate"],
  ochre: ["tan", null],
  plum: ["skin2", null],
  purple: ["pink", null],
  red: ["pink", null],
  rust: ["tan", null],
  sky: ["cyan", null],
  slate: ["lgrey", null],
};

// rim with LIT (and extra, by colour) on g, returning g.
export function lit<G extends Drawable>(g: G, extra: Rims = {}): G {
  rim(g, { ...LIT, ...extra });
  return g;
}

// Where headlamp draws a lamp centred on layout point (cx, cy) at scale s (sy for the rows, if
// given): [x0, y0, n], its white core's top-left pixel and side. The core is 2 layout pixels across,
// 3px from the @75 step up and 2px below it, so a depth step's row or column cut leaves it at least
// 2px.
export function lampBox(s: number, cx: number, cy: number, sy = s): [number, number, number] {
  const n = Math.max(2, Math.floor(2 * s + 0.8));
  return [Math.floor(cx * s - n / 2 + 0.5), Math.floor(cy * sy - n / 2 + 0.5), n];
}

// A lit headlamp on the Grid px: an n x n white core at (x0, y0) in a 1px ring of edge with its
// corners clear, so it reads as a round lamp. It paints only pixels already drawn, so the silhouette
// and outline stay as they are, and its core lies wholly on them: where the drawing under (x0, y0) is
// too small for it, the core moves up to 1px, then shrinks to 2px. A 2px core is spare rows taller, a
// row that a depth step's settling (pixel.ts's depthSettled) can take out of the lamp instead of out
// of a feature such as the eyes.
export function stampLamp(
  px: Grid,
  x0: number,
  y0: number,
  n: number,
  edge = "cream",
  spare = 0,
): Grid {
  const drawnAt = (x: number, y: number, k: number, h: number): boolean => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + k; xx++) {
        if (!(xx >= 0 && xx < px.w && yy >= 0 && yy < px.h && px.px[yy]![xx])) {
          return false;
        }
      }
    }
    return true;
  };
  const moves: [number, number][] = [];
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      moves.push([dx, dy]);
    }
  }
  moves.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - (Math.abs(b[0]) + Math.abs(b[1])));
  let found: [number, number, number] | undefined;
  for (let k = n; k > 1 && !found; k--) {
    for (const [dx, dy] of moves) {
      const x = x0 + dx + Math.floor((n - k) / 2);
      const y = y0 + dy + Math.floor((n - k) / 2);
      if (drawnAt(x, y, k, k + (k === 2 ? spare : 0))) {
        found = [k, x, y];
        break;
      }
    }
  }
  if (!found) {
    throw new Error(`no drawing under a headlamp at (${x0}, ${y0}) wide enough for a 2px core`);
  }
  const [k, x, y] = found;
  const h = k + (k === 2 ? spare : 0);
  for (const [rx, ry, w, hh, c] of [
    [x - 1, y, k + 2, h, edge],
    [x, y - 1, k, h + 2, edge],
    [x, y, k, h, "white"],
  ] as const) {
    for (let yy = ry; yy < ry + hh; yy++) {
      for (let xx = rx; xx < rx + w; xx++) {
        if (xx >= 0 && xx < px.w && yy >= 0 && yy < px.h && px.px[yy]![xx]) {
          px.p(xx, yy, c);
        }
      }
    }
  }
  return px;
}

// A lit headlamp on a mover coming at the pack, centred on layout point (cx, cy) of g (a Grid or a
// Mini) and drawn in g's own pixels (lampBox, stampLamp, which takes spare), so it is the same at
// every depth step. The game's light layer starts the headlight cone from the white core. White,
// never gold, so it never reads as a pickup.
export function headlamp<G extends Drawable>(
  g: G,
  cx: number,
  cy: number,
  { edge = "cream", spare = 0 }: { edge?: string; spare?: number } = {},
): G {
  const s = scaleOf(g);
  stampLamp(raster(g), ...lampBox(s, cx, cy, rowScaleOf(g)), edge, spare);
  return g;
}

// Road sprites are drawn SCALE times the size their drawing functions lay them out at: a person laid
// out on 32x48, an animal on 32x32 and a pickup on 16x16 export at 48x72, 48x48 and 24x24. sprites()
// runs the functions on a Mini, which scales every shape before it rasterizes and keeps 1px lines
// 1px, so nothing is upscaled; the depth variants (minis.ts, depths.ts) run them at SCALE times each
// depth step.
export const SCALE = 1.5;

// The ice cream truck is drawn in its own pixels at 56x50, then on a Mini that keeps its 56 columns
// (a lane less 4px each side) and draws its rows ROW_SCALE times.
const ROW_SCALE = 1.2;

export const TRUCK_SCALE: readonly [number, number] = [1, ROW_SCALE];

function isOptions(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

// draw(...args) at scale s on a Mini, or [sx, sy] for its columns and rows. A trailing options object
// holds the drawing's keyword arguments: its numeric entries (pose offsets) snap to whole pixels as
// mini.ts's snap has them at the row scale.
export function drawn<A extends unknown[], R>(s: Scale, draw: (...args: A) => R, ...args: A): R {
  const sy = typeof s === "number" ? s : s[1];
  const last = args.at(-1);
  let call = args;
  if (isOptions(last)) {
    const pose: Record<string, number> = {};
    for (const [k, v] of Object.entries(last)) {
      if (typeof v === "number") {
        pose[k] = v;
      }
    }
    call = [...args.slice(0, -1), { ...last, ...snap(pose, sy) }] as unknown as A;
  }
  return small(scope, scope, s, draw, ...call);
}

// draw(...args) at SCALE: a person, an animal or a pickup.
export function big<A extends unknown[], R>(draw: (...args: A) => R, ...args: A): R {
  return drawn(SCALE, draw, ...args);
}

// ---------- the walker (back view) ----------

// An arm part: [rows, fill, shade or null].
export type ArmPart = readonly [rows: number, fill: string, shade: string | null];

// A walker's arm seen from behind, hanging from its shoulder at row top: parts are [rows, fill,
// shade] from the shoulder down; shade (or null) takes the right column. The shoulder never moves.
// out swings the hand that many pixels sideways, every row shifting in proportion to its distance
// from the shoulder, and lift shortens the arm's longest part that many rows, as an arm swung toward
// or away from the camera looks shorter. Offsets snap to the grid's own pixels, so the arm stays a
// clean stair of whole pixels.
export function backArm(
  g: Drawable,
  x: number,
  w: number,
  top: number,
  parts: readonly ArmPart[],
  { lift = 0, out = 0 }: { lift?: number; out?: number } = {},
): void {
  const s = scaleOf(g);
  const heights = parts.map(([n]) => n);
  const longest = heights.indexOf(Math.max(...heights));
  heights[longest] = Math.max(1, heights[longest]! - lift);
  const span = Math.max(1, heights.reduce((a, b) => a + b, 0) - 1);
  const ends: number[] = [];
  let sum = 0;
  for (const h of heights) {
    sum += h;
    ends.push(sum);
  }
  const first = Math.round(top * s);
  const last = Math.round((top + ends.at(-1)!) * s);
  // one rect per row of the grid's own pixels, so the arm has no gaps at any scale or bob
  for (let py = first; py < last; py++) {
    const d = py / s - top;
    const i = parts.findIndex((_, j) => j < ends.length && d < ends[j]! - 1e-9);
    const [, fill, shade] = parts[i]!;
    const dx = copysign(Math.floor(((Math.abs(out) * d) / span) * s), out) / s;
    g.rect(x + dx, py / s, w, 1 / s, fill);
    if (shade !== null) {
      g.rect(x + dx + w - 1, py / s, 1, 1 / s, shade);
    }
  }
}

// Both of a walker's arms from behind, the left at xs[0] and the right at xs[1]. arms swings them
// against the legs: the arm swung forward (the left for arms above 0, the right below) shortens that
// much. flare throws both hands that many pixels out from the sides and reach shortens both arms,
// for a start or a stumble. sway carries both arms that many pixels sideways with the shoulders as
// the upper body sways.
export function walkerArms(
  g: Drawable,
  xs: readonly [number, number],
  w: number,
  top: number,
  parts: readonly ArmPart[],
  arms: number,
  flare: number,
  reach: number,
  sway = 0,
): void {
  for (const [x, side, fwd] of [
    [xs[0], -1, arms],
    [xs[1], 1, -arms],
  ] as const) {
    backArm(g, x + sway, w, top, parts, { lift: Math.max(0, fwd) + reach, out: side * flare });
  }
}

// A solid limb between joints, rasterized on the drawing's own grid.
export function limbBar(g: Drawable, a: Point, b: Point, width: number, colour: string): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const px = (-dy * width) / (2 * length);
  const py = (dx * width) / (2 * length);
  const corners: [Point, Point, Point, Point] = [
    [a[0] + px, a[1] + py],
    [b[0] + px, b[1] + py],
    [b[0] - px, b[1] - py],
    [a[0] - px, a[1] - py],
  ];
  g.tri(corners[0], corners[1], corners[2], colour);
  g.tri(corners[0], corners[2], corners[3], colour);
}

// Move the hips toward the planted leg while the other knee recovers.
function supportShift(lf: number, rf: number): number {
  if (rf < lf) {
    return -2 / 3;
  }
  return lf < rf ? 2 / 3 : 0;
}

interface LegOptions {
  centres?: readonly [number, number];
  top?: number;
  width?: number;
  x0?: number;
}

// Bent recovery knees and planted support feet; standing feet stay on the existing rows.
export function humanLegs(
  g: Drawable,
  lf: number,
  rf: number,
  bob: number,
  legs: string,
  shade: string,
  shoes: string,
  { centres = [13, 19], top = 33, width = 4, x0 = 0 }: LegOptions = {},
): void {
  const shift = supportShift(lf, rf);
  const kneeY = (top + 43) / 2;
  for (const [side, cx, lift] of [
    [-1, centres[0] + x0, lf],
    [1, centres[1] + x0, rf],
  ] as const) {
    const bend = lift < 0 ? -side : 0;
    const hip: Point = [cx + shift, top + bob];
    const knee: Point = [cx + bend, kneeY + lift * 0.45];
    const ankle: Point = [cx, 43 + lift];
    limbBar(g, hip, knee, width, legs);
    limbBar(g, knee, ankle, width - 0.5, legs);
    limbBar(g, [hip[0] + width / 3, hip[1]], [knee[0] + width / 3, knee[1]], 0.8, shade);
    limbBar(g, [knee[0] + width / 3, knee[1]], [ankle[0] + width / 3, ankle[1]], 0.8, shade);
    g.rect(cx - width / 2, 43 + lift, width, 2, shoes);
    if (shoes === "white") {
      g.rect(cx - width / 2, 44 + lift, width, 1, "lgrey");
    }
  }
}

// A walker's back-view pose: the lifted feet, bob, arm swing, flare and reach, and the upper body's
// sway.
export interface WalkerPose {
  arms?: number;
  bob?: number;
  flare?: number;
  lf?: number;
  reach?: number;
  rf?: number;
  sway?: number;
}

// Human-only eight-beat gait. Each half stride has a planted support foot and a bent recovery knee.
export const HUMAN_WALK: readonly WalkerPose[] = [
  { arms: 1, rf: -3 },
  { arms: 1, bob: -2 / 3, rf: -2 },
  {},
  { arms: -1, lf: -1 },
  { arms: -1, lf: -3 },
  { arms: -1, bob: -2 / 3, lf: -2 },
  {},
  { arms: 1, rf: -1 },
];

export const HUMAN_WALK_MS = 50;

// The breathing bob every standing person shares, and its frame duration in ms.
export const BREATH: readonly number[] = [0, -1];

export const BREATH_MS = 400;

// Four-beat gait for animals and bespoke performers: the left foot lifted, both feet 1px up as the
// body passes over them 1px higher, the right foot lifted, passing again; 4 frames at 100ms, a 400ms
// stride. arms swings the free arms against the legs: 1 takes the screen-left arm back (its hand 1
// row up) with the left foot lifted, -1 the screen-right arm with the right foot (see swung).
export const PERSON_WALK: readonly WalkerPose[] = [
  { arms: 1, lf: -2 },
  { bob: -1, lf: -1, rf: -1 },
  { arms: -1, rf: -2 },
  { bob: -1, lf: -1, rf: -1 },
];

export const PERSON_WALK_MS = 100;

// Shear a person about its feet: the head moves k layout pixels sideways (k x the grid's height / 48
// pixels), the shoes stay put.
export function lean(source: Drawable, k: number): Drawable {
  const g = raster(source);
  const f = g.h / 48;
  const out = scope.Grid(g.w, g.h);
  if (out instanceof Grid) {
    out.edge = g.edge;
  }
  for (let y = 0; y < g.h; y++) {
    const dx = Math.round((k * f * Math.max(0, 44 * f - y)) / (36 * f));
    for (let x = 0; x < g.w; x++) {
      if (g.px[y]![x] && x + dx >= 0 && x + dx < g.w) {
        out.px[y]![x + dx] = g.px[y]![x]!;
      }
    }
  }
  return out;
}

// ---------- the walkers waving (front view) ----------
// A walker waving, facing the camera: the same clothes, colours and frame as the back view, feet on
// the same rows, the left arm (screen right) raised and swinging from the shoulder.

export type RaisedArm = (
  g: Drawable,
  x: number,
  w: number,
  top: number,
  bottom: number,
  dx: number,
  parts: readonly ArmPart[],
) => void;

// An arm raised from the shoulder (its bottom row) to the hand (its top row), tilted so the hand sits
// dx pixels right of the shoulder; every row shifts in proportion, so it pivots at the shoulder.
// parts are [rows, fill, shade] from the hand down, the last running to the shoulder; shade takes the
// right column.
export const raisedArm: RaisedArm = (g, x, w, top, bottom, dx, parts) => {
  let y = top;
  parts.forEach(([rows, fill, shade], i) => {
    const end = i === parts.length - 1 ? bottom + 1 : y + rows;
    // each run of rows with the same shift is one rect, so drawn bigger the arm stays solid
    let yy = y;
    while (yy < end) {
      const s = Math.round((dx * (bottom - yy)) / (bottom - top));
      let n = 1;
      while (yy + n < end && Math.round((dx * (bottom - yy - n)) / (bottom - top)) === s) {
        n += 1;
      }
      g.rect(x + s, yy, w, n, fill);
      g.rect(x + s + w - 1, yy, 1, n, shade);
      yy += n;
    }
    y = end;
  });
  // the thumb, so the hand reads as an open palm
  g.p(x + Math.round((dx * (bottom - top - 1)) / (bottom - top)) - 1, top + 1, parts[0]![1]);
};

// The painter the front views raise their arm with; cheering swaps it while it draws.
export const painters: { raisedArm: RaisedArm } = { raisedArm };

// Eyes for dark skin: a white beside each ink pupil, so they hold on the face.
export function frontEyes(g: Drawable, cx: number, y: number): void {
  for (const x of [cx - 5, cx + 3]) {
    g.rect(x, y, 1, 2, "white");
    g.rect(x + 1, y, 1, 2, "ink");
  }
}

// [left column, top row, size] in pixels of each eye faceFront draws at (cx, y) with spread: 2px at
// 1x, and on a Mini the eyes mini.ts's faceFront draws at its scale.
function eyeBoxes(g: Drawable, cx: number, y: number, spread = 4): [number, number, number][] {
  const s = scaleOf(g);
  const n = Math.max(1, Math.floor(2 * s + 0.5));
  const top = Math.floor((y + 1) * s + 0.5 - n / 2);
  return [cx - spread, cx + spread].map((x) => [Math.floor(x * s + 0.5 - n / 2), top, n]);
}

// Round clear glasses on the eyes faceFront draws at (cx, y): a ring 1px out from each eye with its
// corners cut, and a bridge between them a row under the eyes' top. Inside each ring the lens shows
// skin with a 2px pupil glinting white at its top-left, set toward the nose, so they read as glasses
// and not sunglasses. Drawn in pixels round the eyes, so they fit them at any scale.
export function glasses(
  g: Drawable,
  cx: number,
  y: number,
  c: string,
  spread = 4,
  skin = "skin1",
): void {
  const px = raster(g);
  const [[lx, top, n], [rx]] = eyeBoxes(g, cx, y, spread) as [
    [number, number, number],
    [number, number, number],
  ];
  if (n >= 3) {
    for (const [x0, inner] of [
      [lx, lx + n - 2],
      [rx, rx],
    ] as const) {
      px.rect(x0, top, n, n, skin);
      px.rect(inner, top + n - 2, 2, 2, "ink");
      px.p(inner, top + n - 2, "white");
    }
  }
  for (const x0 of [lx, rx]) {
    px.rect(x0 - 1, top, 1, n, c);
    px.rect(x0 + n, top, 1, n, c);
    px.rect(x0, top - 1, n, 1, c);
    px.rect(x0, top + n, n, 1, c);
  }
  px.rect(lx + n + 1, top + 1, rx - lx - n - 2, 1, c);
}

// A small nose between the eyes faceFront draws at (cx, y), just under their bottom row: a 1px
// shadow down its right side and a pixel at its tip, so glasses have something to sit on.
export function nose(g: Drawable, cx: number, y: number, c = "skin2", spread = 4): void {
  const px = raster(g);
  const [[lx, top, n], [rx]] = eyeBoxes(g, cx, y, spread) as [
    [number, number, number],
    [number, number, number],
  ];
  const mid = Math.floor((lx + n + rx) / 2);
  px.rect(mid, top + n, 1, 2, c);
  px.p(mid - 1, top + n + 1, c);
}

// Move the smile faceFront draws at (cx, y) up a drawn pixel, the skin closing in under it.
export function raiseMouth(
  g: Drawable,
  cx: number,
  y: number,
  lips = "dbrown",
  skin = "skin1",
): void {
  const px = raster(g);
  const s = scaleOf(g);
  const col = K[lips]!;
  const fill = K[skin]!;
  const spots: [number, number][] = [];
  for (let yy = Math.floor((y + 3) * s); yy < Math.ceil((y + 7) * s); yy++) {
    for (let x = Math.floor((cx - 3) * s); x < Math.ceil((cx + 3) * s); x++) {
      if (px.px[yy]![x] === col) {
        spots.push([x, yy]);
      }
    }
  }
  for (const [x, yy] of spots) {
    px.px[yy]![x] = fill;
  }
  for (const [x, yy] of spots) {
    px.px[yy - 1]![x] = col;
  }
}

// A walker's front-view pose: the wave's hand swing and the bob.
export interface FrontPose {
  bob?: number;
  wave?: number;
}

// A frame's pixel rows moved hop rows up, the feet off the ground.
export function hopped(rows: Frame, hop: number): Frame {
  return [
    ...rows.slice(hop),
    ...Array.from({ length: Math.max(0, hop) }, () => Array<Colour>(rows[0]!.length).fill(null)),
  ];
}

// Toronto's black squirrel, for every squirrel drawing (squirrel, squirrelRun, hazards' squirrel dash
// and the icons): navy fur shaded ink and lit slate, a dslate streak down the tail, a dslate belly and
// paws held at the chest, navy feet and a grey nose. LIT's rim puts grey on its top-left edges and
// slate on the rest, so the dark fur and the tail's edge hold on the dslate road; the eyes keep their
// white glints.
export const SQUIRREL_FUR = {
  belly: "dslate",
  foot: "navy",
  fur: "navy",
  lit: "slate",
  nose: "grey",
  paw: "dslate",
  shade: "ink",
  streak: "dslate",
} as const;

// The squirrel is laid out small on the 32x32 animal grid, so at SCALE its body (head to feet,
// without the tail) stands about 20px, under the smallest dog's: a design unit is 1.5px, so lengths in
// thirds land on whole pixels. SQUIRREL_EYE is each eye's side and SQUIRREL_EYE_SPREAD each eye
// centre's distance from the head's centre column, both 2px at full size; minis.ts's squirrel head
// draws the eyes from them at every depth step.
export const SQUIRREL_EYE = 4 / 3;

export const SQUIRREL_EYE_SPREAD = 4 / 3;

// The squirrel's head facing the player, its eyes' centres on row y and either side of column x, with
// its ears, an ink chin line parting it from the body, and its face.
function squirrelHead(g: Drawable, x: number, y: number): void {
  const f = SQUIRREL_FUR;
  g.tri([x - 3, y - 0.7], [x - 2.3, y - 3.3], [x - 0.9, y - 2], f.fur);
  g.tri([x + 3, y - 0.7], [x + 2.3, y - 3.3], [x + 0.9, y - 2], f.fur);
  g.cel(x, y + 0.3 + 2 / 3, 3.1, 2.6, f.shade);
  g.cel(x, y + 0.3, 3.1, 2.6, f.fur, f.shade, f.lit);
  g.cel(x, y + 1.6, 1.6, 1, f.belly);
  // square eyes, each with a glint a quarter of its size at the top-left, so they read as two bright
  // eyes
  const e = SQUIRREL_EYE;
  for (const d of [-1, 1]) {
    const ex = x + d * SQUIRREL_EYE_SPREAD - e / 2;
    g.rect(ex, y - e / 2, e, e, "ink");
    g.rect(ex, y - e / 2, e / 2, e / 2, "white");
  }
  g.rect(x - 2 / 3, y + 4 / 3, 4 / 3, 2 / 3, f.nose);
}

// A person's top: drawn over the legs at bob, with the free arms' swing for a walk frame.
export type Top = (g: Drawable, b: number, arms?: number) => void;

export interface PersonOptions {
  arms?: number;
  bob?: number;
  grounded?: boolean;
  legs?: string;
  lf?: number;
  rf?: number;
  shoes?: string;
}

// A chibi person facing the player: legs and shoes, then the caller's top(g, bob), or top(g, bob,
// arms) for a walk frame whose free arms swing.
export function person(
  top: Top,
  {
    arms = 0,
    bob = 0,
    grounded = false,
    legs = "navy",
    lf = 0,
    rf = 0,
    shoes = "ink",
  }: PersonOptions = {},
): Drawable {
  const g = scope.Grid(32, 48);
  const shade = DARKER.get(K[legs]!)!;
  if (grounded) {
    humanLegs(g, lf, rf, bob, legs, shade, shoes);
  } else {
    for (const [x, f] of [
      [11, lf],
      [17, rf],
    ] as const) {
      g.rect(x, 33 + bob, 4, 10 + f - bob, legs);
      g.rect(x + 3, 33 + bob, 1, 10 + f - bob, shade);
      g.rect(x, 43 + f, 4, 2, shoes);
    }
  }
  if (arms) {
    top(g, bob, arms);
  } else {
    top(g, bob);
  }
  return g;
}

// How many rows a passer-by's free arm on screen side side (-1 left, 1 right) is shortened in a walk
// frame: an arm swung back, against the lifted foot on its side, shows its hand that much higher.
export function swung(arms: number, side: number): number {
  return arms * side < 0 ? Math.abs(arms) : 0;
}

// person(top, q) with the road outline and the lit rim.
export function dressed(top: Top, q: PersonOptions = {}): Drawable {
  return rim(edged(person(top, q)), LIT);
}

// One drawn pixel in g's layout pixels, across and down, so a 1px motion stays 1px at any scale. The
// vehicles in obstacles.ts share it.
export function unit(g: Drawable): [number, number] {
  return [1 / scaleOf(g), 1 / rowScaleOf(g)];
}

// Tread lines across a tire seen from behind, rows y to y + h - 1: one every 4u rows, climbing u a
// frame as the tire rolls away (frame f of 4), or falling when back (reversing), so the loop is
// seamless. u is one pixel at the drawn size. The vehicles in obstacles.ts share it.
export function treads(
  g: Drawable,
  x: number,
  y: number,
  w: number,
  h: number,
  f: number,
  u = 1,
  back = false,
): void {
  const last = Math.floor(Math.round(h / u) / 4) + 2;
  for (let k = -1; k < last; k++) {
    const ty = y + ((back ? f : 3 - f) + 4 * k) * u;
    if (y <= ty && ty + u <= y + h + 1e-9) {
      g.rect(x, ty, w, 1, "dslate");
    }
  }
}

// A strap running down from layout (x0, y0) to (x1, y1), exclusive: one pixel row per step, each step
// an equal share of the width. Drawn in pixels at the grid's scale, so its steps stay joined at SCALE.
export function stair(
  g: Drawable,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: string,
): void {
  const s = scaleOf(g);
  const px = raster(g);
  const e = (v: number): number => Math.floor(v * s + 0.5);
  const left = e(x0);
  const top = e(y0);
  const w = e(x1) - e(x0);
  const n = e(y1) - e(y0);
  for (let i = 0; i < n; i++) {
    px.rect(
      left + Math.floor((i * w) / n),
      top + i,
      Math.floor(((i + 1) * w) / n) - Math.floor((i * w) / n),
      1,
      c,
    );
  }
}

// The grid every drawing here makes and the drawings small() swaps while it runs (see mini.ts).
export const scope: RoadScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
  faceFront,
  squirrelHead,
};
