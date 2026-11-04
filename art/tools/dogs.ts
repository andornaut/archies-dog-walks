// Draw the dogs in code and build their Aseprite sources and exports.
//
// Each dog gets two sprites in Endesga 32: a road sprite with coloured outlines and an ink-outlined
// face:
//
// - dog-<name>: the road sprite, seen from above and behind, its frame by size class (DOG_CLASS,
//   SIZE_CLASS): large 54x54 (Kilo the Alaskan Malamute, Sequoia the Great Pyrenees, Penny the golden
//   retriever mix), medium 48x48 (Archie, Lady, Pepe the miniature poodle) and small 38x38 (Buddy,
//   Ginger, Reggie), the large dogs drawn DOG_ZOOM narrower and the small dogs DOG_ZOOM larger (more
//   down than across). Its drawing functions take 32-unit design coordinates and run on a mini.ts Mini
//   at roadScale(name) (the side / 32), which keeps 1px lines and single pixels 1px. Tags: walk (8
//   frames, 75ms), react (4, 60ms: compression, tuck, landing and settle), pull (4, 80ms, leaning
//   right and scrabbling; the game mirrors it for left), tell (4, 125ms, the lean before a pull, head
//   and shoulders pitched toward it and the neck stretched; the game adds the fx-bark pop), idle (4,
//   300ms, standing while the walk pauses: a slow tail wag, a 1px breath and a twitch of the right
//   ear) and shake (4, 60ms, a quick shake-off after an encounter hit, throwing droplets and settling
//   on its centre).
// - face-dog-<name>: the dog's face on its card and in the picker, a 32x32 frame, the face drawn
//   FACE_SIDE big and sat on the bottom edge, the size classes one even step apart and the large dogs
//   zoomed to fill it. Tags: happy, neutral, upset.
//
// dogFrames draws a road sprite's tags, here rather than in minis.ts, which draws the dogs' depth
// variants with it: minis.ts imports this module, so neither imports the other in a cycle.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { type Scale, side, small, snap } from "./mini.ts";
import {
  type Colour,
  type Drawable,
  type DrawingScope,
  edged,
  type Frame,
  Grid,
  K,
  main,
  raster,
  roadEdge,
  rowScaleOf,
  type Sprite,
  type Tag,
} from "./pixel.ts";
import { rim, type Rims, scope as roadScope } from "./road.ts";

const USAGE = `Usage:
  node art/tools/dogs.ts preview OUT.png   every frame on the zone roads, scaled up
  node art/tools/dogs.ts build             write art/dogs/*.aseprite, then export
                                           public/art/sprites/*.png and *.json with Aseprite`;

// The grid every drawing here makes, which mini.ts's small swaps for a Mini while it runs.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

// ROAD_SIZE is the medium dogs' frame side. Each dog's 32-unit design is rasterized at
// roadScale(name) (DOG_SIZE / 32) on a Mini that keeps 1px lines and single pixels 1px; its depth
// variants at that times the step. Faces are 32x32 frames, the face drawn at FACE_SIDE / 32.
export const ROAD_SIZE = 48;

// A pose's offsets by key (see pose).
export type Pose = Readonly<Record<string, number>>;
export type PoseKey =
  | "bl"
  | "blx"
  | "bob"
  | "br"
  | "brx"
  | "ears"
  | "fl"
  | "flop"
  | "flx"
  | "fr"
  | "frx"
  | "lean"
  | "pitch"
  | "reach"
  | "spray"
  | "tail"
  | "twitch";
// Every pose key with its value.
export type FullPose = Readonly<Record<PoseKey, number>> & Pose;

// A 600ms diagonal trot: a planted paw, toe-off, a folded return and contact. Eight distinct phases
// keep the spine quiet while the paws, tail and ears follow the stride.
export const WALK: readonly Pose[] = [
  { bl: 0, blx: 0, br: 0, brx: 0, fl: 0, flop: 0, flx: 0, fr: 0, frx: 0, tail: -1 },
  { bl: 0, blx: 0, br: -1, brx: 0, fl: -1, flop: 0, flx: 0, fr: 0, frx: 0, tail: -1 },
  { bl: 0, blx: 0, br: -2, brx: -1, fl: -2, flop: 1, flx: 1, fr: 0, frx: 0, tail: 0 },
  { bl: 0, blx: 0, br: -1, brx: -1, fl: -1, flop: 1, flx: 1, fr: 0, frx: 0, tail: 1 },
  { bl: 0, blx: 0, br: 0, brx: 0, fl: 0, flop: 0, flx: 0, fr: 0, frx: 0, tail: 1 },
  { bl: -1, blx: 0, br: 0, brx: 0, fl: 0, flop: 0, flx: 0, fr: -1, frx: 0, tail: 1 },
  { bl: -2, blx: 1, br: 0, brx: 0, fl: 0, flop: -1, flx: 0, fr: -2, frx: -1, tail: 0 },
  { bl: -1, blx: 1, br: 0, brx: 0, fl: 0, flop: -1, flx: 0, fr: -1, frx: -1, tail: -1 },
];
// Compress, tuck, land and settle, with four 60ms poses.
export const REACT: readonly Pose[] = [
  { bob: 1, ears: 1, tail: 0 },
  { bl: -3, bob: -2, br: -3, ears: -1, fl: -3, fr: -3, tail: 0 },
  { bl: -2, bob: -1, br: -2, fl: -2, flop: 1, fr: -2, tail: 0 },
  { tail: 0 },
];
// Straining at the leash, leaning right: the front paws scrabble one after the other with the hind
// legs dug in, the lean surging 2 and 3 units with the shoulders following (pitch) and the neck
// stretched forward (reach), as in the tell, and the tail flicking; 4 frames at 80ms.
export const PULL: readonly Pose[] = [
  { bl: 1, bob: 0, br: 1, fl: -1, fr: -1, lean: 2, pitch: 1, reach: 1, tail: -2 },
  { bl: 1, bob: 0, br: 1, fl: -2, fr: -1, lean: 3, pitch: 1, reach: 1, tail: -2 },
  { bl: 1, bob: 0, br: 1, fl: -1, fr: -2, lean: 3, pitch: 1, reach: 1, tail: -1 },
  { bl: 1, bob: 0, br: 1, fl: -2, fr: -2, lean: 2, pitch: 1, reach: 1, tail: -2 },
];
// The tell before a pull, and the strain a still picture holds on its first frame: the dog pitches
// toward what it wants, the head 2 and 3 units across with the shoulders following (pitch) and the
// neck stretched forward (reach), rising on its toes and settling, the tail wagging high and the
// right ear flicking; 4 frames at 125ms.
export const TELL: readonly Pose[] = [
  { bob: 0, ears: -1, lean: 2, pitch: 1, reach: 1, tail: 1 },
  { bob: -1, ears: -1, lean: 3, pitch: 1, reach: 1, tail: 2 },
  { bob: -1, ears: -1, lean: 3, pitch: 1, reach: 1, tail: 1, twitch: -1 },
  { bob: 0, ears: -1, lean: 2, pitch: 1, reach: 1, tail: 2 },
];
// Standing still: the tail swings across and back, the body breathes 1px up over the middle two
// beats with the feet planted, and the right ear lifts 1px as the tail comes home.
export const IDLE: readonly Pose[] = [
  { tail: -1 },
  { bob: -1, tail: 0 },
  { bob: -1, tail: 1 },
  { tail: 0, twitch: -1 },
];
// Shaking off after an encounter hit: the head whips 2px and the body 1px left and right (lean, with
// the hind legs planted), the ears and tail flick against it, and droplets fly off on the middle two
// beats, spray pixels out from the flanks.
export const SHAKE: readonly Pose[] = [
  { ears: -1, lean: -2, tail: 1 },
  { ears: 1, lean: 2, spray: 2, tail: -2, twitch: -1 },
  { ears: -1, lean: -1, spray: 3.5, tail: 2 },
  { tail: 0 },
];
// The tags that lean toward a pull. Their depth steps settle apart from the rest (pixel.ts's
// depthSettled), so a change to a lean never moves the cuts in the other tags.
export const LEAN_TAGS: readonly string[] = ["pull", "tell"];
// A road tag: [name, poses, duration ms].
export type RoadTag = readonly [tag: string, poses: readonly Pose[], ms: number];
// Idle and shake follow the first four tags.
export const ROAD_TAGS: readonly RoadTag[] = [
  ["walk", WALK, 75],
  ["react", REACT, 60],
  ["pull", PULL, 80],
  ["tell", TELL, 125],
  ["idle", IDLE, 300],
  ["shake", SHAKE, 60],
];
// The heavy Malamute starts on diagonal recovery, so the pack's gaits do not all share one contact
// beat.
export const WALK_PHASE: Readonly<Record<string, number>> = { kilo: 2 };

