// Neighbourhood riders, vendors and workers with wheeled equipment.

import { CYCLIST_RIDE, swayRows } from "../hazards.ts";
import { scaled, small } from "../mini.ts";
import {
  type Colour,
  type Drawable,
  edged,
  Grid,
  K,
  type Point,
  raster,
  rowScaleOf,
  scaleOf,
} from "../pixel.ts";
import {
  BREATH,
  faceDisc,
  lampBox,
  lean,
  LIT,
  PERSON_WALK,
  rim,
  type Rims,
  SCALE,
  scope as roadScope,
  stampLamp,
  treads,
  unit,
} from "../road.ts";
import { bitmapAt, limb, range, scope, stride } from "./primitives.ts";

// ---------- delivery-cyclist: facing the player, riding down a lane at it ----------

// A delivery-cyclist pose: each foot's row, the rider's sway and the merge's tilt.
export interface DeliveryPose {
  lf?: number;
  rf?: number;
  sway?: number;
  tilt?: number;
}

export const DELIVERY_RIDE: readonly DeliveryPose[] = CYCLIST_RIDE;

export const DELIVERY_RIDE_MS = 90;

// Merging a lane right (the game mirrors it for left), as the taxi's merge: still pedalling
// CYCLIST_RIDE's stroke, the bike and box leaning DELIVERY_TILT layout pixels right at the top about
// the handlebar, the tire swinging out left under it, the head upright over the neck. 4 frames at
// 100ms.
const DELIVERY_TILT = 4;

export const DELIVERY_MERGE: readonly DeliveryPose[] = CYCLIST_RIDE.map((q) => ({
  lf: q.lf,
  rf: q.rf,
  tilt: DELIVERY_TILT,
}));

export const DELIVERY_MERGE_MS = 100;

// The layout rows the merge's tilt turns about (the handlebar) and carries the head by (the neck).
const DELIVERY_PIVOT = 24;

const DELIVERY_NECK = 20;

// The headlamp's layout point, over the mudguard.
const DELIVERY_LAMP: Point = [16, 31];

const DELIVERY_RIM: Rims = {
  ...LIT,
  blue: ["sky", null],
  dturq: ["turquoise", null],
  violet: ["lilac", null],
};

// The delivery rider facing the player, laid out on 32x48 as hazards.ts's cyclist is; deliveryAt
// draws it at size and adds the sway. part "body" leaves out the head and the headlamp and "head"
// draws only the head, for the merge's tilt, which puts the headlamp on after it shears the body.
function deliveryCyclist({
  lf = 36,
  part = "all",
  rf = 41,
}: {
  lf?: number;
  part?: "all" | "body" | "head";
  rf?: number;
} = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  if (part === "head") {
    deliveryHead(g);
    return g;
  }
  // the insulated box on the back: turquoise, lit along its top, a reflective band across, wider
  // than the shoulders and standing over the head
  g.rect(5, 1, 22, 22, "turquoise");
  g.rect(23, 1, 4, 22, "dturq");
  g.rect(5, 1, 22, 2, "foam");
  g.rect(5, 3, 22, 1, "dturq");
  g.rect(5, 1, 1, 22, "foam");
  g.rect(5, 13, 22, 2, "lgrey");
  g.rect(23, 13, 4, 2, "grey");
  g.p(5, 1, null);
  g.p(26, 1, null);
  // front wheel: a fat black tire edge-on, the fork, a black mudguard and the lit headlamp over it
  g.blob(16, 39.5, 3, 7, "ink");
  g.rect(15, 34, 2, 9, "dslate");
  g.rect(13.5, 32, 5, 2, "ink");
  g.rect(14.5, 30, 3, 2, "lgrey");
  // legs either side of the wheel: jeans to the ankle, black trainers with white soles
  for (const [x, foot] of [
    [10, lf],
    [19, rf],
  ] as const) {
    g.rect(x, 29, 3, foot - 29, "blue");
    g.rect(x + 2, 29, 1, foot - 29, "navy");
    g.rect(x < 16 ? x - 1 : x, foot, 4, 2, "ink");
    g.rect(x < 16 ? x - 1 : x, foot + 1, 4, 1, "white");
  }
  // the violet jacket, a zip down the front, the box's shoulder straps
  g.rect(9, 20, 14, 10, "violet");
  g.rect(20, 20, 3, 10, "purple");
  g.rect(9, 20, 1, 9, "lilac");
  g.rect(15.5, 20, 1, 10, "purple");
  for (const x of [10.5, 20]) {
    g.rect(x, 20, 1.5, 6, "ink");
  }
  g.p(9, 20, null);
  g.p(22, 20, null);
  // arms down to the grips, black gloves
  for (const x of [5, 24]) {
    g.rect(x, 21, 3, 4, "violet");
    g.rect(x + 2, 21, 1, 4, "purple");
  }
  // handlebar across, the phone on its mount at the middle, gloved hands on the grips
  g.rect(6, 27, 20, 2, "slate");
  g.rect(6, 27, 20, 1, "grey");
  g.rect(14, 25, 4, 3, "ink");
  g.rect(15, 25.5, 2, 1.5, "cyan");
  for (const x of [4, 25]) {
    g.rect(x, 25, 3, 4, "ink");
  }
  if (part === "all") {
    headlampAt(g, DELIVERY_LAMP);
    deliveryHead(g);
  }
  return rim(g, DELIVERY_RIM);
}

// road.ts's lit headlamp centred on layout point at of g.
function headlampAt(g: Drawable, at: Point): void {
  stampLamp(raster(g), ...lampBox(scaleOf(g), at[0], at[1], rowScaleOf(g)));
}

// The delivery rider's head on g: the face, then a black helmet with a grey vent stripe.
function deliveryHead(g: Drawable): void {
  faceDisc(g, 16, 14, 7.5, 6.5, "skin2", "brown");
  roadScope.faceFront(g, 16, 13.5);
  g.cel(16, 9, 8, 4, "navy", "ink", "dslate");
  g.rect(8, 10, 16, 2, "navy");
  g.rect(21, 10, 3, 2, "ink");
  g.rect(8.5, 12, 15, 1, "ink");
  g.rect(15.5, 5.5, 1, 4, "grey");
}

// deliveryCyclist on a Mini at SCALE x step s. At full size the rider leans (road.ts's lean shears
// about the feet); smaller, the rows above the handlebar shift sideways, which keeps the bars and
// wheel put. tilt instead leans the whole bike into a merge, tilt layout pixels right at the top (see
// deliveryTilted).
export function deliveryAt(
  s: number,
  { lf = 36, rf = 41, sway = 0, tilt = 0 }: DeliveryPose = {},
): Drawable {
  const p = SCALE * s;
  const g = raster(small(roadScope, scope, p, deliveryCyclist, { lf, rf }));
  if (tilt) {
    const body = raster(small(roadScope, scope, p, deliveryCyclist, { lf, part: "body", rf }));
    const head = raster(small(roadScope, scope, p, deliveryCyclist, { lf, part: "head", rf }));
    return deliveryTilted(g, body, head, tilt, p);
  }
  if (s === 1) {
    return sway ? edged(lean(g, sway)) : g;
  }
  swayRows(g, sway, scaled(26, p));
  return g;
}

