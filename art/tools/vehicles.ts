// Draw the vehicle minor obstacles: the garbage truck (garbageTruck) and the scooter (scooter), High
// Park's tourist train, Yonge Street's crossing TTC bus, the Distillery District's brewery dray and
// The Beaches' patrol buggy. Like obstacles.ts's the truck and the scooter are billboards from a low
// camera, a front elevation, squat, with at most a sliver of top surface; the train, the bus, the
// dray and the buggy are crossers, side on. All take the road outline and road.ts's LIT rim.
//
// stink-garbage-truck 56x60   a rear-loader garbage truck from behind, its hopper open on bags and a
//                             banana peel, the beacon blinking, two flies. Laid out on 56x50 and
//                             drawn as obstacles.ts's deliveryTruck is (56 columns, rows 1.2x), so it
//                             centres on a lane with 4px to spare, taller than the delivery truck
//                             (56x54) and as tall as the ice cream truck. idle (2 frames, 400ms).
//                             drive (4 frames, 100ms): reversing down the lane at the pack, tread
//                             lines fall down the tires, the body dips 1px onto them on frames 1 and
//                             2, the beacon blinks
// minor-scooter       48x72   a sky scooter from behind on its stand, laid out on 32x48 and drawn at
//                             road.ts's SCALE as hazards.ts's cyclist is; idle (2 frames, 500ms): the
//                             indicators blink. pull-out (4 frames, 100ms), parked-car's, drawn
//                             pulling right: tread lines climb the tire, the right indicator blinks.
//                             ride (4 frames, 100ms): ridden down its lane at the pack, facing the
//                             player as hazards.ts's cyclist does, a rider in an open white helmet
//                             with a sky stripe and a purple jacket on it behind the leg shield and
//                             lit headlamp, the tread falling down the tire 1px a frame and the
//                             scooter and rider dipping 1px onto it on frames 1 and 2
// tourist-train       176x64  High Park's trackless tourist train crossing the road side on, facing
//                             right (the game mirrors it for left), laid out on 176/1.5 x 64/1.5 and
//                             drawn at road.ts's SCALE: a red engine dressed as an old steam
//                             locomotive (a black boiler with slate bands, a black funnel stack with
//                             a flared lip, a headlamp, a black cowcatcher, the driver in a
//                             hickory-striped engineer's cap and blue overalls in an open cab, a
//                             Canadian flag on the cab roof) pulling two open cars of passengers,
//                             each with red and white striped bench boards and a cream canopy with a
//                             scalloped red hem on red posts, on black tires with red hubs; push (4
//                             frames, 100ms): the spokes turning a quarter of their spacing a frame,
//                             the engine dipping 1px onto its wheels on frames 1 and 2 and the cars
//                             bobbing 1px in turn; idle (4 frames, 400ms): stopped, the middle
//                             passenger of the second car waving, the hand swung out on frame 2; cue
//                             (3 frames, 120ms): the whistle, a white puff out of the stack growing
//                             and lifting away
// crosstown-bus       176x64  a TTC bus crossing Yonge Street side on, facing right (the game mirrors
//                             it for left), on the train's grid: a red roof trim over the white upper
//                             body and its one long dark window band, glints across it, a roof pod at
//                             the back, the amber destination sign over the front door and
//                             windshield, the mirror on its arm off the roof's front, the ttc red
//                             lower body with a white stripe, two glass doors split down the middle,
//                             a lit headlamp (road.ts's headlamp, a white core in a cream ring) and
//                             an amber indicator, two black tires with grey hubs in dark arches, no
//                             pantograph; told apart from ttc-bus, the same bus from behind, and from
//                             the streetcar. push (4 frames, 100ms): a spoke across each hub turning
//                             an eighth a frame, the body dipping 1px onto the wheels on frames 1 and
//                             2; idle (4 frames, 400ms): at its stop, both doors open on a lit
//                             doorway with a yellow pole, the body kneeling 1px on frames 1 and 2;
//                             cue (3 frames, 120ms): the doors shut, the indicator blinking, the body
//                             up off its kneel from frame 1 and the wheels a quarter turned on frame
//                             2
// brewery-dray        176x64  the Distillery District's brewery dray crossing the road side on,
//                             facing right (the game mirrors it for left), on the train's grid: a low
//                             electric tug, its brick red body lit along its top, the lit headlamp
//                             (road.ts's headlamp) on its sloped nose, an open cab under a flat
//                             dslate roof with an amber beacon, the driver in a green cap and shirt
//                             at the wheel behind a raked windscreen post, towing on an ink bar a
//                             flatbed on a dslate steel deck with a red tail lamp, stacked with
//                             upright oak kegs in two iron hoops each, two tiers at the back stepping
//                             down to one at the front, a yellow ratchet strap over each step; black
//                             tires with grey hubs, the tug's in dark arches. Told apart from
//                             barrel-stack's barrels on their sides and keg-dolly-worker's steel
//                             kegs. push (4 frames, 100ms): a spoke across each hub turning an eighth
//                             a frame, the tug dipping 1px onto its wheels on frames 1 and 2 and the
//                             flatbed bobbing 1px in turn; idle (4 frames, 400ms): stopped, the
//                             driver waving out of the open cab, the hand swung out on frame 2; cue
//                             (3 frames, 120ms): the roof beacon blinking, the wheels a quarter
//                             turned on frame 2
// patrol-buggy        112x64  The Beaches' lifeguard patrol buggy crossing the road side on, facing
//                             right (the game mirrors it for left), on the train's grid two lanes
//                             wide: an open red utility buggy with a white rescue cross on its cargo
//                             bed's side, a white rail along its top, a white roll bar with a red
//                             light bar over the lifeguard (sunglasses, a red tank top) at the wheel,
//                             a lit headlamp (road.ts's headlamp) at the nose, a red and yellow surf
//                             flag on a whip pole at the back, and two black tires with white hubs;
//                             it tows a small trailer carrying a yellow rescue board with grab
//                             handles along its rail. The lifeguard chair's red, white and yellow,
//                             told apart from it by its wheels and its length. push (4 frames,
//                             100ms): a spoke across each hub turning an eighth a frame, the buggy
//                             dipping 1px onto its wheels on frames 1 and 2 and the trailer bobbing
//                             1px in turn; idle (4 frames, 400ms): stopped, the flag's fly end
//                             lifting on frames 1 to 3, furthest on frame 2; cue (3 frames, 120ms):
//                             the light bar flashing on frames 0 and 2, the wheels a quarter turned
//                             on frame 2
//
// Every key also has <key>@<step> for each depth step in mini.ts's STEPS, floor(size x scale + 0.5),
// with the original's tags, frames and durations, drawn on a mini.ts Mini with its own outline. The
// scooter's drawing functions take u, one pixel at the drawn size in full-size units (1 at full size,
// 1/s on a Mini at scale s), so motion stays 1px in every depth variant.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.
import { type Scale, small, STEPS } from "./mini.ts";
import { CAR_SCALE, DRIVE, PULL_OUT } from "./obstacles.ts";
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
  lit,
  raiseMouth,
  SCALE,
  scope as roadScope,
  treads,
  unit,
} from "./road.ts";

const USAGE = `Usage:
  node art/tools/vehicles.ts preview OUT.png   every frame on the zone roads
  node art/tools/vehicles.ts build             export to public/art/sprites/`;

// The grid every drawing here makes and road.ts's face, which mini.ts's small swaps while it runs.
const scope: DrawingScope & { faceFront: FaceFront } = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
  faceFront,
};

function emptyFrame(w: number, h: number): Frame {
  return Array.from({ length: h }, () => Array<Colour>(w).fill(null));
}

// draw(...args) on a Mini at scale s, this module's grid swapped.
function drawn<A extends unknown[], R>(s: Scale, draw: (...args: A) => R, ...args: A): R {
  return small(roadScope, scope, s, draw, ...args);
}

// Every depth step this file draws: ["", 1] for the full size, then ["@<step>", scale].
function sizes(): (readonly [string, number])[] {
  return [["", 1], ...STEPS.map(([k, v]) => [`@${k}`, v] as const)];
}

