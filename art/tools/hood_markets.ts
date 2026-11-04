// Draw the Distillery District's and Kensington Market's own road art: their card obstacles with
// the hit bursts, hit sounds and card illustrations that go with them, and their minor obstacles.
//
// Distillery District:
//
// cheese-crates       48x48   card obstacle, 1 lane, in Kensington Market too: a cheesemonger's slatted
//                             crate set out at the shop door, two golden wheels stacked at the back left,
//                             a cut wheel stood on its edge at the right showing its yellow paste, a blue
//                             cheese wedge in front and a chalk price tag hung on the crate. idle (4
//                             frames, 350ms): three stink wisps rise a quarter wave a frame
// wedding-photo-shoot 112x72  card obstacle, 2 lanes: a bride posing in a white gown and veil with a
//                             bouquet in the left lane; in the right lane a photographer in black
//                             kneels facing her, a camera with a flash on top raised to his eye, a
//                             silver reflector on a stand behind him. idle (4 frames, 400ms): the
//                             bride breathes on frames 1 and 3, the flash fires on frame 2
// velvet-rope         112x36  minor, 2 lanes: three brass stanchions on round bases, a red velvet rope
//                             swagged between them. idle (4 frames, 400ms): a glint runs down the left
//                             post's highlight on frames 2 and 3
// rolling-barrel      48x48   minor dart, 1 lane: a whisky barrel on its side rolling across the lanes,
//                             seen end-on, its dark oak staves, pale repair plank and bung turning inside
//                             an iron hoop; rolls right, the game mirrors it for left. idle (2 frames,
//                             400ms): resting, rocking 15 degrees; run (8 frames, 60ms): a full turn, 45
//                             degrees a frame, a puff of dust kicked up behind it
// barrel-stack        48x48   minor, 1 lane: three whisky barrels stacked as a pyramid on a tan pallet,
//                             lying on their sides with their plank-built oak heads to the camera, each
//                             in a silver hoop over a recessed dark chime, the brown bodies showing
//                             above the heads, bark wedges chocking the bottom two. idle (4 frames,
//                             400ms): a glint runs down the top barrel's hoop on frames 2 and 3
// art-sculpture       48x48   minor, 1 lane: three closed wooden shipping crates, two wide boxes at the
//                             base and one centred above, with broad light tops, brown plank fronts,
//                             dark side planes and bold timber braces. idle (4 frames, 400ms): a
//                             restrained glint crosses the top crate's metal corner on frames 2 and 3
//
// Kensington Market:
//
// green-bin-spill     48x48   card obstacle, 1 lane: a Toronto green bin knocked over onto its front,
//                             seen side on, its lid propped open up and back off the mouth, a wheel up
//                             in the air at the bottom's back corner, scraps, a lettuce leaf and a
//                             banana peel spilling out across the road. idle (4 frames, 350ms): the lid
//                             rocks up 1px on frame 2
// produce-crates      48x48   minor, 1 lane: three blue plastic crates set down in the road, two stacked
//                             on the left with tomatoes heaped on top and one on the right of upright
//                             bok choy, with no awning, posts or wheels. idle (4 frames, 400ms): the
//                             middle bok choy lifts 1px on frame 2
// clothing-rack       48x48   minor, 1 lane: a rolling rack of vintage clothes on chrome uprights and
//                             casters: a mustard corduroy jacket, a plain lilac dress, a denim jacket
//                             and a striped tee. idle (4 frames, 450ms): the dress sways 1px on frame 2
// market-stall-2      112x48  minor, 2 lanes: a flea market's folding tables, one per lane, under a
//                             faded teal and cream striped awning with a deep scalloped hem on thin
//                             coal poles, open air between the hem and the goods; each clay table
//                             stands on crossed legs, laid with chunky goods: a crate of records with a
//                             black record stood up (lilac label, left out at @69 and smaller, where it
//                             would fill the disc), folded clothes, book spines, glass jars and a lidded
//                             box. idle (4 frames, 500ms): the hem's middle half lifts 1px on frame 2
// market-stall-3      176x48  minor, 3 lanes: the same stall, a table wider
// cargo-bike          48x72   minor mover, 1 lane by 2 rows: a cargo bike riding down a lane at the
//                             pack, facing it: a wooden box of sunflowers and pink tulips out front over
//                             a small front wheel with a lit headlamp on its fork, its rider behind in a
//                             rust beanie and a turquoise jacket; the box hides the legs. ride (4
//                             frames, 100ms): the rider sways 1px over the bars, the flowers jiggle and
//                             a tread line rolls down the tire
//
// fx-hit-cheese-crates 77x77  play (8 frames, 70ms): a gold impact star, then a puff of lime stink
//                             swelling up and shrinking away as the cut wheel bounces up out of it and
//                             rolls off right, a quarter turn a frame, crumbs flying and wisps rising
// fx-hit-wedding-photo-shoot 77x77  play (8 frames, 70ms): a lilac impact star, then a camera flash
//                             flaring and fading while the bouquet flies up out of it, tumbling, and
//                             petals scatter and drift down
// fx-hit-green-bin-spill 77x77  play (8 frames, 70ms): a green impact star, then a comic splat of olive
//                             slop swelling and shrinking, drops flying off its arms, the banana peel
//                             flung up out of it tumbling over, scraps thrown out either side
// sfx-hit-cheese-crates 0.40s a soft wooden thunk, a squish, then a rising plop that sags as it settles
// sfx-hit-wedding-photo-shoot 0.58s a flash charging up, the shutter's double click, then a triangle
//                             "ding dong" of wedding bells
// sfx-hit-green-bin-spill 0.44s  a hollow plastic thunk, the lid clattering down in three shrinking
//                             knocks, then a soft squelch and a gloop
//
// Cards (75x56), one per option, composed from the sprites above and the pack's exports:
// card-cheese-crates-sniff, -buy and -hurry-on at a brick shopfront's wooden door, which fits both the
// neighbourhoods it stands in; card-wedding-photo-shoot-pose, -walk-around and -reshoot on the
// Distillery District's road; card-green-bin-spill-hurry-past, -pay and -wade-through on Kensington
// Market's, the last with Archie wading through the bin's slop, the banana peel on his head. The paid
// options show a bill (icon-bill) changing hands: the photographer reaching out to take it, the
// cheesemonger in an ochre shirt and white apron and the shopkeeper in a lilac shirt and cream apron,
// broom in hand, holding it up.
//
// The road sprites take the road outline rule (pixel.ts's roadEdge) and road.ts's LIT rim on their
// dark colours, so their silhouettes hold 3:1 on every road. People, movers and the card obstacles are
// laid out on the 32-unit design grid (the wedding photo shoot on 224/3 x 48 units, two lanes) and
// drawn road.ts's SCALE (1.5) times bigger on a mini.ts Mini; the minor obstacles are laid out in
// obstacles.ts's layout pixels (40 for one lane, 30 rows for a lane-spanning one, 40 for the market
// stall) and drawn obstacles.ts's SCALE (1.2) times bigger. Each has <key>@<step> for every depth
// step in mini.ts's STEPS, redrawn the same way at its scale times the step, with the original's
// tags, frames and durations and a full outline. 1px motions are in drawn pixels, so they stay 1px at
// every step. The hit bursts follow hits.ts: a 64-unit design drawn 77/64 times bigger, a plum rim
// round each part.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { filledImage, paste, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as hits from "./hits.ts";
import { small, STEPS } from "./mini.ts";
import * as ob from "./obstacles.ts";
import {
  build as buildSprites,
  depthSettled,
  type Drawable,
  type DrawingScope,
  edged,
  type FaceFront,
  type Frame,
  Grid,
  HEART,
  K,
  type Point,
  preview,
  raster,
  rgbPng,
  rowScaleOf,
  scaleOf,
  type Sprite,
  type Tag,
  toImage,
  ZONE_ROADS,
} from "./pixel.ts";
import * as road from "./road.ts";
import { faceDisc, lit, scope as roadScope } from "./road.ts";
import * as sn from "./scene.ts";
import * as sounds from "./sounds.ts";

const USAGE = `Usage:
  node art/tools/hood_markets.ts preview OUT.png   every frame of every sprite on the zone roads
  node art/tools/hood_markets.ts cards OUT.png     every card illustration inside its card frame, 3x
  node art/tools/hood_markets.ts sounds OUT_DIR    write the sounds' .ogg and .m4a files into OUT_DIR
                                                   only
  node art/tools/hood_markets.ts build             write art/hood-markets/*.aseprite and export the
                                                   sprites to public/art/sprites/, then the cards to
                                                   public/art/images/ (sources in art/cards/), then
                                                   the sounds to public/art/sounds/`;

const SRC = "art/hood-markets";
// People, movers and card obstacles are drawn PERSON times their design grid, minor obstacles
// OBSTACLE times their layout pixels.
const PERSON = road.SCALE;
const OBSTACLE = ob.SCALE;
// The cheese crate's key, which its hit burst's and option pictures' keys extend.
const CHEESE = "cheese-crates";
// The green bin spill's key, which its hit burst's and option pictures' keys extend.
const GREEN_BIN_SPILL = "green-bin-spill";
// The wedding photo shoot's design width: two lanes, 112px at PERSON.
const SHOOT_W = 224 / 3;

interface MarketsScope extends DrawingScope {
  faceFront: FaceFront;
}

// The grid every drawing here makes and the face it draws, which mini.ts's small swaps while it
// runs. The face is road.ts's, so small swaps it here too, as it does in road.ts's scope.
export const scope: MarketsScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
  faceFront: road.faceFront,
};

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function degrees(rad: number): number {
  return rad * (180 / Math.PI);
}

// a modulo m, with the sign of m.
function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
    out.push(v);
  }
  return out;
}

function pairs<T>(xs: readonly T[]): [T, T][] {
  return xs.slice(1).map((b, i) => [xs[i]!, b]);
}

// draw(...args) on a Mini at scale s.
function drawn<A extends unknown[], R>(s: number, draw: (...args: A) => R, ...args: A): R {
  return small(roadScope, scope, s, draw, ...args);
}

// One drawn pixel in g's design units.
function unit(g: Drawable): number {
  return 1 / scaleOf(g);
}

// A stroke w design units square through the joints pts.
function line(g: Drawable, pts: readonly Point[], w: number, c: string): void {
  for (const [[x0, y0], [x1, y1]] of pairs(pts)) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
    for (let k = 0; k <= n; k++) {
      g.rect(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, w, w, c);
    }
  }
}

// ---------- the wedding photo shoot ----------

// The bride, centred on design column 16 of the left lane, facing the pack: a haze veil falling
// behind her to the waist, a white A-line gown shaded lgrey down its right to the hem, her arms in to
// a bouquet of pink, red and cream roses at the waist, her dbrown hair up in a bun under a white
// tiara. b lifts her body (negative is up); the hem stays on the ground.
function bride(g: Drawable, b: number): void {
  g.tri([16, 4 + b], [4, 33 + b], [28, 33 + b], "haze");
  g.tri([16, 20 + b], [3, 45], [29, 45], "white");
  g.tri([16, 20 + b], [22, 45], [29, 45], "lgrey");
  g.rect(4, 44, 25, 1, "lgrey");
  g.rect(10, 20 + b, 12, 10, "white");
  g.rect(19, 20 + b, 3, 10, "lgrey");
  g.rect(11, 29 + b, 10, 1, "haze");
  // bare shoulders and arms, bent in to the bouquet
  line(
    g,
    [
      [8, 21 + b],
      [8, 26 + b],
      [11, 29 + b],
    ],
    2.5,
    "skin1",
  );
  line(
    g,
    [
      [21.5, 21 + b],
      [21.5, 26 + b],
      [18.5, 29 + b],
    ],
    2.5,
    "skin1",
  );
  g.rect(22.5, 21 + b, 1, 5, "skin2");
  for (const [x, y, c, sh] of [
    [13, 30, "pink", "mauve"],
    [16, 29, "red", "dred"],
    [19, 30, "pink", "mauve"],
    [14.5, 32.5, "cream", "tan"],
    [17.5, 32.5, "red", "dred"],
  ] as const) {
    g.cel(x, y + b, 2, 2, c, sh);
  }
  g.rect(15, 34 + b, 2, 3, "canopy");
  // the head: the neck, the face, hair over the crown, the bun and the tiara
  g.rect(14, 19 + b, 4, 2, "skin1");
  faceDisc(g, 16, 12.5 + b, 7.5, 7.5, "skin1", "skin2");
  g.cel(16, 7.5 + b, 8.5, 4, "dbrown", "plum", "brown");
  g.rect(8, 8 + b, 2, 6, "dbrown");
  g.rect(22, 8 + b, 2, 6, "dbrown");
  g.cel(16, 3 + b, 3, 2.5, "dbrown", "plum", "brown");
  for (const x of [12, 14, 16, 18, 20]) {
    g.p(x, 5 + b - (x === 16 ? 1 : 0), "white");
  }
  scope.faceFront(g, 16, 13 + b, { lips: "red" });
  g.p(10, 16 + b, "pink");
  g.p(22, 16 + b, "pink");
}