// The rider at scale p leaning into a merge: the bike, the rider and the box sheared about the
// handlebar (DELIVERY_PIVOT), tilt layout pixels right at the top row and the tire swinging out left
// under it as a rider countersteering into a turn; the head (its pixels as drawn in whole) carried
// along unsheared by the neck's shift, so it stays upright over the tilted shoulders.
function deliveryTilted(whole: Grid, body: Grid, head: Grid, tilt: number, p: number): Grid {
  const pivot = DELIVERY_PIVOT * p;
  const shift = (y: number): number => Math.round((tilt * p * (pivot - y - 0.5)) / pivot);
  const out = raster(edged(scope.Grid(whole.w, whole.h)));
  for (let y = 0; y < whole.h; y++) {
    const dx = shift(y);
    for (let x = 0; x < whole.w; x++) {
      if (body.px[y]![x] && x + dx >= 0 && x + dx < whole.w) {
        out.px[y]![x + dx] = body.px[y]![x]!;
      }
    }
  }
  const neck = shift(DELIVERY_NECK * p);
  for (let y = 0; y < whole.h; y++) {
    for (let x = 0; x < whole.w; x++) {
      if (head.px[y]![x] && x + neck >= 0 && x + neck < whole.w) {
        out.px[y]![x + neck] = whole.px[y]![x]!;
      }
    }
  }
  // the headlamp goes on after the shear, moved whole by its middle row's shift, so it stays square
  const [x0, y0, n] = lampBox(p, DELIVERY_LAMP[0], DELIVERY_LAMP[1]);
  stampLamp(out, x0 + shift(y0 + Math.floor(n / 2)), y0, n);
  return out;
}

// ---------- segway-tour-rider: facing the player, standing on a Segway coming down a lane at it ----------

// A segway-tour-rider pose: the bob, the tread's phase and the pennant's flutter.
export interface SegwayPose {
  bob?: number;
  flag?: number;
  roll?: number;
}

// Riding: nothing to pedal, so the rider bobs 1px over the cobbles on frames 1 and 2, the knees
// taking it, the tread falls down both tires 1px a frame and the pennant flutters, its tip up, level,
// down, level. 4 frames at 90ms.
export const SEGWAY_RIDE: readonly Required<SegwayPose>[] = (
  [
    [0, -1],
    [1, 0],
    [1, 1],
    [0, 0],
  ] as const
).map(([b, f], k) => ({ bob: b, flag: f, roll: k }));

export const SEGWAY_RIDE_MS = 90;

const SEGWAY_RIM: Rims = { ...LIT, cobalt: ["azure", null], dstone: ["stone", null] };

// A Segway tour rider facing the player, standing upright on the platform between its two wheels,
// laid out on 32x48 as deliveryCyclist is: a white bike helmet with two vents and dark straps, black
// sunglasses, an azure tee under an open hi-vis yellow vest with two silver reflective bands, stone
// shorts, white sneakers; the hands on the grips of the T handlebar, its column down in front of the
// legs to the black platform; the tires edge-on either side under light grey fenders; behind the
// screen-right shoulder a whip pole with an orange pennant at its tip. bob lowers everything above
// the shoes; roll is the tread's phase; flag moves the pennant's tip up (-1) or down (1). The road
// outline and the lit rim.
export function segwayTourRider({ bob = 0, flag = 0, roll = 0 }: SegwayPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  // the whip pole up from the back of the platform, the orange pennant flying from its tip
  g.rect(26.5, 1 + b, 0.67, 40, "lgrey");
  g.tri([27, 1 + b], [27, 7 + b], [31.5, 4 + 1.5 * flag + b], "orange");
  g.tri([27, 4.5 + b], [27, 7 + b], [31.5, 4 + 1.5 * flag + b], "rust");
  // the tires edge-on either side of the platform, the tread rolling down them, light grey fenders
  // on top
  for (const cx of [6, 26]) {
    g.blob(cx, 40.5, 2.6, 6, "ink");
    for (const x of [cx - 1, cx]) {
      treadRows(g, x, 36, 46.5, roll, K.dslate!);
    }
    g.cel(cx, 35, 3, 1.6, "lgrey", "grey", "white");
  }
  // the platform between them: a slate mat on top, its black face
  g.rect(8.5, 42, 15, 1, "slate");
  g.rect(8.5, 43, 15, 2, "ink");
  // the legs standing on the platform, the knees taking the bob: stone shorts, bare shins, white
  // sneakers
  for (const x of [11, 18]) {
    g.rect(x, 31 + b, 3, 4, "stone");
    g.rect(x + 2, 31 + b, 1, 4, "dstone");
    g.rect(x, 35 + b, 3, 5.5 - b, "skin1");
    g.rect(x + 2, 35 + b, 1, 5.5 - b, "skin2");
    g.rect(x - 0.5, 40, 4, 2, "white");
    g.rect(x - 0.5, 41.5, 4, 0.67, "lgrey");
  }
  // the azure tee, the short sleeves, the forearms down to the grips
  g.rect(9, 20 + b, 14, 11, "azure");
  g.rect(20, 20 + b, 3, 11, "cobalt");
  g.p(9, 20 + b, null);
  g.p(22, 20 + b, null);
  for (const x of [6, 23]) {
    g.rect(x, 21 + b, 3, 3.5, x < 16 ? "azure" : "cobalt");
    g.rect(x, 24.5 + b, 3, 2.5, "skin1");
    g.rect(x + 2, 24.5 + b, 1, 2.5, "skin2");
  }
  // the hi-vis vest over it, open down the front, two silver reflective bands across
  for (const x0 of [9, 17]) {
    g.rect(x0, 20.5 + b, 6, 10, "yellow");
  }
  g.rect(20, 20.5 + b, 3, 10, "amber");
  g.rect(9, 20.5 + b, 1, 10, "cream");
  for (const y of [24, 27.5]) {
    g.rect(9, y + b, 6, 1, "lgrey");
    g.rect(17, y + b, 6, 1, "lgrey");
    g.rect(20, y + b, 3, 1, "grey");
  }
  g.p(9, 20.5 + b, null);
  g.p(22, 20.5 + b, null);
  // the T handlebar: the bar across, the column down in front of the legs to the platform, the hands
  // on the grips
  g.rect(7, 27.5 + b, 18, 1.5, "ink");
  g.rect(7, 27.5 + b, 18, 0.67, "grey");
  g.rect(15, 29 + b, 2, 13 - b, "dslate");
  g.rect(15, 29 + b, 0.67, 13 - b, "slate");
  g.rect(14, 26.5 + b, 4, 2.5, "ink");
  g.p(16, 27.5 + b, "green");
  for (const x of [5.5, 23.5]) {
    g.rect(x, 26.5 + b, 3, 3, "skin1");
    g.rect(x + 2, 26.5 + b, 1, 3, "skin2");
  }
  // head: the neck, brown hair at the sides, the face, black sunglasses and a smile
  g.rect(14, 18.5 + b, 4, 2, "skin2");
  g.rect(8, 10 + b, 2, 5, "brown");
  g.rect(22, 10 + b, 2, 5, "dbrown");
  faceDisc(g, 16, 14 + b, 7.5, 6.5, "skin1", "skin2");
  g.rect(9, 12.5 + b, 14, 2.5, "ink");
  g.rect(15, 12.5 + b, 2, 1, "slate");
  g.p(10.5, 12.5 + b, "white");
  g.p(18.5, 12.5 + b, "white");
  g.p(14, 16.5 + b, "dbrown");
  g.p(17, 16.5 + b, "dbrown");
  g.rect(15, 17.5 + b, 2, 1, "dbrown");
  // the dark chin straps down the cheeks, then the white bike helmet, its brim and two vents
  g.rect(8.5, 13 + b, 1, 5, "dslate");
  g.rect(22.5, 13 + b, 1, 5, "dslate");
  g.cel(16, 9 + b, 8.5, 5, "white", "lgrey");
  g.rect(7.5, 10 + b, 17, 2, "white");
  g.rect(21.5, 10 + b, 3, 2, "lgrey");
  g.rect(8, 12 + b, 16, 0.67, "grey");
  for (const x of [12, 18.5]) {
    g.rect(x, 5.5 + b, 1.5, 2.5, "grey");
  }
  return rim(g, SEGWAY_RIM);
}

