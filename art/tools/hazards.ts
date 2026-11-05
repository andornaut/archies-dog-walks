// Draw the moving hazards: things that cross the road or come down it, and the warning cue shown at
// the lane edge about a second before one enters.
//
// squirrel-dash       48x48   Toronto's black squirrel, side view facing right; idle (2 frames,
//                             400ms): crouched on all four paws at the road's edge, the tail plume
//                             flicking; run (4 frames, 80ms): a bounding gallop, tail streaming
// loose-dog           48x48   the corgi from other-dog in side view facing right, no owner; idle (2
//                             frames, 400ms): standing square, a breath, the leash drifting; run (4
//                             frames, 100ms): a gallop, gathered, reaching, airborne and landing, the
//                             broken leash trailing up off the back, frayed, a 1px wave travelling
//                             down it
// ball-bounce         24x36   a ball bouncing across lanes, with its own ground shadow (the game draws
//                             none); idle (2 frames, 400ms): resting round on the ground, rocking 1px;
//                             bounce (6 frames, 70ms), squashed on contact
// cyclist             48x72   front view, riding down a lane at the player, a lit headlamp on the
//                             mudguard; ride (4 frames, 90ms): pedalling legs and a 1px sway
// coyote              48x48   three-quarter front, angled right, stalking the pack: the back sloping
//                             from hunched shoulders to the hips over four thin legs set apart, a low
//                             head with a long pointed snout, big ears forward, tail low; idle (2
//                             frames, 400ms): a breath and an ear flick; walk (4 frames, 120ms): the
//                             creep, a diagonal pair of paws lifting as the body sinks under a level
//                             head; step (4 frames, 80ms): a low lunge for each step
// ui-warning          16x16   a yellow warning sign with a bold "!", ink outline; pulse (2 frames,
//                             250ms)
// ui-warning-arrow    16x16   a yellow arrow, ink outline; pulse (2 frames, 250ms) points right for a
//                             crosser, down-pulse (2 frames, 250ms) points down the road for a mover
//                             about to come at the pack, up-pulse (2 frames, 250ms) points up the road
//                             for one about to move off ahead; each nudges 1px its way on frame 2
// ui-warning-wander   16x16   a bold yellow "?", ink outline, over a wanderer before each step; pulse
//                             (2 frames, 250ms) pops it 1px up on frame 2
//
// The side views face right; the game mirrors squirrel-dash, loose-dog and ui-warning-arrow for a
// crossing to the left, and the coyote for a step to the left. Every road sprite takes the road
// outline rule (pixel.ts's roadEdge), so its silhouette holds 3:1 on the three light roads and its
// fill carries the dslate road; squirrel-dash and the coyote also take road.ts's LIT rim. The warning
// cues are outlined in ink.
//
// The road sprites are laid out on 32x32 (the cyclist 32x48) and drawn road.ts's SCALE (1.5) times
// bigger on a mini.ts Mini, which keeps 1px lines 1px; the ball is drawn at each size from BALL.
// Depth variants, redrawn at their own size with a full outline (see minis.ts): squirrel-dash@75,
// loose-dog@75 (36x36), squirrel-dash@50, loose-dog@50 (24x24), ball-bounce@75, ball-bounce@50
// (18x27, 12x18), cyclist@75, cyclist@50 (36x54, 24x36) and coyote@75, coyote@50 (36x36, 24x24),
// each on a Mini at SCALE times the step; depths.ts draws the steps between them.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.
import { Mini, scaled, SCALES, small as miniSmall, STEPS } from "./mini.ts";
import {
  type Colour,
  type Drawable,
  type DrawingScope,
  edged,
  type FaceFront,
  type Frame,
  Grid,
  K,
  main,
  type Point,
  raster,
  scaleOf,
  type Sprite,
  type Tag,
} from "./pixel.ts";
import {
  faceDisc,
  faceFront,
  headlamp,
  lean,
  lit,
  SCALE,
  scope as roadScope,
  SQUIRREL_FUR,
} from "./road.ts";

const USAGE = `Usage:
  node art/tools/hazards.ts preview OUT.png   every frame on the zone roads
  node art/tools/hazards.ts build             export to public/art/sprites/`;

// What makes a pose's grid: a Grid at full size, or a Mini for a depth variant (see small).
type GridMaker = (w?: number, h?: number) => Drawable;

// The grid every drawing here makes and road.ts's face, which mini.ts's small swaps while it runs.
const scope: DrawingScope & { faceFront: FaceFront } = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
  faceFront,
};

function range(start: number, stop: number): number[] {
  const out: number[] = [];
  for (let i = start; i < stop; i++) {
    out.push(i);
  }
  return out;
}

// ---------- squirrel-dash: side view, facing right ----------

