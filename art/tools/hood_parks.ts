// Draw Cabbagetown's and High Park's own road objects, their hit moments, sounds and card
// illustrations.
//
// Card obstacles, 48x48, laid out on the 32-unit design grid and drawn at road.ts's SCALE (1.5) on a
// mini.ts Mini, as road.ts's animals are; side views facing right, a standing card obstacle is never
// mirrored:
// porch-cat           a white calico cat lounging on its side, its head raised to stare at the
//                     pack: an ochre patch on its haunch and one ear, a dbrown saddle and eye patch,
//                     amber eyes, front paws stretched out ahead. idle (4 frames, 300ms): the tail
//                     tip flicks up, back, a slow blink, down. walk (4 frames, 100ms): a slinking
//                     crawl, the front paws reaching in turn while the body lifts 1px between them
// escaped-capybara    a brown capybara side on: a barrel body on short legs and no tail, the big
//                     square-ended head with a dbrown nose, a small round ear and a high eye. idle
//                     (4 frames, 300ms): a chew, rest, an ear flick, a blink. walk (4 frames,
//                     160ms): a slow step, the diagonal legs swapping and the body bobbing 1px on
//                     the passing frames
//
// Movers, laid out and drawn as the card obstacles are, side views facing right; the game mirrors
// them for a crossing to the left, as it does hazards.ts's squirrel-dash. The hen keeps
// squirrel-dash's tags, frame counts and durations, and the ferrets keep animals.ts's chase-cat's,
// the cat's dart:
// ferrets             96x48, 2 lanes: two ferrets bounding across together nose to tail, a cream
//                     champagne behind and 4px up the road, a sable ahead and nearer: long low
//                     bodies arched along the spine, short dark legs, tapering dark tails, a pale
//                     face crossed by a dark mask band round a glinting eye, and a pink nose.
//                     idle (2 frames, 300ms): standing at the road's edge on all four paws under a
//                     gentle arch, then the sable's head lifting to sniff the air and the
//                     champagne's tail flicking up. run (4 frames, 80ms): the bound, its planted
//                     paws stepping back as far as the dart crosses in a frame: the front paws
//                     land, the hind paws land where the front ones were under the back arched
//                     high, the hind paws push off, and the body flies stretched long; the
//                     champagne two frames behind the sable, so one arches as the other stretches
// hen                 a Riverdale Farm hen got loose, a Rhode Island Red: a plump rust body lit
//                     ochre, a short plum tail cocked up, dbrown wings with a brick band, a red
//                     comb and wattle, an amber beak and yellow legs, a little taller than
//                     squirrel-dash. idle (2 frames, 400ms): standing at the road's edge, neck up,
//                     then the head jerking forward. run (4 frames, 80ms): a flapping scramble, the
//                     neck stretched forward and the body bobbing, the near wing beating up, back,
//                     down and back while the legs run
//
// Minor obstacles, laid out in obstacles.ts's pixels (40 for one lane, 30 rows for a lane-spanning
// one, 60 for the cherry grove) and drawn at obstacles.ts's SCALE (1.2) on a Mini:
// cherry-trees        176x72  3 lanes, High Park's own: its sakura grove, three cherry trees in
//                             blossom in a row on a low stone curb lipped in driftwood, lifted crowns
//                             of pink lobes shaded mauve along their lower right, meeting edge to
//                             edge, over bare dark bark trunks that fork into two limbs showing under
//                             each crown; idle (4 frames, 500ms): the crowns' top lobes sway 1px right
//                             on frame 2, and on frame 3 a petal drifts down between the first two
//                             trunks
// fallen-log          112x36  2 lanes, a fallen oak trunk lying across the path: five long bark
//                             ridges, a sawn end at the right showing growth rings, a splintered
//                             broken end at the left, a branch stub, two moss patches and two
//                             tan-capped mushrooms on its back and four fallen leaves along its foot;
//                             idle (4 frames, 450ms): a leaf on its back stirs 1px on frame 2
// iron-fence-2        112x36  2 lanes: a Victorian wrought-iron fence in front of a bay-and-gable
//                             house, coal iron lit ash, square posts under ball caps at its ends and
//                             each lane's edge, four 2px pickets a lane with spear points through a
//                             top and a bottom rail, on a low driftwood stone curb lit cream; no
//                             outline round the iron, so the gaps stay clear at @50. idle (4 frames,
//                             500ms): a white glint along the top rail on frame 2
// iron-fence-3        176x36  3 lanes: the same fence, a lane wider
// leaf-pile           48x48   1 lane, a raked dome of autumn leaves cel shaded brick, lit crimson and
//                             shaded dbrick, its rim ragged with red, brown and dbrick leaves and a
//                             few more over its face, a red maple leaf on top; no gold or orange, so
//                             it never reads as a tip coin; idle (4 frames, 400ms): the maple leaf
//                             lifts 1px and turns over on frame 2
// little-free-library 48x48   1 lane, a little free library: a turquoise cabinet shaped like a tiny
//                             house under a brick-shingled gable with a cream bargeboard and finial,
//                             its cream-framed glass door showing two shelves of bright book spines,
//                             on a cream post set in a wooden planter of leaves; idle (4 frames,
//                             400ms): a glint crosses the glass, its left half on frame 2 and its
//                             right half on frame 3
// porch-steps         48x48   1 lane, three brick steps with stone treads in a front elevation, tall
//                             white newel posts under ball caps either side, a jack-o'-lantern with a
//                             dark carved face on the top step; idle (4 frames, 400ms): its candle
//                             dims on frame 2 and flares on frame 3
//
// Each road sprite also has <key>@<step> for each depth step in mini.ts's STEPS (from
// shared/depth-steps.json), redrawn at the step with the original's tags, frames and durations and a
// full outline. Road outline (pixel.ts's roadEdge) and road.ts's LIT rim on dark fills, so every one
// holds 3:1 on every road.
//
// Hit moments, 77x77, laid out on hits.ts's 64x64 design and drawn at hits.ts's BURST_SCALE, each
// opening on hits.ts's impact eight-point star in the encounter's colour:
// fx-hit-porch-cat        play (8 frames, 70ms)  a hiss puff with three red claw scratches across
//                                                it, calico fur tufts flying out
//
// Sounds, in sounds.ts's format and rendered by its renderEffects:
// sfx-hit-porch-cat        0.49s  a hiss of pink noise stepping down two bands, then a square "mrr"
//                                 rising into a falling "ow"
//
// Card illustrations, 75x56, composed from the exported sprites as cards.ts composes its own:
// card-porch-cat-stand           Archie standing firm on his leash while the cat swipes up at his
//                                nose, plum-rimmed white claw slashes beside his head
// card-porch-cat-treat           the cat lounging over a treat under rising hearts, Archie sitting
//                                calm beside it
// card-porch-cat-bolt            Archie splashing through a muddy puddle past the lounging cat
//
// Run from the repository root. The cards compose the exported sprites, so the build exports the
// sprites first. A build overwrites the .aseprite sources, so hand edits to them belong in this file
// instead. Shared tooling is in pixel.ts.
import { mkdirSync, writeFileSync } from "node:fs";

import { arc, ellipse, line, polygon } from "@andornaut/art-kit/draw";
import { filledImage, paste, resizeNearest, type Rgba } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as cards from "./cards.ts";
import * as hits from "./hits.ts";
import { small, snap, STEPS } from "./mini.ts";
import * as obstacles from "./obstacles.ts";
import {
  build as buildSprites,
  type Colour,
  depthSettled,
  type Drawable,
  type DrawingScope,
  type Edge,
  edged,
  type Frame,
  Grid,
  K,
  type Point,
  preview as sheet,
  raster,
  rgbPng,
  roadEdge,
  rowScaleOf,
  run,
  scaleOf,
  type Sprite,
  type Tag,
  toImage,
  ZONE_ROADS,
} from "./pixel.ts";
import * as road from "./road.ts";
import { LIT, lit, rim, scope as roadScope, unit } from "./road.ts";
import * as sn from "./scene.ts";
import * as sounds from "./sounds.ts";

const USAGE = `Usage:
  node art/tools/hood_parks.ts preview OUT_DIR   OUT_DIR/road-<hex>.png per zone road (every road
                                                 sprite and depth step), OUT_DIR/hits-<hex>.png for
                                                 the first three, OUT_DIR/cards.png (every
                                                 illustration in a card frame) and the sounds
  node art/tools/hood_parks.ts sounds OUT_DIR    write the two sounds into OUT_DIR only
  node art/tools/hood_parks.ts build             write art/hood-parks/*.aseprite, export the
                                                 sprites to public/art/sprites/, the illustrations
                                                 to public/art/images/ and the sounds to
                                                 public/art/sounds/`;

// Animals are laid out on 32 design units and drawn ANIMAL times bigger (48px); minor obstacles in
// their own pixels, drawn OBSTACLE times bigger.
const ANIMAL = road.SCALE;
const OBSTACLE = obstacles.SCALE;

// The grid every drawing here makes, which mini.ts's small swaps for a Mini while a sprite draws.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = start; v < stop; v += step) {
    out.push(v);
  }
  return out;
}

// draw(q) on a Mini at scale s, q's numeric entries (pose offsets) snapped to whole pixels at s.
function drawn<Q extends object, R>(s: number, draw: (q: Q) => R, q: Q): R {
  const pose: Record<string, number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "number") {
      pose[k] = v;
    }
  }
  return small(roadScope, scope, s, draw, { ...q, ...snap(pose, s) });
}

// A straight bar w thick from a to b.
function bar(g: Drawable, a: Point, b: Point, w: number, c: Colour): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.max(1e-6, Math.hypot(dx, dy));
  const px = ((-dy / n) * w) / 2;
  const py = ((dx / n) * w) / 2;
  const p: readonly Point[] = [
    [a[0] + px, a[1] + py],
    [b[0] + px, b[1] + py],
    [b[0] - px, b[1] - py],
    [a[0] - px, a[1] - py],
  ];
  g.tri(p[0]!, p[1]!, p[2]!, c);
  g.tri(p[0]!, p[2]!, p[3]!, c);
}