// The photographer, kneeling on his right knee in the right lane and facing left at the bride: black
// shirt and slate trousers, lighter than the dslate road so his legs never sink into it, rust hair, a
// black camera raised to his eye, its grey lens pointing left with a sky glint, a white flash on the
// hot shoe on top. pay, for the reshoot card, lowers his near arm from the camera and reaches it out
// low in front of him, the hand open.
function photographer(g: Drawable, pay = false): void {
  // the knee on the ground, the shin back along it, the shoe's toes tucked under
  line(
    g,
    [
      [60, 35],
      [64, 41],
    ],
    4,
    "slate",
  );
  g.rect(63, 42, 7, 3, "slate");
  g.rect(63, 44, 7, 1, "dslate");
  g.rect(69, 41, 3, 4, "ink");
  // the raised knee: the thigh forward, the shin down to the shoe, toes pointing at the bride
  g.rect(48, 33, 12, 4, "slate");
  g.rect(48, 33, 4, 10, "slate");
  g.rect(51, 37, 1, 6, "dslate");
  g.rect(45, 43, 7, 2, "ink");
  // the torso, upright, leaning a little forward
  g.rect(53, 23, 10, 12, "ink");
  g.tri([52, 25], [53, 23], [53, 35], "ink");
  g.rect(53, 34, 10, 1, "navy");
  // the far arm up to the camera's grip
  line(
    g,
    [
      [55, 25],
      [53, 28],
      [52, 22],
    ],
    3,
    "ink",
  );
  // the head in profile: the neck, the face, hair over the crown and the back, an ear
  g.rect(56, 20, 4, 4, "skin2");
  g.cel(57.5, 15.5, 6.5, 6.5, "skin2", "brown");
  g.cel(59.5, 11.5, 6.5, 3.5, "rust", "dbrown", "ochre");
  g.rect(61.5, 11.5, 3.5, 8, "rust");
  g.rect(64, 12.5, 1, 6, "dbrown");
  g.rect(59.5, 14.5, 1.5, 3, "brown");
  g.rect(55, 10.5, 4, 1, "rust");
  // the camera: body, lens and its glass, the flash on top
  g.rect(47, 14, 9, 7, "ink");
  g.rect(47, 14, 9, 1, "slate");
  g.rect(41, 15, 6, 5, "grey");
  g.rect(41, 15, 6, 1, "lgrey");
  g.rect(41, 19, 6, 1, "slate");
  g.rect(40, 15.5, 1, 4, "ink");
  g.rect(39, 16, 1, 3, "sky");
  g.rect(49, 13, 3, 1, "ink");
  g.rect(48, 9, 5, 4, "white");
  g.rect(52, 9, 1, 4, "lgrey");
  g.rect(48, 12, 5, 1, "lgrey");
  g.rect(55, 16, 2, 4, "skin2");
  if (pay) {
    // the near arm lowered from the camera and reached out low in front of him, the hand taking the
    // fee
    line(
      g,
      [
        [58, 24],
        [53, 31],
        [41, 32],
      ],
      3,
      "ink",
    );
    g.rect(38, 31, 3, 3, "skin2");
    return;
  }
  // the near arm: the sleeve from the shoulder to the elbow, the forearm up to the hand under the lens
  line(
    g,
    [
      [58, 24],
      [54, 29],
      [48, 23],
    ],
    3,
    "ink",
  );
  g.rect(45, 20, 4, 2.5, "skin2");
}

// A silver reflector on a light stand behind the photographer, tilted at the bride: an oval disc,
// white lit lgrey down its right with a grey rim, on a slate pole and three legs.
function reflector(g: Drawable): void {
  g.rect(69, 19, 1, 23, "slate");
  line(
    g,
    [
      [69, 41],
      [66, 45],
    ],
    1,
    "slate",
  );
  line(
    g,
    [
      [69, 41],
      [73, 45],
    ],
    1,
    "slate",
  );
  g.cel(69.5, 11, 4, 8, "lgrey", "grey");
  g.cel(68.8, 10.5, 2.6, 6.5, "white", "lgrey");
}

type ShootPart = "bride" | "photographer" | "reflector";
const SHOOT_PARTS: readonly ShootPart[] = ["bride", "photographer", "reflector"];

interface ShootPose {
  bob?: number;
  flash?: boolean;
  parts?: readonly ShootPart[];
  pay?: boolean;
}

// The shoot across two lanes, laid out on SHOOT_W x 48 and drawn at PERSON to 112x72. bob is the
// bride's breath in drawn pixels; flash fires the flash: a white star, its arms tipped yellow, with
// yellow diagonals, flaring off the flash head. parts picks which figures to draw (the cards use them
// one at a time), and pay draws the photographer's pay pose.
function weddingPhotoShoot({
  bob = 0,
  flash = false,
  parts = SHOOT_PARTS,
  pay = false,
}: ShootPose = {}): Drawable {
  const g = edged(scope.Grid(SHOOT_W, 48));
  const u = unit(g);
  if (parts.includes("reflector")) {
    reflector(g);
  }
  if (parts.includes("photographer")) {
    photographer(g, pay);
  }
  if (parts.includes("bride")) {
    bride(g, bob * u);
  }
  lit(g, { slate: ["lgrey", null] });
  if (flash && parts.includes("photographer")) {
    const px = raster(g);
    const s = scaleOf(g);
    const cx = Math.floor(47.5 * s);
    const cy = Math.floor(9.5 * s);
    const r = Math.max(3, Math.round(6 * s));
    for (let k = -r; k <= r; k++) {
      for (const [x, y] of [
        [cx + k, cy],
        [cx, cy + k],
      ] as const) {
        px.p(x, y, Math.abs(k) > Math.floor(r / 2) ? "yellow" : "white");
      }
    }
    for (let k = 1; k <= Math.max(2, Math.floor(r / 2)); k++) {
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        px.p(cx + dx * k, cy + dy * k, "yellow");
      }
    }
    px.rect(cx - 1, cy - 1, 3, 3, "white");
  }
  return g;
}

// The breath and the flash: rest, the bride 1px up, the flash, the bride 1px up again.
const SHOOT_IDLE: readonly [readonly ShootPose[], number] = [
  [{}, { bob: -1 }, { flash: true }, { bob: -1 }],
  400,
];

// ---------- the velvet rope ----------

const VELVET_ROPE_WIDTH = ob.span(2);

// Front elevation, 2 lanes: three brass stanchions, gold lit yellow down their left and shaded ochre
// down their right, each on a round base under a ball knob, and a red velvet rope swagged between
// each pair, shaded dred along its lower edge and lit pink along its top, hooked on under the knobs.
// glint is the layout row on the left post's highlight that flashes white, or null.
function velvetRope(glint: number | null = null, w = VELVET_ROPE_WIDTH): Drawable {
  const g = edged(scope.Grid(w, ob.ROW));
  const posts = [6, w / 2 - 2, w - 10];
  const px = raster(g);
  const s = scaleOf(g);
  const thick = Math.max(2, Math.round(3 * s));
  // the rope, drawn column by column on the drawn grid so it keeps an even thickness along its swag
  for (const [a, b] of pairs(posts)) {
    const x0 = Math.floor((a + 3) * s);
    const x1 = Math.ceil((b + 1) * s);
    for (let x = x0; x < x1; x++) {
      const t = (x + 0.5 - x0) / (x1 - x0);
      const y = Math.floor((8.5 + 9 * 4 * t * (1 - t)) * s);
      for (let k = 0; k < thick; k++) {
        px.p(x, y + k, k === 0 && t > 0.12 && t < 0.88 ? "pink" : k === thick - 1 ? "dred" : "red");
      }
    }
  }
  for (const x of posts) {
    g.cel(x + 2, 27.5, 6, 2, "ochre", "brown", "gold");
    g.rect(x, 6, 4, 21, "gold");
    g.rect(x + 3, 6, 1, 21, "ochre");
    g.rect(x, 6, 1, 21, "yellow");
    g.rect(x - 1, 8, 6, 2, "ochre");
    g.cel(x + 2, 4.5, 3, 2.5, "gold", "ochre", "yellow");
  }
  if (glint !== null) {
    px.rect(Math.floor(6 * s), Math.floor(glint * s), 1, Math.max(1, Math.round(2 * s)), "white");
  }
  return lit(g);
}

const VELVET_IDLE: readonly [readonly (number | null)[], number] = [[null, null, 12, 19], 400];

// ---------- the rolling barrel ----------

interface BarrelPose {
  dust?: number | null;
  rock?: number;
  turn?: number;
}

// A whisky barrel on its side, seen end-on: an ash iron hoop lit grey on its upper left and shaded
// slate on its lower right, a recessed dark chime, and the brown oak head with broad stave seams, one
// pale replacement plank and an off-centre walnut bung, turned turn degrees clockwise. dust (0 or 1)
// kicks up a puff of driftwood dust behind it on the left, low on the ground, in one of two shapes.
// rock turns the bung alone that many degrees, the seams held still. Laid out on the 32-unit grid;
// the head is drawn pixel for pixel at the grid's scale so its seams stay 1px at any angle.
function rollingBarrel({ dust = null, rock = 0, turn = 0 }: BarrelPose = {}): Drawable {
  const g = edged(scope.Grid(32, 32));
  const px = raster(g);
  const s = scaleOf(g);
  const cx = 16 * s;
  const cy = 16.5 * s;
  const r = 12 * s;
  const a = radians(turn);
  const gap = Math.max(4, Math.round(4.5 * s));
  const b = a + radians(rock);
  const bung = [
    cx + Math.cos(b - Math.PI / 2) * 0.55 * r,
    cy + Math.sin(b - Math.PI / 2) * 0.55 * r,
  ] as const;
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) {
        continue;
      }
      const light = (dx + dy) / Math.max(d, 1e-9);
      let c: string;
      if (d > r - Math.max(2, 2.2 * s)) {
        c = light < -0.6 ? "grey" : light > 0.5 ? "slate" : "ash";
      } else if (d > r - Math.max(3, 3.6 * s)) {
        c = light > 0.1 ? "walnut" : "clay";
      } else {
        const along = dx * Math.cos(a) + dy * Math.sin(a);
        c = mod(Math.floor(along), gap) === 0 ? "bark" : "brown";
        // A broad pale repair stave rotates with the head, unlike an ornamental centre mark.
        if (along > -0.5 * r && along < -0.5 * r + Math.max(2, 3.3 * s)) {
          c = "driftwood";
          if (Math.floor(along + 0.5 * r) === 0) {
            c = "bark";
          }
        }
        if (Math.hypot(x + 0.5 - bung[0], y + 0.5 - bung[1]) < Math.max(1.2, 1.4 * s)) {
          c = "walnut";
        }
      }
      px.p(x, y, c);
    }
  }
  if (dust !== null) {
    const puffs = [
      [
        [6, 28, 2.6, 2],
        [4.5, 25, 1.4, 1.3],
      ],
      [
        [5.5, 27.5, 2.2, 2.2],
        [7, 24.5, 1.3, 1.1],
      ],
    ] as const;
    for (const [x, y, rx, ry] of puffs[dust]!) {
      g.cel(x, y, rx, ry, "driftwood", "stone", "cream");
    }
  }
  return g;
}