// A squirrel-dash pose: body lift, body stretch, front and hind paw positions (x, y of the paw's
// top-left pixel) and the tail tip's offset as it streams.
interface SquirrelPose {
  dy?: number;
  front?: Point;
  hind?: Point;
  new?: GridMaker;
  st?: number;
  tail?: Point;
}

// A bounding gallop, one pose per frame. Laid out small, as road.ts's squirrel is: a design unit is
// 1.5px at full size, so thirds land on whole pixels.
const SQUIRREL_RUN: readonly SquirrelPose[] = [
  // gathered
  { dy: 0, front: [17 + 1 / 3, 26 + 2 / 3], hind: [14, 26 + 2 / 3], st: -2 / 3, tail: [0, 0] },
  // hind push off
  {
    dy: -2 / 3,
    front: [21 + 1 / 3, 24 + 2 / 3],
    hind: [10 + 2 / 3, 26 + 2 / 3],
    st: 2 / 3,
    tail: [-2 / 3, 2 / 3],
  },
  // flight
  { dy: -4 / 3, front: [22, 25 + 1 / 3], hind: [8, 24], st: 2 / 3, tail: [-2 / 3, 4 / 3] },
  // front lands
  {
    dy: -2 / 3,
    front: [20 + 2 / 3, 26 + 2 / 3],
    hind: [11 + 1 / 3, 24 + 2 / 3],
    st: 0,
    tail: [0, 2 / 3],
  },
];
// Waiting at the road's edge: crouched with all four paws under, the plume flicking forward and back.
const SQUIRREL_IDLE: readonly SquirrelPose[] = [
  { ...SQUIRREL_RUN[0], st: 0 },
  { ...SQUIRREL_RUN[0], st: 0, tail: [-2 / 3, 2 / 3] },
];

// Toronto's black squirrel in road.ts's SQUIRREL_FUR, lit by LIT's rim, small beside the pack as
// road.ts's squirrel is. new makes the grid: a Grid at full size, or a Mini for a depth variant.
function squirrelDash({
  dy = 0,
  front = [17 + 1 / 3, 26 + 2 / 3],
  hind = [14, 26 + 2 / 3],
  new: make = (w, h) => scope.Grid(w, h),
  st = 0,
  tail = [0, 0],
}: SquirrelPose = {}): Drawable {
  const f = SQUIRREL_FUR;
  const g = edged(make());
  const [tx, ty] = tail;
  const u = 2 / 3;
  // far legs: a shade darker, a step behind the near ones
  g.rect(hind[0] + 2 * u, hind[1] - u, 2, 2 * u, f.shade);
  g.rect(front[0] - 2 * u, front[1] - u, 2 * u, 2 * u, f.shade);
  // tail: a big plume streaming back and up from the rump, its tip curling over
  g.cel(12 + tx / 2, 21 + dy + ty / 2, 2.2, 2.2, f.fur, f.shade);
  g.cel(14.6 + tx, 15.6 + dy + ty, 1, 1, f.fur, f.shade);
  g.cel(12.6 + tx, 14.6 + dy + ty, 2.4, 1.5, f.fur, f.shade, f.lit);
  g.cel(10.2 + tx, 17.4 + dy + ty, 3, 3.5, f.fur, f.shade, f.lit);
  g.cel(10.5 + tx, 18 + dy + ty, 1.5, 2.1, f.streak);
  // hind leg: haunch, then a long foot
  const [hx, hy] = hind;
  for (let k = 0; k < 5; k++) {
    const t = k / 4;
    g.rect(13 + (hx - 13) * t, 23.6 + dy + (hy - 23.6 - dy) * t, 2 * u, 2 * u, f.fur);
  }
  g.rect(hx, hy, 2, 2 * u, f.fur);
  g.rect(hx, hy + u, 2, u, f.shade);
  // body
  g.cel(13.2, 23 + dy, 2.4, 2.8, f.fur, f.shade, f.lit);
  g.cel(15.6, 23 + dy, 4 + st, 3.1, f.fur, f.shade, f.lit);
  g.cel(16.6, 24.8 + dy, 2.2, 1, f.belly);
  // front leg: a thin arm from the chest to the paw
  const [fx, fy] = front;
  for (let k = 0; k < 4; k++) {
    const t = k / 3;
    g.rect(18.7 + (fx - 18.7) * t, 24.4 + dy + (fy - 24.4 - dy) * t, 2 * u, 2 * u, f.fur);
  }
  g.rect(fx, fy, 2 * u, 2 * u, f.fur);
  g.rect(fx + u, fy + u, u, u, f.shade);
  // head: round, a lighter cheek, a tufted ear, a big eye with a white glint and a grey nose
  g.tri([18.6, 18.6 + dy], [19.5, 16.4 + dy], [20.9, 18.2 + dy], f.fur);
  g.cel(21.3, 20.6 + dy, 3.1, 2.8, f.fur, f.shade, f.lit);
  g.cel(22.3, 22.1 + dy, 1.9, 0.9, f.belly);
  g.rect(21 + 1 / 3, 18 + 2 / 3 + dy, 2 * u, 2 * u, "ink");
  g.rect(21 + 1 / 3, 18 + 2 / 3 + dy, u, u, "white");
  g.rect(24, 20 + dy, u, u, f.nose);
  lit(g);
  return g;
}