// ---------- porch-cat ----------

// The calico's coat: white shaded lgrey, an ochre patch shaded rust, a dbrown patch shaded plum.
const CALICO = {
  coat: "white",
  coatSh: "lgrey",
  dark: "dbrown",
  darkSh: "plum",
  orange: "ochre",
  orangeSh: "rust",
};

interface PorchCatPose {
  bob?: number;
  blink?: boolean;
  far?: number;
  near?: number;
  sway?: number;
  swipe?: boolean;
  tail?: number;
}

// The cat's idle: the tail tip flicks up, rests, the eyes blink slowly, the tip flicks down.
const PORCH_CAT_IDLE: readonly PorchCatPose[] = [{}, { tail: -1 }, { blink: true }, { tail: 1 }];
// Its crawl: a front paw reaches 1px ahead, the body lifts between steps, the other paw reaches.
const PORCH_CAT_WALK: readonly PorchCatPose[] = [
  { near: 1, sway: -1 },
  { bob: -1 },
  { far: 1, sway: 1 },
  { bob: -1 },
];

// A calico lounging on its side, facing right, its head raised and turned to the player. tail moves
// the curled tip up or down (negative is up), blink shuts the eyes to lids, near and far push the
// front paws ahead, bob lifts the body (negative is up), sway swings the tail sideways. swipe, for the
// cards only, raises the near front paw up and out ahead, claws out, and narrows the eyes. Its coat is
// white, so it reads apart from the tuxedo chase-cat and the ginger ambient-cat; the road outline
// holds it on the light roads.
export function porchCat({
  blink = false,
  bob = 0,
  far = 0,
  near = 0,
  sway = 0,
  swipe = false,
  tail = 0,
}: PorchCatPose = {}): Drawable {
  const c = CALICO;
  const g = edged(scope.Grid());
  const b = bob;
  // the tail, rising from the rump in a curve, its dbrown tip curling over and flicking
  bar(g, [5, 25 + b], [2.5 + sway, 20.5 + b], 2, c.coat);
  bar(g, [2.5 + sway, 20.5 + b], [3 + sway, 16 + b], 2, c.coat);
  bar(g, [3 + sway, 16 + b], [5.5 + sway, 13.5 + tail + b], 2, c.dark);
  // far front paw, a shade darker, reaching ahead under the chest
  g.rect(21 + far, 27, 7, 2, c.coatSh);
  // the body lying long, the haunch round at the left
  g.cel(14, 24.5 + b, 10.5, 4.5, c.coat, c.coatSh);
  g.cel(7.5, 23.5 + b, 5, 5, c.coat, c.coatSh);
  // patches: ochre on the haunch, a dbrown saddle over the back
  g.cel(7, 21.5 + b, 3.5, 3, c.orange, c.orangeSh);
  g.cel(14.5, 21.5 + b, 3.8, 2.6, c.dark, c.darkSh);
  // the back paw tucked along the ground
  g.rect(4, 27.5, 6, 1.5, c.coat);
  g.p(9, 28, c.coatSh);
  if (swipe) {
    // near front paw raised up and out ahead of the chest, its claws out
    bar(g, [20, 25 + b], [28, 19 + b], 2.2, c.coat);
    g.cel(28.5, 18.5 + b, 1.6, 1.6, c.coat, c.coatSh);
    for (const dy of [-1.5, 0, 1.5]) {
      g.p(30.5, 18.5 + b + dy, "ink");
    }
  } else {
    // near front paw stretched out along the road ahead of the chest
    g.rect(19 + near, 27.5, 9, 1.5, c.coat);
    g.p(27 + near, 28, c.coatSh);
  }
  // the head, raised and turned to the player: ears, a dbrown patch over the left eye, an ochre
  // right ear
  const hx = 23.5;
  const hy = 16.5 + b;
  g.tri([hx - 5, hy - 1], [hx - 4.5, hy - 7], [hx - 1, hy - 3.5], c.dark);
  g.tri([hx + 5, hy - 1], [hx + 4.5, hy - 7], [hx + 1, hy - 3.5], c.orange);
  g.tri([hx - 4.2, hy - 2], [hx - 4, hy - 5.5], [hx - 2.2, hy - 3.2], "pink");
  g.tri([hx + 4.2, hy - 2], [hx + 4, hy - 5.5], [hx + 2.2, hy - 3.2], "pink");
  g.cel(hx, hy, 5.5, 4.5, c.coat, c.coatSh);
  g.cel(hx - 2.8, hy - 1.6, 2.6, 2.4, c.dark, c.darkSh);
  // amber eyes with slit pupils, or lids shut in a slow blink
  for (const ex of [hx - 3, hx + 1]) {
    if (blink) {
      g.rect(ex, hy, 2, 1, "ink");
    } else if (swipe) {
      g.rect(ex, hy, 2, 1, "amber");
      g.rect(ex + 1, hy - 1, 1, 2, "ink");
    } else {
      g.rect(ex, hy - 1, 2, 2, "amber");
      g.rect(ex + 1, hy - 1, 1, 2, "ink");
    }
  }
  g.rect(hx - 0.5, hy + 1.5, 1, 1, "pink");
  g.p(hx - 1.5, hy + 2.5, "lgrey");
  g.p(hx + 0.5, hy + 2.5, "lgrey");
  return lit(g);
}

// ---------- escaped-capybara ----------

// The capybara's coat: brown, shaded dbrown, lit tan; the far legs and the nose dbrown.
const CAPY = { coat: "brown", far: "dbrown", lit: "tan", nose: "dbrown", shade: "dbrown" };

interface CapybaraPose {
  a?: number;
  b?: number;
  blink?: boolean;
  bob?: number;
  chew?: number;
  ear?: number;
}

// Its idle: a chew (the jaw drops 1px), rest, the ear flicks up, a blink.
const CAPYBARA_IDLE: readonly CapybaraPose[] = [{ chew: 1 }, {}, { ear: -1 }, { blink: true }];
// Its slow step: the near fore and far hind leg forward, passing 1px higher, the other pair forward,
// passing.
const CAPYBARA_WALK: readonly CapybaraPose[] = [
  { a: 1.5, b: -1.5 },
  { bob: -1 },
  { a: -1.5, b: 1.5 },
  { bob: -1 },
];
const CAPYBARA_WALK_MS = 160;

// A capybara side on, facing right: a barrel body on four short legs and the big blunt head, deep and
// square-ended, its nose dbrown. a moves the near foreleg and far hind leg along the ground (positive
// is ahead), b the other pair; a foot swinging ahead lifts 1px. bob lifts the body (negative is up),
// chew drops the jaw, ear lifts the ear (negative is up) and blink shuts the eye. No tail, so it never
// reads as a dog.
export function escapedCapybara({
  a = 0,
  b = 0,
  blink = false,
  bob = 0,
  chew = 0,
  ear = 0,
}: CapybaraPose = {}): Drawable {
  const c = CAPY;
  const g = edged(scope.Grid());
  const o = bob;

  const leg = (x: number, step: number, col: string): void => {
    const up = step > 0 ? 1 : 0;
    g.rect(x + step / 2, 23 + o, 3, 6 - o - up, col);
    g.rect(x + step - 0.5, 28 - up, 3.5, 1, c.far);
  };

  // far legs behind the body
  leg(4.5, b, c.far);
  leg(17.5, a, c.far);
  // the barrel body, its back a long low curve
  g.cel(12.5, 19.5 + o, 11.5, 7, c.coat, c.shade, c.lit);
  // near legs in front
  leg(7.5, a, c.coat);
  leg(20, b, c.coat);
  // the head: deep and long, square at the front, its jaw a straight line
  const hx = 24;
  const hy = 15 + o;
  g.cel(hx, hy, 4.5, 5, c.coat, c.shade, c.lit);
  g.rect(hx, hy - 4, 5.5, 8 + chew, c.coat);
  g.rect(hx + 5.5, hy - 3, 1, 6 + chew, c.coat);
  g.rect(hx, hy + 3 + chew, 6, 1, c.shade);
  // the nose: the blunt front darker, a nostril and the mouth line under it
  g.rect(hx + 4.5, hy - 2.5, 2, 4, c.nose);
  g.p(hx + 5.5, hy - 1.5, "walnut");
  g.rect(hx + 3.5, hy + 1.5 + chew, 3, 1, c.nose);
  // a small round ear high on the back of the head, and the eye high and small
  g.cel(hx - 2, hy - 5 + ear, 1.6, 1.6, c.shade);
  if (blink) {
    g.rect(hx + 1, hy - 2, 2, 1, "walnut");
  } else {
    g.rect(hx + 1, hy - 2.5, 2, 2, "ink");
    g.p(hx + 1, hy - 2.5, "white");
  }
  return lit(g);
}

// ---------- hen ----------

// A Rhode Island Red: rust feathers shaded dbrown and lit ochre, a plum tail shaded walnut, dbrown
// wings with a brick covert band, a red comb and wattle shaded dred, an amber beak and yellow legs
// shaded amber. The tail's shade is walnut, not ink, so road.ts's LIT gives it no cool rim and its
// tips stay solid at the small steps.
const HEN = {
  band: "brick",
  beak: "amber",
  comb: "red",
  combSh: "dred",
  feather: "rust",
  leg: "yellow",
  legSh: "amber",
  lit: "ochre",
  shade: "dbrown",
  tail: "plum",
  tailSh: "walnut",
  wing: "dbrown",
  wingSh: "plum",
};

type Wing = "down" | "fold" | "mid" | "up";

interface HenPose {
  bob?: number;
  far?: Point;
  near?: Point;
  reach?: number;
  wing?: Wing;
}