// ---------- gardener: facing the player, pushing a wheelbarrow of leaves at it ----------

// A gardener pose: the walk's legs and bob, the tread's phase and the barrow's tip, as digit
// strings, choices rather than offsets, so they skip the snap.
export interface GardenerPose {
  bob?: number;
  lf?: number;
  rf?: number;
  roll?: string;
  tilt?: string;
}

// Pushing: PERSON_WALK's stride at the stroller's pace, the barrow rolling steadily in front, its
// tire's tread marks rolling 1 drawn pixel down a frame. 4 frames at 160ms.
export const GARDENER_PUSH: readonly GardenerPose[] = PERSON_WALK.map((q, n) => ({
  ...stride(q),
  roll: String(n),
}));

export const GARDENER_PUSH_MS = 160;

// Stopped: the barrow tipped forward onto its nose, the handles up at the chest, breathing.
export const GARDENER_IDLE: readonly GardenerPose[] = BREATH.map((b) => ({ bob: b, tilt: "2" }));

// Righting the barrow before a restart: tipped, halfway, level, then braced to push.
export const GARDENER_CUE: readonly GardenerPose[] = [
  { tilt: "2" },
  { tilt: "1" },
  { tilt: "0" },
  { bob: -1, tilt: "0" },
];

export const GARDENER_CUE_MS = 200;

// The leaves on the heap in the tray, red and orange with no gold or amber, which read as coins:
// [column from the heap's centre, depth down the heap as a fraction of its height, colour], each 3.5
// by 2, so they hold 2px at the smallest step. The lower ones show as the barrow tips forward.
const GARDENER_LEAVES: readonly (readonly [number, number, string])[] = [
  [-8, 0.1, "orange"],
  [-2.5, 0, "red"],
  [3.5, 0.05, "orange"],
  [8, 0.15, "red"],
  [-5, 0.33, "red"],
  [1, 0.33, "orange"],
  [6.5, 0.45, "orange"],
  [-8.5, 0.55, "red"],
  [-1.5, 0.6, "red"],
];

const GARDENER_RIM: Rims = {
  ...LIT,
  dgreen: ["green", null],
  dolive: ["olive", null],
  lime: ["lime", null],
  olive: ["moss", null],
};

// The gardener facing the player, walking behind the wheelbarrow as it rolls at the player. tilt 1
// and 2 tip the barrow forward onto its nose, the handles rising; roll moves the tire's tread down a
// pixel.
export function gardener({
  bob = 0,
  lf = 0,
  rf = 0,
  roll = "0",
  tilt = "0",
}: GardenerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const t = Number.parseInt(tilt, 10);
  const r = Number.parseInt(roll, 10);
  // legs walking behind the barrow: jeans and brown work boots
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 33 + b, 4, 10 + f - b, "blue");
    g.rect(x + 3, 33 + b, 1, 10 + f - b, "navy");
    g.rect(x, 43 + f, 4, 2, "brown");
    g.rect(x, 44 + f, 4, 1, "dbrown");
  }
  // the canvas apron to the knee, its straps over the shoulders, a pocket on the bib
  g.rect(9, 21 + b, 14, 17 - b, "tan");
  g.rect(20, 21 + b, 3, 17 - b, "brown");
  g.rect(9, 21 + b, 1, 16, "cream");
  g.rect(13, 23 + b, 6, 3, "brown");
  for (const x of [10, 20]) {
    g.rect(x, 20 + b, 2, 2, "brown");
  }
  // the chambray shirt at the shoulders, the sleeves rolled, the forearms out to the handles, green
  // gardening gloves on the grips
  const grip = 29.5 - 2.5 * t;
  g.rect(8, 20 + b, 16, 2, "sky");
  g.rect(14, 20 + b, 4, 1, "skin1");
  for (const [x0, x1] of [
    [7.5, 3],
    [24.5, 29],
  ] as const) {
    limb(g, x0, 22.5 + b, x1, grip, 3, [
      [0.45, "sky"],
      [0.8, "skin1"],
      [1, "lime"],
    ]);
  }
  // the leaves heaped above the tray, more of the heap showing as it tips forward
  const hy = 29 - 1.2 * t;
  const hr = 4.5 + 0.8 * t;
  g.cel(16, hy, 11.5, hr, "rust", "dbrick", "orange");
  for (const [dx, dy, c] of GARDENER_LEAVES) {
    g.rect(16 + dx - 1.75, hy - hr + dy * 2 * hr, 3.5, 2, c);
  }
  // the tray's front face, a green steel trapezoid lit along its lip; tipped, it shows less of itself
  // and a leaf or two slides over the lip
  const lip = 29 + t;
  g.tri([4, lip], [28, lip], [24, 37], "dgreen");
  g.tri([4, lip], [8, 37], [24, 37], "dgreen");
  g.tri([25, lip], [28, lip], [24, 37], "forest");
  g.rect(4, lip, 24, 1.5, "green");
  for (let k = 0; k < t; k++) {
    g.rect(11 + 8 * k, lip + 1.5 + k, 2.5, 1.5, (["orange", "red"] as const)[k]!);
  }
  // the handles' grips at the tray's back corners, the gloved hands on them
  for (const x of [1, 28.5]) {
    g.rect(x, grip + 0.5, 2.5, 1.5, "brown");
    g.rect(x + 0.5, grip - 0.5, 2, 2.5, "lime");
  }
  // the stands under the tray's back corners, off the road as it tips
  for (const x of [8.5, 22]) {
    g.rect(x, 36.5, 1.5, 4.5 - t, "slate");
  }
  // the wheel in front: a black tire edge-on in a grey fork, its tread rolling
  g.rect(13, 36.5, 1, 4.5, "lgrey");
  g.rect(18, 36.5, 1, 4.5, "lgrey");
  g.blob(16, 40.5, 2.5, 4.5, "ink");
  g.rect(13, 40, 1, 1, "grey");
  g.rect(18, 40, 1, 1, "grey");
  const px = raster(g);
  const s = scaleOf(g);
  const top = Math.floor(36 * s + 0.5);
  const bottom = Math.floor(45 * s + 0.5);
  const mid = Math.floor(16 * s + 0.5);
  for (let y = top + 2; y < bottom - 1; y++) {
    if ((y - top - r) % 4 === 0 && px.px[y]![mid]) {
      px.rect(mid - 1, y, 2, 1, "slate");
    }
  }
  // head: the face, white hair at the sides, an olive canvas sun hat with a wide brim
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.rect(8.5, 11 + b, 1.5, 4, "white");
  g.rect(22, 11 + b, 1.5, 4, "lgrey");
  g.cel(16, 7 + b, 6.5, 4.5, "olive", "dolive", "moss");
  g.rect(9.5, 9 + b, 13, 1, "dolive");
  g.rect(4, 10 + b, 24, 2, "olive");
  g.rect(4, 11 + b, 24, 1, "dolive");
  g.rect(4, 10 + b, 6, 1, "moss");
  roadScope.faceFront(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
  return rim(g, GARDENER_RIM);
}

