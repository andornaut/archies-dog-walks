// Draw the minor obstacles: things the pack bumps into with no card. Each spans whole lanes of the
// 64px road lanes: an n-lane obstacle is 64n-16 px wide, leaving an 8px margin in its outer lanes.
//
// They are billboards seen from a low camera, as roadside objects in OutRun are: a front elevation
// (or a car from straight behind), squat, with at most a sliver of top surface and never its length
// along the road. The game scales each one by distance with its base on the road line.
//
// trash-can       48x48   1 lane, the lid's handle rattles up 1px
// bench           112x36  2 lanes, backrest and seat edge on short legs; a leaf on the seat stirs
// hedge           176x42  3 lanes, a hedge with a rounded, clumped top, its clumps larger and
//                         alternately 2px higher; leaves rustle 1px at three spots in turn
// parked-car      56x42   1 lane by 3 rows of footprint, a minivan from straight behind, drawn at the
//                         footprint's near edge; hazards blink. 56 wide, so it centres on its lane
//                         with 4px to spare each side. pull-out (4 frames, 100ms): drawn pulling right
//                         (the game mirrors it for left), tread lines climb the tires and the right
//                         indicator blinks amber; drive (4 frames, 100ms): driving down its lane, the
//                         same tread roll with no indicator
// delivery-truck  56x54   1 lane by 3 rows of footprint, a brown box van from straight behind with a
//                         tan roller door, drawn at the footprint's near edge; idle (4 frames, 400ms):
//                         an exhaust puff on frame 2 that drifts up and thins on frame 3. drive (4
//                         frames, 100ms): tread lines climb the tires and the body dips 1px onto them
//                         on frames 1 and 2
// hot-dog-cart    112x66  2 lanes, a stainless street meat cart side on under a striped umbrella;
//                         idle (2 frames, 500ms): wavy steam wisps rising off the steam table
// flower-cart     112x66  2 lanes, a violet flower cart under a lilac and white umbrella, buckets of
//                         cut flowers on its counter and three tulips on its side; idle (2 frames,
//                         500ms): the middle tulip nods 1px
// fruit-cart      112x66  2 lanes, a green fruit and vegetable cart under a moss and cream umbrella,
//                         two tilted bins heaped with produce on its counter and an apple on its side;
//                         idle (2 frames, 500ms): the apple on top of the left heap rocks 1px
// ice-cream-cart  112x66  2 lanes, a turquoise beach ice cream cart under a turquoise and white
//                         umbrella, a cone for its finial, scoop tubs on its counter and a double cone
//                         on its side; idle (2 frames, 500ms): a pistachio drip runs down the side cone
// newspaper-cart  112x66  2 lanes, an azure newspaper and magazine cart under a flat cobalt roof
//                         lettered NEWS with a front page standing on it, stacks of folded papers and
//                         magazines on its counter and a row of magazine covers on its side; idle (2
//                         frames, 500ms): the top paper's corner lifts 1px
// streetcar       56x66   1 lane by 3 rows of footprint, a red TTC Flexity from behind, its pantograph
//                         on the roof, drawn at the footprint's near edge; idle (4 frames, 400ms): a
//                         spark at the pan head on frame 2. drive (4 frames, 100ms): tread lines climb
//                         the wheels and the body sways 1px over the bogie
// taxi            56x42   1 lane by 2 rows of footprint, Yonge Street's mover: a gold Toronto cab from
//                         straight behind, drawn at CAR_SCALE as the parked car, a white TAXI roof
//                         light lettered in dred, black mirrors, rocker band and bumper. drive (4
//                         frames, 100ms): the parked car's tread roll. cue (6 frames, 100ms, 600ms in
//                         all, played once): the roll with the right indicator and its mirror repeater
//                         lit on frames 0, 1, 4 and 5. merge (4 frames, 100ms): angled right, changing
//                         lanes, the right flank showing, the indicator lit on frames 2 and 3. The
//                         game mirrors cue and merge for a merge left. No idle: it falls back to drive
//
// The five carts are skins of one street cart: one chassis (cartWheels, cartUmbrella, cartPole,
// cartBox), one frame and one silhouette, each skin in its own colour family.
//
// Every obstacle but the taxi, which only drives, has a looping idle, so nothing on the road is
// frozen. Each idle frame is one argument to the drawing function, listed in the *_IDLE pairs; frame
// 0 is the rest pose. The drawings are in layout pixels, 40 for a 1-lane sprite and 30 rows for a
// lane-spanning one, drawn SCALE (1.2) times bigger on a mini.ts Mini, which keeps 1px lines 1px; the
// parked car, the delivery truck, the streetcar and the taxi keep their 56 layout columns and draw
// only their rows SCALE times taller. minis.ts and depths.ts run them at SCALE (or CAR_SCALE) times
// each depth step for the depth variants.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { type Scale, small } from "./mini.ts";
import {
  type Colour,
  type Drawable,
  type DrawingScope,
  type Edge,
  edged,
  Grid,
  K,
  main,
  raster,
  roadEdge,
  rowScaleOf,
  scaleOf,
  type Sprite,
  type Tag,
} from "./pixel.ts";
import { lit, scope as roadScope, treads, unit } from "./road.ts";

const USAGE = `Usage:
  node art/tools/obstacles.ts preview OUT.png   every obstacle on the zone roads
  node art/tools/obstacles.ts build             write art/obstacles/*.aseprite and export to
                                                public/art/sprites/`;

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    out.push(i);
  }
  return out;
}

// The drawings are in layout pixels: a 1-lane sprite's frame is SIZE square and a lane-spanning
// obstacle ROW tall. sprites() draws them SCALE times bigger on a Mini, which keeps 1px lines 1px, so
// a 1-lane sprite exports at 48x48 and a lane-spanning one 36 rows tall. The parked car, the delivery
// truck and the streetcar keep their 56 layout columns, a lane less 4px each side, and draw only their
// rows SCALE times taller (CAR_SCALE).
export const SIZE = 40;
export const ROW = 30;
export const SCALE = 1.2;
export const CAR_SCALE: readonly [number, number] = [1, SCALE];

// The width in layout pixels of an obstacle across lanes lanes of 64px: 64n-16 drawn, 8px clear of
// each outer lane edge.
export function span(lanes: number): number {
  return (64 * lanes - 16) / SCALE;
}

export const DOUBLE_LANE_SPAN = span(2);
export const TRIPLE_LANE_SPAN = span(3);

// draw(...args) on a Mini at scale s, or [sx, sy] for its columns and rows.
export function drawn<A extends unknown[], R>(s: Scale, draw: (...args: A) => R, ...args: A): R {
  return small(roadScope, scope, s, draw, ...args);
}

// The pixel edge of a full-size coordinate on the grid holding g's pixels.
export function pixelEdge(g: Drawable): (v: number) => number {
  const s = scaleOf(g);
  return (v) => Math.floor(v * s + 0.5);
}