// Resting, then the bung rocked 15 degrees; the roll, a full turn clockwise, 45 degrees a frame, the
// dust in two shapes.
const BARREL_IDLE: readonly [readonly (readonly [number])[], number] = [[[0], [15]], 400];
const BARREL_RUN: readonly [readonly (readonly [number, number])[], number] = [
  range(0, 8).map((k) => [k * 45, k % 2] as const),
  60,
];

// ---------- the barrel stack ----------

// A barrel lying on its side with its head to the camera, centred on cx, cy with radius r in layout
// pixels: its brown body showing above the head, lit tan along its top; a silver hoop (lgrey, shaded
// grey on its lower right) and a recessed bark chime round the brown oak head, with a few broad plank
// faces and clear upright seams. glint is the angle in degrees, clockwise from the right, of a white
// glint on the hoop: the two hoop pixels nearest that angle. Drawn pixel for pixel at the grid's
// scale so its rings and seams stay 1px.
function barrelEnd(
  g: Drawable,
  layoutX: number,
  layoutY: number,
  layoutR: number,
  glint: number | null = null,
): void {
  const px = raster(g);
  const s = scaleOf(g);
  const cx = layoutX * s;
  const cy = layoutY * s;
  const r = layoutR * s;
  const lift = Math.max(2, Math.round(2.2 * s));
  const hoop = Math.max(1, Math.round(1.2 * s));
  const chime = 2 * hoop;
  const gap = Math.max(4, Math.round(3.3 * s));
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d <= r) {
        const light = (dx + dy) / Math.max(d, 1e-9);
        let c: string;
        if (d > r - hoop) {
          c = light > 0.4 ? "grey" : "lgrey";
        } else if (d > r - chime) {
          c = "bark";
        } else {
          const across = dx + r;
          c = mod(Math.floor(across / gap), 2) ? "clay" : "brown";
          if (mod(Math.floor(across), gap) === 0) {
            c = "bark";
          }
        }
        px.p(x, y, c);
        continue;
      }
      // the body above the head, seen from above: the head's disc pushed back lift pixels
      for (let k = 1; k <= lift; k++) {
        if (Math.hypot(dx, dy + k) <= r) {
          px.p(x, y, k === lift && Math.hypot(dx, dy + k - 1) > r ? "tan" : "brown");
          break;
        }
      }
    }
  }
  if (glint !== null) {
    const ring: [number, number][] = [];
    for (let y = 0; y < px.h; y++) {
      for (let x = 0; x < px.w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r - hoop && d <= r) {
          ring.push([x, y]);
        }
      }
    }
    const off = ([x, y]: readonly [number, number]): number => {
      const a = degrees(Math.atan2(y + 0.5 - cy, x + 0.5 - cx)) - glint;
      return Math.abs(mod(a + 180, 360) - 180);
    };
    const keyed = ring.map((p) => [off(p), p] as const);
    keyed.sort((p, q) => p[0] - q[0]);
    for (const [, [x, y]] of keyed.slice(0, 2)) {
      px.p(x, y, "white");
    }
  }
}

// Three whisky barrels stacked as a pyramid on a pallet in a lane, laid out on 40x40: two lying side
// by side with their heads to the camera and the third in the groove on top (barrelEnd), bark wedges
// chocking the bottom two at either end, all on a tan pallet lit cream with brown blocks, its fork
// openings dark between them. glint puts a white glint on the top barrel's hoop at that angle.
function barrelStack(glint: number | null = null): Drawable {
  const g = edged(scope.Grid(ob.SIZE, ob.SIZE));
  // the pallet's foot on row 37, as produceCrates' crates stand
  const r = 7.5;
  const base = 33;
  const low = base - r;
  const top = low - r * Math.sqrt(3);
  const x0 = 3;
  const x1 = 37;
  // the pallet: a deck board on three blocks on a bottom board
  g.rect(x0, base, x1 - x0, 2, "tan");
  g.rect(x0, base, x1 - x0, 1, "cream");
  for (const x of [x0, 18, x1 - 4]) {
    g.rect(x, base + 2, 4, 1, "brown");
  }
  g.rect(x0, base + 3, x1 - x0, 1, "brown");
  barrelEnd(g, 20, top, r, glint);
  barrelEnd(g, 20 - r, low, r);
  barrelEnd(g, 20 + r, low, r);
  // the wedges chocking the bottom barrels
  g.tri([x0, base], [x0 + 4, base], [x0, base - 4], "bark");
  g.tri([x1, base], [x1 - 4, base], [x1, base - 4], "bark");
  return lit(g, { bark: ["clay", null] });
}

// The glint runs down the top barrel's hoop on its upper left on frames 2 and 3.
const STACK_IDLE: readonly [readonly (number | null)[], number] = [[null, null, 235, 200], 400];

// ---------- the shipping crates ----------

// Three closed shipping crates on the 40x40 obstacle grid, with their feet on row 35. Each has a
// broad plank front, a light top and a dark right side. One bold timber X braces each front; closed
// tops and solid faces distinguish these from food and produce crates. glint moves a short highlight
// down the top crate's metal corner.
function artSculpture(glint: number | null = null): Drawable {
  const g = edged(scope.Grid(ob.SIZE, ob.SIZE));
  const s = scaleOf(g);

  const shippingCrate = (x: number, y: number, w: number, h: number): void => {
    const d = 3;
    const face = w - 3;
    // A solid box with three large planes, lit from the upper left.
    poly(
      g,
      [
        [x, y + d],
        [x + d, y],
        [x + w, y],
        [x + face, y + d],
      ],
      "tan",
    );
    poly(
      g,
      [
        [x + face, y + d],
        [x + w, y],
        [x + w, y + h - d],
        [x + face, y + h],
      ],
      "bark",
    );
    g.rect(x, y + d, face, h - d, "brown");
    // A broad frame and one horizontal plank joint keep the wood readable without texture.
    g.rect(x, y + d, face, 2, "driftwood");
    g.rect(x, y + h - 2, face, 2, "clay");
    g.rect(x, y + d, 2, h - d, "clay");
    g.rect(x + face - 2, y + d, 2, h - d, "bark");
    g.rect(x + 2, y + d + (h - d) / 2, face - 4, 1, "bark");
    // Two wide diagonal timbers form one unmistakable shipping-crate brace.
    line(
      g,
      [
        [x + 2, y + d + 2],
        [x + face - 4, y + h - 4],
      ],
      2.5,
      "tan",
    );
    line(
      g,
      [
        [x + face - 4, y + d + 2],
        [x + 2, y + h - 4],
      ],
      2.5,
      "tan",
    );
    // One small steel corner sits on the lit top edge.
    g.rect(x + face - 3, y + d, 3, 2, "ash");
    g.rect(x + face - 1, y + d, 1, 3, "grey");
    // A single broad joint on the side reinforces the closed box's depth.
    line(
      g,
      [
        [x + face + 1, y + d + (h - d) / 2],
        [x + w - 1, y + (h - d) / 2],
      ],
      1,
      "bark",
    );
  };

  shippingCrate(1, 18, 19, 18);
  shippingCrate(20, 18, 19, 18);
  shippingCrate(10, 1, 21, 19);
  if (glint !== null) {
    // The highlight remains a short joined mark at every native depth.
    raster(g).rect(
      Math.floor(25 * s),
      Math.floor((4 + glint * 8) * s),
      Math.max(1, Math.round(2 * s)),
      Math.max(1, Math.round(2 * s)),
      "white",
    );
  }
  return lit(g, { bark: ["clay", null] });
}

// The top crate's steel corner catches light on frames 2 and 3.
const SCULPTURE_IDLE: readonly [readonly (number | null)[], number] = [[null, null, 0.1, 0.3], 400];

// ---------- the green bin spill ----------

// A convex polygon through the corners pts, as a fan of triangles.
function poly(g: Drawable, pts: readonly Point[], c: string): void {
  for (const [a, b] of pairs(pts.slice(1))) {
    g.tri(pts[0]!, a, b, c);
  }
}

// A banana peel lying on the road side on, centred on column cx with its base on row base: a bark
// stem on a short yellow neck, a flap splayed down to the ground either side and cream inside showing
// between them.
function bananaPeel(g: Drawable, cx: number, base: number): void {
  g.tri([cx - 1, base - 4], [cx - 6, base], [cx - 3, base], "yellow");
  g.tri([cx + 1, base - 4], [cx + 6, base], [cx + 3, base], "yellow");
  g.tri([cx - 1.5, base - 4], [cx + 1.5, base - 4], [cx, base], "cream");
  g.rect(cx - 1.5, base - 6, 3, 2.5, "yellow");
  g.rect(cx - 1, base - 8.5, 2, 2.5, "bark");
}

// A Toronto green bin knocked over onto its front, seen side on, on the 32-unit grid: the dgreen body
// lying along the road, lit green along its top and shaded forest along its bottom, its mouth at the
// left in a thick forest lip with a moulded band behind it; the lid propped open up and back off its
// hinge at the mouth's top, its top edge lit; a coal wheel with an ash hub up in the air at the
// bottom's back corner. Scraps spill out over the lip and across the road in front: a clay heap
// shaded bark, a green lettuce leaf and a banana peel lying in front. rock lifts the lid's far end
// that many drawn pixels.
function greenBinSpill(rock = 0): Drawable {
  const g = edged(scope.Grid(32, 32));
  const s = scaleOf(g);
  const r = rock / s;
  poly(
    g,
    [
      [10, 10],
      [2, 4.5 - r],
      [4, 1.5 - r],
      [12, 7],
    ],
    "forest",
  );
  poly(
    g,
    [
      [12, 7],
      [4, 1.5 - r],
      [3.2, 2.7 - r],
      [11.2, 8.2],
    ],
    "green",
  );
  // the body, the mouth end a little taller than the bottom end, which is rounded off
  poly(
    g,
    [
      [9, 9],
      [28, 11.5],
      [30, 13.5],
      [30, 25.5],
      [28, 27.5],
      [9, 28],
    ],
    "dgreen",
  );
  poly(
    g,
    [
      [9, 9],
      [28, 11.5],
      [29.5, 13],
      [9, 11.5],
    ],
    "green",
  );
  poly(
    g,
    [
      [9, 25],
      [30, 24.5],
      [30, 25.5],
      [28, 27.5],
      [9, 28],
    ],
    "forest",
  );
  g.rect(7.5, 9, 3, 19, "forest");
  g.rect(7.5, 9, 1, 19, "green");
  // the moulded band, 2 drawn pixels wide at every scale so it never thins to a single column
  const [x0, y0, y1] = [13, 10.5, 24.5].map((v) => Math.floor(v * s + 0.5)) as [
    number,
    number,
    number,
  ];
  raster(g).rect(x0, y0, 2, y1 - y0, "forest");
  g.cel(25.5, 9.5, 4.2, 4.2, "coal");
  g.rect(24, 8, 3, 3, "ash");
  g.cel(10.5, 28.5, 8.5, 3, "clay", "bark");
  g.cel(9.5, 26, 3, 2.5, "clay", "bark");
  g.cel(2.5, 29.5, 3, 1.5, "clay", "bark");
  poly(
    g,
    [
      [13, 27],
      [16.5, 25],
      [19, 26.5],
      [16, 28.5],
    ],
    "green",
  );
  bananaPeel(g, 5, 30);
  return lit(g, { bark: ["clay", null], coal: ["ash", null] });
}

// The lid rocks up 1px on frame 2 and settles.
const BIN_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 350];

// ---------- the cheese crate ----------

// The cut wheel's missing wedge in degrees: narrow enough that the wheel reads as cheese, not a mouth.
const WHEEL_CUT = 30;