// The garbage truck is laid out on 56x50 and drawn as obstacles.ts's deliveryTruck is, its columns
// kept (a lane less 4px each side) and its rows TRUCK_SCALE times taller: 56x60, taller than the
// delivery truck's 54 and as tall as road.ts's iceCreamTruck.
const TRUCK_W = 56;
const TRUCK_H = 50;
const TRUCK_SCALE = CAR_SCALE;

function frame(w: number, h: number): Drawable {
  return edged(scope.Grid(w, h));
}

// Draw onto px's empty grid with body's pixels moved down dip rows over under's.
function dipped(px: Grid, body: Frame, under: Frame, dip: number): void {
  px.px = Array.from({ length: px.h }, (_, y) =>
    Array.from({ length: px.w }, (_, x) => (y >= dip ? body[y - dip]![x]! : null) || under[y]![x]!),
  );
}

// ---------- garbage truck ----------

// A rear-loader garbage truck from straight behind, a lane wide and taller than obstacles.ts's
// deliveryTruck, laid out on TRUCK_W x TRUCK_H and drawn at TRUCK_SCALE as it is: a green packer body
// with a rounded top, ribbed in forest with a white stripe, its hopper open on a bag, a sack, a can
// and a banana peel under the grey packer blade, grab bars either side, red tail lights, the bumper
// step, both rear wheels and an amber beacon on the roof that blinks (f 1 off). roll (0 to 3) is a
// drive frame, reversing down the lane at the pack: tread lines fall down the tires 1px a frame and
// the body dips 1px onto them on frames 1 and 2.
function garbageTruck(f: number, roll: number | null = null): Drawable {
  const w = TRUCK_W;
  const g = edged(scope.Grid(TRUCK_W, TRUCK_H));
  const px = raster(g);
  const uy = unit(g)[1];
  // wheels first, so the body can dip over them
  for (const x of [5, 42]) {
    g.rect(x, 39, 9, 10, "ink");
    g.rect(x, 39, 2, 9, "dslate");
    if (roll !== null) {
      treads(g, x + 2, 42, 7, 7, roll, uy, true);
    }
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = emptyFrame(px.w, px.h);
  // the packer body: a rounded top over a box, lit along the left, shaded down the right
  g.cel(w / 2, 15, 23, 13, "dgreen", "forest", "green");
  g.rect(5, 15, w - 10, 23, "dgreen");
  g.rect(5, 15, 1, 23, "green");
  g.rect(w - 9, 15, 4, 23, "forest");
  for (const x of [15, 28, 41]) {
    g.rect(x, 4, 1, 11, "forest");
  }
  g.rect(6, 16, w - 12, 1, "white");
  // the beacon
  g.rect(w / 2 - 2, 1, 4, 2, f === 0 ? "amber" : "rust");
  if (f === 0) {
    g.p(w / 2 - 2, 1, "yellow");
  }
  // the hopper: its mouth, the trash and the packer blade
  g.rect(9, 21, w - 18, 12, "ink");
  g.cel(16, 29, 5, 3.5, "lgrey", "grey", "white");
  g.rect(15.5, 25, 1, 2, "slate");
  g.cel(25.5, 29.5, 4.5, 3, "purple", "plum", "mauve");
  g.rect(31, 26.5, 3, 6, "red");
  g.rect(31, 26.5, 3, 1, "pink");
  g.tri([35, 32.5], [40, 32.5], [38.5, 27], "yellow");
  g.p(38, 27.5, "dbrown");
  g.rect(9, 21, w - 18, 3, "grey");
  g.rect(9, 21, w - 18, 1, "lgrey");
  g.rect(9, 23, w - 18, 1, "slate");
  // grab bars and tail lights
  for (const x of [2, w - 3]) {
    g.rect(x, 17, 1, 17, "lgrey");
  }
  for (const x of [5, w - 9]) {
    g.rect(x, 29, 4, 6, "red");
    g.rect(x, 29, 4, 1, "pink");
    g.rect(x, 34, 4, 1, "dred");
  }
  // the bumper step across the full width
  g.rect(1, 37, w - 2, 3, "dslate");
  g.rect(1, 37, w - 2, 1, "slate");
  g.rect(1, 37, 1, 3, "grey");
  dipped(px, px.px, wheels, roll === 1 || roll === 2 ? 1 : 0);
  return lit(g);
}

// garbageTruck's drive frame roll, its beacon lit on frames 0 and 1.
function truckDriving(roll: number): Drawable {
  return garbageTruck(roll < 2 ? 0 : 1, roll);
}

// Two flies circling over the truck's roof, [x, y] per idle frame in layout pixels.
const TRUCK_FLIES: readonly (readonly [Point, Point])[] = [
  [
    [12, 4],
    [14, 2],
  ],
  [
    [44, 2],
    [42, 1],
  ],
];

// A garbage truck frame f at depth step step on a Mini at TRUCK_SCALE x step, outlined, with its
// flies on it after the outline: one ink pixel below 0.75x, else a 2x1 ink body under a white and
// lgrey wing.
function truck(draw: (f: number) => Drawable, f: number, step: number): Frame {
  const sx = TRUCK_SCALE[0] * step;
  const sy = TRUCK_SCALE[1] * step;
  const out = drawn([sx, sy], draw, f).outlined();
  for (const frames of TRUCK_FLIES) {
    const [x, y] = frames[f % 2]!;
    const x0 = Math.floor((x + 0.5) * sx);
    const y0 = Math.floor((y + 0.5) * sy);
    if (step < 0.75) {
      out[y0]![x0] = K.ink!;
      continue;
    }
    for (const xx of [x0, x0 + 1]) {
      out[y0]![xx] = K.ink!;
    }
    out[y0 - 1]![x0 + (f % 2 ? 1 : 0)] = K.white!;
    out[y0 - 1]![x0 + (f % 2 ? 0 : 1)] = K.lgrey!;
  }
  return out;
}

// ---------- scooter ----------

// The scooter is laid out on 32x48 and drawn at road.ts's SCALE, 48x72, as hazards.ts's cyclist is: a
// two-wheeler a rider sits on, so the rider is a road person's size.
const SCOOTER_W = 32;
const SCOOTER_H = 48;
// The ride's 4 frames, each this long: the tire's tread falls 1px a frame, as the garbage truck's
// reverse.
const SCOOTER_RIDE_MS = 100;

// A sky scooter from behind: its tire between the two round side cowls, the tail light and plate
// under the seat, the leg shield and handlebar with its mirrors over it. Parked (roll null), it
// stands on its stand and blink lights both indicators on the cowls. roll (0 to 3) is a pull-out
// frame: tread lines climb the tire 1px a frame (road.ts's treads) and the stand is up; pulling out,
// the right indicator is lit on frames 0 and 1. u is one pixel at the drawn size, in layout units.
function scooter(blink = false, u = 1, roll: number | null = null): Drawable {
  const g = frame(SCOOTER_W, SCOOTER_H);
  const px = raster(g);
  // the tire first, so the body lies over it
  g.rect(14, 38, 4, 9, "ink");
  g.rect(14, 38, 1, 8, "dslate");
  if (roll !== null) {
    treads(g, 15, 40, 3, 7, roll, u);
  } else {
    // the stand's two legs, down from under the cowls so they join the body
    for (const x of [10, 21]) {
      g.rect(x, 39, 1, 8, "dslate");
    }
  }
  const wheel = px.px.map((row) => [...row]);
  px.px = emptyFrame(px.w, px.h);
  // mirrors on stalks, the handlebar and its grips, the leg shield behind the seat
  for (const x of [6, 23]) {
    g.rect(x, 16, 3, 2, "lgrey");
    g.rect(x + 1, 17, 2, 1, "grey");
    g.rect(x + 1, 18, 1, 4, "dslate");
  }
  g.rect(7, 22, 18, 2, "dslate");
  g.rect(7, 22, 18, 1, "slate");
  g.rect(6, 22, 3, 2, "ink");
  g.rect(23, 22, 3, 2, "ink");
  g.rect(11, 24, 10, 6, "sky");
  g.rect(11, 24, 10, 1, "cyan");
  g.rect(18, 25, 3, 5, "blue");
  // the side cowls and the body between them
  g.rect(12, 30, 8, 9, "sky");
  g.rect(17, 30, 3, 9, "blue");
  for (const cx of [9.5, 22.5]) {
    g.cel(cx, 36.5, 5, 4.5, "sky", "blue", "cyan");
  }
  // the seat, tail light and plate
  g.cel(16, 30, 7, 2, "plum", null, "purple");
  g.rect(13, 33, 6, 2, "red");
  g.rect(13, 33, 6, 1, "pink");
  g.rect(13.5, 36, 5, 3, "lgrey");
  g.rect(14.5, 37, 3, 1, "grey");
  for (const x of [5, 25]) {
    const on = blink || (roll !== null && roll < 2 && x > SCOOTER_W / 2);
    g.rect(x, 35, 2, 2, on ? "yellow" : "orange");
    if (on) {
      g.rect(x, 35, 2, 1, "white");
    }
  }
  dipped(px, px.px, wheel, 0);
  return lit(g);
}

// scooter's pull-out frame roll, riderless.
function scooterPulling(roll: number, u = 1): Drawable {
  return scooter(false, u, roll);
}

// scooter's ride frame roll: ridden down its lane at the pack, facing the player as hazards.ts's
// cyclist does. The front tire edge-on under the front mudguard, tread lines falling 1px a frame as
// it rolls toward the player (road.ts's treads, back); the sky leg shield across the front with a
// chrome horn badge, a lit headlamp (road.ts's headlamp) in a chrome housing on the headset over it,
// the handlebar with its orange indicators at the ends and the mirrors on stalks. Its rider, behind
// the shield: an open white helmet with a sky stripe over the face, a purple jacket, brown gloves on
// the grips. The scooter and rider dip 1px onto the tire on frames 1 and 2. u is one pixel at the
// drawn size, in layout units.
function scooterRiding(roll: number, u = 1): Drawable {
  const g = frame(SCOOTER_W, SCOOTER_H);
  const px = raster(g);
  // the tire first, so the body can dip over it
  g.rect(14, 38, 4, 9, "ink");
  g.rect(14, 38, 1, 8, "dslate");
  treads(g, 15, 40, 3, 7, roll, u, true);
  const wheel = px.px.map((row) => [...row]);
  px.px = emptyFrame(px.w, px.h);
  // the rider: the jacket and arms out to the grips, the face under the helmet
  g.rect(14.5, 15, 3, 2, "skin2");
  g.cel(16, 21, 6.5, 7, "purple", "plum", "mauve");
  g.rect(9.5, 18, 13, 6, "purple");
  g.rect(9.5, 18, 1, 6, "mauve");
  g.rect(19.5, 18, 3, 6, "plum");
  for (const [x, c] of [
    [6.5, "purple"],
    [22.5, "plum"],
  ] as const) {
    g.rect(x, 17, 3, 5, c);
  }
  faceDisc(g, 16, 11, 5.5, 5, "skin1", "skin2");
  g.cel(16, 6.5, 6.5, 4, "white", "lgrey");
  g.rect(9.5, 6, 1.5, 7, "white");
  g.rect(21, 6, 1.5, 7, "lgrey");
  g.rect(15, 2.5, 2, 5, "sky");
  g.rect(11, 8, 10, 1, "dslate");
  scope.faceFront(g, 16, 10);
  // the smile up a pixel, clear of the chin's edge and the jacket's collar
  raiseMouth(g, 16, 10);
  // mirrors on stalks, the handlebar, the gloves on the grips, the indicators at its ends
  for (const x of [5, 24]) {
    g.rect(x, 13, 3, 2, "lgrey");
    g.rect(x + 1, 14, 2, 1, "grey");
    g.rect(x + 1, 15, 1, 5, "dslate");
  }
  g.rect(6, 21, 20, 2, "dslate");
  g.rect(6, 21, 20, 1, "slate");
  g.rect(6, 20, 3, 3, "dbrown");
  g.rect(23, 20, 3, 3, "dbrown");
  g.rect(4, 21, 2, 2, "orange");
  g.rect(26, 21, 2, 2, "orange");
  // the leg shield across the front, lit down its left, a chrome horn badge on it, the headlamp on
  // top
  g.cel(16, 31, 7.5, 9, "sky", "blue", "cyan", 2.6);
  g.rect(12, 22, 8, 3, "sky");
  g.rect(18, 22, 2, 3, "blue");
  g.rect(14, 27, 4, 3, "lgrey");
  g.rect(14, 27, 4, 1, "white");
  g.rect(15, 29, 2, 1, "grey");
  g.cel(16, 21, 2.5, 2, "lgrey", "grey");
  headlamp(g, 16, 21.5);
  // the front mudguard over the tire
  g.cel(16, 38.5, 3, 2, "sky", "blue", "cyan");
  dipped(px, px.px, wheel, roll === 1 || roll === 2 ? 1 : 0);
  return lit(g);
}

// The scooter's motion tags after its idle: [tag, drawing, frame arguments, ms per frame].
const SCOOTER_MOVES: readonly (readonly [
  string,
  (roll: number, u?: number) => Drawable,
  readonly number[],
  number,
])[] = [
  ["pull-out", scooterPulling, ...PULL_OUT],
  ["ride", scooterRiding, [0, 1, 2, 3], SCOOTER_RIDE_MS],
];

// ---------- the crossers' shared parts ----------

// A crosser's tags: [tag, one pose per frame, ms per frame].
type CrosserTags<Q> = readonly (readonly [string, readonly Q[], number])[];

// The crossers draw in layers, each on an empty grid, merged over the ones before it after moving it
// dy rows down.
function layered(g: Drawable, layers: readonly (readonly [() => void, number])[]): void {
  const px = raster(g);
  const out = emptyFrame(px.w, px.h);
  for (const [draw, dy] of layers) {
    px.px = emptyFrame(px.w, px.h);
    draw();
    for (let y = dy; y < px.h; y++) {
      for (let x = 0; x < px.w; x++) {
        const c = px.px[y - dy]![x];
        if (c) {
          out[y]![x] = c;
        }
      }
    }
  }
  px.px = out;
}

function quad(g: Drawable, a: Point, b: Point, c: Point, d: Point, col: Colour): void {
  g.tri(a, b, c, col);
  g.tri(a, c, d, col);
}

// A 1px line in drawn pixels through the design points pts, so a spoke stays one pixel at any scale.
function strand(g: Drawable, pts: readonly Point[], c: Colour): void {
  const s = scaleOf(g);
  const px = raster(g);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const a = [Math.floor(x0 * s), Math.floor(y0 * s)] as const;
    const b = [Math.floor(x1 * s), Math.floor(y1 * s)] as const;
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let k = 0; k <= n; k++) {
      px.p(
        Math.round(a[0] + ((b[0] - a[0]) * k) / n),
        Math.round(a[1] + ((b[1] - a[1]) * k) / n),
        c,
      );
    }
  }
}