// lift raises the lid's handle by that many drawn pixels (negative is up), the lid held still. The
// forest body takes a green rim on its top-left edges, the ink wheels and handle a grey one. Its lit
// half has two green ribs, one below TEXTURE_MIN.
export function trashCan(lift = 0): Drawable {
  const g = edged(scope.Grid(SIZE, SIZE));
  g.rect(12, 33, 4, 4, "ink");
  g.rect(24, 33, 4, 4, "ink");
  // the body tapers to its foot; its right half is in shade
  g.tri([10, 13], [30, 13], [27.5, 34], "dgreen");
  g.tri([10, 13], [12.5, 34], [27.5, 34], "dgreen");
  g.tri([20, 13], [30, 13], [27.5, 34], "forest");
  g.tri([20, 13], [20, 34], [27.5, 34], "forest");
  for (const x of scaleOf(g) >= TEXTURE_MIN ? [13, 16] : [15]) {
    g.rect(x, 16, 1, 14, "green");
  }
  g.rect(9, 8, 22, 6, "dgreen");
  g.rect(9, 8, 22, 1, "green");
  g.rect(20, 9, 11, 5, "forest");
  // the handle in drawn pixels, so the lift moves it whole at any scale
  const [x0, y0, x1, y1] = [16, 5, 24, 8].map((v) => Math.floor(v * scaleOf(g) + 0.5)) as [
    number,
    number,
    number,
    number,
  ];
  raster(g).rect(x0, y0 + lift, x1 - x0, y1 - y0, "ink");
  return lit(g);
}

// From behind, low: the backrest (two slats) and the seat's front edge as bands on short legs. leaf
// offsets the fallen leaf on the seat edge; null leaves it off. Each slat is a 2-row tan top over a
// 3-row brown face, with a 2-row plum gap between them.
export function bench(
  leaf: readonly [number, number] | null = [0, 0],
  w = DOUBLE_LANE_SPAN,
): Drawable {
  const g = edged(scope.Grid(w, ROW));
  // legs, behind everything: short, slate lit on the left
  for (const x of [12, w - 17]) {
    g.rect(x, 2, 5, 27, "dslate");
    g.rect(x, 2, 2, 27, "slate");
  }
  // backrest: two slats with a plum gap, the uprights showing through it
  g.rect(4, 7, w - 8, 2, "plum");
  for (const y of [2, 9]) {
    g.rect(4, y, w - 8, 2, "tan");
    g.rect(4, y + 2, w - 8, 3, "brown");
  }
  for (const x of [
    Math.round((w * 20) / 88),
    Math.floor(w / 2) - 1,
    Math.round((w * 68) / 88) - 2,
  ]) {
    g.rect(x, 4, 2, 7, "dbrown");
  }
  // the seat's edge, wider than the backrest, with a plum shadow line over it
  g.rect(2, 14, w - 4, 2, "plum");
  g.rect(2, 16, w - 4, 3, "tan");
  g.rect(2, 19, w - 4, 3, "brown");
  if (leaf) {
    const [ux, uy] = unit(g);
    const x = Math.round(w * 0.64) + leaf[0] * ux;
    const y = 15 + leaf[1] * uy;
    g.rect(x, y, 4, 1, "amber");
    g.rect(x + 1, y + 1, 4, 1, "orange");
    g.p(x + 5, y + 1, "rust");
  }
  return g;
}

// The smallest scale the hedge's leaf texture and the trash can's two ribs are drawn at: under it (the
// @50 step) a 1px detail lands on single pixels or merges with its neighbour.
export const TEXTURE_MIN = 0.7;

// The hedge's layout height, 5 rows over a lane spanner's ROW: drawn at SCALE it is 42 rows, and every
// depth step a whole number of rows.
export const HEDGE_ROWS = 35;

// Wide, seen side on: a rounded top edge of leaf clumps about 13px apart, alternately 2px higher, no
// top surface, lit green on their top-left edges; the rounded ends as tall as the body; a teal band at
// its foot. rustle lists the top clumps, by index, that lift 1px and shift 1px right, drawn pixels at
// any scale. Below TEXTURE_MIN the lower leaf texture is left off: its clumps shrink to single pixels
// there and read as noise.
export function hedge({
  rustle = [],
  w = TRIPLE_LANE_SPAN,
}: { rustle?: readonly number[]; w?: number } = {}): Drawable {
  const g = edged(scope.Grid(w, HEDGE_ROWS));
  const u = unit(g)[0];
  g.rect(4, 12, w - 8, 22, "forest");
  g.rect(1, 15, w - 2, 14, "forest");
  g.rect(4, 30, w - 8, 4, "teal");
  // the rounded top: clumps spaced evenly from 10px in at each end, so both ends round off the same
  const n = Math.round((w - 20) / 13) + 1;
  for (let i = 0; i < n; i++) {
    const x = 10 + (i * (w - 20)) / (n - 1);
    const r = rustle.includes(i) ? u : 0;
    const y = 10 - 2 * (i % 2) - r;
    g.ell(x + r, y + 1, 7, 6.5, "dgreen", "forest", "green");
  }
  // the rounded ends
  for (const x of [6, w - 6]) {
    g.ell(x, 21, 5, 12, "forest");
  }
  // leaf texture lower down: dgreen clumps, spaced irregularly
  const texture = scaleOf(g) >= TEXTURE_MIN ? range(8, Math.trunc(w) - 8, 11) : [];
  texture.forEach((x, i) => {
    g.ell(x + 2, 20 + ((i * 5) % 6), 3, 2.5, "dgreen");
  });
  return lit(g);
}

// roadEdge, but white takes a plum keyline (6.5:1 or more on the light roads) for roadEdge's dslate.
export function whiteKeyline(c: string): string {
  return c === K.white ? K.plum! : roadEdge(c);
}

// A minivan from straight behind, wide and low: the roof edge, the rear window, the tailgate with its
// tail lights and plate, the bumper and both rear wheels under it, mirrors poking out at the sides.
// Its hazard lights, the outer end of each tail light, are lit when hazard is true. Cyan lights the
// top and left edges, so the sky body holds on the dslate road. roll (0 to 3) is a pull-out or drive
// frame: tread lines climb the tires 1px a frame (treads), and, when blink is true (pull-out), the
// right indicator is lit on frames 0 and 1.
export function parkedCar(
  hazard = false,
  { blink = true, roll = null }: { blink?: boolean; roll?: number | null } = {},
): Drawable {
  const g = edged(scope.Grid(56, 35));
  // rear wheels, under the body at either side
  for (const x of [5, 42]) {
    g.rect(x, 25, 9, 9, "ink");
    g.rect(x, 25, 2, 8, "dslate");
  }
  // roof edge and rear window, narrower than the body
  g.rect(10, 1, 36, 3, "sky");
  g.rect(10, 1, 36, 1, "cyan");
  g.tri([8, 14], [10, 4], [10, 14], "sky");
  g.tri([48, 14], [46, 4], [46, 14], "blue");
  g.rect(10, 4, 36, 10, "navy");
  g.tri([14, 13], [20, 5], [25, 5], "slate");
  g.p(8, 13, "cyan");
  g.p(9, 4, "cyan");
  // mirrors at the window's base
  g.rect(3, 11, 5, 3, "blue");
  g.rect(3, 11, 5, 1, "sky");
  g.rect(48, 11, 5, 3, "blue");
  // tailgate: lit along the top and the left, shaded on the right
  g.rect(4, 14, 48, 11, "sky");
  g.rect(4, 14, 48, 1, "cyan");
  g.rect(4, 14, 1, 11, "cyan");
  g.rect(48, 15, 4, 10, "blue");
  for (const x of [5, 42]) {
    g.rect(x, 16, 9, 5, "red");
    g.rect(x, 16, 9, 1, "pink");
    g.rect(x, 20, 9, 1, "dred");
  }
  if (hazard) {
    for (const x of [5, 48]) {
      g.rect(x, 16, 3, 4, "amber");
      g.rect(x, 16, 3, 1, "yellow");
    }
  }
  g.rect(22, 18, 12, 5, "lgrey");
  g.rect(24, 20, 8, 1, "grey");
  g.rect(25, 15, 6, 1, "lgrey");
  // bumper across the full width
  g.rect(3, 25, 50, 4, "dslate");
  g.rect(3, 25, 50, 1, "slate");
  g.rect(3, 25, 1, 4, "grey");
  if (roll !== null) {
    for (const x of [5, 42]) {
      treads(g, x + 2, 29, 7, 5, roll, unit(g)[1]);
    }
    if (blink && roll < 2) {
      g.rect(48, 16, 3, 4, "amber");
      g.rect(48, 16, 3, 1, "yellow");
    }
  }
  return g;
}