// A cheese wheel stood on its edge, seen face on round design point cx, cy, r design units across
// the middle: an amber rind ring shaded orange on its lower right and lit gold on its upper left
// round yellow paste with three tan holes, and with cut a WHEEL_CUT degree wedge cut out of it to the
// centre, turned turn degrees clockwise from straight up. Drawn pixel for pixel at the grid's scale,
// so it keeps its shape at any angle.
function cheeseWheel(
  g: Drawable,
  cx: number,
  cy: number,
  r: number,
  { cut = true, turn = 0 }: { cut?: boolean; turn?: number } = {},
): void {
  const px = raster(g);
  const s = scaleOf(g);
  const ox = cx * s;
  const oy = cy * s;
  const rr = r * s;
  const a0 = radians(turn - 90);
  const rind = Math.max(1, Math.round(1.3 * s));
  const holes = [
    [130, 0.5],
    [215, 0.45],
    [290, 0.55],
  ].map(
    ([d, k]) =>
      [
        ox + Math.cos(a0 + radians(d!)) * rr * k!,
        oy + Math.sin(a0 + radians(d!)) * rr * k!,
      ] as const,
  );
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const d = Math.hypot(dx, dy);
      if (d > rr) {
        continue;
      }
      const ang = mod(degrees(Math.atan2(dy, dx)) - turn + 90, 360);
      if (cut && d > 0.5 && ang < WHEEL_CUT) {
        continue;
      }
      const light = (dx + dy) / Math.max(d, 1e-9);
      let c: string;
      if (d > rr - rind) {
        c = light < -0.7 ? "gold" : light > 0.5 ? "orange" : "amber";
      } else {
        c = "yellow";
        for (const [hx, hy] of holes) {
          if (Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < Math.max(0.8, 0.12 * rr)) {
            c = "tan";
          }
        }
      }
      px.p(x, y, c);
    }
  }
}

// A wedge of blue cheese lying on its side, x, y to x + w, y + h in design units: its white paste
// shaded lgrey along the bottom, blue veins speckled through it, its rind a cream strip down the tall
// back end on the right, the point at the left.
function blueWedge(g: Drawable, x: number, y: number, w: number, h: number): void {
  g.tri([x + w, y], [x + w, y + h], [x, y + h], "white");
  g.rect(x, y + h - 1, w, 1, "lgrey");
  g.rect(x + w - 1.5, y, 1.5, h, "cream");
  for (const [vx, vy] of [
    [0.2, 0.35],
    [0.35, 0.7],
    [0.15, 0.75],
    [0.55, 0.8],
    [0.28, 0.5],
    [0.75, 0.88],
  ] as const) {
    g.p(x + w * (1 - vx), y + h * vy, "blue");
  }
  for (const [vx, vy] of [
    [0.4, 0.62],
    [0.2, 0.58],
    [0.62, 0.72],
  ] as const) {
    g.p(x + w * (1 - vx), y + h * vy, "sky");
  }
}

// Wavy stink lines in drawn pixels, 1px wide, lime with every third pixel moss, rising from design
// row bottom to row top at each design column in xs; phase (0 to 3) moves the wave up a quarter
// period, so the frames in turn make the lines rise.
function stinkWisps(
  g: Drawable,
  phase: number,
  {
    bottom = 9,
    top = 1,
    xs = [9, 17, 25],
  }: { bottom?: number; top?: number; xs?: readonly number[] } = {},
): void {
  const px = raster(g);
  const s = scaleOf(g);
  const period = Math.max(4, Math.round(4 * s));
  xs.forEach((cx, i) => {
    const y0 = Math.floor((top + (i % 2)) * s);
    const y1 = Math.floor(bottom * s);
    for (let y = y0; y < y1; y++) {
      const k = mod(y + Math.floor((phase * period) / 4) + Math.floor((i * period) / 2), period);
      const dx = [0, 1, 1, 0, 0, -1, -1, 0][Math.floor((k * 8) / period)]!;
      px.p(Math.floor(cx * s) + dx, y, mod(y - y0, 3) === 2 ? "moss" : "lime");
    }
  });
}

// A cheesemonger's slatted wooden crate set out at the shop door, on the 32-unit grid: a stack of two
// whole golden wheels (gold tops lit yellow, amber rinds) at the back left, a cut wheel stood on its
// edge at the right showing its yellow paste, and a wedge of blue cheese lying in front; a small chalk
// price tag hung on the crate's front, and stink wisps rising off the cheese. phase (0 to 3) moves
// the wisps up.
function cheeseCrates(phase = 0): Drawable {
  const g = edged(scope.Grid(32, 32));
  stinkWisps(g, phase);
  // the whole wheels, stacked flat: each a side band of rind, a dark seam under it, under a lit top
  for (const top of [10, 14.5]) {
    g.rect(3.5, top, 11, 4, "amber");
    g.rect(3.5, top + 3.5, 11, 1, "orange");
    g.rect(12.5, top, 2, 4, "orange");
    g.cel(9, top, 5.5, 2, "gold", null, "yellow");
  }
  cheeseWheel(g, 22, 12, 6.5, { turn: 35 });
  blueWedge(g, 6, 12.5, 13, 7);
  crate(g, 3, 19, 26, 12);
  // the chalk price tag on its string, hung from the crate's rim, two lines of chalk writing on it
  g.rect(20.5, 19, 1, 2, "cream");
  g.rect(17, 21, 8, 5, "coal");
  g.rect(18.5, 22.3, 5, 0.7, "white");
  g.rect(18.5, 24, 3, 0.7, "lgrey");
  return lit(g, { coal: ["grey", null] });
}

// The wisps rise a quarter wave a frame.
const CHEESE_IDLE: readonly [readonly number[], number] = [[0, 1, 2, 3], 350];

// ---------- the produce crates ----------

// A slatted wooden crate's front, x, y to x + w, y + h in layout pixels: tan lit cream on its top and
// left, shaded brown down its right, a brown seam between its two slats.
function crate(g: Drawable, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h, "tan");
  g.rect(x, y, w, 1, "cream");
  g.rect(x, y, 1, h, "cream");
  g.rect(x + w - 2, y + 1, 2, h - 1, "brown");
  g.rect(x + 1, y + Math.floor(h / 2), w - 3, 1, "brown");
  g.rect(x, y + h - 1, w, 1, "brown");
}

// A blue plastic stacking crate's front, x, y to x + w, y + h in layout pixels: lake lit shallow
// along its top rim and left edge, shaded dlake down its right and along its foot, a navy handhole
// under the rim and, from obstacles.ts's TEXTURE_MIN up, three dlake vent slots along the bottom.
function plasticCrate(g: Drawable, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h, "lake");
  g.rect(x, y, w, 2, "shallow");
  g.rect(x, y, 1, h, "shallow");
  g.rect(x + w - 2, y + 2, 2, h - 2, "dlake");
  g.rect(x, y + h - 1, w, 1, "dlake");
  g.rect(x + w / 2 - 3, y + 3, 6, 2, "navy");
  if (scaleOf(g) >= ob.TEXTURE_MIN) {
    for (let k = 0; k < 3; k++) {
      g.rect(x + 4 + (k * (w - 6)) / 3, y + h - 5, 2, 3, "dlake");
    }
  }
}

// A grocer's blue plastic crates set down in a lane, laid out on 40x40: two stacked on the left, the
// top one heaped with tomatoes (red, lit pink, green tops), and one on the right with three upright
// heads of bok choy (lime, green crescents and midribs), a stepped outline unlike the cheese crate's
// single tan box. leaf 1 lifts the middle bok choy 1px.
function produceCrates(leaf = 0): Drawable {
  const g = edged(scope.Grid(ob.SIZE, ob.SIZE));
  const u = unit(g);
  (
    [
      [24.5, 21.5],
      [34, 21.5],
      [29.2, 20.5],
    ] as const
  ).forEach(([x, y], i) => {
    const dy = leaf && i === 2 ? -u : 0;
    g.cel(x, y + dy, 3, 5, "lime", "green");
    g.rect(x - 0.5, y - 2 + dy, 1, 6, "green");
  });
  plasticCrate(g, 21, 25, 16, 12);
  const tomatoes = [
    [11.5, 8.5],
    [7, 11],
    [16, 11],
    [9.2, 12.5],
    [13.8, 12.5],
  ] as const;
  for (const [x, y] of tomatoes) {
    g.cel(x, y, 2.4, 2.3, "red", "dred", "pink");
  }
  for (const [x, y] of tomatoes) {
    g.rect(x - 0.8, y - 2.3, 1.7, 1, "green");
  }
  plasticCrate(g, 3, 13, 17, 12);
  plasticCrate(g, 3, 25, 17, 12);
  return lit(g, { dlake: ["lake", null], lake: ["shallow", null] });
}

const PRODUCE_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 400];

// ---------- the clothing rack ----------

// A rolling rack of vintage clothes, laid out on 40x40: chrome uprights (lgrey lit white, grey on the
// right) on splayed feet over ink casters, a bar across the top with the hangers' hooks over it, and
// four garments hung overlapping: a mustard corduroy jacket (ochre, two amber wales, none below
// obstacles.ts's TEXTURE_MIN), a plain lilac dress, a denim jacket (sky, shaded blue, cyan stitching)
// and a turquoise and cream striped tee. sway 1 swings the dress's hem 1px right.
function clothingRack(sway = 0): Drawable {
  const g = edged(scope.Grid(ob.SIZE, ob.SIZE));
  const u = unit(g);
  // uprights, feet and casters
  for (const x of [3, 35]) {
    g.rect(x, 3, 2, 31, "lgrey");
    g.rect(x + 1, 3, 1, 31, "grey");
    g.rect(x - 2, 33, 6, 2, "grey");
    g.rect(x - 2, 33, 6, 1, "lgrey");
    for (const cx of [x - 2, x + 3]) {
      g.rect(cx, 35, 2, 2, "ink");
    }
  }
  g.rect(3, 3, 34, 2, "lgrey");
  g.rect(3, 4, 34, 1, "grey");
  for (const x of [9, 16, 24, 31]) {
    g.rect(x, 1, 1, 2, "grey");
    g.p(x + 1, 1, "grey");
  }
  // the corduroy jacket
  g.tri([5, 5], [13, 5], [9, 3], "ochre");
  g.rect(5, 5, 9, 21, "ochre");
  if (scaleOf(g) >= ob.TEXTURE_MIN) {
    for (const x of [7, 11]) {
      g.rect(x, 9, 1, 16, "amber");
    }
  }
  g.tri([7, 5], [9, 5], [9, 12], "brown");
  g.tri([11, 5], [9, 5], [9, 12], "rust");
  // the dress, its skirt flaring to the hem
  const s = sway * u;
  g.rect(13, 5, 7, 9, "lilac");
  g.tri([13, 14], [20, 14], [11 + s, 30], "lilac");
  g.tri([20, 14], [11 + s, 30], [22 + s, 30], "lilac");
  g.tri([18, 14], [20, 14], [22 + s, 30], "violet");
  g.rect(13, 13, 7, 1, "violet");
  // the denim jacket
  g.rect(20, 5, 9, 18, "sky");
  g.rect(27, 6, 2, 17, "blue");
  g.tri([22, 5], [24.5, 5], [24.5, 11], "blue");
  g.rect(24.5, 11, 1, 12, "blue");
  g.rect(21, 15, 7, 1, "cyan");
  g.rect(21, 22, 8, 1, "blue");
  // the striped tee
  g.rect(28, 5, 7, 14, "cream");
  for (let y = 6; y < 19; y += 3) {
    g.rect(28, y, 7, 1, "dturq");
  }
  g.rect(28, 5, 7, 1, "turquoise");
  return lit(g, {
    dturq: ["turquoise", null],
    lilac: ["pink", null],
    violet: ["lilac", null],
  });
}

const RACK_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 450];

// ---------- the market stall ----------

// Below this scale the record is too small to hold its 2px label and stay a black disc, so it is
// drawn plain.
const LABEL_MIN = 0.85;

// A bark crate of record sleeves 8 wide, its top at layout row y, the sleeves' tops showing over it
// in lilac, cream and dlake, and beside it a black record stood on its edge, its lilac label in the
// middle, 2 drawn pixels square (left out below LABEL_MIN).
function records(g: Drawable, x: number, y: number): void {
  (["lilac", "cream", "dlake"] as const).forEach((c, i) => {
    g.rect(x + 0.5 + i * 2.5, y + 0.5 - (i % 2) * 0.5, 2.5, 3, c);
  });
  g.rect(x, y + 2.5, 8, 4.5, "bark");
  g.rect(x, y + 2.5, 8, 1, "clay");
  g.cel(x + 11.5, y + 3.5, 3.5, 3.5, "coal");
  const s = scaleOf(g);
  if (s >= LABEL_MIN) {
    raster(g).rect(
      Math.floor((x + 11.5) * s) - 1,
      Math.floor((y + 3.5) * rowScaleOf(g)) - 1,
      2,
      2,
      "lilac",
    );
  }
}

