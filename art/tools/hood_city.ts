// Draw The Beaches' and Yonge Street's own road objects, their card obstacles' cards, hits and sounds.
//
// The Beaches:
// dropped-ice-cream   48x72   card obstacle (Dropped ice cream): a kid in a peach sundress with brown
//                             pigtails looking down, sad, at her ice cream cone tipped on its side on
//                             the ground beside her, its strawberry scoop squashed into a pink puddle.
//                             She stands still. idle (2 frames, 400ms): a breath, a tear on her cheek
//                             on frame 1
// beach-umbrella      48x72   minor, 1 lane: someone's spot set up in the road, a red and white beach
//                             umbrella leaning right out of a mound of sand, a towel striped lilac and
//                             white spread in front of it and a sky blue cooler with a white lid and a
//                             grey handle beside it; red and white, with the towel and cooler, sets it
//                             apart from the roadside umbrellas. idle (4 frames, 450ms): the canopy's
//                             valance lifts on frame 2
// sandcastle          48x72   minor, 1 lane, drawn 48 rows tall: a sandcastle of two notched bucket
//                             towers and a taller, wider middle tower standing clear of each other over
//                             a crenellated wall and an arched door on a mound of sand, a red pennant
//                             on the middle tower, the bucket rings on its towers down to obstacles.ts's
//                             TEXTURE_MIN. idle (4 frames, 400ms): the pennant flutters on frame 2
// lifeguard-chair     48x72   minor, 1 lane: a tall wooden lifeguard chair, its legs splayed and
//                             laddered, a red seat back with a white cross, a yellow and white umbrella
//                             over it and an orange life ring hung on its leg; no box, roof or flag,
//                             unlike the Leuty station. idle (4 frames, 450ms): the umbrella's valance
//                             lifts on frame 2
// rollerblader        48x72   minor rider, 1 lane, coming down its lane at the pack, facing the player:
//                             a skater in a lime tank top, blue shorts, white knee pads, sunglasses and
//                             gold hair, on white inline skates with yellow wheels. ride (4 frames,
//                             100ms): a skating stride, each foot pushing out to its side in turn,
//                             lifted 1px, the body swaying 1px toward the gliding foot, the wheels'
//                             tread rolling 1px a frame
// volleyball-net-3    176x42  minor, 3 lanes, drawn 42 rows tall: a beach volleyball net in front
//                             elevation, strung between white posts out by the frame's edges, a white
//                             top band edged azure over coal mesh with clear holes 3px across, white
//                             bands down its ends and along its foot, a red and white striped antenna
//                             over each end, a rippled drift of sand under it heaped against the posts
//                             and a volleyball half sunk in it (left out at @69 and smaller, where it
//                             would be a square chip). idle (4 frames, 450ms): on frame 2 a breeze
//                             lifts the net's foot 1px in the middle and bends the antenna tips out 1px
//
// Yonge Street:
// big-screen-promo    48x72   card obstacle (Big screen promo): a street team promoter in a turquoise
//                             branded tee with a yellow star, an amber cap and white sneakers, a TV
//                             camera on her right shoulder (screen left) with a red tally light, a mic
//                             with a hot pink flag held out in her other hand. walk (8 frames, 50ms):
//                             road.ts's HUMAN_WALK; idle (2 frames, 400ms): a breath, the tally light
//                             dimmed on frame 1
// ttc-bus             56x66   minor, 1 lane by 3 rows of footprint, slower than the road: a TTC bus
//                             from straight behind, laid out on 56x55 and drawn at obstacles.ts's
//                             CAR_SCALE as the streetcar is: a roof pod over a white upper body, a wide
//                             dark rear window under an amber route sign "97", a ttc red lower body
//                             with two white stripes, "TTC" in white, the engine grille, tail lights
//                             and blinkers at the outer corners, the bumper and both rear tires. idle
//                             (2 frames, 400ms): the left blinker flashes, pulling out from a stop;
//                             drive (4 frames, 100ms): tread lines climb the tires and the body dips
//                             1px onto them on frames 1 and 2
// sandwich-board      48x48   minor, 1 lane: a café's A-frame sign, a forest chalkboard in a brown
//                             wooden frame with a chalk coffee cup and two lines of chalk writing, on
//                             splayed legs. idle (4 frames, 450ms): the chalk steam over the cup
//                             wavers on frame 2
// newspaper-box       48x48   minor, 1 lane: a row of three street newspaper boxes chained together on
//                             a concrete pad, a sky blue box, a taller red one in front and a yellow
//                             one, each with a white masthead band and an unreadable bar, a window onto
//                             a folded paper, a coin panel and a coal plinth; a grey chain sags along
//                             their feet to an amber padlock and a paper lies on the yellow box's lid.
//                             A cluster in bold colours a lane wide, unlike Kensington's roadside
//                             curb-mailbox, a single red box under a dome. idle (4 frames, 400ms): the
//                             lid paper's corner lifts 1px on frame 2
// pedicab             48x72   minor rider, 1 lane, also in the Distillery District, coming down its
//                             lane at the pack, facing the player: a bike taxi, its cobalt canopy edged
//                             in a white scalloped valance shading a padded red bench on two wheels, a
//                             passenger in a green top and a gold bob sitting on its left, and in front
//                             the rider, who wears a purple tee and a white headband, a lit headlamp on
//                             the fork crown. ride (4 frames, 120ms): the pedals going round, the front
//                             tire's tread falling 1px a frame
// streetcar-platform  176x48  minor, 3 lanes, Yonge Street's own 3-lane static: a TTC streetcar stop
//                             island in front elevation, a long low concrete platform, grey under an
//                             lgrey top and a white lit curb edge; on it a glass shelter as tall as a
//                             person under a ttc red roof band that overhangs it, white frame posts
//                             round navy panes with cyan glints and a lit ad panel, an azure poster in
//                             white, at its left end; a grey railing at the platform's left end, its
//                             gaps clear, and a TTC stop sign, red round a white band, on a slate pole
//                             at its right, clear over the roof line. idle (2 frames, 500ms): the ad
//                             panel's light dips to lgrey and cobalt on frame 1
//
// Every key above also has <key>@<step> for each depth step in mini.ts's STEPS, floor(size x scale +
// 0.5), with the original's tags, frames and durations, drawn on a Mini with its own outline. The
// people and the riders are laid out on 32x48 and drawn at road.ts's SCALE (1.5) as road.ts's are, the
// minor obstacles in layout pixels at obstacles.ts's SCALE (1.2) as obstacles.ts's, the bus at
// CAR_SCALE (56 columns, rows 1.2x) as the streetcar. All take the road outline (pixel.ts's roadEdge)
// and road.ts's LIT rim on their dark colours; the volleyball nets' and the streetcar platform's whites
// take obstacles.ts's whiteKeyline plum, and the nets' mesh holes and the platform's railing gaps stay
// clear, unoutlined.
//
// Hits (77x77, play: 8 frames, 70ms, laid out on 64x64 as hits.ts's), each opening on hits.ts's impact:
// fx-hit-dropped-ice-cream  the impact star in pink, then the strawberry scoop shoots up off a pink
//                           splat, drops and sprinkles flying out, the empty cone tumbling away
// fx-hit-big-screen-promo   the impact star in amber, then camera flashes popping round a white flash
//                           that shrinks away, confetti in cyan, pink and yellow falling
//
// Cards (75x56 images, composed from the sprites above as cards.ts composes its own):
// card-dropped-ice-cream-lick         Archie licking the pink puddle round the dropped cone, the kid
//                                     by it, sky speed lines and icon-zoomies' amber paw print for
//                                     the sugar rush
// card-dropped-ice-cream-buy          the kid holding a new cone up under hearts, a callout of -$
// card-dropped-ice-cream-walk-on-by   Archie pulled away from the dropped cone on its leash
// card-big-screen-promo-wave          Archie under a spotlight beam, the promoter filming, flashes
//                                     round it
// card-big-screen-promo-merch         the promoter's turquoise star tee held up as merch, a callout
//                                     of -$
// card-big-screen-promo-push-through  Archie pulling past the promoter, speed lines behind it
//
// Sounds (sounds.ts's format, under 0.6s):
// sfx-hit-dropped-ice-cream  0.54s  splat: a pink noise plop over a low falling triangle, then a sad
//                                   triangle "aww" sliding down a fifth
// sfx-hit-big-screen-promo   0.54s  camera: two shutter clicks of filtered noise, a rising flash
//                                   whine and a bright square "ta-da" up a fourth
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { encodeRgbPng } from "@andornaut/art-kit/png";
import { filledImage, paste, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { dressed } from "./depths.ts";
import { burst } from "./fx.ts";
import * as hits from "./hits.ts";
import { volleyBall } from "./hood_people.ts";
import { type Scale, small, snap, STEPS } from "./mini.ts";
import * as obstacles from "./obstacles.ts";
import {
  build,
  type Colour,
  depthSettled,
  type Drawable,
  type DrawingScope,
  type Edge,
  edged,
  type Frame,
  Grid,
  type Point,
  preview,
  raster,
  rowScaleOf,
  scaleOf,
  type Sprite,
  swapped,
  type Tag,
  toImage,
} from "./pixel.ts";
import {
  BREATH,
  BREATH_MS,
  faceDisc,
  headlamp,
  HUMAN_WALK,
  HUMAN_WALK_MS,
  LIT,
  lit,
  type PersonOptions,
  rim,
  SCALE as P,
  scope as roadScope,
  swung,
  treads,
  unit,
} from "./road.ts";
import { image } from "./scene.ts";
import { type Effects, renderEffects } from "./sounds.ts";

const USAGE = `Usage:
  node art/tools/hood_city.ts preview OUT.png   every frame of every sprite on the zone roads
  node art/tools/hood_city.ts cards OUT.png     every card illustration in its card frame, scaled up
  node art/tools/hood_city.ts sounds OUT_DIR    write the two sounds into OUT_DIR only
  node art/tools/hood_city.ts build             write art/hood-city/*.aseprite, export the sprites
                                                to public/art/sprites/, the cards to
                                                public/art/images/ and the sounds to
                                                public/art/sounds/`;

const SRC = "art/hood-city";
// The people and riders are laid out on 32x48 and drawn at road.ts's SCALE; the minor obstacles in
// layout pixels at obstacles.ts's SCALE; the bus at obstacles.ts's CAR_SCALE.
const OBSTACLE_SCALE = obstacles.SCALE;
const CAR = obstacles.CAR_SCALE;

// The grid every drawing here makes, which mini.ts's small swaps while it runs. Faces are drawn
// through road.ts's scope, so small swaps them there.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

function range(start: number, stop: number): number[] {
  const out: number[] = [];
  for (let i = start; i < stop; i++) {
    out.push(i);
  }
  return out;
}

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function emptyFrame(w: number, h: number): Colour[][] {
  return Array.from({ length: h }, () => Array<Colour>(w).fill(null));
}

// The drawn pixel of design point (x, y) on g.
export function pxAt(g: Drawable, x: number, y: number): [number, number] {
  return [Math.floor(x * scaleOf(g) + 0.5), Math.floor(y * rowScaleOf(g) + 0.5)];
}

// A character map centred on design point (cx, cy), pixel for pixel on the drawn grid, so it keeps
// its pixels at any scale.
export function stamp(
  g: Drawable,
  rows: readonly string[],
  cx: number,
  cy: number,
  cols: Readonly<Record<string, string>>,
): void {
  let [x0, y0] = pxAt(g, cx, cy);
  x0 -= Math.floor(rows[0]!.length / 2);
  y0 -= Math.floor(rows.length / 2);
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = cols[ch];
      if (c !== undefined) {
        raster(g).p(x0 + i, y0 + j, c);
      }
    });
  });
}