// Idle frames, one drawing argument each, and their duration in ms. Most hold the rest pose for two
// frames so the motion comes as a short event rather than a constant flicker.
export const TRASH_CAN_IDLE: readonly [readonly number[], number] = [[0, 0, -1, 0], 400];
export const BENCH_IDLE: readonly [readonly (readonly [number, number])[], number] = [
  [
    [0, 0],
    [0, 0],
    [1, -1],
    [0, 0],
  ],
  450,
];
export const HEDGE_IDLE: readonly [readonly (readonly number[])[], number] = [
  [[], [5], [10], [1]],
  350,
];
export const PARKED_CAR_IDLE: readonly [readonly boolean[], number] = [[false, true], 500];
// The pull-out: 4 frames of parkedCar's roll, and their duration in ms.
export const PULL_OUT: readonly [readonly number[], number] = [[0, 1, 2, 3], 100];
// The drive: 4 frames of parkedCar's, deliveryTruck's, streetcar's or taxi's roll with no indicator,
// and their duration in ms.
export const DRIVE: readonly [readonly number[], number] = [[0, 1, 2, 3], 100];
// The delivery truck's idle: an exhaust puff on frame 2, drifting up and thinning on frame 3.
export const DELIVERY_IDLE: readonly [readonly number[], number] = [[0, 0, 1, 2], 400];

// The smallest column scale the delivery truck's label keeps its three lines at: under it (@62 and
// @50) they land on adjacent rows and run together.
export const LABEL_MIN = 0.7;

// A box van from straight behind, a lane wide and taller than the parked car: a brown box lit tan
// along its top and left edges with mirrors at its sides and amber marker lights on the roof, a tan
// roller door ribbed in brown with a white shipping label on it, red tail lights low at the outer
// corners, the bumper step and both rear wheels. puff 1 blows a grey exhaust puff out beside the
// right wheel and puff 2 lets it drift up and thin to two wisps. roll (0 to 3) is a drive frame:
// tread lines climb the tires 1px a frame (treads) and the body dips 1px onto them on frames 1 and 2.
// Laid out on 56x45 and drawn at CAR_SCALE, as the parked car.
export function deliveryTruck(puff = 0, { roll = null }: { roll?: number | null } = {}): Drawable {
  const g = edged(scope.Grid(56, 45));
  const px = raster(g);
  const uy = unit(g)[1];
  // wheels first, so the body can dip over them
  for (const x of [5, 42]) {
    g.rect(x, 34, 9, 10, "ink");
    g.rect(x, 34, 2, 9, "dslate");
    if (roll !== null) {
      treads(g, x + 2, 37, 7, 7, roll, uy);
    }
  }
  if (puff === 1) {
    g.ell(52, 40, 2.5, 2, "lgrey", "grey");
    g.p(54, 37, "lgrey");
  } else if (puff === 2) {
    g.ell(51.5, 35.5, 1.8, 1.5, "lgrey");
    g.p(53, 32.5, "lgrey");
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = Array.from({ length: px.h }, () => Array<Colour>(px.w).fill(null));
  // the box: lit along the top and the left, shaded down the right; mirrors poke out at its sides
  g.rect(4, 1, 48, 32, "brown");
  g.rect(4, 1, 48, 1, "tan");
  g.rect(4, 1, 1, 32, "tan");
  g.rect(48, 2, 4, 31, "dbrown");
  for (const x of [1, 52]) {
    g.rect(x, 7, 3, 5, "dslate");
    g.rect(x, 7, 3, 1, "slate");
  }
  // amber marker lights along the roof
  for (const x of [18, 27, 36]) {
    g.rect(x, 2, 3, 1, "amber");
  }
  // the roller door, its slats, its handle and a parcel label taped across
  g.rect(10, 5, 36, 26, "tan");
  for (const y of range(8, 31, 3)) {
    g.rect(10, y, 36, 1, "brown");
  }
  g.rect(43, 5, 3, 26, "brown");
  g.rect(25, 27, 6, 2, "grey");
  g.rect(25, 27, 6, 1, "lgrey");
  g.rect(21, 11, 13, 9, "white");
  g.rect(21, 19, 13, 1, "lgrey");
  if (scaleOf(g) >= LABEL_MIN) {
    g.rect(23, 13, 6, 1, "slate");
    g.rect(23, 15, 9, 1, "slate");
    g.rect(23, 17, 4, 1, "red");
  } else {
    // smaller, the three lines would run together: one address line and the red tag, a row apart
    g.rect(23, 13, 9, 1, "slate");
    g.rect(23, 16, 4, 1, "red");
  }
  // tail lights low at the outer corners
  for (const x of [5, 47]) {
    g.rect(x, 21, 4, 8, "red");
    g.rect(x, 21, 4, 1, "pink");
    g.rect(x, 28, 4, 1, "dred");
  }
  // the bumper step across the full width
  g.rect(1, 32, 54, 3, "dslate");
  g.rect(1, 32, 54, 1, "slate");
  g.rect(1, 32, 1, 3, "grey");
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => (y >= dip ? body[y - dip]![x]! : null) || wheels[y]![x]!),
  );
  return lit(g);
}