// The breed's complete tag cycles, with an explicit starting phase for its walk.
export function* roadTags(name: string): Generator<RoadTag> {
  for (const [tag, basePoses, ms] of ROAD_TAGS) {
    let poses = basePoses;
    if (name === "ginger" && tag === "walk") {
      // Her long ears settle before the next contact instead of holding the lifted pose.
      poses = [...poses.slice(0, -1), { ...poses.at(-1)!, flop: 0 }];
    }
    const phase = tag === "walk" ? (WALK_PHASE[name] ?? 0) : 0;
    yield [tag, [...poses.slice(phase), ...poses.slice(0, phase)], ms];
  }
}

export type Mood = "happy" | "neutral" | "upset";
export const FACE_TAGS: readonly Mood[] = ["happy", "neutral", "upset"];

const POSE_DEFAULTS: FullPose = {
  bl: 0,
  blx: 0,
  bob: 0,
  br: 0,
  brx: 0,
  ears: 0,
  fl: 0,
  flop: 0,
  flx: 0,
  fr: 0,
  frx: 0,
  lean: 0,
  pitch: 0,
  reach: 0,
  spray: 0,
  tail: 0,
  twitch: 0,
};

// Every pose key with its default. flop lets both ears lag down behind the head (positive is down),
// as they do after a paw lifts; twitch moves the right ear alone (negative is up); spray is how far
// the shake-off's droplets have flown from the flanks, 0 for none. lean bends the head across and the
// shoulders and front legs half as far; pitch moves the head, shoulders and front legs further
// across together, over the planted hind legs; reach lifts the head up the screen, away from the
// walker, as a dog stretches its neck toward what it wants. flx/frx/blx/brx move returning paws
// inward independently of their vertical lift, keeping the planted diagonal pair stable.
export function pose(q: Pose): FullPose {
  return { ...POSE_DEFAULTS, ...q };
}

// A dog's road drawing for a pose and its face drawing for a mood.
export type RoadDraw = (q: Pose) => Drawable;
export type FaceDraw = (mood: Mood) => Drawable;

// ---------- Kilo: Alaskan Malamute, large, grey and white, blue eyes, orange harness ----------

export function kiloRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  // o shifts the body down so the big head has headroom to lean
  const b = q.bob;
  const ln = q.lean;
  const o = 2;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  // legs: thick and white, the front pair tucked under the chest, peeking out at its sides, the back
  // pair under the hips
  g.rect(8 + sw + q.flx, 16 + o + q.fl + b, 3, 4, "white");
  g.rect(21 + sw + q.frx, 16 + o + q.fr + b, 3, 4, "white");
  g.rect(8 + q.blx, 26 + nativeRow(g) + Math.min(q.bl, 0), 4, 4, "white");
  g.rect(20 + q.brx, 26 + nativeRow(g) + Math.min(q.br, 0), 4, 4, "white");
  // a heavy barrel: white flanks, a broad grey saddle, the harness across the shoulders
  const bx = 16 + sw;
  g.cel(bx, 20.5 + o + b, 8.5, 6.5, "white", "lgrey");
  g.cel(bx, 19.5 + o + b, 6, 5.5, "slate", "dslate", "grey");
  g.rect(bx - 7, 16 + o + b, 14, 2, "orange");
  g.rect(bx - 7, 17 + o + b, 14, 1, "rust");
  g.ell(bx, 15 + o + b, 5.5, 1.5, "dslate");
  // the plumed tail curled over the hips: grey on top like the saddle, its white underside in the
  // curl
  const tx = 16 + q.tail;
  g.cel(tx, 28 + Math.min(b, 0), 4, 2.2, "slate", "dslate", "grey");
  g.ell(tx + 0.5, 28.5 + Math.min(b, 0), 2, 1, "white");
  // White planted toes / shaded returning toes, articulated clear of the barrel.
  for (const [x, lift, dx] of [
    [10, Math.min(q.bl, 0), q.blx],
    [22, Math.min(q.br, 0), q.brx],
  ] as const) {
    const [col, shade] = lift >= 0 ? ["white", "lgrey"] : ["lgrey", "grey"];
    inlay(g, "grey", (t) => t.cel(x + dx, 28 + nativeRow(g) + lift, 1.7, 1.3, col, shade));
  }
  // a broad head with white cheeks at its sides, which set his outline, and small ears set wide,
  // their tips rounded
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  const e = q.ears + q.flop;
  const tip = Math.max(2, 2.5 + o + hb + e);
  const t = q.twitch;
  g.tri([hx - 8, 7.5 + o + hb], [hx - 6.5, tip], [hx - 3, 5 + o + hb], "slate");
  g.tri([hx + 8, 7.5 + o + hb + t], [hx + 6.5, tip + t], [hx + 3, 5 + o + hb + t], "slate");
  g.cel(hx, 10 + o + hb, 8.5, 6, "slate", "dslate", "grey");
  g.ell(hx - 7, 12.5 + o + hb, 2, 2.2, "white");
  g.ell(hx + 7, 12.5 + o + hb, 2, 2.2, "white", "lgrey");
  underside(g);
  spray(g, q.spray);
  rim(g, KILO_RIM);
  return g;
}

// Kilo's grey coat lit where its silhouette faces up or left, so the dark head and ears hold on the
// dslate road.
export const KILO_RIM: Rims = { dslate: ["grey", null], slate: ["grey", null] };

export function kiloFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  const d = droop(mood);
  // a Malamute's ears: small, set wide on the broad skull, their tips rounded
  g.tri([5.5, 11], [7 - d, 3 + d], [12.5, 7 + d / 2], "slate");
  g.tri([26.5, 11], [25 + d, 3 + d], [19.5, 7 + d / 2], "slate");
  g.tri([7.5, 9], [8 - d, 5.5 + d], [11, 7.5 + d / 2], "pink");
  g.tri([24.5, 9], [24 + d, 5.5 + d], [21, 7.5 + d / 2], "pink");
  g.cel(16, 28, 7.5, 3.5, "lgrey", "grey", "white");
  g.cel(16, 16, 11, 8.5, "slate", "dslate", "grey");
  // white mask: brows, cheeks and muzzle
  g.cel(16, 20.5, 8, 5, "lgrey", "grey", "white");
  g.rect(15, 8, 2, 7, "lgrey");
  g.rect(10, 12, 3, 1, "white");
  g.rect(19, 12, 3, 1, "white");
  // a Y-front harness: a strap down from each shoulder to a ring on the chest, one down from it, each
  // step overlapping the last so the straps stay unbroken at the face's zoom
  for (let i = 0; i < 4; i++) {
    g.rect(9 + i * 1.5, 25 + i, 2.5, 1.5, "orange");
    g.rect(20.5 - i * 1.5, 25 + i, 2.5, 1.5, "orange");
  }
  g.rect(15, 29, 2, 3, "orange");
  g.rect(15, 28, 2, 2, "grey");
  eyes(g, 10, 19, 14, { iris: "sky", mood });
  g.rect(14, 18, 4, 2, "ink");
  g.p(14, 18, "slate");
  mouth(g, 20, mood);
  return g;
}

// ---------- Lady: beagle, medium, tricolour, long ears, green collar ----------