// ---------- dropped-ice-cream: the kid and her dropped cone ----------

// A waffle cone held point down: a triangle from its rim (x0 to x1 on row y0) to its point on row
// apex, tan lit on the left and ochre on the right, hatched in brown.
export function waffle(g: Drawable, x0: number, x1: number, y0: number, apex: number): void {
  const mid = (x0 + x1) / 2;
  g.tri([x0, y0], [x1, y0], [mid, apex], "tan");
  g.tri([mid, y0], [x1, y0], [mid, apex], "ochre");
  const n = 3;
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const y = y0 + (apex - y0) * t;
    const hw = ((x1 - x0) / 2) * (1 - t);
    g.rect(mid - hw + 0.5, y, Math.max(1, 2 * hw - 1), 1, "brown");
  }
}

// A top for kid() or road.ts's person: top(g, bob, arms).
export type Top = (g: Drawable, b: number, arms?: number) => void;

// The kid with the dropped cone, for kid(): a peach sundress, brown pigtails tied with red bobbles,
// looking down at the cone, her brows up and her mouth turned down; tear puts a cyan tear on her
// cheek.
export function kidTop(tear = false): Top {
  return (g, b, arms = 0) => {
    // the arms hang by her sides, the hands open, the free one swinging with the walk
    for (const [x, side] of [
      [7, -1],
      [19, 1],
    ] as const) {
      const n = swung(arms, side);
      g.rect(x, 25 + b, 3, 7 - n, "skin1");
      g.rect(x + 2, 25 + b, 1, 7 - n, "skin2");
    }
    // the sundress: straps over the shoulders, a bodice and a flared skirt with a white hem
    g.rect(10, 24 + b, 9, 6, "peach");
    g.tri([10, 29.5 + b], [18.5, 29.5 + b], [6, 36 + b], "peach");
    g.tri([10, 29.5 + b], [18.5, 29.5 + b], [23, 36 + b], "peach");
    g.rect(8, 29.5 + b, 13, 6.5, "peach");
    g.tri([16, 29.5 + b], [18.5, 29.5 + b], [23, 36 + b], "orange");
    g.rect(17, 24 + b, 2, 6, "orange");
    g.rect(6, 35 + b, 17, 1, "white");
    g.rect(12, 23 + b, 1, 1, "peach");
    g.rect(16, 23 + b, 1, 1, "peach");
    // the head: the face, a brown fringe and crown, the pigtails tied at the sides
    g.rect(12.5, 21.5 + b, 4, 2.5, "skin1");
    faceDisc(g, 14.5, 16.5 + b, 6.5, 6, "skin1", "skin2");
    g.cel(14.5, 12.5 + b, 7, 4, "brown", "dbrown", "clay");
    g.rect(8, 12.5 + b, 13, 2, "brown");
    g.rect(19, 12.5 + b, 2, 2, "dbrown");
    for (const [cx, sh] of [
      [5.5, "brown"],
      [23.5, "dbrown"],
    ] as const) {
      g.cel(cx, 17.5 + b, 2, 3, "brown", sh);
      g.rect(cx - 1 + (cx > 14 ? 1 : 0), 13.5 + b, 1, 1, "red");
    }
    // eyes looking down at the cone, brows raised in the middle, the mouth turned down
    for (const x of [11, 17]) {
      g.rect(x, 17.5 + b, 2, 1.5, "ink");
    }
    g.rect(10, 16 + b, 2, 1, "dbrown");
    g.p(12, 15 + b, "dbrown");
    g.rect(18, 16 + b, 2, 1, "dbrown");
    g.p(17, 15 + b, "dbrown");
    g.rect(13.5, 20 + b, 2, 1, "dbrown");
    g.p(12.5, 21 + b, "dbrown");
    g.p(15.5, 21 + b, "dbrown");
    g.p(9.5, 19 + b, "pink");
    g.p(19.5, 19 + b, "pink");
    if (tear) {
      g.rect(10, 19.5 + b, 1, 2, "cyan");
    }
  };
}

export interface KidPose {
  arms?: number;
  bob?: number;
  lf?: number;
  rf?: number;
}

// A kid facing the player, drawn shorter than road.ts's person's adults: legs, sandals and the
// caller's top(g, bob, arms) over them, then the dropped cone upside down beside her right foot in
// its pink puddle. The road outline and the lit rim.
export function kid(top: Top, { arms = 0, bob = 0, lf = 0, rf = 0 }: KidPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  for (const [x, f] of [
    [10, lf],
    [15, rf],
  ] as const) {
    g.rect(x, 35 + bob, 3, 8 + f - bob, "skin1");
    g.rect(x + 2, 35 + bob, 1, 8 + f - bob, "skin2");
    g.rect(x - 0.5, 43 + f, 4, 2, "red");
    g.rect(x - 0.5, 44 + f, 4, 1, "dred");
  }
  top(g, bob, arms);
  // the dropped cone, tipped on its side on the ground right of her: the pink puddle, the squashed
  // scoop at its open end and the waffle cone pointing off to the right
  g.cel(25, 44, 6, 1.2, "pink", "mauve");
  g.tri([24, 39.5], [24, 44.5], [31.5, 42.5], "tan");
  g.tri([24, 42.5], [24, 44.5], [31.5, 42.5], "ochre");
  for (const [x, y] of [
    [26, 41],
    [28, 42],
    [26, 43],
    [29, 43],
  ] as const) {
    g.p(x, y, "brown");
  }
  g.cel(22.5, 42, 3, 2.6, "pink", "mauve", "white");
  g.p(22, 40, "red");
  g.p(20, 44, "pink");
  return lit(g);
}

// kid() with kidTop, the tear on its own key.
export function droppedIceCream({
  tear = false,
  ...q
}: KidPose & { tear?: boolean } = {}): Drawable {
  return kid(kidTop(tear), q);
}

// ---------- big-screen-promo: the street team promoter ----------

export const STAR: readonly string[] = ["..#..", ".###.", "#####", ".###.", ".#.#."];

// The promoter, for road.ts's person (legs "navy" and shoes "white": black jeans and white sneakers):
// a turquoise tee with a yellow star, an amber cap, a TV camera on her right shoulder (screen left)
// with its lens to the player and a red tally light (dred when tally is off), and a mic with a hot
// pink flag held out at shoulder height in her other hand.
export function promoTop(tally = true): Top {
  return (g, b) => {
    // the mic arm (screen right): the sleeve and forearm up to the hand, the mic in it
    g.rect(23, 22 + b, 4, 3, "turquoise");
    g.rect(25, 22 + b, 3, 5, "skin2");
    g.rect(27, 22 + b, 1, 5, "brown");
    g.rect(25.5, 15 + b, 2, 7, "ink");
    g.rect(24.5, 17 + b, 4, 3, "hot");
    g.rect(24.5, 17 + b, 4, 1, "pink");
    g.cel(26.5, 14 + b, 2.3, 2.3, "dslate", "navy", "slate");
    // the tee, lit on the left and shaded on the right, the star logo on its front
    g.rect(9, 21 + b, 14, 13, "turquoise");
    g.rect(20, 21 + b, 3, 13, "dturq");
    g.rect(9, 21 + b, 1, 12, "foam");
    if (scaleOf(g) >= 0.9) {
      stamp(g, STAR, 15.5, 27 + b, { "#": "yellow" });
    } else {
      g.rect(14.5, 26 + b, 3, 2, "yellow");
    }
    // the camera arm (screen left) up to the camera's grip
    g.rect(5, 22 + b, 4, 4, "turquoise");
    g.rect(5, 25 + b, 3, 3, "skin2");
    // head: the neck, the face, black hair under an amber cap with a brim
    g.rect(14, 19 + b, 4, 3, "skin2");
    faceDisc(g, 16, 12.5 + b, 8, 8, "skin2", "brown");
    g.rect(8, 9 + b, 2, 6, "ink");
    g.rect(22, 9 + b, 2, 6, "ink");
    g.cel(16, 7 + b, 8.5, 4.5, "amber", "orange", "yellow");
    g.rect(7.5, 9 + b, 17, 2, "orange");
    g.rect(15, 5 + b, 2, 2, "white");
    roadScope.faceFront!(g, 16, 13 + b, { eyes: "ink", lips: "dbrown" });
    // the camera on her shoulder: a dark body, a handle over it, the lens facing us and the tally
    // light
    g.rect(1, 13 + b, 9, 9, "dslate");
    g.rect(1, 13 + b, 9, 1, "slate");
    g.rect(8, 14 + b, 2, 8, "navy");
    g.rect(3, 11 + b, 5, 2, "ink");
    g.cel(5, 17.5 + b, 3, 3, "ink", null, "slate");
    g.rect(4, 16.5 + b, 1, 1, "white");
    g.rect(7.5, 14.5 + b, 1.5, 1.5, tally ? "red" : "dred");
  };
}

// ---------- rollerblader ----------

export interface RollerPose {
  push?: "left" | "right";
  roll?: number;
  sway?: number;
}

// The skating stride: the foot pushing out to its side (none while both glide), the sway toward the
// gliding foot and the tread's roll. 4 frames at 100ms.
export const ROLLER_RIDE: readonly RollerPose[] = [
  { push: "left", roll: 0, sway: 1 },
  { roll: 1 },
  { push: "right", roll: 2, sway: -1 },
  { roll: 3 },
];
export const ROLLER_RIDE_MS = 100;