// 5-row letters for the streetcar's route sign and wordmark and the taxi's roof light, one string per
// row, 1 for a lit pixel: 3 columns wide, the I 1.
export const LETTERS: Readonly<Record<string, readonly string[]>> = {
  "0": ["111", "101", "101", "101", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  A: ["010", "101", "111", "101", "101"],
  C: ["111", "100", "100", "100", "111"],
  E: ["111", "100", "110", "100", "111"],
  I: ["1", "1", "1", "1", "1"],
  N: ["1001", "1101", "1011", "1001", "1001"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  W: ["10001", "10001", "10101", "10101", "01010"],
  X: ["101", "101", "010", "101", "101"],
};
// The streetcar's idle: a spark at the pantograph on frame 2.
export const STREETCAR_IDLE: readonly [readonly boolean[], number] = [
  [false, false, true, false],
  400,
];
// Its drive's sideways sway, in drawn pixels per frame, as the bogies roll under it.
export const STREETCAR_SWAY: readonly number[] = [0, 1, 0, -1];

// What the obstacles draw through (see pixel.ts's DrawingScope): their grid, and the letters
// lettering spells with, which hood_city.ts swaps for a set with its route's digits.
export interface ObstaclesScope extends DrawingScope {
  LETTERS: Readonly<Record<string, readonly string[]>>;
}

// text in LETTERS centred on layout column cx with its top on layout row y, drawn pixel for pixel on
// the grid holding g's pixels, 1px apart. Where the grid is too small for it to sit inside the
// layout's 5 rows and its letters' columns, bar draws a 1px line of that colour across its middle
// instead, or nothing.
export function lettering(
  g: Drawable,
  cx: number,
  y: number,
  text: string,
  c: string,
  bar: string | null = null,
): void {
  const letters = scope.LETTERS;
  const px = raster(g);
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const w = [...text].reduce((sum, ch) => sum + letters[ch]![0]!.length + 1, 0) - 1;
  if (s < 0.85 || sy * 5 < 5) {
    if (bar) {
      px.rect(
        Math.floor((cx - w / 2) * s + 0.5),
        Math.floor((y + 2.5) * sy),
        Math.max(1, Math.round(w * s)),
        1,
        bar,
      );
    }
    return;
  }
  let x0 = Math.floor(cx * s + 0.5) - Math.floor(w / 2);
  const y0 = Math.floor((y + 2.5) * sy + 0.5) - 2;
  for (const ch of text) {
    letters[ch]!.forEach((row, j) => {
      [...row].forEach((on, k) => {
        if (on === "1") {
          px.p(x0 + k, y0 + j, c);
        }
      });
    });
    x0 += letters[ch]![0]!.length + 1;
  }
}

// A red TTC Flexity streetcar from straight behind, a lane wide, laid out on 56x55 and drawn at
// CAR_SCALE to 56x66: a pantograph on the roof, its pan head under the wire, over a red body with a
// rounded roof; the route sign "504" in amber on black at the top; the black window band across the
// back, a big rear window with a glint; a white stripe under it, "TTC" in white on the red, tail
// lights and amber blinkers low at the outer corners in black housings, the anticlimber bumper, and
// the rear bogie's two wheels under the skirt. spark lights a cyan spark at the pan head. roll (0 to
// 3) is a drive frame: tread lines climb the wheels 1px a frame as it rolls away, and the body and
// pantograph sway STREETCAR_SWAY over the bogie.
export function streetcar(spark = false, { roll = null }: { roll?: number | null } = {}): Drawable {
  const g = edged(scope.Grid(56, 55));
  const px = raster(g);
  const uy = unit(g)[1];
  // the bogie and its wheels first, so the body can sway over them
  g.rect(14, 48, 28, 3, "dslate");
  g.rect(14, 48, 28, 1, "slate");
  for (const x of [8, 41]) {
    g.rect(x, 47, 7, 8, "ink");
    g.rect(x, 47, 2, 7, "dslate");
    if (roll !== null) {
      treads(g, x + 2, 48, 5, 6, roll, uy);
    }
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = Array.from({ length: px.h }, () => Array<Colour>(px.w).fill(null));
  // the pantograph: a diamond of grey arms on an insulated base, the lgrey pan head with its horns on
  // top
  g.rect(21, 8, 14, 2, "dslate");
  g.rect(21, 8, 14, 1, "slate");
  for (const [[x0, y0], [x1, y1]] of [
    [
      [23, 7],
      [19, 5],
    ],
    [
      [19, 5],
      [24, 3],
    ],
    [
      [32, 7],
      [36, 5],
    ],
    [
      [36, 5],
      [31, 3],
    ],
  ] as const) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      g.rect(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 1, 1, "grey");
    }
  }
  g.rect(21, 2, 14, 1, "lgrey");
  g.p(20, 3, "grey");
  g.p(35, 3, "grey");
  if (spark) {
    g.rect(26, 0, 3, 2, "cyan");
    g.p(27, 1, "white");
    g.p(25, 1, "cyan");
    g.p(29, 0, "cyan");
  }
  // the body: a rounded roof over a box, lit along the top and the left, shaded down the right
  g.cel(28, 20, 26, 11, "red", "dred", "pink", 3);
  g.rect(2, 20, 52, 27, "red");
  g.rect(50, 20, 4, 27, "dred");
  // the route sign
  g.rect(20, 12, 16, 6, "ink");
  lettering(g, 28, 12.5, "504", "amber", "amber");
  // the black band and the rear window in it, with a glint across the glass
  g.rect(2, 19, 52, 13, "ink");
  g.rect(7, 20, 42, 11, "navy");
  g.rect(7, 20, 42, 1, "dslate");
  g.tri([12, 31], [20, 20.5], [25, 20.5], "dslate");
  g.tri([19, 31], [27, 20.5], [29, 20.5], "dslate");
  // the white stripe, the wordmark, the lamps in their housings
  g.rect(2, 32, 52, 1, "white");
  lettering(g, 28, 36, "TTC", "white");
  for (const x of [4, 46]) {
    g.rect(x, 35, 6, 9, "ink");
    g.rect(x + 1, 36, 4, 3, "red");
    g.rect(x + 1, 36, 4, 1, "pink");
    g.rect(x + 1, 40, 4, 2, "amber");
    g.p(x + 1, 40, "yellow");
  }
  // the anticlimber bumper and the skirt over the bogie
  g.rect(3, 44, 50, 3, "dslate");
  g.rect(3, 44, 50, 1, "slate");
  g.rect(3, 44, 1, 3, "grey");
  g.rect(24, 44, 8, 2, "grey");
  g.rect(24, 44, 8, 1, "lgrey");
  const sway = roll !== null ? STREETCAR_SWAY[roll]! : 0;
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map(
      (x) => (x - sway >= 0 && x - sway < px.w ? body[y]![x - sway]! : null) || wheels[y]![x]!,
    ),
  );
  return lit(g);
}

// The taxi's cue, [roll, signal] a frame: the drive's tread roll at its 100ms with the right
// indicator lit on frames 0, 1, 4 and 5, 600ms in all, the game's mover warning. Its merge carries
// the beat on, lit on frames 2 and 3, angled right.
export const TAXI_CUE: readonly [readonly (readonly [number, boolean])[], number] = [
  [
    [0, true],
    [1, true],
    [2, false],
    [3, false],
    [0, true],
    [1, true],
  ],
  100,
];
export const TAXI_MERGE: readonly [readonly (readonly [number, boolean])[], number] = [
  [
    [0, false],
    [1, false],
    [2, true],
    [3, true],
  ],
  100,
];