export function ladyRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  g.rect(9 + sw + q.flx, 18 + q.fl + b, 2, 3, "white");
  g.rect(21 + sw + q.frx, 18 + q.fr + b, 2, 3, "white");
  g.rect(10 + q.blx, 25 + Math.min(q.bl, 0), 3, 3, "white");
  g.rect(19 + q.brx, 25 + Math.min(q.br, 0), 3, 3, "white");
  const bx = 16 + sw;
  // tricolour: a tan coat, the black saddle across the back with tan showing round the rump and hips
  g.cel(bx, 22 + b, 6.5, 5, "ochre", "rust", "tan");
  g.cel(bx, 20.5 + b, 5, 3.6, "navy", "ink", "dslate");
  // tail held up, white tip
  const tx = 16 + q.tail;
  g.rect(tx - 1, 26 + b, 2, 3, "navy");
  g.rect(tx - 1, 29 + b, 2, 1, "white");
  g.ell(bx, 16 + b, 4.5, 1.5, "ink");
  g.rect(bx - 5, 16 + b, 10, 2, "green");
  g.rect(bx - 5, 17 + b, 10, 1, "dgreen");
  // a round head no wider than the body, the long ears hanging from its sides past the collar
  hindPaws(g, q, ["white", "lgrey"], "lgrey", [
    [11.5, 27, 1.3, 0.9],
    [20.5, 27, 1.3, 0.9],
  ]);
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  g.cel(hx, 11 + hb, 5.5, 5, "ochre", null, "tan");
  g.cel(hx - 5, 13 + hb - q.ears + q.flop, 2, 4.5, "rust", "dbrown");
  g.cel(hx + 5, 13 + hb - q.ears + q.flop + q.twitch, 2, 4.5, "rust", "dbrown");
  spray(g, q.spray);
  return g;
}

export function ladyFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  g.cel(16, 28.5, 6.5, 3, "white", "lgrey");
  g.cel(16, 15.5, 9, 8, "ochre", "rust", "tan");
  g.rect(15, 7, 2, 9, "white");
  g.cel(16, 20.5, 6, 4.5, "white", "lgrey");
  const d = droop(mood);
  g.cel(6.5 - d / 2, 18 + d, 3, 7.5, "rust", "dbrown");
  g.cel(25.5 + d / 2, 18 + d, 3, 7.5, "rust", "dbrown");
  g.rect(9, 26, 14, 2, "green");
  g.rect(9, 27, 14, 1, "dgreen");
  eyes(g, 11, 19, 14, { mood });
  g.rect(14, 17, 4, 2, "ink");
  g.p(14, 17, "dslate");
  mouth(g, 20, mood);
  return g;
}

// ---------- Ginger: Maltese, small, white, pink bow ----------

export function gingerRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  // the front paws peek out under the coat beside the chest, below the ears, stepping as the others'
  // do
  g.rect(9 + sw + q.flx, 21.5 + q.fl + b, 2, 2, "lgrey");
  g.rect(20.5 + sw + q.frx, 21.5 + q.fr + b, 2, 2, "lgrey");
  g.rect(12 + q.blx, 27 + nativeRow(g) + Math.min(q.bl, 0), 2, 2, "lgrey");
  g.rect(18 + q.brx, 27 + nativeRow(g) + Math.min(q.br, 0), 2, 2, "lgrey");
  const bx = 16 + sw;
  g.cel(bx, 23.5 + b, 5.5, 4.0, "white", "lgrey");
  g.cel(bx - 4.5, 25 + b, 1.6, 2, "white");
  g.ell(bx + 4.5, 25 + b, 1.6, 2, "lgrey");
  g.ell(bx, 20 + b, 4, 1.2, "lgrey");
  const tx = 16 + q.tail;
  g.cel(tx, 25.8 + b, 3, 1.5, "white");
  // Two small paws sit in front of the hem, not under its white mass.
  for (const [x, lift, dx] of [
    [13, Math.min(q.bl, 0), q.blx],
    [19, Math.min(q.br, 0), q.brx],
  ] as const) {
    const [col, shade] = lift >= 0 ? ["white", "lgrey"] : ["lgrey", "grey"];
    inlay(g, "lgrey", (t) => t.cel(x + dx, 28 + nativeRow(g) + lift, 1.25, 1.0, col, shade));
  }
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  g.cel(hx - 4.5, 18.4 + hb - q.ears + q.flop, 2, 4.4, "white", "lgrey");
  g.cel(hx + 4.5, 18.4 + hb - q.ears + q.flop + q.twitch, 2, 4.4, "white", "lgrey");
  // the head inlaid in lgrey over the ears and the back, so it holds apart from the white coat
  inlay(g, "lgrey", (t) => t.cel(hx, 15.5 + hb, 5.5, 4.5, "white", "lgrey"));
  bow(g, hx, 10 + hb, { folds: false });
  underside(g);
  spray(g, q.spray);
  return g;
}

export function gingerFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  g.cel(16, 26.5, 6, 3.5, "white", "lgrey");
  const d = droop(mood);
  g.cel(7.5 - d / 2, 19 + d, 3.5, 7.5, "white", "lgrey");
  g.cel(24.5 + d / 2, 19 + d, 3.5, 7.5, "lgrey", "grey");
  // the head inlaid over the ears in lgrey, so the white ears hang apart from the white head
  inlay(g, "lgrey", (t) => {
    t.cel(16, 16, 8.5, 8, "white", "lgrey");
    t.cel(16, 20.5, 4.5, 3.5, "white", "lgrey");
  });
  bow(g, 16, 6, { big: true });
  eyes(g, 11, 19, 15, { mood });
  g.rect(15, 18, 2, 2, "ink");
  mouth(g, 21, mood);
  return g;
}

// ---------- Reggie: pug, small, fawn, black mask, red bandana ----------

export function reggieRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  g.rect(10 + sw + q.flx, 21 + q.fl + b, 2, 2, "skin2");
  g.rect(20 + sw + q.frx, 21 + q.fr + b, 2, 2, "skin2");
  const bx = 16 + sw;
  g.rect(12 + q.blx, 27 + nativeRow(g) + Math.min(q.bl, 0), 2, 2, "skin2");
  g.rect(18 + q.brx, 27 + nativeRow(g) + Math.min(q.br, 0), 2, 2, "skin2");
  g.cel(bx, 23.5 + b, 5.5, 4, "skin1", "skin2", "cream");
  // the curly tail, coiled on top of the rump: a skin2 ring round the coat, a skin2 dot at its heart
  const tx = 16 + q.tail;
  g.ell(tx, 24.5 + b, 2.3, 1.9, "skin2");
  g.ell(tx - 0.2, 24.3 + b, 1.4, 1.1, "skin1");
  g.p(tx, 24.5 + b, "skin2");
  g.rect(bx - 4, 19 + b, 8, 1, "red");
  g.rect(bx - 1, 19 + b, 2, 2, "dred");
  hindPaws(g, q, ["skin1", "skin2"], "skin2", [
    [13, 28 + nativeRow(g), 1.2, 0.9],
    [19, 28 + nativeRow(g), 1.2, 0.9],
  ]);
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  g.cel(hx, 15 + hb, 5.5, 4.5, "skin1", "skin2", "cream");
  g.ell(hx - 4.8, 12.3 + hb - q.ears + q.flop, 2, 1.7, "navy");
  g.ell(hx + 4.8, 12.3 + hb - q.ears + q.flop + q.twitch, 2, 1.7, "navy");
  g.rect(hx - 2, 13 + hb, 4, 1, "skin2");
  spray(g, q.spray);
  return g;
}

export function reggieFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  g.tri([8, 26], [24, 26], [16, 31], "red");
  g.p(13, 27, "white");
  g.p(18, 27, "white");
  g.p(16, 29, "white");
  g.cel(16, 16, 9.5, 8.5, "skin1", "skin2", "cream");
  const d = droop(mood);
  g.tri([6 - d / 2, 13 + d], [8 - d, 7 + d], [12, 10], "navy");
  g.tri([26 + d / 2, 13 + d], [24 + d, 7 + d], [20, 10], "navy");
  g.rect(13, 9, 6, 1, "skin2");
  g.cel(16, 20.5, 5.5, 4, "navy", "ink", "dslate");
  eyes(g, 10, 20, 14, { mood });
  g.rect(15, 18, 2, 1, "ink");
  mouth(g, 20, mood);
  return g;
}

// ---------- Buddy: Jack Russell, small, white with tan patches, red collar ----------