// Its scramble across the road, one pose per frame, read like hazards.ts's SQUIRREL_RUN: body lift,
// the wing's stroke, and the near and far feet (x, y of the foot's top-left). A design unit is 1.5px
// at full size, so thirds land on whole pixels.
const HEN_RUN: readonly HenPose[] = [
  // gathered
  { bob: 0, far: [13 + 1 / 3, 27 + 1 / 3], near: [16, 27 + 1 / 3], wing: "up" },
  // push off
  { bob: -2 / 3, far: [18 + 2 / 3, 26], near: [11 + 1 / 3, 26 + 2 / 3], wing: "mid" },
  // flight
  { bob: -4 / 3, far: [12, 26], near: [18, 25 + 1 / 3], wing: "down" },
  // lands
  { bob: -2 / 3, far: [12 + 2 / 3, 26 + 2 / 3], near: [18 + 2 / 3, 27 + 1 / 3], wing: "mid" },
];
// Waiting at the road's edge: standing on both feet, the neck up, then the head jerking forward into
// the run's stretch, a whole design unit or more apart so the two frames differ at every depth step.
const HEN_IDLE: readonly HenPose[] = [
  { bob: 0, far: [13 + 1 / 3, 27 + 1 / 3], near: [16, 27 + 1 / 3], reach: -2, wing: "fold" },
  { bob: 0, far: [13 + 1 / 3, 27 + 1 / 3], near: [16, 27 + 1 / 3], reach: 0, wing: "fold" },
];
// The beating wing's tip and back corner, by stroke.
const WING_STROKES: ReadonlyMap<Wing, readonly [tip: Point, back: Point]> = new Map([
  [
    "down",
    [
      [12, 28],
      [8, 25.5],
    ],
  ],
  [
    "mid",
    [
      [5, 18],
      [7, 21.5],
    ],
  ],
  [
    "up",
    [
      [13.5, 8],
      [9, 10.5],
    ],
  ],
]);

// A Riverdale Farm hen got loose, side view facing right, small beside the pack as the squirrel is: a
// plump rust body, a short plum tail cocked up behind, the neck stretched forward to a small head
// under a red comb, a red wattle under an amber beak, on thin yellow legs. bob lifts the body
// (negative is up), wing is the near wing's stroke (fold, up, mid or down), near and far are the feet,
// and reach pulls the head back and up from its running stretch (negative is back).
export function hen({
  bob = 0,
  far = [13 + 1 / 3, 27 + 1 / 3],
  near = [16, 27 + 1 / 3],
  reach = 0,
  wing = "fold",
}: HenPose = {}): Drawable {
  const c = HEN;
  const g = edged(scope.Grid());
  const u = 2 / 3;
  const b = bob;

  const leg = ([fx, fy]: Point, col: string, sh: string): void => {
    // the shank from the hip down to the foot, then three toes forward and one back
    bar(g, [14.8, 24 + b], [fx + u, fy], 2 * u, col);
    g.rect(fx - u, fy, 3, u, col);
    g.rect(fx + 2 * u, fy + u / 2, u, u, sh);
  };

  leg(far, c.legSh, c.legSh);
  // the tail: a short fan of plum feathers cocked up and back from the rump, rounded at the tips
  g.tri([11.5, 21 + b], [7, 11 + b], [13.5, 17 + b], c.tail);
  g.tri([11, 21.5 + b], [5, 13 + b], [9, 13 + b], c.tail);
  g.cel(7.2, 12.4 + b, 1.8, 1.6, c.tail, c.tailSh);
  g.cel(6, 14.2 + b, 1.3, 1.4, c.tail, c.tailSh);
  // the body: a plump egg, its breast full and round at the front
  g.cel(14.5, 21 + b, 5.4, 4.6, c.feather, c.shade, c.lit);
  g.cel(18.2, 20.6 + b, 3.4, 3.9, c.feather, c.shade, c.lit);
  // the neck, stretched forward and up to the head
  const hx = 24.5 + reach / 2;
  const hy = 14.5 + b + reach;
  bar(g, [18.5, 19 + b], [hx - 0.6, hy + 0.6], 3.6, c.feather);
  leg(near, c.leg, c.legSh);
  // the near wing: folded along the side, or beating up and down in its panic, a brick band over its
  // dbrown flight feathers
  if (wing === "fold") {
    g.cel(14, 20.8 + b, 4.2, 2.6, c.wing, c.wingSh);
    g.cel(15, 19.6 + b, 3.2, 1.2, c.band);
  } else {
    const [[tx, ty], [bx, by]] = WING_STROKES.get(wing)!;
    const tip: Point = [tx, ty + b];
    g.tri([11.5, 20.5 + b], [17.5, 19 + b], tip, c.wing);
    g.tri([11.5, 20.5 + b], tip, [bx, by + b], c.wingSh);
    // the leading edge lit brick from the shoulder to the tip
    bar(g, [17, 19 + b], tip, 1, c.band);
    g.cel(15, 19.6 + b, 3, 1.4, c.band);
  }
  // the head: a red comb of three points on top, the beak, the wattle hanging under it, a bright eye
  g.cel(hx - 1.4, hy - 2.2, 0.9, 1, c.comb);
  g.cel(hx - 0.1, hy - 2.6, 0.9, 1.1, c.comb);
  g.cel(hx + 1.1, hy - 2.1, 0.8, 0.9, c.comb);
  g.cel(hx, hy, 2.2, 2, c.feather, c.shade, c.lit);
  g.tri([hx + 1.6, hy - 0.8], [hx + 4, hy + 0.2], [hx + 1.6, hy + 1], c.beak);
  g.cel(hx + 1.6, hy + 2.2, 0.8, 1.1, c.comb, c.combSh);
  g.rect(hx + 0.2, hy - 0.8, 2 * u, 2 * u, "ink");
  g.p(hx + 0.2, hy - 0.8, "white");
  return lit(g);
}

// ---------- ferrets ----------

interface FerretCoat {
  band: string;
  coat: string;
  far: string;
  leg: string;
  patch: string;
  shade: string;
}

// The pair's coats: a sable, dbrown shaded plum with plum legs and tail and a cream face, and a
// champagne, cream shaded tan with clay legs and tail and a white face. Each mask band is its legs'
// colour.
const SABLE: FerretCoat = {
  band: "cream",
  coat: "dbrown",
  far: "walnut",
  leg: "plum",
  patch: "plum",
  shade: "plum",
};
const CHAMPAGNE: FerretCoat = {
  band: "white",
  coat: "cream",
  far: "tan",
  leg: "clay",
  patch: "clay",
  shade: "tan",
};
// The frame, in design units: two ferrets nose to tail across 2 lanes, 96x48 at full size.
const FERRETS_W = 64;

// One frame of a ferret's bound: hip and shoulder (x, y), the back's arch above the line between them,
// the front and hind paws (x, y of the paw's bottom) and the tail's lift.
type Bound = readonly [
  hip: Point,
  shoulder: Point,
  arch: number,
  front: Point,
  hind: Point,
  tail: number,
];

// Each ferret's bound, one per frame, in design units from its rump column and its ground row. A
// design unit is 1.5px at full size, so thirds land on whole pixels. The dart crosses about 10 units
// a frame (3 lanes a second at 80ms), so a planted paw steps back 10 units a frame: the front paws
// land at 23, the hind paws land at 12 where the front ones were, then push off from 2.
const FERRET_BOUND: readonly Bound[] = [
  // front paws land
  [[5, -7 - 1 / 3], [19, -6 - 1 / 3], 2 + 2 / 3, [23, 0], [3, -2 - 2 / 3], 0],
  // hind land, arched
  [[8, -6], [16, -6], 5 + 1 / 3, [13, -2 / 3], [12, 0], -1],
  // hind push off
  [[6, -6 - 2 / 3], [19, -7 - 1 / 3], 3 + 2 / 3, [24, -2], [2, 0], -2 / 3],
  // flight, stretched
  [[5, -8], [20, -8 - 1 / 3], 1 + 1 / 3, [26, -2 - 2 / 3], [0, -2 - 2 / 3], 1 / 3],
];
// Waiting at the road's edge: standing on all four paws under a gentle arch, the near ferret's head
// lifting to sniff the air and the far one's tail flicking up.
const FERRET_STAND: Bound = [[7, -6], [17, -6 - 1 / 3], 3 + 1 / 3, [18, 0], [7, 0], 0];
// The pair: (rump column, ground row) of the far ferret, behind and 4px up the road, its head clear
// of the near one's tail, then the near one.
const FERRET_SPOTS: readonly [far: Point, near: Point] = [
  [4, 26 + 2 / 3],
  [33, 29 + 1 / 3],
];