// A 1px row in drawn pixels from design column x0 to x1 on design row y, so a stripe stays one pixel.
function row(g: Drawable, x0: number, x1: number, y: number, c: Colour): void {
  const s = scaleOf(g);
  raster(g).rect(
    Math.floor(x0 * s),
    Math.floor(y * s),
    Math.floor(x1 * s) - Math.floor(x0 * s),
    1,
    c,
  );
}

// A glint across glass in drawn pixels: a stroke 2px wide from design (x, y1) leaning right up to row
// y0, a column right every two rows, as road.ts's ttc bus's glints lean.
function glint(g: Drawable, x: number, y0: number, y1: number, c = "dslate"): void {
  const s = scaleOf(g);
  const px = raster(g);
  const column = Math.floor(x * s);
  const top = Math.floor(y0 * s);
  const bottom = Math.floor(y1 * s);
  for (let y = top; y < bottom; y++) {
    const off = Math.floor((bottom - 1 - y) / 2);
    px.p(column + off, y, c);
    px.p(column + off + 1, y, c);
  }
}

// A small face's 1px eyes and mouth, in drawn pixels.
function eyes(g: Drawable, cx: number, y: number): void {
  g.p(cx - 1.4, y, "ink");
  g.p(cx + 1.0, y, "ink");
  g.p(cx - 0.2, y + 2, "dbrown");
}