export function buddyRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  g.rect(10 + sw + q.flx, 21 + q.fl + b, 2, 3, "white");
  g.rect(20 + sw + q.frx, 21 + q.fr + b, 2, 3, "white");
  g.rect(12 + q.blx, 26 + nativeRow(g) + Math.min(q.bl, 0), 2, 3, "white");
  g.rect(18 + q.brx, 26 + nativeRow(g) + Math.min(q.br, 0), 2, 3, "white");
  const bx = 16 + sw;
  g.cel(bx, 23.5 + b, 5, 4, "white", "lgrey");
  g.cel(bx + 1.5, 22.5 + b, 2.5, 2, "ochre", "rust");
  const tx = 16 + q.tail;
  // a short upright tail, white with a tan tip, standing clear of the rump
  g.rect(tx - 1, 27 + b, 2, 2, "white");
  g.rect(tx - 1, 28 + b, 2, 1, "ochre");
  hindPaws(g, q, ["white", "lgrey"], "lgrey", [
    [13, 28 + nativeRow(g), 1.2, 0.9],
    [19, 28 + nativeRow(g), 1.2, 0.9],
  ]);
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  g.rect(bx - 4, 19 + b, 8, 1, "red");
  g.cel(hx, 15 + hb, 5, 4.5, "white", "lgrey");
  g.ell(hx + 2, 14 + hb, 2.5, 2, "ochre");
  const e = q.ears + q.flop;
  g.tri([hx - 5, 14 + hb], [hx - 4, 10 + hb + e], [hx - 1.5, 12.5 + hb], "ochre");
  const t = q.twitch;
  g.tri([hx + 5, 14 + hb + t], [hx + 4, 10 + hb + e + t], [hx + 1.5, 12.5 + hb + t], "ochre");
  spray(g, q.spray);
  return g;
}

export function buddyFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  g.cel(16, 16, 9, 8, "white", "lgrey");
  g.cel(10.5, 12.5, 4, 4, "ochre", "rust", "tan");
  g.cel(21.5, 12.5, 4, 4, "ochre", "rust", "tan");
  const d = droop(mood);
  g.tri([6, 12 + d], [9 - d, 5 + d], [13, 9], "ochre");
  g.tri([26, 12 + d], [23 + d, 5 + d], [19, 9], "ochre");
  g.tri([7.5, 11 + d], [9 - d, 7 + d], [11, 9], "rust");
  g.tri([24.5, 11 + d], [23 + d, 7 + d], [21, 9], "rust");
  g.cel(16, 21, 5, 3.5, "white", "lgrey");
  g.rect(9, 26, 14, 2, "red");
  g.rect(9, 27, 14, 1, "dred");
  eyes(g, 11, 19, 14, { mood });
  g.rect(15, 18, 2, 2, "ink");
  mouth(g, 20, mood);
  return g;
}

// ---------- Pepe: miniature poodle, medium, black with a white stripe, show-clip pom-poms ----------

// A colour ramp: fill, shade and light (or null).
export type Ramp = readonly [fill: string, shade: string, light: string | null];

// Pepe's coat: the curls (fill, shade, light), the shaved skin and the white stripe (fill, shade).
export const CURL: Ramp = ["navy", "ink", "dslate"];
export const SHAVED: Ramp = ["slate", "dslate", "grey"];
export const STRIPE: readonly [string, string] = ["white", "lgrey"];

const PEPE_COAT = new Set([...CURL, ...SHAVED].map((n) => K[n!]));

// Pepe's outline: grey round the black coat, which has no fill that holds against the dslate road,
// and the road outline round everything else.
export function pepeEdge(c: string): string {
  return PEPE_COAT.has(c) ? K.grey! : roadEdge(c);
}

export function pepeRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid(), pepeEdge);
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  // a miniature poodle: compact, the head and mane sat lower over short legs than a standard's
  const lowering = 1;
  // shaved legs, each with a pom-pom bracelet at the paw
  for (const [x, d] of [
    [10 + sw + q.flx, q.fl],
    [22 + sw + q.frx, q.fr],
  ] as const) {
    g.rect(x - 1, 19 + lowering + d + b, 2, 1, SHAVED[0]);
    puff(g, x, 22 + lowering + d + b, 1.8, 1.6);
  }
  for (const [x, d] of [
    [12 + q.blx, Math.min(q.bl, 0)],
    [20 + q.brx, Math.min(q.br, 0)],
  ] as const) {
    g.rect(x - 1, 26 + nativeRow(g) + d, 2, 2, SHAVED[0]);
    puff(g, x, 28.5 + nativeRow(g) + d, 2, 1.6);
  }
  // shaved hindquarters behind a curly mane over the shoulders
  const bx = 16 + sw;
  g.ell(bx, 24 + b, 3.8, 3.5, ...SHAVED);
  puff(g, bx, 18.5 + lowering + b, 5, 3.2);
  // a thin tail held up with a pom-pom on the end
  const tx = 16 + q.tail;
  g.rect(tx, 25 + b, 1, 2, SHAVED[0]);
  puff(g, tx + 0.5, 28 + b, 2, 1.8);
  // ear puffs hanging behind a round topknot
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  puff(g, hx - 5, 14.5 + lowering + hb - q.ears + q.flop, 2, 3.5, true);
  puff(g, hx + 5, 14.5 + lowering + hb - q.ears + q.flop + q.twitch, 2, 3.5, true);
  puff(g, hx, 10.5 + lowering + hb, 4, 3.8, true);
  // the white stripe, one width all the way, from the top of the topknot down the neck, the mane and
  // the back to the tail's tip; leaning, the head moves further than the body, so the neck carries it
  // across on a diagonal, a row at a time
  g.rect(hx - 1, 7 + lowering + hb, 2, 7, STRIPE[0]);
  for (let k = 0; k < 3; k++) {
    g.rect(hx - 1 + ((bx - hx) * (k + 1)) / 4, 13 + lowering + hb + k, 2, 2, STRIPE[0]);
  }
  g.rect(bx - 1, 15 + lowering + b, 2, 10 - lowering, STRIPE[0]);
  // the tail's stripe runs down its stem into the white tip, so the two read as one tail
  g.rect(tx, 25 + b, 1, 3, STRIPE[0]);
  g.ell(tx + 0.5, 28.8 + b, 1.2, 1, STRIPE[0]);
  // a small mauve show bow tied in purple, pinned to the topknot's top right
  g.rect(hx, 5 + lowering + hb, 2, 3, "mauve");
  g.rect(hx + 3, 5 + lowering + hb, 2, 3, "mauve");
  g.p(hx + 2, 6 + lowering + hb, "purple");
  g.p(hx, 5 + lowering + hb, "pink");
  despeckle(g, [...CURL, ...SHAVED]);
  spray(g, q.spray);
  return g;
}

export function pepeFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  const d = droop(mood);
  g.cel(16, 28.5, 6.5, 3, ...CURL);
  // long ears and the topknot in curly clumps, each cel shaded on its own
  for (const [x, s] of [
    [7, -1],
    [25, 1],
  ] as const) {
    for (const y of [15, 22]) {
      g.cel(x + (s * d) / 2, y + d, 3.5, 4, CURL[0], CURL[1], s < 0 ? CURL[2] : null);
    }
  }
  // the shaved face, a short shaved muzzle lighter still
  g.cel(16, 17, 7, 7, ...SHAVED);
  g.cel(11, 9, 4, 3.5, ...CURL);
  g.cel(21, 9, 4, 3.5, ...CURL);
  g.cel(16, 8, 5, 3, ...CURL);
  g.cel(16, 22, 4, 3.5, "grey", "slate", "lgrey");
  // the white stripe from the brow up over the topknot, under the show bow
  g.rect(15, 5, 2, 9, STRIPE[0]);
  g.rect(16, 6, 1, 8, STRIPE[1]);
  bow(g, 16, 6, { big: true, colours: ["mauve", "purple"] });
  eyes(g, 11, 19, 14, { mood });
  g.rect(15, 19, 2, 2, "ink");
  mouth(g, 22, mood);
  return g;
}

// ---------- Archie: Australian Shepherd, medium, brown and white, one blue eye, red bandana ----------

// The brown coat (fill, shade, light) and the ears (ear, folded tip).
export const COAT: Ramp = ["brown", "dbrown", "skin2"];
export const EAR: readonly [string, string] = ["brown", "dbrown"];