// One ferret bounding right, side on, its rump at column x0 and its paws on row gy: a long low body
// arched along its spine, short legs, a tapering tail and a small wedge head with round ears, a mask
// band across the face and a pink nose. bound is a FERRET_BOUND entry, sniff lifts the head (in
// design units) and flick the tail.
function ferret(
  g: Drawable,
  x0: number,
  gy: number,
  c: FerretCoat,
  bound: Bound,
  { flick = 0, sniff = 0 }: { flick?: number; sniff?: number } = {},
): void {
  const [[hx0, hy0], [sx0, sy0], arch, [fx0, fy0], [bx0, by0], tail] = bound;
  const [hx, sx, fx, bx] = [x0 + hx0, x0 + sx0, x0 + fx0, x0 + bx0];
  const [hy, sy, fy, by] = [gy + hy0, gy + sy0, gy + fy0, gy + by0];
  const r = 2 + 1 / 3;
  const mx = (hx + sx) / 2;
  const my = (hy + sy) / 2 - 2 * arch;

  const spine = (t: number): Point => [
    (1 - t) ** 2 * hx + 2 * t * (1 - t) * mx + t * t * sx,
    (1 - t) ** 2 * hy + 2 * t * (1 - t) * my + t * t * sy,
  ];

  const leg = (top: Point, paw: Point, col: string): void => {
    bar(g, top, [paw[0], paw[1] - 1], 2, col);
    g.rect(paw[0] - 1, paw[1] - 4 / 3, 2 + 2 / 3, 4 / 3, col);
  };

  // far legs, a step behind the near ones
  leg([sx - 1, sy + 1], [fx - 2, fy], c.far);
  leg([hx + 1, hy + 1], [bx + 2, by], c.far);
  // the tail, tapering back from the rump
  const tx = hx - 8;
  const ty = hy + 1 + tail + flick;
  bar(g, [hx - 1, hy - 0.5], [tx + 4, ty - 0.5], 3, c.leg);
  bar(g, [tx + 4, ty - 0.5], [tx, ty], 2, c.leg);
  // the body along the spine: shade, then the coat a little up and left, so the shade is a crescent
  // below
  const steps = range(0, 13).map((k) => k / 12);
  for (const t of steps) {
    const [x, y] = spine(t);
    g.ell(x, y, r, r, c.shade);
  }
  for (const t of steps) {
    const [x, y] = spine(t);
    g.ell(x - 1 / 3, y - 2 / 3, r - 2 / 3, r - 2 / 3, c.coat);
  }
  // near legs
  leg([sx + 1 / 3, sy + 1], [fx, fy], c.leg);
  leg([hx + 1, hy + 1], [bx, by], c.leg);
  // the head, bobbing half as far as the shoulder so it stays level through the bound: a wedge
  // reaching forward, a round ear behind, a pale face crossed by the dark mask band round a glinting
  // eye, the pink nose at the tip
  const ex = sx + 4 + 1 / 3;
  const ey = (sy + gy - 7 - 1 / 3) / 2 - 1 - sniff;
  g.ell(ex - 2 - 1 / 3, ey - 2, 1 + 2 / 3, 1 + 2 / 3, c.shade);
  g.ell(ex, ey, 3, 2 + 2 / 3, c.coat);
  g.tri([ex + 1, ey - 2 - 1 / 3], [ex + 5 + 1 / 3, ey + 1], [ex + 1, ey + 2 + 1 / 3], c.coat);
  g.tri([ex - 2, ey - 2 - 1 / 3], [ex + 5 + 1 / 3, ey + 1], [ex - 2, ey + 2 + 1 / 3], c.band);
  g.ell(ex + 1 / 3, ey, 2 + 1 / 3, 1, c.patch);
  g.rect(ex + 1 / 3, ey - 2 / 3, 4 / 3, 4 / 3, "ink");
  g.p(ex + 1 / 3, ey - 2 / 3, "white");
  g.rect(ex + 4, ey + 1 / 3, 4 / 3, 4 / 3, "pink");
}

interface FerretsPose {
  far?: Bound;
  near?: Bound;
  sniff?: number;
}

// The eyes keep no rim, so a 1px eye at the small steps stays dark.
const FERRET_RIMS = Object.fromEntries(Object.entries(LIT).filter(([c]) => c !== "ink"));

// A pair of ferrets bounding across the road together, side view facing right: a champagne behind and
// up the road, a sable ahead and nearer, nose to tail, so the pair reads as one. near and far are each
// one's FERRET_BOUND pose; sniff lifts the sable's head and flicks the champagne's tail.
export function ferrets({
  far = FERRET_STAND,
  near = FERRET_STAND,
  sniff = 0,
}: FerretsPose = {}): Drawable {
  const g = edged(scope.Grid(FERRETS_W, 32), (c) => roadEdge(c === K.white ? K.cream! : c));
  const [[fx, fy], [nx, ny]] = FERRET_SPOTS;
  ferret(g, fx, fy, CHAMPAGNE, far, { flick: -sniff });
  ferret(g, nx, ny, SABLE, near, { sniff });
  rim(g, FERRET_RIMS);
  return g;
}

// The run, 4 frames, the far ferret two frames behind the near one, so one arches while the other
// stretches; and the stand at the road's edge, 2 frames.
const FERRETS_RUN: readonly FerretsPose[] = range(0, 4).map((k) => ({
  far: FERRET_BOUND.at(k - 2)!,
  near: FERRET_BOUND[k]!,
}));
const FERRETS_IDLE: readonly FerretsPose[] = [{}, { sniff: 1 + 1 / 3 }];

// ---------- minor obstacles ----------

const { ROW, SIZE } = obstacles;

// The fallen log's leaves: [fill, shade], lit, middle and shaded.
const PILE_COLOURS: readonly (readonly [string, string])[] = [
  ["gold", "amber"],
  ["amber", "ochre"],
  ["rust", "dbrick"],
];
// The heap's leaves: [fill, shade] on its lit upper left, its brown middle and its dark lower right.
const HEAP_COLOURS: readonly (readonly [string, string])[] = [
  ["red", "dred"],
  ["brown", "dbrown"],
  ["dbrick", "walnut"],
];
// The heap's dome under its leaves: base, lower-right shade and upper-left light.
const HEAP_CEL = ["brick", "dbrick", "dred"] as const;
// The rows of leaves along the heap's rim, RIM_STEP apart, and the ones over its face: [left column,
// top row, tone].
const RIM_STEP = 3;
type Leaf = readonly [x: number, y: number, tone: number];
const FACE_LEAVES: readonly Leaf[] = [
  [11, 29, 0],
  [17, 34, 1],
  [21, 28, 1],
  [27, 33, 2],
];
// The heap: a dome, centre (PILE_X, PILE_Y), radii PILE_R, laid out in leaves LEAF wide.
const PILE_X = 20;
const PILE_Y = 39;
const PILE_R: Point = [18, 17];
const LEAF = 7;
// The red maple leaf on top, character maps in drawn pixels (r TTC red, d its dred shade and stem): a
// top lobe, two side lobes and two small lower ones at full size and the larger steps, three points
// below them.
const MAPLE: readonly string[] = [
  "....r....",
  "...rrr...",
  ".r.rrr.r.",
  ".rrrrrrr.",
  "rrrrrrrrd",
  ".rrrrrdd.",
  "..rr.dd..",
  "....d....",
];
const MAPLE_SMALL: readonly string[] = ["..r..", "r.r.r", "rrrrd", ".rdd.", "..d.."];
// The pile's idle: rest, rest, the maple leaf lifted 1px and turned over, rest.
const LEAF_PILE_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 400];

// A LEAF-wide leaf lying flat, pointed at both ends, 4 rows deep: its upper half fill, its lower
// shade.
function lens(g: Drawable, x: number, y: number, fill: string, shade: string): void {
  g.tri([x, y + 2], [x + LEAF / 2, y], [x + LEAF, y + 2], fill);
  g.tri([x, y + 2], [x + LEAF / 2, y + 4], [x + LEAF, y + 2], shade);
}

// The maple leaf centred on layout column cx with its stem's foot on layout row bottom, pixel for
// pixel in drawn pixels so its points stay sharp at every step, lifted lift drawn pixels and mirrored
// when flip.
function maple(g: Drawable, cx: number, bottom: number, lift: number, flip: boolean): void {
  const px = raster(g);
  const s = scaleOf(g);
  const leaf = s >= 0.9 ? MAPLE : MAPLE_SMALL;
  const x0 = Math.round(cx * s - leaf[0]!.length / 2);
  const y0 = Math.round(bottom * s) - leaf.length - lift;
  leaf.forEach((row, j) => {
    const chars = flip ? [...row].reverse() : [...row];
    chars.forEach((ch, i) => {
      if (ch !== ".") {
        px.p(x0 + i, y0 + j, ch === "r" ? "ttc" : "dred");
      }
    });
  });
}

// [x, y, colour index into HEAP_COLOURS] for every leaf drawn on the heap, back rows first: the two
// at each row's ends, their tips on the dome's rim so it is ragged all round, then a few over its
// face, each in the tone of the band it lies on.
function pileLeaves(): Leaf[] {
  const out: Leaf[] = [];
  const [rx, ry] = PILE_R;
  for (let y = PILE_Y - ry + 1; y < PILE_Y - 3; y += RIM_STEP) {
    const half = rx * Math.sqrt(Math.max(0, 1 - ((y + 2 - PILE_Y) / ry) ** 2));
    if (2 * half < 2 * LEAF) {
      out.push([PILE_X - LEAF / 2, y, 0]);
      continue;
    }
    out.push([PILE_X - half, y, 0], [PILE_X + half - LEAF, y, y > PILE_Y - ry / 2 ? 2 : 1]);
  }
  return [...out, ...FACE_LEAVES];
}

// A raked heap of autumn leaves in reds, crimson and browns, with no gold or orange so it never reads
// as a tip coin: a low dome cel shaded brick, lit crimson on its upper left and shaded dbrick on its
// lower right, a few big leaves along its rim standing proud so its edge is ragged with their tips
// (red down the lit left side, brown on the upper right, dbrick on the lower right) and a few more
// over its face, each lit on its upper half; a red maple leaf lies on top, its edge lit red rather
// than pink so it never reads as a heart. lift raises the maple leaf 1 drawn pixel and turns it over.
export function leafPile(lift = 0): Drawable {
  const g = edged(scope.Grid(SIZE, SIZE));
  const [rx, ry] = PILE_R;
  g.cel(PILE_X, PILE_Y, rx - 2, ry - 2, ...HEAP_CEL);
  for (const [x, y, k] of pileLeaves()) {
    lens(g, x, y, ...HEAP_COLOURS[k]!);
  }
  maple(g, 20, 23.7, lift, Boolean(lift));
  return lit(g, { dred: ["red", null] });
}

// The steps' idle: rest, rest, the candle guttering low, then flaring.
const PORCH_STEPS_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 2], 400];
// The steps, bottom up: [tread row, left, right]. A front elevation, so each is as wide as the next
// but for a 1px setback each side.
const STEPS_ROWS: readonly (readonly [top: number, x0: number, x1: number])[] = [
  [30, 5, 35],
  [23, 6, 34],
  [16, 7, 33],
];
// Brick courses: the mortar rows down a riser and the joints' spacing along a course.
const COURSE = 2;
const BRICK = 5;