// A stack of folded clothes 8 wide, its top at layout row y: lilac over cream over a dlake sweater,
// each fold a step longer than the one above.
function folded(g: Drawable, x: number, y: number): void {
  (
    [
      ["lilac", "violet"],
      ["cream", "driftwood"],
      ["dlake", "dslate"],
    ] as const
  ).forEach(([c, sh], k) => {
    g.rect(x + 1 - k * 0.5, y + k * 2.4, 7 + k, 2.4, c);
    g.rect(x + 7 + k * 0.5, y + k * 2.4, 1, 2.4, sh);
  });
}

// Two glass jars, 3 wide and 5 tall under bark lids, their tops at layout row y.
function jars(g: Drawable, x: number, y: number): void {
  for (let k = 0; k < 2; k++) {
    const jx = x + k * 4;
    g.rect(jx, y + 1, 3, 4.5, "haze");
    g.rect(jx + 2, y + 1, 1, 4.5, "stone");
    g.rect(jx, y, 3, 1.2, "bark");
  }
}

// Three book spines standing in a row, 2.5 wide and 6 or 7 tall, their feet on layout row y + 7.
function books(g: Drawable, x: number, y: number): void {
  (
    [
      ["brick", 7],
      ["dlake", 6],
      ["cream", 7],
    ] as const
  ).forEach(([c, h], k) => {
    g.rect(x + k * 2.5, y + 7 - h, 2.5, h, c);
  });
}

// A small lidded cardboard box 7 wide, its lid at layout row y + 2.
function box(g: Drawable, x: number, y: number): void {
  g.rect(x, y + 3, 7, 4, "clay");
  g.rect(x - 0.5, y + 2, 8, 1.5, "driftwood");
  g.rect(x + 6, y + 3, 1, 4, "bark");
}

// The stall's height in layout pixels: 48 drawn, a whole number of rows at every depth step.
const STALL_H = 40;

// The goods on each table, left to right, as [draw, layout width], as many as fit: table k starts the
// list at 2k (wrapping), so no two tables match.
const GOODS: readonly (readonly [(g: Drawable, x: number, y: number) => void, number])[] = [
  [records, 15],
  [folded, 10],
  [books, 10],
  [jars, 9],
  [box, 9],
];

// Front elevation across lanes lanes, laid out in obstacles.ts's pixels (obstacles.ts's span(lanes)
// by STALL_H): a flea market's row of folding tables, one per lane, under a striped awning on thin
// coal poles. The awning runs the whole width in faded dturq and cream stripes, its sloped top over a
// deep valance with a scalloped hem, open air under it between the poles; under that each table's
// clay top, lit driftwood and shaded bark, stands on crossed coal legs, laid with chunky goods: a
// crate of records with a black record propped up (lilac label), folded clothes, book spines, glass
// jars and a lidded box. flap lifts the hem's middle half 1 drawn pixel.
function marketStall(lanes: number, flap = 0): Drawable {
  const w = ob.span(lanes);
  const g = edged(scope.Grid(w, STALL_H));
  const px = raster(g);
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const toX = (v: number): number => Math.floor(v * s + 0.5);
  const toY = (v: number): number => Math.floor(v * sy + 0.5);
  const poles = [2, ...range(1, lanes).map((k) => (w * k) / lanes - 1), w - 4];
  // the poles, coal lit ash down their left
  for (const x of poles) {
    g.rect(x, 8, 2, STALL_H - 8.5, "coal");
    g.rect(x, 8, 1, STALL_H - 8.5, "ash");
  }
  // the tables, one between each pair of poles: crossed legs under a clay top, the goods laid on it
  const table = STALL_H - 12;
  const legs = table + 2;
  const foot = STALL_H - 1.5;
  for (let k = 0; k < lanes; k++) {
    const a = poles[k]! + 3;
    const b = poles[k + 1]! - 1;
    for (const lx of [a + 3, b - 8]) {
      for (let t = 0; t < 12; t++) {
        const f = t / 11;
        g.rect(lx + 5 * f, legs + (foot - legs) * f, 1.4, 1.4, "coal");
        g.rect(lx + 5 - 5 * f, legs + (foot - legs) * f, 1.4, 1.4, "coal");
      }
    }
    let x = a + 2;
    const goods = [...GOODS.slice((2 * k) % GOODS.length), ...GOODS];
    let room = b - a - 3;
    for (const [draw, gw] of goods) {
      if (gw > room) {
        break;
      }
      draw(g, x, table - 7);
      x += gw;
      room -= gw;
    }
    g.rect(a, table, b - a, 1, "driftwood");
    g.rect(a, table + 1, b - a, 2.5, "clay");
    g.rect(a, table + 3, b - a, 1, "bark");
  }
  // the awning: a sloped top over a deep valance of stripes 6 layout pixels wide, scalloped along its
  // hem
  const left = 0.5;
  const right = w - 0.5;
  g.tri([left + 4, 0.5], [right - 4, 0.5], [left, 5], "dturq");
  g.tri([right - 4, 0.5], [right, 5], [left, 5], "dturq");
  const x0 = toX(left);
  const x1 = toX(right);
  const top = toY(5);
  const hem = toY(12);
  const stripe = Math.max(4, toX(6));
  const lift = [x0 + Math.floor((x1 - x0) / 4), x1 - Math.floor((x1 - x0) / 4)] as const;
  for (let x = x0; x < x1; x++) {
    const n = Math.floor((x - x0) / stripe);
    const c = n % 2 ? "cream" : "dturq";
    for (let y = toY(0.5); y < top; y++) {
      if (px.px[y]![x]) {
        px.p(x, y, n % 2 ? "driftwood" : "dturq");
      }
    }
    // the scallop: each stripe's hem rounds down to a tab in its middle
    const t = (((x - x0) % stripe) + 0.5) / stripe;
    const tab = Math.round(toY(2) * (1 - (2 * t - 1) ** 2));
    const up = flap && lift[0] <= x && x < lift[1] ? 1 : 0;
    for (let y = top; y < hem + tab - up; y++) {
      px.p(x, y, c);
    }
  }
  px.rect(x0, top, x1 - x0, 1, "teal");
  return lit(g, {
    bark: ["clay", null],
    brick: ["clay", null],
    clay: ["driftwood", null],
    coal: ["ash", null],
    dlake: ["lake", null],
    dturq: ["turquoise", null],
    teal: ["dturq", null],
  });
}

const STALL_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 500];

// ---------- the cargo bike ----------

// The flowers in the box: [centre column, row, petals, their shade, centre or null]. Sunflowers with
// a dbrown centre and pink tulips, in turn.
const FLOWERS: readonly (readonly [number, number, string, string, string | null])[] = [
  [7.5, 25, "yellow", "amber", "dbrown"],
  [12, 23.5, "pink", "mauve", null],
  [16.5, 24, "yellow", "amber", "dbrown"],
  [21, 23.5, "pink", "mauve", null],
  [25, 25, "yellow", "amber", "dbrown"],
];

interface CargoPose {
  jiggle?: number;
  roll?: number;
  sway?: number;
}

// A cargo bike riding down a lane at the pack, facing it, laid out on 32x48: the small front wheel
// edge-on, a lit headlamp on its fork crown (road.ts's headlamp), under a wide wooden box (tan slats
// lit cream, shaded brown) full of flowers, sunflowers (their dark centres at full size and the
// larger steps) and pink tulips in turn over green leaves; behind it the rider in a turquoise jacket
// with a rust beanie and an ochre pompom, dark curls showing under it, hands on the wide handlebar.
// sway shifts the rider 1 drawn pixel over the bars; jiggle lifts alternate flowers 1px; roll (0 to
// 3) rolls a grey tread line down the tire.
function cargoBike({ jiggle = 0, roll = 0, sway = 0 }: CargoPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const u = unit(g);
  const w = sway * u;
  // the front wheel under the box, its fork and a tread line rolling down it
  g.blob(16, 42, 2.5, 4.5, "ink");
  g.rect(15.5, 37.5, 1, 4, "lgrey");
  const px = raster(g);
  const s = scaleOf(g);
  const top = Math.floor(39 * s);
  const bottom = Math.floor(46 * s);
  const period = Math.max(3, Math.round(4 * s));
  for (let y = top; y < bottom; y++) {
    if (mod(y - top - roll, period) === 0) {
      for (let x = Math.floor(15 * s); x < Math.ceil(17 * s); x++) {
        if (px.px[y]![x] === K.ink) {
          px.p(x, y, "slate");
        }
      }
    }
  }
  // the rider: jacket, arms out to the grips, head under the beanie
  g.rect(10 + w, 15, 12, 10, "turquoise");
  g.rect(19 + w, 15, 3, 10, "dturq");
  g.rect(15.5 + w, 16, 1, 8, "dturq");
  line(
    g,
    [
      [9 + w, 16],
      [6, 20],
    ],
    3,
    "turquoise",
  );
  line(
    g,
    [
      [21 + w, 16],
      [24, 20],
    ],
    3,
    "dturq",
  );
  g.rect(4, 21, 24, 1.5, "grey");
  g.rect(4, 21, 24, 0.5, "lgrey");
  for (const x of [2, 27]) {
    g.rect(x, 20.5, 3, 2.5, "ink");
  }
  g.rect(4, 19.5, 3, 2, "skin2");
  g.rect(25, 19.5, 3, 2, "skin2");
  g.rect(14 + w, 13, 4, 2, "skin2");
  g.rect(8.5 + w, 7, 3, 6, "dbrown");
  g.rect(20.5 + w, 7, 3, 6, "dbrown");
  faceDisc(g, 16 + w, 9.5, 6.5, 5.5, "skin2", "brown");
  g.cel(16 + w, 6, 7.5, 4.5, "rust", "dbrown", "ochre");
  g.rect(8.5 + w, 6.5, 15, 1.5, "rust");
  g.rect(8.5 + w, 7.5, 15, 1, "dbrown");
  g.cel(16 + w, 1.6, 2, 1.6, "ochre", "brown", "tan");
  scope.faceFront(g, 16 + w, 9.5, { eyes: "ink", lips: "plum" });
  // the leaves and flowers heaped in the box
  for (let x = 6; x < 27; x += 3) {
    g.cel(x, 27, 2.2, 2, "canopy", "pine", "green");
  }
  FLOWERS.forEach(([x, y, c, sh, mid], i) => {
    const dy = jiggle && i % 2 === jiggle - 1 ? -u : 0;
    g.cel(x, y + dy, 2.4, 2.2, c, sh);
    if (mid && scaleOf(g) >= 1) {
      g.rect(x - 0.5, y + dy - 0.5, 1, 1, mid);
    }
  });
  // the box: its slatted front, lit along the top and left, shaded down the right
  g.rect(4, 28, 24, 10, "tan");
  g.rect(4, 28, 24, 1, "cream");
  g.rect(4, 28, 1, 10, "cream");
  g.rect(26, 29, 2, 9, "brown");
  g.rect(5, 32, 21, 1, "brown");
  g.rect(4, 37, 24, 1, "brown");
  // the lit headlamp on the fork crown under the box
  road.headlamp(g, 16, 39.5);
  return lit(g, { dturq: ["turquoise", null] });
}

const CARGO_RIDE: readonly [readonly CargoPose[], number] = [
  [{ jiggle: 1, roll: 0, sway: -1 }, { roll: 1 }, { jiggle: 2, roll: 2, sway: 1 }, { roll: 3 }],
  100,
];

// ---------- sprites ----------

// draw(arg) on a Mini at s for each arg, outlined.
function frames<Q>(s: number, draw: (q: Q) => Drawable, args: readonly Q[]): Frame[] {
  return args.map((q) => drawn(s, draw, q).outlined());
}