export function archieRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  // white legs with copper points where they meet the coat
  for (const [x, y, d] of [
    [8 + sw + q.flx, 18, q.fl + b],
    [22 + sw + q.frx, 18, q.fr + b],
    [10 + q.blx, 25 + nativeRow(g), Math.min(q.bl, 0)],
    [19 + q.brx, 25 + nativeRow(g), Math.min(q.br, 0)],
  ] as const) {
    g.rect(x, y + d, y > 20 ? 3 : 2, 4, "white");
    g.rect(x, y + d, y > 20 ? 3 : 2, 1, "ochre");
  }
  // a solid brown coat, as wide as Lady and longer in the coat
  const bx = 16 + sw;
  g.cel(bx, 21.5 + b, 6.8, 5.8, ...COAT);
  // A compact bobtail with one white-tipped tuft, separated from the coat by a plum line.
  const tx = 16 + q.tail;
  inlay(g, "plum", (t) => {
    t.cel(tx, 26.8 + b, 2.8, 1.8, COAT[0], COAT[1]);
    t.cel(tx - 0.5, 25.5 + b, 1.5, 1, "white");
  });
  // the fluffy white ruff round the neck, tufted out past the shoulders and down onto the back
  g.cel(bx, 18.5 + b, 6.3, 2.1, "white", "lgrey");
  // its tufts flat white, so the ruff's one shade is its own crescent along the lower right
  for (const [x, y, rx, ry] of [
    [bx - 5.5, 19.5, 1.5, 1.5],
    [bx + 5.5, 19.5, 1.5, 1.5],
    [bx - 2.5, 20.5, 2, 1.5],
    [bx + 2.5, 20.5, 2, 1.5],
  ] as const) {
    g.ell(x, y + b, rx, ry, "white");
  }
  // the red bandana tied at the nape in one knot
  g.rect(bx - 5, 16.7 + b, 10, 1.4, "red");
  g.rect(bx - 1, 16.7 + b, 2, 2, "dred");
  // rose ears set high, each tip folding over and out in the shade
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  const e = q.ears + q.flop;
  const sides = [
    [-1, 0],
    [1, q.twitch],
  ] as const;
  for (const [s, t] of sides) {
    g.tri(
      [hx + s * 5.5, 10 + hb + t],
      [hx + s * 5, 5 + hb + e + t],
      [hx + s * 1.5, 7 + hb + t],
      EAR[0],
    );
  }
  g.cel(hx, 11.5 + hb, 5.5, 5, ...COAT);
  for (const [s, t] of sides) {
    g.tri(
      [hx + s * 5, 5 + hb + e + t],
      [hx + s * 6, 6.5 + hb + e + t],
      [hx + s * 4, 6.5 + hb + e + t],
      EAR[1],
    );
  }
  spray(g, q.spray);
  rim(g, ARCHIE_RIM);
  return g;
}

// Archie's brown coat lit where its silhouette faces up or left, so it holds on the dslate road.
export const ARCHIE_RIM: Rims = { brown: ["tan", null], dbrown: ["skin2", null] };
// Archie's face's eyes: each 3x3 iris's left column and its colour, far eye first, and their top row.
export const ARCHIE_EYES: readonly (readonly [number, string])[] = [
  [10, "sky"],
  [19, "amber"],
];
export const ARCHIE_EYE_Y = 14;

export function archieFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  const d = droop(mood);
  // rose ears set high, the tips folding forward and out
  g.tri([7, 12], [8 - d, 3 + d], [13.5, 7 + d / 2], EAR[0]);
  g.tri([25, 12], [24 + d, 3 + d], [18.5, 7 + d / 2], EAR[0]);
  g.tri([8 - d, 3 + d], [4 - d, 6 + d], [9 - d, 6 + d], EAR[1]);
  g.tri([24 + d, 3 + d], [28 + d, 6 + d], [23 + d, 6 + d], EAR[1]);
  // a white ruff, the red bandana tied over it
  g.cel(16, 27, 9, 3.5, "white", "lgrey");
  g.tri([8, 25], [24, 25], [16, 31.5], "red");
  g.tri([16, 25], [24, 25], [16, 31.5], "dred");
  g.rect(8, 25, 16, 1, "dred");
  // a broad skull, squared so it fills in under the ears
  g.cel(16, 16, 9.5, 8.5, ...COAT, 2.4);
  // a white blaze up the forehead, widening down into the white muzzle
  g.rect(15, 7, 2, 9, "white");
  g.rect(14, 13, 4, 3, "white");
  // copper brows and cheeks
  g.p(10, 11, "ochre");
  g.p(21, 11, "ochre");
  g.rect(9, 18, 2, 2, "ochre");
  g.rect(22, 18, 2, 2, "ochre");
  g.cel(16, 20.5, 5, 3.5, "white", "lgrey");
  const [[lx], [rx]] = ARCHIE_EYES as readonly [
    readonly [number, string],
    readonly [number, string],
  ];
  const y = ARCHIE_EYE_Y;
  eyes(g, lx, rx, y, { iris: "sky", mood });
  // odd eyes, the far one sky and the near one amber, drawn alike so they look the same way: the
  // shine at the iris's top left and the pupil at its lower right
  for (const [x, iris] of ARCHIE_EYES) {
    g.rect(x, y, 3, 3, iris);
    g.rect(x + 1, y + 1, 2, 2, "ink");
    g.p(x, y, "white");
  }
  // a liver nose
  g.rect(14, 18, 4, 2, "plum");
  g.p(14, 18, "dbrown");
  mouth(g, 20, mood);
  return g;
}

// ---------- Sequoia: Great Pyrenees, large, giant white fluff, collar with a bell ----------

export function sequoiaRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  const o = 2;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  g.rect(6 + sw + q.flx, 15 + o + q.fl + b, 4, 4, "white");
  g.rect(22 + sw + q.frx, 15 + o + q.fr + b, 4, 4, "white");
  g.rect(8 + q.blx, 26 + nativeRow(g) + Math.min(q.bl, 0), 4, 4, "lgrey");
  g.rect(20 + q.brx, 26 + nativeRow(g) + Math.min(q.br, 0), 4, 4, "lgrey");
  // a giant fluffy body, its coat bunched into tufts round the edge
  const bx = 16 + sw;
  g.cel(bx, 20.5 + o + b, 9, 5.7, "white", "lgrey");
  for (const [dx, dy] of [
    [-8, -1],
    [8, -1],
    [-7, 3],
    [7, 3],
    [-4, 4.5],
    [4, 4.5],
  ] as const) {
    g.ell(bx + dx, 20.5 + o + b + dy, 2.2, 2.2, "white");
  }
  g.rect(bx - 7, 16 + o + b, 14, 1, "sky");
  // the plumed tail carried up over the back
  const tx = 16 + q.tail;
  g.cel(tx, 23.5 + o + b, 4.5, 3.5, "white", "lgrey");
  // a broad round head, its drop ears hanging at the sides, marked a soft badger cream
  hindPaws(g, q, ["white", "lgrey"], "grey", [
    [10, 28.5 + nativeRow(g), 1.7, 1.2],
    [22, 28.5 + nativeRow(g), 1.7, 1.2],
  ]);
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  const e = -q.ears + q.flop;
  const t = q.twitch;
  g.cel(hx, 9.5 + o + hb, 7.5, 6.5, "white", "lgrey", null, 2.6);
  g.cel(hx - 7.5, 11.5 + o + hb + e, 2.3, 3.8, "cream", "tan");
  g.cel(hx + 7.5, 11.5 + o + hb + e + t, 2.3, 3.8, "cream", "tan");
  underside(g);
  // the droplets start past the ears and tufts, so they fly clear of his white coat
  spray(g, q.spray, 4);
  return g;
}

export function sequoiaFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  const d = droop(mood);
  g.cel(16, 28, 9, 3.5, "white", "lgrey");
  // a Great Pyrenees' broad head in a thick ruff wider than the skull, small V drop ears set at its
  // sides, marked badger tan; they swing out and sag as the dog loses heart
  g.cel(16, 22, 12, 4.5, "white", "lgrey");
  g.cel(16, 15.5, 10, 8.5, "white", "lgrey");
  for (const sgn of [-1, 1]) {
    const x = 16 + sgn * (8 + d / 2);
    inlay(g, "skin2", (t) => {
      t.tri([x - 2.5 * sgn, 9 + d], [x + 2.5 * sgn, 9.5 + d], [x + 0.5 * sgn, 16 + d], "tan");
      t.tri([x - 1.5 * sgn, 10 + d], [x + 1.5 * sgn, 10.5 + d], [x + 0.5 * sgn, 14 + d], "cream");
    });
  }
  g.rect(9, 26, 14, 1, "sky");
  g.cel(16, 28, 2, 2, "amber", "orange", "yellow");
  g.p(16, 29, "orange");
  eyes(g, 11, 19, 14, { mood });
  g.rect(15, 18, 2, 2, "ink");
  mouth(g, 20, mood);
  return g;
}