// A Toronto taxi from straight behind, a sedan a lane wide, laid out on 56x35 and drawn at CAR_SCALE
// to 56x42 as the parked car: a white TAXI roof light lettered in dred over a gold body lit yellow
// along its top and left edges and shaded amber down its right, the dark rear window between the
// pillars, the trunk lid's lip, tail light clusters in ink housings at the outer corners (red inside,
// the indicator outside), a white plate, a black rocker band and bumper and both rear tires, mirrors
// at the window's base. signal lights the right indicator amber and the repeater on the right mirror;
// unlit they are dbrown and dslate. roll (0 to 3) is a drive frame: tread lines climb the tires 1px a
// frame (treads). turn angles it right, changing lanes: the rear face narrows and slides left, the
// roof light and cabin lean 2px further right, and the right flank shows down the right edge in
// amber, its side window, its mirror and repeater, and the right rear tire side on.
export function taxi({
  roll = null,
  signal = false,
  turn = false,
}: { roll?: number | null; signal?: boolean; turn?: boolean } = {}): Drawable {
  const g = edged(scope.Grid(56, 35));
  const uy = unit(g)[1];
  // the rear face's columns, narrowed and slid left when turning; up leans the upper parts further
  // right
  const [k, x0, lean] = turn ? [0.875, 3, 2] : [1, 4, 0];
  const projectX = (x: number, up = 0): number => x0 + (x - 4) * k + (up ? lean : 0);
  const r = (x: number, y: number, w: number, h: number, c: string, up = 0): void => {
    g.rect(projectX(x, up), y, w * k, h, c);
  };
  // rear tires, under the body at either side
  for (const x of [6, 42]) {
    r(x, 26, 8, 8, "ink");
    r(x, 26, 2, 7, "dslate");
  }
  if (turn) {
    // the right flank: the beltline and rocker rising toward the front, the rear tire side on
    g.tri([projectX(52), 17], [54, 16], [54, 26], "amber");
    g.tri([projectX(52), 17], [projectX(52), 27], [54, 26], "amber");
    g.rect(projectX(52), 25, 54 - projectX(52), 2, "ink");
    g.cel(50, 29.5, 3.2, 4, "ink", null, "dslate");
    if (scaleOf(g) >= TEXTURE_MIN) {
      g.cel(50, 29.5, 1.3, 1.5, "grey", null, "lgrey");
    }
    // the cabin's side: the side window under the roof's edge
    g.rect(projectX(44, 1), 8, 52 - projectX(44, 1), 9, "amber");
    g.rect(projectX(44, 1), 8, 52 - projectX(44, 1), 1, "yellow");
    g.rect(projectX(45, 1), 10, 50 - projectX(45, 1), 6, "navy");
  }
  // roof and rear window, narrower than the body, between the pillars
  r(12, 8, 32, 2, "gold", 1);
  r(12, 8, 32, 1, "yellow", 1);
  g.tri([projectX(9), 17], [projectX(12, 1), 9], [projectX(12, 1), 17], "gold");
  g.tri([projectX(47), 17], [projectX(44, 1), 9], [projectX(44, 1), 17], "amber");
  g.rect(projectX(12, 1), 10, projectX(44, 1) - projectX(12, 1), 7, "navy");
  g.rect(projectX(12, 1), 10, projectX(44, 1) - projectX(12, 1), 1, "dslate");
  g.tri([projectX(16, 1), 16], [projectX(21, 1), 11], [projectX(26, 1), 11], "slate");
  g.p(projectX(9), 16, "yellow");
  // the roof light: a white box on a short base, lettered TAXI
  r(25, 7, 6, 1, "dslate", 1);
  r(19, 1, 18, 6, "white", 1);
  r(19, 6, 18, 1, "lgrey", 1);
  r(36, 2, 1, 4, "lgrey", 1);
  lettering(g, projectX(27, 1), 1, "TAXI", "dred", "dred");
  // black mirrors at the window's base; the right one carries the indicator's repeater
  r(3, 13, 5, 3, "ink");
  const [mx, my] = turn ? [50, 12] : [projectX(48), 13];
  g.rect(mx, my, 5, 3, "ink");
  g.rect(mx + 1, my + 1, 3, 2, signal ? "amber" : "dslate");
  if (signal) {
    g.rect(mx + 1, my + 1, 3, 1, "yellow");
  }
  // the trunk lid's lip and the rear face: lit along the top and the left, shaded on the right
  r(4, 17, 48, 10, "gold");
  r(4, 17, 48, 1, "yellow");
  r(4, 17, 1, 10, "yellow");
  r(48, 18, 4, 9, "amber");
  r(4, 19, 48, 1, "amber");
  // tail light clusters: red inside, the indicator outside, in ink housings
  for (const [x, tail] of [
    [5, 11],
    [39, 40],
  ] as const) {
    r(x, 20, 13, 6, "ink");
    r(tail, 21, 6, 4, "red");
    r(tail, 21, 6, 1, "pink");
  }
  r(6, 21, 5, 4, "dbrown");
  if (signal) {
    r(46, 21, 5, 4, "amber");
    r(47, 21, 3, 3, "yellow");
    r(48, 22, 1, 1, "white");
  } else {
    r(46, 21, 5, 4, "dbrown");
  }
  // the plate, white with a blue line, and the black rocker band and bumper
  r(22, 20, 12, 5, "white");
  r(22, 24, 12, 1, "lgrey");
  r(24, 22, 8, 1, "blue");
  if (turn) {
    // the tail light housing wraps round the corner onto the flank
    g.rect(projectX(52), 20, 1, 6, "ink");
  }
  r(4, 26, 48, 1, "ink");
  r(3, 27, 50, 2, "ink");
  r(3, 27, 50, 1, "dslate");
  // tread lines on the tires' 5 rows under the bumper, as the parked car's
  if (roll !== null) {
    for (const x of [6, 42]) {
      treads(g, projectX(x + 2), 29, 6 * k, 5, roll, uy);
    }
  }
  return lit(g);
}

// The hot dog cart's idle: steam off the steam table, rising a drawn pixel and swapping sides on
// frame 1.
export const HOT_DOG_CART_IDLE: readonly [readonly number[], number] = [[0, 1], 500];

// The hot dog cart's steam wisps: each drawn row's sideways offset, from the lid up.
export const STEAM_WAVE: readonly number[] = [0, 1, 1, 0, -1, -1];

// roadEdge, but the steam (haze, which nothing else on the cart uses) takes no outline.
export function cartEdge(c: string): string | null {
  return c === K.haze ? null : roadEdge(c);
}

// art-kit's outline writes whatever the rule returns, so a null leaves the pixel clear.
const CART_EDGE = cartEdge as Edge;

// A street cart's two wheels, behind its box: ink tires, grey hubs.
export function cartWheels(g: Drawable, w: number): void {
  for (const x of [19, w - 19]) {
    g.cel(x, 48, 6, 6.5, "ink", null, "dslate");
    g.cel(x, 48, 2, 2, "grey", null, "lgrey");
  }
}

// A cart umbrella's colours: [[lit, lit], [shade, shade]].
export type UmbrellaColours = readonly [
  lit: readonly [string, string],
  shade: readonly [string, string],
];

// A street cart's umbrella: six wedges from its tip at row top to row base, a scallop under each.
// cols is [[lit, lit], [shade, shade]]: the left three wedges take the lit pair in turn, the right
// three the shaded pair.
export function cartUmbrella(
  g: Drawable,
  w: number,
  cols: UmbrellaColours,
  top = 2,
  base = 15,
): void {
  const c = w / 2;
  const left = 8;
  const right = w - 8;
  const colour = (i: number): string => cols[i >= 3 ? 1 : 0][i % 2]!;
  for (let i = 0; i < 6; i++) {
    const x0 = left + ((right - left) * i) / 6;
    const x1 = left + ((right - left) * (i + 1)) / 6;
    g.tri([x0, base], [x1, base], [c, top], colour(i));
  }
  for (let i = 0; i < 6; i++) {
    const x0 = left + ((right - left) * i) / 6;
    g.cel(x0 + (right - left) / 12, base, (right - left) / 12, 2.5, colour(i));
  }
}

// A street cart's umbrella pole, from row top down to the counter.
export function cartPole(g: Drawable, w: number, top: number): void {
  const c = w / 2;
  g.rect(c - 1, top, 2, 28 - top, "slate");
  g.rect(c - 1, top, 1, 28 - top, "grey");
}