// A skater coming down the road at the pack, facing the player: gold hair, sunglasses, a lime tank
// top, blue shorts, bare legs with white knee pads, white inline skates with a violet cuff and a
// yellow wheel edge-on under each, its tread rolling. push is the side ("left" or "right", screen
// left and right) whose leg pushes out, its foot 4 design pixels out and 1 up; the other glides under
// the body, and the body sways sway drawn pixels toward it, the hips and legs put.
export function rollerblader({ push, roll = 0, sway = 0 }: RollerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const px = raster(g);
  const u = unit(g)[1];
  for (const [x, side] of [
    [10.5, "left"],
    [17.5, "right"],
  ] as const) {
    const out = push === side ? (side === "left" ? -4 : 4) : 0;
    const lift = push === side ? 1 : 0;
    // the leg from the hip, slanting out to the pushed foot one row at a time
    for (let r = 31; r < 39 - lift; r++) {
      const dx = (out * (r - 31)) / (8 - lift);
      g.rect(x + dx, r, 4, 1, "skin1");
      g.rect(x + dx + 3, r, 1, 1, "skin2");
    }
    const kx = x + (out * 4) / 8;
    g.rect(kx, 34, 4, 2, "white");
    g.rect(kx + 3, 34, 1, 2, "lgrey");
    const fx = x + out;
    const fy = 39 - lift;
    g.rect(fx, fy - 1, 4, 1, "violet");
    g.rect(fx, fy, 4, 3, "white");
    g.rect(fx + 3, fy, 1, 3, "lgrey");
    g.rect(fx + 1, fy + 3, 2, 1, "grey");
    g.rect(fx + 1, fy + 4, 2, 2, "yellow");
    treads(g, fx + 1, fy + 4, 2, 2, roll, u, true);
  }
  // shorts over the hips
  g.rect(10, 29, 12, 4, "blue");
  g.rect(19, 29, 3, 4, "navy");
  g.rect(10, 29, 12, 1, "navy");
  const body = px.px.map((row) => [...row]);
  px.px = emptyFrame(px.w, px.h);
  // the arms held out from the shoulders for balance, bare, each row overlapping the last so the arm
  // stays whole, the hands open
  for (const [x, side] of [
    [7, -1],
    [22, 1],
  ] as const) {
    for (let k = 0; k < 7; k++) {
      g.rect(x + side * k * 0.5, 20 + k, 3, 2, "skin1");
    }
    g.rect(x + side * 3.5, 26, 3, 3, "skin1");
  }
  // the tank top, its straps over bare shoulders
  g.rect(10, 19, 12, 10, "lime");
  g.rect(19, 19, 3, 10, "green");
  g.rect(10, 19, 2, 2, "skin1");
  g.rect(20, 19, 2, 2, "skin2");
  g.rect(12, 19, 1, 1, "lime");
  // the head: gold hair blowing out at the sides, the face, sunglasses
  g.rect(14, 17, 4, 3, "skin1");
  g.cel(16, 9.5, 8.5, 6, "gold", "amber", "yellow");
  g.rect(7, 9, 3, 8, "gold");
  g.rect(22, 9, 3, 8, "amber");
  faceDisc(g, 16, 12.5, 6.5, 6, "skin1", "skin2");
  g.rect(10, 8, 12, 2, "gold");
  g.rect(9.5, 11, 13, 2, "ink");
  g.rect(15, 11, 2, 1, "slate");
  g.p(10.5, 11, "white");
  g.p(17.5, 11, "white");
  g.rect(14.5, 15.5, 3, 1, "dbrown");
  g.p(13.5, 14.5, "dbrown");
  g.p(17.5, 14.5, "dbrown");
  const top = px.px.map((row) => [...row]);
  // the body above the hips sways over the legs
  const k = Math.round(sway);
  const hip = Math.floor(29 * rowScaleOf(g) + 0.5);
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => {
      const sx = y < hip ? x - k : x;
      const c = sx >= 0 && sx < px.w ? top[y]![sx]! : null;
      return c || body[y]![x]!;
    }),
  );
  return lit(g);
}

// ---------- pedicab ----------

export interface PedicabPose {
  lf?: number;
  rf?: number;
  roll?: number;
}

// Pedalling: each foot's row (the pedals go round) and the tread's roll; 4 frames at 120ms.
export const PEDICAB_RIDE: readonly PedicabPose[] = [
  { lf: 39, rf: 44, roll: 0 },
  { lf: 41, rf: 42, roll: 1 },
  { lf: 44, rf: 39, roll: 2 },
  { lf: 42, rf: 41, roll: 3 },
];
export const PEDICAB_RIDE_MS = 120;

// A bike taxi coming down the road at the pack, facing the player. Further up the road, so standing
// higher: a cobalt canopy lit azure, edged by a white scalloped valance on grey posts, shading a
// padded red bench, its seat roll lit pink, and on the bench's left a passenger, gold hair and a
// green top, their head and shoulders under the valance. In front, lower and centred, the rider in a
// purple tee and a white headband, the hands on the handlebar, the legs either side of the front
// tire, edge-on under its mudguard and a lit headlamp on the fork crown (road.ts's headlamp), the
// tread falling down it 1px a frame; the cab's two wheels show either side.
export function pedicab({ lf = 39, rf = 44, roll = 0 }: PedicabPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const u = unit(g)[1];
  // the cab's wheels, behind and to the sides
  for (const x of [3.5, 28.5]) {
    g.blob(x, 40, 1.8, 4.5, "ink");
    g.rect(x - 0.5, 37, 1, 6, "dslate");
  }
  // the canopy: a dome, lit on its upper left, its shade underneath, and its posts
  g.cel(16, 9, 15, 8, "cobalt", "blue", "azure", 2.4);
  g.rect(0, 9, 32, 9, null);
  g.rect(3, 10, 26, 9, "navy");
  for (const x of [2, 29]) {
    g.rect(x, 9, 1, 25, "grey");
  }
  // the bench: its back and the seat roll along its front
  g.cel(16, 22.5, 13, 5.5, "red", "dred", "pink", 4);
  g.cel(16, 29, 14.5, 2.5, "red", "dred", "pink", 4);
  // the passenger on the bench's left: shoulders in a green top, the neck, the face, a gold bob
  g.cel(8, 22, 5, 3.5, "green", "dgreen", "lime", 3);
  g.rect(6.5, 17, 2, 3, "skin1");
  faceDisc(g, 7.5, 14.5, 3.5, 4, "skin1", "skin2");
  g.cel(7.5, 11.5, 4, 2.5, "gold", "amber", "yellow");
  g.rect(3.5, 12, 1.5, 4.5, "gold");
  g.rect(10, 12, 1.5, 4, "amber");
  roadScope.faceFront!(g, 7.5, 14, { lips: "dbrown", mouth: 3, spread: 2 });
  // the valance along the canopy's edge, scalloped
  g.rect(1, 8, 30, 2, "cobalt");
  g.rect(27, 8, 4, 2, "blue");
  for (let k = 0; k < 6; k++) {
    g.cel(3.5 + k * 5, 10.5, 2.5, 1.5, "white", "lgrey");
  }
  // the rider's legs either side of the front wheel, bare shins, shoes on the pedals
  g.blob(16, 41, 2, 5.5, "ink");
  treads(g, 15.5, 38, 1, 8, roll, u, true);
  g.rect(15.5, 34, 1, 3, "lgrey");
  g.rect(13.5, 35, 5, 2, "dslate");
  g.rect(13.5, 35, 5, 1, "slate");
  for (const [x, foot] of [
    [10, lf],
    [19, rf],
  ] as const) {
    g.rect(x, 31, 3, 4, "shale");
    g.rect(x + 2, 31, 1, 4, "coal");
    g.rect(x, 35, 3, foot - 35, "dbrown");
    g.rect(x + 2, 35, 1, foot - 35, "plum");
    g.rect(x < 16 ? x - 1 : x, foot, 4, 2, "ink");
  }
  // the tee and the arms down to the grips, the handlebar across
  g.cel(16, 27.5, 7, 4.5, "purple", "plum", "mauve", 3.5);
  g.rect(9, 28, 14, 4, "purple");
  g.rect(20, 28, 3, 4, "plum");
  g.rect(9, 28, 1, 3, "mauve");
  for (const x of [5, 24]) {
    g.rect(x, 24, 3, 3, "purple");
    g.rect(x, 27, 3, 2, "dbrown");
  }
  g.rect(6, 29.5, 20, 1.5, "grey");
  g.rect(6, 29.5, 20, 0.75, "lgrey");
  for (const x of [4, 25]) {
    g.rect(x, 28.5, 3, 3, "ink");
  }
  // the head: the face, short black hair, a white headband
  g.rect(14, 21, 4, 2.5, "dbrown");
  faceDisc(g, 16, 18, 5, 5, "dbrown", "plum");
  g.cel(16, 14.5, 5.5, 2.5, "ink", null, "shale");
  g.rect(11, 15, 10, 1.5, "white");
  g.rect(18.5, 15, 2.5, 1.5, "lgrey");
  roadScope.faceFront!(g, 16, 18, { lips: "ink", mouth: 3, spread: 3 });
  // the lit headlamp on the fork crown over the mudguard
  headlamp(g, 16, 36.5);
  return rim(g, {
    ...LIT,
    coal: ["ash", null],
    dbrown: ["skin2", "brown"],
    plum: ["skin2", "brown"],
    shale: ["ash", null],
  });
}

// ---------- beach umbrella: someone's spot set up in the road ----------

export const UMBRELLA_IDLE: readonly [readonly number[], number] = [[0, 0, 2, 0], 450];
export const UMBRELLA_H = 60;