// ---------- Penny: golden retriever with a Labrador build, large, golden coat, otter tail ----------

// Penny's coat, one ramp cel shaded: base, shade, light.
export const GOLD: Ramp = ["amber", "orange", "yellow"];

export function pennyRoad(pq: Pose): Drawable {
  const g = edged(scope.Grid());
  const q = pose(pq);
  const b = q.bob;
  const ln = q.lean;
  const o = 2;
  // the shoulders and front legs follow the head half as far, and the pitch carries both
  const sw = Math.floor(ln / 2) + q.pitch;
  // solid legs, each shaded down its outer side
  for (const [x, y, d] of [
    [7 + sw + q.flx, 15 + o, q.fl + b],
    [22 + sw + q.frx, 15 + o, q.fr + b],
    [9 + q.blx, 26, Math.min(q.bl, 0)],
    [20 + q.brx, 26, Math.min(q.br, 0)],
  ] as const) {
    g.rect(x, y + d, 3, 4, GOLD[0]);
    g.rect(x + (x > 16 ? 2 : 0), y + d, 1, 4, GOLD[1]);
  }
  // a deep, broad chest and barrel
  const bx = 16 + sw;
  gold(g, bx, 20.5 + o + b, 7.5, 5.5, 2.3);
  g.rect(bx - 6, 16 + o + b, 12, 2, "blue");
  g.rect(bx - 6, 16 + o + b, 12, 1, "sky");
  // a thick otter tail laid over the rump in the shade colour, tapering to a blunt tip and swinging
  // from its root, lit down its left side
  const tx = 16 + q.tail * 2;
  const ty = 31 + Math.min(b, 0);
  for (const [[left, r, tl, tr], c] of [
    [[13, 19, -1.5, 1.5], GOLD[1]],
    [[13, 14.5, -1.5, -0.5], GOLD[0]],
  ] as const) {
    g.tri([left, 22 + b], [r, 22 + b], [tx + tr, ty], c);
    g.tri([left, 22 + b], [tx + tl, ty], [tx + tr, ty], c);
  }
  // a broad skull with short flat drop ears at its sides, in the shade colour, over a neck as wide as
  // the skull down to the collar, so no road shows between an ear and the collar
  hindPaws(g, q, [GOLD[0], GOLD[1]], "dbrown", [
    [10.5, 28.8, 1.3, 1.0],
    [21.5, 28.8, 1.3, 1.0],
  ]);
  const hx = 16 + ln + q.pitch;
  const hb = b - q.reach;
  const left = Math.min(hx, bx) - 6.5;
  const right = Math.max(hx, bx) + 6.5;
  g.rect(left, 13 + o + hb, right - left, 3, GOLD[0]);
  g.rect(bx - 6, 16 + o + b, 12, 2, "blue");
  g.rect(bx - 6, 16 + o + b, 12, 1, "sky");
  gold(g, hx, 9.5 + o + hb, 6.5, 4.5, 2.8);
  for (const [x, t] of [
    [hx - 6.5, 0],
    [hx + 6.5, q.twitch],
  ] as const) {
    g.blob(x, 10.5 + o + hb - q.ears + q.flop + t, 1.8, 2.5, GOLD[1], null, null, 3);
  }
  spray(g, q.spray);
  return g;
}

// A rounded mass of Penny's coat: the base lit along its top left, over its shade cast 1px down and
// right, so the shade is a thin rim and not a diagonal plane that would swallow the ears and tail.
export function gold(
  g: Drawable,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  power = 2.6,
): void {
  g.blob(cx + 0.8, cy + 0.8, rx, ry, GOLD[1], null, null, power);
  g.blob(cx, cy, rx, ry, GOLD[0], null, GOLD[2], power);
}

export function pennyFace(mood: Mood): Drawable {
  const g = edged(scope.Grid(), "ink", true);
  const d = droop(mood);
  g.cel(16, 28.5, 8.5, 3.5, ...GOLD);
  // a broad, blocky head
  g.cel(16, 14.5, 10, 8.5, ...GOLD, 2.5);
  // short flat drop ears set at head height and hanging beside the cheeks; they sag and swing out as
  // she loses heart
  for (const s of [-1, 1]) {
    const x = 16 + s * 9 + (s * d) / 2;
    inlay(g, "dbrown", (t) => {
      t.tri([x - s * 3.5, 8 + d], [x + s * 2, 8.5 + d], [x + s, 19 + d], GOLD[1]);
      t.tri([x - s * 3.5, 8 + d], [x - s * 1.5, 18 + d], [x + s, 19 + d], GOLD[1]);
    });
  }
  // a square muzzle, a shade lighter than the coat, set off from the brow by a clear stop
  inlay(g, GOLD[1], (t) => t.cel(16, 20.5, 5.5, 4, GOLD[2], GOLD[0], null, 3.2));
  // the blue collar and a round tag
  g.rect(8, 26, 16, 2, "blue");
  g.rect(8, 26, 16, 1, "sky");
  g.cel(16, 29, 1.6, 1.6, "lgrey", "grey", "white");
  eyes(g, 11, 19, 14, { mood });
  g.rect(14, 18, 4, 2, "ink");
  g.p(14, 18, "dslate");
  mouth(g, 20, mood);
  return g;
}

// Draw on a blank grid the size of g, then lay what it drew over g, ringed in line wherever it meets
// what g already holds, while its open edges take the grid's outline. It works in drawn pixels, so
// on a Mini too.
export function inlay(g: Drawable, line: string, draw: (t: Drawable) => void): void {
  const t = scope.Grid(g.w, g.h);
  draw(t);
  const gp = g.px;
  const tp = t.px;
  const h = gp.length;
  const w = gp[0]!.length;
  const shape = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tp[y]![x]) {
        shape.add(`${x},${y}`);
      }
    }
  }
  const colour = K[line] ?? line;
  for (const cell of shape) {
    const [x, y] = cell.split(",").map(Number) as [number, number];
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (!shape.has(`${xx},${yy}`) && xx >= 0 && xx < w && yy >= 0 && yy < h && gp[yy]![xx]) {
        gp[yy]![xx] = colour;
      }
    }
  }
  for (const cell of shape) {
    const [x, y] = cell.split(",").map(Number) as [number, number];
    gp[y]![x] = tp[y]![x]!;
  }
}

// One native output row in the drawing grid's design coordinates.
export function nativeRow(g: Drawable): number {
  return 1 / rowScaleOf(g);
}

// A hind paw: [x, y, rx, ry].
export type Paw = readonly [x: number, y: number, rx: number, ry: number];

// Separate planted toes from shaded returning toes in front of the breed's lower coat.
export function hindPaws(
  g: Drawable,
  q: FullPose,
  coat: readonly [string, string],
  line: string,
  feet: readonly [Paw, Paw],
): void {
  for (const [[x, y, rx, ry], key] of [
    [feet[0], "bl"],
    [feet[1], "br"],
  ] as const) {
    const lift = Math.min(q[key], 0);
    const dx = q[`${key}x`];
    const [col, shade] = lift >= 0 ? coat : [coat[1], line];
    inlay(g, line, (t) => t.cel(x + dx, y + lift, rx, ry, col, shade));
  }
}

// ---------- shared features ----------

// How far the ears sag, in pixels: perked when happy, relaxed when neutral, flat when upset.
export function droop(mood: Mood): number {
  return { happy: 0, neutral: 1, upset: 3 }[mood];
}

// A clipped poodle pom-pom in Pepe's curls (CURL), shaded on its lower right, with a highlight only
// on a puff big enough to hold one as a shape, so the coat carries no single-pixel texture. ring sets
// it apart from the puffs it is drawn over with a 1px ring in the shade.
export function puff(
  g: Drawable,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ring = false,
): void {
  if (ring) {
    g.ell(cx, cy, rx + 1, ry + 1, CURL[1]);
  }
  g.ell(cx, cy, rx, ry, CURL[0], CURL[1], Math.min(rx, ry) >= 3 ? CURL[2] : null);
}