// Every road sprite at depth step s, [key, [[tag, frames, duration ms]]]: people, movers and the card
// obstacles drawn at PERSON x s, the minor obstacles at OBSTACLE x s.
function* roadSprites(s = 1): Generator<Sprite> {
  const p = PERSON * s;
  const o = OBSTACLE * s;
  const tag = <Q>(
    name: string,
    scale: number,
    draw: (q: Q) => Drawable,
    [args, ms]: readonly [readonly Q[], number],
  ): Tag => [name, frames(scale, draw, args), ms];
  yield ["wedding-photo-shoot", [tag("idle", p, weddingPhotoShoot, SHOOT_IDLE)]];
  yield ["velvet-rope", [tag("idle", o, (glint) => velvetRope(glint), VELVET_IDLE)]];
  const [idle, idleMs] = BARREL_IDLE;
  const [run, runMs] = BARREL_RUN;
  yield [
    "rolling-barrel",
    [
      tag("idle", p, rollingBarrel, [idle.map(([rock]) => ({ rock })), idleMs]),
      tag("run", p, rollingBarrel, [run.map(([turn, dust]) => ({ dust, turn })), runMs]),
    ],
  ];
  yield ["barrel-stack", [tag("idle", o, barrelStack, STACK_IDLE)]];
  yield ["art-sculpture", [tag("idle", o, artSculpture, SCULPTURE_IDLE)]];
  yield [GREEN_BIN_SPILL, [tag("idle", p, greenBinSpill, BIN_IDLE)]];
  yield [CHEESE, [tag("idle", p, cheeseCrates, CHEESE_IDLE)]];
  yield ["produce-crates", [tag("idle", o, produceCrates, PRODUCE_IDLE)]];
  yield ["clothing-rack", [tag("idle", o, clothingRack, RACK_IDLE)]];
  const [flaps, stallMs] = STALL_IDLE;
  for (const lanes of [2, 3]) {
    yield [
      `market-stall-${lanes}`,
      [["idle", flaps.map((a) => drawn(o, marketStall, lanes, a).outlined()), stallMs]],
    ];
  }
  yield ["cargo-bike", [tag("ride", p, cargoBike, CARGO_RIDE)]];
}

// ---------- hit bursts ----------

const PETALS: readonly (readonly [number, number, string])[] = [
  [-1.0, -0.9, "pink"],
  [1.0, -1.0, "white"],
  [-1.3, -0.2, "red"],
  [1.3, -0.3, "pink"],
  [-0.6, -1.3, "white"],
  [0.7, -1.4, "red"],
  [-1.2, 0.5, "pink"],
  [1.2, 0.4, "white"],
];

// The bride's bouquet, 9x10 design units round cx, cy: five roses over green stems, tilted tilt (-1,
// 0, 1) as it tumbles.
function bouquet(g: Drawable, cx: number, cy: number, tilt: number): void {
  for (const [x, y, c, sh] of [
    [-3, 0, "pink", "mauve"],
    [0, -1.5, "red", "dred"],
    [3, 0, "pink", "mauve"],
    [-1.5, 2, "cream", "tan"],
    [1.5, 2, "red", "dred"],
  ] as const) {
    g.cel(cx + 1.3 * (x + tilt * y * 0.4), cy + 1.3 * (y - tilt * x * 0.3), 2.6, 2.6, c, sh);
  }
  for (let k = 0; k < 5; k++) {
    g.rect(cx - 1 + tilt * (k + 3) * 0.6, cy + 5 + k, 2, 1, "canopy");
  }
  g.rect(cx - 2 + tilt * 3, cy + 6, 4, 1, "white");
}

// A lilac impact star, then the camera flash flares white and yellow and fades, the bouquet flies up
// out of it tumbling, and eight petals scatter and drift down.
function hitWeddingPhotoShoot(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 36;
  if (step === 0) {
    hits.impact(g, "lilac", cx, cy);
    return hits.rim(g);
  }
  const r = [0, 20, 15, 10, 6, 3, 0, 0][step]!;
  if (r) {
    hits.piece(g, (p) => {
      for (let k = 0; k < 4; k++) {
        const a = radians(k * 90 + 45);
        p.tri(
          [cx, cy],
          [cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45],
          [cx + Math.cos(a + 0.8) * r * 0.25, cy + Math.sin(a + 0.8) * r * 0.25],
          "yellow",
        );
      }
      p.tri([cx - r, cy], [cx, cy - r * 0.18], [cx, cy + r * 0.18], "white");
      p.tri([cx + r, cy], [cx, cy - r * 0.18], [cx, cy + r * 0.18], "white");
      p.tri([cx, cy - r], [cx - r * 0.18, cy], [cx + r * 0.18, cy], "white");
      p.tri([cx, cy + r], [cx - r * 0.18, cy], [cx + r * 0.18, cy], "white");
      p.ell(cx, cy, Math.max(1.5, r * 0.3), Math.max(1.5, r * 0.3), "white");
    });
  }
  const t = step - 0.5;
  PETALS.forEach(([vx, vy, c], i) => {
    const x = cx + vx * 9 * t;
    const y = cy + vy * 9 * t + 0.9 * t * t;
    if (x >= 3 && x < 60 && y >= 3 && y < 60 && step >= 2) {
      hits.piece(g, (p) => {
        if ((step + i) % 2) {
          p.rect(x, y, 2, 2, c);
        } else {
          p.rect(x, y, 2.5, 1.5, c);
        }
      });
    }
  });
  const by = [0, 30, 20, 14, 12, 13, 16, 20][step]!;
  const tilt = [0, 0, 1, 0, -1, 0, 1, 0][step]!;
  hits.piece(g, (p) => bouquet(p, cx, by, tilt));
  return g;
}

// A gold impact star, then a puff of lime stink swelling up and shrinking away as the cut cheese
// wheel bounces up out of it and rolls away to the right, turning a quarter turn a frame, crumbs
// thrown out either side and stink wisps rising off the puff.
function hitCheeseCrates(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 42;
  if (step === 0) {
    hits.impact(g, "gold", cx, cy - 4);
    return hits.rim(g);
  }
  const r = [0, 7, 11, 14, 15, 13, 10, 6][step]!;
  hits.piece(g, (p) => {
    for (const [dx, dy, k] of [
      [-9, 1, 0.7],
      [9, 1, 0.7],
      [0, -3, 1],
      [-5, -8, 0.6],
      [5, -9, 0.55],
    ] as const) {
      p.cel(
        cx + (dx * r) / 14,
        cy + (dy * r) / 14,
        r * k * 0.6 + 1,
        r * k * 0.45 + 1,
        "lime",
        null,
        "yellow",
      );
    }
    p.rect(cx - r * 0.9, cy + r * 0.3, r * 1.8, 1, "moss");
  });
  if (step >= 3) {
    hits.piece(g, (p) =>
      stinkWisps(p, step % 4, {
        bottom: cy - 6 - r * 0.5,
        top: cy - 24 + step,
        xs: [cx - 9, cx, cx + 9],
      }),
    );
  }
  const t = step - 0.5;
  (
    [
      [-9, -8],
      [9, -7],
      [-12, -3],
      [12, -4],
      [-5, -10],
      [6, -10],
    ] as const
  ).forEach(([vx, vy], i) => {
    const x = cx + vx * t * 0.8;
    const y = cy - 4 + vy * t * 0.8 + 1.3 * t * t;
    if (x >= 3 && x < 60 && y >= 3 && y < 60) {
      hits.piece(g, (p) => p.rect(x, y, 2, 2, i % 2 ? "yellow" : "amber"));
    }
  });
  const wx = [0, 30, 33, 37, 41, 45, 48, 51][step]!;
  const wy = [0, 32, 22, 17, 18, 24, 32, 28][step]!;
  hits.piece(g, (p) => cheeseWheel(p, wx, wy, 8, { turn: step * 90 }));
  return g;
}

// The splat's arms: [angle in degrees, 0 to the right and clockwise, reach and width as shares of its
// radius].
const SPLAT_ARMS: readonly (readonly [number, number, number])[] = [
  [200, 1.0, 0.3],
  [250, 0.8, 0.26],
  [300, 1.05, 0.28],
  [345, 0.85, 0.3],
  [30, 0.95, 0.26],
  [85, 0.7, 0.3],
  [135, 0.9, 0.28],
];
// The scraps thrown out of the splat: [x speed, y speed, colour] in design units a frame.
const SCRAPS: readonly (readonly [number, number, string])[] = [
  [-10, -7, "clay"],
  [10, -8, "green"],
  [-13, -2, "cream"],
  [13, -3, "clay"],
  [-5, -11, "green"],
  [6, -11, "clay"],
];

// The banana peel in the air round design point cx, cy, turned angle degrees clockwise: a bark stem
// over a yellow neck, a flap splayed out either side and cream inside showing between them.
function flyingPeel(g: Drawable, cx: number, cy: number, angle: number): void {
  const a = radians(angle);
  const turned = (pts: readonly Point[], c: string): void => {
    poly(
      g,
      pts.map(
        ([x, y]) =>
          [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as const,
      ),
      c,
    );
  };
  turned(
    [
      [-2.5, -3],
      [-9, 5],
      [-4.5, 6.5],
      [0, 0],
    ],
    "yellow",
  );
  turned(
    [
      [2.5, -3],
      [0, 0],
      [4.5, 6.5],
      [9, 5],
    ],
    "yellow",
  );
  turned(
    [
      [-3, -7],
      [3, -7],
      [3, -1],
      [-3, -1],
    ],
    "yellow",
  );
  turned(
    [
      [-2.5, -1.5],
      [2.5, -1.5],
      [0, 7.5],
    ],
    "cream",
  );
  turned(
    [
      [-1.6, -11],
      [1.6, -11],
      [1.6, -7],
      [-1.6, -7],
    ],
    "bark",
  );
}

// A green impact star, then a comic splat of olive compost slop swelling out, a moss shine on its
// upper left and its round-ended arms reaching out, drops flying off every other arm as it shrinks;
// the banana peel flung up out of it, tumbling over as it rises and falls, and scraps (clay, a green
// lettuce leaf, a cream eggshell) thrown out either side.
function hitGreenBinSpill(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 40;
  if (step === 0) {
    hits.impact(g, "green", cx, cy - 2);
    return hits.rim(g);
  }
  const r = [0, 9, 13, 14, 13, 11, 9, 7][step]!;
  hits.piece(g, (p) => {
    p.ell(cx, cy, r * 0.62, r * 0.55, "olive");
    for (const [deg, reach, w] of SPLAT_ARMS) {
      const a = radians(deg);
      const ex = cx + Math.cos(a) * r * reach;
      const ey = cy + Math.sin(a) * r * reach;
      const nx = -Math.sin(a) * r * w;
      const ny = Math.cos(a) * r * w;
      poly(
        p,
        [
          [cx + nx, cy + ny],
          [cx - nx, cy - ny],
          [ex - nx * 0.3, ey - ny * 0.3],
          [ex + nx * 0.3, ey + ny * 0.3],
        ],
        "olive",
      );
      p.ell(ex, ey, r * w * 0.55 + 0.6, r * w * 0.55 + 0.6, "olive");
    }
    p.ell(cx - r * 0.18, cy - r * 0.18, r * 0.3, r * 0.22, "moss");
  });
  if (step >= 3) {
    for (const [deg, reach] of SPLAT_ARMS.filter((_, i) => i % 2 === 0)) {
      const a = radians(deg);
      const d = r * reach + 2.5 + (step - 2) * 3;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d + (step - 2) ** 2 * 0.6;
      if (x >= 3 && x < 60 && y >= 3 && y < 60) {
        hits.piece(g, (p) => p.ell(x, y, 1.7, 1.7, "olive"));
      }
    }
  }
  const t = step - 0.5;
  SCRAPS.forEach(([vx, vy, c], i) => {
    const x = cx + vx * t * 0.85;
    const y = cy - 4 + vy * t * 0.85 + 1.3 * t * t;
    if (x >= 3 && x < 60 && y >= 3 && y < 60) {
      hits.piece(g, (p) => {
        if (i % 2) {
          p.rect(x, y, 3.5, 2.5, c);
        } else {
          p.rect(x, y, 2.5, 3.5, c);
        }
      });
    }
  });
  const peelX = [0, 31, 30, 29, 28, 27, 26, 25][step]!;
  const peelY = [0, 32, 19, 12, 10, 12, 17, 24][step]!;
  const angle = [0, -20, -60, -110, -160, -210, -250, -290][step]!;
  hits.piece(g, (p) => flyingPeel(p, peelX, peelY, angle));
  return g;
}

const HIT_BURSTS: ReadonlyMap<string, readonly [draw: (step: number) => Drawable, frames: number]> =
  new Map([
    ["fx-hit-wedding-photo-shoot", [hitWeddingPhotoShoot, 8]],
    [`fx-hit-${CHEESE}`, [hitCheeseCrates, 8]],
    [`fx-hit-${GREEN_BIN_SPILL}`, [hitGreenBinSpill, 8]],
  ]);

// The hit bursts, as hits.ts's sprites draws its own.
function* burstSprites(): Generator<Sprite> {
  for (const [key, [draw, n]] of HIT_BURSTS) {
    yield [key, [["play", range(0, n).map((i) => hits.burstFrame(draw, i).outlined(false)), 70]]];
  }
}

// Every sprite: the road sprites, their depth variants, then the hit bursts.
export function* sprites(): Generator<Sprite> {
  yield* roadSprites();
  for (const [suffix, s] of STEPS) {
    for (const [key, tags] of roadSprites(s)) {
      yield [`${key}@${suffix}`, tags];
    }
  }
  yield* burstSprites();
}

// ---------- cards ----------

// cards.ts, loaded on first use: only the card commands need it and its image dependencies.
type Cards = typeof import("./cards.ts");
type Art = InstanceType<Cards["Art"]>;

async function loadCards(): Promise<Cards> {
  return import("./cards.ts");
}

// Some of the wedding photo shoot's figures at 1x, as an image the size of its frame.
function figure(
  parts: readonly ShootPart[],
  { flash = false, pay = false }: { flash?: boolean; pay?: boolean } = {},
): RgbaImage {
  return toImage(drawn(PERSON, weddingPhotoShoot, { flash, parts, pay }).outlined());
}

// The first opaque row of image.
function topRow(image: RgbaImage): number {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3]) {
        return y;
      }
    }
  }
  return 0;
}