// A beach spot set up in the road, front on, laid out on obstacles.ts's SIZE by UMBRELLA_H: a red and
// white umbrella planted in a mound of sand, leaning right, its peaked canopy of eight wedges, the
// right ones shaded, scalloped round its rim; a towel striped lilac and white spread in front of it
// and a sky blue cooler with a white lid and a grey handle beside it on the right. lift lifts that
// many of the valance's scallops a pixel, from its right end, as a breeze catches it.
export function beachUmbrella(lift = 0): Drawable {
  const g = edged(scope.Grid(obstacles.SIZE, UMBRELLA_H));
  const uy = unit(g)[1];
  const tilt = radians(7);
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const fx = 15;
  const fy = 52;
  // The design point across from the pole and up it from its foot.
  const at = (across: number, up: number): Point => [
    fx + across * cos + up * sin,
    fy + across * sin - up * cos,
  ];
  // the pole, lit on its left
  for (const [c, x0, x1] of [
    ["lgrey", -1, 1],
    ["white", -1, 0],
  ] as const) {
    g.tri(at(x0, 2), at(x1, 2), at(x1, 40), c);
    g.tri(at(x0, 2), at(x1, 40), at(x0, 40), c);
  }
  // the canopy: eight wedges from the peak to a rim that dips toward the viewer at the middle, the
  // right four a ramp step darker
  const peak = 49;
  const rimRow = 38;
  const dip = 4;
  const reach = 17.5;
  const n = 8;
  const cols = ["red", "white", "red", "white", "dred", "lgrey", "dred", "lgrey"];
  const edge = (a: number): Point => at(a, rimRow - dip * (1 - (a / reach) ** 2));
  for (let i = 0; i < n; i++) {
    const a0 = -reach + (2 * reach * i) / n;
    const a1 = -reach + (2 * reach * (i + 1)) / n;
    g.tri(at(0, peak), edge(a0), edge(a1), cols[i]!);
  }
  // the valance: a scallop under each wedge, the right ones lifting in a breeze
  for (let i = 0; i < n; i++) {
    const [x, y] = edge(-reach + (2 * reach * (i + 0.5)) / n);
    g.cel(x, y + 0.8 - Number(i >= n - lift) * uy, reach / n, 1.8, cols[i]!);
  }
  // the finial
  const [x, y] = at(0, peak + 1);
  g.rect(x - 1, y - 1, 2, 2, "white");
  // the mound of sand round the pole's foot
  g.cel(fx, fy, 8, 3, "tan", "brown", "skin1");
  // the towel spread in front, its stripes running across it, the near edge shaded
  g.tri([6, 53], [27, 53], [3, 58], "white");
  g.tri([27, 53], [28, 58], [3, 58], "white");
  for (let k = 0; k < 5; k++) {
    const t0 = k / 5 + 0.05;
    const t1 = k / 5 + 0.15;
    g.tri([6 + 21 * t0, 53], [6 + 21 * t1, 53], [3 + 25 * t0, 58], "lilac");
    g.tri([6 + 21 * t1, 53], [3 + 25 * t1, 58], [3 + 25 * t0, 58], "lilac");
  }
  g.rect(3, 58, 25, 1, "lgrey");
  for (let k = 0; k < 5; k++) {
    g.rect(3 + 25 * (k / 5 + 0.05), 58, 25 * 0.1, 1, "violet");
  }
  // the cooler beside it, lit on its left: the box with a white latch, its lid and the handle over it
  g.rect(24, 45, 12, 13, "sky");
  g.rect(32, 45, 4, 13, "blue");
  g.rect(24, 45, 1, 13, "cyan");
  g.rect(28, 49, 3, 2, "white");
  g.rect(23, 42, 14, 4, "white");
  g.rect(33, 42, 4, 4, "lgrey");
  g.rect(23, 45, 14, 1, "lgrey");
  g.rect(26, 39, 1, 3, "grey");
  g.rect(33, 39, 1, 3, "grey");
  g.rect(26, 38, 8, 1, "grey");
  return lit(g);
}

// ---------- sandcastle ----------

export const SANDCASTLE_IDLE: readonly [readonly number[], number] = [[0, 1, 2, 1], 400];
export const SANDCASTLE_H = 60;

// A sandcastle, front on, laid out on obstacles.ts's SIZE by SANDCASTLE_H: two bucket towers and a
// wider, taller middle tower behind, each notched along its top with gaps as wide as its merlons,
// standing clear of each other over a crenellated wall with an arched door, a red pennant on a stick
// over the middle tower, all on a mound of sand. Tan, lit cream on the left, shaded brown on the
// right. The bucket rings on the towers are drawn down to obstacles.ts's TEXTURE_MIN. flutter lifts
// the pennant's tip that many pixels, its hoist held still.
export function sandcastle(flutter = 0): Drawable {
  const g = edged(scope.Grid(obstacles.SIZE, SANDCASTLE_H));
  const uy = unit(g)[1];
  const fine = scaleOf(g) >= obstacles.TEXTURE_MIN;
  const base = 57;
  // the pennant on its stick
  g.rect(20, 21, 1, 9, "brown");
  g.tri([21, 21], [21, 25], [27, 23 - flutter * uy], "red");
  // the middle tower, behind, three merlons along its top
  g.rect(13, 33, 15, base - 33, "tan");
  g.rect(25, 33, 3, base - 33, "brown");
  g.rect(13, 33, 1, base - 33, "cream");
  for (const x of [13, 19, 25]) {
    g.rect(x, 30, 3, 3, x === 25 ? "brown" : "tan");
  }
  if (fine) {
    g.rect(13, 38, 15, 1, "clay");
  }
  // the wall, its battlements and the arched door
  g.rect(9, 45, 22, base - 45, "tan");
  g.rect(27, 45, 4, base - 45, "brown");
  for (const x of [9, 13, 17, 21, 25, 29]) {
    g.rect(x, 43, 2, 2, x >= 27 ? "brown" : "tan");
  }
  g.cel(20, 52, 3, 3.5, "bark");
  g.rect(17, 52, 6, base - 52, "bark");
  // the bucket towers, wider at the base, two merlons along the top, their rings inside the flare
  const top = 40;
  for (const [x0, sh] of [
    [2, false],
    [30, true],
  ] as const) {
    g.tri([x0, base], [x0 + 8, base], [x0 + 1, top], "tan");
    g.tri([x0 + 1, top], [x0 + 7, top], [x0 + 8, base], "tan");
    if (sh) {
      g.rect(x0 + 2.5, top + 1, 5, base - top - 1, "brown");
    } else {
      g.rect(x0 + 5.5, top + 1, 2, base - top - 1, "brown");
      g.rect(x0 + 1, top + 1, 1, base - top - 3, "cream");
    }
    for (const mx of [x0 + 1, x0 + 5]) {
      g.rect(mx, top - 3, 2, 3, sh || mx > x0 + 3 ? "brown" : "tan");
    }
    g.rect(x0 + 1, top, 6, 1, "skin1");
    for (const y of fine ? [43, 50] : []) {
      const flare = (y - top) / (base - top);
      g.rect(x0 + 1 - flare, y, 6 + 2 * flare, 1, "clay");
    }
  }
  // the mound of sand under it all
  g.cel(20, base, 18, 3.5, "tan", "brown", "skin1");
  g.rect(2, base, 36, 1.5, "tan");
  g.rect(32, base, 6, 1.5, "brown");
  return lit(g);
}

// ---------- lifeguard chair ----------

export const LIFEGUARD_IDLE: readonly [readonly number[], number] = [[0, 0, 2, 0], 450];
export const LIFEGUARD_H = 60;

// A tall lifeguard chair, front on, laid out on obstacles.ts's SIZE by LIFEGUARD_H: two driftwood legs
// splayed to the sand with ladder rungs between, a footrest, the seat with a red back panel and a
// white cross on it, a yellow and white umbrella over the seat on a grey pole and an orange life ring
// hung on the left leg. lift lifts that many of the valance's scallops a pixel, from its right end,
// as a breeze catches it.
export function lifeguardChair(lift = 0): Drawable {
  const g = edged(scope.Grid(obstacles.SIZE, LIFEGUARD_H));
  const uy = unit(g)[1];
  // the legs, splayed from the seat to the sand, lit on their left
  for (const [top, bottom, sh] of [
    [14, 6, false],
    [26, 32, true],
  ] as const) {
    for (let y = 26; y < 59; y++) {
      const t = (y - 26) / 33;
      const x = top + (bottom - top) * t;
      g.rect(x, y, 3, 1, sh ? "stone" : "driftwood");
      if (!sh) {
        g.p(x, y, "white");
      }
    }
  }
  // the ladder's rungs and a footrest
  for (const y of [34, 42, 50]) {
    const t = (y - 26) / 33;
    const x0 = 14 + (6 - 14) * t + 3;
    const x1 = 26 + (32 - 26) * t;
    g.rect(x0, y, x1 - x0, 2, "driftwood");
    g.rect(x0, y + 1, x1 - x0, 1, "stone");
  }
  // the seat and its red back panel with a white cross
  g.rect(11, 24, 19, 3, "driftwood");
  g.rect(11, 26, 19, 1, "stone");
  g.rect(13, 13, 15, 11, "red");
  g.rect(25, 13, 3, 11, "dred");
  g.rect(13, 13, 15, 1, "pink");
  g.rect(19, 15, 3, 7, "white");
  g.rect(17, 17, 7, 3, "white");
  // the umbrella: its pole, the canopy in yellow and white wedges, the valance under it
  g.rect(20, 8, 1, 5, "grey");
  const left = 3;
  const right = 37;
  const base = 9;
  const wedge = (i: number): string =>
    i % 2 === 0 ? (i < 3 ? "yellow" : "amber") : i < 3 ? "white" : "lgrey";
  for (let i = 0; i < 6; i++) {
    const x0 = left + ((right - left) * i) / 6;
    const x1 = left + ((right - left) * (i + 1)) / 6;
    g.tri([x0, base], [x1, base], [20.5, 2], wedge(i));
  }
  for (let i = 0; i < 6; i++) {
    const x0 = left + ((right - left) * i) / 6;
    g.cel(
      x0 + (right - left) / 12,
      base - Number(i >= 6 - lift) * uy,
      (right - left) / 12,
      1.8,
      wedge(i),
    );
  }
  // the life ring hung on the left leg
  g.cel(9, 38, 4, 4, "orange", "rust", "amber");
  g.cel(9, 38, 1.6, 1.6, null);
  for (const [x, y] of [
    [5, 38],
    [13, 38],
  ] as const) {
    g.rect(x, y - 0.5, 1, 1, "white");
  }
  return lit(g);
}

// ---------- volleyball net ----------

export const NET_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 450];
// Below this scale the half-sunk volleyball rasterizes as a square chip, so the far steps leave it
// out.
export const BALL_MIN = 0.85;
// The mesh's holes while it is drawn and outlined, so the outline does not fill them; net() clears
// them after.
export const HOLE = "000001";
// The nets' layout rows: taller than obstacles.ts's ROW so the net reads at @50, a multiple of 5 so
// every depth step is a whole number of rows at obstacles.ts's SCALE.
export const NET_ROWS = 35;
// The net's top and bottom rows in layout pixels, and its mesh pitch in drawn pixels: a 1px coal line
// every NET_PITCH pixels round holes NET_PITCH - 1 across.
export const NET_TOP = 5;
export const NET_BOTTOM = 24;
export const NET_PITCH = 4;

