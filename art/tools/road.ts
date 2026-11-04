// Draw everything on the road except the dogs, and build its Aseprite sources and exports.
//
// People (walkers, forced stops, lucky people, the thief and the other dog's owner) are 48x72, the
// other dog, skunk and squirrel 48x48 and the pickups 24x24: their drawing functions lay them out on
// 32x48, 32x32 and 16x16, and sprites() draws them SCALE (1.5) times bigger on a scaling grid, never
// upscaled. The bark pop is 16x16. The ice cream truck (56x60, one lane, like
// obstacles.delivery_truck; tags idle, 2 frames at 400ms, and drive, 4 at 100ms) is drawn in its own
// pixels at 56x50 on a grid that keeps its columns and draws its rows ROW_SCALE (1.2) times; the
// puddle (112x48) is drawn in its own pixels, and so is the pothole (112x48, idle: 2 frames at 500ms,
// the glint moving a pixel on frame 1), a ground decal like the puddle, recessed into the road: a
// coal far wall under a broken far rim, murky water, a lit near lip with a slab tipped in and lit
// cracks, with no outline; the skunk's stink haze (112x60) is a ground decal laid out on an 88x40
// design and stretched to its frame on the drawn grid. All are chibi and in Endesga 32 with coloured
// outlines. The walker is seen from behind, like the dogs, except in wave, cheer and Mr. B's phone;
// everything coming down the road faces the player: jogger (48x72, run: 4 frames at 100ms, a knee
// driven up, then that foot passing down, each side in turn, the ponytail swinging out from behind
// the head) wears an orange racerback singlet with a white race bib on its front; kid-on-a-bike
// (48x72, ride: 4 frames at 100ms, the pedals going round, a 1px sway and the streamers fluttering)
// is a kid in a red helmet on a mauve bike with training wheels and a lit headlamp. The movers going
// up the road ahead of the pack are seen from behind too: stroller (48x72, walk: 8 frames at 80ms,
// the walkers' stride and pace) is a dad pushing a stroller one-handed, a takeaway coffee in his
// other hand, the stroller rolling beside him on his right.
//
// walker-<name> tags: walk (8 frames, 80ms), react (2, 120ms), stumble (4, 90ms), idle (2, 400ms),
// then wave (4 frames, 150ms, looping): the walker facing the camera, feet on the same rows as the
// back view, the left arm (screen right) raised and swinging from the shoulder, the hand 1, 3, 4 and
// 3 design pixels right of it. At rest (idle frame 0) a 48x72 walker's feet (the outline under the
// shoes) are on row 68 (Ada's on row 69), and the hands' top rows 20 above them, their outer columns
// 16 left and 16 right of the centre column (x 24). Then cheer (4 frames, 120ms, looping), drawn at
// 2x in the zone celebration: the front view with the hanging arm taken off and both arms raised
// from the shoulders in a V, the hands 1, 3, 4 and 3 design pixels out; a 2px crouch, a hop 2px and
// 3px up, then a 1px landing. Trista's tote stays on her shoulder. Mr. B also has phone (4 frames,
// 400ms, looping), appended after cheer: feet planted, head bowed toward a narrow handset held to his
// side, visible eyes looking down, beard below the mouth and a bare upper lip, breathing and tapping
// with one thumb. His new-walker welcome uses phone while the celebration plays around him. What
// stands on the road is a billboard seen from the walker's eye, as roadside objects in OutRun are: a
// front elevation (the ice cream truck a rear one, like obstacles.parked_car), with no top surface
// and its base on the last opaque row.
//
// Everything that stands or waits on the road has a looping idle: people and walkers breathe (a 1px
// bob of the head and shoulders). New tags go after the existing ones, so the frame indices the game
// uses stay put.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { type Scale, small, snap } from "./mini.ts";
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
  main,
  type Point,
  raster,
  rowScaleOf,
  scaleOf,
  type Sprite,
  type Tag,
} from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/road.ts preview OUT.png   every frame on the zone roads, scaled up
  node art/tools/road.ts build             write art/road/*.aseprite, then export
                                           public/art/sprites/*.png and *.json with Aseprite`;

// Python's math.copysign: m with the sign of v, a negative zero counting as negative.
function copysign(m: number, v: number): number {
  return v < 0 || Object.is(v, -0) ? -Math.abs(m) : Math.abs(m);
}

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    out.push(i);
  }
  return out;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

// What a sprite's frames are drawn on: each module's grid, swapped for a Mini by small(), and the
// drawings small() and minis.ts draw at the small size in its place.
export interface RoadScope extends DrawingScope {
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
export type RimPair = readonly [lit: string, shade: string | null];
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
export const ROW_SCALE = 1.2;
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
// for a start or a stumble.
export function walkerArms(
  g: Drawable,
  xs: readonly [number, number],
  w: number,
  top: number,
  parts: readonly ArmPart[],
  arms: number,
  flare: number,
  reach: number,
): void {
  for (const [x, side, fwd] of [
    [xs[0], -1, arms],
    [xs[1], 1, -arms],
  ] as const) {
    backArm(g, x, w, top, parts, { lift: Math.max(0, fwd) + reach, out: side * flare });
  }
}

// x * y as an unevaluated sum [hi, lo]: hi is the rounded product and lo its exact error, as C's
// fma(x, y, -hi) gives it (Dekker's product with Veltkamp's split).
function product(x: number, y: number): [number, number] {
  const hi = x * y;
  const split = (v: number): [number, number] => {
    const t = v * 134217729;
    const high = t - (t - v);
    return [high, v - high];
  };
  const [xh, xl] = split(x);
  const [yh, yl] = split(y);
  return [hi, xl * yl - (hi - xh * yh - xl * yh - xh * yl)];
}

// a + b as [sum, error] for |a| >= |b|, the error exact.
function fastSum(a: number, b: number): [number, number] {
  const x = a + b;
  return [x, b - (x - a)];
}

// The length of a vector, correctly rounded as CPython's math.hypot computes it (vector_norm: a
// power-of-two scale, a lossless sum of squares and one correction of the square root). Math.hypot
// can be an ulp off, which moves a limb's edge across a pixel centre.
function hypot(...coordinates: number[]): number {
  const abs = coordinates.map(Math.abs);
  const max = abs.reduce((a, b) => (b > a || Number.isNaN(b) ? b : a), 0);
  if (max === Infinity || abs.includes(Infinity)) {
    return Infinity;
  }
  if (Number.isNaN(max) || abs.some(Number.isNaN)) {
    return NaN;
  }
  if (max === 0 || abs.length <= 1) {
    return max;
  }
  // 2 ** -e puts max in [0.5, 1); subnormals are first scaled up into the normal range.
  const tiny = 2 ** -1022;
  if (max < tiny) {
    return tiny * hypot(...abs.map((v) => v / tiny));
  }
  const e = Math.floor(Math.log2(max)) + 1;
  let scale = 2 ** -e;
  if (max * scale >= 1) {
    scale /= 2;
  } else if (max * scale < 0.5) {
    scale *= 2;
  }
  let csum = 1;
  let frac1 = 0;
  let frac2 = 0;
  for (const v of abs) {
    const x = v * scale;
    const [hi, lo] = product(x, x);
    const [sum, err] = fastSum(csum, hi);
    csum = sum;
    frac1 += lo;
    frac2 += err;
  }
  let h = Math.sqrt(csum - 1 + (frac1 + frac2));
  const [hi, lo] = product(-h, h);
  const [sum, err] = fastSum(csum, hi);
  csum = sum;
  frac1 += lo;
  frac2 += err;
  h += (csum - 1 + (frac1 + frac2)) / (2 * h);
  return h / scale;
}

// A solid limb between joints, rasterized on the drawing's own grid.
export function limbBar(g: Drawable, a: Point, b: Point, width: number, colour: string): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.max(0.001, hypot(dx, dy));
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
export function supportShift(lf: number, rf: number): number {
  if (rf < lf) {
    return -2 / 3;
  }
  return lf < rf ? 2 / 3 : 0;
}

export interface LegOptions {
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

// A walker's back-view pose: the lifted feet, bob, arm swing, flare and reach, and the head's lean.
export interface WalkerPose {
  arms?: number;
  bob?: number;
  flare?: number;
  head?: number;
  lf?: number;
  reach?: number;
  rf?: number;
}

// Casey's cap and ponytail above a shaped hoodie, with bent elbows and recovery knees.
export function caseyBack({
  arms = 0,
  bob = 0,
  flare = 0,
  head = 0,
  lf = 0,
  reach = 0,
  rf = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  const shift = supportShift(lf, rf);
  humanLegs(g, lf, rf, b, "blue", "navy", "white");
  for (const side of [-1, 1]) {
    const shoulder: Point = [16 + side * 7 + shift, 23 + b];
    const elbow: Point = [16 + side * (8 + flare / 2), 28 + b + (arms * side) / 2];
    const hand: Point = [16 + side * (9 + flare), 33.5 - Math.max(0, arms * side) - reach];
    limbBar(g, shoulder, elbow, 4, side < 0 ? "sky" : "blue");
    limbBar(g, elbow, [hand[0], hand[1] - 1.3], 3.5, "sky");
    g.rect(hand[0] - 1.5, hand[1] - 1, 3, 2.5, "skin1");
  }
  g.tri([9 + shift, 22 + b], [23 + shift, 22 + b], [21 + shift, 34 + b], "sky");
  g.tri([9 + shift, 22 + b], [21 + shift, 34 + b], [11 + shift, 34 + b], "sky");
  g.rect(10 + shift, 25 + b, 12, 8, "sky");
  g.rect(20 + shift, 24 + b, 2, 9, "blue");
  g.rect(10 + shift, 25 + b, 1, 7, "cyan");
  g.rect(11 + shift, 33 + b, 10, 1, "blue");
  g.ell(16 + shift, 22.5 + b, 6, 2.5, "blue", "navy");
  const hb = b / 2;
  g.rect(14 + head, 19 + hb, 4, 3, "skin1");
  g.cel(16 + head, 12.5 + hb, 8.5, 8.5, "dbrown", "plum", "brown");
  g.rect(7 + head, 13 + hb, 2, 3, "skin1");
  g.rect(23 + head, 13 + hb, 2, 3, "skin1");
  g.cel(16 + head, 8 + hb, 8.5, 5, "amber", "orange", "yellow");
  g.rect(8 + head, 10 + hb, 17, 2, "orange");
  g.rect(15 + head, 10 + hb, 2, 2, "dbrown");
  g.ell(16 + head - shift / 2, 17 + hb, 2.5, 4, "dbrown", "plum");
  return g;
}

// ---------- the other walkers (back view) ----------

// Ada, 11, mixed race, caramel skin, long black curls falling straight down: yellow tee, blue shorts.
// She stands 4px shorter than the adults: her head and body sit lower and her legs are shorter.
export function adaBack({
  arms = 0,
  bob = 0,
  flare = 0,
  head = 0,
  lf = 0,
  reach = 0,
  rf = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  humanLegs(g, lf, rf, b, "brown", "skin2", "white", { centres: [13.5, 18.5], top: 40, width: 3 });
  for (const [x, f] of [
    [12, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 45 + f, 3, 1, "pink");
  }
  walkerArms(
    g,
    [7, 22],
    3,
    30 + b,
    [
      [3, "yellow", null],
      [4, "brown", null],
    ],
    arms,
    flare,
    reach,
  );
  g.rect(10, 29 + b, 12, 8, "yellow");
  g.rect(19, 29 + b, 3, 8, "amber");
  g.rect(10, 36 + b, 12, 4, "sky");
  g.rect(19, 36 + b, 3, 4, "blue");
  g.rect(15, 36 + b, 2, 4, "blue");
  g.rect(7, 20 + b, 2, 3, "brown");
  g.rect(23, 20 + b, 2, 3, "brown");
  // The crown tilts above the planted lower curls; the hidden neck stays joined to the shoulders.
  // black hair: a rounded crown, then long curls hanging straight down the back, bunched into bumps
  // of uneven size along the sides and the hem
  g.ell(16 + head, 18.5 + b, 8, 7.5, "navy", "ink", "dslate");
  g.rect(9, 20 + b, 14, 10, "navy");
  g.rect(21, 20 + b, 2, 10, "ink");
  for (const [x, y, rx, ry] of [
    [8.7, 20.5, 1.4, 1.5],
    [8.4, 24.2, 1.8, 2.1],
    [8.8, 28.6, 1.4, 1.3],
  ] as const) {
    g.ell(x, y + b, rx, ry, "navy");
  }
  for (const [x, y, rx, ry] of [
    [23.3, 22, 1.6, 1.9],
    [23.2, 26.6, 1.3, 1.4],
    [23.4, 29.3, 1.6, 1.5],
  ] as const) {
    g.ell(x, y + b, rx, ry, "ink");
  }
  for (const [x, y, rx, ry] of [
    [10.2, 30.6, 1.6, 1.4],
    [13.4, 31, 2, 1.6],
    [16.6, 30.4, 1.3, 1.3],
    [19.4, 30.8, 1.9, 1.5],
    [21.9, 30.2, 1.2, 1.2],
  ] as const) {
    g.ell(x, y + b, rx, ry, x < 20 ? "navy" : "ink");
  }
  // the curls as a few unbroken wavy locks down the back, dslate on the lit side and navy in the
  // shade, so the hair holds one mass at road scale with no single-pixel texture
  for (const [x0, y0, length, c] of CURL_LOCKS) {
    for (const [k, n] of curlRuns(length)) {
      const sway = head * Math.max(0, Math.min(1, (30 - y0 - k) / 10));
      g.rect(x0 + CURL_WAVE[k % CURL_WAVE.length]! + sway, y0 + k + b, 1, n, c);
    }
  }
  g.ell(16 + head, 12 + b, 2.5, 1.5, "pink", "mauve");
  // a light rim along the edges facing the light keeps her dark hair and skin off the dark road
  return rim(g, {
    blue: ["sky", null],
    brown: ["skin2", null],
    dslate: ["grey", "slate"],
    ink: ["grey", "slate"],
    navy: ["grey", "slate"],
  });
}

// Mr. B, 45, Black, bald (his beard is under his chin, out of sight from behind): lilac tee, navy
// track pants, sneakers. The tee's lilac is a hue no road has, so he reads on all six.
export function mrBBack({
  arms = 0,
  bob = 0,
  flare = 0,
  head = 0,
  lf = 0,
  reach = 0,
  rf = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  humanLegs(g, lf, rf, b, "navy", "grey", "white");
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x + 1, 43 + f, 2, 1, "red");
  }
  walkerArms(
    g,
    [5, 23],
    4,
    22 + b,
    [
      [4, "lilac", "violet"],
      [6, "dbrown", "plum"],
      [3, "dbrown", null],
    ],
    arms,
    flare,
    reach,
  );
  // the lilac tee, shaded dgreen down its right side
  g.rect(9, 21 + b, 14, 13, "lilac");
  g.rect(20, 21 + b, 3, 13, "violet");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(13 + head, 19 + b, 6, 3, "dbrown");
  // bald head, the beard showing along the jaw, a shine on the crown
  g.rect(8 + head, 12 + b, 2, 3, "dbrown");
  g.rect(22 + head, 12 + b, 2, 3, "plum");
  g.cel(16 + head, 12 + b, 7, 9, "dbrown", "plum", null, 2.15);
  g.rect(11 + head, 7 + b, 3, 1, "brown");
  g.p(11 + head, 8 + b, "brown");
  // a light rim along the edges facing the light, a dimmer one opposite, so he holds on the dark road
  return rim(g, {
    dbrown: ["skin2", "brown"],
    navy: ["grey", "grey"],
    plum: ["skin2", "brown"],
    violet: ["lilac", null],
  });
}

// Trista, 50, dirty blonde bob to the shoulders, cute: green cardigan, brown skirt, tights, brown
// flats.
export function tristaBack({
  arms = 0,
  bob = 0,
  flare = 0,
  head = 0,
  lf = 0,
  reach = 0,
  rf = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  humanLegs(g, lf, rf, b, "dslate", "navy", "dbrown", { centres: [13.5, 19.5], top: 37, width: 3 });
  walkerArms(
    g,
    [5, 23],
    4,
    22 + b,
    [
      [10, "dgreen", "forest"],
      [3, "skin1", null],
    ],
    arms,
    flare,
    reach,
  );
  g.rect(9, 21 + b, 14, 11, "dgreen");
  g.rect(20, 21 + b, 3, 11, "forest");
  g.rect(9, 21 + b, 1, 10, "green");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(9, 31 + b, 14, 7, "clay");
  g.rect(20, 31 + b, 3, 7, "bark");
  g.rect(9, 31 + b, 14, 1, "tan");
  // a canvas tote with an apple on it
  g.rect(25, 24 + b, 5, 1, "brown");
  g.rect(24, 25 + b, 7, 8, "cream");
  g.rect(29, 25 + b, 2, 8, "tan");
  g.rect(26, 27 + b, 3, 3, "red");
  g.p(27, 26 + b, "dgreen");
  // a dirty blonde bob to the shoulders, flicking out at the ends: light brown, darker than her
  // skin, with golden amber streaks where the light catches it
  g.cel(16 + head, 12.5 + b, 9, 9, "brown", "dbrown", "tan");
  g.rect(8 + head, 14 + b, 17, 5, "brown");
  g.rect(22 + head, 14 + b, 3, 5, "dbrown");
  g.ell(16 + head, 19 + b, 9, 2.5, "brown", "dbrown");
  g.p(7 + head, 20 + b, "brown");
  g.p(25 + head, 20 + b, "dbrown");
  for (const [x, y, h] of [
    [10, 9, 5],
    [13, 6, 4],
    [16, 8, 6],
    [19, 6, 3],
  ] as const) {
    g.rect(x + head, y + b, 1, h, "amber");
  }
  g.rect(14 + head, 11 + b, 1, 4, "dbrown");
  g.rect(20 + head, 11 + b, 1, 4, "dbrown");
  // a light rim along the edges facing the light keeps her hair, cardigan and skirt off the dark road
  return rim(g, {
    brown: ["tan", null],
    dgreen: ["green", null],
    dslate: ["grey", null],
    navy: ["grey", null],
  });
}

// Ada's curly locks as [x, top row, rows, colour], each a 1px line swinging along CURL_WAVE as it
// falls, two rows at a time, so every pixel of a lock touches the next.
export const CURL_LOCKS: readonly (readonly [number, number, number, string])[] = [
  [11, 20, 10, "dslate"],
  [15, 19, 10, "dslate"],
  [19, 21, 8, "ink"],
];
export const CURL_WAVE: readonly number[] = [0, 0, 1, 1, 0, 0, -1, -1];

// [first row, rows] of each straight run of a lock length rows long: a run is one 1px-wide rect, so
// drawn bigger the lock stays unbroken.
export function curlRuns(length: number): [number, number][] {
  const out: [number, number][] = [];
  let k = 0;
  while (k < length) {
    let n = 1;
    while (
      k + n < length &&
      CURL_WAVE[(k + n) % CURL_WAVE.length] === CURL_WAVE[k % CURL_WAVE.length]
    ) {
      n += 1;
    }
    out.push([k, n]);
    k += n;
  }
  return out;
}

export type WalkerDraw = (pose?: WalkerPose) => Drawable;

export const WALKERS: readonly (readonly [string, WalkerDraw])[] = [
  ["walker-casey", caseyBack],
  ["walker-ada", adaBack],
  ["walker-mr-b", mrBBack],
  ["walker-trista", tristaBack],
];

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
// The head settles after each weight transfer; the neutral first pose keeps pack visibility stable.
// A 2/3 design-pixel movement is one native export pixel.
export const WALKER_HEAD: readonly number[] = [0, -2 / 3, -2 / 3, 0, 2 / 3, 2 / 3, 0, 0];
export const WALKER_WALK: readonly WalkerPose[] = HUMAN_WALK.map((pose, i) => ({
  ...pose,
  head: WALKER_HEAD[i]!,
}));
export const WALKER_WALK_MS = 80;
export const WALKER_REACT: readonly WalkerPose[] = [
  { bob: -4, flare: 3, lf: -4, reach: 1, rf: -4 },
  { bob: -1, flare: 1, lf: -1, rf: -1 },
];
// A bump: lurch left with the arms up, wobble back, steady (a right lean would push a tote out of the
// frame). Each pose is [lean, walker pose].
export const WALKER_STUMBLE: readonly (readonly [number, WalkerPose])[] = [
  [-2, { arms: 1, flare: 2, rf: -3 }],
  [1, { arms: -1, flare: 3, lf: -1 }],
  [-1, { arms: -1, bob: -2 / 3, flare: 1, lf: -2 }],
  [0, {}],
];
// Waiting while the walk pauses: feet planted, arms at rest, a 1px breath.
export const WALKER_IDLE: readonly WalkerPose[] = [{}, { bob: -1 }];
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
const painters: { raisedArm: RaisedArm } = { raisedArm };

// Eyes for dark skin: a white beside each ink pupil, so they hold on the face.
export function frontEyes(g: Drawable, cx: number, y: number): void {
  for (const x of [cx - 5, cx + 3]) {
    g.rect(x, y, 1, 2, "white");
    g.rect(x + 1, y, 1, 2, "ink");
  }
}

// [left column, top row, size] in pixels of each eye faceFront draws at (cx, y) with spread: 2px at
// 1x, and on a Mini the eyes mini.ts's faceFront draws at its scale.
export function eyeBoxes(
  g: Drawable,
  cx: number,
  y: number,
  spread = 4,
): [number, number, number][] {
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

// Casey facing the camera: the amber cap's orange brim over the eyes, sky hoodie with a blue kangaroo
// pocket and white drawstrings, jeans, white sneakers.
export function caseyFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  for (const x of [11, 17]) {
    g.rect(x, 33 + b, 4, 10 - b, "blue");
    g.rect(x + 3, 33 + b, 1, 10 - b, "navy");
    g.rect(x, 43, 4, 2, "white");
    g.rect(x, 44, 4, 1, "lgrey");
  }
  g.rect(5, 22 + b, 4, 10, "sky");
  g.rect(5, 22 + b, 1, 10, "cyan");
  g.rect(8, 22 + b, 1, 10, "blue");
  g.rect(5, 32 + b, 4, 3, "skin1");
  g.rect(9, 21 + b, 14, 13, "sky");
  g.rect(20, 21 + b, 3, 13, "blue");
  g.rect(9, 21 + b, 1, 12, "cyan");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(9, 33 + b, 14, 1, "blue");
  g.rect(11, 27 + b, 10, 5, "blue");
  g.rect(12, 28 + b, 8, 4, "sky");
  g.rect(14, 22 + b, 1, 4, "white");
  g.rect(17, 22 + b, 1, 4, "white");
  g.cel(16, 21.5 + b, 6, 2, "blue");
  g.rect(14, 19 + b, 4, 3, "skin2");
  painters.raisedArm(g, 23, 4, 9 + b, 23 + b, wave, [
    [3, "skin1", "skin2"],
    [0, "sky", "blue"],
  ]);
  // head: hair at the sides under the cap, ears, face, then the cap with its brim towards the camera
  g.cel(16, 11 + b, 8.5, 6, "dbrown", "plum", "brown");
  g.rect(7, 13 + b, 2, 3, "skin1");
  g.rect(23, 13 + b, 2, 3, "skin1");
  faceDisc(g, 16, 14 + b, 7.5, 6.5, "skin1", "skin2");
  g.cel(16, 8 + b, 8.5, 5, "amber", "orange", "yellow");
  g.rect(7, 10 + b, 18, 2, "orange");
  g.rect(7, 11 + b, 18, 1, "rust");
  g.p(16, 6 + b, "yellow");
  scope.faceFront(g, 16, 14 + b);
  nose(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
  return g;
}

// Ada facing the camera, 4px shorter than the adults: long black curls framing her face and falling
// past her shoulders, a pink clip, yellow tee, blue shorts.
export function adaFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  for (const x of [12, 17]) {
    g.rect(x, 40 + b, 3, 3 - b, "brown");
    g.rect(x, 43, 3, 1, "white");
    g.rect(x, 44, 3, 1, "lgrey");
    g.rect(x, 45, 3, 1, "pink");
  }
  // the curls behind her shoulders, then the tee and shorts over them
  g.cel(16, 18.5 + b, 8.5, 8, "navy", "ink", "dslate");
  g.rect(8, 19 + b, 16, 11, "navy");
  g.rect(21, 19 + b, 3, 11, "ink");
  for (const [x, y, rx, ry, c] of [
    [8.4, 23, 1.6, 2, "navy"],
    [8.6, 28, 1.4, 1.6, "navy"],
    [23.6, 23.5, 1.4, 1.8, "ink"],
    [23.4, 28.4, 1.5, 1.5, "ink"],
  ] as const) {
    g.cel(x, y + b, rx, ry, c);
  }
  g.rect(7, 30 + b, 3, 7, "brown");
  g.rect(7, 30 + b, 3, 3, "yellow");
  g.rect(10, 29 + b, 12, 8, "yellow");
  g.rect(19, 29 + b, 3, 8, "amber");
  g.rect(14, 29 + b, 4, 1, "amber");
  g.rect(10, 36 + b, 12, 4, "sky");
  g.rect(19, 36 + b, 3, 4, "blue");
  g.rect(15, 38 + b, 2, 2, "blue");
  g.rect(14, 26 + b, 4, 3, "dbrown");
  painters.raisedArm(g, 22, 3, 16 + b, 31 + b, wave, [
    [3, "brown", "dbrown"],
    [9, "brown", "dbrown"],
    [0, "yellow", "amber"],
  ]);
  // her face, then the curls over her forehead, lit dslate on the left
  faceDisc(g, 16, 20.5 + b, 6.5, 6.5, "brown", "dbrown");
  g.rect(10, 18 + b, 1, 4, "navy");
  g.rect(22, 18 + b, 1, 4, "ink");
  g.cel(16, 14.5 + b, 7.5, 3.5, "navy", "ink", "dslate");
  for (const [x, y] of [
    [11, 16],
    [14, 17],
    [18, 17],
    [21, 16],
  ] as const) {
    g.p(x, y + b, "navy");
  }
  g.rect(11, 12 + b, 3, 1, "dslate");
  g.cel(21, 13 + b, 2, 1.5, "pink", "mauve");
  scope.faceFront(g, 16, 20 + b);
  nose(g, 16, 20 + b, "dbrown");
  return rim(g, {
    blue: ["sky", null],
    brown: ["skin2", null],
    dslate: ["grey", "slate"],
    ink: ["grey", "slate"],
    navy: ["grey", "slate"],
  });
}

// Mr. B facing the camera: bald, the chin-strap beard along his jaw and under his chin, a smile,
// lilac tee, navy track pants with a grey stripe, white sneakers.
export function mrBFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  for (const x of [11, 17]) {
    g.rect(x, 33 + b, 4, 10 - b, "navy");
    g.rect(x + (x < 16 ? 0 : 3), 33 + b, 1, 10 - b, "grey");
    g.rect(x, 43, 4, 2, "white");
    g.rect(x, 44, 4, 1, "lgrey");
    g.rect(x + 1, 43, 2, 1, "red");
  }
  g.rect(5, 22 + b, 4, 4, "lilac");
  g.rect(8, 22 + b, 1, 4, "violet");
  g.rect(5, 26 + b, 4, 6, "dbrown");
  g.rect(8, 26 + b, 1, 6, "plum");
  g.rect(5, 32 + b, 4, 3, "dbrown");
  g.rect(9, 21 + b, 14, 13, "lilac");
  g.rect(20, 21 + b, 3, 13, "violet");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(13, 19 + b, 6, 3, "plum");
  g.rect(13, 21 + b, 6, 1, "violet");
  painters.raisedArm(g, 23, 4, 9 + b, 23 + b, wave, [
    [3, "dbrown", "plum"],
    [8, "dbrown", "plum"],
    [0, "lilac", "violet"],
  ]);
  g.rect(8, 12 + b, 2, 3, "dbrown");
  g.rect(22, 12 + b, 2, 3, "plum");
  faceDisc(g, 16, 12 + b, 7, 9, "dbrown", "plum");
  g.rect(11, 7 + b, 3, 1, "brown");
  g.p(11, 8 + b, "brown");
  // the beard runs down the jaw and round under the chin, leaving the upper lip bare
  g.rect(9, 14 + b, 1, 4, "ink");
  g.rect(22, 14 + b, 1, 4, "ink");
  g.cel(16, 18.5 + b, 6, 2.5, "ink");
  g.rect(13, 16 + b, 6, 1, "dbrown");
  frontEyes(g, 16, 12 + b);
  nose(g, 16, 12 + b, "plum");
  g.rect(14, 17 + b, 4, 1, "cream");
  g.p(13, 16 + b, "cream");
  g.p(18, 16 + b, "cream");
  return rim(g, MR_B_RIM);
}

const MR_B_RIM: Rims = {
  dbrown: ["skin2", "brown"],
  ink: ["grey", "slate"],
  navy: ["grey", "grey"],
  plum: ["skin2", "brown"],
  violet: ["lilac", null],
};

// Mr. B absorbed in his phone: bald head bowed, pupils down toward a small side-held phone, bare
// upper lip, chin beard.
export function mrBPhone({ bob = 0, tap = 0 }: { bob?: number; tap?: number } = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  for (const x of [11, 17]) {
    g.rect(x, 33 + b, 4, 10 - b, "navy");
    g.rect(x + (x < 16 ? 0 : 3), 33 + b, 1, 10 - b, "grey");
    g.rect(x, 43, 4, 2, "white");
    g.rect(x, 44, 4, 1, "lgrey");
    g.rect(x + 1, 43, 2, 1, "red");
  }
  // The sleeves slope into low elbows; both forearms turn inward to the handset.
  g.rect(7, 24 + b, 5, 5, "lilac");
  g.rect(22, 24 + b, 4, 5, "violet");
  g.rect(9, 23 + b, 14, 11, "lilac");
  g.rect(20, 23 + b, 3, 11, "violet");
  g.rect(13, 22 + b, 6, 3, "plum");
  g.rect(7, 29 + b, 4, 4, "dbrown");
  g.rect(8, 32 + b, 11, 3, "dbrown");
  g.rect(9, 34 + b, 10, 1, "plum");
  g.rect(22, 29 + b, 4, 4, "dbrown");
  g.rect(21, 32 + b, 4, 3, "dbrown");
  g.rect(24, 29 + b, 2, 4, "plum");
  // More scalp above the low-set eyes and the chin tucked into the collar show the downward gaze.
  g.rect(8, 17 + b, 2, 3, "dbrown");
  g.rect(22, 17 + b, 2, 3, "plum");
  faceDisc(g, 16, 16 + b, 7, 8, "dbrown", "plum");
  g.rect(11, 11 + b, 3, 1, "brown");
  g.p(11, 12 + b, "brown");
  // Low upper lids leave two native rows of white, with pupils resting on the bottom row.
  const px = raster(g);
  const s = scaleOf(g);
  for (const x of [12, 18]) {
    const left = Math.floor(x * s + 0.5);
    const right = Math.floor((x + 3) * s + 0.5);
    const bottom = Math.floor((20 + b) * s + 0.5) - 1;
    g.rect(x, 17 + b, 3, 1, "plum");
    px.rect(left, bottom - 2, right - left, 1, "plum");
    px.rect(left, bottom - 1, right - left, 2, "white");
    px.p(right - 2, bottom, "ink");
  }
  g.rect(16, 21 + b, 2, 1, "plum");
  // Leave the upper lip bare; facial hair begins below the mouth, on the chin and lower jaw.
  g.rect(15, 22 + b, 3, 1, "ink");
  g.cel(16, 24.5 + b, 5.5, 1.5, "ink");
  // A narrow portrait handset sits to screen right, below and clear of his face.
  g.rect(19, 27 + b, 5, 9, "ink");
  g.rect(20, 28 + b, 3, 6, "foam");
  g.rect(20, 32 + b, 3, 2, "shallow");
  g.p(21, 28 + b, "dslate");
  g.p(21, 35 + b, "grey");
  g.rect(17, 32 + b, 3, 3, "dbrown");
  g.rect(23, 30 + b, 2, 4, "dbrown");
  g.rect(19 + tap, 30 + b, 2, 1, "brown");
  return rim(g, MR_B_RIM);
}

// Trista facing the camera: a dirty blonde bob framing her face with a side-swept fringe, round
// glasses, a green cardigan open over a white blouse, brown skirt, tights, brown flats, her apple tote
// on her right shoulder (screen left).
export function tristaFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  for (const x of [11, 17]) {
    g.rect(x + 1, 37 + b, 3, 6 - b, "dslate");
    g.rect(x, 43, 4, 2, "dbrown");
  }
  g.rect(5, 22 + b, 4, 10, "dgreen");
  g.rect(8, 22 + b, 1, 10, "forest");
  g.rect(5, 22 + b, 1, 10, "green");
  g.rect(5, 32 + b, 4, 3, "skin1");
  g.rect(9, 21 + b, 14, 11, "dgreen");
  g.rect(20, 21 + b, 3, 11, "forest");
  g.rect(9, 21 + b, 1, 10, "green");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(14, 21 + b, 4, 10, "white");
  g.rect(17, 22 + b, 1, 9, "lgrey");
  g.tri([12, 21 + b], [16, 21 + b], [14.5, 24.5 + b], "white");
  g.tri([16, 21 + b], [20, 21 + b], [17.5, 24.5 + b], "white");
  for (const y of [25, 28]) {
    g.p(13, y + b, "amber");
  }
  g.rect(9, 31 + b, 14, 7, "clay");
  g.rect(20, 31 + b, 3, 7, "bark");
  g.rect(9, 31 + b, 14, 1, "tan");
  // the canvas tote hangs off her shoulder by a strap, the apple facing out
  g.rect(7, 21 + b, 1, 5, "brown");
  g.rect(2, 26 + b, 7, 8, "cream");
  g.rect(7, 26 + b, 2, 8, "tan");
  g.rect(4, 28 + b, 3, 3, "red");
  g.p(5, 27 + b, "dgreen");
  // the bob's left flick goes under the arms, so a raised arm covers it
  g.p(6, 19 + b, "brown");
  g.rect(7, 19 + b, 2, 1, "brown");
  painters.raisedArm(g, 23, 4, 9 + b, 23 + b, wave, [
    [3, "skin1", "skin2"],
    [0, "dgreen", "forest"],
  ]);
  // the bob: hair behind and beside the face to the shoulders, flicking out, then the face and fringe
  g.cel(16, 12.5 + b, 9, 9, "brown", "dbrown", "tan");
  g.rect(7, 12 + b, 18, 7, "brown");
  g.rect(22, 12 + b, 3, 7, "dbrown");
  g.p(25, 19 + b, "dbrown");
  g.rect(23, 19 + b, 2, 1, "dbrown");
  faceDisc(g, 16, 14.5 + b, 6.5, 6.5, "skin1", "skin2");
  g.rect(14, 19 + b, 4, 2, "skin2");
  g.cel(17, 8.5 + b, 8, 3.5, "brown", "dbrown", "tan");
  g.tri([8, 8 + b], [19, 9 + b], [9, 13.5 + b], "brown");
  for (const [x, y, h] of [
    [11, 6, 3],
    [15, 5, 3],
    [19, 6, 2],
  ] as const) {
    g.rect(x, y + b, 1, h, "amber");
  }
  // her eyes sit closer together than the others', behind her glasses
  scope.faceFront(g, 16, 14 + b, { spread: 3 });
  raiseMouth(g, 16, 14 + b);
  nose(g, 16, 14 + b, "skin2", 3);
  glasses(g, 16, 14 + b, "dbrown", 3);
  return rim(g, {
    brown: ["tan", null],
    dgreen: ["green", null],
    dslate: ["grey", null],
    navy: ["grey", null],
  });
}

export type FrontDraw = (pose?: FrontPose) => Drawable;

export const WAVES: ReadonlyMap<string, FrontDraw> = new Map([
  ["walker-casey", caseyFront],
  ["walker-ada", adaFront],
  ["walker-mr-b", mrBFront],
  ["walker-trista", tristaFront],
]);
// The hand's swing right of the shoulder, one frame each: out, further, back.
export const WALKER_WAVE: readonly number[] = [1, 3, 4, 3];
export const WALKER_WAVE_MS = 150;

// ---------- the walkers cheering (front view) ----------
// The wave drawing with both arms raised: the hanging arm is cleared, then the right arm is raised as
// the wave raises it and the left as its mirror. CHEER_ARMS gives each walker's hanging arm on the
// 32x48 design grid as rects [x0, x1, y0, y1: columns x0 to x1 - 1, rows y0 to y1 - 1 before the
// crouch] and its colours; only those colours are cleared, so what overlaps the arm (Trista's tote)
// stays.
export const CHEER_ARMS: ReadonlyMap<
  string,
  readonly [readonly (readonly [number, number, number, number])[], readonly string[]]
> = new Map([
  ["walker-casey", [[[5, 9, 22, 35]], ["sky", "cyan", "blue", "skin1"]]],
  ["walker-mr-b", [[[5, 9, 22, 35]], ["lilac", "violet", "dbrown", "plum"]]],
  ["walker-ada", [[[7, 10, 30, 37]], ["brown", "dbrown", "yellow", "amber"]]],
  [
    "walker-trista",
    [
      [
        [5, 9, 22, 26],
        [5, 9, 34, 35],
      ],
      ["dgreen", "forest", "green", "skin1"],
    ],
  ],
]);
// One frame each: [crouch in design pixels, the hands' swing out from the shoulders, hop in pixels]:
// crouch, take off, the top of the hop, land.
export const WALKER_CHEER: readonly (readonly [number, number, number])[] = [
  [2, 1, 0],
  [0, 3, 2],
  [0, 4, 3],
  [1, 3, 0],
];
export const WALKER_CHEER_MS = 120;

// key's front view (WAVES) with both arms raised swing design pixels out from the shoulders,
// crouched bob.
export function cheering(
  name: string,
  swing: number,
  { bob = 0 }: { bob?: number } = {},
): Drawable {
  const [rects, cols] = CHEER_ARMS.get(name)!;
  const hexes = new Set(cols.map((c) => K[c]!));
  const lift = painters.raisedArm;
  const both: RaisedArm = (g, x, w, top, bottom, _swing, parts) => {
    const inner = raster(g);
    const s = scaleOf(g);
    for (const [x0, x1, y0, y1] of rects) {
      for (let yy = Math.floor((y0 + bob) * s); yy < Math.ceil((y1 + bob) * s); yy++) {
        for (let xx = Math.floor(x0 * s); xx < Math.ceil(x1 * s); xx++) {
          if (yy >= 0 && yy < inner.h && hexes.has(inner.px[yy]![xx]!)) {
            inner.px[yy]![xx] = null;
          }
        }
      }
    }
    lift(g, x, w, top, bottom, swing, parts);
    // the mirrored arm's thumb goes on the hand's inner (right) side, as a mirror of the raised one's
    const left = 32 - x - w;
    lift(g, left, w, top, bottom, -swing, parts);
    const thumb = left + Math.round((-swing * (bottom - top - 1)) / (bottom - top)) - 1;
    g.p(thumb, top + 1, null);
    g.p(thumb + w + 1, top + 1, parts[0]![1]);
  };
  painters.raisedArm = both;
  try {
    return WAVES.get(name)!({ bob, wave: 0 });
  } finally {
    painters.raisedArm = lift;
  }
}

// A frame's pixel rows moved hop rows up, the feet off the ground.
export function hopped(rows: Frame, hop: number): Frame {
  return [
    ...rows.slice(hop),
    ...Array.from({ length: Math.max(0, hop) }, () => Array<Colour>(rows[0]!.length).fill(null)),
  ];
}

// ---------- pickups ----------

// The treat's idle: it bobs a pixel up and back, its heart glinting at the top of the bob.
export const TREAT_IDLE: readonly { lift: number }[] = [{ lift: 0 }, { lift: -1 }];
// The heart on the treat's bone, by its width in drawn pixels: 1 red, d dred, l the lit pixel (pink,
// white when it glints; the 3-wide heart is too small for one). treatHeart picks the widest that
// suits the scale it is drawn at.
export const TREAT_HEARTS: ReadonlyMap<number, readonly string[]> = new Map([
  [7, [".11.11.", "1l11111", "111111d", ".1111d.", "..11d..", "...1..."]],
  [5, ["11.11", "1l11d", ".11d.", "..1.."]],
  [3, ["1.1", "111", ".1."]],
]);

// A TREAT_HEARTS heart centred on (cx, cy) in design pixels, drawn pixel for pixel at g's scale (as
// faceFront draws a face) so it keeps its shape at every size: 7 wide from 1.3x, 5 from 0.9x, else 3.
export function treatHeart(g: Drawable, cx: number, cy: number, glint: boolean): void {
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

// ---------- encounters (facing the player) ----------

export interface SkunkPose {
  blink?: boolean;
  pawL?: number;
  pawR?: number;
  sway?: number;
}

// The skunk's idle: the tail sways right, back, blinking, then left. Its walk, the step toward the
// pack: a front paw lifts 1px, left then right, with the tail swaying against it.
export const SKUNK_IDLE: readonly SkunkPose[] = [
  { sway: 0 },
  { sway: 1 },
  { blink: true, sway: 0 },
  { sway: -1 },
];
export const SKUNK_WALK: readonly SkunkPose[] = [
  { pawL: -1, sway: 1 },
  { sway: 0 },
  { pawR: -1, sway: -1 },
  { sway: 0 },
];

// The skunk facing the player at its own eye level, a squat front elevation: its tail fans up behind
// its right shoulder with a white stripe curving along its inner edge, and sways 1px either way;
// blink shuts its eyes to ink lines; pawL and pawR move the left and right front paws down (up when
// negative). An ink line parts the head from the body and the body from the tail. The head is in
// front of the body: a white blaze runs up from a white muzzle between the ears, and the eyes are ink
// with a white glint. Front paws on the road. The road outline and a grey rim on the dark fur so it
// holds on the dslate road.
export function skunk({ blink = false, pawL = 0, pawR = 0, sway = 0 }: SkunkPose = {}): Drawable {
  const g = edged(scope.Grid());
  const s = sway;
  // the tail: a plume up behind the right shoulder, a white crescent along its upper left
  g.ell(20 + s, 11, 8, 8.5, "navy", "ink", "dslate");
  g.ell(20 + s, 11, 6, 6.5, "white", "lgrey");
  g.ell(22 + s, 13, 5, 5.5, "navy", "ink");
  // body, low and wide, lit on its upper left, an ink line parting it from the tail
  g.ell(16, 24, 9.5, 5.8, "ink");
  g.ell(16, 24, 8.5, 4.8, "navy", "ink", "dslate");
  // the neck: an ink line round the head
  g.ell(14, 19, 7.5, 6.5, "ink");
  // head: ears, the blaze down to the muzzle, eyes with glints
  for (const [x, top, inner] of [
    [9, 10, 11],
    [19, 18, 17],
  ] as const) {
    g.tri([x, 17], [top, 11], [2 * inner - x, 15], "dslate");
  }
  g.ell(14, 19, 6.5, 5.5, "dslate");
  g.ell(14, 19.5, 5.5, 4.5, "navy", null, "dslate");
  g.rect(13, 13, 2, 7, "white");
  g.ell(14, 21.5, 2.8, 1.8, "white", "lgrey");
  g.rect(13, 20, 2, 1, "pink");
  for (const x of [10, 16]) {
    if (blink) {
      g.rect(x, 18, 2, 1, "ink");
      continue;
    }
    g.rect(x, 17, 2, 2, "ink");
    g.p(x, 17, "white");
  }
  // front paws, set apart from the body by their dslate tops
  for (const [x, dy] of [
    [10, pawL],
    [16, pawR],
  ] as const) {
    const y = 27 + dy;
    g.rect(x, y, 3, 2, "ink");
    g.rect(x, y, 3, 1, "dslate");
  }
  return rim(g, LIT);
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

// The squirrel's bushy tail, standing ry above and below (x, y): a narrower stem rising from behind
// the body into a plume rx wide at the top, its tip flicked out, with a lighter streak down its core,
// so it reads apart from the darker body in front of it. sway moves the plume sideways and leaves the
// stem on the body.
export function squirrelTail(
  g: Drawable,
  x: number,
  y: number,
  rx: number,
  ry: number,
  sway = 0,
): void {
  const f = SQUIRREL_FUR;
  g.cel(x - 0.5, y + 0.4 * ry, rx - 1, 0.6 * ry, f.fur, f.shade, f.lit);
  const px = x + sway;
  g.cel(px, y - 0.3 * ry, rx, 0.7 * ry, f.fur, f.shade, f.lit);
  g.cel(px + rx - 0.6, y - 0.8 * ry, 1.4, 1.2, f.fur, f.shade, f.lit);
  g.cel(px + 0.2, y - 0.2 * ry, rx - 1.8, 0.7 * ry - 1.6, f.streak);
}

// The squirrel sitting up facing the player, a front elevation: its bushy tail rises behind its right
// side and curls over at the top, the body sits upright with its paws held at its chest and its hind
// feet planted. tail swishes the tail 1px right. The road outline and LIT's rim.
export function squirrel({ tail = 0 }: { tail?: number } = {}): Drawable {
  const f = SQUIRREL_FUR;
  const g = edged(scope.Grid());
  squirrelTail(g, 21.3, 20, 3, 6.5, tail);
  // body, sitting up, with a lighter belly; hind feet either side
  g.cel(16, 25.2, 3.5, 3.8, f.fur, f.shade, f.lit);
  g.cel(16, 26, 1.5, 2, f.belly);
  for (const x of [12 + 2 / 3, 17 + 1 / 3]) {
    g.rect(x, 28, 2, 4 / 3, f.foot);
  }
  // paws held together at the chest
  g.rect(14 + 2 / 3, 23 + 1 / 3, 2 + 2 / 3, 4 / 3, f.paw);
  scope.squirrelHead(g, 16, 19 + 1 / 3);
  return rim(g, LIT);
}

// The squirrel's head facing the player, its eyes' centres on row y and either side of column x, with
// its ears, an ink chin line parting it from the body, and its face.
export function squirrelHead(g: Drawable, x: number, y: number): void {
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

// One frame of the squirrel's bound: [body y, head y, tail [x, y, rx, ry], front paws [left x, right
// x, y, height]].
export type SquirrelBound = readonly [
  body: number,
  head: number,
  tail: readonly [number, number, number, number],
  paws: readonly [number, number, number, number],
];

// The squirrel's bound, landing first. The head's y stays sitting's plus whole steps of 2px (4/3), so
// its eyes raster alike every frame. It lands stretched low and wide with its tail streaming up
// behind, crouches to push off with its tail swinging over, flies gathered 2px higher with its paws
// tucked under its chin and its tail arched, then reaches down for the next landing.
export const SQUIRREL_BOUND: readonly SquirrelBound[] = [
  [25.3, 23 + 1 / 3, [21.8, 20, 3, 5.6], [12, 18 + 2 / 3, 27 + 2 / 3, 4 / 3]],
  [24.7, 22, [21.6, 18.8, 3, 5.6], [12 + 2 / 3, 18, 27 + 1 / 3, 4 / 3]],
  [23.4, 20 + 2 / 3, [21, 17.3, 3, 5.4], [13 + 1 / 3, 17 + 1 / 3, 26, 4 / 3]],
  [24.3, 22, [21.4, 18.6, 3, 5.6], [12 + 1 / 3, 18 + 1 / 3, 27, 4 / 3]],
];

// The squirrel bounding down the road at the player, a front elevation, at phase 0 to 3 of
// SQUIRREL_BOUND. Its body spreads wider the lower it is.
export function squirrelRun(phase: number): Drawable {
  const f = SQUIRREL_FUR;
  const g = edged(scope.Grid());
  const [by, hy, [tx, ty, trx, tryy], [lx, rx, py, ph]] = SQUIRREL_BOUND[phase]!;
  const low = (by - 23.4) / 1.9;
  squirrelTail(g, tx, ty, trx, tryy);
  g.cel(16, by, 3.6 + low, 3.4 - 0.3 * low, f.fur, f.shade, f.lit);
  g.cel(16, by + 0.7, 1.5 + 0.3 * low, 1.8 - 0.3 * low, f.belly);
  // the paws reach up into the body, so no gap opens under it; the head stays on the sitting
  // squirrel's column and its rows 2px apart, so at SCALE its square eyes and glints keep one shape
  for (const x of [lx, rx]) {
    g.rect(x, Math.min(py, by), 2, py + ph - Math.min(py, by), f.foot);
  }
  scope.squirrelHead(g, 16, hy);
  return rim(g, LIT);
}

// The road's 2-lane puddle, 112x48 (64n-16 wide for n = 2); cards draw a 32x16 one. Wide puddles get
// a second lobe.
export function puddle(f: number | boolean, w = 112, h = 48): Drawable {
  const g = scope.Grid(w, h);
  let lobes: (readonly [number, number, number, number])[] = [[w / 2, h / 2, w / 2 - 2, h / 2 - 2]];
  if (w > 40) {
    lobes = [
      [w * 0.36, h * 0.52, w * 0.34, h / 2 - 3],
      [w * 0.66, h * 0.46, w * 0.32, h / 2 - 4],
    ];
  }
  for (const [cx, cy, rx, ry] of lobes) {
    g.ell(cx, cy, rx, ry, "blue");
  }
  for (const [cx, cy, rx, ry] of lobes) {
    g.ell(cx, cy + 0.5, rx - 1, ry - 1, "sky");
  }
  if (w > 40) {
    // the far bank's shade, a blue band down the top edge inside the rim, and the sky's glint in the
    // near lobe: a white streak over a cyan one
    for (const [cx, cy, rx, ry] of lobes) {
      g.ell(cx, cy + 0.5, rx - 1, ry - 1, "blue");
    }
    for (const [cx, cy, rx, ry] of lobes) {
      g.ell(cx, cy + 2, rx - 1.5, ry - 2, "sky");
    }
    g.rect(Math.round(w * 0.16), Math.round(h * 0.4), Math.round(w * 0.08), 2, "white");
    g.rect(Math.round(w * 0.14), Math.round(h * 0.4) + 2, Math.round(w * 0.13), 1, "cyan");
  }
  const s = f ? 1 : 0;
  for (const [fx, fy, fw] of [
    [0.28, 0.31, 0.125],
    [0.59, 0.56, 0.16],
    [0.41, 0.69, 0.06],
    [0.75, 0.3, 0.1],
  ] as const) {
    if (w > 40 || fx < 0.7) {
      g.rect(
        Math.round(fx * w) + (fx < 0.5 ? s : -s),
        Math.round(fy * h),
        Math.max(2, Math.round(fw * w)),
        1,
        "cyan",
      );
    }
  }
  return g;
}

// The pothole's edge, star-shaped about POTHOLE_CENTRE, as [x, y] corners on its 112x48 frame, joined
// straight: the far rim broken into teeth and steps, the near rim smoother with one chip out of it.
export const POTHOLE_CENTRE: Point = [54, 25];
export const POTHOLE_EDGE: readonly Point[] = [
  [8, 28],
  [10, 21],
  [14, 19],
  [15, 15],
  [21, 14],
  [23, 10],
  [31, 10],
  [34, 6],
  [39, 8],
  [46, 7],
  [49, 4],
  [55, 6],
  [60, 5],
  [63, 9],
  [70, 9],
  [72, 12],
  [79, 11],
  [82, 9],
  [87, 12],
  [93, 12],
  [95, 16],
  [101, 17],
  [104, 22],
  [104, 27],
  [101, 31],
  [95, 35],
  [88, 35],
  [84, 37],
  [80, 37],
  [73, 39],
  [71, 42],
  [63, 42],
  [61, 40],
  [52, 41],
  [40, 42],
  [30, 41],
  [20, 40],
  [13, 37],
  [9, 33],
];
// How many rows the far wall drops to the water.
export const POTHOLE_DEPTH = 12;
// How many pixels each side the wall's foot smooths the far rim's top over, so its teeth stay on the
// rim.
export const POTHOLE_FOOT = 5;
// The slabs of the near lip broken and tipped into the water, as four corners clockwise from the top
// left: a grey face, lgrey along its broken top edge, over an ash edge POTHOLE_SLAB_EDGE rows deep
// along its bottom.
export const POTHOLE_SLABS: readonly (readonly [Point, Point, Point, Point])[] = [
  [
    [19, 35],
    [31, 34],
    [35, 42],
    [14, 40],
  ],
];
export const POTHOLE_SLAB_EDGE = 1;
// The cracks running out from the rim into the road, each a run of [x, y] corners: an ink line over a
// grey one, lit along its lower edge.
export const POTHOLE_CRACKS: readonly (readonly Point[])[] = [
  [
    [23, 10],
    [19, 7],
    [11, 6],
  ],
  [
    [49, 4],
    [51, 2],
  ],
  [
    [8, 28],
    [4, 28],
    [2, 25],
  ],
  [
    [104, 27],
    [109, 26],
  ],
  [
    [71, 42],
    [73, 44],
  ],
];
// The water's white glint, [x, y, w, h]; it moves a pixel right on frame 1.
export const POTHOLE_GLINT: readonly [number, number, number, number] = [54, 31, 7, 2];

// The road's 2-lane pothole, 112x48 like the puddle, a ground decal with no outline, seen from the
// walker's eye: a coal far wall dropping POTHOLE_DEPTH rows from a broken far rim, its cut asphalt ash
// along the top (and down the lit right wall), to murky water. The water is the hole lowered by the
// wall, inside the hole, its far edge an ink line with the wall's reflection navy under it, then dlake
// with one white glint. The near lip is lit lgrey, with a grey slab tipped into the water at its left
// and a chip out of it at the right, and lit ink cracks run out into the road. Every band and line is
// drawn on the drawn grid, so it stays whole at every depth step.
export function pothole(f: number | boolean, w = 112, h = 48): Drawable {
  const g = scope.Grid(w, h);
  const [cx, cy] = POTHOLE_CENTRE;
  const s = scaleOf(g);
  const px = raster(g);

  const fan = (pts: readonly Point[], col: string, c: Point = [cx, cy]): void => {
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      // a triangle with no area would fill the whole line through it
      if ((a[0] - c[0]) * (b[1] - c[1]) !== (a[1] - c[1]) * (b[0] - c[0])) {
        g.tri(c, a, b, col);
      }
    });
  };
  const at = (x: number, y: number): Colour =>
    x >= 0 && x < px.w && y >= 0 && y < px.h ? px.px[y]![x]! : null;
  // An ink line through run's corners on the drawn grid, unbroken at every scale, over a grey one a
  // pixel lower, lit along its lower edge.
  const crack = (run: readonly Point[]): void => {
    const pts = run.map(([x, y]) => [Math.round(x * s), Math.round(y * s)] as const);
    const ink: (readonly [number, number])[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) {
        ink.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)]);
      }
    }
    const inkSet = new Set(ink.map(([x, y]) => key(x, y)));
    for (const [x, y] of ink) {
      if (!inkSet.has(key(x, y + 1)) && at(x, y + 1) === null) {
        px.p(x, y + 1, "grey");
      }
    }
    for (const [x, y] of ink) {
      px.p(x, y, "ink");
    }
  };

  fan(POTHOLE_EDGE, "coal");
  const d = Math.max(2, Math.round(POTHOLE_DEPTH * s));
  const band = Math.max(1, Math.round(2 * s));
  const hole = new Set<string>();
  const holeCells: [number, number][] = [];
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (at(x, y)) {
        hole.add(key(x, y));
        holeCells.push([x, y]);
      }
    }
  }
  // the water's far edge follows the wall's foot, the far rim's top smoothed over POTHOLE_FOOT pixels
  // each side and dropped d rows, so the rim's broken teeth stay on the rim
  const top = new Map<number, number>();
  for (const [x, y] of holeCells) {
    top.set(x, Math.min(top.get(x) ?? y, y));
  }
  const r = Math.max(1, Math.round(POTHOLE_FOOT * s));
  const foot = new Map<number, number>();
  for (const x of top.keys()) {
    let sum = 0;
    let count = 0;
    for (let k = x - r; k <= x + r; k++) {
      const t = top.get(k);
      if (t !== undefined) {
        sum += t;
        count += 1;
      }
    }
    foot.set(x, sum / count + d);
  }
  const water = new Set<string>();
  for (const [x, y] of holeCells) {
    if (y >= foot.get(x)! && hole.has(key(x, y - d))) {
      water.add(key(x, y));
    }
  }
  for (const [x, y] of holeCells) {
    let c: string;
    if (!hole.has(key(x, y + 1))) {
      c = "lgrey";
    } else if (water.has(key(x, y))) {
      // the far wall's foot: an ink line along the water's top, the wall's reflection navy under it
      let k = d + 1;
      for (let j = 1; j <= d; j++) {
        if (!water.has(key(x, y - j))) {
          k = j;
          break;
        }
      }
      if (k === 1) {
        c = "ink";
      } else {
        c = k <= 1 + 2 * band ? "navy" : "dlake";
      }
    } else if (
      range(1, band + 1).some((j) => !hole.has(key(x, y - j))) ||
      range(1, band + 1).some((j) => !hole.has(key(x + j, y)))
    ) {
      // the far rim's broken asphalt, its cut face ash over the coal wall, and the right wall lit
      c = "ash";
    } else {
      continue;
    }
    px.p(x, y, c);
  }
  for (const slab of POTHOLE_SLABS) {
    const before = px.px.map((row) => [...row]);
    const [a, b, q, dd] = slab;
    g.tri(a, b, q, "grey");
    g.tri(a, q, dd, "grey");
    const mine = new Set<string>();
    const mineCells: [number, number][] = [];
    for (let y = 0; y < px.h; y++) {
      for (let x = 0; x < px.w; x++) {
        if (at(x, y) !== before[y]![x]) {
          mine.add(key(x, y));
          mineCells.push([x, y]);
        }
      }
    }
    const edge = Math.max(1, Math.round(POTHOLE_SLAB_EDGE * s));
    for (const [x, y] of mineCells) {
      if (!mine.has(key(x, y - 1))) {
        px.p(x, y, "lgrey");
      } else if (range(1, edge + 1).some((k) => !mine.has(key(x, y + k)))) {
        px.p(x, y, "ash");
      }
    }
  }
  for (const run of POTHOLE_CRACKS) {
    crack(run);
  }
  const [gx, gy, gw, gh] = POTHOLE_GLINT;
  g.rect(gx + (f ? 1 : 0), gy, gw, gh, "white");
  return g;
}

// The stink haze's puffs as [centre x, centre y, radius across], laid out on an 88x40 design that the
// sprite stretches to CLOUD_SIZE (2 lanes, 64n-16 wide, by 1.5 x 40 rows). The haze hugs the road:
// each puff is CLOUD_SQUASH as tall as it is wide, so together they make a low, wide bank with a lumpy
// top, its base on the frame's last row. A swollen puff still stops a pixel short of the frame's top
// and sides, so no lobe is clipped flat; along the bottom the frame's last row cuts them level, where
// the haze meets the road.
export const CLOUD_PUFFS: readonly (readonly [number, number, number])[] = [
  [44, 28, 30],
  [22, 31, 15],
  [66, 31, 15],
  [31, 36, 15],
  [57, 36, 15],
  [32, 20, 11],
  [57, 19, 11],
  [44, 14, 9],
  [11, 35, 9],
  [77, 35, 9],
  [19, 24, 7],
  [70, 24, 7],
];
export const CLOUD_SQUASH = 0.42;
export const CLOUD_W = 88;
export const CLOUD_H = 40;
export const CLOUD_SIZE: readonly [number, number] = [112, 60];
// Where each stink wisp starts, trailing 6 design rows down.
export const CLOUD_WISPS: readonly Point[] = [
  [22, 25],
  [62, 22],
  [72, 30],
  [14, 31],
  [42, 17],
];
// The haze's colours: the outer and inner rim, the fill, the seams between lobes, and the wisps.
export const CLOUD_INK = {
  dark: "purple",
  fill: "mauve",
  inner: "pink",
  outer: "plum",
  wisp: "purple",
} as const;

// The stink haze under the skunk at depth step s (CLOUD_SIZE at 1), low and wide on the road: flat
// mauve lobes, a purple seam where one meets the next, with no dither, so it holds on the dark roads.
// The puffs swell in turn by a whole pixel; the base stays on the last row. The rim is two pixels at
// every size: plum outside, which holds 3:1 on the light roads, and pink inside it, which holds on the
// dslate road. The seams and the wisps' 1px wave are laid on the drawn grid, so they keep their pixels
// at every step. A puff near the frame's top or sides is trimmed so that, swollen, it still stops a
// pixel short of them. Mauve keeps it apart from the green hedges, and matches fx-hit-skunk.
export function skunkCloud(step: number, s = 1): Drawable {
  const [w, h] = CLOUD_SIZE.map((v) => Math.floor(v * s + 0.5)) as [number, number];
  const sx = w / CLOUD_W;
  const sy = h / CLOUD_H;
  const g = scope.Grid(w, h);
  const k = (CLOUD_SQUASH * sy) / sx;
  const puffs = CLOUD_PUFFS.map(([puffX, puffY, puffR], i) => {
    const cx = puffX * sx;
    const cy = puffY * sy;
    const r = Math.min(puffR * sx, cx - 1.6, w - cx - 1.6, (cy - 1.6) / k);
    return [cx, cy, r + ((i + step) % 4 === 0 ? 1 : 0)] as const;
  });
  // how far inside the nearest puff each pixel is, in pixels across
  const depthOf = ([cx, cy, r]: readonly [number, number, number], x: number, y: number): number =>
    r - Math.sqrt((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / k) ** 2);
  const depth = range(0, h).map((y) =>
    range(0, w).map((x) => Math.max(...puffs.map((p) => depthOf(p, x, y)))),
  );
  const inside = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && depth[y]![x]! >= 0;
  const beside = (x: number, y: number, test: (a: number, b: number) => boolean): boolean =>
    test(x, y - 1) || test(x, y + 1) || test(x - 1, y) || test(x + 1, y);
  const outer = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inside(x, y) && beside(x, y, (a, b) => !inside(a, b))) {
        outer.add(key(x, y));
      }
    }
  }
  // each pixel belongs to the puff it is deepest inside; where two lobes meet, the later one's edge is
  // a purple seam, so the haze reads as flat lobes
  const owner = range(0, h).map((y) =>
    range(0, w).map((x) => {
      let best = 0;
      let bestDepth = depthOf(puffs[0]!, x, y);
      for (let i = 1; i < puffs.length; i++) {
        const dp = depthOf(puffs[i]!, x, y);
        if (dp > bestDepth) {
          best = i;
          bestDepth = dp;
        }
      }
      return best;
    }),
  );
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) {
        continue;
      }
      if (outer.has(key(x, y))) {
        g.p(x, y, CLOUD_INK.outer);
      } else if (beside(x, y, (a, b) => outer.has(key(a, b)))) {
        g.p(x, y, CLOUD_INK.inner);
      } else if (beside(x, y, (a, b) => inside(a, b) && owner[b]![a]! < owner[y]![x]!)) {
        g.p(x, y, CLOUD_INK.dark);
      } else {
        g.p(x, y, CLOUD_INK.fill);
      }
    }
  }
  for (const [x0, y0] of CLOUD_WISPS) {
    for (let j = 0; j < Math.max(1, Math.floor(6 * sy + 0.5)); j++) {
      g.p(Math.floor(x0 * sx) + ((j + step) % 3) - 1, Math.floor(y0 * sy) + j, CLOUD_INK.wisp);
    }
  }
  return g;
}

export interface CorgiPose {
  bl?: number;
  bob?: number;
  br?: number;
  fl?: number;
  fr?: number;
  tail?: number;
  twitch?: number;
}

// The other dog trotting toward the player at its own eye level, a squat front elevation: the big fox
// head with upright ears over a broad white chest ruff, short front legs either side of it and the
// hind paws showing between them. Each leg offset is that paw's stride, positive reaching toward the
// player: a reaching paw is lifted off the road 2px, a pushing one stays planted on the last row. tail
// moves the fluffy tail, which rises off the rump behind the head and shows over the right shoulder,
// sideways; twitch moves the right ear alone (negative is up). The road outline, and a tan rim on the
// fur facing the light.
export function corgi({
  bl = 0,
  bob = 0,
  br = 0,
  fl = 0,
  fr = 0,
  tail = 0,
  twitch = 0,
}: CorgiPose = {}): Drawable {
  const g = edged(scope.Grid());
  const b = bob;
  const lift = (k: number): number => (k > 0 ? -2 : 0);
  // the tail, a plume over the back behind the head
  g.cel(24.5 + tail, 16.5 + b, 2.5, 2.5, "ochre", "rust", "tan");
  g.p(24 + tail, 15 + b, "cream");
  // hind paws between the front legs, further off and a shade darker
  for (const [x, k] of [
    [13, bl],
    [17, br],
  ] as const) {
    g.rect(x, 25 + b, 2, 4 + lift(k) - b, "rust");
    g.rect(x, 28 + lift(k), 2, 1, "lgrey");
  }
  // shoulders and the white chest ruff
  g.cel(16, 22 + b, 8.5, 4.5, "ochre", "rust", "tan");
  g.cel(16, 22 + b, 4.5, 4, "white", "lgrey");
  // front legs: short, ochre with white socks
  for (const [x, k] of [
    [9, fl],
    [20, fr],
  ] as const) {
    g.rect(x, 24 + b, 3, 4 + lift(k) - b, "ochre");
    g.rect(x + 2, 24 + b, 1, 4 + lift(k) - b, "rust");
    g.rect(x, 27 + lift(k), 3, 3, "white");
    g.p(x + 2, 29 + lift(k), "lgrey");
  }
  // ears, the right one twitching
  const t = twitch;
  g.tri([7, 14 + b], [8.5, 4.5 + b], [14, 10 + b], "ochre");
  g.tri([25, 14 + b + t], [23.5, 4.5 + b + t], [18, 10 + b + t], "ochre");
  g.tri([9, 12 + b], [9.5, 7 + b], [12.5, 10.5 + b], "pink");
  g.tri([23, 12 + b + t], [22.5, 7 + b + t], [19.5, 10.5 + b + t], "pink");
  // head: ochre crown, white blaze, cheeks and muzzle, eyes, nose and a happy mouth
  g.cel(16, 14 + b, 7.5, 5.5, "ochre", "rust", "tan");
  g.cel(16, 17 + b, 5.5, 2.5, "white", "lgrey");
  g.rect(15, 9 + b, 2, 7, "white");
  g.rect(11, 13 + b, 2, 2, "ink");
  g.rect(19, 13 + b, 2, 2, "ink");
  g.p(11, 13 + b, "white");
  g.p(19, 13 + b, "white");
  g.rect(15, 16 + b, 2, 1, "ink");
  g.p(14, 17 + b, "dbrown");
  g.p(17, 17 + b, "dbrown");
  g.rect(15, 18 + b, 2, 1, "pink");
  // collar
  g.rect(11, 19 + b, 10, 1, "amber");
  g.p(16, 20 + b, "yellow");
  return rim(g, LIT);
}

// The other dog's trot, as dogs.ts's WALK has it: diagonal pairs swap on beats 0 and 2 and the body
// bobs up on the passing beats; 4 frames at 100ms.
export const CORGI_WALK: readonly CorgiPose[] = [
  { bl: -1, br: 1, fl: 1, fr: -1 },
  { bob: -1 },
  { bl: 1, br: -1, fl: -1, fr: 1 },
  { bob: -1 },
];
// Standing while its walker chats: the dogs' idle, the tail at -1, 0, +1, 0, the body 1px higher over
// the middle two beats and the right ear 1px higher on the last frame.
export const CORGI_IDLE: readonly CorgiPose[] = [
  { tail: -1 },
  { bob: -1 },
  { bob: -1, tail: 1 },
  { twitch: -1 },
];

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

// Layout rows y0 to y1 - 1 of the thief's stripes, from x, w wide: light where (row - b) % 4 < 2,
// else ink. The sleeves take lgrey for light, so the arms stay apart from the white-striped chest.
// Drawn in pixels at the grid's scale, every stripe pair 4 x scale rows tall (the light the shorter
// half), so drawn bigger the stripes stay even instead of breaking up into 1px rows.
export function stripes(
  g: Drawable,
  x: number,
  y0: number,
  y1: number,
  w: number,
  b: number,
  light = "white",
): void {
  const s = scaleOf(g);
  const px = raster(g);
  const e = (v: number): number => Math.floor(v * s + 0.5);
  const period = Math.max(2, e(4));
  const anchor = e(20 + b);
  for (let r = e(y0); r < e(y1); r++) {
    const phase = (((r - anchor) % period) + period) % period;
    px.rect(
      e(x),
      r,
      Math.max(1, e(x + w) - e(x)),
      1,
      phase < Math.floor(period / 2) ? light : "ink",
    );
  }
}

// The walker's tip pouch, which the thief snatches: a green cloth drawstring pouch lit lime on its
// left and shaded forest on its right, its neck gathered under a cream drawstring tied off at the top,
// a yellow coin with an amber centre on its face. The road thief carries BIG_POUCH or TIP_POUCH
// (POUCHES, widest first), pouchPx picking by the grid's scale, so it stays a clean bitmap at every
// depth step and never shrinks below TIP_POUCH, which still reads at @50. The cards hold TIP_POUCH
// close and FAR_POUCH in a distant hand.
export const BIG_POUCH: readonly string[] = [
  "...c.c...",
  "....c....",
  "..lgcgf..",
  "...lgf...",
  "..lgggf..",
  ".lggyggf.",
  "lggyayggf",
  "lgggyggff",
  "lggggggff",
  "lggggggff",
  ".ggggfff.",
  "..fffff..",
];
export const TIP_POUCH: readonly string[] = [
  "..c.c..",
  "...c...",
  "..lgf..",
  ".lgggf.",
  "lggyggf",
  "lgyaygf",
  "lggyggf",
  ".gggff.",
  "..fff..",
];
export const FAR_POUCH: readonly string[] = [".c.c.", "..c..", ".lgf.", "lgygf", "lgggf", ".fff."];
export const POUCHES: readonly (readonly string[])[] = [BIG_POUCH, TIP_POUCH];
export const POUCH_INK: Readonly<Record<string, string>> = {
  a: "amber",
  c: "cream",
  f: "forest",
  g: "green",
  l: "lime",
  y: "yellow",
};
// The pouch's width in design pixels on the thief: BIG_POUCH from the full size down to @88,
// TIP_POUCH below.
export const POUCH_WIDTH = 6.5;

// The tip pouch from POUCHES hanging from a fist: centred on design column cx, its drawstring's top
// on the last pixel row above design row fist, where the fist ends; the widest no wider than
// POUCH_WIDTH design pixels at the grid's scale (the smallest at least).
export function pouchPx(g: Drawable, cx: number, fist: number): void {
  const s = scaleOf(g);
  const px = raster(g);
  const sy = rowScaleOf(g);
  const bitmap = POUCHES.find((b) => b[0]!.length <= POUCH_WIDTH * s + 0.5) ?? POUCHES.at(-1)!;
  const x0 = Math.floor((cx + 0.5) * s) - Math.floor(bitmap[0]!.length / 2);
  const y0 = Math.floor(fist * sy + 0.5) - 1;
  bitmap.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (Object.hasOwn(POUCH_INK, ch)) {
        px.p(x0 + i, y0 + j, POUCH_INK[ch]!);
      }
    });
  });
}

// The thief coming down the road: striped shirt, beanie and mask, both arms swinging, the walker's tip
// pouch dangling by its drawstring from his fist (screen right). pouch false leaves it off, for the
// cards, which draw the pouch themselves.
export function thiefTop(g: Drawable, b: number, arms = 0, pouch = true): void {
  stripes(g, 9, 21 + b, 34 + b, 14, b);
  for (const [x, n] of [
    [5, swung(arms, -1)],
    [23, swung(arms, 1)],
  ] as const) {
    stripes(g, x, 22 + b, 31 + b - n, 4, b, "lgrey");
    g.rect(x, 31 + b - n, 4, 3, "skin2");
    if (x > 16 && pouch) {
      pouchPx(g, 25, 34 + b - n);
    }
  }
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin2", "brown");
  g.cel(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate");
  // the beanie's turned-up band meets the mask, so no sliver of skin shows at the temples
  g.rect(8, 9 + b, 17, 3, "dslate");
  g.rect(8, 12 + b, 17, 3, "ink");
  g.rect(11, 13 + b, 2, 1, "white");
  g.rect(19, 13 + b, 2, 1, "white");
  g.rect(14, 17 + b, 4, 1, "dbrown");
  g.p(18, 16 + b, "dbrown");
}

// The thief running off up the road, seen from behind: stride is -1 or 1, the side whose knee is up.
// The arms pump against the legs from the shoulders (the far arm bent forward, its forearm hidden, the
// near one swung back and low), and the tip pouch swings from his fist on screen right: hanging low
// from the swung-back arm, then jerked up beside his ribs by the bent one (pouch false leaves it off,
// as thiefTop). The road outline and the lit rim.
export function thiefFleeing(stride: number, pouch = true): Drawable {
  const g = edged(scope.Grid(32, 48));
  const s = stride;
  const b = -1;
  // legs: the lifted one is short, its shoe turned up to show the sole; the pushing one reaches the
  // ground
  for (const [x, lifted] of [
    [11, s < 0],
    [17, s > 0],
  ] as const) {
    const top = 33 + b;
    if (lifted) {
      g.rect(x, top, 4, 5, "navy");
      g.rect(x + 3, top, 1, 5, "ink");
      g.rect(x, top + 5, 4, 2, "ink");
      g.rect(x, top + 7, 4, 1, "dslate");
    } else {
      g.rect(x, top, 4, 10 - b, "navy");
      g.rect(x + 3, top, 1, 10 - b, "ink");
      g.rect(x, 43, 4, 2, "ink");
    }
  }
  // arms: the one on the lifted leg's side swings back and low, the other is bent forward and up; both
  // hang from the shoulder at row 22, as his walking arms do
  for (const [x, back] of [
    [5, s < 0],
    [23, s > 0],
  ] as const) {
    if (back) {
      stripes(g, x, 22 + b, 32 + b, 4, b, "lgrey");
      g.rect(x, 32 + b, 4, 3, "skin2");
    } else {
      stripes(g, x, 22 + b, 26 + b, 4, b, "lgrey");
      g.rect(x + (x < 16 ? 1 : -1), 26 + b, 3, 2, "skin2");
    }
  }
  stripes(g, 9, 21 + b, 34 + b, 14, b);
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  if (pouch) {
    // swinging out from the hand held back and low, or tucked up at the hip under the bent arm's fist,
    // which shows in full over the shirt's edge
    if (s > 0) {
      pouchPx(g, 25.5, 35 + b);
    } else {
      g.rect(22, 26 + b, 3, 2, "skin2");
      pouchPx(g, 24.5, 28 + b);
    }
  }
  // the back of the head: the beanie, the ears and the mask's band tied all the way round
  g.rect(14, 19 + b, 4, 3, "skin2");
  g.cel(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1");
  g.rect(7, 13 + b, 2, 3, "skin2");
  g.rect(23, 13 + b, 2, 3, "brown");
  g.cel(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate");
  g.rect(8, 9 + b, 17, 2, "dslate");
  g.rect(8, 12 + b, 17, 2, "ink");
  return rim(g, LIT);
}

// The neighbour's hearts, widest first: red, shaded dred down the right, lit pink and white at the top
// of the left lobe. heartPx picks the widest that fits the grid's scale, so the heart stays a clean
// bitmap at every depth step instead of a blur of scaled curves.
export const HEARTS: readonly (readonly string[])[] = [
  [
    ".111...111.",
    "1wh11.11111",
    "1h111111111",
    "11111111d1d",
    ".1111111dd.",
    "..11111dd..",
    "...111dd...",
    "....1dd....",
    ".....d.....",
  ],
  [
    ".111.111.",
    "1wh111111",
    "1h111111d",
    "1111111dd",
    ".11111dd.",
    "..111dd..",
    "...1dd...",
    "....d....",
  ],
  [".11.11.", "1wh1111", "1h1111d", ".1111d.", "..11d..", "...d..."],
  [".1.1.", "1h11d", ".11d.", "..d.."],
];
export const HEART_INK: Readonly<Record<string, string>> = {
  1: "red",
  d: "dred",
  h: "pink",
  w: "white",
};

// A heart from HEARTS centred on design column cx with its top on design row top: the widest no wider
// than width design pixels at the grid's scale (the smallest at least), then smaller steps down.
export function heartPx(g: Drawable, cx: number, top: number, width: number, smaller = 0): void {
  const s = scaleOf(g);
  const px = raster(g);
  const sy = rowScaleOf(g);
  const fits = HEARTS.flatMap((h, k) => (h[0]!.length <= width * s + 0.5 ? [k] : []));
  const fit = fits.length ? fits : [HEARTS.length - 1];
  const bitmap = HEARTS[Math.min(fit[0]! + smaller, HEARTS.length - 1)]!;
  const x0 = Math.floor(cx * s + 0.5) - Math.floor(bitmap[0]!.length / 2);
  const y0 = Math.floor(top * sy + 0.5);
  bitmap.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (Object.hasOwn(HEART_INK, ch)) {
        px.p(x0 + i, y0 + j, HEART_INK[ch]!);
      }
    });
  });
}

// The neighbour's crouch to pet a dog: her body this many design rows lower, her legs that much
// shorter.
export const NEIGHBOUR_CROUCH = 3;

// The friendly neighbour, a grey-haired dog lover in a mauve cardigan open over a cream top with a big
// red heart on it, a red heart floating at her top right. From 1x her smile sits a row lower than
// faceFront's, under a small nose, clear of her eyes. pet crouches her (with person's
// bob=NEIGHBOUR_CROUCH) and reaches her left arm (screen right) out and down, the open hand patting:
// beat 1 lowers it a row and shrinks the floating heart a step, so it beats. Standing, beat 1 lifts the
// floating heart a row, so it bobs against her breath or her step.
export function neighbourTop(pet: boolean, beat: number): Top {
  return (g, b, arms = 0) => {
    // the cardigan, open down the front over the cream top, and the big heart on it
    g.rect(9, 21 + b, 14, 13, "mauve");
    g.rect(20, 21 + b, 3, 13, "purple");
    g.rect(12, 21 + b, 8, 13, "cream");
    g.rect(19, 21 + b, 1, 13, "tan");
    g.rect(12, 21 + b, 1, 13, "pink");
    heartPx(g, 16, 24.5 + b, 7);
    // her right arm (screen left) hanging, the hand at her side
    const n = swung(arms, -1);
    g.rect(5, 22 + b, 4, 9 - n, "mauve");
    g.rect(5, 31 + b - n, 4, 3, "skin1");
    if (pet) {
      // the left arm (screen right) reaching out and down to a dog at her side, the hand open, palm
      // down
      const d = beat;
      for (let k = 0; k < 6; k++) {
        g.rect(22 + k, 22 + b + k * 1.4, 4, 4, "mauve");
      }
      g.rect(25, 26 + b, 1, 3, "purple");
      g.rect(26, 30 + b + d, 4, 3, "skin1");
      g.rect(26, 32 + b + d, 4, 1, "skin2");
      for (const x of [26, 28]) {
        g.rect(x, 33 + b + d, 1, 1, "skin1");
      }
    } else {
      const m = swung(arms, 1);
      g.rect(23, 22 + b, 4, 9 - m, "mauve");
      g.rect(23, 31 + b - m, 4, 3, "skin1");
    }
    faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
    g.cel(16, 7.5 + b, 9, 5, "lgrey", "grey", "white");
    g.cel(16, 3 + b, 3.5, 2.5, "lgrey", "grey", "white");
    g.rect(8, 9 + b, 2, 6, "lgrey");
    g.rect(22, 9 + b, 2, 6, "lgrey");
    // from 1x the smile drops a row under a small nose; smaller, the face has no rows for either
    const roomy = scaleOf(g) >= 1;
    scope.faceFront(g, 16, 13 + b, { mouth: roomy ? 5 : 4 });
    if (roomy) {
      nose(g, 16, 13 + b);
    }
    g.rect(10, 12 + b, 5, 1, "dslate");
    g.rect(18, 12 + b, 5, 1, "dslate");
    g.p(10, 15 + b, "pink");
    g.p(22, 15 + b, "pink");
    // the floating heart, clear of her hair at the top right, on the frame's rows whatever her pose
    heartPx(g, 27.5, pet ? 1 : 2 - beat, 7.5, pet ? beat : 0);
  };
}

// The $ on the wallet's bill, in drawn pixels so it stays exact at any scale: 3x7 down to the 1.1x
// depth step, a 1px stroke below that, where the bill is too short for it.
export const WALLET_DOLLAR: readonly string[] = [".1.", "111", "1..", "111", "..1", "111", ".1."];

// The wallet's rim: LIT, with a dimmer brown down the leather's shaded sides.
export const WALLET_RIM: Rims = { ...LIT, dbrown: ["skin2", "brown"], plum: ["skin2", "brown"] };

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

// The other dog's walker: yellow raincoat, brown bob, leash hand held out low; the free arm swings.
export function dogOwnerTop(g: Drawable, b: number, arms = 0): void {
  g.rect(9, 21 + b, 14, 13, "amber");
  g.rect(20, 21 + b, 3, 13, "orange");
  g.rect(9, 21 + b, 1, 12, "yellow");
  g.rect(15, 22 + b, 1, 11, "orange");
  g.p(13, 25 + b, "orange");
  g.p(13, 29 + b, "orange");
  const n = swung(arms, -1);
  g.rect(5, 22 + b, 4, 9 - n, "amber");
  g.rect(5, 31 + b - n, 4, 3, "skin1");
  // the leash arm angles out from the shoulder, so the hand held out low stays under its sleeve
  backArm(
    g,
    23,
    4,
    22 + b,
    [
      [8, "amber", null],
      [3, "skin1", null],
    ],
    { out: 1 },
  );
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.cel(16, 8.5 + b, 9, 5, "dbrown", "plum", "brown");
  g.rect(7, 9 + b, 3, 9, "dbrown");
  g.rect(22, 9 + b, 3, 9, "dbrown");
  g.rect(10, 9 + b, 12, 2, "dbrown");
  scope.faceFront(g, 16, 13 + b);
  g.p(10, 16 + b, "pink");
  g.p(22, 16 + b, "pink");
}

// ---------- forced stops ----------

// The ice cream truck's drive: 4 frames of iceCreamTruck's roll, and their duration in ms.
export const TRUCK_DRIVE: readonly [readonly number[], number] = [[0, 1, 2, 3], 100];

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

// The ice cream truck from straight behind, a lane wide like obstacles.ts's delivery truck, laid out
// on 56x50 and drawn at TRUCK_SCALE to 56x60: a white box van lit along its top and left, its cone
// sign on the roof. The rear doors split down the middle, each with a window; a pink drip stripe runs
// across them; tall red tail lights sit at the outer corners, amber blinkers under them; then the
// plate, the bumper and both rear wheels. A mirror pokes out on the left and the serving hatch's
// striped awning on the right. f swaps the lit blinker and the white music note. roll (0 to 3) is a
// drive frame: tread lines climb the tires, the body dips 1px onto them on frames 1 and 2, the cone
// sign rocks on its post the other way, and a note floats up beside it. The road outline and the lit
// rim.
export function iceCreamTruck(f = 0, roll: number | null = null): Drawable {
  const g = edged(scope.Grid(56, 50));
  const px = raster(g);
  const uy = unit(g)[1];
  for (const x of [5, 42]) {
    g.rect(x, 39, 9, 10, "ink");
    g.rect(x, 39, 2, 9, "dslate");
    if (roll !== null) {
      treads(g, x + 2, 42, 7, 7, roll, uy);
    }
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = Array.from({ length: px.h }, () => Array<Colour>(px.w).fill(null));
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const rock = roll !== null ? -dip : 0;
  // the cone sign on the roof: a tall waffle cone, lit tan and shaded ochre, under a pink scoop with a
  // cherry
  g.tri([23.5, 5.5 + rock], [32.5, 5.5 + rock], [28, 12.5 + rock], "tan");
  g.tri([28, 5.5 + rock], [32.5, 5.5 + rock], [28, 12.5 + rock], "ochre");
  g.ell(28, 4 + rock, 4.6, 2.6, "pink", "mauve", "white");
  g.rect(28, 0.5 + rock, 1.5, 1.5, "red");
  // the music note: left of the sign at rest (f 0) or right (f 1); driving, it floats up a row a frame
  let [nx, ny] = f === 0 ? [12, 4] : [41, 3];
  if (roll !== null) {
    [nx, ny] = roll < 2 ? [12, 5 - roll] : [41, 7 - roll];
  }
  g.rect(nx + 2, ny, 1, 6, "white");
  g.rect(nx + 2, ny, 3, 1, "white");
  g.rect(nx, ny + 5, 3, 2, "white");
  // the roof edge, then the box: lit along the top and the left, shaded down the right
  g.rect(5, 12, 46, 2, "lgrey");
  g.rect(5, 12, 46, 1, "white");
  g.rect(3, 14, 50, 25, "white");
  g.rect(49, 14, 4, 25, "lgrey");
  // a mirror on the left, the serving hatch's awning on the right, striped pink and white
  g.rect(0, 18, 3, 5, "dslate");
  g.rect(0, 18, 3, 1, "slate");
  for (let k = 0; k < 4; k++) {
    g.rect(53, 15 + k * 2, 2, 2, k % 2 === 0 ? "pink" : "white");
  }
  // the rear doors: a seam down the middle, a window in each, handles by the seam
  g.rect(27, 15, 2, 23, "lgrey");
  for (const x of [9, 31]) {
    g.rect(x, 16, 16, 9, "navy");
    g.rect(x, 16, 16, 1, "slate");
    g.tri([x + 3, 24], [x + 8, 17], [x + 11, 17], "slate");
  }
  g.rect(24, 27, 2, 3, "grey");
  g.rect(30, 27, 2, 3, "grey");
  // the drip stripe: a pink band with drips hanging from it
  g.rect(3, 30, 50, 3, "pink");
  g.rect(3, 32, 50, 1, "mauve");
  range(6, 50, 8).forEach((x, i) => {
    g.rect(x, 33, 2, 1 + (i % 2), "pink");
  });
  // tail lights up the outer corners, blinkers under them, the plate between
  for (const x of [4, 48]) {
    g.rect(x, 15, 4, 14, "red");
    g.rect(x, 15, 4, 1, "pink");
    g.rect(x + 3, 16, 1, 13, "dred");
  }
  g.rect(4, 34, 4, 3, f ? "yellow" : "amber");
  g.rect(48, 34, 4, 3, f ? "amber" : "yellow");
  g.rect(22, 34, 12, 4, "cream");
  g.rect(24, 35, 8, 1, "tan");
  // the bumper step across the full width
  g.rect(1, 38, 54, 3, "dslate");
  g.rect(1, 38, 54, 1, "slate");
  g.rect(1, 38, 1, 3, "grey");
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => (y >= dip ? body[y - dip]![x]! : null) || wheels[y]![x]!),
  );
  rim(px, LIT);
  return g;
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

// The mail carrier: a sky-blue shirt and cap, a navy brim, dark skin and a mailbag on a strap; the
// free arm swings, the one by the bag stays.
export function mailTop(g: Drawable, b: number, arms = 0): void {
  g.rect(9, 21 + b, 14, 12, "sky");
  g.rect(20, 21 + b, 3, 12, "blue");
  g.rect(15, 21 + b, 2, 12, "cyan");
  const n = swung(arms, -1);
  g.rect(5, 22 + b, 4, 9 - n, "sky");
  g.rect(8, 22 + b, 1, 9 - n, "blue");
  g.rect(5, 31 + b - n, 4, 3, "dbrown");
  g.rect(23, 22 + b, 4, 9, "sky");
  g.rect(26, 22 + b, 1, 9, "blue");
  g.rect(23, 31 + b, 4, 3, "dbrown");
  g.rect(9, 33 + b, 14, 3, "navy");
  // mailbag on a strap
  g.cel(24, 30 + b, 5, 4.5, "brown", "dbrown", "tan");
  g.rect(22, 27 + b, 4, 3, "white");
  stair(g, 10, 22 + b, 20, 27 + b, "dbrown");
  faceDisc(g, 16, 12.5 + b, 8, 8, "dbrown", "plum");
  g.cel(16, 7 + b, 8.5, 3.5, "sky", "blue", "cyan");
  g.rect(8, 9 + b, 17, 2, "navy");
  g.rect(15, 5 + b, 2, 2, "amber");
  scope.faceFront(g, 16, 13 + b, { lips: "ink" });
  g.p(11, 13 + b, "white");
  g.p(19, 13 + b, "white");
}

// The mail carrier facing the player, with a light rim on the dark skin, brim and trousers so they
// hold on the dslate road, and the road outline for the light roads.
export function mailCarrier(q: PersonOptions = {}): Drawable {
  const g = edged(person(mailTop, { grounded: true, ...q }));
  return rim(g, {
    blue: ["sky", null],
    dbrown: ["skin2", "brown"],
    ink: ["grey", "slate"],
    navy: ["grey", "slate"],
    plum: ["skin2", "brown"],
    sky: ["cyan", null],
  });
}

// ---------- road movers going the pack's way (back view) ----------

// Pushing the stroller: the road people's stride, a 1px bob as he passes over each foot, at the
// walkers' pace.
export const STROLLER_WALK = HUMAN_WALK;
export const STROLLER_WALK_MS = 80;

// A dad pushing a stroller up the road, seen from behind as the pack sees it: short ginger hair, a
// green puffer jacket quilted across, jeans and brown shoes, a takeaway coffee in his left hand, his
// right hand on the handlebar. The stroller rolls beside him on his right, its back to the player: a
// sky-blue hood ribbed where it folds over a navy seat back, the handlebar across the top, a basket
// under the seat, the rear legs running straight down to two round rear wheels and the two front
// wheels inside them, further up the road, every wheel a plain ink tire under the lit rim. It rolls
// steadily while he bobs. The road outline and the lit rim, the puffer's teal shade lit green.
export function stroller({ bob = 0, lf = 0, rf = 0 }: WalkerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  // the front wheels, further up the road, inside the rear ones
  for (const cx of [21.5, 27.5]) {
    g.ell(cx, 37.5, 1.6, 2.6, "ink");
  }
  // the rear legs run straight down from the seat to the rear wheels
  for (const x of [18, 29]) {
    g.rect(x, 31, 1, 9, "lgrey");
  }
  // the rear wheels: round ink tires, lit by the rim
  for (const cx of [18.5, 29.5]) {
    g.ell(cx, 42.5, 1.7, 3.2, "ink");
  }
  // the basket slung under the seat
  g.rect(20, 32, 9, 3, "ink");
  // the seat back in navy, the hood a sky-blue dome over it, folded in ribs, the handlebar across the
  // top
  g.rect(19, 26, 11, 7, "navy");
  g.rect(19, 26, 1, 7, "dslate");
  g.cel(24.5, 20.5, 6.5, 6.5, "sky", "blue", "cyan", 2.3);
  g.rect(17, 21, 15, 7, null);
  g.rect(18, 21, 13, 5, "sky");
  g.rect(28, 21, 3, 5, "blue");
  for (const y of [17, 20, 23]) {
    g.rect(19, y, 11, 1, "blue");
  }
  g.rect(18, 25, 13, 1, "cyan");
  g.rect(16, 26, 16, 1, "ink");
  g.rect(16, 27, 1, 1, "ink");
  g.rect(31, 27, 1, 1, "ink");
  // The dad plants one foot while the other knee recovers beside the steady stroller.
  humanLegs(g, lf, rf, b, "blue", "navy", "brown", { x0: -6 });
  // the left arm holds the coffee, a column in from the frame's edge so the outline closes round it;
  // the right reaches out to the handlebar
  g.rect(1, 22 + b, 3, 9, "forest");
  g.rect(1, 29 + b, 3, 1, "white");
  g.rect(1, 30 + b, 3, 5, "cream");
  g.rect(3, 30 + b, 1, 5, "tan");
  g.rect(1, 32 + b, 3, 1, "brown");
  g.rect(16, 22 + b, 3, 3, "forest");
  g.rect(16, 24 + b, 3, 1, "teal");
  g.rect(16, 25, 3, 2, "skin1");
  // the puffer, lit down its left side and quilted across
  g.rect(4, 21 + b, 13, 13, "forest");
  g.rect(14, 21 + b, 3, 13, "teal");
  g.rect(4, 21 + b, 1, 12, "dgreen");
  for (const y of [25, 29]) {
    g.rect(5, y + b, 11, 1, "teal");
  }
  g.p(4, 21 + b, null);
  g.p(16, 21 + b, null);
  g.ell(10.5, 22 + b, 5.5, 2, "forest", "teal");
  // head: the back of short ginger hair, ears and the nape
  g.rect(9, 19 + b, 4, 3, "skin1");
  g.rect(3, 14 + b, 2, 3, "skin1");
  g.rect(16, 14 + b, 2, 3, "skin2");
  g.cel(10.5, 13.5 + b, 6.5, 6.5, "rust", "dbrown", "ochre");
  g.rect(7, 19 + b, 7, 1, "rust");
  return rim(g, { ...LIT, teal: ["dgreen", null] });
}

export type Side = "left" | "right";

export interface JoggerPose {
  bob?: number;
  knee?: Side | null;
  passing?: Side | null;
  tail?: Side | null;
}

// Running at the player: the left knee driven up as the right foot plants and the body rises 1px, the
// left foot passing down under the body, then the same on the right; the ponytail swings out from
// behind the head away from the raised knee. 4 frames at 100ms.
export const JOGGER_RUN: readonly JoggerPose[] = [
  { bob: -1, knee: "left", tail: "right" },
  { passing: "left" },
  { bob: -1, knee: "right", tail: "left" },
  { passing: "right" },
];
export const JOGGER_RUN_MS = 100;

// A jogger running down the road at the pack, facing the player: a black ponytail tied high (it swings
// out from behind the head to the side tail, "left" or "right", or hangs hidden behind it), a black
// fringe, an orange racerback singlet with a white race bib pinned on its front, bare arms pumping,
// navy capri tights and cyan shoes. knee is the side ("left" or "right", screen left and right) whose
// knee is driven up, the foot lifted and the knee lit, while the other foot plants; passing is the side
// whose foot is passing down under the body, just off the ground. The arm on the raised knee's side
// swings back, half hidden; the other is bent at the elbow, the fist in front of the hip. The road
// outline and the lit rim.
export function jogger({
  bob = 0,
  knee = null,
  passing = null,
  tail = null,
}: JoggerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  // the ponytail behind the head, out to one side
  if (tail) {
    g.cel(16 + (tail === "right" ? 7 : -7), 17 + b, 2.2, 4, "navy", "ink", "dslate");
  }
  // legs: the raised knee comes at us, lit, its foot lifted; the passing foot just off the ground
  for (const [x, side] of [
    [11, "left"],
    [17, "right"],
  ] as const) {
    let f = 0;
    if (knee === side) {
      f = -4;
    } else if (passing === side) {
      f = -1;
    }
    g.rect(x, 31 + b, 4, 10 + f - b, "navy");
    g.rect(x + 3, 31 + b, 1, 10 + f - b, "ink");
    if (knee === side) {
      g.rect(x, 33 + b, 4, 2, "dslate");
    }
    g.rect(x + 1, 41 + f, 2, 2, "skin1");
    g.rect(x, 43 + f, 4, 2, "cyan");
    g.rect(x, 44 + f, 4, 1, "white");
  }
  // arms: swung back and down on the raised knee's side; on the other the upper arm hangs to the elbow
  for (const [x, side] of [
    [5, "left"],
    [24, "right"],
  ] as const) {
    const n = knee === side ? 8 : 6;
    g.rect(x, 22 + b, 3, n, "skin1");
    g.rect(x + 2, 22 + b, 1, n, "skin2");
  }
  // the racerback singlet, bare shoulders either side, the bib pinned on its front, the tights'
  // waistband
  g.rect(9, 21 + b, 14, 11, "orange");
  g.rect(20, 21 + b, 3, 11, "rust");
  g.rect(9, 23 + b, 1, 8, "amber");
  g.rect(9, 21 + b, 3, 2, "skin1");
  g.rect(20, 21 + b, 3, 2, "skin2");
  g.rect(12, 24 + b, 8, 6, "white");
  g.rect(18, 24 + b, 2, 6, "lgrey");
  g.rect(12, 24 + b, 8, 1, "sky");
  bib(g, 16, 27.5 + b);
  g.rect(9, 31 + b, 14, 1, "ink");
  // the forearm bent at the elbow toward us, the fist in front of the hip just inside the elbow
  for (const [x, side] of [
    [5, "left"],
    [24, "right"],
  ] as const) {
    if (knee !== side) {
      const fx = x + (side === "left" ? 2 : -2);
      g.rect(fx, 26 + b, 3, 3, "skin1");
      g.rect(fx, 28 + b, 3, 1, "skin2");
    }
  }
  // the head: the neck, the face, black hair over the crown with a fringe and down the sides
  g.rect(14, 19 + b, 4, 3, "skin1");
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.cel(16, 8.5 + b, 9, 5, "navy", "ink", "dslate");
  g.rect(7, 9 + b, 2, 7, "navy");
  g.rect(23, 9 + b, 2, 7, "ink");
  g.rect(9, 9 + b, 14, 2, "navy");
  g.rect(10, 9 + b, 4, 1, "dslate");
  scope.faceFront(g, 16, 13 + b);
  return rim(g, LIT);
}

// The bib's number, 3x5 digits drawn in the grid's own pixels, as WALLET_DOLLAR is.
export const BIB: readonly (readonly string[])[] = [
  ["111", "001", "010", "100", "100"],
  ["111", "100", "111", "001", "111"],
];

// The race number "75" centred on design point (cx, cy), 1px apart, in ink; under 1.5x the bib is too
// small for digits and takes a 1px ink bar instead.
export function bib(g: Drawable, cx: number, cy: number): void {
  const s = scaleOf(g);
  const px = raster(g);
  const sy = rowScaleOf(g);
  if (s < 1.5) {
    const x0 = Math.floor((cx - 2) * s + 0.5);
    const y0 = Math.floor(cy * sy);
    px.rect(x0, y0, Math.max(1, Math.floor(4 * s + 0.5)), 1, "ink");
    return;
  }
  const x0 = Math.floor(cx * s + 0.5) - 3;
  const y0 = Math.floor(cy * sy + 0.5) - 2;
  BIB.forEach((digit, i) => {
    digit.forEach((row, j) => {
      [...row].forEach((ch, k) => {
        if (ch === "1") {
          px.p(x0 + i * 4 + k, y0 + j, "ink");
        }
      });
    });
  });
}

export interface BikePose {
  flutter?: readonly [number, number, number];
  lf?: number;
  rf?: number;
  sway?: number;
}

// Pedalling at the player: each foot's lift above the bottom of the pedal's turn (the pedals go
// round), the kid's sway over the bars and the streamers' flutter, the column each 2-row piece of a
// streamer swings out by from its grip. 4 frames at 100ms.
export const KID_BIKE_RIDE: readonly BikePose[] = [
  { flutter: [0, 1, 1], lf: -5, rf: 0, sway: -1 },
  { flutter: [0, 0, 1], lf: -3, rf: -2 },
  { flutter: [0, 1, 2], lf: 0, rf: -5, sway: 1 },
  { flutter: [0, 1, 0], lf: -2, rf: -3 },
];
export const KID_BIKE_RIDE_MS = 100;

// A kid riding a little bike down the road at the pack, facing the player as the cyclist does: a
// yellow tee, sky shorts, red shoes and ochre hair under a red helmet with a white stripe, its rim a
// dark visor line with the face clear under it, as the cyclist's. The bike is mauve, its front tire
// edge-on under a mudguard with a lit headlamp (headlamp) over a white reflector, the training wheels
// showing either side behind, a pink streamer 2 design pixels wide trailing from each grip. Shorter
// than an adult rider: the helmet's top is 4 design rows (6px) lower than the cyclist's. The road
// outline and the lit rim.
export function kidOnABike({
  flutter = [0, 0, 0],
  lf = 0,
  rf = 0,
  sway = 0,
}: BikePose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const w = sway;
  // the training wheels behind, on their strut, then the front tire, fork, mudguard and reflector
  for (const x of [9.5, 22.5]) {
    g.blob(x, 42, 1.5, 2.5, "ink");
  }
  g.rect(10, 40, 13, 1, "grey");
  g.blob(16, 40.5, 2, 5, "ink");
  g.rect(15.5, 34, 1, 6, "lgrey");
  g.rect(14, 33, 4, 2, "mauve");
  g.rect(14, 33, 4, 1, "pink");
  g.rect(15, 35, 2, 1, "white");
  // legs either side of the wheel, pedalling: shorts, bare knees and shins, shoes on the pedals
  for (const [x, f] of [
    [10, lf],
    [19, rf],
  ] as const) {
    g.rect(x, 29, 3, 3, "sky");
    g.rect(x, 32, 3, 10 + f, "skin1");
    g.rect(x + 2, 32, 1, 10 + f, "skin2");
    g.rect(x - (x < 16 ? 1 : 0), 42 + f, 4, 2, "red");
    g.rect(x - (x < 16 ? 1 : 0), 43 + f, 4, 1, "dred");
  }
  // the tee, its sleeves and the arms down to the grips
  g.rect(11 + w, 20, 10, 10, "yellow");
  g.rect(18 + w, 20, 3, 10, "amber");
  g.rect(11 + w, 20, 1, 9, "white");
  g.p(11 + w, 20, null);
  g.p(20 + w, 20, null);
  for (const x of [8, 21]) {
    g.rect(x + w, 21, 3, 3, "yellow");
    g.rect(x + w, 24, 3, 1, "skin1");
  }
  // the handlebar across in front, the streamers trailing from the grips, the hands on the grips
  g.rect(6, 26, 20, 1, "grey");
  for (const x of [5, 6, 25, 26]) {
    const side = x < 16 ? -1 : 1;
    flutter.forEach((dx, k) => {
      g.rect(x + side * dx, 28 + 2 * k, 1, 2, "pink");
    });
  }
  g.rect(5, 25, 3, 3, "ink");
  g.rect(24, 25, 3, 3, "ink");
  g.rect(6, 25, 3, 2, "skin1");
  g.rect(23, 25, 3, 2, "skin1");
  // head: the face under the helmet, ochre hair at the sides, then the helmet, its stripe and visor
  g.rect(14 + w, 19, 4, 2, "skin1");
  faceDisc(g, 16 + w, 15.5, 6.5, 5.5, "skin1", "skin2");
  g.rect(9 + w, 13, 2, 5, "ochre");
  g.rect(21 + w, 13, 2, 5, "ochre");
  g.cel(16 + w, 10, 7, 3.5, "red", "dred", "pink", 2.2);
  g.rect(15.5 + w, 7, 1, 6, "white");
  g.rect(9 + w, 13, 14, 1, "ink");
  scope.faceFront(g, 16 + w, 15);
  // the lit headlamp on the mudguard, a row taller at the 2px steps so @50's settling thins it, not
  // the eyes
  headlamp(g, 16, 35.5, { spare: 1 });
  return rim(g, LIT);
}

// The grid every drawing here makes and the drawings small() swaps while it runs (see mini.ts).
export const scope: RoadScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
  faceFront,
  squirrelHead,
};

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  const frames = (gs: readonly Drawable[], outline = true): Frame[] =>
    gs.map((g) => g.outlined(outline));

  // the walkers carry the leash on every road, so their outlines hold 3:1 on the light roads
  for (const [name, draw] of WALKERS) {
    const pose = (q: WalkerPose): Drawable => edged(big(draw, q));
    const wave = WAVES.get(name)!;
    const tags: Tag[] = [
      ["walk", frames(WALKER_WALK.map(pose)), WALKER_WALK_MS],
      ["react", frames(WALKER_REACT.map(pose)), 120],
      ["stumble", frames(WALKER_STUMBLE.map(([k, q]) => lean(pose(q), k))), 90],
      ["idle", frames(WALKER_IDLE.map(pose)), BREATH_MS],
      ["wave", frames(WALKER_WAVE.map((w) => edged(big(wave, { wave: w })))), WALKER_WAVE_MS],
      [
        "cheer",
        WALKER_CHEER.map(([crouch, swing, hop]) =>
          hopped(edged(big(cheering, name, swing, { bob: crouch })).outlined(), hop),
        ),
        WALKER_CHEER_MS,
      ],
    ];
    if (name === "walker-mr-b") {
      tags.push([
        "phone",
        frames(
          (
            [
              [0, 0],
              [1, 0],
              [1, -1],
              [0, -1],
            ] as const
          ).map(([tap, bob]) => edged(big(mrBPhone, { bob, tap }))),
        ),
        400,
      ]);
    }
    yield [name, tags];
  }
  yield ["treat", [["idle", frames(TREAT_IDLE.map((q) => big(treat, q))), 400]]];
  yield ["tip", [["idle", frames([5.5, 3.5, 1, 3.5].map((rx) => big(tip, rx))), 120]]];
  yield [
    "skunk",
    [
      ["idle", frames(SKUNK_IDLE.map((q) => big(skunk, q))), 300],
      ["walk", frames(SKUNK_WALK.map((q) => big(skunk, q))), PERSON_WALK_MS],
    ],
  ];
  yield [
    "squirrel",
    [
      ["idle", frames([big(squirrel, { tail: 0 }), big(squirrel, { tail: 1 })]), 300],
      ["run", frames([0, 1, 2, 3].map((k) => big(squirrelRun, k))), 60],
    ],
  ];
  yield ["puddle", [["idle", frames([puddle(0), puddle(1)], false), 500]]];
  yield ["pothole", [["idle", frames([pothole(0), pothole(1)], false), 500]]];
  yield [
    "skunk-cloud",
    [
      [
        "loop",
        frames(
          [0, 1, 2, 3].map((i) => skunkCloud(i)),
          false,
        ),
        220,
      ],
    ],
  ];
  yield [
    "other-dog",
    [
      ["walk", frames(CORGI_WALK.map((q) => big(corgi, q))), 100],
      ["idle", frames(CORGI_IDLE.map((q) => big(corgi, q))), 300],
    ],
  ];
  const owner: PersonOptions = { shoes: "dbrown" };
  yield [
    "other-dog-owner",
    [
      [
        "walk",
        frames(
          HUMAN_WALK.map((q) => big(dressed, dogOwnerTop, { grounded: true, ...q, ...owner })),
        ),
        HUMAN_WALK_MS,
      ],
      [
        "idle",
        frames(
          BREATH.map((bb) => big(dressed, dogOwnerTop, { bob: bb, grounded: true, ...owner })),
        ),
        BREATH_MS,
      ],
    ],
  ];
  yield [
    "thief",
    [
      [
        "walk",
        frames(HUMAN_WALK.map((q) => big(dressed, thiefTop, { grounded: true, ...q }))),
        HUMAN_WALK_MS,
      ],
      ["flee", frames([-1, 1].map((k) => big(thiefFleeing, k))), 110],
      [
        "idle",
        frames(BREATH.map((bb) => big(dressed, thiefTop, { bob: bb, grounded: true }))),
        BREATH_MS,
      ],
    ],
  ];
  yield ["lost-wallet", [["idle", frames([big(wallet, false), big(wallet, true)]), 450]]];
  const neighbour: PersonOptions = { legs: "purple", shoes: "dbrown" };
  yield [
    "friendly-neighbour",
    [
      [
        "walk",
        frames(
          HUMAN_WALK.map((q) =>
            big(dressed, neighbourTop(false, -(q.bob ?? 0)), {
              grounded: true,
              ...q,
              ...neighbour,
            }),
          ),
        ),
        HUMAN_WALK_MS,
      ],
      [
        "wave",
        frames(
          [0, 1].map((k) =>
            big(dressed, neighbourTop(true, k), {
              bob: NEIGHBOUR_CROUCH,
              grounded: true,
              ...neighbour,
            }),
          ),
        ),
        350,
      ],
      [
        "idle",
        frames(
          BREATH.map((bb, k) =>
            big(dressed, neighbourTop(false, k), { bob: bb, grounded: true, ...neighbour }),
          ),
        ),
        BREATH_MS,
      ],
    ],
  ];
  yield ["fx-bark", [["pop", frames([bark(false), bark(true)]), 120]]];
  const [drive, driveMs] = TRUCK_DRIVE;
  yield [
    "ice-cream-truck",
    [
      ["idle", frames([0, 1].map((f) => drawn(TRUCK_SCALE, iceCreamTruck, f))), 400],
      ["drive", frames(drive.map((r) => drawn(TRUCK_SCALE, iceCreamTruck, 0, r))), driveMs],
    ],
  ];
  yield [
    "mail-carrier",
    [
      ["walk", frames(HUMAN_WALK.map((q) => big(mailCarrier, q))), HUMAN_WALK_MS],
      ["idle", frames(BREATH.map((bb) => big(mailCarrier, { bob: bb }))), BREATH_MS],
    ],
  ];
  yield [
    "stroller",
    [["walk", frames(STROLLER_WALK.map((q) => big(stroller, q))), STROLLER_WALK_MS]],
  ];
  yield ["jogger", [["run", frames(JOGGER_RUN.map((q) => big(jogger, q))), JOGGER_RUN_MS]]];
  yield [
    "kid-on-a-bike",
    [["ride", frames(KID_BIKE_RIDE.map((q) => big(kidOnABike, q))), KID_BIKE_RIDE_MS]],
  ];
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites, srcDir: "art/road" });
}