// The shake-off's water: droplets thrown d pixels out from both flanks, rising as they fly. Each is
// 1px, cyan or white, so the road outline rings it and it holds on every road. out starts them that
// much further out, for a coat whose flanks or ears reach past the others'.
export function spray(g: Drawable, d: number, out = 0): void {
  if (!d) {
    return;
  }
  for (const [x, y, c] of [
    [9, 14, "cyan"],
    [9, 20, "white"],
    [22, 12, "cyan"],
    [22, 18, "white"],
    [21, 23, "cyan"],
  ] as const) {
    const sideways = x < 16 ? -1 : 1;
    g.p(x + sideways * (d + out), y - d / 2, c);
  }
}

// A white or light grey coat's underside, one ramp step darker: white to lgrey, lgrey to grey.
export const UNDERSIDE: ReadonlyMap<string, string> = new Map([
  ["ffffff", "c0cbdc"],
  ["c0cbdc", "8b9bb4"],
]);

// Darken a white or grey coat's lower-right silhouette one ramp step: every coat pixel with open
// road below it or to its right. The coat keeps its colour, and its shade sits a step darker, so a
// white dog keeps its mass on the light roads. Works on the grid a small version draws to as well.
export function underside(g: Drawable): void {
  const px = raster(g).px;
  const h = px.length;
  const w = px[0]!.length;
  const edge: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = px[y]![x];
      if (c && UNDERSIDE.has(c) && (y + 1 >= h || x + 1 >= w || !px[y + 1]![x] || !px[y]![x + 1])) {
        edge.push([x, y]);
      }
    }
  }
  for (const [x, y] of edge) {
    px[y]![x] = UNDERSIDE.get(px[y]![x]!)!;
  }
}

// Fill every lone pixel of the given coat colours, one that none of its four opaque neighbours
// shares, with its neighbours' most common colour, so overlapping puffs leave no single-pixel texture
// to shimmer at road scale. Works on the grid a small version draws to as well.
export function despeckle(g: Drawable, colours: readonly (string | null)[]): void {
  const px = raster(g).px;
  const h = px.length;
  const w = px[0]!.length;
  const coat = new Set(colours.map((c) => K[c!]));
  const lone: [number, number, string][] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const nb = [px[y - 1]![x]!, px[y + 1]![x]!, px[y]![x - 1]!, px[y]![x + 1]!];
      const c = px[y]![x];
      if (c && coat.has(c) && nb.every(Boolean) && !nb.includes(c)) {
        // the first of the most common
        const count = (v: string): number => nb.filter((n) => n === v).length;
        lone.push([x, y, nb.reduce((best, v) => (count(v) > count(best) ? v : best))]);
      }
    }
  }
  for (const [x, y, c] of lone) {
    px[y]![x] = c;
  }
}

// A bow: Ginger's is pink, Pepe's show ribbon mauve tied in purple. The knot and folds take the second
// colour; folds false leaves the folds out, for a bow too small at road scale for them to land on its
// wings.
export function bow(
  g: Drawable,
  cx: number,
  y: number,
  {
    big = false,
    colours = ["pink", "mauve"],
    folds = true,
  }: { big?: boolean; colours?: readonly [string, string]; folds?: boolean } = {},
): void {
  const [c, knot] = colours;
  const w = big ? 4 : 3;
  g.tri([cx - 1, y + 1], [cx - 1 - w, y - 1], [cx - 1 - w, y + 3], c);
  g.tri([cx + 1, y + 1], [cx + 1 + w, y - 1], [cx + 1 + w, y + 3], c);
  if (folds) {
    g.p(cx - 1 - w + 1, y + 2, knot);
    g.p(cx + w, y + 2, knot);
  }
  g.rect(cx - 1, y, 2, 2, knot);
}

// Two eyes at columns lx and rx, row y: 2x2 ink with a glint, or 3x3 in iris with a pupil. A happy
// face has pink cheeks under them; an upset one slanted brows and a tear.
export function eyes(
  g: Drawable,
  lx: number,
  rx: number,
  y: number,
  { iris = null, mood = "happy" }: { iris?: string | null; mood?: Mood } = {},
): void {
  const wide = iris ? 3 : 2;
  for (const x of [lx, rx]) {
    if (iris) {
      g.rect(x, y, 3, 3, iris);
      g.p(x + 1, y + 1, "ink");
      g.p(x + 2, y + 2, "blue");
      g.p(x, y, "white");
    } else {
      g.rect(x, y, 2, 2, "ink");
      g.p(x, y, "white");
    }
  }
  if (mood === "happy") {
    // pink cheeks under the eyes
    for (const x of [lx - 1, rx + wide - 1]) {
      g.rect(x, y + wide + 1, 2, 1, "pink");
    }
  } else if (mood === "upset") {
    // brows slant up toward the middle, and a tear runs from the left eye
    g.rect(lx - 2, y - 1, 2, 1, "ink");
    g.rect(lx, y - 2, wide, 1, "ink");
    g.rect(rx, y - 2, wide, 1, "ink");
    g.rect(rx + wide, y - 1, 2, 1, "ink");
    g.p(lx, y + wide, "cyan");
    g.p(lx, y + wide + 1, "sky");
  }
}

// happy: a wide open grin with the tongue out; neutral: a closed line; upset: a deep frown.
export function mouth(g: Drawable, y: number, mood: Mood): void {
  if (mood === "happy") {
    g.p(13, y, "ink");
    g.p(18, y, "ink");
    g.p(14, y + 1, "ink");
    g.p(17, y + 1, "ink");
    g.rect(15, y + 1, 2, 1, "dred");
    g.rect(15, y + 2, 2, 2, "pink");
    g.p(16, y + 3, "mauve");
  } else if (mood === "neutral") {
    g.rect(14, y + 1, 4, 1, "ink");
  } else {
    g.rect(15, y, 2, 1, "ink");
    g.p(14, y + 1, "ink");
    g.p(17, y + 1, "ink");
    g.p(13, y + 2, "ink");
    g.p(18, y + 2, "ink");
  }
}

// Every dog's road and face drawings, by name, in build order.
export const DOGS: Readonly<Record<string, readonly [road: RoadDraw, face: FaceDraw]>> = {
  ginger: [gingerRoad, gingerFace],
  reggie: [reggieRoad, reggieFace],
  // eslint-disable-next-line sort-keys
  buddy: [buddyRoad, buddyFace],
  pepe: [pepeRoad, pepeFace],
  // eslint-disable-next-line sort-keys
  lady: [ladyRoad, ladyFace],
  // eslint-disable-next-line sort-keys
  archie: [archieRoad, archieFace],
  sequoia: [sequoiaRoad, sequoiaFace],
  // eslint-disable-next-line sort-keys
  penny: [pennyRoad, pennyFace],
  // eslint-disable-next-line sort-keys
  kilo: [kiloRoad, kiloFace],
};

// Each dog's road sprite side, by its size class: large 54, medium ROAD_SIZE (48) and small 38, about
// 1.1x, 1x and 0.8x.
export const SIZE_CLASS: Readonly<Record<string, number>> = {
  large: 54,
  medium: ROAD_SIZE,
  small: 38,
};
export const DOG_CLASS: Readonly<Record<string, string>> = {
  archie: "medium",
  buddy: "small",
  ginger: "small",
  kilo: "large",
  lady: "medium",
  penny: "large",
  pepe: "medium",
  reggie: "small",
  sequoia: "large",
};
export const DOG_SIZE: Readonly<Record<string, number>> = Object.fromEntries(
  Object.keys(DOGS).map((name) => [name, SIZE_CLASS[DOG_CLASS[name]!]!]),
);
// The planted feet row at full size; Archie and Lady sit one row above the other breeds' frame inset.
export const DOG_FEET: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(DOG_SIZE).map(([name, size]) => [
    name,
    size - (name === "archie" || name === "lady" ? 3 : 2),
  ]),
);
// How much bigger a dog is drawn inside its frame: one factor, or [across, down].
export type Zoom = Scale;
// How much bigger a dog is drawn inside its frame, across and down. The large dogs are drawn
// narrower, Kilo and Sequoia about 30px wide and Penny 28 at full size; the small dogs fill more of
// theirs, about 20px wide (Buddy 19) and 31 to 32 tall. So the widths step about 30, 24 and 20.
export const DOG_ZOOM: Readonly<Record<string, Zoom>> = {
  buddy: [1.17, 1.27],
  ginger: [1.13, 1.22],
  kilo: [0.93, 1],
  penny: [0.85, 1],
  reggie: [1.09, 1.27],
  sequoia: [0.82, 1],
};

