// Road passer-by drawings and their occupation-specific poses.

import { type Drawable, edged, raster, rowScaleOf, scaleOf } from "../pixel.ts";
import {
  backArm,
  faceDisc,
  headlamp,
  HUMAN_WALK,
  humanLegs,
  LIT,
  nose,
  person,
  type PersonOptions,
  rim,
  scope,
  stair,
  swung,
  type Top,
  type WalkerPose,
} from "./primitives.ts";

// Layout rows y0 to y1 - 1 of the thief's stripes, from x, w wide: light where (row - b) % 4 < 2,
// else ink. The sleeves take lgrey for light, so the arms stay apart from the white-striped chest.
// Drawn in pixels at the grid's scale, every stripe pair 4 x scale rows tall (the light the shorter
// half), so drawn bigger the stripes stay even instead of breaking up into 1px rows.
function stripes(
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
const BIG_POUCH: readonly string[] = [
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

const POUCHES: readonly (readonly string[])[] = [BIG_POUCH, TIP_POUCH];

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
const POUCH_WIDTH = 6.5;

// The tip pouch from POUCHES hanging from a fist: centred on design column cx, its drawstring's top
// on the last pixel row above design row fist, where the fist ends; the widest no wider than
// POUCH_WIDTH design pixels at the grid's scale (the smallest at least).
function pouchPx(g: Drawable, cx: number, fist: number): void {
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
const HEARTS: readonly (readonly string[])[] = [
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

const HEART_INK: Readonly<Record<string, string>> = {
  1: "red",
  d: "dred",
  h: "pink",
  w: "white",
};

// A heart from HEARTS centred on design column cx with its top on design row top: the widest no wider
// than width design pixels at the grid's scale (the smallest at least), then smaller steps down.
function heartPx(g: Drawable, cx: number, top: number, width: number, smaller = 0): void {
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

// The mail carrier: a sky-blue shirt and cap, a navy brim, dark skin and a mailbag on a strap; the
// free arm swings, the one by the bag stays.
function mailTop(g: Drawable, b: number, arms = 0): void {
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

type Side = "left" | "right";

interface JoggerPose {
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
const BIB: readonly (readonly string[])[] = [
  ["111", "001", "010", "100", "100"],
  ["111", "100", "111", "001", "111"],
];

// The race number "75" centred on design point (cx, cy), 1px apart, in ink; under 1.5x the bib is too
// small for digits and takes a 1px ink bar instead.
function bib(g: Drawable, cx: number, cy: number): void {
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

interface BikePose {
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
