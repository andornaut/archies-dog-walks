// Neighbourhood pedestrians, walking groups and the cart shopper.

import { type Drawable, edged, type Point, raster, scaleOf } from "../pixel.ts";
import {
  type ArmPart,
  backArm,
  BREATH,
  faceDisc,
  HUMAN_WALK,
  humanLegs,
  LIT,
  person,
  type PersonOptions,
  raisedArm,
  rim,
  type Rims,
  SCALE,
  scope as roadScope,
  stair,
  swung,
  type WalkerPose,
} from "../road.ts";
import { frontLegs, limb, range, scope, stride } from "./primitives.ts";

// ---------- tourist: facing the player, a stepper like the mail carrier ----------

// The tourist's top for road.ts's person: shorts over the bare legs, the holiday shirt, the backpack,
// the camera, the map and the sun hat. The map hand (screen left) stays; the free arm (screen right)
// swings.
function touristTop(g: Drawable, b: number, arms = 0): void {
  // shorts over the bare legs, each leg its own short leg
  g.rect(10, 33 + b, 12, 3, "driftwood");
  for (const x of [10, 17]) {
    g.rect(x, 36 + b, 5, 2, "driftwood");
    g.rect(x + 4, 33 + b, 1, 5, "stone");
  }
  // the free arm (screen right): a short sleeve, then the bare forearm swinging
  const n = swung(arms, 1);
  g.rect(23, 22 + b, 4, 4, "turquoise");
  g.rect(26, 22 + b, 1, 4, "dturq");
  g.rect(23, 26 + b, 4, 7 - n, "skin1");
  g.rect(26, 26 + b, 1, 7 - n, "skin2");
  // the map arm (screen left), hanging to the hip
  g.rect(5, 22 + b, 4, 4, "turquoise");
  g.rect(8, 22 + b, 1, 4, "dturq");
  g.rect(5, 26 + b, 4, 4, "skin1");
  g.rect(8, 26 + b, 1, 4, "skin2");
  // the shirt, lit down its left side, a few flat hibiscus flowers, the open collar
  g.rect(9, 21 + b, 14, 12, "turquoise");
  g.rect(20, 21 + b, 3, 12, "dturq");
  g.rect(9, 22 + b, 1, 10, "foam");
  for (const [x, y] of [
    [11, 30],
    [19, 30],
    [6, 23],
  ] as const) {
    g.rect(x, y + b, 2, 2, "pink");
  }
  g.rect(14, 21 + b, 4, 1, "white");
  g.rect(15, 22 + b, 2, 1, "white");
  // the backpack's straps down the chest, over the shoulders from the pack behind
  for (const x of [10, 20]) {
    g.rect(x, 21 + b, 2, 9, "rust");
    g.rect(x, 28 + b, 2, 1, "dbrown");
  }
  // the camera on its strap: a black body with a silver top plate and a lens
  g.rect(13, 21 + b, 1, 4, "ink");
  g.rect(18, 21 + b, 1, 4, "ink");
  g.rect(12, 25 + b, 8, 5, "ink");
  g.rect(12, 25 + b, 8, 1, "lgrey");
  g.rect(13, 24 + b, 2, 1, "lgrey");
  g.rect(15, 26 + b, 3, 3, "grey");
  g.p(16, 27 + b, "ink");
  g.p(15, 26 + b, "white");
  // the open map held at the hip, the hand on its top corner: cream paper folded in four, a green
  // park
  g.rect(0.5, 30 + b, 8, 7, "cream");
  g.rect(4.5, 30 + b, 1, 7, "tan");
  g.rect(0.5, 33 + b, 8, 1, "tan");
  g.rect(1.5, 31 + b, 2, 2, "green");
  g.rect(5, 29 + b, 4, 3, "skin1");
  g.rect(8, 29 + b, 1, 3, "skin2");
  // head: the face, brown hair at the sides, the straw sun hat with a red band and a wide brim
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.rect(8, 10 + b, 2, 5, "brown");
  g.rect(22, 10 + b, 2, 5, "brown");
  g.cel(16, 6.5 + b, 6.5, 4.5, "cream", "tan", "white");
  g.rect(9.5, 8 + b, 13, 1.5, "red");
  g.rect(4, 9.5 + b, 24, 2, "cream");
  g.rect(4, 11 + b, 24, 1, "tan");
  roadScope.faceFront(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
}

const TOURIST = { legs: "skin1", shoes: "brown" } as const;

const TOURIST_RIM: Rims = { ...LIT, dturq: ["turquoise", null] };

// The tourist facing the player, with the road outline and the lit rim.
export function tourist(q: PersonOptions = {}): Drawable {
  return rim(edged(person(touristTop, { grounded: true, ...TOURIST, ...q })), TOURIST_RIM);
}

// ---------- couple: arm in arm, facing the player, two lanes ----------

// The couple's design grid: 112 px wide at SCALE, 48 rows.
const COUPLE_W = 112 / SCALE;

// The left edge of each person's 32-column cell: the man's, then the woman's, their bodies 10
// columns apart.
const MAN = COUPLE_W / 2 - 27;

const WOMAN = COUPLE_W / 2 - 3;

export const COUPLE_WALK = HUMAN_WALK;

export const COUPLE_WALK_MS = 80;

// The couple facing the player, strolling arm in arm, in step.
export function couple({ arms = 0, bob = 0, lf = 0, rf = 0 }: WalkerPose = {}): Drawable {
  const g = edged(scope.Grid(COUPLE_W, 48));
  const b = bob;
  const m = MAN;
  const w = WOMAN;
  // legs: his grey trousers and brown shoes, her bare legs under the dress and pink flats
  frontLegs(g, m, b, lf, rf, ["grey", "slate"], "brown");
  frontLegs(g, w, b, lf, rf, ["skin1", "skin2"], "pink", 38);
  // her long copper hair, falling behind her shoulders
  g.rect(w + 8, 10 + b, 16, 13, "ochre");
  g.rect(w + 20, 10 + b, 4, 13, "rust");
  // his outer arm (screen left) swings, carrying the kraft shopping bag
  let n = swung(arms, -1);
  backArm(
    g,
    m + 5,
    4,
    22 + b,
    [
      [9, "red", "dred"],
      [3, "skin1", null],
    ],
    { lift: n },
  );
  g.rect(m + 3, 33 + b - n, 7, 7, "tan");
  g.rect(m + 8, 33 + b - n, 2, 7, "brown");
  g.rect(m + 3, 33 + b - n, 7, 1, "cream");
  g.rect(m + 5, 31 + b - n, 1, 2, "dbrown");
  g.rect(m + 7, 31 + b - n, 1, 2, "dbrown");
  // her outer arm (screen right) swings against his
  n = swung(arms, 1);
  backArm(
    g,
    w + 23,
    3,
    22 + b,
    [
      [3, "lilac", "violet"],
      [9, "skin1", "skin2"],
    ],
    { lift: n },
  );
  // the red sweater, lit down its left side, a crew neck and a ribbed hem
  g.rect(m + 9, 21 + b, 14, 13, "red");
  g.rect(m + 20, 21 + b, 3, 13, "dred");
  g.rect(m + 9, 21 + b, 1, 12, "pink");
  g.rect(m + 13, 21 + b, 6, 1, "dred");
  g.rect(m + 9, 32 + b, 14, 2, "dred");
  g.p(m + 9, 21 + b, null);
  g.p(m + 22, 21 + b, null);
  // her lilac dress: the bodice, then a skirt flaring to the knee
  g.rect(w + 10, 21 + b, 12, 9, "lilac");
  g.rect(w + 19, 21 + b, 3, 9, "violet");
  g.tri([w + 10, 29 + b], [w + 22, 29 + b], [w + 16, 21 + b], "lilac");
  g.rect(w + 8, 29 + b, 16, 9, "lilac");
  g.rect(w + 7, 33 + b, 18, 5, "lilac");
  g.rect(w + 20, 29 + b, 4, 9, "violet");
  g.rect(w + 21, 33 + b, 4, 5, "violet");
  g.rect(w + 8, 30 + b, 1, 3, "white");
  g.rect(w + 14, 21 + b, 4, 1, "skin1");
  // the mauve shoulder bag, its strap across her from her right shoulder (screen left) to her left
  // hip
  stair(g, w + 11, 21 + b, w + 21, 30 + b, "purple");
  g.rect(w + 20, 29 + b, 5, 4, "mauve");
  g.rect(w + 20, 29 + b, 5, 1, "pink");
  g.rect(w + 24, 30 + b, 1, 3, "purple");
  // the inner arms hooked together between them: his sleeve bends down and in, hers tucks through
  // his
  for (let k = 0; k < 4; k++) {
    g.rect(m + 22 + k, 22 + b + k * 1.5, 3, 3, "red");
  }
  g.rect(m + 24, 27 + b, 2, 3, "dred");
  for (let k = 0; k < 4; k++) {
    g.rect(w + 7 - k, 22 + b + k * 1.5, 3, 3, "lilac");
  }
  g.rect(w + 4, 26 + b, 2, 1, "violet");
  g.rect(m + 26, 27 + b, 5, 3, "skin1");
  g.rect(m + 26, 29 + b, 5, 1, "skin2");
  g.rect(m + 25, 27 + b, 2, 2, "red");
  // his face under short dark brown hair
  faceDisc(g, m + 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.cel(m + 16, 7.5 + b, 8.5, 4, "dbrown", "plum", "brown");
  g.rect(m + 8, 8 + b, 2, 4, "dbrown");
  g.rect(m + 22, 8 + b, 2, 4, "dbrown");
  roadScope.faceFront(g, m + 16, 13 + b);
  // her face framed by the copper hair, a fringe over the brow
  faceDisc(g, w + 16, 13 + b, 7.5, 7.5, "skin1", "skin2");
  g.cel(w + 16, 8 + b, 8.5, 4.5, "ochre", "rust", "tan");
  g.rect(w + 8, 9 + b, 2, 13, "ochre");
  g.rect(w + 22, 9 + b, 2, 13, "rust");
  roadScope.faceFront(g, w + 16, 13.5 + b, { lips: "dred" });
  g.p(w + 10, 16.5 + b, "pink");
  g.p(w + 22, 16.5 + b, "pink");
  return rim(g, { ...LIT, slate: ["grey", null], violet: ["lilac", null] });
}

// ---------- tour-group: a guide with a flag and two tourists, facing the player, two lanes ----------

// The tour group's design grid: 112 px wide at SCALE, 48 rows, as the couple's. The left edge of each
// person's 32-column cell: the guide in front, the tourists behind (their feet BEHIND rows higher)
// and beside.
const TOUR_W = 112 / SCALE;

const GUIDE = TOUR_W / 2 - 20;

const TOUR_LEFT = GUIDE - 16;

const TOUR_RIGHT = GUIDE + 24;

const BEHIND = -2;

// A tour-group pose: the guide's (g), the left tourist's (l) and the right tourist's (r) feet, bob
// and arm swing, and the flag's dip.
export interface TourPose {
  dip?: number;
  garms?: number;
  gbob?: number;
  glf?: number;
  grf?: number;
  larms?: number;
  lbob?: number;
  llf?: number;
  lrf?: number;
  rarms?: number;
  rbob?: number;
  rlf?: number;
  rrf?: number;
}

// Walk frame frame for the group: the guide on COUPLE_WALK's frame, each tourist lag frames behind,
// so the group shuffles out of step.
function tourPoses(frame: number, lag = 4): TourPose {
  const walk = COUPLE_WALK;
  const out: Record<string, number> = {};
  for (const [who, k] of [
    ["g", 0],
    ["l", lag],
    ["r", lag],
  ] as const) {
    const q = walk[(((frame - k) % walk.length) + walk.length) % walk.length]!;
    for (const n of ["lf", "rf", "bob", "arms"] as const) {
      out[`${who}${n}`] = q[n] ?? 0;
    }
  }
  return out;
}

export const TOUR_WALK: readonly TourPose[] = range(0, COUPLE_WALK.length).map((f) => tourPoses(f));

export const TOUR_WALK_MS = COUPLE_WALK_MS;

// The flag dipping before a step: half down, all the way, half down; 3 frames at 200ms, the mover's
// cue.
export const TOUR_CUE: readonly TourPose[] = [{ dip: 2 }, { dip: 5 }, { dip: 2 }];

export const TOUR_CUE_MS = 200;

const TOUR_RIM: Rims = {
  ...LIT,
  cobalt: ["azure", null],
  dstone: ["stone", null],
  orange: ["peach", null],
};

// The tourist behind the guide's right (screen left): a wide pink sun hat with a white band over long
// dark brown hair, a peach tee, denim shorts and white trainers, a compact camera on a wrist strap in
// the swinging outer hand.
function tourLeft(g: Drawable, x: number, b: number, lf: number, rf: number, arms: number): void {
  const y = b + BEHIND;
  for (const hx of [7, 22]) {
    g.rect(x + hx, 10 + y, 3, 12, "dbrown");
  }
  frontLegs(g, x, y, lf + BEHIND, rf + BEHIND, ["skin1", "skin2"], "white");
  g.rect(x + 10, 33 + y, 12, 3, "blue");
  g.rect(x + 19, 33 + y, 3, 3, "navy");
  const n = swung(arms, -1);
  backArm(
    g,
    x + 5,
    4,
    22 + y,
    [
      [3, "peach", "orange"],
      [8, "skin1", "skin2"],
    ],
    { lift: n },
  );
  g.rect(x + 3, 31 + y - n, 5, 4, "ink");
  g.rect(x + 4, 32 + y - n, 2, 2, "grey");
  g.p(x + 4, 32 + y - n, "white");
  g.rect(x + 6, 29 + y - n, 1, 2, "ink");
  g.rect(x + 9, 21 + y, 14, 12, "peach");
  g.rect(x + 20, 21 + y, 3, 12, "orange");
  g.rect(x + 9, 22 + y, 1, 10, "cream");
  g.rect(x + 14, 21 + y, 4, 1, "skin1");
  faceDisc(g, x + 16, 12.5 + y, 8, 8, "skin1", "skin2");
  g.cel(x + 16, 6.5 + y, 6.5, 4.5, "pink", "mauve", "white");
  g.rect(x + 9.5, 8 + y, 13, 1.5, "white");
  g.rect(x + 3, 9.5 + y, 26, 2, "pink");
  g.rect(x + 3, 11 + y, 26, 1, "mauve");
  roadScope.faceFront(g, x + 16, 14 + y, { lips: "dred" });
}

// The tourist behind the guide's left (screen right): a white bucket hat, sunglasses, an azure tee,
// tan shorts and sandals, a big black camera on a neck strap, its lens to the player.
function tourRight(g: Drawable, x: number, b: number, lf: number, rf: number, arms: number): void {
  const y = b + BEHIND;
  frontLegs(g, x, y, lf + BEHIND, rf + BEHIND, ["skin1", "skin2"], "dbrown");
  g.rect(x + 10, 33 + y, 12, 4, "tan");
  g.rect(x + 19, 33 + y, 3, 4, "brown");
  const n = swung(arms, 1);
  const sleeve: readonly ArmPart[] = [
    [3, "azure", "cobalt"],
    [8, "skin1", "skin2"],
  ];
  backArm(g, x + 23, 4, 22 + y, sleeve, { lift: n });
  backArm(g, x + 5, 4, 22 + y, sleeve);
  g.rect(x + 9, 21 + y, 14, 12, "azure");
  g.rect(x + 20, 21 + y, 3, 12, "cobalt");
  g.rect(x + 9, 22 + y, 1, 10, "sky");
  g.rect(x + 14, 21 + y, 4, 1, "skin1");
  // the camera on its strap: a black body, a grey hump on top and a big lens
  g.rect(x + 12, 21 + y, 1, 4, "ink");
  g.rect(x + 19, 21 + y, 1, 4, "ink");
  g.rect(x + 11, 25 + y, 10, 6, "ink");
  g.rect(x + 14, 24 + y, 4, 1, "slate");
  g.cel(x + 16, 28 + y, 2.6, 2.6, "grey", "slate");
  g.rect(x + 15.5, 27.5 + y, 1, 1, "ink");
  g.p(x + 15, 27 + y, "white");
  faceDisc(g, x + 16, 12.5 + y, 8, 8, "skin1", "skin2");
  g.rect(x + 8, 9 + y, 2, 5, "brown");
  g.rect(x + 22, 9 + y, 2, 5, "brown");
  roadScope.faceFront(g, x + 16, 13 + y);
  g.rect(x + 10, 13 + y, 12, 2, "ink");
  g.p(x + 11, 13 + y, "lgrey");
  g.p(x + 17, 13 + y, "lgrey");
  g.rect(x + 10, 4 + y, 12, 6, "white");
  g.rect(x + 19, 4 + y, 3, 6, "lgrey");
  g.rect(x + 7, 9 + y, 18, 2, "white");
  g.rect(x + 7, 10 + y, 18, 1, "lgrey");
  g.p(x + 10, 4 + y, null);
  g.p(x + 21, 4 + y, null);
}

// The guide in front: a green tee and cap with the yellow flag logo, a red lanyard to a white badge,
// stone shorts, the left arm (screen right) up holding a closed red umbrella with a yellow pennant
// tied at its tip. dip lowers the tip that many rows, the umbrella seen tipping toward the player,
// the pennant hanging lower as it comes down.
function tourGuide(
  g: Drawable,
  x: number,
  b: number,
  lf: number,
  rf: number,
  arms: number,
  dip: number,
): void {
  frontLegs(g, x, b, lf, rf, ["skin2", "brown"], "ink");
  g.rect(x + 10, 33 + b, 12, 4, "stone");
  g.rect(x + 19, 33 + b, 3, 4, "dstone");
  const n = swung(arms, -1);
  backArm(
    g,
    x + 5,
    4,
    22 + b,
    [
      [4, "green", "dgreen"],
      [7, "skin2", "brown"],
    ],
    { lift: n },
  );
  raisedArm(g, x + 23, 4, 8 + b, 25 + b, 3, [
    [3, "skin2", "brown"],
    [7, "skin2", "brown"],
    [4, "green", "dgreen"],
  ]);
  // the tee, lit down its left side, the flag logo on the chest, the lanyard and its badge
  g.rect(x + 9, 21 + b, 14, 12, "green");
  g.rect(x + 20, 21 + b, 3, 12, "dgreen");
  g.rect(x + 9, 22 + b, 1, 10, "lime");
  g.rect(x + 14, 21 + b, 4, 1, "skin2");
  g.rect(x + 13, 21 + b, 1, 5, "red");
  g.rect(x + 18, 21 + b, 1, 5, "red");
  g.rect(x + 13, 26 + b, 6, 4, "white");
  g.rect(x + 13, 26 + b, 6, 1, "red");
  g.rect(x + 14, 28 + b, 4, 1, "lgrey");
  g.rect(x + 19, 23 + b, 1, 3, "dgreen");
  g.rect(x + 20, 23 + b, 2, 2, "yellow");
  // head: the face, short dark hair at the sides, the green cap with its yellow logo and brim
  faceDisc(g, x + 16, 12.5 + b, 8, 8, "skin2", "brown");
  g.rect(x + 8, 9 + b, 2, 4, "dbrown");
  g.rect(x + 22, 9 + b, 2, 4, "dbrown");
  g.cel(x + 16, 7 + b, 8.5, 3.5, "green", "dgreen", "lime");
  g.rect(x + 8, 9 + b, 17, 2, "dgreen");
  g.rect(x + 15, 5 + b, 2, 2, "yellow");
  roadScope.faceFront(g, x + 16, 13 + b, { lips: "plum" });
  // the closed umbrella in the raised fist: the rolled red canopy, narrowing to the grey tip
  const px = x + 27;
  const tip = dip + b;
  g.rect(px - 1, tip + 3, 3, 8 + b - tip - 3, "red");
  g.rect(px + 1, tip + 3, 1, 8 + b - tip - 3, "dred");
  g.rect(px, tip + 2, 1, 1, "red");
  g.rect(px, tip, 1, 2, "lgrey");
  g.rect(px - 1, 8 + b, 4, 3, "skin2");
  g.rect(px + 2, 8 + b, 1, 3, "brown");
  // the pennant tied under the tip: flying out to screen right, then angled down, then hanging along
  // the canopy
  const t = tip;
  if (dip >= 3) {
    g.rect(px + 2, t, 3, 5, "yellow");
    g.tri([px + 2, t + 5], [px + 5, t + 5], [px + 3.5, t + 8], "yellow");
    g.rect(px + 4, t, 1, 6, "amber");
  } else if (dip > 0) {
    g.tri([px + 2, t], [px + 2, t + 6], [px + 7, t + 7], "yellow");
    g.rect(px + 2, t + 5, 3, 1, "amber");
  } else {
    g.tri([px + 2, t], [px + 2, t + 6], [px + 10, t + 3], "yellow");
    g.rect(px + 2, t + 5, 3, 1, "amber");
  }
}

// The tour group facing the player: the tourists behind, then the guide in front, with the road
// outline and the lit rim.
export function tourGroup({
  dip = 0,
  garms = 0,
  gbob = 0,
  glf = 0,
  grf = 0,
  larms = 0,
  lbob = 0,
  llf = 0,
  lrf = 0,
  rarms = 0,
  rbob = 0,
  rlf = 0,
  rrf = 0,
}: TourPose = {}): Drawable {
  const g = edged(scope.Grid(TOUR_W, 48));
  tourLeft(g, TOUR_LEFT, lbob, llf, lrf, larms);
  tourRight(g, TOUR_RIGHT, rbob, rlf, rrf, rarms);
  tourGuide(g, GUIDE, gbob, glf, grf, garms, dip);
  return rim(g, TOUR_RIM);
}

// ---------- granny-cart-shopper: facing the player, pulling a tartan shopping cart ----------

// A granny-cart-shopper pose: the walk's legs and bob, the cart's tip, the tread's phase (a digit
// string, a choice rather than an offset) and the greens' nod.
export interface GrannyPose {
  bob?: number;
  lf?: number;
  nod?: number;
  rf?: number;
  roll?: string;
  tip?: number;
}

// Walking: HUMAN_WALK, as the mail carrier wanders, the cart tipped back onto its wheels and rolling
// beside her, the tread falling down its tires a drawn pixel a frame and the greens nodding on the
// passing frames. Idle: BREATH with the cart stood upright. Cue, before each step: tipping the cart
// back, braced, halfway and over, 3 frames at 150ms.
export const GRANNY_WALK: readonly GrannyPose[] = HUMAN_WALK.map((q, n) => ({
  ...stride(q),
  nod: q.bob ? -q.bob : 0,
  roll: String(Math.floor(n / 2)),
  tip: 1,
}));

export const GRANNY_IDLE: readonly GrannyPose[] = BREATH.map((b) => ({ bob: b }));

export const GRANNY_CUE: readonly GrannyPose[] = [{ bob: 1 }, { bob: 1, tip: 1 }, { tip: 2 }];

export const GRANNY_CUE_MS = 150;

const GRANNY_RIM: Rims = { ...LIT, dgreen: ["green", null], forest: ["green", null] };

// The cart's tartan: red, crossed by dgreen bands (forest where they cross), as [start, width] in
// layout columns from the bag's left edge and rows from its top, and a thin cream line down column
// TARTAN_LINE.
const TARTAN_COLUMNS: readonly (readonly [number, number])[] = [
  [2, 2],
  [6, 1],
];

const TARTAN_ROWS: readonly (readonly [number, number])[] = [
  [2, 2],
  [6, 1],
];

const TARTAN_LINE = 5;

// The bag: its left column, width, top row and bottom row, and the row its frame leans about.
const BAG_X = 22.5;

const BAG_W = 8.5;

const BAG_TOP = 30.5;

const BAG_BOTTOM = 40.5;

const CART_FOOT = 41;

// The wheels' centre columns, edge-on either side of the bag's foot.
const WHEELS: readonly [number, number] = [21.6, 30.4];

// The market shopper facing the player, pulling her tartan shopping cart beside her (screen right)
// with a cloth tote in her other hand. tip leans the cart's top that many layout pixels toward her,
// about its wheels; roll moves the tires' tread down a pixel; nod drops the greens that many rows.
export function grannyCartShopper({
  bob = 0,
  lf = 0,
  nod = 0,
  rf = 0,
  roll = "0",
  tip = 0,
}: GrannyPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const r = Number.parseInt(roll, 10);

  // How far the cart's row y leans toward her: tip at the handle, nothing at the foot.
  const sx = (y: number): number => (tip * (CART_FOOT - y)) / (CART_FOOT - 26);

  // The cart's columns x to x + w from row y0 to y1, leant by sx.
  const quad = (x: number, w: number, y0: number, y1: number, c: string): void => {
    const a: Point = [x - sx(y0), y0];
    const d: Point = [x - sx(y1), y1];
    g.tri(a, [a[0] + w, y0], [d[0] + w, y1], c);
    g.tri(a, [d[0] + w, y1], d, c);
  };

  // the wheels at the bag's foot, black tires edge-on either side, their tread rolling
  for (const cx of WHEELS) {
    g.blob(cx, 41.5, 1.8, 3.5, "ink");
  }
  const px = raster(g);
  const s = scaleOf(g);
  const top = Math.floor(38 * s + 0.5);
  const bottom = Math.floor(45 * s + 0.5);
  for (const cx of WHEELS) {
    const mid = Math.floor(cx * s);
    for (let y = top + 1; y < bottom - 1; y++) {
      if ((y - top - r) % 4 === 0 && px.px[y]![mid]) {
        px.p(mid, y, "slate");
      }
    }
  }
  // the frame behind the bag: two grey uprights up to the handle across their tops
  for (const x of [BAG_X + 0.5, BAG_X + BAG_W - 1.5]) {
    quad(x, 1, 26, BAG_TOP + 1, "lgrey");
  }
  quad(BAG_X, BAG_W, 26, 27.5, "grey");
  quad(BAG_X, BAG_W, 26, 26.7, "lgrey");
  // the shopping poking out of the top: a baguette, two leeks with fanned dark leaves, a head of kale
  const n = nod;
  const bx = BAG_X + 5.5 - sx(22);
  g.rect(bx, 20 + n, 2.5, 11, "tan");
  g.rect(bx + 1.5, 20 + n, 1, 11, "ochre");
  g.rect(bx + 0.5, 19 + n, 1.5, 1, "tan");
  for (const y of [22, 25, 28]) {
    g.p(bx + 0.5, y + n, "cream");
  }
  for (const [x0, topY] of [
    [BAG_X + 1, 22],
    [BAG_X + 3.3, 24],
  ] as const) {
    const lx = x0 - sx(topY);
    g.rect(lx, topY + 5 + n, 2, 26 - topY, "white");
    g.rect(lx, topY + 2 + n, 2, 3, "lime");
    g.rect(lx + 1.5, topY + 2 + n, 0.5, 6, "green");
    g.tri([lx - 2, topY - 3 + n], [lx + 1, topY + 3 + n], [lx + 0.5, topY - 0.5 + n], "green");
    g.tri([lx + 4, topY - 2.5 + n], [lx + 1, topY + 3 + n], [lx + 1.5, topY + n], "dgreen");
  }
  const kx = BAG_X + 4.5 - sx(28);
  g.cel(kx, 29.5 + n, 2.6, 2.2, "green", "dgreen", "lime");
  // the tartan bag, its drawstring top cinched in dred
  quad(BAG_X, BAG_W, BAG_TOP, BAG_BOTTOM, "red");
  TARTAN_COLUMNS.forEach(([c0, cw], i) => {
    const [r0, rw] = TARTAN_ROWS[i]!;
    quad(BAG_X + c0, cw, BAG_TOP, BAG_BOTTOM, "dgreen");
    quad(BAG_X, BAG_W, BAG_TOP + r0, BAG_TOP + r0 + rw, "dgreen");
  });
  for (const [c0, cw] of TARTAN_COLUMNS) {
    for (const [r0, rw] of TARTAN_ROWS) {
      quad(BAG_X + c0, cw, BAG_TOP + r0, BAG_TOP + r0 + rw, "forest");
    }
  }
  quad(BAG_X + TARTAN_LINE, 0.7, BAG_TOP, BAG_BOTTOM, "cream");
  quad(BAG_X + BAG_W - 1, 1, BAG_TOP, BAG_BOTTOM, "dred");
  quad(BAG_X - 0.3, BAG_W + 0.6, BAG_TOP - 0.5, BAG_TOP + 1, "dred");
  // the frame's toe plate under the bag
  g.rect(BAG_X, BAG_BOTTOM, BAG_W, 1.5, "grey");
  g.rect(BAG_X, BAG_BOTTOM, BAG_W, 0.7, "lgrey");
  // The planted support foot remains under her coat while the recovery knee bends.
  humanLegs(g, lf, rf, b, "slate", "dslate", "plum", { top: 37, x0: -5 });
  // the long camel coat, flared to the hem, lit down its left side, three buttons down the front
  g.tri([4, 21 + b], [2.5, 38.5 + b], [11, 21 + b], "tan");
  g.rect(4, 21 + b, 11, 17.5, "tan");
  g.tri([15, 21 + b], [18, 21 + b], [19.5, 38.5 + b], "brown");
  g.tri([15, 21 + b], [19.5, 38.5 + b], [15, 38.5 + b], "brown");
  g.rect(4, 22 + b, 1, 10, "cream");
  g.rect(10.5, 22 + b, 1, 16.5, "brown");
  for (const y of [25, 29, 33]) {
    g.p(9.5, y + b, "dbrown");
  }
  // the tote arm (screen left), hanging, the cloth tote in the hand: cream canvas with a green band
  g.rect(1, 22 + b, 4, 9, "tan");
  g.rect(4, 22 + b, 1, 9, "brown");
  g.rect(1, 22 + b, 1, 8, "cream");
  g.rect(1, 31 + b, 1, 4, "tan");
  g.rect(4.5, 31 + b, 1, 4, "tan");
  g.rect(1.5, 30.5 + b, 3.5, 2, "skin1");
  g.rect(0, 34.5 + b, 6.5, 6.5, "cream");
  g.rect(5.5, 34.5 + b, 1, 6.5, "tan");
  g.rect(0, 40 + b, 6.5, 1, "tan");
  g.rect(0, 36.5 + b, 6.5, 1.5, "green");
  // the cart arm (screen right) out to the handle's grip
  const gx = BAG_X + 0.5 - sx(26.5);
  const gy = 27;
  limb(g, 18.5, 22.5 + b, gx, gy, 3, [
    [0.7, "tan"],
    [1, "skin1"],
  ]);
  g.rect(gx - 1, gy - 0.5, 2.5, 1.5, "skin2");
  // head: the face, a grey fringe, a mauve headscarf with white dots, tied under the chin
  g.cel(11, 12 + b, 8.5, 8.5, "mauve", "purple", "pink");
  g.tri([7.5, 18 + b], [14.5, 18 + b], [11, 23 + b], "mauve");
  faceDisc(g, 11, 14 + b, 6, 6, "skin1", "skin2");
  g.rect(5, 8.5 + b, 12, 2.5, "lgrey");
  g.rect(5, 8.5 + b, 12, 1, "white");
  g.cel(11, 7 + b, 7.5, 3.5, "mauve", "purple", "pink");
  for (const [x, y] of [
    [6, 6],
    [10, 4],
    [14, 6],
    [4, 12],
    [17, 14],
    [11, 21],
  ] as const) {
    g.p(x, y + b, "white");
  }
  roadScope.faceFront(g, 11, 13.5 + b, { mouth: 4, spread: 3 });
  // wire glasses over the eyes, a bridge between them
  for (const x of [6.5, 12.5]) {
    g.rect(x, 12.5 + b, 4, 1, "lgrey");
    g.rect(x, 15.5 + b, 4, 1, "lgrey");
    g.rect(x, 13.5 + b, 1, 2, "lgrey");
    g.rect(x + 3, 13.5 + b, 1, 2, "lgrey");
  }
  g.rect(10.5, 13 + b, 2, 1, "lgrey");
  g.p(6.5, 16.5 + b, "pink");
  g.p(15, 16.5 + b, "pink");
  return rim(g, GRANNY_RIM);
}