// A short flight of three brick steps up to a porch, a front elevation, so the flight never tapers
// like a tiered cake: each a lit stone tread with a dstone nosing over a red brick riser laid in
// dbrick courses (below obstacles.ts's TEXTURE_MIN, one course line and no joints); tall white newel
// posts under ball caps either side. A jack-o'-lantern sits on the top step, its eyes and grin cut
// dark with a candle glowing amber inside; flicker 1 dims the glow to orange, 2 flares it yellow.
export function porchSteps(flicker = 0): Drawable {
  const g = edged(scope.Grid(SIZE, SIZE));
  const fine = scaleOf(g) >= obstacles.TEXTURE_MIN;
  for (const [top, x0, x1] of STEPS_ROWS) {
    const bottom = top + (top === STEPS_ROWS[0]![0] ? 8 : 7);
    g.rect(x0, top + 3, x1 - x0, bottom - top - 3, "brick");
    for (const y of fine ? range(top + 3 + COURSE, bottom, COURSE + 1) : [top + 5]) {
      g.rect(x0, y, x1 - x0, 1, "dbrick");
    }
    for (const y of fine ? range(top + 3, bottom, COURSE + 1) : []) {
      for (const x of range(x0 + 2 + (Math.floor(y / (COURSE + 1)) % 2) * 2, x1 - 2, BRICK)) {
        g.rect(x, y, 1, COURSE, "dbrick");
      }
    }
    g.rect(x1 - 2, top + 3, 2, bottom - top - 3, "dbrick");
    g.rect(x0 - 1, top, x1 - x0 + 2, 3, "stone");
    g.rect(x0 - 1, top, x1 - x0 + 2, 1, "lgrey");
    g.rect(x0 - 1, top + 2, x1 - x0 + 2, 1, "dstone");
    g.rect(x1 - 1, top, 2, 2, "dstone");
  }
  // the newel posts either side of the flight, white with ball caps, as tall as the top step
  for (const x of [1, 35]) {
    g.rect(x, 15, 4, 22, "white");
    g.rect(x + 3, 15, 1, 22, "lgrey");
    g.rect(x - 1, 13, 6, 2, "white");
    g.rect(x - 1, 14, 6, 1, "lgrey");
    g.cel(x + 2, 10.5, 2.5, 2.5, "white", "lgrey");
  }
  // the jack-o'-lantern on the top step: eyes and a grin cut dark, the candle's glow inside them
  g.cel(20, 12.5, 5, 3.5, "orange", "rust", "amber");
  g.rect(19.5, 7.5, 1.5, 2, "olive");
  const glow = ["amber", "orange", "yellow"][flicker]!;
  for (const x of [17, 21]) {
    g.rect(x, 10.5, 2, 2, "plum");
    g.rect(x + 0.5, 11.5, 1, 1, glow);
  }
  g.rect(17.5, 13.5, 5, 1.5, "plum");
  g.rect(18.5, 13.5, 3, 1, glow);
  return lit(g);
}

// The library's idle: rest, rest, a glint crossing the glass door's left half, then its right half.
const LIBRARY_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 2], 400];
// The book spines on each shelf, left to right: [colour, top row]. Each is 2 layout pixels wide. Four
// colours in turn; below obstacles.ts's TEXTURE_MIN each pair of spines is drawn as one, so no spine
// is 1px.
type Book = readonly [colour: string, top: number];
const UPPER_BOOKS: readonly Book[] = [
  ["ttc", 15],
  ["gold", 16],
  ["sky", 15],
  ["green", 16],
  ["ttc", 15],
  ["gold", 16],
  ["sky", 15],
  ["green", 16],
  ["ttc", 15],
];
const LOWER_BOOKS: readonly Book[] = [
  ["sky", 21],
  ["green", 20],
  ["ttc", 21],
  ["gold", 20],
  ["sky", 21],
  ["green", 20],
  ["ttc", 21],
  ["gold", 20],
  ["sky", 21],
];

// A little free library: a turquoise cabinet shaped like a tiny house, a front elevation, its pitched
// roof's gable edged in brick shingles over a cream bargeboard, an open book painted in the gable, a
// finial at the peak. Its cream-framed glass door shows two shelves of book spines in four bright
// colours on a dark teal back, a gold knob at its right. It stands on a cream post with brackets under
// its sill, the post set in a small wooden planter of leaves. glint 1 and 2 run a white glint across
// the glass, left then right, 2px wide down to obstacles.ts's TEXTURE_MIN; at rest a short glint sits
// in its top left corner.
export function littleFreeLibrary(glint = 0): Drawable {
  const g = edged(scope.Grid(SIZE, SIZE));
  // the planter: a wooden box lit tan along its cap, shaded down its right, leaves heaped round the
  // post
  g.rect(12, 32, 16, 6, "brown");
  g.rect(12, 31, 16, 2, "tan");
  g.rect(26, 33, 2, 5, "dbrown");
  g.rect(13, 35, 13, 1, "dbrown");
  for (const [x, y] of [
    [14.5, 30.5],
    [25, 30.5],
    [17, 29.8],
    [23, 29.8],
  ] as const) {
    g.cel(x, y, 2.4, 1.8, "green", "dgreen");
  }
  // the post, cream shaded tan at its right, and the brackets under the sill
  g.rect(18, 25, 4, 7, "cream");
  g.rect(21, 25, 1, 7, "tan");
  g.tri([15, 25], [18, 25], [18, 28], "cream");
  g.tri([22, 25], [25, 25], [22, 28], "tan");
  // the cabinet: turquoise, its right side in shade, on a cream sill
  g.rect(8, 12, 24, 13, "turquoise");
  g.rect(29, 12, 3, 13, "dturq");
  g.rect(7, 24, 26, 2, "cream");
  g.rect(7, 25, 26, 1, "tan");
  // the door: a cream frame round the glass, the books on two shelves inside on a dark teal back
  g.rect(10, 13, 19, 11, "cream");
  g.rect(11, 14, 17, 9, "teal");
  const fine = scaleOf(g) >= obstacles.TEXTURE_MIN;
  for (const books of [UPPER_BOOKS, LOWER_BOOKS]) {
    books.forEach((_book, i) => {
      const x = 11 + i * 2;
      const bottom = books === UPPER_BOOKS ? 19 : 23;
      const [c, top] = books[fine ? i : Math.floor(i / 2) * 2]!;
      g.rect(x, top, Math.min(2, 28 - x), bottom - top, c);
    });
  }
  g.rect(11, 19, 17, 1, "brown");
  g.rect(27, 17, 1, 2, "gold");
  // the glint on the glass: a short diagonal at rest in the top left corner, crossing the door when it
  // runs
  const u = unit(g)[0];
  const x0 = [12, 15, 21][glint]!;
  for (let k = 0; k < (glint ? 4 : 2); k++) {
    for (const w of glint && scaleOf(g) >= obstacles.TEXTURE_MIN ? [0, u] : [0]) {
      g.rect(x0 + k * u + w, 18 - k * u - (glint ? 1 : 2), u, u, "white");
    }
  }
  // the roof: a gable edged in brick shingles over a cream bargeboard, lit along its left slope
  g.tri([4, 13], [20, 2], [36, 13], "brick");
  g.tri([20, 2], [36, 13], [20, 13], "dbrick");
  g.tri([9, 12.5], [20, 5], [31, 12.5], "cream");
  g.tri([11, 12.5], [20, 6.5], [29, 12.5], "turquoise");
  g.tri([20, 6.5], [29, 12.5], [20, 12.5], "dturq");
  for (let k = 0; k < 4; k++) {
    const t = (k + 0.5) / 4;
    g.rect(4 + 16 * t - 0.5, 13 - 11 * t + 1, 1, 1, "dbrick");
    g.rect(36 - 16 * t, 13 - 11 * t + 1, 1, 1, "walnut");
  }
  g.rect(4, 12, 32, 1, "dbrick");
  // an open book painted cream in the gable, and the finial at the peak
  g.tri([16.5, 9.5], [20, 10.5], [20, 12], "cream");
  g.tri([23.5, 9.5], [20, 10.5], [20, 12], "cream");
  g.rect(19.5, 10.5, 1, 1.5, "tan");
  g.rect(19, 1, 2, 2, "cream");
  return lit(g, { brick: ["clay", null], dbrick: ["brick", null], dturq: ["turquoise", null] });
}

// The log's idle: rest, rest, the leaf on its back stirred 1px right and up, rest.
const FALLEN_LOG_IDLE: readonly [readonly Point[], number] = [
  [
    [0, 0],
    [0, 0],
    [1, -1],
    [0, 0],
  ],
  450,
];
// The trunk, in layout pixels at full size: its top and bottom rows and its broken end's column.
const LOG_TOP = 11;
const LOG_BOTTOM = 27;
const LOG_LEFT = 9;
// The bark's ridges along the trunk: [row, from, to] as fractions of the trunk's length, lit brown on
// its upper half and dbrown below.
const RIDGES: readonly (readonly [number, number, number])[] = [
  [14, 0.08, 0.45],
  [14, 0.6, 0.92],
  [18, 0.25, 0.7],
  [22, 0.05, 0.35],
  [22, 0.55, 0.9],
];
// The fallen leaves drifted in pairs against its foot: [column as a fraction of the frame's width less
// 1.5px margin each side, row, colour index].
const LOG_LEAVES: readonly Leaf[] = [
  [0.05, 26, 0],
  [0.36, 26, 1],
  [0.66, 26, 0],
  [0.94, 26, 1],
];

const FALLEN_LOG_WIDTH = obstacles.span(2);