// ---------- park-rangers-cart: a park ranger's utility cart, facing the player, stop and go ----------

// A park-rangers-cart pose: the drive frame (null at rest), the beacon, the ranger's look and his
// pointing hand.
export interface RangerPose {
  light?: number;
  look?: number;
  point?: number;
  roll?: number | null;
}

// Driving: the front tires' tread falls 1px a frame and the body dips 1px onto them on frames 1 and
// 2; 4 frames at 100ms, as every drive. Stopped: the amber light blinks while the ranger looks left,
// then right; 4 frames at 400ms. Restarting: the ranger jabs a finger ahead, the light flashing; 4
// frames at 120ms.
export const RANGER_PUSH: readonly RangerPose[] = range(0, 4).map((r) => ({ roll: r }));

export const RANGER_PUSH_MS = 100;

export const RANGER_IDLE: readonly RangerPose[] = [
  {},
  { light: 1, look: -1 },
  {},
  { light: 1, look: 1 },
];

export const RANGER_IDLE_MS = 400;

export const RANGER_CUE: readonly RangerPose[] = [
  { light: 1, point: 1 },
  { point: 2 },
  { light: 1, point: 1 },
  { point: 2 },
];

export const RANGER_CUE_MS = 120;

const RANGER_RIM: Rims = { ...LIT, dolive: ["olive", null], olive: ["moss", null] };

// A park ranger's small utility cart coming down its lane at the pack, facing the player, laid out on
// 32x48 and drawn at SCALE as the pedicab is: a white roof on two posts with an amber light on top,
// the ranger at the wheel on the cart's left (screen right) in an olive uniform and a tan
// flat-brimmed campaign hat, a kraft paper bag of leaves standing in the bed behind the passenger
// seat, the green cowl with two headlights and a white plate with its number in blue, a black bumper
// and the front tires under their fenders. roll (0 to 3) is a drive frame: the tread falls down the
// tires (still at rest) and the body dips 1px onto them on frames 1 and 2. light lights the amber
// beacon, look turns the ranger's eyes (-1 screen left, 1 right) and point raises his free hand
// pointing ahead (2 a pixel higher).
export function parkRangersCart({
  light = 0,
  look = 0,
  point = 0,
  roll = null,
}: RangerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const px = raster(g);
  const u = unit(g)[1];
  // the front tires, front on under the fenders, their tread falling as they roll at the player
  for (const x of [4.5, 27.5]) {
    g.blob(x, 41.5, 3, 5.5, "ink");
    g.rect(x - 2.5, 38, 1, 7, "dslate");
    treads(g, x - 1, 37, 3, 9, roll || 0, u, true);
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = range(0, px.h).map(() => Array<Colour>(px.w).fill(null));
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  // the amber light on the roof: a dome on a black base, lit yellow with a white core and two rays
  g.rect(13.5, 4, 5, 1, "ink");
  if (light) {
    g.cel(16, 3, 2.5, 2, "yellow", "amber", "white");
    g.p(12, 2, "yellow");
    g.p(19, 2, "yellow");
    g.p(15.5, 0, "yellow");
  } else {
    g.cel(16, 3, 2.5, 2, "amber", "orange", "yellow");
  }
  // the roof: white, lit along its top, shaded down its right and along its underside
  g.rect(1, 5, 30, 3, "white");
  g.rect(27, 5, 4, 3, "lgrey");
  g.rect(1, 7, 30, 1, "lgrey");
  // the cab: the shade under the roof, the posts either side, the seat back across
  g.rect(4, 8, 24, 18, "navy");
  for (const x of [2.5, 27.5]) {
    g.rect(x, 8, 2, 19, "dslate");
    g.rect(x, 8, 1, 19, "slate");
  }
  // the kraft paper leaf bag in the bed behind the passenger seat (screen left), leaves over its
  // rolled top
  g.rect(5, 14, 7, 6, "tan");
  g.rect(10, 14, 2, 6, "brown");
  g.rect(5, 14, 1, 6, "cream");
  g.rect(5, 14, 7, 1, "brown");
  for (const [x, y, c] of [
    [5.5, 12.5, "orange"],
    [7.5, 12, "red"],
    [9.5, 12.5, "amber"],
    [6.5, 13, "rust"],
    [10, 13, "ochre"],
  ] as const) {
    g.rect(x, y, 2, 1.5, c);
  }
  g.rect(4, 19, 24, 7, "dslate");
  g.rect(4, 19, 24, 1, "slate");
  // the ranger at the wheel (screen right): olive shoulders, a collar and a gold badge
  g.cel(20, 23.5, 6.5, 4.5, "olive", "dolive", "moss", 3);
  g.rect(18, 19.5, 4, 1.5, "skin2");
  g.rect(18.5, 20, 1, 1.5, "dolive");
  g.rect(20.5, 20, 1, 1.5, "dolive");
  g.rect(16, 22, 1.5, 1.5, "gold");
  // his free hand (screen left): on the wheel, or raised over the leaf bag pointing ahead, a pixel
  // higher on point 2
  if (point) {
    const n = point - 1;
    for (let k = 0; k < 5; k++) {
      g.rect(13.5 - 0.8 * k, 19.5 - 1.6 * k - n, 2.5, 2.5, "olive");
    }
    g.rect(13.5, 19.5 - n, 1, 2.5, "dolive");
    g.rect(9.5, 10 - n, 3, 3, "skin1");
    g.rect(11.5, 10 - n, 1, 3, "skin2");
    g.rect(10, 8.5 - n, 1.5, 1.5, "skin1");
  }
  // the steering wheel edge on in front of his chest, his hands on its rim, the column down into the
  // dash
  g.rect(14.5, 24.5, 11, 1.5, "ink");
  g.rect(19.5, 26, 1, 1, "ink");
  for (const x of [14, 23.5]) {
    if (x === 14 && point) {
      continue;
    }
    g.rect(x, 23.5, 2.5, 2.5, "skin1");
    g.rect(x + 1.5, 23.5, 1, 2.5, "skin2");
  }
  // his face under the campaign hat: a tan crown pinched to a peak, a brown band, the flat brim
  faceDisc(g, 20, 15.5, 4.5, 4.5, "skin1", "skin2");
  roadScope.faceFront(g, 20 + look, 15, { mouth: 3, spread: 2.5 });
  g.rect(17, 9, 6, 3, "tan");
  g.rect(18, 8, 4, 1, "tan");
  g.rect(17, 9, 1, 2, "cream");
  g.rect(22, 9, 1, 2, "brown");
  g.rect(16.5, 11, 7, 1, "dbrown");
  g.rect(13.5, 12, 13, 1.5, "tan");
  g.rect(23.5, 12, 3, 1.5, "brown");
  g.rect(13.5, 13, 13, 0.75, "brown");
  // the cowl: green, lit along its top, shaded down its right, over the dash
  g.rect(3, 26, 26, 2, "dgreen");
  g.rect(3, 26, 26, 1, "green");
  g.rect(3.5, 28, 25, 7, "green");
  g.rect(3.5, 28, 25, 1, "lime");
  g.rect(25, 28, 3.5, 7, "dgreen");
  g.rect(5, 34, 22, 1, "dgreen");
  for (const x of [3.5, 27.5]) {
    g.p(x, 28, null);
  }
  // the fenders over the tires
  for (const x of [1, 24.5]) {
    g.rect(x, 35, 6.5, 2.5, "green");
    g.rect(x, 37, 6.5, 0.75, "dgreen");
  }
  g.rect(29, 35, 2.5, 2.5, "dgreen");
  // the headlights and the white Ontario plate, its number in blue
  for (const x of [8.5, 23.5]) {
    g.cel(x, 31, 2.2, 2.2, "white", "lgrey");
  }
  g.rect(13, 30.5, 6, 3.5, "white");
  g.rect(13, 33, 6, 1, "lgrey");
  g.rect(14, 31.5, 4, 1, "blue");
  // the black bumper between the fenders
  g.rect(8, 35, 16, 2, "ink");
  g.rect(8, 35, 16, 1, "dslate");
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => (y >= dip ? body[y - dip]![x]! : null) || wheels[y]![x]!),
  );
  return rim(g, RANGER_RIM);
}