// Pose: the bride smiling at the left with Archie sitting at her side, the photographer's camera at
// the right edge firing its flash at them, hearts rising.
function cardWeddingPose(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("distilleryDistrict");
  a.shadow(18, 62, 30);
  a.paste(figure(["bride"]), -6, -11);
  a.paste(figure(["photographer"], { flash: true }), -10, -12);
  const c = a.dog("archie", "idle", 36, 62);
  a.lead(36, c, 42);
  a.hearts([
    [26, 2],
    [38, 12],
  ]);
  return a;
}

// A dashed trail through the joints pts, dash pixels on and gap off along it.
function arc(a: Art, pts: readonly Point[], col: string, dash = 2, gap = 2): void {
  const run = new Map<string, Point>();
  for (const [[x0, y0], [x1, y1]] of pairs(pts)) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k < n; k++) {
      const p = [
        Math.round(x0 + ((x1 - x0) * k) / n),
        Math.round(y0 + ((y1 - y0) * k) / n),
      ] as const;
      const key = p.join(",");
      if (!run.has(key)) {
        run.set(key, p);
      }
    }
  }
  [...run.values()].forEach(([x, y], k) => {
    if (k % (dash + gap) < dash) {
      a.fill(x, y, 1, 1, col);
    }
  });
}

// n + 1 points along the quadratic Bezier curve p0, p1, p2.
function bezier(p0: Point, p1: Point, p2: Point, n = 24): Point[] {
  return range(0, n + 1).map((k) => {
    const t = k / n;
    return [
      (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
      (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
    ] as const;
  });
}

// Walk around: the shoot posing up the road at the left, drawn small, the flash firing, while
// Archie, up the road at the right, pulls out wide round it, a dashed white trail curving from the
// bottom edge out past him and back in over the top of the shoot.
function cardWeddingWalkAround(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("distilleryDistrict");
  const shoot = toImage(drawn(PERSON * 0.45, weddingPhotoShoot, { flash: true }).outlined());
  a.shadow(10, 34, 20);
  a.shadow(32, 34, 20);
  a.paste(shoot, 1, 34 - shoot.height);
  arc(a, bezier([40, 60], [100, 30], [34, -4]), "white");
  const c = a.dog("archie", "pull", 60, 52, { step: 75 });
  a.lead(60, c, 50);
  return a;
}

// Pay for a reshoot: the bride posing again at the left, the photographer's camera at the right edge
// lined up on her, its flash not yet fired, while his free hand reaches out to take a bill, Archie
// sitting aside at his feet, out of the shot.
function cardWeddingReshoot(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("distilleryDistrict");
  a.shadow(18, 62, 30);
  a.paste(figure(["bride"]), -6, -11);
  a.paste(sn.image("icon-bill"), 33, 31);
  a.paste(figure(["photographer"], { pay: true }), -10, -12);
  const c = a.dog("archie", "idle", 62, 62);
  a.lead(62, c, 66);
  return a;
}

// The green bin's slop spilt across the cobbles: the union of the ellipses blobs [cx, cy, rx, ry],
// olive with a dolive rim and moss in its depths.
function slime(
  cards: Cards,
  a: Art,
  blobs: readonly (readonly [number, number, number, number])[],
): void {
  const inside = (x: number, y: number, inset: number): boolean =>
    blobs.some(
      ([cx, cy, rx, ry]) =>
        rx > inset &&
        ry > inset &&
        ((x + 0.5 - cx) / (rx - inset)) ** 2 + ((y + 0.5 - cy) / (ry - inset)) ** 2 <= 1,
    );
  for (let y = 0; y < cards.AH; y++) {
    for (let x = 0; x < cards.AW; x++) {
      if (inside(x, y, 0)) {
        a.fill(x, y, 1, 1, inside(x, y, 3.5) ? "moss" : inside(x, y, 1.2) ? "olive" : "dolive");
      }
    }
  }
}

// The banana peel draped over a dog's head, tipped to one side, on a 22x18 design grid, as flyingPeel
// draws it.
function headPeel(): Drawable {
  const g = edged(scope.Grid(22, 18));
  flyingPeel(g, 11, 10, 20);
  return lit(g);
}

// One 3x2 scrap of compost lying on the road, outlined two ramp steps darker.
function scrap(cards: Cards, col: string): RgbaImage {
  return cards.pixmap(["xxx", "xx."], { x: col });
}

// Wade through: the toppled green bin drawn small up the road at the left, its olive slop running
// down across the cobbles with clay and green scraps lying in it, and Archie wading through it at the
// right, the banana peel draped over his head and brown splats on his coat.
function cardBinWadeThrough(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("kensingtonMarket");
  slime(cards, a, [
    [18, 24, 11, 3],
    [28, 34, 20, 5],
    [40, 45, 30, 8],
    [42, 54, 34, 5],
  ]);
  const bin = toImage(drawn(PERSON * 0.6, greenBinSpill).outlined());
  a.paste(bin, 16 - Math.floor(bin.width / 2), 26 - bin.height);
  for (const [x, y, col] of [
    [24, 33, "green"],
    [8, 43, "clay"],
    [62, 38, "clay"],
    [18, 51, "green"],
    [66, 51, "clay"],
  ] as const) {
    a.paste(scrap(cards, col), x, y);
  }
  const cx = 44;
  const foot = 56;
  const c = a.dog("archie", "walk", cx, foot, { i: 1 });
  const dog = sn.frame("dog-archie", "walk", 1);
  const peel = toImage(drawn(PERSON * 0.45, headPeel).outlined());
  a.paste(peel, cx - Math.floor(peel.width / 2) + 1, foot - dog.height + topRow(dog) - 6);
  for (const [x, y] of [
    [37, 40],
    [50, 44],
    [41, 48],
  ] as const) {
    a.fill(x, y, 2, 2, "brown");
    a.fill(x + 1, y + 1, 1, 1, "dbrown");
  }
  a.lead(cx, c, 52);
  return a;
}

// The shopkeeper come out to sweep up, facing the player: a lilac shirt under a long cream apron,
// short dbrown hair, the near hand (screen left) raised beside the face to hold up the fee and the
// other holding a broom upright by its clay handle, its tan head of bristles hanging just under the
// hand.
function sweeperTop(g: Drawable, b: number): void {
  g.rect(9, 21 + b, 14, 13, "lilac");
  g.rect(20, 21 + b, 3, 13, "violet");
  g.rect(11, 23 + b, 10, 12, "cream");
  g.rect(19, 23 + b, 2, 12, "tan");
  g.rect(11, 21 + b, 1, 2, "cream");
  g.rect(20, 21 + b, 1, 2, "tan");
  g.rect(5, 22 + b, 4, 4, "lilac");
  g.rect(4, 15 + b, 4, 8, "lilac");
  g.rect(4, 13 + b, 4, 3, "skin1");
  road.backArm(g, 23, 4, 22 + b, [
    [8, "lilac", "violet"],
    [3, "skin1", null],
  ]);
  line(
    g,
    [
      [28.5, 12 + b],
      [25.5, 35 + b],
    ],
    1.5,
    "clay",
  );
  g.tri([22, 40 + b], [30, 40 + b], [25.5, 34 + b], "tan");
  g.rect(23.5, 34 + b, 4, 1.5, "brown");
  g.rect(24, 31 + b, 3, 3, "skin1");
  faceDisc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2");
  scope.faceFront(g, 16, 14 + b);
  g.cel(16, 8 + b, 7.5, 3.5, "dbrown", "plum", "brown");
  g.rect(8.5, 8 + b, 2, 4, "dbrown");
  g.rect(21.5, 8 + b, 2, 4, "dbrown");
}

// Pay for cleanup: the toppled green bin at the left with Archie sitting by it, and the shopkeeper at
// the right, broom in hand, holding up the bill he has been paid.
function cardBinPay(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("kensingtonMarket");
  const bin = toImage(drawn(PERSON * 0.75, greenBinSpill).outlined());
  a.shadow(18, 34, bin.width);
  a.paste(bin, 18 - Math.floor(bin.width / 2), 34 - bin.height);
  const keeper = toImage(
    road.drawn(PERSON, road.dressed, sweeperTop, { legs: "slate", shoes: "ink" }).outlined(),
  );
  a.paste(keeper, 31, -4);
  a.paste(sn.image("icon-bill"), 31, 4);
  const c = a.dog("archie", "idle", 22, 60);
  a.lead(22, c, 28);
  return a;
}

// Hurry past: the toppled green bin up the road at the right, Ginger pulling the pack away to the
// left and Archie behind her pulling back toward the bin, both leashes taut off the bottom.
function cardBinHurryPast(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("kensingtonMarket");
  const bin = toImage(drawn(PERSON * 0.75, greenBinSpill).outlined());
  a.shadow(56, 36, bin.width);
  a.paste(bin, 56 - Math.floor(bin.width / 2), 36 - bin.height);
  let c = a.dog("ginger", "pull", 14, 54, { flip: true });
  a.lead(14, c, 4);
  c = a.dog("archie", "pull", 40, 58);
  a.lead(40, c, 26);
  return a;
}

// The shop door's layout: the wall's bottom row and the door's left column.
const WALL = 28;
const DOOR = 26;

// The cheese crate's setting, the same in both neighbourhoods it stands in: a red brick shopfront in
// a running bond of dbrick mortar across the top, a bark wooden door in a dbrown frame with a gold
// knob over a stone step, and stone paving below in dstone courses; shadows dstone, the leash pink.
function shopDoor(cards: Cards, a: Art): void {
  const { AH, AW } = cards;
  a.fill(0, 0, AW, WALL, "brick");
  for (let y = 3; y < WALL; y += 4) {
    a.fill(0, y, AW, 1, "dbrick");
    for (let x = -4 + 4 * (Math.floor(y / 4) % 2); x < AW; x += 8) {
      a.fill(x, y - 3, 1, 3, "dbrick");
    }
  }
  a.fill(0, WALL - 2, AW, 2, "dbrick");
  a.fill(DOOR - 3, 0, 30, WALL - 1, "dbrown");
  a.fill(DOOR, 0, 24, WALL - 1, "bark");
  for (let x = DOOR + 5; x < DOOR + 24; x += 6) {
    a.fill(x, 0, 1, WALL - 1, "walnut");
  }
  a.fill(DOOR + 2, 3, 20, 8, "dbrown");
  a.fill(DOOR + 3, 4, 18, 6, "haze");
  a.fill(DOOR + 3, 4, 18, 1, "white");
  a.fill(DOOR + 20, 16, 2, 2, "gold");
  a.fill(DOOR - 5, WALL - 2, 34, 3, "stone");
  a.fill(DOOR - 5, WALL - 2, 34, 1, "driftwood");
  a.fill(0, WALL + 1, AW, AH - WALL - 1, "stone");
  for (let y = WALL + 7; y < AH; y += 8) {
    a.fill(0, y, AW, 1, "dstone");
  }
  a.shade = "dstone";
  a.leashCol = "pink";
}

// The card pixels pts in col inside a 1px ink line on their four sides, so a mark holds on the
// brick.
function inked(a: Art, pts: readonly Point[], col: string): void {
  const mark = new Set(pts.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of pts) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (!mark.has(`${x + dx},${y + dy}`)) {
        a.fill(x + dx, y + dy, 1, 1, "ink");
      }
    }
  }
  for (const [x, y] of pts) {
    a.fill(x, y, 1, 1, col);
  }
}