// obstacles.ts's whiteKeyline, and no outline beside a hole.
export function netEdge(c: string): string | null {
  return c === HOLE ? null : obstacles.whiteKeyline(c);
}

// art-kit's outline writes whatever the rule returns, so a null leaves the pixel clear.
const NET_EDGE = netEdge as Edge;

// Front elevation across lanes lanes, laid out in obstacles.ts's pixels (obstacles.ts's span(lanes)
// by NET_ROWS): a white post at each end, out by the frame's edges, and strung between their tops the
// net: a white top band edged azure along its foot, coal mesh in a 1px grid every NET_PITCH drawn
// pixels with clear holes, a white band down each end and along the bottom, and a red and white
// striped antenna rising over each end. A rippled drift of sand runs under it all, heaped against
// each post's inner side, with a volleyball (hood_people.ts's volleyBall) half sunk in it by the right
// post, left out below BALL_MIN. breeze lifts the bottom band's middle half and bends each antenna's
// tip outward 1px.
export function volleyballNet(lanes: number, breeze = 0): Drawable {
  const w = obstacles.span(lanes);
  const h = NET_ROWS;
  const g = edged(scope.Grid(w, h), NET_EDGE);
  const px = raster(g);
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const toX = (v: number): number => Math.floor(v * s + 0.5);
  const toY = (v: number): number => Math.floor(v * sy + 0.5);
  const posts = [2, w - 6] as const;
  const crest = h - 3.5;
  // the posts, white lit down their left and shaded lgrey down their right, an lgrey cap on each
  for (const x of posts) {
    g.rect(x, 4, 4, crest + 1 - 4, "white");
    g.rect(x + 3, 4, 1, crest + 1 - 4, "lgrey");
    g.rect(x - 0.5, 3, 5, 1.5, "lgrey");
  }
  // the net between the posts, on the drawn grid so every line stays 1px
  const x0 = toX(posts[0] + 4);
  const x1 = toX(posts[1]);
  const top = toY(NET_TOP);
  const foot = toY(NET_TOP + 4);
  const bottom = toY(NET_BOTTOM);
  px.rect(x0, top, x1 - x0, foot - top, "white");
  px.rect(x0, foot - 1, x1 - x0, 1, "azure");
  const lift = [x0 + Math.floor((x1 - x0) / 4), x1 - Math.floor((x1 - x0) / 4)] as const;
  for (let x = x0; x < x1; x++) {
    const low = bottom - (breeze && lift[0] <= x && x < lift[1] ? 1 : 0);
    for (let y = foot; y < low; y++) {
      const line = (x - x0) % NET_PITCH === 0 || (y - foot) % NET_PITCH === NET_PITCH - 1;
      px.p(x, y, line ? "coal" : HOLE);
    }
    px.p(x, low, "white");
  }
  for (const x of [x0, x1 - 1]) {
    px.rect(x, foot, 1, bottom - foot, "white");
  }
  // the antennas, just inside each end band, striped red and white every 2 drawn pixels; breeze bends
  // the tip outward
  for (const [x, out] of [
    [x0 + 2, -1],
    [x1 - 3, 1],
  ] as const) {
    for (let y = toY(0); y < bottom; y++) {
      const c = Math.floor((y - toY(0)) / 2) % 2 === 0 ? "red" : "white";
      px.p(x + (breeze && y === toY(0) ? out : 0), y, c);
    }
  }
  // the sand: a drift the width of the net, its top rippling a pixel, heaped into a mound round each
  // post
  for (let x = toX(1.5); x < toX(w - 1.5); x++) {
    const topY = toY(crest) - (Math.floor(x / Math.max(2, toX(5))) % 2 ? 1 : 0);
    px.rect(x, topY, 1, toY(h) - topY, "tan");
    px.p(x, topY, "cream");
    px.p(x, toY(h) - 1, "brown");
  }
  for (const x of [posts[0] + 4.5, posts[1] - 0.5]) {
    g.cel(x, h - 3, 5, 3.5, "tan", "brown", "cream");
  }
  if (s >= BALL_MIN) {
    volleyBall(g, posts[1] - 11, h - 4);
  }
  return lit(g);
}

// frame with its HOLE pixels cleared.
function holesCleared(frame: Frame): Frame {
  return frame.map((row) => row.map((c) => (c === HOLE ? null : c)));
}

// volleyballNet at s, outlined, its holes cleared.
export function net(s: Scale, lanes: number, breeze: number): Frame {
  return holesCleared(small(roadScope, scope, s, volleyballNet, lanes, breeze).outlined());
}

// ---------- streetcar platform ----------

// The platform's idle: rest, then the shelter's ad panel light dips on frame 1.
export const PLATFORM_IDLE: readonly [readonly number[], number] = [[0, 1], 500];
// The platform's layout rows: taller than obstacles.ts's ROW so the shelter stands as tall as a
// person, a multiple of 5 so every depth step is a whole number of rows at obstacles.ts's SCALE.
export const PLATFORM_ROWS = 40;

// A TTC streetcar stop island in front elevation across 3 lanes, laid out in obstacles.ts's pixels
// (obstacles.ts's span(3) by PLATFORM_ROWS) and drawn on the drawn grid so every line keeps its width
// at every step: a long low concrete platform, grey with a white lit curb edge over its lgrey top; on
// it a glass shelter as tall as a person under a ttc red roof band lit pink that overhangs it, white
// frame posts round navy panes with cyan glints, a lit ad panel at its left end; a grey railing at
// the platform's left end and a TTC stop sign, red round a white band, on a slate pole at its right,
// the sign clear over the roof line. dim dips the ad panel's light.
export function streetcarPlatform(dim = 0): Drawable {
  const w = obstacles.span(3);
  const g = edged(scope.Grid(w, PLATFORM_ROWS), NET_EDGE);
  const px = raster(g);
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const width = px.w;
  const height = px.h;
  const toX = (v: number): number => Math.floor(v * s + 0.5);
  const toY = (v: number): number => Math.floor(v * sy + 0.5);
  const big = s >= 0.85;
  // the platform: an lgrey top under a white lit curb edge, a grey face, slate along its foot and
  // right end
  const top = toY(PLATFORM_ROWS - 7);
  const face = toY(PLATFORM_ROWS - 5);
  px.rect(1, top, width - 2, height - top, "grey");
  px.rect(1, top, width - 2, face - top, "lgrey");
  px.rect(1, top, width - 2, 1, "white");
  px.rect(1, height - 1, width - 2, 1, "slate");
  px.rect(width - 2, face, 1, height - face, "slate");
  if (s >= obstacles.TEXTURE_MIN) {
    for (const v of [w / 4, w / 2, (3 * w) / 4]) {
      px.rect(toX(v), face, 1, height - face - 1, "slate");
    }
  }
  // the railing at the left end: two posts and a top and a middle rail, its gaps HOLE until
  // platform()
  const railTop = toY(PLATFORM_ROWS - 18);
  const post = big ? 2 : 1;
  const r0 = toX(4);
  const r1 = toX(20) + post;
  px.rect(r0, railTop, r1 - r0, top - railTop, HOLE);
  for (const x of [r0, r1 - post]) {
    px.rect(x, railTop, post, top - railTop, "grey");
  }
  for (const y of [railTop, toY(PLATFORM_ROWS - 12.5)]) {
    px.rect(r0, y, r1 - r0, 1, "lgrey");
  }
  // the shelter: the roof band, the glass under it, the frame round the panes
  const x0 = toX(30);
  const x1 = toX(100);
  const over = 2 * post;
  const roof0 = toY(6);
  const roof1 = toY(11);
  px.rect(x0 - over, roof0, x1 - x0 + 2 * over, roof1 - roof0, "ttc");
  px.rect(x0 - over, roof0, x1 - x0 + 2 * over, 1, "pink");
  const foot = top - 1;
  px.rect(x0, roof1, x1 - x0, foot - roof1, "navy");
  const posts = [x0, toX(48), toX(74), x1 - post];
  // the ad panel, between the first two posts: lit white round an azure poster, dipped to lgrey and
  // cobalt
  const a0 = posts[0]! + post;
  const a1 = posts[1]!;
  px.rect(a0, roof1, a1 - a0, foot - roof1, dim ? "lgrey" : "white");
  const m = big ? 2 : 1;
  px.rect(
    a0 + m,
    roof1 + m,
    a1 - a0 - 2 * m,
    foot - roof1 - 2 * m - (big ? 2 : 1),
    dim ? "cobalt" : "azure",
  );
  // the glints, a cyan diagonal streak across each glass pane
  for (let i = 1; i + 1 < posts.length; i++) {
    const g0 = posts[i]! + post;
    const g1 = posts[i + 1]!;
    const n = foot - roof1;
    for (let k = 0; k < n; k++) {
      const x = g0 + Math.floor((g1 - g0) / 3) + Math.floor((n - 1 - k) / 2) - 1;
      for (let d = 0; d < (big ? 2 : 1); d++) {
        if (g0 <= x + d && x + d < g1) {
          px.p(x + d, roof1 + k, "cyan");
        }
      }
    }
  }
  for (const x of posts) {
    px.rect(x, roof1, post, foot - roof1 + 1, "white");
  }
  px.rect(x0, foot, x1 - x0, 1, "white");
  // the stop sign pole and its sign: red round a white band with a red bar through it
  const pole = toX(122);
  px.rect(pole, toY(8), post, top - toY(8), "slate");
  const s0 = toX(115);
  const s1 = toX(129) + post;
  const t0 = toY(0);
  const t1 = toY(9);
  px.rect(s0, t0, s1 - s0, t1 - t0, "ttc");
  px.rect(s0, t0, s1 - s0, 1, "pink");
  // the white band keeps 2 rows of red over and under it, so the sign stays red at the far steps
  const b = big ? 2 : 1;
  px.rect(s0 + b, t0 + 2, s1 - s0 - 2 * b, t1 - t0 - 4, "white");
  if (big) {
    px.rect(s0 + b + 1, Math.floor((t0 + t1) / 2), s1 - s0 - 2 * b - 2, 1, "ttc");
  }
  return lit(g, { ttc: ["pink", null] });
}