// ---------- ice-cream-bike: facing the player, pedalling a freezer box down a lane ----------

// An ice-cream-bike pose: each foot's row, the tread's frame (null for none), the rider's sway and
// bob, the cone offered and lifted, and the bell's ring (0 for none).
export interface IcePose {
  bob?: number;
  lf?: number;
  lift?: number;
  offer?: boolean;
  rf?: number;
  ring?: number;
  roll?: number | null;
  sway?: number;
}

// Pedalling: each foot's row under the box (the pedals go round), the wheels' tread roll and the
// rider's 1px sway toward the foot pushing down; 4 frames at 120ms.
export const ICE_PUSH: readonly IcePose[] = [
  { lf: 41, rf: 44, roll: 0, sway: -2 / 3 },
  { lf: 42.5, rf: 42.5, roll: 1 },
  { lf: 44, rf: 41, roll: 2, sway: 2 / 3 },
  { lf: 42.5, rf: 42.5, roll: 3 },
];

export const ICE_PUSH_MS = 120;

// Stopped: the feet down, a cone held out in the screen-right hand, lifted 1px on frame 1 as the
// rider breathes; 2 frames at 400ms.
export const ICE_IDLE: readonly IcePose[] = [
  { offer: true },
  { bob: -2 / 3, lift: 2 / 3, offer: true },
];

export const ICE_IDLE_MS = 400;

// Restarting: the thumb on the bell, the bell rocking and its ring marks flashing out; 2 frames at
// 150ms.
export const ICE_CUE: readonly IcePose[] = [{ ring: 1 }, { ring: 2 }];

export const ICE_CUE_MS = 150;

const ICE_RIM: Rims = { ...LIT, blue: ["sky", null] };

// The ring marks over the bell, in drawn pixels so they keep their strokes at any scale: three
// strokes fanning out: up and up-left on ring 1, all three further out on ring 2.
const RING: readonly (readonly string[])[] = [
  [
    "......#...",
    "......#...",
    "...#......",
    "....#.....",
    "..........",
    "..........",
    "..........",
  ],
  [
    "......#...",
    "......#...",
    ".#........",
    "..#.......",
    "..........",
    "##........",
    "..........",
  ],
];

// In design columns x0 to x1 and rows above y1, where inside(x, y) holds, swap each drawn pixel's
// colour by swap (K names).
function recolour(
  g: Drawable,
  x0: number,
  x1: number,
  y1: number,
  inside: (x: number, y: number) => boolean,
  swap: Readonly<Record<string, string>>,
): void {
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const px = raster(g);
  const byHex = new Map(Object.entries(swap).map(([a, b]) => [K[a]!, K[b]!]));
  for (let y = 0; y < Math.min(px.h, scaled(y1, sy)); y++) {
    for (let x = Math.max(0, scaled(x0, s)); x < Math.min(px.w, scaled(x1, s)); x++) {
      const c = px.px[y]![x]!;
      const to = c === null ? undefined : byHex.get(c);
      if (to !== undefined && inside((x + 0.5) / s, (y + 0.5) / sy)) {
        px.px[y]![x] = to;
      }
    }
  }
}

