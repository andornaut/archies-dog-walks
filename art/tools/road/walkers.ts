// Walker drawings and their walk, reaction and celebration poses.

import { type Drawable, K, type Point, raster, scaleOf } from "../pixel.ts";
import {
  faceDisc,
  frontEyes,
  type FrontPose,
  glasses,
  HUMAN_WALK,
  humanLegs,
  limbBar,
  nose,
  painters,
  type RaisedArm,
  raiseMouth,
  rim,
  type Rims,
  scope,
  walkerArms,
  type WalkerPose,
} from "./primitives.ts";

// Casey's cap and ponytail above a shaped hoodie, with bent elbows and recovery knees. The head rides
// the hoodie: it bobs and sways with the shoulders, so the neck keeps its length and stays centred on
// the collar.
function caseyBack({
  arms = 0,
  bob = 0,
  flare = 0,
  lf = 0,
  reach = 0,
  rf = 0,
  sway = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  const s = sway;
  humanLegs(g, lf, rf, b, "blue", "navy", "white");
  for (const side of [-1, 1]) {
    const shoulder: Point = [16 + side * 7 + s, 23 + b];
    const elbow: Point = [16 + side * (8 + flare / 2), 28 + b + (arms * side) / 2];
    const hand: Point = [16 + side * (9 + flare), 33.5 - Math.max(0, arms * side) - reach];
    limbBar(g, shoulder, elbow, 4, side < 0 ? "sky" : "blue");
    limbBar(g, elbow, [hand[0], hand[1] - 1.3], 3.5, "sky");
    g.rect(hand[0] - 1.5, hand[1] - 1, 3, 2.5, "skin1");
  }
  g.tri([9 + s, 22 + b], [23 + s, 22 + b], [21 + s, 34 + b], "sky");
  g.tri([9 + s, 22 + b], [21 + s, 34 + b], [11 + s, 34 + b], "sky");
  g.rect(10 + s, 25 + b, 12, 8, "sky");
  g.rect(20 + s, 24 + b, 2, 9, "blue");
  g.rect(10 + s, 25 + b, 1, 7, "cyan");
  g.rect(11 + s, 33 + b, 10, 1, "blue");
  g.ell(16 + s, 22.5 + b, 6, 2.5, "blue", "navy");
  const hx = 16 + s;
  g.rect(hx - 2, 19 + b, 4, 3, "skin1");
  g.cel(hx, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown");
  g.rect(hx - 9, 13 + b, 2, 3, "skin1");
  g.rect(hx + 7, 13 + b, 2, 3, "skin1");
  g.cel(hx, 8 + b, 8.5, 5, "amber", "orange", "yellow");
  g.rect(hx - 8, 10 + b, 17, 2, "orange");
  g.rect(hx - 1, 10 + b, 2, 2, "dbrown");
  g.ell(hx, 17 + b, 2.5, 4, "dbrown", "plum");
  return g;
}

// ---------- the other walkers (back view) ----------

// Ada, 11, mixed race, caramel skin, long black curls falling straight down: yellow tee, blue shorts.
// She stands 4px shorter than the adults: her head and body sit lower and her legs are shorter. Her
// shorts, tee, arms and hair sway together, so the hidden neck stays joined to the shoulders.
function adaBack({
  arms = 0,
  bob = 0,
  flare = 0,
  lf = 0,
  reach = 0,
  rf = 0,
  sway = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  const s = sway;
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
    s,
  );
  g.rect(10 + s, 29 + b, 12, 8, "yellow");
  g.rect(19 + s, 29 + b, 3, 8, "amber");
  g.rect(10 + s, 36 + b, 12, 4, "sky");
  g.rect(19 + s, 36 + b, 3, 4, "blue");
  g.rect(15 + s, 36 + b, 2, 4, "blue");
  g.rect(7 + s, 20 + b, 2, 3, "brown");
  g.rect(23 + s, 20 + b, 2, 3, "brown");
  // black hair: a rounded crown, then long curls hanging straight down the back, bunched into bumps
  // of uneven size along the sides and the hem
  g.ell(16 + s, 18.5 + b, 8, 7.5, "navy", "ink", "dslate");
  g.rect(9 + s, 20 + b, 14, 10, "navy");
  g.rect(21 + s, 20 + b, 2, 10, "ink");
  for (const [x, y, rx, ry] of [
    [8.7, 20.5, 1.4, 1.5],
    [8.4, 24.2, 1.8, 2.1],
    [8.8, 28.6, 1.4, 1.3],
  ] as const) {
    g.ell(x + s, y + b, rx, ry, "navy");
  }
  for (const [x, y, rx, ry] of [
    [23.3, 22, 1.6, 1.9],
    [23.2, 26.6, 1.3, 1.4],
    [23.4, 29.3, 1.6, 1.5],
  ] as const) {
    g.ell(x + s, y + b, rx, ry, "ink");
  }
  for (const [x, y, rx, ry] of [
    [10.2, 30.6, 1.6, 1.4],
    [13.4, 31, 2, 1.6],
    [16.6, 30.4, 1.3, 1.3],
    [19.4, 30.8, 1.9, 1.5],
    [21.9, 30.2, 1.2, 1.2],
  ] as const) {
    g.ell(x + s, y + b, rx, ry, x < 20 ? "navy" : "ink");
  }
  // the curls as a few unbroken wavy locks down the back, dslate on the lit side and navy in the
  // shade, so the hair holds one mass at road scale with no single-pixel texture
  for (const [x0, y0, length, c] of CURL_LOCKS) {
    for (const [k, n] of curlRuns(length)) {
      g.rect(x0 + CURL_WAVE[k % CURL_WAVE.length]! + s, y0 + k + b, 1, n, c);
    }
  }
  g.ell(16 + s, 12 + b, 2.5, 1.5, "pink", "mauve");
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
function mrBBack({
  arms = 0,
  bob = 0,
  flare = 0,
  lf = 0,
  reach = 0,
  rf = 0,
  sway = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  const s = sway;
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
    s,
  );
  // the lilac tee, shaded dgreen down its right side
  g.rect(9 + s, 21 + b, 14, 13, "lilac");
  g.rect(20 + s, 21 + b, 3, 13, "violet");
  g.p(9 + s, 21 + b, null);
  g.p(22 + s, 21 + b, null);
  g.rect(13 + s, 19 + b, 6, 3, "dbrown");
  // bald head, the beard showing along the jaw, a shine on the crown
  g.rect(8 + s, 12 + b, 2, 3, "dbrown");
  g.rect(22 + s, 12 + b, 2, 3, "plum");
  g.cel(16 + s, 12 + b, 7, 9, "dbrown", "plum", null, 2.15);
  g.rect(11 + s, 7 + b, 3, 1, "brown");
  g.p(11 + s, 8 + b, "brown");
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
function tristaBack({
  arms = 0,
  bob = 0,
  flare = 0,
  lf = 0,
  reach = 0,
  rf = 0,
  sway = 0,
}: WalkerPose = {}): Drawable {
  const g = scope.Grid(32, 48);
  const b = bob;
  const s = sway;
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
    s,
  );
  g.rect(9 + s, 21 + b, 14, 11, "dgreen");
  g.rect(20 + s, 21 + b, 3, 11, "forest");
  g.rect(9 + s, 21 + b, 1, 10, "green");
  g.p(9 + s, 21 + b, null);
  g.p(22 + s, 21 + b, null);
  g.rect(9 + s, 31 + b, 14, 7, "clay");
  g.rect(20 + s, 31 + b, 3, 7, "bark");
  g.rect(9 + s, 31 + b, 14, 1, "tan");
  // a canvas tote with an apple on it: it sways left with her, and against the frame's right edge it
  // stays put as she sways right, resting on her hip
  const t = Math.min(s, 0);
  g.rect(25 + t, 24 + b, 5, 1, "brown");
  g.rect(24 + t, 25 + b, 7, 8, "cream");
  g.rect(29 + t, 25 + b, 2, 8, "tan");
  g.rect(26 + t, 27 + b, 3, 3, "red");
  g.p(27 + t, 26 + b, "dgreen");
  // a dirty blonde bob to the shoulders, flicking out at the ends: light brown, darker than her
  // skin, with golden amber streaks where the light catches it
  g.cel(16 + s, 12.5 + b, 9, 9, "brown", "dbrown", "tan");
  g.rect(8 + s, 14 + b, 17, 5, "brown");
  g.rect(22 + s, 14 + b, 3, 5, "dbrown");
  g.ell(16 + s, 19 + b, 9, 2.5, "brown", "dbrown");
  g.p(7 + s, 20 + b, "brown");
  g.p(25 + s, 20 + b, "dbrown");
  for (const [x, y, h] of [
    [10, 9, 5],
    [13, 6, 4],
    [16, 8, 6],
    [19, 6, 3],
  ] as const) {
    g.rect(x + s, y + b, 1, h, "amber");
  }
  g.rect(14 + s, 11 + b, 1, 4, "dbrown");
  g.rect(20 + s, 11 + b, 1, 4, "dbrown");
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
const CURL_LOCKS: readonly (readonly [number, number, number, string])[] = [
  [11, 20, 10, "dslate"],
  [15, 19, 10, "dslate"],
  [19, 21, 8, "ink"],
];

const CURL_WAVE: readonly number[] = [0, 0, 1, 1, 0, 0, -1, -1];

// [first row, rows] of each straight run of a lock length rows long: a run is one 1px-wide rect, so
// drawn bigger the lock stays unbroken.
function curlRuns(length: number): [number, number][] {
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

type WalkerDraw = (pose?: WalkerPose) => Drawable;

export const WALKERS: readonly (readonly [string, WalkerDraw])[] = [
  ["walker-casey", caseyBack],
  ["walker-ada", adaBack],
  ["walker-mr-b", mrBBack],
  ["walker-trista", tristaBack],
];

// The walkers' upper body (head, neck, torso and arms) sways as one a beat after the hips settle over
// the planted foot, so the head never slides on the shoulders. The neutral first pose keeps the
// pack's visibility stable. A 2/3 design-pixel movement is one native export pixel.
const WALKER_SWAY: readonly number[] = [0, -2 / 3, -2 / 3, 0, 2 / 3, 2 / 3, 0, 0];

export const WALKER_WALK: readonly WalkerPose[] = HUMAN_WALK.map((pose, i) => ({
  ...pose,
  sway: WALKER_SWAY[i]!,
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

// Casey facing the camera: the amber cap's orange brim over the eyes, sky hoodie with a blue kangaroo
// pocket and white drawstrings, jeans, white sneakers.
function caseyFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
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
function adaFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
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
function mrBFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
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
function tristaFront({ bob = 0, wave = 0 }: FrontPose = {}): Drawable {
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

type FrontDraw = (pose?: FrontPose) => Drawable;

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
const CHEER_ARMS: ReadonlyMap<
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