// streetcarPlatform at s, outlined, the railing's gaps cleared.
export function platform(s: Scale, dim: number): Frame {
  return holesCleared(small(roadScope, scope, s, streetcarPlatform, dim).outlined());
}

// ---------- sandwich board ----------

export const BOARD_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 450];

// A café's A-frame sign, front on, laid out on obstacles.ts's SIZE: a forest chalkboard in a brown
// wooden frame lit tan along its top and left, narrowing to a hinge at the top, on legs splayed to
// the ground. On it in chalk: a coffee cup with steam over it and two lines of writing under it.
// steam 1 waves the steam a pixel.
export function sandwichBoard(steam = 0): Drawable {
  const g = edged(scope.Grid(obstacles.SIZE, obstacles.SIZE));
  const ux = unit(g)[0];
  // the back legs behind, then the frame and the board
  g.tri([7, 30], [12, 30], [5, 37], "dbrown");
  g.tri([28, 30], [33, 30], [35, 37], "dbrown");
  g.tri([12, 3], [28, 3], [6, 32], "brown");
  g.tri([28, 3], [34, 32], [6, 32], "brown");
  g.tri([12, 3], [14, 3], [6, 32], "tan");
  g.rect(12, 3, 16, 1, "tan");
  g.tri([26, 3], [28, 3], [34, 32], "dbrown");
  g.tri([14, 6], [26, 6], [10, 29], "forest");
  g.tri([26, 6], [30, 29], [10, 29], "forest");
  g.rect(17, 2, 6, 1.5, "grey");
  g.rect(17, 2, 6, 1, "lgrey");
  // the legs' feet
  g.rect(5, 32, 4, 5, "brown");
  g.rect(31, 32, 4, 5, "dbrown");
  // chalk: the cup, its handle and saucer, the steam, the writing
  g.rect(16, 15, 7, 5, "white");
  g.rect(16, 15, 7, 1, "lgrey");
  g.rect(23, 16, 2, 1, "white");
  g.rect(24, 16, 1, 3, "white");
  g.rect(23, 18, 2, 1, "white");
  g.rect(14, 20, 11, 1, "white");
  (
    [
      [18, 13],
      [18, 12],
      [19, 11],
      [19, 10],
      [21, 13],
      [21, 12],
      [22, 11],
      [22, 10],
    ] as const
  ).forEach(([x, y], k) => {
    g.rect(x + (steam && k % 4 >= 2 ? ux : 0), y, 1, 1, "lgrey");
  });
  g.rect(13, 23, 14, 1, "lgrey");
  g.rect(14, 26, 11, 1, "lgrey");
  return lit(g, { forest: ["green", null] });
}

// ---------- newspaper boxes ----------

export const NEWS_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 0], 400];
export type NewsBox = readonly [
  x: number,
  w: number,
  top: number,
  body: string,
  shade: string,
  bar: string,
];
// Each box: its left edge, width, top row, body, shade and masthead bar colours. The red one is the
// tallest and, drawn last, stands in front of its neighbours.
export const NEWS_BOXES: readonly NewsBox[] = [
  [3, 11, 11, "sky", "blue", "blue"],
  [26, 11, 12, "yellow", "amber", "red"],
  [14, 12, 8, "red", "dred", "dred"],
];

// One vending box standing on the pad (its foot on row 35): a lid lit along its top, a white
// masthead band with an unreadable bar, a window onto a folded paper, a coin panel with its slot and
// a pull handle, a coal plinth, the body shaded down its right. Below obstacles.ts's TEXTURE_MIN the
// paper shows only its headline and the handle is left off, so the small steps keep a white page in
// each window.
export function newsBoxFront(
  g: Drawable,
  x: number,
  w: number,
  top: number,
  body: string,
  shade: string,
  bar: string,
): void {
  const fine = scaleOf(g) >= obstacles.TEXTURE_MIN;
  g.rect(x, top, w, 35 - top, body);
  g.rect(x + w - 2, top, 2, 35 - top, shade);
  // the lid, overhanging a pixel each side
  g.rect(x - 0.5, top - 1, w + 1, 2, shade);
  g.rect(x - 0.5, top - 1, w + 1, 1, body);
  // the masthead
  g.rect(x + 1, top + 2, w - 3, 3, "white");
  g.rect(x + 2, top + 3, w - 6, 1, bar);
  // the window: a dark frame onto the day's paper, its headline and a photo
  g.rect(x + 1, top + 6, w - 3, 8, "navy");
  g.rect(x + 2, top + 7, w - 5, 6, "white");
  g.rect(x + 2, top + 7, w - 5, 1, "ink");
  if (fine) {
    g.rect(x + 2, top + 9, 3, 2, body === "sky" ? "red" : "sky");
    g.rect(x + 6, top + 9, w - 9, 1, "grey");
    g.rect(x + 2, top + 11, w - 5, 1, "grey");
  }
  // the coin panel, its slot, and the pull handle beside it
  g.rect(x + w - 6, top + 15, 3, 3, "lgrey");
  g.rect(x + w - 5, top + 15.5, 1, 2, "ink");
  if (fine) {
    g.rect(x + 2, top + 16, 3, 1, "lgrey");
  }
  // the plinth
  g.rect(x, 33, w, 2, "coal");
}

// A row of three street newspaper boxes chained together on a concrete pad, front on, laid out on
// obstacles.ts's SIZE: a sky blue box, a taller red one in the middle and a yellow one, each with a
// white masthead band, a window onto a folded paper, a coin panel and a coal plinth, a chain sagging
// in two loops along their feet to an amber padlock, a plain lgrey line, and a paper left lying on
// the yellow box's lid. lift raises the paper's loose corner that many drawn pixels.
export function newspaperBox(lift = 0): Drawable {
  const g = edged(scope.Grid(obstacles.SIZE, obstacles.SIZE));
  // the pad, a sliver of its top over its front
  g.rect(1, 34, 38, 3, "grey");
  g.rect(1, 34, 38, 1, "lgrey");
  g.rect(35, 35, 4, 2, "slate");
  for (const spec of NEWS_BOXES) {
    newsBoxFront(g, ...spec);
  }
  // the chain, sagging in two loops along the boxes' feet to a padlock on the red box
  for (let x = 4; x < 37; x++) {
    const t = (x + 0.5 - (x < 20 ? 12 : 28)) / 8;
    g.rect(x, 30.5 + 1.5 * (1 - t * t), 1, 1, "lgrey");
  }
  g.rect(19.5, 29.5, 2, 1.5, "grey");
  g.rect(18.5, 31, 4, 3, "amber");
  g.rect(18.5, 31, 4, 1, "yellow");
  // the paper on the yellow box's lid, its left corner lifting
  g.rect(28, 9.5, 7, 1.5, "white");
  g.rect(28, 10.5, 7, 0.5, "lgrey");
  if (lift) {
    const [x0, y0] = pxAt(g, 28, 9.5);
    raster(g).p(x0, y0 - lift, "white");
  }
  return lit(g);
}

// ---------- ttc-bus ----------

// 3x5 letters for the bus's route sign and wordmark: obstacles.ts's LETTERS and the route's digits.
export const LETTERS: Readonly<Record<string, readonly string[]>> = {
  ...obstacles.LETTERS,
  "7": ["111", "001", "010", "010", "010"],
  "9": ["111", "101", "111", "001", "111"],
};
export const BUS_IDLE: readonly [readonly number[], number] = [[0, 1], 400];

// obstacles.ts's lettering with LETTERS, so it spells the route too.
export function lettering(
  g: Drawable,
  cx: number,
  y: number,
  text: string,
  c: string,
  bar: string | null = null,
): void {
  swapped(new Map([[obstacles.scope, { LETTERS }]]), () => {
    obstacles.lettering(g, cx, y, text, c, bar);
  });
}

// A TTC bus from straight behind, a lane wide, laid out on 56x55 and drawn at CAR_SCALE to 56x66: the
// roof pod over a white upper body lit along its top and left; the wide rear window, dark with a
// glint, under the amber route sign "97" on black; the ttc red lower body with two white stripes,
// "TTC" in white, the engine grille's slats, the tail lights and blinkers at the outer corners; the
// bumper and both rear tires, black, no bogie. blink 1 lights the left blinker. roll (0 to 3) is a
// drive frame: tread lines climb the tires and the body dips 1px onto them on frames 1 and 2.
export function ttcBus(blink = 0, { roll = null }: { roll?: number | null } = {}): Drawable {
  const g = edged(scope.Grid(56, 55));
  const px = raster(g);
  const uy = unit(g)[1];
  for (const x of [5, 42]) {
    g.rect(x, 45, 9, 10, "ink");
    g.rect(x, 45, 2, 9, "dslate");
    if (roll !== null) {
      treads(g, x + 2, 47, 7, 7, roll, uy);
    }
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = emptyFrame(px.w, px.h);
  // the roof pod and the white upper body
  g.rect(14, 2, 28, 2, "lgrey");
  g.rect(14, 2, 28, 1, "white");
  g.rect(40, 2, 2, 2, "grey");
  g.cel(28, 7, 26, 3.5, "white", "lgrey", undefined, 4);
  g.rect(2, 6, 52, 21, "white");
  g.rect(50, 6, 4, 21, "lgrey");
  // the route sign and the rear window, a glint across the glass
  g.rect(21, 4, 14, 6, "ink");
  lettering(g, 28, 4.5, "97", "amber", "amber");
  g.rect(5, 11, 46, 14, "ink");
  g.rect(6, 12, 44, 12, "navy");
  g.rect(6, 12, 44, 1, "dslate");
  g.tri([11, 24], [19, 12.5], [24, 12.5], "dslate");
  g.tri([18, 24], [26, 12.5], [28, 12.5], "dslate");
  // the red lower body, its two white stripes, the wordmark and the grille
  g.rect(2, 27, 52, 17, "ttc");
  g.rect(50, 27, 4, 17, "dred");
  g.rect(2, 27, 52, 1, "red");
  g.rect(2, 29, 52, 1, "white");
  g.rect(2, 31, 52, 1, "white");
  lettering(g, 28, 33, "TTC", "white");
  g.rect(18, 39, 20, 4, "dred");
  for (let x = 19; x < 37; x += 3) {
    g.rect(x, 39, 2, 4, "ink");
  }
  // tail lights over blinkers at the outer corners
  for (const [x, side] of [
    [4, 0],
    [47, 1],
  ] as const) {
    g.rect(x, 33, 5, 5, "red");
    g.rect(x, 33, 5, 1, "pink");
    g.rect(x + 4, 34, 1, 4, "dred");
    const on = Boolean(blink) && side === 0;
    g.rect(x, 38, 5, 3, on ? "yellow" : "amber");
    if (on) {
      g.rect(x, 38, 5, 1, "white");
    }
  }
  // the bumper across the full width
  g.rect(2, 43, 52, 3, "dslate");
  g.rect(2, 43, 52, 1, "slate");
  g.rect(2, 43, 1, 3, "grey");
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => (y >= dip ? body[y - dip]![x]! : null) || wheels[y]![x]!),
  );
  return lit(g, { ttc: ["red", null] });
}