// A street cart's counter lip, then its box: lit down its left in light, shaded down its right.
export function cartBox(
  g: Drawable,
  w: number,
  body: string,
  light: string,
  shade: string,
  lip: readonly [string, string] = ["white", "lgrey"],
): void {
  g.rect(6, 28, w - 12, 2, lip[0]);
  g.rect(6, 29, w - 12, 1, lip[1]);
  g.rect(9, 30, w - 18, 15, body);
  g.rect(9, 30, 1, 15, light);
  g.rect(w - 14, 30, 5, 15, shade);
}

// A Toronto street meat cart side on, two lanes wide, laid out on span(2) x 55 and drawn at SCALE to
// 112x66: a stainless box on two wheels under a red and yellow striped umbrella with a scalloped
// valance, lit on its left and shaded on its right; ketchup, mustard and relish bottles and a stack
// of buns on the counter at the left, the steam table's lids at the right with steam curling off
// them, and a hot dog with a mustard zigzag on the box's side. steam (0 or 1) shifts the wisps' wave
// half a period.
export function hotDogCart({
  steam = 0,
  w = DOUBLE_LANE_SPAN,
}: { steam?: number; w?: number } = {}): Drawable {
  const g = edged(scope.Grid(w, 55), CART_EDGE);
  const c = w / 2;
  cartWheels(g, w);
  // the umbrella: six wedges from the finial, red and yellow, the right three in shade
  cartUmbrella(g, w, [
    ["red", "yellow"],
    ["dred", "amber"],
  ]);
  g.rect(c - 1, 0, 2, 2, "grey");
  g.p(c - 1, 0, "lgrey");
  cartPole(g, w, 17);
  // on the counter, left: ketchup, mustard and relish bottles, their nozzles white, and a stack of
  // buns
  for (const [x, col, sh] of [
    [12, "red", "dred"],
    [17, "yellow", "amber"],
    [22, "green", "dgreen"],
  ] as const) {
    g.rect(x, 21, 4, 7, col);
    g.rect(x + 3, 21, 1, 7, sh);
    g.rect(x + 1, 19, 2, 2, "white");
    g.p(x + 1.5, 18, "white");
  }
  for (let k = 0; k < 3; k++) {
    g.cel(32, 26.5 - 2.2 * k, 4, 1.6, "tan", "ochre", "cream");
  }
  // on the counter, right: the steam table's two lids
  for (const x of [w - 33, w - 20]) {
    g.cel(x, 27, 6, 3.5, "lgrey", "grey", "white");
  }
  // the steam: a wavy 1px wisp rising off each lid, in haze with no outline, so it reads as vapour
  // and not as a knob on the lid; the two wisps wave in opposite phase and steam shifts the wave half
  // a period
  const px = raster(g);
  const edge = pixelEdge(g);
  [w - 33, w - 20].forEach((x, i) => {
    const x0 = edge(x);
    range(edge(22.5) - 1, edge(18.5) - 1, -1).forEach((y, k) => {
      px.p(x0 + STEAM_WAVE[(k + 3 * (steam + i)) % STEAM_WAVE.length]!, y, "haze");
    });
  });
  // the stainless box, lit along its top and left, shaded down its right, with two seams
  cartBox(g, w, "lgrey", "white", "grey");
  g.rect(9, 30, w - 18, 1, "grey");
  for (const x of [Math.round(w * 0.3), Math.round(w * 0.7)]) {
    g.rect(x, 31, 1, 13, "grey");
  }
  // the hot dog on the side: the bun's back, the sausage poking out of it under a mustard zigzag, the
  // bun's front
  g.cel(c, 37, 11, 3, "tan", "ochre", "cream");
  g.cel(c, 37.5, 14, 1.8, "red", "dred", "pink");
  range(Math.round(c - 9), Math.round(c + 9), 3).forEach((x, k) => {
    g.rect(x, 37 - (k % 2), 2, 1, "yellow");
  });
  g.cel(c, 40, 11.5, 1.8, "tan", "ochre");
  g.rect(9, 44, w - 18, 1, "slate");
  return lit(g);
}

// The ice cream cart's idle: a pistachio drip runs down the side sign's cone on frame 1.
export const ICE_CREAM_CART_IDLE: readonly [readonly number[], number] = [[0, 1], 500];

// A waffle cone point down from its rim on row y0, lit tan on its left half and shaded ochre on its
// right, crosshatched in 1px brown lines 3px apart down to TEXTURE_MIN.
export function waffle(g: Drawable, x0: number, x1: number, y0: number, tip: number): void {
  const cx = (x0 + x1) / 2;
  g.tri([x0, y0], [x1, y0], [cx, tip], "tan");
  g.tri([cx, y0], [x1, y0], [cx, tip], "ochre");
  if (scaleOf(g) < TEXTURE_MIN) {
    return;
  }
  const px = raster(g);
  const edge = pixelEdge(g);
  const cone = [K.tan, K.ochre];
  for (let y = edge(y0); y < edge(tip); y++) {
    for (let x = edge(x0); x < edge(x1) + 1; x++) {
      if (
        x >= 0 &&
        x < px.w &&
        cone.includes(px.px[y]![x]!) &&
        ((x + y) % 3 === 0 || (x - y) % 3 === 0)
      ) {
        px.p(x, y, "brown");
      }
    }
  }
}

// A beach ice cream cart side on, the hot dog cart's frame: laid out on span(2) x 55 and drawn at
// SCALE to 112x66, a turquoise box on two wheels under a turquoise and white umbrella, a strawberry
// cone for its finial, lit on its left and shaded on its right; four tubs heaped with strawberry,
// vanilla, pistachio and chocolate scoops along its cream counter, and on the box's side a cream
// panel with a pistachio and strawberry double cone. drip (0 or 1) runs a pistachio drip down the
// cone's lit side.
export function iceCreamCart({
  drip = 0,
  w = DOUBLE_LANE_SPAN,
}: { drip?: number; w?: number } = {}): Drawable {
  const g = edged(scope.Grid(w, 55), CART_EDGE);
  const c = w / 2;
  cartWheels(g, w);
  // the umbrella, 4 rows lower than the hot dog cart's under its cone finial
  cartUmbrella(
    g,
    w,
    [
      ["turquoise", "white"],
      ["dturq", "lgrey"],
    ],
    6,
    17,
  );
  g.tri([c - 2.2, 4], [c + 2.2, 4], [c, 9.7], "tan");
  g.tri([c, 4], [c + 2.2, 4], [c, 9.7], "ochre");
  g.cel(c, 2.7, 2.6, 2.1, "pink", "mauve", "white");
  g.rect(c - 2.6, 3.4, 5.2, 1, "mauve");
  cartPole(g, w, 19);
  // on the counter: four white tubs, each heaped with its scoop
  for (const [x, col, sh, li] of [
    [14, "pink", "mauve", "white"],
    [25, "cream", "tan", "white"],
    [w - 25, "lime", "green", "white"],
    [w - 14, "brown", "dbrown", "tan"],
  ] as const) {
    g.cel(x, 24, 4.2, 3, col, sh, li);
    g.rect(x - 4, 24.5, 8, 3.5, "white");
    g.rect(x + 3, 24.5, 1, 3.5, "lgrey");
  }
  cartBox(g, w, "turquoise", "foam", "dturq", ["cream", "tan"]);
  // the side sign: a cream panel, a waffle cone under a pistachio scoop and a strawberry one
  g.rect(c - 12, 30, 24, 14, "cream");
  g.rect(c + 10, 30, 2, 14, "tan");
  waffle(g, c - 4.5, c + 4.5, 38.5, 46);
  g.cel(c, 36.3, 5.2, 3, "lime", "green", "white");
  g.cel(c, 32.3, 4.4, 2.8, "pink", "mauve", "white");
  if (drip) {
    // 1 drawn pixel wide, so it stays a drip at every depth step
    const px = raster(g);
    const edge = pixelEdge(g);
    px.rect(edge(c - 2.5), edge(38.5), 1, Math.max(2, edge(42) - edge(38.5)), "lime");
  }
  g.rect(9, 44, w - 18, 1, "slate");
  return lit(g);
}

