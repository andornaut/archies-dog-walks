// Road animal drawings and their idle and movement poses.

import { type Drawable, edged } from "../pixel.ts";
import { LIT, rim, scope, SQUIRREL_FUR } from "./primitives.ts";

// ---------- encounters (facing the player) ----------

interface SkunkPose {
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

// The squirrel's bushy tail, standing ry above and below (x, y): a narrower stem rising from behind
// the body into a plume rx wide at the top, its tip flicked out, with a lighter streak down its core,
// so it reads apart from the darker body in front of it. sway moves the plume sideways and leaves the
// stem on the body.
function squirrelTail(g: Drawable, x: number, y: number, rx: number, ry: number, sway = 0): void {
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

// One frame of the squirrel's bound: [body y, head y, tail [x, y, rx, ry], front paws [left x, right
// x, y, height]].
type SquirrelBound = readonly [
  body: number,
  head: number,
  tail: readonly [number, number, number, number],
  paws: readonly [number, number, number, number],
];

// The squirrel's bound, landing first. The head's y stays sitting's plus whole steps of 2px (4/3), so
// its eyes raster alike every frame. It lands stretched low and wide with its tail streaming up
// behind, crouches to push off with its tail swinging over, flies gathered 2px higher with its paws
// tucked under its chin and its tail arched, then reaches down for the next landing.
const SQUIRREL_BOUND: readonly SquirrelBound[] = [
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

interface CorgiPose {
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