// ---------- loose-dog: the other dog's corgi, side view, facing right ----------

// A loose-dog pose: body lift, the near front and hind paws' top-left pixels, and the broken leash's
// wave, a 1px offset for each of its three trailing points.
interface CorgiPose {
  bob?: number;
  front?: Point;
  hind?: Point;
  leash?: readonly [number, number, number];
  new?: GridMaker;
}

// A corgi's gallop, one pose per frame, read like SQUIRREL_RUN. The wave travels down the leash 1px
// a frame. The far legs follow the near ones 2px further forward.
export const CORGI_RUN: readonly CorgiPose[] = [
  // gathered: all four paws under
  { bob: 0, front: [16, 27], hind: [9, 27], leash: [0, 1, 0] },
  // hind push off, front reaching
  { bob: -1, front: [23, 25], hind: [3, 27], leash: [1, 0, -1] },
  // airborne, stretched out
  { bob: -2, front: [25, 23], hind: [1, 24], leash: [0, -1, 0] },
  // front paws land, hind swing in
  { bob: -1, front: [20, 27], hind: [6, 25], leash: [-1, 0, 1] },
];
// Waiting at the road's edge: standing square, a breath lifting the body, the leash drifting.
const CORGI_IDLE: readonly CorgiPose[] = [
  { bob: 0, front: [18, 27], hind: [8, 27], leash: [0, 1, 0] },
  { bob: -1, front: [18, 27], hind: [8, 27], leash: [1, 0, -1] },
];

// A leg w pixels wide and 2 tall per step, from the shoulder or hip (x0, y0) to the paw (x1, y1).
export function limb(
  g: Drawable,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  c: Colour,
): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let k = 0; k <= n; k++) {
    g.rect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), w, 2, c);
  }
}

// new makes the grid, as for squirrelDash. The dog sits 1px lower than bob says, so the ear tips
// keep their outline in flight.
function corgiSide({
  bob = 0,
  front = [14, 27],
  hind = [11, 27],
  leash = [0, 0, 0],
  new: make = (w, h) => scope.Grid(w, h),
}: CorgiPose = {}): Drawable {
  const g = edged(make());
  const b = bob + 1;
  // far legs: a shade darker, 2px further forward than the near ones
  for (const [[x, y], [px, py]] of [
    [[10, 21 + b], hind],
    [[20, 21 + b], front],
  ] as const) {
    limb(g, x, y, px + 3, py - 1, 2, "rust");
    g.rect(px + 3, py, 2, 2, "lgrey");
  }
  // the broken leash: up off the collar and trailing well clear of the back, waving, frayed at the
  // end; the leash is 1px wide and unbroken at any scale: its points are placed on the drawn grid and
  // joined there
  const [w1, w2, w3] = leash;
  const sc = scaleOf(g);
  const px = raster(g);
  const pts = (
    [
      [19, 13],
      [15, 7],
      [10, 5 + w1],
      [6, 4 + w2],
      [3, 5 + w3],
    ] as const
  ).map(([x, y]) => [Math.floor((x + 0.5) * sc), Math.floor((y + b + 0.5) * sc)] as const);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      px.p(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), "red");
    }
  }
  const [ex, ey] = pts.at(-1)!;
  px.p(ex - 1, ey - 1, "red");
  px.p(ex - 1, ey + 1, "red");
  // stub tail: a fluffy tuft at the rump
  g.cel(4.5, 16 + b, 2.5, 2, "ochre", "rust", "tan");
  // body: long and low, white underneath
  g.cel(14, 19 + b, 9.5, 5, "ochre", "rust", "tan");
  g.cel(15, 22 + b, 7, 2, "white", "lgrey");
  // chest ruff
  g.cel(21, 19 + b, 3, 3.5, "white", "lgrey");
  // near legs: short, ochre with white socks
  for (const [[x, y], [fx, fy]] of [
    [[7, 21 + b], hind],
    [[18, 21 + b], front],
  ] as const) {
    limb(g, x, y, fx, fy - 1, 3, "ochre");
    g.rect(fx, fy, 3, 2, "white");
    g.p(fx + 2, fy + 1, "lgrey");
  }
  // head: fox face, big upright ears with pink insides, white blaze and muzzle
  g.tri([19.5, 9 + b], [20.5, 2 + b], [24, 7.5 + b], "ochre");
  g.tri([24, 8 + b], [26.5, 2 + b], [28, 9 + b], "ochre");
  g.tri([21, 8 + b], [21, 4.5 + b], [23, 7.5 + b], "pink");
  g.tri([25.5, 7 + b], [26.5, 4 + b], [27, 7.5 + b], "pink");
  g.cel(23.5, 12.5 + b, 5, 4.5, "ochre", "rust", "tan");
  g.cel(27, 14.5 + b, 3, 2, "white", "lgrey");
  g.rect(29, 13 + b, 1, 2, "ink");
  g.p(28, 13 + b, "ink");
  g.rect(24, 11 + b, 2, 2, "ink");
  g.p(24, 11 + b, "white");
  g.p(27, 16 + b, "dbrown");
  // collar, with the snapped leash clip
  g.rect(19, 13 + b, 2, 5, "amber");
  g.p(20, 13 + b, "yellow");
  return g;
}