// The ice cream vendor's front-loading tricycle coming down a lane at the player, laid out on 32x48:
// a red and white striped umbrella over the rider, a white freezer box in front facing the player,
// its lid lit foam, an orange popsicle sign with a bite out of it on its face, a shallow band along
// its foot, the two wheels under its corners and the rider's shins and white sneakers on the pedals
// between them. The rider wears a white paper cap with a red band and a sky shirt, the hands on the
// bar along the box's back, a gold bell at its left end. sway moves the rider (not the umbrella or
// box) sideways; roll (0 to 3) falls the tread down the tires; offer holds a strawberry cone out in
// the screen-right hand, lift raising it; ring rocks the bell and draws its ring marks.
export function iceCreamBike({
  bob = 0,
  lf = 42.5,
  lift = 0,
  offer = false,
  rf = 42.5,
  ring = 0,
  roll = null,
  sway = 0,
}: IcePose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const u = 1 / scaleOf(g);
  const d = sway;
  const h = bob;
  // the umbrella: a dome lit on its upper left, in six panels, red and white, that taper to the top
  g.cel(16, 7.5, 15, 7, "red", "dred", "pink");
  g.rect(0, 7.5, 32, 8, null);
  const panel = (x: number, y: number): boolean => {
    const hw = 15 * Math.max(0.05, 1 - ((y - 7.5) / 7) ** 2) ** 0.5;
    const n = Math.floor(((x - 16) / hw + 1) * 3);
    return ((n % 2) + 2) % 2 === 1;
  };
  recolour(g, 0, 32, 7.5, panel, { dred: "lgrey", pink: "white", red: "white" });
  g.rect(15.5, 0, 1, 1, "dred");
  // its valance, a scallop under each panel
  for (let k = 0; k < 6; k++) {
    const red = k % 2 === 0;
    g.cel(3.5 + k * 5, 7.5, 2.5, 1.7, red ? "red" : "white", red ? "dred" : "lgrey");
  }
  // the wheels under the box's corners, edge-on, their tread falling as they roll at the player
  for (const x of [5, 27]) {
    g.blob(x, 43.5, 1.8, 4, "ink");
    if (roll !== null) {
      treads(g, x - 0.5, 40, 1, 7, roll, u, true);
    }
    g.rect(x - 1.5, 39.5, 3, 1.5, "lgrey");
  }
  // the rider's shins and white sneakers on the pedals, behind the axle
  for (const [x, foot] of [
    [11.5, lf],
    [17.5, rf],
  ] as const) {
    g.rect(x + d, 39, 3, foot - 39, "skin1");
    g.rect(x + 2 + d, 39, 1, foot - 39, "skin2");
    g.rect(x - 0.5 + d, foot, 4, 2, "white");
    g.rect(x - 0.5 + d, foot + 1.5, 4, 0.75, "lgrey");
  }
  g.rect(4, 40.5, 24, 1, "dslate");
  // the rider: the sky shirt, its white collar, the shoulders over the box
  g.cel(16 + d, 25 + h, 8, 5.5, "sky", "blue", "cyan", 3);
  g.rect(14 + d, 19.5 + h, 4, 1.5, "white");
  // the arms down to the bar, unless the screen-right hand holds a cone out
  for (const x of offer ? [6] : [6, 23]) {
    g.rect(x + d, 21 + h, 3, 3, "sky");
    g.rect(x + 2 + d, 21 + h, 1, 3, "blue");
    g.rect(x + d, 24 + h, 3, 2, "skin1");
    g.rect(x + 2 + d, 24 + h, 1, 2, "skin2");
  }
  // the head: the face under short brown hair, a fringe over the brow
  faceDisc(g, 16 + d, 14.5 + h, 6.5, 5.5, "skin1", "skin2");
  g.cel(16 + d, 10.5 + h, 7, 3, "brown", "dbrown", "tan");
  g.rect(9.5 + d, 10.5 + h, 2, 4, "brown");
  g.rect(20.5 + d, 10.5 + h, 2, 4, "dbrown");
  roadScope.faceFront(g, 16 + d, 14 + h);
  g.p(11 + d, 17 + h, "pink");
  g.p(21 + d, 17 + h, "pink");
  if (offer) {
    // the cone held out to screen right: the sleeve up from the shoulder, the hand under a waffle
    // cone with a strawberry scoop
    const c = -lift;
    g.rect(23, 20 + h, 4, 3, "sky");
    g.rect(26, 20 + h, 1, 3, "blue");
    g.rect(25.5, 17 + c, 3, 4, "skin1");
    g.rect(27.5, 17 + c, 1, 4, "skin2");
    g.tri([24.5, 13.5 + c], [30.5, 13.5 + c], [27.5, 19 + c], "tan");
    g.tri([27.5, 13.5 + c], [30.5, 13.5 + c], [27.5, 19 + c], "ochre");
    g.cel(27.5, 12 + c, 3, 2.5, "pink", "mauve", "white");
  }
  // the bar along the box's back, the bell at its left end
  g.rect(4, 26, 24, 1.5, "slate");
  g.rect(4, 26, 24, 0.75, "grey");
  const rock = ring ? (ring === 1 ? -1 : 1) * u : 0;
  g.cel(4 + rock, 24.5, 2, 1.8, "gold", "amber", "yellow");
  g.rect(3.5 + rock, 24, 1, 0.75, "white");
  if (ring) {
    g.rect(5.5, 24.5, 1.5, 1.5, "skin1");
  }
  // the freezer box: lit foam along its lid, white down its face, shaded lgrey down the right
  g.rect(3, 27, 26, 13.5, "white");
  g.rect(26, 27, 3, 13.5, "lgrey");
  g.rect(2.5, 27, 27, 2, "foam");
  g.rect(2.5, 28.5, 27, 0.75, "shallow");
  g.rect(3, 37.5, 26, 2, "shallow");
  g.rect(26, 37.5, 3, 2, "lake");
  // the popsicle sign on its face: a creamsicle with a bite out of its top right, on a tan stick
  g.rect(15, 35, 2, 3, "tan");
  g.rect(16.5, 35, 0.75, 3, "brown");
  g.cel(16, 32, 3, 4, "orange", "rust", "amber", 4);
  g.cel(18.5, 28.5, 1.5, 1.5, "white");
  g.rect(14, 30, 1, 3, "white");
  if (ring) {
    // the ring marks: three short strokes out from the bell, up, up-left and left, further out on
    // ring 2
    bitmapAt(g, RING[ring - 1]!, 0, 19.5, "amber");
  }
  return rim(g, ICE_RIM);
}

// ---------- food-cart-vendor: pushing a churro cart down a lane at the player ----------

// A food-cart-vendor pose: the walk's legs and bob, the cloth's reach in design columns (null to
// push), the bell ("up" or "ring") and the tread's phase.
export interface CartPose {
  bell?: string | null;
  bob?: number;
  lf?: number;
  rf?: number;
  tread?: number;
  wipe?: number | null;
}

// Pushing the cart: PERSON_WALK's stride under the cart and the 1px bob, the stroller's pace, while
// the tires' tread rolls down a row a frame (tread, in the drawn grid's own pixels). 4 frames at
// 160ms.
export const CART_PUSH: readonly CartPose[] = PERSON_WALK.map((q) => ({
  bob: q.bob ?? 0,
  lf: q.lf ?? 0,
  rf: q.rf ?? 0,
}));

export const CART_PUSH_MS = 160;

// Stopped: wiping the counter, the cloth out to the middle and back, breathing (frame 0 the rest
// pose); 4 frames at 250ms.
export const CART_IDLE: readonly CartPose[] = [
  { wipe: 0 },
  { wipe: 3 },
  { bob: -1, wipe: 6 },
  { bob: -1, wipe: 3 },
];

export const CART_IDLE_MS = 250;

// Setting off again: the hand up over the counter bell, then down on it as it rings, twice. 4 frames
// at 200ms.
export const CART_CUE: readonly CartPose[] = [
  { bell: "up" },
  { bell: "ring" },
  { bell: "up" },
  { bell: "ring" },
];

export const CART_CUE_MS = 200;

const CART_RIM: Rims = {
  ...LIT,
  dturq: ["turquoise", null],
  moss: ["lime", null],
  violet: ["lilac", null],
};

// Tread marks on an edge-on tire spanning design columns x to x + 1 and rows y0 to y1, in the drawn
// grid's own pixels so they stay 1px at every step: every fourth row, rolling down a row each phase.
function treadRows(g: Drawable, x: number, y0: number, y1: number, phase: number, c: string): void {
  const s = scaleOf(g);
  const px = raster(g);
  const x0 = scaled(x, s);
  const x1 = Math.max(scaled(x + 1, s), scaled(x, s) + 1);
  for (let y = scaled(y0, s); y < scaled(y1, s); y++) {
    if ((y - phase) % 4 === 0) {
      for (let xx = x0; xx < x1; xx++) {
        if (px.px[y]![xx]) {
          px.p(xx, y, c);
        }
      }
    }
  }
}