// Have a sniff: the cheese crate at the shop door and Archie and Buddy nose in at it from either
// side, stink wisps rising round them all and a red heart in an ink line.
function cardCheeseSniff(cards: Cards): Art {
  const a = new cards.Art();
  shopDoor(cards, a);
  a.put(CHEESE, "idle", 38, 40);
  for (const [dog, x, foot, i] of [
    ["buddy", 54, 58, 1],
    ["archie", 22, 60, 2],
  ] as const) {
    const c = a.dog(dog, "walk", x, foot, { i });
    a.lead(x, c, x + 6);
  }
  a.stink(3, 16, 2, "lime", "moss");
  a.stink(63, 18, 2, "lime", "moss");
  a.stink(37, 33, 1, "lime", "moss");
  const heart: Point[] = [];
  HEART.forEach((row, j) => {
    [...row].forEach((c, i) => {
      if (c === "1") {
        heart.push([66 + i, 6 + j]);
      }
    });
  });
  inked(a, heart, "red");
  a.fill(67, 7, 1, 1, "pink");
  return a;
}

// The cheesemonger facing the player: an ochre shirt under a long white apron, dbrown hair and a short
// moustache, the near hand (screen left) raised beside the face to hold up the fee, the other hand low
// at the side holding a wedge of gold cheese across the apron.
function cheesemongerTop(g: Drawable, b: number): void {
  g.rect(9, 21 + b, 14, 13, "ochre");
  g.rect(20, 21 + b, 3, 13, "rust");
  g.rect(11, 23 + b, 10, 12, "white");
  g.rect(19, 23 + b, 2, 12, "lgrey");
  g.rect(11, 21 + b, 1, 2, "white");
  g.rect(20, 21 + b, 1, 2, "lgrey");
  g.rect(5, 22 + b, 4, 4, "ochre");
  g.rect(4, 15 + b, 4, 8, "ochre");
  g.rect(4, 13 + b, 4, 3, "skin1");
  road.backArm(g, 23, 4, 22 + b, [
    [8, "ochre", "rust"],
    [3, "skin1", null],
  ]);
  g.tri([24, 29 + b], [24, 34 + b], [17, 34 + b], "gold");
  g.rect(17, 33 + b, 7, 1, "amber");
  g.rect(23, 29 + b, 1, 5, "yellow");
  g.rect(22, 32 + b, 3, 2, "skin1");
  faceDisc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2");
  scope.faceFront(g, 16, 14 + b);
  g.rect(13.5, 16.5 + b, 5, 1, "dbrown");
  g.cel(16, 8 + b, 7.5, 3, "dbrown", "plum", "brown");
  g.rect(8.5, 8 + b, 2, 5, "dbrown");
  g.rect(21.5, 8 + b, 2, 5, "dbrown");
}

// Buy the cheese: the cheese crate at the shop door with Archie sitting by it, and the cheesemonger
// in the doorway holding up the bill he has been paid and holding out a wedge of cheese.
function cardCheeseBuy(cards: Cards): Art {
  const a = new cards.Art();
  shopDoor(cards, a);
  // the crate set back and left and Archie low, so his head sits under the cut wheel and the wheel
  // clears the bill
  a.put(CHEESE, "idle", 16, 40);
  const monger = toImage(
    road.drawn(PERSON, road.dressed, cheesemongerTop, { legs: "bark", shoes: "ink" }).outlined(),
  );
  a.paste(monger, 38, -4);
  a.paste(sn.image("icon-bill"), 38, 4);
  const c = a.dog("archie", "idle", 28, 64);
  a.lead(28, c, 34);
  return a;
}

// Hurry on: the cheese crate at the shop door on the right and Archie pulled away to the left, the
// leash taut off the bottom, a red ! in an ink line by the cheese.
function cardCheeseHurryOn(cards: Cards): Art {
  const a = new cards.Art();
  shopDoor(cards, a);
  a.put(CHEESE, "idle", 54, 42);
  const c = a.dog("archie", "pull", 22, 56, { flip: true });
  a.lead(22, c, 6);
  inked(
    a,
    [72, 73].flatMap((x) => [2, 3, 4, 5, 6, 8, 9].map((y) => [x, y] as const)),
    "red",
  );
  return a;
}

const CARDS: ReadonlyMap<string, (cards: Cards) => Art> = new Map([
  ["card-wedding-photo-shoot-pose", cardWeddingPose],
  ["card-wedding-photo-shoot-walk-around", cardWeddingWalkAround],
  ["card-wedding-photo-shoot-reshoot", cardWeddingReshoot],
  [`card-${CHEESE}-sniff`, cardCheeseSniff],
  [`card-${CHEESE}-buy`, cardCheeseBuy],
  [`card-${CHEESE}-hurry-on`, cardCheeseHurryOn],
  [`card-${GREEN_BIN_SPILL}-hurry-past`, cardBinHurryPast],
  [`card-${GREEN_BIN_SPILL}-pay`, cardBinPay],
  [`card-${GREEN_BIN_SPILL}-wade-through`, cardBinWadeThrough],
]);

// Every card illustration inside an encounter card frame, cost plaque included.
async function cardPreview(out: string, scale = 3): Promise<void> {
  const cards = await loadCards();
  for (const [key, draw] of CARDS) {
    cards.ILLUSTRATIONS.set(key, () => draw(cards));
  }
  const sheet = filledImage(
    [0, 0, 0, 255],
    (cards.CW + 6) * CARDS.size * scale,
    (cards.CH + 6) * scale,
  );
  [...CARDS.keys()].forEach((key, i) => {
    const card = resizeNearest(
      cards.CW * scale,
      cards.CH * scale,
      cards.mockCard("encounter", key),
    );
    paste({ at: { x: i * (cards.CW + 6) * scale, y: 0 } }, card, sheet);
  });
  writeFileSync(out, rgbPng(sheet));
}

async function buildCards(): Promise<void> {
  const cards = await loadCards();
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of CARDS) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(draw(cards).img));
    execFileSync("aseprite", ["-b", png, "--save-as", `art/cards/${key}.aseprite`], {
      stdio: "inherit",
    });
  }
  console.log("built", [...CARDS.keys()].join(", "));
}

// ---------- sounds ----------

// Each is a list of sounds.ts's tone() calls, [wave, seconds, freq, start seconds, options], as
// sounds.ts's EFFECTS.
const EFFECTS: sounds.Effects = {
  // a soft wooden thunk, a squish, then the cheese's rising plop and a sag as it settles
  [`sfx-hit-${CHEESE}`]: [
    ["triangle", 0.14, [320, 130], 0, { attack: 0.003, release: 0.85, vol: 0.3 }],
    [
      "square",
      0.12,
      [320, 150],
      0,
      { attack: 0.003, low: 1000, release: 0.8, shape: "h", vol: 0.6 },
    ],
    ["pinknoise", 0.05, null, 0, { attack: 0.002, high: 250, low: 1200, release: 0.9, vol: 0.2 }],
    ["pinknoise", 0.12, null, 0.14, { attack: 0.02, high: 250, low: 1400, release: 0.7, vol: 0.4 }],
    ["triangle", 0.08, [260, 700], 0.16, { attack: 0.004, release: 0.6, shape: "h", vol: 0.9 }],
    ["triangle", 0.15, [420, 200], 0.25, { attack: 0.01, release: 0.8, shape: "h" }],
    [
      "square",
      0.15,
      [420, 200],
      0.25,
      { attack: 0.01, low: 1000, release: 0.8, shape: "h", vol: 0.6 },
    ],
  ],
  // the flash whining up, the shutter's two clicks, then two bells
  "sfx-hit-wedding-photo-shoot": [
    [
      "square",
      0.12,
      [1500, 3200],
      0,
      { attack: 0.02, duty: 25, fx: sounds.DARK, low: 3500, release: 0.3, vol: 0.15 },
    ],
    [
      "pinknoise",
      0.02,
      null,
      0.12,
      { attack: 0.001, fx: ["lowpass", "4500"], high: 2000, low: 5000, release: 0.6, vol: 0.5 },
    ],
    [
      "pinknoise",
      0.025,
      null,
      0.16,
      { attack: 0.001, fx: ["lowpass", "4500"], high: 1800, low: 4500, release: 0.6, vol: 0.45 },
    ],
    ["triangle", 0.2, "E6", 0.2, { release: 0.85, vol: 0.9 }],
    ["square", 0.2, "E5", 0.2, { duty: 25, low: 2500, release: 0.85, vol: 0.15 }],
    ["triangle", 0.28, "C6", 0.3, { release: 0.9, vol: 0.9 }],
    ["square", 0.28, "C5", 0.3, { duty: 25, low: 2500, release: 0.9, vol: 0.15 }],
  ],
  // the bin's hollow plastic thunk, its lid clattering down in three shrinking knocks, then a soft
  // squelch and a gloop as the scraps settle
  [`sfx-hit-${GREEN_BIN_SPILL}`]: [
    [
      "square",
      0.12,
      [340, 160],
      0,
      { attack: 0.003, low: 1000, release: 0.8, shape: "h", vol: 0.6 },
    ],
    ["triangle", 0.12, [340, 140], 0, { attack: 0.003, release: 0.85, vol: 0.35 }],
    [
      "pinknoise",
      0.04,
      null,
      0,
      { attack: 0.001, fx: ["lowpass", "3000"], high: 600, low: 2500, release: 0.8, vol: 0.25 },
    ],
    [
      "square",
      0.035,
      [720, 560],
      0.07,
      { attack: 0.002, duty: 35, fx: ["lowpass", "3000"], low: 1600, release: 0.7, vol: 0.5 },
    ],
    [
      "square",
      0.03,
      [680, 540],
      0.12,
      { attack: 0.002, duty: 35, fx: ["lowpass", "3000"], low: 1600, release: 0.7, vol: 0.38 },
    ],
    [
      "square",
      0.025,
      [650, 520],
      0.16,
      { attack: 0.002, duty: 35, fx: ["lowpass", "3000"], low: 1600, release: 0.7, vol: 0.26 },
    ],
    [
      "pinknoise",
      0.1,
      null,
      0.23,
      { attack: 0.012, high: 300, low: 1400, release: 0.75, vol: 0.5 },
    ],
    ["triangle", 0.1, [520, 210], 0.23, { attack: 0.01, release: 0.8, shape: "h", vol: 0.8 }],
    ["triangle", 0.09, [260, 560], 0.35, { attack: 0.006, release: 0.7, shape: "h", vol: 0.6 }],
  ],
};

// Write each sound into outDir as .ogg and .m4a, as sounds.ts renders its own.
function renderSounds(outDir: string): void {
  console.log("built", sounds.renderEffects(outDir, EFFECTS).join(", "));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 2 && argv[0] === "preview") {
    preview({ grounds: ZONE_ROADS }, depthSettled({}, sprites()), argv[1]!);
  } else if (argv.length === 2 && argv[0] === "cards") {
    await cardPreview(argv[1]!);
  } else if (argv.length === 2 && argv[0] === "sounds") {
    renderSounds(argv[1]!);
  } else if (argv.length === 1 && argv[0] === "build") {
    await buildSprites({}, SRC, sprites());
    await buildCards();
    renderSounds("public/art/sounds");
  } else {
    console.error(USAGE);
    process.exit(1);
  }
}