// ---------- ball-bounce: a ball, bouncing ----------

// The bounce, laid out on a design 28 wide and scaled to each step's frame, floor(24x36 x step +
// 0.5): the ball's bottom height per frame; its radii when squashed on contact, stretched near the
// ground and round at the top of the arc; and the shadow's width per frame. ballSteps adds the ground
// row, 2 rows above the frame's bottom (the ball's outline touches it on contact, and the shadow is
// centred on it), and the stripes' width, spacing and step per frame (whole cycles over the 6
// frames, so the loop has no jump).
const BALL_LAYOUT = {
  heights: [0, 11, 15, 17, 15, 11],
  round: [9, 9],
  shadow: [21, 17, 14, 11, 14, 17],
  squash: [10.4, 7],
  stretch: [7, 10.4],
  width: 28,
} as const;
const BALL_SIZE: Point = [24, 36];

// The bounce's layout at one depth step (see BALL_LAYOUT).
interface BallStep {
  ground: number;
  heights: readonly number[];
  round: Point;
  shadow: readonly number[];
  size: Point;
  squash: Point;
  stretch: Point;
  stripes: readonly [width: number, gap: number, step: number];
}

// The bounce's layout by depth step, for the full size and each of mini.ts's STEPS.
function ballSteps(): Map<number, BallStep> {
  const out = new Map<number, BallStep>();
  const radii = (v: readonly number[], k: number): Point => [v[0]! * k, v[1]! * k];
  for (const s of [1, ...STEPS.map(([, v]) => v)]) {
    const [w, h] = BALL_SIZE.map((v) => Math.floor(v * s + 0.5)) as [number, number];
    const k = w / BALL_LAYOUT.width;
    out.set(s, {
      ground: h - 2,
      heights: BALL_LAYOUT.heights.map((v) => Math.round(v * k)),
      round: radii(BALL_LAYOUT.round, k),
      shadow: BALL_LAYOUT.shadow.map((v) => Math.max(3, Math.round(v * k))),
      size: [w, h],
      squash: radii(BALL_LAYOUT.squash, k),
      stretch: radii(BALL_LAYOUT.stretch, k),
      stripes: w >= 24 ? [3, 9, 3] : [2, 6, 2],
    });
  }
  return out;
}

const BALL = ballSteps();

// Frame f of the bounce at scale s: squashed on contact (f 0), stretched on the frames either side of
// it, round at the top; rest draws it round on the ground, as frame 0 otherwise, its stripes rolled
// rock pixels. It is white with two red stripes rolling across, so it reads on the dslate road as
// well as the light ones.
function ballBounce(f: number, s = 1, rest = false, rock = 0): Frame {
  const q = BALL.get(s)!;
  const [w, h] = q.size;
  const up = q.heights[f]!;
  const [rx, ry] = rest
    ? q.round
    : f === 0
      ? q.squash
      : up < Math.max(...q.heights) - 2
        ? q.stretch
        : q.round;
  const g = edged(scope.Grid(w, h));
  const cx = w / 2;
  const cy = q.ground - up - ry;
  g.ell(cx, cy, rx, ry, "white", "lgrey");
  const [sw, gap, step] = q.stripes;
  const left = Math.round(cx - rx);
  const lgrey = K.lgrey!;
  for (let x = left - 2 * gap; x < w; x++) {
    const v = x - left - f * step - rock;
    if (((v % gap) + gap) % gap < sw) {
      for (let y = 0; y < h; y++) {
        const c = g.px[y]![x];
        if (c) {
          g.p(x, y, c === lgrey ? "dred" : "red");
        }
      }
    }
  }
  const out = g.outlined();
  // the ground shadow: no outline, narrower as the ball rises; at 0.5 a single row
  const shadow = q.shadow[f]!;
  const rows: [number, number][] =
    s === 0.5
      ? [[q.ground, shadow]]
      : [
          [q.ground, shadow],
          [q.ground + 1, shadow - 2],
        ];
  if (s >= 0.875) {
    rows.push([q.ground - 1, shadow - 2]);
  }
  for (const [y, rw] of rows) {
    for (let x = Math.round(w / 2 - rw / 2); x < Math.round(w / 2 + rw / 2); x++) {
      if (y >= 0 && y < h && !out[y]![x]) {
        out[y]![x] = K.navy!;
      }
    }
  }
  return out;
}