// ---------- tourist train ----------

// The key, and the tourist train's design grid: 176x64 at road.ts's SCALE, as the couple's 112
// columns are laid out.
const TRAIN_KEY = "tourist-train";
const TRAIN_W = 176 / SCALE;
const TRAIN_H = 64 / SCALE;
// The wheels' centre row and radius, the feet a row above the frame's bottom row so the outline
// closes under them.
const TRAIN_AXLE = 37.2;
const TRAIN_WHEEL = 4.4;

// A tourist-train pose: the push frame, the waving passenger's hand and the whistle's puff.
interface TrainPose {
  roll?: number | null;
  toot?: number;
  wave?: number;
}

const PUSH: readonly { roll: number }[] = [0, 1, 2, 3].map((roll) => ({ roll }));

// Moving: the wheels' spokes turn a quarter of their spacing a frame (roll), the engine dips 1px onto
// its wheels on frames 1 and 2 and the cars bob 1px in turn; 4 frames at 100ms, as every drive.
// Stopped: the second car's middle passenger waves, the hand swung out on frame 2; 4 frames at
// 400ms. Restarting: the whistle's puff grows out of the stack and lifts away; 3 frames at 120ms.
const TRAIN_TAGS: CrosserTags<TrainPose> = [
  ["push", PUSH, 100],
  ["idle", [{}, { wave: 1 }, { wave: 2 }, { wave: 1 }], 400],
  ["cue", [{ toot: 1 }, { toot: 2 }, { toot: 3 }], 120],
];
// A car's passenger: the top's and the hair's colours.
type Passenger = readonly [top: string, hair: string];
// Each car's left column and its passengers, back to front.
const TRAIN_CARS: readonly (readonly [number, readonly Passenger[]])[] = [
  [
    2,
    [
      ["teal", "ink"],
      ["amber", "dbrown"],
      ["lilac", "brown"],
    ],
  ],
  [
    40,
    [
      ["orange", "gold"],
      ["sky", "rust"],
      ["green", "ink"],
    ],
  ],
];

// A black tire side on round a red hub, two spokes crossing it turned a quarter of their spacing a
// frame (roll 0 to 3), so the loop is seamless, and an amber axle cap.
function trainWheel(g: Drawable, cx: number, roll: number): void {
  const r = TRAIN_WHEEL;
  const cy = TRAIN_AXLE;
  g.ell(cx, cy, r, r, "ink");
  g.rect(cx - r + 0.6, cy - 1.5, 0.75, 3, "dslate");
  g.ell(cx, cy, r * 0.55, r * 0.55, "red", "dred");
  for (let k = 0; k < 2; k++) {
    const a = (Math.PI / 2) * (k + roll / 4);
    const dx = r * 0.5 * Math.cos(a);
    const dy = r * 0.5 * Math.sin(a);
    strand(
      g,
      [
        [cx - dx, cy - dy],
        [cx + dx, cy + dy],
      ],
      "dred",
    );
  }
  g.p(cx, cy, "amber");
}

// A canopy seen side on: a red roof line over a cream valance with a scalloped red hem, its back
// (right) end shaded.
function canopy(g: Drawable, x0: number, x1: number, y: number): void {
  g.rect(x0 - 0.5, y, x1 - x0 + 1, 1, "red");
  let x = x0;
  let i = 0;
  while (x < x1 - 0.01) {
    const w = Math.min(2, x1 - x);
    const shade = x > x1 - 3;
    g.rect(x, y + 1, w, 2.5, shade ? "tan" : "cream");
    if (i % 2 === 0) {
      g.rect(x, y + 3, w, 1.5, shade ? "dred" : "red");
    }
    x += w;
    i += 1;
  }
}

// An open car from x0, 36 columns long: three passengers in its bays under the canopy, the striped
// bench boards, the chassis and two wheels. wave raises the middle passenger's hand (2 swings it
// out).
function trainCar(g: Drawable, x0: number, heads: readonly Passenger[], wave = 0): void {
  g.rect(x0 + 1, 10, 34, 13, "navy");
  heads.forEach(([top, hair], i) => {
    const cx = x0 + 6.5 + i * 11.5;
    g.cel(cx, 21.5, 3.8, 2.4, top, null, null, 3);
    faceDisc(g, cx, 17, 3, 3, "skin1", "skin2");
    eyes(g, cx, 17);
    g.cel(cx, 14.6, 3.2, 1.7, hair, null, null, 3);
  });
  g.rect(x0, 22.5, 36, 8, "red");
  // the white bench boards on a whole-pixel pitch, so both cars keep their stripes at every depth
  // step
  const s = scaleOf(g);
  const px = raster(g);
  const pitch = Math.round(4 * s);
  const w = Math.min(Math.max(1, Math.round(2 * s)), pitch - 1);
  let x = Math.floor((x0 + 1.5) * s);
  const end = Math.floor((x0 + 35) * s);
  while (x + w <= end) {
    px.rect(x, Math.floor(23.5 * s), w, Math.floor(29.5 * s) - Math.floor(23.5 * s), "white");
    x += pitch;
  }
  g.rect(x0, 30, 36, 3, "red");
  g.rect(x0, 32, 36, 1, "dred");
  for (const post of [x0, x0 + 11.75, x0 + 23.25, x0 + 34.5]) {
    g.rect(post, 8.5, 1.5, 14.5, "red");
  }
  canopy(g, x0 - 0.5, x0 + 36.5, 6.5);
  if (wave) {
    // the middle passenger's arm up out of the open side, in front of the post, the hand open under
    // the canopy's hem, swung out on wave 2
    const top = heads[1]![0];
    const cx = x0 + 18;
    const hx = cx + (wave === 1 ? 3.8 : 5.3);
    g.rect(cx + 3, 16.5, 1.5, 4, top);
    g.rect(hx - 0.3, 13, 1.5, 4.5, top);
    g.rect(hx - 0.5, 11.3, 2.5, 2.5, "skin1");
  }
}