// A Kensington churro vendor pushing a snack cart down the road at the player, the cart in front of
// him: a flat awning striped turquoise and cream on two poles, a scalloped valance under it; the
// vendor behind the counter in a white paper cap over dark hair, a lime tee and a white apron; on the
// counter a paper cup of sugared churros (left) and a silver counter bell (right); the violet cart's
// front a chalk menu board with a churro and three lines of writing; two black tires edge-on at its
// corners and his jeans and brown shoes walking under it. wipe (design columns) puts his right hand
// (screen right) on the counter with a cloth; bell "up" lifts that hand over the bell, "ring" rings
// it; otherwise both hands are on the push bar behind the cart. The road outline and the lit rim.
export function foodCartVendor({
  bell = null,
  bob = 0,
  lf = 0,
  rf = 0,
  tread = 0,
  wipe = null,
}: CartPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  // the legs walking under the cart, behind it: jeans and brown shoes
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 36, 4, 6 + f, "blue");
    g.rect(x + 3, 36, 1, 6 + f, "navy");
    g.rect(x, 42 + f, 4, 2, "brown");
    g.rect(x, 43 + f, 4, 1, "dbrown");
  }
  // the tires, edge-on at the cart's front corners, under steel brackets
  for (const cx of [6, 26]) {
    g.rect(cx - 0.5, 36, 1, 3, "slate");
    g.ell(cx, 41.5, 1.8, 4, "ink");
    treadRows(g, cx - 0.5, 38, 45.5, tread, K.dslate!);
  }
  // the arms: sleeves, the screen-left forearm down to the push bar behind the counter
  g.rect(5, 22 + b, 4, 3, "lime");
  g.rect(8, 22 + b, 1, 3, "moss");
  g.rect(6, 25 + b, 3, 3, "skin1");
  g.rect(23, 22 + b, 4, 3, "lime");
  g.rect(26, 22 + b, 1, 3, "moss");
  // the lime tee, shaded down its right, the white apron's bib over it on a strap round the neck
  g.rect(9, 21 + b, 14, 7, "lime");
  g.rect(20, 21 + b, 3, 7, "moss");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(12, 23 + b, 8, 5, "white");
  g.rect(19, 23 + b, 1, 5, "lgrey");
  g.rect(12, 21 + b, 1, 2, "white");
  g.rect(19, 21 + b, 1, 2, "white");
  // head: dark hair at the sides, the face, the white paper cap
  g.rect(8.5, 11 + b, 2, 6, "dbrown");
  g.rect(21.5, 11 + b, 2, 6, "dbrown");
  g.rect(14, 19 + b, 4, 2, "skin1");
  faceDisc(g, 16, 14.5 + b, 7, 6, "skin1", "skin2");
  g.cel(16, 10 + b, 7.5, 2.5, "white", "lgrey");
  g.rect(8.5, 10.5 + b, 15, 1.5, "white");
  g.rect(8.5, 11.5 + b, 15, 1, "lgrey");
  roadScope.faceFront(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
  // the screen-right hand: down to the push bar, out on the counter with the cloth, or at the bell
  if (wipe !== null) {
    const x = 22 - wipe;
    g.rect(x, 25 + b, 27 - x, 2, "skin1");
    g.rect(x - 1, 26, 5, 1, "turquoise");
    g.rect(x - 1, 26, 5, 0.67, "foam");
    g.rect(x, 24.5 + b, 3, 2, "skin1");
    g.rect(x + 2, 24.5 + b, 1, 2, "skin2");
  } else if (bell) {
    const y = bell === "up" ? 22 : 24;
    g.rect(24, y, 3, 3, "skin1");
    g.rect(26, y, 1, 3, "skin2");
  } else {
    g.rect(23, 25 + b, 3, 3, "skin1");
    g.rect(25, 25 + b, 1, 3, "skin2");
  }
  // the counter bell, ringing on "ring": two short marks out either side of it
  g.cel(26, 26.5, 2, 1.5, "lgrey", "grey", "white");
  if (bell !== "up") {
    g.rect(25.5, 24.5, 1, 1, "grey");
  }
  if (bell === "ring") {
    g.rect(29, 23, 1, 1, "white");
    g.rect(30, 24.5, 1, 1.5, "white");
  }
  // the paper cup of churros, sugared, fanned out of a turquoise band
  for (const [x, top] of [
    [4, 19.5],
    [6, 18],
    [8, 19.5],
  ] as const) {
    g.rect(x, top, 1, 6, "ochre");
    g.p(x, top, "cream");
  }
  g.rect(3.5, 23.5, 6, 3.5, "white");
  g.rect(8.5, 23.5, 1, 3.5, "lgrey");
  g.rect(3.5, 24.5, 6, 1, "turquoise");
  // the counter's white lip, then the violet cart lit down its left and shaded down its right
  g.rect(3, 27, 26, 1, "white");
  g.rect(3, 28, 26, 0.67, "lgrey");
  g.rect(4, 28.5, 24, 8, "violet");
  g.rect(4, 28.5, 1, 8, "lilac");
  g.rect(25, 28.5, 3, 8, "purple");
  // the menu board: a slate chalkboard framed in brown, a churro drawn on the left
  g.rect(8, 29.5, 15, 6, "brown");
  g.rect(9, 30.5, 13, 4, "dslate");
  for (let k = 0; k < 4; k++) {
    g.rect(10 + k, 33.5 - k, 2, 1, "ochre");
  }
  // two lines of writing at full size; a smaller board, too short to keep them apart, none
  if (scaleOf(g) >= 1.3) {
    for (const [y, w] of [
      [31, 6],
      [33.5, 5],
    ] as const) {
      g.rect(15, y, w, 0.67, "cream");
    }
  }
  // the awning: poles up from the cart's front corners, the canopy striped turquoise and cream, lit
  // along the top, its right in shade, a scallop under each stripe
  for (const x of [3, 28]) {
    g.rect(x, 8, 1, 19, "grey");
  }
  for (let i = 0; i < 7; i++) {
    const x0 = 2 + 4 * i;
    const light = i < 4;
    const even = i % 2 === 0;
    const col = even ? (light ? "turquoise" : "dturq") : light ? "cream" : "tan";
    g.rect(x0, 1, 4, 6, col);
    g.rect(x0, 1, 4, 1, light ? (even ? "foam" : "white") : col);
    g.cel(x0 + 2, 7, 2, 1.6, col);
  }
  return rim(g, CART_RIM);
}

// ---------- keg-dolly-worker: facing the player, pushing a steel keg on a hand truck ----------

// A keg-dolly-worker pose: the walk's legs and bob, the dolly's tip and tilt, the tread's phase and
// the screen-right hand's lift off the lid (null for on the handle).
export interface KegPose {
  bob?: number;
  lf?: number;
  rf?: number;
  roll?: number;
  steady?: number | null;
  tilt?: number;
  tip?: number;
}

// Pushing: the dolly rocked back onto its wheels, its nose plate tip rows off the road and its top
// tilt rows further back toward the worker, the kegs riding steady while he walks behind with
// PERSON_WALK's stride and bob, the tires' tread rolling 1 drawn pixel down a frame (roll). 4 frames
// at 160ms, as the gardener's push.
const KEG_TIP = 3.5;

const KEG_TILT = 1;

export const KEG_PUSH: readonly KegPose[] = PERSON_WALK.map((q, n) => ({
  bob: q.bob ?? 0,
  lf: q.lf ?? 0,
  rf: q.rf ?? 0,
  roll: n,
  tilt: KEG_TILT,
  tip: KEG_TIP,
}));

export const KEG_PUSH_MS = 160;

// Stopped: the dolly stood upright on its nose plate, the screen-right hand flat on the keg's lid
// steadying the load, breathing: BREATH, the hand staying on the lid. 2 frames at BREATH_MS.
export const KEG_IDLE: readonly KegPose[] = BREATH.map((b) => ({ bob: b, steady: 0 }));

// Restarting: both hands on the handles, braced low, then rocking the dolly back onto its wheels,
// halfway and over, then braced to push. 4 frames at 200ms, as the gardener's cue.
export const KEG_CUE: readonly KegPose[] = [
  { bob: 1 },
  { bob: 1, tip: KEG_TIP / 2 },
  { tilt: KEG_TILT, tip: KEG_TIP },
  { bob: -1, tilt: KEG_TILT, tip: KEG_TIP },
];