// ---------- cyclist: front view, riding down a lane at the player ----------

// A cyclist pose: the left and right foot rows (the pedals go round) and the sway.
interface CyclistPose {
  lf?: number;
  rf?: number;
  sway?: number;
}

// Pedalling, one pose per frame.
export const CYCLIST_RIDE: readonly Required<CyclistPose>[] = [
  { lf: 36, rf: 41, sway: -1 },
  { lf: 38, rf: 39, sway: 0 },
  { lf: 41, rf: 36, sway: 1 },
  { lf: 39, rf: 38, sway: 0 },
];

// The rider facing the player, laid out on 32x48; cyclistAt draws it at size and adds the sway.
function cyclist({ lf = 36, rf = 41 }: CyclistPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  // front wheel: a tire seen edge-on, with a mudguard and the fork
  g.blob(16, 39.5, 2.5, 7, "ink");
  g.rect(15, 35, 1, 9, "grey");
  g.rect(14, 33, 4, 2, "lgrey");
  g.rect(14, 34, 4, 1, "grey");
  g.rect(15, 29, 2, 4, "sky");
  g.rect(16, 29, 1, 4, "blue");
  // legs either side of the wheel: shorts, bare knees and shins, shoes on the pedals
  for (const [x, foot] of [
    [10, lf],
    [19, rf],
  ] as const) {
    g.rect(x, 29, 3, 4, "navy");
    g.rect(x + 2, 29, 1, 4, "ink");
    g.rect(x, 33, 3, foot - 33, "skin1");
    g.rect(x + 2, 33, 1, foot - 33, "skin2");
    g.rect(x < 16 ? x - 1 : x, foot, 4, 2, "white");
    g.rect(x < 16 ? x - 1 : x, foot + 1, 4, 1, "lgrey");
    g.rect(x + (x < 16 ? 2 : -1), foot + 2, 2, 1, "grey");
  }
  // jersey: bright green with a white chest band, leaning over the bars
  g.rect(9, 20, 14, 10, "green");
  g.rect(20, 20, 3, 10, "dgreen");
  g.rect(9, 24, 14, 2, "white");
  g.rect(20, 24, 3, 2, "lgrey");
  g.p(9, 20, null);
  g.p(22, 20, null);
  // arms down to the grips
  for (const x of [5, 24]) {
    g.rect(x, 21, 3, 3, "green");
    g.rect(x, 24, 3, 3, "skin1");
    g.rect(x + 2, 24, 1, 3, "skin2");
  }
  // handlebar across, grips under the hands
  g.rect(6, 27, 20, 2, "grey");
  g.rect(6, 27, 20, 1, "lgrey");
  for (const x of [4, 25]) {
    g.rect(x, 26, 3, 3, "ink");
    g.rect(x, 25, 3, 2, "skin1");
  }
  // head: face, then a cyan helmet with vents and a dark visor
  faceDisc(g, 16, 13.5, 7.5, 6.5, "skin1", "skin2");
  scope.faceFront(g, 16, 13);
  g.cel(16, 7.5, 9, 5, "cyan", "sky", "white");
  g.rect(7, 10, 18, 2, "cyan");
  g.rect(22, 10, 3, 2, "sky");
  g.rect(8, 12, 16, 1, "ink");
  for (const x of [12, 16, 20]) {
    g.rect(x === 16 ? x - 1 : x, 4, 2, 3, "navy");
  }
  g.rect(8, 13, 1, 5, "dslate");
  g.rect(23, 13, 1, 5, "dslate");
  // the lit headlamp on the mudguard
  headlamp(g, 16, 34);
  return g;
}

// Shift rows above bottom k pixels sideways: the rider leans over the bars, which stay put.
export function swayRows(g: Drawable, k: number, bottom: number): void {
  if (!k) {
    return;
  }
  const px = raster(g);
  for (let y = 0; y < bottom; y++) {
    const row = px.px[y]!;
    px.px[y] = range(0, px.w).map((x) => (x - k >= 0 && x - k < px.w ? row[x - k]! : null));
  }
}