// How big each dog's face is drawn in its 32px frame, sat on the bottom edge: the side that brings
// its inked area nearest its size class's target, so the classes step evenly (the square root of the
// area about 17, 21.3 and 25.5px) however much of its design a breed's ears or topknot fill. The
// large dogs zoom past the frame as far as Kilo's ears fit under its top edge, so they fill their
// tiles, and medium sits halfway.
export const FACE_SIDE: Readonly<Record<string, number>> = {
  archie: 30,
  buddy: 27,
  ginger: 23,
  kilo: 35,
  lady: 29,
  penny: 37,
  pepe: 27,
  reggie: 26,
  sequoia: 36,
};

// Rows px set in a side x side frame, centred across and on its bottom edge, cropped where they
// overflow it.
export function framed(rows: Frame, frameSide: number): Frame {
  const px = rows.slice(Math.max(0, rows.length - frameSide));
  const w = px[0]!.length;
  let out: Frame;
  if (w >= frameSide) {
    const left = Math.floor((w - frameSide) / 2);
    out = px.map((row) => row.slice(left, left + frameSide));
  } else {
    const left = Math.floor((frameSide - w) / 2);
    out = px.map((row) => [
      ...Array<Colour>(left).fill(null),
      ...row,
      ...Array<Colour>(frameSide - w - left).fill(null),
    ]);
  }
  return [
    ...Array.from({ length: frameSide - out.length }, () => Array<Colour>(frameSide).fill(null)),
    ...out,
  ];
}

// face(mood)'s outlined rows, drawn at faceSide over 32 of its 32-unit design and set on the bottom
// edge of a 32x32 frame; a side over 32 zooms in past the frame, cropping the chest at the sides.
export function faceFrame(face: FaceDraw, mood: Mood, faceSide: number): Frame {
  return framed(small(roadScope, scope, faceSide / 32, face, mood).outlined(), 32);
}

// The scale dog-<name>'s 32-unit design is drawn at: its DOG_SIZE over 32.
export function roadScale(name: string): number {
  return DOG_SIZE[name]! / 32;
}

// ---------- road frames ----------

// The design column a zoomed dog grows about: its centre.
export const DOG_AXIS = 16;

// The last row of frame f with an opaque pixel.
export function bottom(f: Frame): number {
  let last = -Infinity;
  f.forEach((row, y) => {
    if (row.some(Boolean)) {
      last = y;
    }
  });
  if (last === -Infinity) {
    throw new RangeError("bottom() of a blank frame");
  }
  return last;
}

// Frame f, drawn at s x zoom ([across, down], or one factor for both), set in the frame side(32, s)
// about DOG_AXIS from row top of f, so the dog fills more (or, zoomed below 1, less) of its frame.
export function zoomed(f: Frame, s: number, zoom: Zoom, top: number): Frame {
  const zx = typeof zoom === "number" ? zoom : zoom[0];
  const n = side(32, s);
  const left = Math.floor(DOG_AXIS * s * zx + 0.5) - Math.floor(DOG_AXIS * s + 0.5);
  const out: Frame = Array.from({ length: n }, () => Array<Colour>(n).fill(null));
  let lost = 0;
  f.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c) {
        if (x - left >= 0 && x - left < n && y - top >= 0 && y - top < n) {
          out[y - top]![x - left] = c;
        } else {
          lost += 1;
        }
      }
    }),
  );
  if (lost) {
    console.log(`zoomed: ${lost} pixels fall outside the ${n}px frame`);
  }
  return out;
}

function sameFrame(a: Frame, b: Frame): boolean {
  return a.length === b.length && a.every((row, y) => row.every((c, x) => c === b[y]![x]));
}

function anyOpaque(rows: Frame): boolean {
  return rows.some((row) => row.some(Boolean));
}

// draw(q) at scale s of the design grid for each pose in a tag: roadScale for the full size, times
// the step for a depth variant. zoom draws the dog that much bigger in the same frame, across and
// down ([zx, zy], or one factor for both; see zoomed), for a small dog that fills more of its frame.
// Where two poses round to the same frame (a 2px lean and a 3px one are both 1px at the smallest
// step), the bigger of the two rounds up instead, so the tag still moves. feet is the explicit planted
// row at this native scale; one offset from the neutral pose seats the whole tag without removing its
// jumps.
export function dogFrames(
  draw: RoadDraw,
  s: number,
  feet: number,
  zoom: Zoom,
  poses: readonly Pose[],
): Frame[] {
  const [zx, zy] = typeof zoom === "number" ? [zoom, zoom] : zoom;
  const p: Scale = zx !== zy ? [s * zx, s * zy] : s * zx;

  const drawn = (pq: Pose, up = false, at: Scale = p, z = zy): Frame => {
    // a zoomed dog moves as far in pixels as it would unzoomed, so its hops and spray stay in the
    // frame
    const q = Object.fromEntries(
      Object.entries(pose(pq)).map(([k, v]) => [k, typeof v === "boolean" ? v : v / z]),
    );
    return small(roadScope, scope, at, draw, snap(q, s * z, up)).outlined();
  };

  // zoomed, the feet of the dog standing square stay on their row at s, or, zoomed taller, go one row
  // lower, onto the frame's spare bottom rows, for headroom, while the frame has a spare row below
  // them
  const isZoomed = zoom !== 1;
  const zoomFeet = isZoomed ? bottom(drawn({})) : 0;
  const top = isZoomed
    ? Math.max(
        zoomFeet - bottom(drawn({}, false, s, 1)) - Number(zy > 1),
        zoomFeet - side(32, s) + 1,
      )
    : 0;

  const frame = (pq: Pose, up = false): Frame => {
    let f = drawn(pq, up);
    if (!isZoomed) {
      return f;
    }
    // a pose whose head would rise past the frame's top gives up its reach, then its rise, a unit at
    // a time, so the frame keeps the whole dog
    const q: Record<string, number> = { ...pq };
    for (const [key, toward] of [
      ["reach", -1],
      ["bob", 1],
    ] as const) {
      while (anyOpaque(f.slice(0, top)) && (q[key] ?? 0) * toward < 0) {
        q[key] = q[key]! + toward;
        f = drawn(q, up);
      }
    }
    return zoomed(f, s, zoom, top);
  };

  let frames = poses.map((q) => frame(q));
  const size = (j: number): number => Object.values(poses[j]!).reduce((a, v) => a + Math.abs(v), 0);
  for (let i = 1; i < frames.length; i++) {
    if (sameFrame(frames[i]!, frames[i - 1]!)) {
      // the first of the two on a tie
      const k = size(i) > size(i - 1) ? i : i - 1;
      frames[k] = frame(poses[k]!, true);
    }
  }
  const dy = feet - bottom(frame({}));
  if (dy) {
    frames = frames.map((f) => {
      const clipped = dy > 0 ? f.slice(f.length - dy) : f.slice(0, -dy);
      if (anyOpaque(clipped)) {
        throw new Error(`${draw.name}: feet alignment would clip a pose at scale ${s}`);
      }
      const blank = Array.from({ length: Math.abs(dy) }, () =>
        Array<Colour>(f[0]!.length).fill(null),
      );
      return dy > 0 ? [...blank, ...f.slice(0, -dy)] : [...f.slice(-dy), ...blank];
    });
  }
  return frames;
}

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  for (const [name, [drawRoad, face]] of Object.entries(DOGS)) {
    const zoom = DOG_ZOOM[name] ?? 1;
    yield [
      `dog-${name}`,
      [...roadTags(name)].map(([tag, poses, ms]): Tag => [
        tag,
        dogFrames(drawRoad, roadScale(name), DOG_FEET[name]!, zoom, poses),
        ms,
      ]),
    ];
    yield [
      `face-dog-${name}`,
      FACE_TAGS.map((m): Tag => [m, [faceFrame(face, m, FACE_SIDE[name]!)], 1000]),
    ];
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