// A fallen oak trunk lying across the road, side on: rough bark with ridges running along it, lit
// brown above and dbrown below, shaded walnut along its underside; a sawn end at the right showing
// cream wood in tan growth rings round a brown heart, and a broken end at the left, pale splinters
// jutting out of the bark. A broken branch stub rises from its back at the left, its snapped end pale;
// moss grows over its back and down its side, two tan-capped mushrooms stand on it and fallen leaves
// lie along its foot. leaf offsets the amber leaf on its back.
export function fallenLog(leaf: Point = [0, 0], w = FALLEN_LOG_WIDTH): Drawable {
  const g = edged(scope.Grid(w, ROW));
  const [ux, uy] = unit(g);
  const cut = w - 8;
  const rx = 5.5;
  const ry = (LOG_BOTTOM - LOG_TOP) / 2;
  const cy = (LOG_TOP + LOG_BOTTOM) / 2;
  // the branch stub, behind the trunk: a short limb rising up and left, its snapped end pale
  bar(g, [30, LOG_TOP + 2], [24, 3], 5, "bark");
  bar(g, [31.5, LOG_TOP + 2], [25.5, 3], 1.5, "walnut");
  g.cel(24.2, 3.4, 2.4, 1.4, "tan", null, "cream");
  // the trunk: bark, lit along its back and shaded walnut along its underside
  const length = cut - LOG_LEFT;
  g.rect(LOG_LEFT, LOG_TOP, length, LOG_BOTTOM - LOG_TOP, "bark");
  g.rect(LOG_LEFT, LOG_TOP, length, 1.5, "dbrown");
  g.rect(LOG_LEFT, LOG_BOTTOM - 4, length, 4, "walnut");
  for (const [y, a, b] of RIDGES) {
    const x0 = LOG_LEFT + a * length;
    const x1 = LOG_LEFT + b * length;
    g.rect(x0, y, x1 - x0, 1, y < cy ? "brown" : "dbrown");
    g.rect(x0 + 1, y + 1, x1 - x0 - 1, 1, "walnut");
  }
  // the broken end at the left: pale splinters jutting out of the bark, shaded tan below
  const splinters: readonly (readonly [Point, Point, Point])[] = [
    [
      [LOG_LEFT + 1, LOG_TOP + 1],
      [LOG_LEFT + 1, LOG_TOP + 7],
      [2, LOG_TOP + 3],
    ],
    [
      [LOG_LEFT + 1, LOG_TOP + 5],
      [LOG_LEFT + 1, LOG_TOP + 12],
      [4, LOG_TOP + 9],
    ],
    [
      [LOG_LEFT + 1, LOG_TOP + 10],
      [LOG_LEFT + 1, LOG_BOTTOM - 1],
      [1, LOG_BOTTOM - 3],
    ],
  ];
  for (const [a, b, tip] of splinters) {
    g.tri(a, b, tip, "cream");
    g.tri([a[0], (a[1] + b[1]) / 2], b, tip, "tan");
  }
  g.rect(LOG_LEFT, LOG_TOP, 1.5, LOG_BOTTOM - LOG_TOP, "dbrown");
  // the sawn end at the right: the bark's rim round cream sapwood, tan growth rings and a brown heart
  g.ell(cut, cy, rx, ry, "bark");
  g.ell(cut, cy, rx - 1, ry - 1, "cream");
  for (const k of [0.72, 0.45]) {
    g.ell(cut, cy, (rx - 1) * k, (ry - 1) * k, "tan");
    g.ell(cut, cy, (rx - 1) * k - 0.8, (ry - 1) * k - 0.8, "cream");
  }
  g.ell(cut, cy, 1.2, 1.6, "brown");
  // moss over its back and down its side, lit lime on top
  for (const [x, y, mx, my] of [
    [40, LOG_TOP + 0.5, 7, 2],
    [66, LOG_TOP + 0.5, 5, 1.8],
  ] as const) {
    g.cel(x, y, mx, my, "moss", "olive", "lime");
  }
  // two mushrooms on its back: cream stems under tan caps, lit cream and shaded ochre
  for (const [x, h, capX, capY] of [
    [51, 3, 3.2, 1.8],
    [56.5, 2, 2.4, 1.4],
  ] as const) {
    g.rect(x - 0.75, LOG_TOP - h, 1.5, h + 1, "cream");
    g.cel(x, LOG_TOP - h, capX, capY, "tan", "ochre", "cream");
  }
  // the leaf on its back, stirred by leaf
  const x = Math.round(w * 0.8) + leaf[0] * ux;
  const y = LOG_TOP - 1 + leaf[1] * uy;
  g.rect(x, y, 4, 1, "amber");
  g.rect(x + 1, y + 1, 4, 1, "orange");
  g.p(x + 5, y + 1, "rust");
  // the fallen leaves along its foot
  for (const [f, fy, k] of LOG_LEAVES) {
    lens(g, 1.5 + f * (w - LEAF - 3), fy, ...PILE_COLOURS[k]!);
  }
  return lit(g, { bark: ["clay", null], walnut: ["bark", null] });
}

// The grove's idle: rest, rest, the crowns' tops swayed 1px right, then a petal drifting down.
const CHERRY_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 2], 500];
// The grove's height and the curb's top row, in layout pixels: taller than a lane-spanning obstacle's
// ROW, so each tree stands on a bare trunk under a lifted crown, drawn at obstacles.ts's SCALE to
// exactly 72 rows, so each depth step is its scale of the full size.
const GROVE_H = 60;
const CURB_TOP = 56;
// The drifting petal, in layout pixels at full size: its top left, under the crowns between the first
// two trunks.
const PETAL: Point = [46, 38];
// Each crown's lobes, the lowest row first, as [dx, cy, rx, ry, sways] from its tree's centre column,
// in layout pixels at full size: two low lobes either side of the trunk, leaving a notch under the
// crown where its limbs show, two at the outer edges, two across the middle and three on top, the
// ones on top swaying in the idle.
const CROWN: readonly (readonly [
  dx: number,
  cy: number,
  rx: number,
  ry: number,
  sways: boolean,
])[] = [
  [-16, 27, 8.5, 5, false],
  [16, 27.5, 8.5, 4.5, false],
  [-18, 19, 6.5, 6, false],
  [18, 19.5, 6.5, 6, false],
  [-7, 16.5, 10, 7, false],
  [8, 17, 9.5, 6.5, false],
  [-11, 10, 9, 6.5, true],
  [11, 10.5, 8.5, 6, true],
  [0, 6.5, 9.5, 6, true],
];
// How far each lobe's pink sits up and left inside its mauve, leaving a crescent at least 2 drawn
// pixels deep along its lower right.
const CLUSTER_SHADE: Point = [0.8, 1.2];
// How far every lobe stays inside the frame's sides, in layout pixels: an end tree's outer lobes are
// narrowed from their outer side to it, so the crown's outline stays in the frame with a clear column
// outside it at every depth step.
const CROWN_MARGIN = 3;
// Where each trunk's bare part starts, under the crown's middle lobes, and its two limbs, as [from,
// to, width] from the trunk's centre column, the second mirrored on the middle tree.
const TRUNK_TOP = 24;
const LIMBS: readonly (readonly [from: Point, to: Point, width: number])[] = [
  [[0, 33], [-11, 20], 3.5],
  [[0, 31], [10, 21], 3],
];

const CHERRY_TREES_WIDTH = obstacles.span(3);

// High Park's cherry grove in blossom, three cherry trees in a row across the road on a low stone
// curb, front elevation: each a lifted crown of pink lobes, every lobe shaded mauve along its lower
// right so the blossom clusters read, the middle tree mirrored, over a bare dark bark trunk flared at
// its foot and shaded walnut down its right, forking into two limbs that show in a notch under the
// crown; the crowns meet edge to edge, so the grove spans its lanes. The curb is stone lipped in
// driftwood and shaded dstone along its foot. pose 1 sways each crown's top lobes 1 drawn pixel
// right, and pose 2 shows one petal, 2 drawn pixels square, drifting down between the first two
// trunks.
export function cherryTrees(pose = 0, w = CHERRY_TREES_WIDTH): Drawable {
  const g = edged(scope.Grid(w, GROVE_H));
  const [ux, uy] = unit(g);
  const sway = pose === 1;
  const centres = range(0, 3).map((k) => (w * (2 * k + 1)) / 6);
  // the trunks: bare from the curb to the crown, flared at the foot, forking into two limbs under the
  // crown
  centres.forEach((cx, k) => {
    const m = k === 1 ? -1 : 1;
    g.rect(cx - 2.5, TRUNK_TOP, 5, CURB_TOP - TRUNK_TOP, "bark");
    g.rect(cx + 1, TRUNK_TOP, 1.5, CURB_TOP - TRUNK_TOP, "walnut");
    g.tri([cx - 5, CURB_TOP], [cx + 5, CURB_TOP], [cx, CURB_TOP - 6], "bark");
    for (const [[x0, y0], [x1, y1], t] of LIMBS) {
      bar(g, [cx + m * x0, y0], [cx + m * x1, y1], t, "bark");
    }
  });
  // the crowns, lobe by lobe from the lowest row up, so each lobe's mauve underside lies on the pink
  // below it
  centres.forEach((cx, k) => {
    for (const [dx, cy, crownRx, ry, sways] of CROWN) {
      const x0 = cx + (k === 1 ? -dx : dx) + (sway && sways ? ux : 0);
      const left = Math.max(x0 - crownRx, CROWN_MARGIN);
      const right = Math.min(x0 + crownRx, w - CROWN_MARGIN);
      const x = (left + right) / 2;
      const rx = (right - left) / 2;
      g.cel(x, cy, rx, ry, "mauve");
      g.cel(
        x - CLUSTER_SHADE[0],
        cy - CLUSTER_SHADE[1],
        rx - CLUSTER_SHADE[0],
        ry - CLUSTER_SHADE[1],
        "pink",
      );
    }
  });
  // the curb: stone lipped in driftwood, shaded dstone along its foot
  g.rect(1, CURB_TOP, w - 2, GROVE_H - CURB_TOP, "stone");
  g.rect(0.5, CURB_TOP, w - 1, 1.5, "driftwood");
  g.rect(1, GROVE_H - 1.5, w - 2, 1.5, "dstone");
  if (pose === 2) {
    g.rect(PETAL[0], PETAL[1], 2 * ux, 2 * uy, "pink");
  }
  return lit(g, { bark: ["clay", null], stone: ["driftwood", null], walnut: ["bark", null] });
}