// cyclist on a Mini at SCALE x step s. At full size the rider leans (road.ts's lean shears about the
// feet); smaller, the rows above the handlebar shift sideways, which keeps the bars and wheel put.
function cyclistAt(s: number, { lf = 36, rf = 41, sway = 0 }: CyclistPose = {}): Drawable {
  const g = miniSmall(roadScope, scope, SCALE * s, cyclist, { lf, rf });
  if (s === 1) {
    return sway ? edged(lean(g, sway)) : raster(g);
  }
  const px = raster(g);
  swayRows(px, sway, scaled(26, SCALE * s));
  return px;
}

// ---------- coyote: three-quarter front view, stalking the pack, angled right ----------

// A coyote pose: each paw's lift off the road (fl, fr the far and near front paws, bl, br the far and
// near hind ones), the body's offset (negative is up), the head's and the near ear's flick.
interface CoyotePose {
  bl?: number;
  bob?: number;
  br?: number;
  ear?: number;
  fl?: number;
  fr?: number;
  head?: number;
  new?: GridMaker;
}

// The stalk, one pose per frame. A slow creep: one diagonal pair lifts while the body sinks to slink
// under it, then the other, the head held level.
const COYOTE_WALK: readonly CoyotePose[] = [
  { bl: 1, bob: 1, fr: 2, head: -1 },
  {},
  { bob: 1, br: 1, fl: 2, head: -1 },
  {},
];
// Crouched and watching: a breath (the body 1px up) and the near ear flicking back.
const COYOTE_IDLE: readonly CoyotePose[] = [{}, { bob: -1, ear: 1 }];
// A quick low lunge for each step, never rising off its crouch: a sink onto the haunches, the push
// with the front paws up and the ears pinned back, the reach with the head thrust lower still, and
// the landing.
const COYOTE_STEP: readonly CoyotePose[] = [
  { bob: 1, head: 1 },
  { ear: 1, fl: 2, fr: 2, head: 1 },
  { bob: 1, ear: 1, fl: 1, fr: 2, head: 2 },
  { bl: 1, bob: 1, br: 1 },
];
const COYOTE_OFFSETS: readonly string[] = ["bl", "bob", "br", "ear", "fl", "fr", "head"];