// The engine, its cab at the back (left) and the boiler in front.
function trainEngine(g: Drawable, toot = 0): void {
  // the open cab: the driver in a hickory-striped cap and blue overalls with a red neckerchief
  g.rect(81, 10, 10, 13, "navy");
  g.cel(86, 21.5, 4, 2.5, "blue", "navy", "sky", 3);
  g.rect(85, 19, 2.5, 1.2, "red");
  faceDisc(g, 86, 16.5, 3.2, 3.2, "skin1", "skin2");
  eyes(g, 86, 16.5);
  g.cel(86.5, 13.2, 3.8, 2, "white", "lgrey", null, 3);
  for (const x of [84.5, 86.5, 88.5]) {
    g.rect(x, 11.8, 0.75, 2.5, "sky");
  }
  g.rect(86, 14.3, 5.5, 0.9, "blue");
  for (const x of [80, 90.5]) {
    g.rect(x, 8.5, 1.5, 22, "red");
  }
  g.rect(80, 22.5, 12, 8.5, "red");
  g.rect(82, 24, 8, 5, "dred");
  g.rect(82.5, 24.5, 7, 4, "red");
  canopy(g, 78.5, 93.5, 6.5);
  // the Canadian flag on the cab roof, flying back
  g.rect(79, 1.2, 1, 5.3, "ink");
  g.rect(74.5, 1.2, 1.25, 2.5, "red");
  g.rect(75.75, 1.2, 2, 2.5, "white");
  g.rect(77.75, 1.2, 1.25, 2.5, "red");
  g.p(76.5, 2.2, "red");
  // the boiler, black, lit along its top, two slate bands, the smokebox's front ring
  g.rect(91, 20, 17, 11, "ink");
  g.rect(91, 20, 17, 1, "dslate");
  for (const x of [95.5, 101.5]) {
    g.rect(x, 20, 1, 11, "dslate");
  }
  g.rect(107, 19.5, 2.5, 12, "dslate");
  g.rect(107, 19.5, 1, 12, "slate");
  // the funnel stack with its flared lip, and the whistle's puff over it
  const x = 102;
  const top = 7.5;
  g.rect(x - 1.5, top + 4, 3, 20 - top - 4, "ink");
  g.rect(x - 1.5, top + 4, 1, 20 - top - 4, "dslate");
  g.tri([x - 4, top + 1.5], [x + 4, top + 1.5], [x, top + 6], "ink");
  g.rect(x - 4, top, 8, 1.5, "ink");
  g.rect(x - 3.5, top, 2.5, 1, "dslate");
  if (toot === 1) {
    g.cel(x, top - 1.6, 2.2, 1.6, "white", "lgrey");
  } else if (toot === 2) {
    g.cel(x - 0.5, top - 3, 3.2, 2.2, "white", "lgrey");
    g.cel(x + 1.8, top - 1, 1.5, 1.2, "white", "lgrey");
  } else if (toot === 3) {
    g.cel(x - 2, top - 4, 3.4, 2.2, "lgrey", "grey", "white");
    g.cel(x + 2.2, top - 5, 1.5, 1.1, "lgrey", "grey");
  }
  // the headlamp on the smokebox
  g.rect(107, 15.5, 3.5, 4, "dslate");
  g.rect(109.5, 16.5, 1.25, 2, "cream");
  // the frame under it all and the slatted black cowcatcher
  g.rect(79.5, 31, 30, 4, "red");
  g.rect(79.5, 34, 30, 1, "dred");
  quad(g, [109.5, 31], [111, 31], [116, 41], [109.5, 41], "ink");
  for (let k = 0; k < 3; k++) {
    g.rect(111 + k * 1.6, 33 + k * 2.5, 1, 1, "dslate");
  }
}

// High Park's tourist train side on, facing right: the engine pulling two open cars (see the header).
// roll (0 to 3) is a push frame: the spokes turn, the engine dips onto its wheels on frames 1 and 2
// and the cars bob in turn; wave raises the waving passenger's hand (2 swings it out), toot (1 to 3)
// is the whistle's puff.
function touristTrain({ roll = null, toot = 0, wave = 0 }: TrainPose = {}): Drawable {
  const g = edged(scope.Grid(TRAIN_W, TRAIN_H));
  const moving = roll !== null;
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const alt = roll === 0 || roll === 3 ? 1 : 0;
  const [[backX, back], [frontX, front]] = TRAIN_CARS as readonly [
    readonly [number, readonly Passenger[]],
    readonly [number, readonly Passenger[]],
  ];
  const couplers = (): void => {
    g.rect(38, 32.5, 3, 1.5, "ink");
    g.rect(76, 32.5, 4, 1.5, "ink");
  };
  const wheels = (): void => {
    for (const [x0] of TRAIN_CARS) {
      for (const x of [x0 + 7.5, x0 + 28.5]) {
        trainWheel(g, x, roll ?? 0);
      }
    }
    for (const x of [86, 102.5]) {
      trainWheel(g, x, roll ?? 0);
    }
  };
  layered(g, [
    [couplers, 0],
    [() => trainCar(g, backX, back), moving ? alt : 0],
    [() => trainCar(g, frontX, front, wave), moving ? 1 - alt : 0],
    [wheels, 0],
    [() => trainEngine(g, toot), dip],
  ]);
  return lit(g);
}

// ---------- Crosstown bus ----------

// The key, and the bus's design grid: 176x64 at road.ts's SCALE, as the tourist train's.
const BUS_KEY = "crosstown-bus";
const BUS_W = TRAIN_W;
const BUS_H = TRAIN_H;
// The body's rear and front columns, its roof, belt (white over red) and sill rows; the wheels'
// centre row, radius and columns, the feet a row above the frame's bottom row as the train's.
const BUS_REAR = 2;
const BUS_FRONT = 112;
const BUS_ROOF = 4;
const BUS_BELT = 22;
const BUS_SILL = 36.5;
const BUS_AXLE = 37.2;
const BUS_WHEEL = 4.6;
const BUS_WHEELS: readonly number[] = [28, 89];
// The doors' left columns, middle and front, each BUS_DOOR wide.
const BUS_DOORS: readonly number[] = [52, 98];
const BUS_DOOR = 7.5;

// A crosstown-bus pose: the push frame, the doors open, the kneel and the indicator lit.
interface BusPose {
  blink?: number;
  doors?: number;
  kneel?: number;
  roll?: number | null;
}

// Moving: the hubs' spokes turn a quarter of their spacing a frame (roll) and the body dips 1px onto
// its wheels on frames 1 and 2; 4 frames at 100ms, as every drive. Stopped at its stop: the doors
// open, the body kneels 1px on frames 1 and 2; 4 frames at 400ms. Pulling away: the doors shut and
// the front indicator blinks, the body up off its kneel from frame 1 and the wheels a quarter turned
// on frame 2; 3 frames at 120ms, the train's.
const BUS_TAGS: CrosserTags<BusPose> = [
  ["push", PUSH, 100],
  ["idle", [{ doors: 1 }, { doors: 1, kneel: 1 }, { doors: 1, kneel: 1 }, { doors: 1 }], 400],
  ["cue", [{ blink: 1, kneel: 1 }, {}, { blink: 1, roll: 1 }], 120],
];

// A black tire side on round a flat grey hub, a dslate spoke across the hub turned an eighth of a
// turn clockwise a frame (roll 0 to 3: |, /, - and \), as a wheel rolling right turns; the spoke's
// two ends make the loop seamless.
function busWheel(g: Drawable, cx: number, roll: number): void {
  const r = BUS_WHEEL;
  const cy = BUS_AXLE;
  g.ell(cx, cy, r, r, "ink");
  g.rect(cx - r + 0.6, cy - 1.5, 0.75, 3, "dslate");
  g.ell(cx, cy, r * 0.5, r * 0.5, "grey");
  const a = (Math.PI / 4) * roll;
  const d = r * 0.42;
  const dx = d * Math.sin(a);
  const dy = -d * Math.cos(a);
  strand(
    g,
    [
      [cx - dx, cy - dy],
      [cx + dx, cy + dy],
    ],
    "dslate",
  );
}

// A glass door from the window band's top to the sill in an lgrey frame: shut, two navy leaves split
// down the middle; open, the leaves folded back to its sides on the lit doorway, a yellow pole up it
// and its grey step.
function busDoor(g: Drawable, x0: number, open: number | boolean): void {
  const top = BUS_ROOF + 4;
  const w = BUS_DOOR;
  g.rect(x0, top, w, BUS_SILL - top, "lgrey");
  if (open) {
    g.rect(x0 + 1.5, top + 0.75, w - 3, BUS_SILL - top - 2.25, "dslate");
    g.rect(x0 + 1.5, BUS_SILL - 1.5, w - 3, 1.5, "grey");
    const s = scaleOf(g);
    raster(g).rect(
      Math.floor((x0 + w / 2) * s),
      Math.floor((top + 0.75) * s),
      1,
      Math.floor((BUS_SILL - 1.5) * s) - Math.floor((top + 0.75) * s),
      "yellow",
    );
    for (const x of [x0 + 0.75, x0 + w - 1.5]) {
      g.rect(x, top + 0.75, 0.75, BUS_SILL - top - 1.5, "navy");
    }
  } else {
    for (const x of [x0 + 0.75, x0 + w / 2 + 0.375]) {
      g.rect(x, top + 0.75, w / 2 - 1.125, BUS_SILL - top - 2.25, "navy");
    }
    glint(g, x0 + 1, top + 1.5, top + 7);
  }
}