export const KEG_CUE_MS = 200;

const KEG_RIM: Rims = { ...LIT, green: ["green", null] };

// The load's columns and vertical half-spans, the rails just outside them, and the wheels' centres
// and radii: small, tucked in behind the rails' feet beside the bottom keg, as on a real hand truck.
const KEG_X0 = 9.5;

const KEG_X1 = 22.5;

const KEG_H = 6.5;

// Clearance between the vertical spans, included in the continuous keg body.
const KEG_GAP = 1.5;

const DOLLY_RAILS: readonly [number, number] = [7.5, 22.5];

const RAIL_W = 2;

const DOLLY_WHEELS: readonly [number, number] = [7, 25];

const WHEEL_RX = 2.2;

const WHEEL_RY = 4;

// One tall cylindrical steel keg, with a curved lid and two separated rolling hoops. Its envelope
// follows the existing load and leaves the dolly and worker registration unchanged.
function keg(g: Drawable, y0: number, height: number): void {
  const x0 = KEG_X0;
  const x1 = KEG_X1;
  const w = KEG_X1 - KEG_X0;
  g.rect(x0 + 1, y0, w - 2, height, "grey");
  g.rect(x0, y0 + 2, w, height - 4, "grey");
  g.rect(x0 + 2, y0 + 1, w - 4, height - 2, "lgrey");
  g.rect(x1 - 2.5, y0 + 2, 2.5, height - 4, "slate");
  g.rect(x0 + 2.5, y0 + 2, 1, height - 4, "white");
  g.cel(16, y0, w / 2 - 0.5, 1.5, "lgrey", "slate", "white");
  g.cel(16, y0, w / 2 - 2, 0.7, "grey");
  g.rect(15, y0 - 0.5, 2, 1, "slate");
  for (const hoopY of [y0 + height * 0.23, y0 + height * 0.77]) {
    g.rect(x0, hoopY, w, 1, "lgrey");
    g.rect(x0 + 0.5, hoopY, w - 1, 0.5, "white");
    g.rect(x0 + 0.5, hoopY + 1, w - 1, 0.5, "slate");
  }
  g.cel(16, y0 + height - 1, w / 2 - 0.5, 1, "grey", "slate", "lgrey");
}

// A brewery worker facing the player, pushing a tall steel keg on a hand truck in front of him: a
// navy toque, a short brown beard, a white tee and a green apron to the knee, navy trousers and black
// boots; the hand truck's navy rails up both sides of the keg from its nose plate to handles that
// rise clear of the lid and angle out, his hands on them, and a small black tire behind each rail's
// foot. tip lifts the nose plate and the keg that many rows as he rocks the dolly back onto its
// wheels, and tilt lifts the lid and the handles that many rows more, the keg's top tipped back
// toward him; roll moves the tires' tread down a pixel; steady puts his screen-right hand on the
// keg's lid, lifted that many rows off it.
export function kegDollyWorker({
  bob = 0,
  lf = 0,
  rf = 0,
  roll = 0,
  steady = null,
  tilt = 0,
  tip = 0,
}: KegPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const plate = 43.5 - tip;
  const low = plate - KEG_H;
  const high = low - KEG_GAP - KEG_H - tilt;
  const handle = high - 4;
  // the legs under the tipped dolly: navy trousers and black boots
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 34 + b, 4, 9.5 + f - b, "navy");
    g.rect(x + 3, 34 + b, 1, 9.5 + f - b, "ink");
    g.rect(x, 43.5 + f, 4, 1.5, "ink");
  }
  // the green apron's skirt to the knee, its hem showing under the tipped dolly's plate
  g.rect(11, 34 + b, 10, 8 - b, "green");
  // the body over the load: the white tee, the green apron's bib on its straps between the handles
  g.rect(9.5, 19.5 + b, 13, high - 19.5 - b, "white");
  g.rect(11.5, 21.5 + b, 9, high - 21.5 - b, "green");
  for (const x of [11.5, 18.5]) {
    g.rect(x, 19.5 + b, 2, 2, "green");
  }
  // the wheels, edge-on behind the rails' feet, their tread rolling down the outer half that shows
  for (const [cx, side] of [
    [DOLLY_WHEELS[0], -1.5],
    [DOLLY_WHEELS[1], 0.5],
  ] as const) {
    g.ell(cx, 45 - WHEEL_RY, WHEEL_RX, WHEEL_RY, "ink");
    treadRows(g, cx + side, 45 - 2 * WHEEL_RY + 1, 45, roll, K.slate!);
  }
  // One clear steel cylinder fills the load envelope above the nose plate.
  keg(g, high, plate - high);
  g.rect(DOLLY_RAILS[0], plate, DOLLY_RAILS[1] + RAIL_W - DOLLY_RAILS[0], 1.5, "lgrey");
  // the rails beside the keg, then the handles angling out above its lid
  for (const [x, out] of [
    [DOLLY_RAILS[0], -2.5],
    [DOLLY_RAILS[1], 2.5],
  ] as const) {
    g.rect(x, high, RAIL_W, plate - high, "navy");
    limb(g, x + RAIL_W / 2, high + 0.5, x + RAIL_W / 2 + out, handle, RAIL_W, [[1, "navy"]]);
  }
  // the arms: white sleeves from the shoulders down and out to the hands on the handles (or one on
  // the lid)
  const lx = DOLLY_RAILS[0] + RAIL_W / 2 - 2.5;
  const rx = DOLLY_RAILS[1] + RAIL_W / 2 + 2.5;
  limb(g, 9.5, 20.5 + b, lx + 0.5, handle - 1, 2.5, [
    [0.5, "white"],
    [1, "skin1"],
  ]);
  g.rect(lx - 1.25, handle - 1.5, 2.5, 2.5, "skin1");
  if (steady === null) {
    limb(g, 22.5, 20.5 + b, rx - 0.5, handle - 1, 2.5, [
      [0.5, "white"],
      [1, "skin1"],
    ]);
    g.rect(rx - 1.25, handle - 1.5, 2.5, 2.5, "skin1");
    g.rect(rx + 0.5, handle - 1.5, 0.75, 2.5, "skin2");
  } else {
    const hy = high - 3 - steady;
    limb(g, 22.5, 20.5 + b, 21, hy, 2.5, [
      [0.4, "white"],
      [1, "skin1"],
    ]);
    g.rect(18, hy, 4.5, 2, "skin1");
    g.rect(21.5, hy, 1, 2, "skin2");
  }
  // head: the face under a navy toque with a turned-up cuff, a short brown beard round the jaw
  faceDisc(g, 16, 12.5 + b, 7, 7, "skin1", "skin2");
  g.cel(16, 18.3 + b, 5.5, 2.2, "brown");
  g.rect(9, 10 + b, 1.5, 4, "brown");
  g.rect(21.5, 10 + b, 1.5, 4, "brown");
  g.cel(16, 7 + b, 6.5, 4.5, "navy", null, "slate");
  g.rect(9, 7.5 + b, 14, 2.5, "navy");
  g.rect(9, 7.5 + b, 14, 1, "slate");
  roadScope.faceFront(g, 16, 12.5 + b, { lips: "ink", mouth: 4 });
  return rim(g, KEG_RIM);
}