// A lean tawny coyote creeping at the pack, three-quarter front and angled right. The back slopes
// from the shoulders, hunched high, down to the hips, and the belly tucks up between the legs. The
// head is held low in front, with a long pointed snout, big pricked ears and narrowed yellow eyes.
// The bushy tail hangs low with a black tip. Four thin legs stand apart with the road between them:
// the hind pair angled back to the hock, the front pair under the chest, the near legs brown with a
// lit edge and the far ones a shade darker and 1px shorter. A dark saddle down the back, a cream
// muzzle, throat and chest, a dark stripe down the front of the near foreleg. new makes the grid, as
// for squirrelDash.
function coyote({
  bl = 0,
  bob = 0,
  br = 0,
  ear = 0,
  fl = 0,
  fr = 0,
  head = 0,
  new: make = (w, h) => scope.Grid(w, h),
}: CoyotePose = {}): Drawable {
  const g = edged(make());
  const b = bob;
  const h = bob + head;

  // A paw on row foot - 1, lifted lift px.
  const paw = (x: number, foot: number, lift: number, col: string, shade: string): void => {
    g.rect(x, foot - 1 - lift, 2.5, 1, col);
    g.p(x + 2, foot - 1 - lift, shade);
  };
  // A hind leg from the hip at x + 3 down and back to the hock at x, then down to the paw.
  const hindLeg = (x: number, foot: number, lift: number, col: string, shade: string): void => {
    limb(g, x + 3, 18 + b, x + 0.5, 23 + b, 2, col);
    g.rect(x, 23 + b, 1.5, foot - 1 - lift - 23 - b, col);
    g.rect(x + 1, 23 + b, 0.5, foot - 1 - lift - 23 - b, shade);
    paw(x, foot, lift, col, shade);
  };
  // A foreleg straight down from top to the paw.
  const fore = (
    x: number,
    top: number,
    foot: number,
    lift: number,
    col: string,
    shade: string,
  ): void => {
    g.rect(x, top, 1.5, foot - 1 - lift - top, col);
    g.rect(x + 1, top, 0.5, foot - 1 - lift - top, shade);
    paw(x, foot, lift, col, shade);
  };

  // the bushy tail, swept back and down off the rump and well clear of the ground, so it never reads
  // as a leg
  g.cel(5, 16.5 + b, 2.2, 3, "brown", "dbrown", "tan");
  g.cel(3, 19 + b, 2.2, 2.4, "brown", "dbrown");
  g.cel(2, 21.5 + b, 1.6, 1.8, "brown", "dbrown");
  // the far legs, a shade darker and 1px shorter: the hind under the hip, the front under the
  // shoulder
  hindLeg(11, 28, bl, "dbrown", "dbrown");
  fore(18.5, 19 + b, 28, fl, "dbrown", "dbrown");
  // the body: the haunch, the back sloping up from it to the shoulders, the belly tucked up behind
  // the chest
  g.cel(9.5, 16.5 + b, 3, 3.2, "brown", "dbrown");
  g.cel(14.5, 15 + b, 5.5, 2.5, "brown");
  g.tri([9, 13.5 + b], [19, 9.5 + b], [20, 18.5 + b], "brown");
  g.tri([9, 13.5 + b], [20, 18.5 + b], [15, 17.5 + b], "brown");
  g.tri([8, 15 + b], [15, 17.5 + b], [10, 19.5 + b], "brown");
  g.tri([10, 14.5 + b], [18.5, 11 + b], [18.5, 12.5 + b], "dbrown");
  g.tri([10, 14.5 + b], [18.5, 12.5 + b], [10.5, 15.5 + b], "dbrown");
  // the near hind leg, then the hunched shoulders
  hindLeg(6.5, 29, br, "brown", "dbrown");
  g.cel(19.5, 13.5 + b, 3.8, 4.5, "brown", "dbrown", "tan");
  // the cream throat and chest, then the near foreleg, a dark stripe down its front
  g.cel(22.5, 20 + b, 2.3, 2.8, "cream", "tan");
  fore(23, 21 + b, 29, fr, "brown", "dbrown");
  g.rect(23, 23 + b, 0.5, 3 - fr, "dbrown");
  // ears, big and pricked forward; the near one flicks back
  g.tri([20.5, 17 + h], [21.5, 9 + h], [24, 15 + h], "brown");
  g.tri([21.3, 16 + h], [21.8, 11.5 + h], [23.3, 15 + h], "cream");
  g.tri([24.5, 16.5 + h], [28.5 - ear, 9 + h + ear], [28, 18 + h], "brown");
  g.tri([25.5, 16 + h], [28 - ear, 11.5 + h + ear], [27.5, 16.5 + h], "cream");
  // head: held low, the long pointed snout reaching down at the pack and right, cream below
  g.cel(24, 18 + h, 3.8, 3, "brown", "dbrown", "tan");
  g.tri([25, 16.5 + h], [30.5, 20 + h], [25, 20.5 + h], "brown");
  g.tri([23, 19.5 + h], [30.5, 20 + h], [24.5, 22.5 + h], "cream");
  g.p(25.5, 21.5 + h, "tan");
  // narrowed yellow eyes under a dark brow
  for (const x of [21.5, 25]) {
    g.rect(x, 17.5 + h, 2, 1, "amber");
    g.p(x + (x > 23 ? 1 : 0), 17.5 + h, "ink");
    g.rect(x - 0.5, 16.5 + h, 2.5, 1, "dbrown");
  }
  lit(g);
  // the black nose and tail tip go on after the rim, which would light their edges grey
  g.rect(29.5, 19.5 + h, 1, 1, "ink");
  g.cel(1.8, 22.8 + b, 1.2, 1.1, "ink");
  return g;
}

// ---------- the warning cue (UI, ink outlined) ----------

// A yellow warning triangle with a bold "!", built row by row; big is the pulse frame, 1px larger
// all round.
function warning(big: boolean): Drawable {
  const g = edged(scope.Grid(16, 16), "ink");
  const [top, bottom, slope] = big ? [2, 14, 0.55] : [3, 13, 0.5];
  for (let y = top; y <= bottom; y++) {
    const hw = Math.trunc(1 + (y - top) * slope);
    g.rect(8 - hw, y, 2 * hw, 1, y === bottom ? "amber" : "yellow");
  }
  g.rect(7, 5, 2, 5, "ink");
  g.rect(7, 11, 2, 2, "ink");
  return g;
}

// A yellow arrow pointing right, down when down is true or up when up is; shift nudges it along its
// direction on the pulse frame. The down arrow is the right one transposed, so its shading lands on
// the right, and the up arrow is the down one flipped.
function warningArrow(shift: number, down = false, up = false): Drawable {
  const g = edged(scope.Grid(16, 16), "ink");
  const px = raster(g);
  const s = shift;
  g.rect(1 + s, 6, 6, 4, "yellow");
  g.tri([6.5 + s, 1.5], [6.5 + s, 14.5], [13.5 + s, 8], "yellow");
  g.rect(1 + s, 9, 6, 1, "amber");
  const yellow = K.yellow!;
  for (let x = 0; x < 16; x++) {
    for (const y of [12, 13]) {
      if (px.px[y]![x] === yellow && !(y + 1 < 16 && px.px[y + 1]![x])) {
        g.p(x, y, "amber");
      }
    }
  }
  if (down || up) {
    px.px = px.px[0]!.map((_, x) => px.px.map((row) => row[x]!));
  }
  if (up) {
    px.px = [...px.px].reverse();
  }
  return g;
}