// The bus's body, facing right: a red roof trim over the white upper body and its long dark window
// band, the roof pod at the back, the amber destination sign over the front door and windshield, the
// red lower body with a white stripe and a dred sill, the two doors, the dark wheel arches, the
// bumpers, the headlamp and the indicator, the mirror on its arm off the front of the roof.
function busBody(g: Drawable, doors = 0, blink = 0): void {
  const x0 = BUS_REAR;
  const x1 = BUS_FRONT;
  const top = BUS_ROOF;
  const belt = BUS_BELT;
  const sill = BUS_SILL;
  // the roof pod, white lit over lgrey, at the back
  g.rect(9, top - 2, 30, 2, "lgrey");
  row(g, 9, 39, top - 2, "white");
  // the white upper body, its top corners rounded, shaded down the nose
  const r = 3;
  g.rect(x0 + r, top, x1 - x0 - 2 * r, belt - top, "white");
  g.rect(x0, top + r, x1 - x0, belt - top - r, "white");
  for (const cx of [x0 + r, x1 - r]) {
    g.ell(cx, top + r, r, r, "white");
  }
  g.rect(x1 - 1, top + r, 1, belt - top - r, "lgrey");
  row(g, x0 + r, x1 - r, top, "ttc");
  // the long dark window band, glints across it
  g.rect(x0 + 3, top + 4, 92, 11.5, "navy");
  for (const x of [12, 16, 66, 70]) {
    glint(g, x, top + 4, top + 15.5);
  }
  // the windshield wrapping round the front, under the sign
  g.rect(x1 - 4.5, top + 4, 3.5, 18, "navy");
  glint(g, x1 - 4.5, top + 4, top + 9);
  // the destination sign: amber in an ink box, the route apart from its name
  g.rect(x1 - 15, top + 0.75, 13.5, 3, "ink");
  g.rect(x1 - 14, top + 1.5, 3, 1.5, "amber");
  g.rect(x1 - 10, top + 1.5, 7.5, 1.5, "amber");
  // the red lower body, lit along its top, a white stripe, the sill a step darker, shaded down the
  // nose
  g.rect(x0, belt, x1 - x0, sill - belt, "ttc");
  row(g, x0, x1, belt, "red");
  row(g, x0, x1, belt + 2.5, "white");
  g.rect(x0, sill - 1.5, x1 - x0, 1.5, "dred");
  g.rect(x1 - 1, belt + 1, 1, sill - belt - 1, "dred");
  for (const x of BUS_DOORS) {
    busDoor(g, x, doors);
  }
  // the indicator and the lit headlamp at the front (road.ts's headlamp, which the game's light layer
  // shines its headlight cone from), the bumpers at each end
  g.rect(x1 - 7, belt + 5.5, 3, 2, blink ? "yellow" : "amber");
  if (blink) {
    row(g, x1 - 7, x1 - 4, belt + 5.5, "white");
  }
  headlamp(g, x1 - 1.25, sill - 5.25);
  for (const x of [x0 - 0.5, x1 - 2]) {
    g.rect(x, sill - 3.5, 2.5, 3.5, "dslate");
    row(g, x, x + 2.5, sill - 3.5, "slate");
  }
  // the mirror on its arm off the front of the roof
  g.rect(x1 - 1, top + 1, 3, 1, "dslate");
  g.rect(x1 + 1.5, top + 1, 1, 3, "dslate");
  g.rect(x1 + 1, top + 3.5, 2, 5, "ink");
  // the wheel arches, dark, cut off at the sill
  for (const cx of BUS_WHEELS) {
    g.ell(cx, BUS_AXLE, BUS_WHEEL + 1.5, BUS_WHEEL + 1.5, "navy");
  }
  g.rect(0, sill, BUS_W, BUS_H, null);
}

// A TTC bus crossing Yonge Street side on, facing right (see the header). roll (0 to 3) is a push
// frame: the spokes turn and the body dips onto its wheels on frames 1 and 2; doors opens both doors,
// kneel dips the body 1px at the stop, blink lights the indicator.
function crosstownBus({ blink = 0, doors = 0, kneel = 0, roll = null }: BusPose = {}): Drawable {
  const g = edged(scope.Grid(BUS_W, BUS_H));
  const dip = roll === 1 || roll === 2 || kneel ? 1 : 0;
  layered(g, [
    [() => busBody(g, doors, blink), dip],
    [
      () => {
        for (const x of BUS_WHEELS) {
          busWheel(g, x, roll ?? 0);
        }
      },
      0,
    ],
  ]);
  return lit(g, { ttc: ["red", null] });
}

// ---------- brewery dray ----------

// The key, and the dray's design grid: 176x64 at road.ts's SCALE, as the tourist train's.
const DRAY_KEY = "brewery-dray";
const DRAY_W = TRAIN_W;
const DRAY_H = TRAIN_H;
// The flatbed's rear and front columns and its deck's top row; the kegs' width, height and pitch, the
// bottom tier's count and the top tier's, stepped up at the back; the tug's rear and front columns,
// its body's top row and the cab roof's row; the wheels' columns, on the bus's axle and radius.
const DRAY_BED = 2;
const DRAY_BED_FRONT = 70;
const DRAY_DECK = 28.5;
const DRAY_KEG_W = 10;
const DRAY_KEG_H = 11;
const DRAY_KEG_PITCH = 11;
const DRAY_KEGS = 6;
const DRAY_TOP_KEGS = 3;
const DRAY_TUG = 73;
const DRAY_TUG_FRONT = 114.5;
const DRAY_TUG_TOP = 22.5;
const DRAY_ROOF = 6;
const DRAY_WHEELS: readonly number[] = [13, 57];
const DRAY_TUG_WHEELS: readonly number[] = [82, 105];

// A brewery-dray pose: the push frame, the driver's wave and the beacon lit.
interface DrayPose {
  blink?: number;
  roll?: number | null;
  wave?: number;
}

// Moving: the hubs' spokes turn an eighth a frame (roll), the tug dips 1px onto its wheels on frames
// 1 and 2 and the flatbed bobs 1px in turn; 4 frames at 100ms, as every drive. Stopped: the driver
// waves out of the open cab, the hand swung out on frame 2; 4 frames at 400ms. Pulling away: the roof
// beacon blinks, the wheels a quarter turned on frame 2; 3 frames at 120ms, the train's.
const DRAY_TAGS: CrosserTags<DrayPose> = [
  ["push", PUSH, 100],
  ["idle", [{}, { wave: 1 }, { wave: 2 }, { wave: 1 }], 400],
  ["cue", [{ blink: 1 }, {}, { blink: 1, roll: 1 }], 120],
];

// An upright wooden keg side on from its top-left corner (x, y): oak staves lit down the left and
// shaded down the right, bellied a little at the middle, a pale chime at its top and two dark iron
// hoops.
function keg(g: Drawable, x: number, y: number): void {
  const w = DRAY_KEG_W;
  const h = DRAY_KEG_H;
  g.rect(x + 1, y, w - 2, h, "brown");
  g.rect(x, y + 2.5, w, h - 5, "brown");
  g.rect(x + 1, y + 0.5, 1.5, h - 1, "tan");
  g.rect(x, y + 2.5, 1, h - 5, "tan");
  g.rect(x + w - 2.5, y + 0.5, 1.5, h - 1, "dbrown");
  g.rect(x + w - 1, y + 2.5, 1, h - 5, "dbrown");
  row(g, x + 1, x + w - 1, y, "tan");
  for (const hy of [y + 2.5, y + h - 3.5]) {
    g.rect(x, hy, w, 1, "dslate");
  }
}