// The flower cart's idle: the middle tulip nods a drawn pixel right on frame 1.
export const FLOWER_CART_IDLE: readonly [readonly number[], number] = [[0, 1], 500];
// Cut flowers by colour and shade: pink, white, lilac, red.
export const FLOWERS: readonly (readonly [string, string])[] = [
  ["pink", "mauve"],
  ["white", "lgrey"],
  ["lilac", "violet"],
  ["red", "dred"],
];

// A tulip with its cup's top on row y: a cup of three points, its right side in sh, on a stem with a
// leaf each side. nod moves the cup that many layout pixels right, the stem held still.
export function tulip(g: Drawable, x: number, y: number, col: string, sh: string, nod = 0): void {
  g.rect(x - 0.5, y + 5, 1.5, 7, "canopy");
  g.tri([x + 0.5, y + 11], [x + 4.5, y + 6.5], [x + 1, y + 11.5], "moss");
  g.tri([x - 0.5, y + 11], [x - 4, y + 7.5], [x - 0.5, y + 10], "moss");
  const cx = x + nod;
  g.cel(cx, y + 3, 3.2, 2.6, col, sh, null);
  g.rect(cx - 3.2, y + 1, 6.4, 2, col);
  g.tri([cx - 3.2, y + 1], [cx - 1.2, y + 1], [cx - 3.2, y - 1.5], col);
  g.tri([cx - 1, y + 1], [cx + 1, y + 1], [cx, y - 1.5], col);
  g.tri([cx + 1.2, y + 1], [cx + 3.2, y + 1], [cx + 3.2, y - 1.5], sh);
  g.rect(cx + 1.6, y + 1, 1.6, 4, sh);
}

// The street cart's Cabbagetown skin, laid out on span(2) x 55 and drawn at SCALE to 112x66: a violet
// box under a lilac and white umbrella, six galvanised buckets along the counter each holding a bunch
// of three blooms over its leaves, and a pink, a white and a red tulip on the box's side. nod (0 or
// 1) nods the middle tulip a drawn pixel right.
export function flowerCart({
  nod = 0,
  w = DOUBLE_LANE_SPAN,
}: { nod?: number; w?: number } = {}): Drawable {
  const g = edged(scope.Grid(w, 55), CART_EDGE);
  const c = w / 2;
  cartWheels(g, w);
  cartUmbrella(g, w, [
    ["lilac", "white"],
    ["violet", "lgrey"],
  ]);
  g.rect(c - 1, 0, 2, 2, "grey");
  g.p(c - 1, 0, "lgrey");
  cartPole(g, w, 17);
  // the buckets, each bunch's blooms the next three colours along
  [13, 22, 31, w - 31, w - 22, w - 13].forEach((x, k) => {
    g.cel(x, 22.5, 3.4, 2.2, "canopy", "pine", "moss");
    const blooms = [...FLOWERS.slice(k % 4), ...FLOWERS.slice(0, k % 4)];
    (
      [
        [-1.8, 20.6],
        [1.8, 20.6],
        [0, 18.8],
      ] as const
    ).forEach(([dx, dy], i) => {
      const [col, sh] = blooms[i]!;
      g.cel(x + dx, dy, 1.8, 1.6, col, sh, null);
    });
    g.rect(x - 3, 24, 6, 4, "grey");
    g.rect(x - 3, 24, 1, 4, "lgrey");
    g.rect(x + 2, 24, 1, 4, "slate");
  });
  cartBox(g, w, "violet", "lilac", "purple");
  const u = unit(g)[0];
  const tulips = [
    [c - 12, FLOWERS[0]!, 0],
    [c, FLOWERS[1]!, nod * u],
    [c + 12, FLOWERS[3]!, 0],
  ] as const;
  for (const [x, [col, sh], n] of tulips) {
    tulip(g, x, 32, col, sh, n);
  }
  g.rect(9, 44, w - 18, 1, "slate");
  return lit(g);
}

// The fruit cart's idle: the apple on top of the left heap rocks a drawn pixel right on frame 1.
export const FRUIT_CART_IDLE: readonly [readonly number[], number] = [[0, 1], 500];
// Produce by colour, shade and light: apples, limes, cabbages, grapes, eggplants.
export type Produce = readonly [fill: string, shade: string, light: string | null];
export const APPLES: Produce = ["red", "dred", "pink"];
export const LIMES: Produce = ["lime", "green", null];
export const CABBAGES: Produce = ["moss", "olive", "lime"];
export const GRAPES: Produce = ["lilac", "violet", null];
export const EGGPLANTS: Produce = ["purple", "plum", "mauve"];

// The street cart's Kensington Market skin, laid out on span(2) x 55 and drawn at SCALE to 112x66: a
// canopy green box under a moss and cream umbrella, two pale bins tilted on the counter, heaped in two
// courses with apples and limes on the left and cabbages, grapes and eggplants on the right, an apple
// perched on the left heap, and a big red apple with a stalk and a leaf on the box's side. rock (0 or
// 1) rocks the perched apple a drawn pixel right.
export function fruitCart({
  rock = 0,
  w = DOUBLE_LANE_SPAN,
}: { rock?: number; w?: number } = {}): Drawable {
  const g = edged(scope.Grid(w, 55), CART_EDGE);
  const c = w / 2;
  cartWheels(g, w);
  cartUmbrella(g, w, [
    ["moss", "cream"],
    ["olive", "driftwood"],
  ]);
  g.rect(c - 1, 0, 2, 2, "grey");
  g.p(c - 1, 0, "lgrey");
  cartPole(g, w, 17);
  const u = unit(g)[0];
  const bins: readonly (readonly [number, number, readonly Produce[]])[] = [
    [10, c - 3, [APPLES, LIMES]],
    [c + 3, w - 10, [CABBAGES, GRAPES, EGGPLANTS]],
  ];
  for (const [x0, x1, kinds] of bins) {
    const n = Math.trunc(Math.floor((x1 - x0) / 4.2));
    [24, 21.4].forEach((y, row) => {
      for (let k = 0; k < n - row; k++) {
        const [col, sh, li] = kinds[(k + row) % kinds.length]!;
        g.cel(x0 + 2.2 + row * 2.1 + k * 4.2, y, 2.2, 2, col, sh, li);
      }
    });
    g.tri([x0, 24.5], [x1, 24.5], [x1, 28], "driftwood");
    g.tri([x0, 24.5], [x0, 28], [x1, 28], "driftwood");
    g.rect(x0, 24.5, x1 - x0, 1, "cream");
  }
  g.cel(22.5 + rock * u, 18.8, 2.2, 2, ...APPLES);
  cartBox(g, w, "canopy", "moss", "pine", ["cream", "driftwood"]);
  g.cel(c, 38, 5, 4.5, ...APPLES);
  g.rect(c - 0.5, 31.5, 1, 2.5, "bark");
  g.cel(c + 2.5, 32.5, 2.2, 1.2, "moss", "olive", null);
  g.rect(9, 44, w - 18, 1, "slate");
  return lit(g);
}