// The "?": [x, y, w, h] rects on the 16x16 frame, the hook from its top bar round to the stem, then
// the dot.
const QUERY: readonly (readonly [number, number, number, number])[] = [
  [5, 2, 6, 3],
  [4, 3, 2, 3],
  [10, 3, 3, 5],
  [8, 7, 3, 2],
  [7, 8, 3, 3],
  [7, 12, 3, 3],
];

// A bold yellow "?" in the warning cues' style, ink outlined, amber along each part's bottom; lift
// raises it on the pulse frame.
function warningWander(lift: number): Drawable {
  const g = edged(scope.Grid(16, 16), "ink");
  for (const [x, y, w, h] of QUERY) {
    g.rect(x, y - lift, w, h, "yellow");
  }
  for (const [x, y] of [
    [12, 3 - lift],
    [4, 3 - lift],
  ] as const) {
    g.p(x, y, null);
  }
  const yellow = K.yellow!;
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 15; y++) {
      if (g.px[y]![x] === yellow && !g.px[y + 1]![x]) {
        g.p(x, y, "amber");
      }
    }
  }
  return g;
}

// An offset in full-size pixels that moves whole pixels at scale s, at least one if it moves at all.
function snap(v: number, s: number): number {
  return v ? (Math.sign(v) * Math.max(1, Math.floor(Math.abs(v) * s))) / s : 0;
}

// Pose q at depth step s (1 for the full size), drawn on a Mini at SCALE x s, its offset keys snapped
// to whole pixels there.
function small<Q extends object>(
  s: number,
  q: Q,
  offsets: readonly string[],
): Q & { new: GridMaker } {
  const p = SCALE * s;
  const fit = (v: unknown): unknown =>
    Array.isArray(v) ? v.map((x: number) => snap(x, p)) : snap(v as number, p);
  const out = Object.fromEntries(
    Object.entries(q).map(([k, v]) => [k, offsets.includes(k) ? fit(v) : v]),
  ) as Q;
  return { ...out, new: (w = 32, h = 32) => new Mini(p, w, h) };
}

// the squirrel's tail sway is left unsnapped
const SQUIRREL_OFFSETS: readonly string[] = ["dy"];
const CORGI_OFFSETS: readonly string[] = ["bob", "leash"];

// [key + suffix, tags] for the road hazards at depth step s; depths.ts draws the steps between
// SCALES with this too.
export function* steps(suffix: string, s: number): Generator<Sprite> {
  const tagged = <Q extends object>(
    draw: (q: Q & { new: GridMaker }) => Drawable,
    offsets: readonly string[],
    tags: readonly (readonly [string, readonly Q[], number])[],
  ): Tag[] =>
    tags.map(([tag, poses, ms]) => [
      tag,
      poses.map((q) => draw(small(s, q, offsets)).outlined()),
      ms,
    ]);

  yield [
    `squirrel-dash${suffix}`,
    tagged(squirrelDash, SQUIRREL_OFFSETS, [
      ["idle", SQUIRREL_IDLE, 400],
      ["run", SQUIRREL_RUN, 80],
    ]),
  ];
  yield [
    `loose-dog${suffix}`,
    tagged(corgiSide, CORGI_OFFSETS, [
      ["idle", CORGI_IDLE, 400],
      ["run", CORGI_RUN, 100],
    ]),
  ];
  yield [
    `ball-bounce${suffix}`,
    [
      ["idle", [0, 1].map((r) => ballBounce(0, s, true, r)), 400],
      ["bounce", range(0, 6).map((f) => ballBounce(f, s)), 70],
    ],
  ];
  yield [`cyclist${suffix}`, [["ride", CYCLIST_RIDE.map((q) => cyclistAt(s, q).outlined()), 90]]];
  yield [
    `coyote${suffix}`,
    tagged(coyote, COYOTE_OFFSETS, [
      ["idle", COYOTE_IDLE, 400],
      ["walk", COYOTE_WALK, 120],
      ["step", COYOTE_STEP, 80],
    ]),
  ];
}

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  yield* steps("", 1);
  yield ["ui-warning", [["pulse", [warning(false).outlined(), warning(true).outlined()], 250]]];
  yield [
    "ui-warning-arrow",
    [
      ["pulse", [warningArrow(0).outlined(), warningArrow(1).outlined()], 250],
      ["down-pulse", [warningArrow(0, true).outlined(), warningArrow(1, true).outlined()], 250],
      [
        "up-pulse",
        [warningArrow(0, false, true).outlined(), warningArrow(1, false, true).outlined()],
        250,
      ],
    ],
  ];
  yield [
    "ui-warning-wander",
    [["pulse", [warningWander(0).outlined(), warningWander(1).outlined()], 250]],
  ];
  for (const [suffix, s] of SCALES) {
    yield* steps(`@${suffix}`, s);
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