// The flatbed trailer: two tiers of kegs, the top one stepped up over the back, a yellow ratchet
// strap over each, on a dslate steel deck with a tail lamp at the back.
function flatbed(g: Drawable): void {
  const x0 = DRAY_BED;
  const x1 = DRAY_BED_FRONT;
  const deck = DRAY_DECK;
  const kh = DRAY_KEG_H;
  const kp = DRAY_KEG_PITCH;
  for (let i = 0; i < DRAY_KEGS; i++) {
    keg(g, x0 + 1 + i * kp, deck - kh);
  }
  for (let i = 0; i < DRAY_TOP_KEGS; i++) {
    keg(g, x0 + 1 + i * kp, deck - 2 * kh);
  }
  // the straps over each tier, a ratchet on each
  for (const [x, top] of [
    [x0 + 1 + kp + DRAY_KEG_W / 2, deck - 2 * kh],
    [x0 + 1 + 4.5 * kp + DRAY_KEG_W / 2, deck - kh],
  ] as const) {
    g.rect(x - 0.75, top - 0.5, 1.5, deck - top + 0.5, "yellow");
    g.rect(x - 1.25, deck - 4.5, 2.5, 2, "dslate");
  }
  g.rect(x0, deck, x1 - x0, 3, "dslate");
  row(g, x0, x1, deck, "slate");
  g.rect(x0 + 2, deck + 3, x1 - x0 - 4, 2, "navy");
  g.rect(x0 - 0.5, deck + 0.5, 1.5, 2, "red");
  // the tow bar to the tug
  g.rect(x1, deck + 3.5, DRAY_TUG - x1 + 1, 1.5, "ink");
}

// The electric tug, its open cab at the back (left) under a flat roof, the driver at the wheel behind
// the raked windscreen, the low brick red nose in front with the lit headlamp.
function tug(g: Drawable, wave = 0, blink = 0): void {
  const x0 = DRAY_TUG;
  const x1 = DRAY_TUG_FRONT;
  const top = DRAY_TUG_TOP;
  const roof = DRAY_ROOF;
  // the open cab: its dark inside, the driver in a green cap and shirt
  g.rect(x0 + 1.5, roof + 2, 25, top - roof - 2, "navy");
  g.cel(88, 21, 4.2, 3, "forest", null, null, 3);
  faceDisc(g, 88, 15.5, 3.2, 3.2, "skin1", "skin2");
  eyes(g, 88.6, 15.5);
  g.cel(87.5, 12.2, 3.6, 1.6, "forest", null, null, 3);
  g.rect(88, 12.6, 4.5, 1, "forest");
  // the steering wheel's rim on its column
  strand(
    g,
    [
      [93, 22],
      [96.5, 16.5],
    ],
    "ink",
  );
  g.rect(94.5, 16, 3.5, 1.2, "ink");
  if (wave) {
    const hx = wave === 1 ? 92.5 : 94;
    g.rect(90.5, 17, 1.5, 4, "forest");
    g.rect(hx - 0.3, 12.5, 1.5, 5, "forest");
    g.rect(hx - 0.5, 10.5, 2.5, 2.5, "skin1");
  }
  // the posts and the raked windscreen
  g.rect(x0, roof + 1, 2, top - roof, "dslate");
  quad(g, [100.5, roof + 1.5], [102.5, roof + 1.5], [105.5, top], [103.5, top], "dslate");
  glint(g, 97, roof + 3, roof + 9, "slate");
  // the flat roof, a step past the posts, and the beacon on it
  g.rect(x0 - 1, roof, 31, 2, "dslate");
  row(g, x0 - 1, x0 + 30, roof, "slate");
  g.rect(86.5, roof - 1.5, 3.5, 1.5, blink ? "yellow" : "amber");
  if (blink) {
    row(g, 86.5, 90, roof - 1.5, "white");
  }
  // the brick red body, lit along its top, the nose sloped down to the bumper
  g.rect(x0, top, 104 - x0, 34 - top, "brick");
  quad(g, [104, top], [108, top + 1.5], [x1, top + 4], [x1, 34], "brick");
  g.rect(104, top + 1, x1 - 104, 33 - top, "brick");
  row(g, x0, 104, top, "rust");
  g.rect(x0, 32.5, x1 - x0, 1.5, "dbrick");
  headlamp(g, x1 - 1.5, top + 6);
  g.rect(x1 - 2, 29.5, 3, 3, "dslate");
  row(g, x1 - 2, x1 + 1, 29.5, "slate");
  for (const cx of DRAY_TUG_WHEELS) {
    g.ell(cx, BUS_AXLE, BUS_WHEEL + 1.5, BUS_WHEEL + 1.5, "navy");
  }
  g.rect(0, 34, DRAY_W, DRAY_H, null);
}

// The Distillery District's brewery dray side on, facing right (see the header): an electric tug
// pulling a flatbed of wooden kegs. roll (0 to 3) is a push frame: the spokes turn, the tug dips onto
// its wheels on frames 1 and 2 and the flatbed bobs in turn; wave raises the driver's hand (2 swings
// it out), blink lights the roof beacon.
function breweryDray({ blink = 0, roll = null, wave = 0 }: DrayPose = {}): Drawable {
  const g = edged(scope.Grid(DRAY_W, DRAY_H));
  const moving = roll !== null;
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const alt = roll === 0 || roll === 3 ? 1 : 0;
  layered(g, [
    [() => flatbed(g), moving ? alt : 0],
    [
      () => {
        for (const x of [...DRAY_WHEELS, ...DRAY_TUG_WHEELS]) {
          busWheel(g, x, roll ?? 0);
        }
      },
      0,
    ],
    [() => tug(g, wave, blink), dip],
  ]);
  return lit(g, { brick: ["rust", null], dbrick: ["brick", null] });
}

// ---------- lifeguard patrol buggy ----------

// The key, and the buggy's design grid: 112x64 at road.ts's SCALE, two lanes on the train's grid.
const BUGGY_KEY = "patrol-buggy";
const BUGGY_W = 112 / SCALE;
const BUGGY_H = TRAIN_H;
// The buggy's wheels (columns, radius) and the trailer's, each on its axle row, their feet on the
// train's row.
const BUGGY_FEET = TRAIN_AXLE + TRAIN_WHEEL;
const BUGGY_WHEELS: readonly number[] = [37, 64.5];
const BUGGY_WHEEL = 5.4;
const TRAILER_WHEEL_X = 13;
const TRAILER_WHEEL = 3.8;

// A patrol-buggy pose: the push frame, the flag's flap and the light bar's flash.
interface BuggyPose {
  flap?: number;
  flash?: number;
  roll?: number | null;
}

// Moving: the hubs' spokes turn an eighth a frame, the buggy dips 1px onto its wheels on frames 1
// and 2 and the trailer bobs 1px in turn, as the train's cars; 4 frames at 100ms. Stopped: the surf
// flag on its whip pole flutters, its fly end lifting on frames 1 to 3 and furthest on frame 2; 4
// frames at 400ms. Pulling away: the roll bar's light bar flashes, the wheels a quarter turned on
// frame 2; 3 frames at 120ms, the train's.
const BUGGY_TAGS: CrosserTags<BuggyPose> = [
  ["push", PUSH, 100],
  ["idle", [{}, { flap: 1 }, { flap: 2 }, { flap: 1 }], 400],
  ["cue", [{ flash: 1 }, {}, { flash: 1, roll: 1 }], 120],
];

// A black tire side on round a white hub, its feet on BUGGY_FEET, a dslate spoke across the hub
// turned an eighth of a turn clockwise a frame (roll 0 to 3), as busWheel's.
function buggyWheel(g: Drawable, cx: number, r: number, roll: number): void {
  const cy = BUGGY_FEET - r;
  g.ell(cx, cy, r, r, "ink");
  g.rect(cx - r + 0.6, cy - 1.5, 0.75, 3, "dslate");
  g.ell(cx, cy, r * 0.5, r * 0.5, "white", "lgrey");
  const a = (Math.PI / 4) * roll;
  const d = r * 0.42;
  const dx = d * Math.sin(a);
  const dy = -d * Math.cos(a);
  strand(
    g,
    [
      [cx - dx, cy - dy],
      [cx + dx, cy + dy],
    ],
    "dslate",
  );
}