// The newspaper cart's idle: the top paper of the first stack lifts its right corner a drawn pixel on
// frame 1.
export const NEWSPAPER_CART_IDLE: readonly [readonly number[], number] = [[0, 1], 500];
// The magazines' covers by colour and shade.
export const COVERS: readonly (readonly [string, string])[] = [
  ["pink", "mauve"],
  ["white", "lgrey"],
  ["lime", "green"],
  ["lilac", "violet"],
  ["red", "dred"],
];

// The street cart's Yonge Street skin, laid out on span(2) x 55 and drawn at SCALE to 112x66: an
// azure box under a flat cobalt roof slab on the pole, NEWS in white on its fascia (a white bar under
// lettering's scale) and a front page standing on it; three stacks of folded papers and three
// magazines on the counter, and a row of six magazine covers on a wire shelf along the box's side,
// each with a masthead band. lift (0 or 1) lifts the first stack's top paper's right corner a drawn
// pixel.
export function newspaperCart({
  lift = 0,
  w = DOUBLE_LANE_SPAN,
}: { lift?: number; w?: number } = {}): Drawable {
  const g = edged(scope.Grid(w, 55), CART_EDGE);
  const c = w / 2;
  cartWheels(g, w);
  // the front page standing on the roof: a headline bar over a photo and lines of text
  g.rect(c - 10, 0, 20, 8, "white");
  g.rect(c + 8, 0, 2, 8, "lgrey");
  g.rect(c - 8, 1.5, 16, 2, "ink");
  g.rect(c - 8, 4.5, 7, 3.5, "azure");
  g.rect(c - 8, 4.5, 7, 1, "sky");
  for (const y of [4.5, 6.5]) {
    g.rect(c, y, 7, 0.8, "grey");
  }
  // the roof slab: lit along its top edge, shaded down its right
  g.rect(6, 8, w - 12, 2, "azure");
  g.rect(6, 10, w - 12, 7, "cobalt");
  g.rect(w - 15, 10, 9, 7, "blue");
  g.rect(6, 8, w - 12, 1, "white");
  lettering(g, c, 11, "NEWS", "white", "white");
  cartPole(g, w, 17);
  // the paper stacks, white with a grey fold line, three high
  for (const x of [13, 23, 33]) {
    for (let k = 0; k < 3; k++) {
      g.rect(x - 4, 26 - k * 1.6, 8, 1.6, "white");
      g.rect(x - 4, 27 - k * 1.6, 8, 0.6, "lgrey");
    }
  }
  if (lift) {
    const px = raster(g);
    const edge = pixelEdge(g);
    px.p(edge(17) - 1, edge(26 - 3.2) - 1, "white");
  }
  [COVERS[0]!, COVERS[2]!, COVERS[3]!].forEach(([col, sh], i) => {
    const x = w - 34 + i * 7;
    g.rect(x, 21, 5, 7, col);
    g.rect(x, 21, 5, 1.5, "white");
    g.rect(x + 4, 22.5, 1, 5.5, sh);
    g.rect(x + 1, 24, 2, 2, sh);
  });
  cartBox(g, w, "azure", "white", "cobalt");
  // the side rack: six covers, each with a masthead band (ink on a white cover) and a photo in its
  // shade
  [...COVERS, ...COVERS.slice(1, 2)].forEach(([col, sh], k) => {
    const x = 13 + k * 11;
    g.rect(x, 32, 8, 10, col);
    g.rect(x, 32, 8, 2.5, col !== "white" ? "white" : "ink");
    g.rect(x + 7, 34.5, 1, 7.5, sh);
    g.rect(x + 1.5, 36, 4, 3.5, sh);
  });
  g.rect(11, 42, w - 25, 1, "lgrey");
  g.rect(9, 44, w - 18, 1, "slate");
  return lit(g);
}

// The grid every drawing here makes and the letters lettering spells with, which small() and
// hood_city.ts swap while they run (see mini.ts).
export const scope: ObstaclesScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
  LETTERS,
};

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  const idle = <T>(
    draw: (a: T) => Drawable,
    [args, ms]: readonly [readonly T[], number],
    s: Scale = SCALE,
  ): Tag[] => [["idle", args.map((a) => drawn(s, draw, a).outlined()), ms]];

  yield ["trash-can", idle(trashCan, TRASH_CAN_IDLE)];
  yield ["bench", idle(bench, BENCH_IDLE)];
  yield ["hedge", idle((r: readonly number[]) => hedge({ rustle: r }), HEDGE_IDLE)];
  const [args, ms] = PULL_OUT;
  const [drive, driveMs] = DRIVE;
  yield [
    "parked-car",
    [
      ...idle(parkedCar, PARKED_CAR_IDLE, CAR_SCALE),
      ["pull-out", args.map((f) => drawn(CAR_SCALE, parkedCar, false, { roll: f }).outlined()), ms],
      [
        "drive",
        drive.map((f) => drawn(CAR_SCALE, parkedCar, false, { blink: false, roll: f }).outlined()),
        driveMs,
      ],
    ],
  ];
  yield [
    "delivery-truck",
    [
      ...idle(deliveryTruck, DELIVERY_IDLE, CAR_SCALE),
      [
        "drive",
        drive.map((f) => drawn(CAR_SCALE, deliveryTruck, 0, { roll: f }).outlined()),
        driveMs,
      ],
    ],
  ];
  yield ["hot-dog-cart", idle((f: number) => hotDogCart({ steam: f }), HOT_DOG_CART_IDLE)];
  yield ["flower-cart", idle((f: number) => flowerCart({ nod: f }), FLOWER_CART_IDLE)];
  yield ["fruit-cart", idle((f: number) => fruitCart({ rock: f }), FRUIT_CART_IDLE)];
  yield ["ice-cream-cart", idle((f: number) => iceCreamCart({ drip: f }), ICE_CREAM_CART_IDLE)];
  yield ["newspaper-cart", idle((f: number) => newspaperCart({ lift: f }), NEWSPAPER_CART_IDLE)];
  yield [
    "streetcar",
    [
      ...idle(streetcar, STREETCAR_IDLE, CAR_SCALE),
      [
        "drive",
        drive.map((f) => drawn(CAR_SCALE, streetcar, false, { roll: f }).outlined()),
        driveMs,
      ],
    ],
  ];
  const [cue, cueMs] = TAXI_CUE;
  const [merge, mergeMs] = TAXI_MERGE;
  yield [
    "taxi",
    [
      ["drive", drive.map((f) => drawn(CAR_SCALE, taxi, { roll: f }).outlined()), driveMs],
      [
        "cue",
        cue.map(([f, b]) => drawn(CAR_SCALE, taxi, { roll: f, signal: b }).outlined()),
        cueMs,
      ],
      [
        "merge",
        merge.map(([f, b]) =>
          drawn(CAR_SCALE, taxi, { roll: f, signal: b, turn: true }).outlined(),
        ),
        mergeMs,
      ],
    ],
  ];
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites, srcDir: "art/obstacles" });
}