// The fence's idle: rest, rest, a glint along the top rail, rest.
const IRON_FENCE_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 500];
// The iron, by K name: a coal body, ash lit on its upper and left edges, ink shading the posts' right
// sides.
const IRON = ["coal", "ash", "ink"] as const;
// Pickets in each section, between two posts, one section a lane.
const PICKETS = 4;

const UNEDGED = new Set([...IRON, "white"].map((n) => K[n]!));

// roadEdge, but no outline round the iron or its glint: coal is as dark as its outline would be, and
// a line either side of each 2px picket would close the gaps between them at the small steps.
function fenceEdge(c: string): string | null {
  return UNEDGED.has(c) ? null : roadEdge(c);
}

// A Victorian wrought-iron fence in front elevation across lanes lanes, laid out in obstacles.ts's
// pixels (obstacles.ts's span(lanes) by ROW) and drawn in drawn pixels so every bar keeps its width at
// every step: a square post under a ball cap at each end and at each lane's edge, and between each
// pair PICKETS pickets, 2px wide with even gaps, rising through a top and a bottom rail to spear
// points (a 2px tip flaring to 4px and 6px as far as the gaps keep 2px between points; plain 2px tips
// at the far steps), all on a low curb of pale driftwood stone lit cream along its top. The iron is
// coal lit ash along the rails' and the posts' upper and left edges, the posts shaded ink down their
// right. glint 1 runs a white glint along the top rail's lit edge in the first section.
export function ironFence(lanes: number, glint = 0): Drawable {
  const w = obstacles.span(lanes);
  const g = edged(scope.Grid(w, ROW), fenceEdge as Edge);
  const px = raster(g);
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const toY = (v: number): number => Math.floor(v * sy + 0.5);

  const big = s >= 0.85;
  const [curb, railTop, railLow, tip] = [toY(25), toY(7), toY(21), toY(3)];
  const ball = big ? 4 : 2;
  const plate = big ? 2 : 1;
  const postW = Math.max(4, Math.floor(5 * s + 0.5));
  // the curb: driftwood stone, lit cream along its top and shaded stone along its foot
  px.rect(1, curb, px.w - 2, px.h - curb, "driftwood");
  px.rect(1, curb, px.w - 2, 1, "cream");
  px.rect(1, px.h - 1, px.w - 2, 1, "stone");
  // the posts: one at each end and one at each lane's edge, their left edges
  const posts = [
    2,
    ...range(1, lanes).map((k) => Math.round((px.w * k) / lanes - postW / 2)),
    px.w - 2 - postW,
  ];
  // the pickets in each section, one even gap in every section (the narrowest's), the spare pixels
  // split between a section's ends
  const sections = posts.slice(1).map((b, i) => [posts[i]! + postW, b] as const);
  const gap = Math.min(
    ...sections.map(([x0, x1]) => Math.floor((x1 - x0 - 2 * PICKETS) / (PICKETS + 1))),
  );
  // the spear point: a 2px tip flaring 1px a row each side, as far as the gaps keep 2px between points
  const head = gap >= 6 ? [0, 1, 2] : gap >= 4 ? [0, 1] : [0];
  for (const [x0, x1] of sections) {
    const spare = x1 - x0 - 2 * PICKETS - gap * (PICKETS + 1);
    for (let i = 0; i < PICKETS; i++) {
      const x = x0 + Math.floor(spare / 2) + gap + i * (gap + 2);
      px.rect(x, tip, 2, curb - tip, "coal");
      head.forEach((half, k) => {
        px.rect(x - half, tip + k, 2 + 2 * half, 1, "coal");
      });
    }
  }
  // the rails between the end posts, lit along their tops; the glint runs along the first section's
  for (const y of [railTop, railLow]) {
    px.rect(posts[0]!, y, posts.at(-1)! - posts[0]!, 2, "coal");
    px.rect(posts[0]!, y, posts.at(-1)! - posts[0]!, 1, "ash");
  }
  if (glint) {
    const n = big ? 4 : 3;
    px.rect(posts[0]! + postW + (big ? 4 : 2), railTop, n, 1, "white");
  }
  // the posts, each under a cap plate and a ball, lit down their left and shaded down their right
  for (const x of posts) {
    px.rect(x, ball + plate, postW, curb - ball - plate, "coal");
    px.rect(x, ball + plate, 1, curb - ball - plate, "ash");
    px.rect(x + postW - 1, ball + plate, 1, curb - ball - plate, "ink");
    px.rect(x - 1, ball, postW + 2, plate, "coal");
    px.rect(x - 1, ball, postW + 2, 1, "ash");
    const bx = x + Math.floor((postW - ball) / 2);
    px.rect(bx, 0, ball, ball, "coal");
    if (big) {
      for (const [cx, cy] of [
        [0, 0],
        [ball - 1, 0],
        [0, ball - 1],
        [ball - 1, ball - 1],
      ] as const) {
        px.p(bx + cx, cy, null);
      }
      px.rect(bx + 1, 0, 2, 1, "ash");
      px.p(bx, 1, "ash");
    } else {
      px.p(bx, 0, "ash");
    }
  }
  return g;
}

// ---------- hit moments ----------

// The calico's fur tufts, thrown out of the scuffle.
const CAT_TUFTS: readonly string[] = ["white", "ochre", "dbrown", "white", "ochre", "lgrey"];
// The three claw scratches: (x, y) of each slash's top end, on the 64x64 design.
const SCRATCHES: readonly Point[] = [
  [26, 22],
  [33, 20],
  [40, 22],
];

// A claw scratch slashing down to the left from (x, y), length design pixels long, bowed: red, lit
// pink on its left, tapering to 1px at both ends.
function scratch(g: Drawable, x: number, y: number, length: number): void {
  const n = Math.round(length);
  for (let k = 0; k < n; k++) {
    const bow = Math.sin((Math.PI * k) / Math.max(1, n - 1));
    const w = k > 1 && k < n - 2 ? 2 : 1;
    const dots = range(0, w).map((i) => [i, 0, i === 0 && w > 1 ? "pink" : "red"] as const);
    hits.dots(g, x - k * 0.45 - bow * 1.5, y + k, dots);
  }
}

// The cat lashes out: a hiss puff swells while three bowed claw scratches slash down across it, red
// lit pink, then the puff breaks up and calico fur tufts fly out and fall.
export function hitPorchCat(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 36;
  if (step === 0) {
    hits.impact(g, "orange", cx, cy);
    return hits.rim(g);
  }
  const r = [0, 9, 12, 13, 12, 10, 0, 0][step]!;
  if (r) {
    hits.piece(g, (p) => {
      for (let k = 0; k < 7; k++) {
        const a = radians((k * 360) / 7 + step * 17);
        p.ell(
          cx + Math.cos(a) * r * 0.8,
          cy + Math.sin(a) * r * 0.65,
          r * 0.5,
          r * 0.45,
          "white",
          "lgrey",
        );
      }
      p.ell(cx, cy, r * 0.8, r * 0.6, "white", "lgrey");
    });
  } else if (step === 6) {
    hits.piece(g, (p) => {
      for (let k = 0; k < 5; k++) {
        p.ell(
          cx + Math.cos(radians(k * 72 + 30)) * 15,
          cy + Math.sin(radians(k * 72 + 30)) * 11,
          3.5,
          3,
          "white",
          "lgrey",
        );
      }
    });
  }
  const length = [0, 10, 20, 22, 22, 18, 0, 0][step]!;
  if (length) {
    hits.piece(g, (p) => {
      for (const [x, y] of SCRATCHES) {
        scratch(p, x, y + (22 - length) / 2, length);
      }
    });
  }
  if (step >= 3) {
    const t = step - 2;
    CAT_TUFTS.forEach((col, i) => {
      const a = radians(i * 60 + 35);
      const x = cx + Math.cos(a) * (10 + t * 4.5);
      const y = cy + Math.sin(a) * (8 + t * 3.5) + t * t * 0.5;
      if (x >= 2 && x < 59 && y >= 2 && y < 59) {
        hits.piece(g, (p) => {
          hits.tuft(p, x, y, col, (step + i) % 2);
        });
      }
    });
  }
  return g;
}

// Each burst: its drawing and its frame count, as hits.ts's HITS has them.
const HITS: ReadonlyMap<string, readonly [draw: (step: number) => Drawable, frames: number]> =
  new Map([["fx-hit-porch-cat", [hitPorchCat, 8]]]);

// Every burst: play, 8 frames at 70ms, as hits.ts's.
function* hitSprites(): Generator<Sprite> {
  for (const [key, [draw, frames]] of HITS) {
    yield [
      key,
      [["play", range(0, frames).map((i) => hits.burstFrame(draw, i).outlined(false)), 70]],
    ];
  }
}

// ---------- sounds ----------

// Each sound: tone() calls as sounds.ts's EFFECTS has them, [wave, seconds, freq, start seconds,
// options].
const EFFECTS: sounds.Effects = {
  // A hiss falling from a high band to a lower one, then a "mrr" rising into a falling "ow".
  "sfx-hit-porch-cat": [
    [
      "pinknoise",
      0.12,
      null,
      0,
      {
        attack: 0.006,
        fx: ["lowpass", "4000"],
        high: 2400,
        low: 4500,
        release: 0.5,
        shape: "h",
        vol: 1.0,
      },
    ],
    [
      "pinknoise",
      0.14,
      null,
      0.08,
      {
        attack: 0.02,
        fx: sounds.DARK,
        high: 1500,
        low: 3500,
        release: 0.7,
        shape: "h",
        vol: 0.9,
      },
    ],
    [
      "square",
      0.1,
      [430, 760],
      0.24,
      { attack: 0.015, duty: 35, low: 2200, release: 0.3, vol: 0.3 },
    ],
    [
      "square",
      0.16,
      [760, 520],
      0.33,
      { attack: 0.005, duty: 35, low: 2200, release: 0.8, shape: "h", vol: 0.3 },
    ],
    ["triangle", 0.1, [215, 380], 0.24, { attack: 0.015, release: 0.3, vol: 0.45 }],
    ["triangle", 0.16, [380, 260], 0.33, { attack: 0.005, release: 0.8, shape: "h", vol: 0.45 }],
  ],
};