// ---------- hit bursts (hits.ts's layout: 64x64, drawn hits.ts's BURST_SCALE times bigger) ----------

export const SPRINKLES: readonly string[] = ["yellow", "cyan", "white", "lime"];

// The impact star in pink, then the strawberry scoop shoots up off a pink splat, peaks and drops back
// as drops and sprinkles fly out of the splat and the empty cone tumbles away to the right.
export function hitDroppedIceCream(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 40;
  if (step === 0) {
    hits.impact(g, "pink", cx, cy);
    return hits.rim(g);
  }
  // the splat: a flat pink blot spreading, shaded mauve, that shrinks back to drips
  const sr = [0, 10, 14, 16, 16, 14, 11, 8][step]!;
  hits.piece(g, (p) => {
    p.ell(cx, cy + 6, sr, sr * 0.38, "pink", "mauve", "white");
    p.ell(cx - sr * 0.6, cy + 7, sr * 0.3, sr * 0.22, "pink", "mauve");
  });
  // drops thrown out of it and falling
  const t = step - 0.5;
  (
    [
      [-8, -6],
      [8, -7],
      [-4, -9],
      [5, -10],
      [-11, -3],
      [11, -4],
    ] as const
  ).forEach(([vx, vy], i) => {
    const x = cx + vx * t * 0.8;
    const y = cy + 4 + vy * t * 0.8 + 1.1 * t * t;
    if (x >= 3 && x < 61 && y >= 3 && y < 60) {
      const col = i % 2 ? SPRINKLES[i % 4]! : "pink";
      hits.piece(g, (p) => p.ell(x, y, 1.5, 1.5, col));
    }
  });
  // the empty cone tumbling off to the right, a quarter turn a frame, its rim lit and its point ochre
  const ccx = cx + 5 + step * 3;
  const ccy = cy - 4 - step * 3 + step * step * 0.6;
  if (ccx < 55 && ccy < 55) {
    const a = radians(step * 90 + 30);
    const tip: Point = [ccx + Math.cos(a) * 7, ccy + Math.sin(a) * 7];
    const [r0, r1] = [Math.PI / 2, -Math.PI / 2].map((d): Point => [
      ccx - Math.cos(a) * 3 + Math.cos(a + d) * 4,
      ccy - Math.sin(a) * 3 + Math.sin(a + d) * 4,
    ]) as [Point, Point];
    const mid: Point = [(r0[0] + tip[0]) / 2, (r0[1] + tip[1]) / 2];
    hits.piece(g, (p) => {
      p.tri(r0, r1, tip, "tan");
      p.tri(r1, tip, mid, "ochre");
    });
  }
  // the scoop: up, peaking, dropping back
  const sy = [0, 28, 18, 13, 12, 15, 21, 29][step]!;
  hits.piece(g, (p) => {
    p.ell(cx - 2, sy, 5.5, 5, "pink", "mauve", "white");
    p.rect(cx - 6, sy + 3, 9, 2, "pink");
    p.p(cx - 3, sy - 4, "red");
  });
  return g;
}

// The impact star in amber, then a white camera flash with yellow rays that shrinks away while
// four-point flashes pop round it in turn and confetti in cyan, pink and yellow falls.
export function hitBigScreenPromo(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 36;
  if (step === 0) {
    hits.impact(g, "amber", cx, cy);
    return hits.rim(g);
  }
  const fr = [0, 15, 12, 9, 6, 4, 0, 0][step]!;
  if (fr) {
    hits.piece(g, (p) => {
      burst(p, cx, cy, fr, fr * 0.45, 8, "yellow", 22.5);
      p.ell(cx, cy, fr * 0.45, fr * 0.45, "white");
    });
  }
  (
    [
      [14, 18],
      [50, 22],
      [18, 50],
      [48, 48],
      [32, 12],
    ] as const
  ).forEach(([x, y], i) => {
    const age = step - 1 - i;
    if (age >= 0 && age < 3) {
      const r = [3, 5, 2][age]!;
      hits.piece(g, (p) => hits.star4(p, x, y, r, "yellow"));
    }
  });
  if (step >= 2) {
    const t = step - 2;
    (
      [
        [12, "cyan"],
        [22, "pink"],
        [30, "yellow"],
        [41, "cyan"],
        [52, "pink"],
      ] as const
    ).forEach(([x0, col], i) => {
      const x = x0 + ((t + i) % 2 ? 1 : -1);
      const y = 8 + ((i * 3) % 7) + t * 7;
      if (y < 58) {
        hits.piece(g, (p) => p.rect(x, y, 2 + ((t + i) % 2), 3 - ((t + i) % 2), col));
      }
    });
  }
  return g;
}

export const HITS: ReadonlyMap<string, (step: number) => Drawable> = new Map([
  ["fx-hit-dropped-ice-cream", hitDroppedIceCream],
  ["fx-hit-big-screen-promo", hitBigScreenPromo],
]);

// ---------- build: the road sprites at full size and every depth step ----------

// A pose q with its numeric offsets snapped to whole pixels at s, its named choices as given.
export function posed<Q extends object>(q: Q, s: number): Q {
  const offsets: Record<string, number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "number") {
      offsets[k] = v;
    }
  }
  return { ...q, ...snap(offsets, s) };
}

// The promoter at p in pose q (road.ts's person options), outlined.
function promoter(p: number, tally: boolean, q: PersonOptions): Frame {
  return dressed(p, promoTop(tally), {
    grounded: true,
    legs: "navy",
    shoes: "white",
    ...q,
  }).outlined();
}

// [key + suffix, tags] for every road sprite at depth step s (1 for the full size).
function* steps(suffix: string, s: number): Generator<Sprite> {
  const p = P * s;
  const o = OBSTACLE_SCALE * s;
  const car: Scale = [CAR[0] * s, CAR[1] * s];
  yield [
    `dropped-ice-cream${suffix}`,
    [
      [
        "idle",
        BREATH.map((b, k) =>
          small(
            roadScope,
            scope,
            p,
            droppedIceCream,
            posed({ bob: b, tear: k === 1 }, p),
          ).outlined(),
        ),
        BREATH_MS,
      ],
    ],
  ];
  yield [
    `big-screen-promo${suffix}`,
    [
      ["walk", HUMAN_WALK.map((w) => promoter(p, true, w)), HUMAN_WALK_MS],
      ["idle", BREATH.map((b, k) => promoter(p, k === 0, { bob: b })), BREATH_MS],
    ],
  ];
  yield [
    `rollerblader${suffix}`,
    [
      [
        "ride",
        ROLLER_RIDE.map((q) => small(roadScope, scope, p, rollerblader, posed(q, p)).outlined()),
        ROLLER_RIDE_MS,
      ],
    ],
  ];
  yield [
    `pedicab${suffix}`,
    [
      [
        "ride",
        PEDICAB_RIDE.map((q) => small(roadScope, scope, p, pedicab, posed(q, p)).outlined()),
        PEDICAB_RIDE_MS,
      ],
    ],
  ];
  for (const [key, draw, [args, ms]] of [
    ["beach-umbrella", beachUmbrella, UMBRELLA_IDLE],
    ["sandcastle", sandcastle, SANDCASTLE_IDLE],
    ["lifeguard-chair", lifeguardChair, LIFEGUARD_IDLE],
    ["sandwich-board", sandwichBoard, BOARD_IDLE],
    ["newspaper-box", newspaperBox, NEWS_IDLE],
  ] as const) {
    yield [
      `${key}${suffix}`,
      [["idle", args.map((a) => small(roadScope, scope, o, draw, a).outlined()), ms]],
    ];
  }
  yield [
    `volleyball-net-3${suffix}`,
    [["idle", NET_IDLE[0].map((a) => net(o, 3, a)), NET_IDLE[1]]],
  ];
  yield [
    `streetcar-platform${suffix}`,
    [["idle", PLATFORM_IDLE[0].map((a) => platform(o, a)), PLATFORM_IDLE[1]]],
  ];
  yield [
    `ttc-bus${suffix}`,
    [
      [
        "idle",
        BUS_IDLE[0].map((a) => small(roadScope, scope, car, ttcBus, a).outlined()),
        BUS_IDLE[1],
      ],
      [
        "drive",
        range(0, 4).map((r) => small(roadScope, scope, car, ttcBus, 0, { roll: r }).outlined()),
        100,
      ],
    ],
  ];
}

// Every road sprite at full size, then at every depth step: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  yield* steps("", 1);
  for (const [suffix, s] of STEPS) {
    yield* steps(`@${suffix}`, s);
  }
}

// The hit bursts.
export function* bursts(): Generator<Sprite> {
  for (const [key, draw] of HITS) {
    const frames = range(0, 8).map((i) => hits.burstFrame(draw, i).outlined(false));
    yield [key, [["play", frames, 70] satisfies Tag]];
  }
}

// ---------- cards ----------

// The kid holding a new cone up in her right hand (screen right), smiling, for the buy card: drawn at
// road.ts's SCALE with no dropped cone.
export function kidWithCone(lift = 0): Drawable {
  const top: Top = (g, b) => {
    kidTop()(g, b);
    // the happy face over the sad one: eyes, cheeks and a smile
    g.rect(10.5, 15 + b, 2, 1, "skin1");
    g.rect(16.5, 15 + b, 2, 1, "skin1");
    g.rect(10.5, 17 + b, 2, 2, "skin1");
    g.rect(16.5, 17 + b, 2, 2, "skin1");
    g.rect(10.5, 16 + b, 2, 2, "ink");
    g.rect(16.5, 16 + b, 2, 2, "ink");
    g.rect(12.5, 20 + b, 4, 2, "skin1");
    g.p(12.5, 19 + b, "dbrown");
    g.p(15.5, 19 + b, "dbrown");
    g.rect(13.5, 20 + b, 2, 1, "dbrown");
    // the forearm raised to her chest and the new cone in her hand, beside her face
    g.rect(19, 25 + b, 3, 7, null);
    g.rect(20, 22 + b, 3, 6, "skin1");
    g.rect(22, 22 + b, 1, 6, "skin2");
    waffle(g, 19, 25, 16 + b - lift, 23.5 + b - lift);
    g.cel(22, 14.5 + b - lift, 3.6, 2.8, "pink", "mauve", "white");
    g.p(22, 11.5 + b - lift, "red");
  };
  const g = edged(scope.Grid(32, 48));
  for (const x of [10, 15]) {
    g.rect(x, 35, 3, 8, "skin1");
    g.rect(x + 2, 35, 1, 8, "skin2");
    g.rect(x - 0.5, 43, 4, 2, "red");
    g.rect(x - 0.5, 44, 4, 1, "dred");
  }
  top(g, 0);
  return lit(g);
}