// The trailer behind the buggy: a dslate frame on one small wheel's fender, a red tail light at its
// back, its tongue to the hitch, and the rescue board lying on it, yellow with a white lit top, grab
// handles along its amber rail, its nose turned up at the front.
function trailer(g: Drawable): void {
  g.rect(2, 31, 21, 3, "dslate");
  row(g, 2, 23, 31, "slate");
  g.rect(22, 32, 7, 1.5, "ink");
  g.rect(1, 31, 2, 2.5, "red");
  g.cel(TRAILER_WHEEL_X, 32.5, 5.5, 2, "dslate", null, null, 3);
  // the board, flat along the bed, its nose rising at the front, a dark fin under its tail and the
  // grab handles along its amber rail
  g.rect(1.5, 27, 21, 3.5, "yellow");
  quad(g, [21, 27], [24, 25.2], [25.5, 26.2], [21, 30.5], "yellow");
  g.rect(1.5, 29, 21, 1.5, "amber");
  quad(g, [21, 29], [25, 26.2], [25.5, 26.2], [21, 30.5], "amber");
  g.rect(1.5, 27, 21, 0.75, "white");
  for (const x of [5, 10, 15]) {
    g.rect(x, 29.25, 2, 1, "dslate");
  }
}

// The buggy facing right: the surf flag on its whip pole at the back, the red cargo bed with a white
// rescue cross on its side, the seat and the lifeguard in a red tank top driving, the white roll bar
// over them with its light bar, the red hood sloping to the headlamp, the bumpers and the black
// running board between the wheel arches.
function buggyBody(g: Drawable, flap = 0, flash = 0): void {
  // the whip pole and the surf flag on it, red over yellow, flying back; flap lifts its fly end
  g.rect(28.5, 2, 1, 23, "dslate");
  const lift = [0, 0.75, 1.5][flap]!;
  quad(g, [21, 2.5 - lift], [28.5, 2.5], [28.5, 5], [21, 5 - lift], "red");
  quad(g, [21, 5 - lift], [28.5, 5], [28.5, 7.5], [21, 7.5 - lift], "yellow");
  // the roll bar: a white hoop from the bed over the seat to the hood, its light bar on top
  g.rect(41, 7, 1.75, 17, "white");
  g.rect(41, 6, 17, 1.75, "white");
  quad(g, [56.5, 6], [58.25, 6], [60.75, 22], [59, 22], "lgrey");
  g.rect(41.5, 7.75, 1.25, 16, "lgrey");
  g.rect(44, 3.5, 11, 2.5, "dslate");
  for (const x of [44.5, 51]) {
    g.rect(x, 3.5, 3.5, 2, flash ? "pink" : "red");
    if (flash) {
      g.rect(x + 1, 3.5, 1.5, 1, "white");
    }
  }
  // the seat back and the lifeguard: a red tank top, arms to the wheel, sunglasses, dbrown hair
  g.rect(43, 16, 2.5, 10, "dslate");
  g.cel(48.5, 22, 4, 5.5, "red", "dred", null, 3);
  g.rect(46.5, 16.5, 4, 2, "skin1");
  g.rect(51, 20.5, 5, 1.5, "skin1");
  g.rect(51, 21.5, 5, 0.75, "skin2");
  faceDisc(g, 48.5, 13, 3, 3, "skin1", "skin2");
  g.cel(48, 10.8, 3.2, 1.8, "dbrown", null, null, 3);
  g.rect(45.3, 11, 1.5, 3.5, "dbrown");
  g.rect(49.5, 12.5, 2.4, 1.2, "ink");
  // the steering wheel's column
  g.rect(55, 18.5, 1.25, 4.5, "dslate");
  g.rect(54, 19, 1.25, 4, "ink");
  // the cargo bed: its red side with the white rescue cross, a white rail along its top
  g.rect(27, 18, 16, 15, "red");
  row(g, 27, 43, 18, "white");
  g.rect(27, 18.75, 16, 0.75, "white");
  g.rect(32.5, 20.5, 3, 9, "white");
  g.rect(29.5, 23.5, 9, 3, "white");
  // the body under the seat and the hood, sloping down to the nose
  g.rect(42.5, 26, 15, 7, "red");
  quad(g, [57, 22], [69, 23.5], [72.5, 27], [57, 33], "red");
  g.rect(57, 26, 15.5, 7, "red");
  row(g, 57, 69, 22, "pink");
  g.rect(42.5, 26, 15, 0.75, "white");
  g.rect(71, 27, 1.5, 6, "dred");
  g.rect(27, 31.5, 45.5, 1.5, "dred");
  // the headlamp at the nose (road.ts's headlamp), the bumpers at each end
  headlamp(g, 70.5, 27.5);
  g.rect(71.5, 29.5, 2, 4.5, "dslate");
  g.rect(26, 29.5, 1.5, 4.5, "dslate");
  // the dark wheel arches, cut off at the running board
  for (const cx of BUGGY_WHEELS) {
    g.ell(cx, BUGGY_FEET - BUGGY_WHEEL, BUGGY_WHEEL + 1.4, BUGGY_WHEEL + 1.4, "navy");
  }
  g.rect(0, 34.5, BUGGY_W, BUGGY_H, null);
  g.rect(42.5, 33, 15, 1.5, "ink");
}

// The Beaches' lifeguard patrol buggy side on, facing right, towing the rescue board's trailer (see
// the header). roll (0 to 3) is a push frame: the spokes turn, the buggy dips onto its wheels on
// frames 1 and 2 and the trailer bobs in turn; flap lifts the surf flag's fly end (2 furthest), flash
// lights the light bar.
function patrolBuggy({ flap = 0, flash = 0, roll = null }: BuggyPose = {}): Drawable {
  const g = edged(scope.Grid(BUGGY_W, BUGGY_H));
  const moving = roll !== null;
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const alt = roll === 0 || roll === 3 ? 1 : 0;
  const wheels = (): void => {
    for (const x of BUGGY_WHEELS) {
      buggyWheel(g, x, BUGGY_WHEEL, roll ?? 0);
    }
    buggyWheel(g, TRAILER_WHEEL_X, TRAILER_WHEEL, roll ?? 0);
  };
  layered(g, [
    [() => trailer(g), moving ? alt : 0],
    [() => buggyBody(g, flap, flash), dip],
    [wheels, 0],
  ]);
  return lit(g);
}

// ---------- build ----------

// A crosser's tags at scale s: each pose drawn on a Mini there and outlined.
function crosser<Q>(draw: (q: Q) => Drawable, tags: CrosserTags<Q>, s: number): Tag[] {
  return tags.map(([tag, poses, ms]) => [tag, poses.map((q) => drawn(s, draw, q).outlined()), ms]);
}

// Every sprite: [key, [[tag, frames, duration ms]]] at full size, then at every depth step: the
// garbage truck on a Mini at TRUCK_SCALE x the step, the scooter, the tourist train, the TTC bus, the
// brewery dray and the patrol buggy at road.ts's SCALE x the step.
function* sprites(): Generator<Sprite> {
  const [drive, driveMs] = DRIVE;
  for (const [suffix, step] of sizes()) {
    yield [
      `stink-garbage-truck${suffix}`,
      [
        ["idle", [0, 1].map((f) => truck(garbageTruck, f, step)), 400],
        ["drive", drive.map((f) => truck(truckDriving, f, step)), driveMs],
      ],
    ];
  }
  for (const [suffix, step] of sizes()) {
    const s = SCALE * step;
    yield [
      `minor-scooter${suffix}`,
      [
        ["idle", [false, true].map((a) => drawn(s, scooter, a, 1 / s).outlined()), 500],
        ...SCOOTER_MOVES.map(([tag, d, fargs, fms]): Tag => [
          tag,
          fargs.map((a) => drawn(s, d, a, 1 / s).outlined()),
          fms,
        ]),
      ],
    ];
  }
  for (const [suffix, step] of sizes()) {
    yield [`${TRAIN_KEY}${suffix}`, crosser(touristTrain, TRAIN_TAGS, SCALE * step)];
  }
  for (const [suffix, step] of sizes()) {
    yield [`${BUS_KEY}${suffix}`, crosser(crosstownBus, BUS_TAGS, SCALE * step)];
  }
  for (const [suffix, step] of sizes()) {
    yield [`${DRAY_KEY}${suffix}`, crosser(breweryDray, DRAY_TAGS, SCALE * step)];
  }
  for (const [suffix, step] of sizes()) {
    yield [`${BUGGY_KEY}${suffix}`, crosser(patrolBuggy, BUGGY_TAGS, SCALE * step)];
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