// Write every sound into outDir as .ogg and .m4a, as sounds.ts's render does; return the keys.
function renderSounds(outDir: string): string[] {
  return sounds.renderEffects(outDir, EFFECTS);
}

// ---------- card illustrations ----------

// The zone the cards stand on, by game id: Cabbagetown's street.
const CABBAGETOWN = "cabbagetown";

// A drawn grid's outlined frame as an image.
function picture(g: Drawable): RgbaImage {
  return toImage(g.outlined());
}

// Three white claw slashes in a plum rim, as the effects are rimmed, each falling 9 rows to the right
// from x, y, 5px apart so 2px of ground shows between their rims: the cat's swipe.
function swipeMarks(a: cards.Art, x: number, y: number): void {
  const pts = range(0, 3).flatMap((k) =>
    range(0, 9).map((j) => [x + k * 5 + Math.floor(j / 3), y + j - k] as const),
  );
  for (const [px, py] of pts) {
    a.fill(px - 1, py - 1, 3, 3, "plum");
  }
  for (const [px, py] of pts) {
    a.fill(px, py, 1, 1, "white");
  }
}

// Stand your ground: Archie stands firm on his leash while the cat swipes up at his nose, three white
// claw slashes beside his head.
function porchCatStand(): cards.Art {
  const a = new cards.Art();
  a.ground(CABBAGETOWN);
  const cat = picture(drawn(ANIMAL, porchCat, { swipe: true }));
  a.shadow(18, 46, 36);
  a.paste(cat, 18 - cat.width / 2, 46 - cat.height);
  const c = a.dog("archie", "walk", 56, 56);
  a.lead(56, c, 64);
  swipeMarks(a, 34, 11);
  return a;
}

// Treat bribe: the cat lounges over a treat under rising hearts, Archie sitting calm beside it.
function porchCatTreat(): cards.Art {
  const a = new cards.Art();
  a.ground(CABBAGETOWN);
  a.put("porch-cat", "idle", 21, 42);
  a.paste(sn.frame("treat", "idle"), 33, 24);
  a.hearts([
    [14, 4],
    [26, 1],
  ]);
  const c = a.dog("archie", "idle", 60, 56);
  a.lead(60, c, 66);
  return a;
}

// Splash past: Archie splashes through a muddy puddle beside the lounging calico.
function porchCatBolt(): cards.Art {
  const ink = (c: string): Rgba => [...sn.rgb(c), 255];
  const a = new cards.Art();
  a.ground(CABBAGETOWN);
  a.put("porch-cat", "idle", 19, 33);
  ellipse({ fill: ink("dbrown") }, { x0: 29, x1: 73, y0: 39, y1: 55 }, a.img);
  ellipse({ fill: ink("brown") }, { x0: 31, x1: 71, y0: 40, y1: 52 }, a.img);
  arc({ fill: ink("tan"), width: 2 }, { x0: 31, x1: 70, y0: 40, y1: 52 }, 190, 345, a.img);
  const c = a.dog("archie", "walk", 51, 57, { i: 1 });
  a.lead(51, c, 38);
  // Brown jets rising from the pawfall, with a lit edge for the grey paving.
  const jets: readonly (readonly (readonly [number, number])[])[] = [
    [
      [34, 49],
      [28, 42],
      [29, 36],
      [33, 40],
      [36, 46],
    ],
    [
      [62, 48],
      [66, 40],
      [71, 36],
      [70, 43],
      [66, 49],
    ],
  ];
  for (const jet of jets) {
    const pts = jet.map(([x, y]) => ({ x, y }));
    polygon({ fill: ink("dbrown") }, pts, a.img);
    line({ fill: ink("tan"), width: 2 }, pts.slice(0, 3), a.img);
  }
  for (const [x0, y0, x1, y1] of [
    [23, 32, 26, 35],
    [68, 28, 71, 32],
  ] as const) {
    ellipse({ fill: ink("dbrown") }, { x0, x1, y0, y1 }, a.img);
  }
  return a;
}

const ILLUSTRATIONS: ReadonlyMap<string, () => cards.Art> = new Map([
  ["card-porch-cat-stand", porchCatStand],
  ["card-porch-cat-treat", porchCatTreat],
  ["card-porch-cat-bolt", porchCatBolt],
]);

// The illustration in an encounter card frame, cost plaque included, as cards.ts's mockCard shows
// one, scale times bigger, on dbrown.
function card(key: string, scale = 1): RgbaImage {
  const im = toImage(cards.cardFrame("encounter").px);
  paste({ at: { x: 6, y: 121 } }, toImage(cards.cardCost().px), im);
  paste({ at: { x: 4, y: 16 } }, ILLUSTRATIONS.get(key)!().img, im);
  const bg = filledImage([...sn.rgb("dbrown"), 255], im.width, im.height);
  paste({ at: { x: 0, y: 0 }, keepAlpha: true, mask: "alpha" }, im, bg);
  return resizeNearest(bg.width * scale, bg.height * scale, bg);
}

// ---------- sprites ----------

// [key + suffix, tags] for every road sprite at depth step step.
function* roadSprites(suffix: string, step: number): Generator<Sprite> {
  const a = ANIMAL * step;
  const o = OBSTACLE * step;
  const frames = <Q extends object>(draw: (q: Q) => Drawable, poses: readonly Q[]): Frame[] =>
    poses.map((q) => drawn(a, draw, q).outlined());
  const idle = <A>(
    draw: (arg: A) => Drawable,
    [args, ms]: readonly [readonly A[], number],
  ): Tag[] => [["idle", args.map((f) => small(roadScope, scope, o, draw, f).outlined()), ms]];

  yield [
    `porch-cat${suffix}`,
    [
      ["idle", frames(porchCat, PORCH_CAT_IDLE), 300],
      ["walk", frames(porchCat, PORCH_CAT_WALK), road.PERSON_WALK_MS],
    ],
  ];
  yield [
    `escaped-capybara${suffix}`,
    [
      ["idle", frames(escapedCapybara, CAPYBARA_IDLE), 300],
      ["walk", frames(escapedCapybara, CAPYBARA_WALK), CAPYBARA_WALK_MS],
    ],
  ];
  yield [
    `hen${suffix}`,
    [
      ["idle", frames(hen, HEN_IDLE), 400],
      ["run", frames(hen, HEN_RUN), 80],
    ],
  ];
  yield [
    `ferrets${suffix}`,
    [
      ["idle", frames(ferrets, FERRETS_IDLE), 300],
      ["run", frames(ferrets, FERRETS_RUN), 80],
    ],
  ];
  yield [`cherry-trees${suffix}`, idle((f: number) => cherryTrees(f), CHERRY_IDLE)];
  yield [`fallen-log${suffix}`, idle((f: Point) => fallenLog(f), FALLEN_LOG_IDLE)];
  yield [`leaf-pile${suffix}`, idle(leafPile, LEAF_PILE_IDLE)];
  yield [`little-free-library${suffix}`, idle(littleFreeLibrary, LIBRARY_IDLE)];
  yield [`porch-steps${suffix}`, idle(porchSteps, PORCH_STEPS_IDLE)];
  for (const lanes of [2, 3]) {
    yield [
      `iron-fence-${lanes}${suffix}`,
      idle((f: number) => ironFence(lanes, f), IRON_FENCE_IDLE),
    ];
  }
}

// Every road sprite at full size, then at each depth step.
function* sprites(): Generator<Sprite> {
  yield* roadSprites("", 1);
  for (const [suffix, s] of STEPS) {
    yield* roadSprites(`@${suffix}`, s);
  }
}

// ---------- commands ----------

// Sheets of every road sprite and burst on the zone roads, every illustration in a card, and the
// sounds.
async function preview(outDir: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  await sheet({ grounds: ZONE_ROADS, scale: 3 }, depthSettled({}, sprites()), `${outDir}/road.png`);
  await sheet(
    { grounds: ZONE_ROADS.slice(0, 3), scale: 3 },
    [...hitSprites()],
    `${outDir}/hits.png`,
  );
  const faces = [...ILLUSTRATIONS.keys()].map((key) => card(key, 3));
  const cardsSheet = filledImage(
    [...sn.rgb("ink"), 255],
    faces.reduce((n, f) => n + f.width + 12, 0),
    faces[0]!.height,
  );
  faces.forEach((f, i) => {
    paste({ at: { x: i * (f.width + 12), y: 0 } }, f, cardsSheet);
  });
  writeFileSync(`${outDir}/cards.png`, rgbPng(cardsSheet));
  renderSounds(outDir);
}

// Export the road sprites and bursts, then the illustrations composed from them, then the sounds.
async function build(): Promise<void> {
  await buildSprites({}, [...sprites(), ...hitSprites()]);
  for (const [key, draw] of ILLUSTRATIONS) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(draw().img));
  }
  console.log("built", [...ILLUSTRATIONS.keys()].join(", "));
  console.log("built", renderSounds("public/art/sounds").join(", "));
}

if (import.meta.main) {
  await run({
    commands: {
      build: () => build(),
      "preview OUT_DIR": (dir) => preview(dir),
      "sounds OUT_DIR": (dir) => console.log("wrote", renderSounds(dir).join(", ")),
    },
    doc: USAGE,
  });
}