// The promoter's tee held up as merch, 30x24: turquoise lit foam, shaded dturq, the star on its front.
export function merchTee(): Drawable {
  const g = edged(scope.Grid(30, 24));
  g.rect(7, 3, 16, 19, "turquoise");
  g.rect(20, 3, 3, 19, "dturq");
  g.tri([7, 3], [1, 9], [7, 11], "turquoise");
  g.tri([23, 3], [29, 9], [23, 11], "dturq");
  g.rect(12, 3, 6, 2, "dturq");
  g.rect(7, 3, 1, 18, "foam");
  stamp(g, STAR, 15, 12, { "#": "yellow" });
  return lit(g);
}

// cards.ts, loaded on first use: only the card commands need it and its image dependencies.
type Cards = typeof import("./cards.ts");
type Art = InstanceType<Cards["Art"]>;

async function loadCards(): Promise<Cards> {
  return import("./cards.ts");
}

// Let them lick it: Archie leaning in to lick the pink puddle round the dropped cone, the kid looking
// on, and the sugar rush hitting him: sky speed lines streaming off him and an amber paw print
// dashing, as icon-zoomies draws the zoomies.
function cardLick(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("theBeaches");
  a.put("dropped-ice-cream", "idle", 20, 60, { i: 1 });
  const c = a.dog("archie", "pull", 50, 57, { flip: true });
  a.lead(50, c, 62);
  for (const [x, y, n] of [
    [63, 22, 6],
    [65, 27, 8],
    [63, 32, 5],
  ] as const) {
    a.fill(x, y, n, 1, "sky");
  }
  a.paste(image("icon-zoomies"), 52, 2);
  return a;
}

// The kid holding up a new cone under hearts, a callout of -$.
function cardBuy(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("theBeaches");
  const img = toImage(small(roadScope, scope, P, kidWithCone).outlined());
  a.shadow(40, 56, 30);
  a.paste(img, 40 - Math.floor(img.width / 2), 60 - img.height);
  a.hearts([
    [56, 10],
    [62, 22],
  ]);
  a.bubble(3, 6, 24, ["-$"], "dred");
  return a;
}

// Walk on by: Archie pulled away from the dropped cone on its leash.
function cardWalkOnBy(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("theBeaches");
  a.put("dropped-ice-cream", "idle", 52, 60);
  const c = a.dog("archie", "pull", 18, 56, { flip: true });
  a.lead(18, c, 6);
  a.fill(31, 6, 2, 5, "red");
  a.fill(31, 12, 2, 2, "red");
  return a;
}

// A spotlight's beam from the art's top edge (x0 to x1) down to a pool round (cx, cy), rx wide: the
// beam flat ash, a step up the road's slate ramp, so it lights the road without texture, and the pool
// flat gold with a yellow centre.
function beam(a: Art, x0: number, x1: number, cx: number, cy: number, rx: number): void {
  for (let y = 0; y < cy + 4; y++) {
    const t = Math.min(1, y / cy);
    const left = Math.trunc(x0 + (cx - rx - x0) * t);
    const right = Math.trunc(x1 + (cx + rx - x1) * t);
    a.fill(left, y, right - left + 1, 1, "ash");
  }
  for (let y = cy - 4; y < cy + 5; y++) {
    for (let x = cx - rx; x < cx + rx + 1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / 4) ** 2;
      if (d <= 1) {
        a.fill(x, y, 1, 1, d <= 0.4 ? "yellow" : "gold");
      }
    }
  }
}

// Archie in a spotlight's pool, the promoter filming it, a flash popping.
function cardWave(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("yongeStreet");
  beam(a, 0, 26, 24, 52, 17);
  a.put("big-screen-promo", "idle", 60, 68);
  const c = a.dog("archie", "idle", 24, 56, { shadow: false });
  a.lead(24, c, 18);
  a.sparkle(42, 10, "white");
  return a;
}

// The promoter's star tee held up as merch, a callout of -$.
function cardMerch(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("yongeStreet");
  a.put("big-screen-promo", "idle", 22, 68);
  a.paste(toImage(merchTee().outlined()), 42, 26);
  a.bubble(46, 5, 24, ["-$"], "dred");
  return a;
}

// Archie pulling past the promoter, speed lines behind it.
function cardPushThrough(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("yongeStreet");
  a.put("big-screen-promo", "walk", 56, 68, { i: 1 });
  const c = a.dog("archie", "pull", 24, 58);
  a.lead(24, c, 12);
  for (const [y, x, w] of [
    [32, 3, 8],
    [39, 1, 10],
    [46, 4, 7],
  ] as const) {
    a.fill(x, y, w, 1, "white");
  }
  return a;
}

const ILLUSTRATIONS: ReadonlyMap<string, (cards: Cards) => Art> = new Map([
  ["card-dropped-ice-cream-lick", cardLick],
  ["card-dropped-ice-cream-buy", cardBuy],
  ["card-dropped-ice-cream-walk-on-by", cardWalkOnBy],
  ["card-big-screen-promo-wave", cardWave],
  ["card-big-screen-promo-merch", cardMerch],
  ["card-big-screen-promo-push-through", cardPushThrough],
]);

// An RGB PNG as Pillow saves one by default.
function rgbPng(image: RgbaImage): Uint8Array {
  return encodeRgbPng({ deflateLevel: 6, deflateStrategy: 0, filterType: -1 }, image);
}

// Every card illustration inside an encounter card frame, scaled up, with the illustrations added to
// cards.ts's for the run.
async function cardsPreview(out: string, scale = 4): Promise<void> {
  const cards = await loadCards();
  const sheet = filledImage(
    [24, 20, 37, 255],
    (cards.CW + 6) * ILLUSTRATIONS.size * scale,
    (cards.CH + 6) * scale,
  );
  for (const [key, draw] of ILLUSTRATIONS) {
    cards.ILLUSTRATIONS.set(key, () => draw(cards));
  }
  try {
    [...ILLUSTRATIONS.keys()].forEach((key, i) => {
      const card = resizeNearest(
        cards.CW * scale,
        cards.CH * scale,
        cards.mockCard("encounter", key),
      );
      paste({ at: { x: i * (cards.CW + 6) * scale, y: 0 } }, card, sheet);
    });
  } finally {
    for (const key of ILLUSTRATIONS.keys()) {
      cards.ILLUSTRATIONS.delete(key);
    }
  }
  writeFileSync(out, rgbPng(sheet));
}

async function buildCards(): Promise<void> {
  const cards = await loadCards();
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of ILLUSTRATIONS) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(draw(cards).img));
    execFileSync("aseprite", ["-b", png, "--save-as", `${SRC}/${key}.aseprite`], {
      stdio: "inherit",
    });
  }
}

// ---------- sounds ----------

export const EFFECTS: Effects = {
  // two shutter clicks, a flash whine rising, a bright "ta-da"
  "sfx-hit-big-screen-promo": [
    [
      "pinknoise",
      0.025,
      null,
      0.004,
      {
        attack: 0.001,
        fx: ["lowpass", "4500"],
        high: 2000,
        low: 5000,
        release: 0.9,
        vol: 0.3,
      },
    ],
    [
      "pinknoise",
      0.025,
      null,
      0.07,
      {
        attack: 0.001,
        fx: ["lowpass", "4500"],
        high: 2000,
        low: 5000,
        release: 0.9,
        vol: 0.27,
      },
    ],
    ["triangle", 0.18, [1500, 3200], 0.04, { attack: 0.02, low: 3500, release: 0.5, vol: 0.25 }],
    ["square", 0.08, "G5", 0.24, { duty: 35, low: 3000, release: 0.5, vol: 0.6 }],
    ["square", 0.22, "C6", 0.32, { duty: 35, low: 3000, release: 0.9, shape: "h", vol: 0.6 }],
    ["triangle", 0.22, "C5", 0.32, { release: 0.9, shape: "h", vol: 0.6 }],
  ],
  // a wet splat, then a sad "aww"
  "sfx-hit-dropped-ice-cream": [
    ["pinknoise", 0.16, null, 0, { attack: 0.003, high: 250, low: 1800, release: 0.85, vol: 0.7 }],
    ["triangle", 0.18, [300, 100], 0, { attack: 0.003, release: 0.8, vol: 0.4 }],
    [
      "square",
      0.14,
      [300, 130],
      0,
      { attack: 0.003, low: 900, release: 0.8, shape: "h", vol: 0.5 },
    ],
    ["triangle", 0.34, ["E5", "A4"], 0.2, { attack: 0.04, release: 0.6, shape: "h", vol: 0.6 }],
    [
      "square",
      0.34,
      ["E5", "A4"],
      0.2,
      { attack: 0.04, duty: 25, low: 1500, release: 0.6, shape: "h", vol: 0.2 },
    ],
  ],
};

// Write the two sounds into outDir; return their keys.
export function renderSounds(outDir: string): string[] {
  return renderEffects(outDir, EFFECTS);
}

// ---------- commands ----------

async function buildAll(): Promise<void> {
  await build({}, SRC, [...sprites(), ...bursts()]);
  await buildCards();
  console.log("built", [...ILLUSTRATIONS.keys(), ...renderSounds("public/art/sounds")].join(", "));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 2 && argv[0] === "preview") {
    preview({}, depthSettled({}, [...sprites(), ...bursts()]), argv[1]!);
  } else if (argv.length === 2 && argv[0] === "cards") {
    await cardsPreview(argv[1]!);
  } else if (argv.length === 2 && argv[0] === "sounds") {
    console.log("wrote", renderSounds(argv[1]!).join(", "));
  } else if (argv.length === 1 && argv[0] === "build") {
    await buildAll();
  } else {
    console.error(USAGE);
    process.exit(1);
  }
}
