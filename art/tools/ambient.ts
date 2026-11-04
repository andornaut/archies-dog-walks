// Draw the ambient layer: people, traffic and lawn animals that pass by with no collisions and no
// card. Each is a road sprite with a variant at every depth step in STEPS (@94 to @50), outlined with
// pixel.ts's roadEdge and lit with road.ts's LIT rim on its dark parts; the cross street draws from
// @50. Side views face right; the game flips them to go left.
//
// The pedestrian is a student out for a stroll, calm and alone: dark brown hair in a ponytail, sky
// headphones, a red jacket, a green backpack, sky jeans and white sneakers. No dog, no leash and no
// prop in hand, so it never reads as an owner, a walker or a road hazard. It is laid out on 32x48 and
// drawn at road.ts's SCALE (1.5) on road.ts's person legs, and walks with the road people's stride,
// HUMAN_WALK at HUMAN_WALK_MS: a foot lifted, both feet 1px up as the body passes 1px higher, the
// other foot lifted, passing again. Its feet are on row 68 at full size, as the walkers' are.
//
// The cars are laid out in design units and drawn at road.ts's SCALE: a cyan greenhouse with a lit
// roof and a glint, the body lit along the belt line and a step darker along the sill and down the
// nose, lamps, bumpers, dark wheel arches. drive (4 frames at DRIVE_MS): a spoke through each hub
// turns an eighth a frame, and the body dips 1px onto the wheels on frames 1 and 2. ambient-car is
// the sedan; the other bodies are extra keys. The bus is a TTC bus: a white greenhouse and roof pod
// over a red body with two white stripes, six windows, glass front and middle doors split down the
// middle, a tall windshield under an amber-lit destination sign, and its lamps low at the bumpers;
// side on it shows no pantograph and rides on tires, so it never reads as the streetcar. The cyclist
// rides an amber helmet, a mauve jersey and navy shorts on a red bike; ride (4 frames at RIDE_MS):
// the cranks turn a quarter a frame with the feet on the pedals, a cross of spokes turns a
// sixteenth, and the back and head sit 1px lower on frames 1 and 3. Its wheels are clear inside, so
// the road shows between the spokes.
//
// The lawn animals are laid out on 32x32 and drawn at ANIMAL_SCALE (1.25), 40x40, each idle first so
// frame 0 is its rest pose on the ground.
//
// ambient-pedestrian        48x72  front view, walking toward the walker; walk 8 x 50ms
// ambient-pedestrian-back   48x72  back view, walking away; walk 8 x 50ms
// ambient-car               72x42  an orange sedan; drive 4 x 100ms
// ambient-car-hatchback     63x42  a red hatchback
// ambient-car-van           69x45  a two-tone van, white over green
// ambient-car-wagon         75x42  a cream station wagon with a wood side panel and a roof rack
// ambient-bus               126x54 a TTC bus, red and white; drive 4 x 100ms
// ambient-bike              66x72  the cyclist side on; ride 4 x 120ms
// ambient-cat               40x40  a ginger tabby; idle 2 x 400ms (sat, its tail flicking), run 4 x
//                                  90ms (a gallop)
// ambient-rabbit            40x40  a brown cottontail; idle 2 x 400ms (a nose twitch), hop 4 x 110ms
// ambient-bird              40x40  a robin; idle 2 x 400ms (a peck), fly 4 x 90ms (wings up, level,
//                                  down, level)
// ambient-plane             26x10  a jet over Yonge Street; fly 2 x 250ms (its lights blink)
// ambient-balloon           18x26  a hot air balloon over High Park; fly 4 x 300ms (a 1px bob, the
//                                  burner flickers)
// ambient-pigeons           36x15  five pigeons over Kensington Market; fly 4 x 90ms (wingbeats out
//                                  of phase)
// ambient-helicopter        26x12  a helicopter over Kensington Market; fly 4 x 80ms (rotor blur, a
//                                  tail beacon)
// ambient-geese             36x18  a V of five Canada geese over Cabbagetown; fly 4 x 140ms
//                                  (wingbeats)
// ambient-turboprop         32x12  a Porter turboprop over The Beaches; fly 4 x 90ms (propeller blur,
//                                  a beacon)
// ambient-banner-plane      39x10  a small plane towing a banner; fly 4 x 120ms (propeller, the
//                                  banner ripples)
// ambient-gulls             36x12  three gulls; fly 4 x 120ms (wingbeats out of phase)
// ambient-hawk              24x10  a red-tailed hawk soaring; fly 4 x 250ms (banking left and right)
// ambient-party-balloons    17x27  three party balloons on gathered strings; fly 4 x 250ms (each
//                                  bobs 1px)
// ambient-blimp             31x12  a blimp with a lit sign; fly 4 x 200ms (the sign's lights chase)
// ambient-airliner          36x7   an airliner far overhead with its contrail; fly 4 x 200ms (the
//                                  trail breaks up)
// ambient-bats              29x11  three bats at dusk; fly 4 x 80ms (wingbeats and a flutter out of
//                                  phase)
// ambient-kite              17x28  a diamond kite on its string; fly 4 x 200ms (the ribbon tail
//                                  sways)
//
// The sky movers fly far back, so each is at full size only with no depth variants, faces right, and
// has one fly tag. Each is a few large shapes that read at 1x on its sky (Yonge Street's slate, then
// azure, violet, lilac, peach and gold), with one ink line round every fill except the geese's and
// the bats'. A line one pixel thin, a rope, a string, a contrail, a skid or a rotor blur, is drawn
// past the outline so the ink does not thicken it.
// - The plane is a white fuselage over a grey belly with one row of windows, a rounded nose with
//   cockpit glass, a swept red fin, and the swept slate wing below with its engine. The wingtip light
//   and the belly beacon are red on frame 0 and flash white on frame 1. It stays smaller than the CN
//   Tower's pod.
// - The balloon is a teardrop envelope of seven curved gores, red and amber, the rightmost a step
//   darker, glinting at its upper left, on two ink ropes to a wicker basket. It sits 1px lower on
//   frames 2 and 3, and the burner flares on frames 0 and 2.
// - The pigeons are grey chevrons with slate bodies in a loose straggle, each a different step through
//   its wingbeat (up, level, down, level) so the flock shimmers.
// - The helicopter is red with a foam glass bubble at the nose, a tapered tail boom and fin, thin ink
//   skids and a thin rotor blur. The main rotor alternates a long blur and a broken one each frame;
//   the fin's beacon is red on frames 0 and 1.
// - The geese are dark brown bodies with darker wings, black tails, black neck lines and white
//   chinstraps, with no outline, as birds far off read against the dusk. The leader is at the V's
//   point on the right and each goose is a step behind the one ahead in its wingbeat.
// - The turboprop is a white fuselage with a navy belly, one row of windows and a navy cockpit glass,
//   a navy T-tail, the high wing along the roof with its engine hung forward, and the gear down for
//   the island airport. The propeller is a tall slate disc crossing the fuselage with a blade bright
//   at its top, then its bottom; the belly beacon is red on frames 0 and 1.
// - The banner plane is a small white high-wing plane with a red fin and wing and fixed gear, towing
//   a white banner of red lettering on a thin rope; the banner's tail ripples, the wave travelling
//   back.
// - The gulls are white, larger than the pigeons and bent at the wrist, with grey tails and amber
//   beaks.
// - The hawk is seen from below as it soars: cream wing linings with dark leading edges and
//   fingertips, a dark belly band and a fanned rust tail. It banks a pixel at the wingtips one way,
//   then the other.
// - The party balloons are red, sky and yellow, each glinting and bobbing out of step, on ink strings
//   that gather to one knot; the loose end swings. They have no basket, so they never read as the hot
//   air balloon.
// - The blimp is a white envelope shaded lgrey, red fins at its tail, a navy sign whose amber lights
//   chase toward the nose, and a gondola with cyan windows.
// - The airliner is small and high: a white fuselage, a blue fin, a slate wing and engine, and a thin
//   white contrail whose far end breaks into dashes.
// - The bats are ink silhouettes with no outline, as the geese, so they hold on Yonge Street's slate:
//   ears, a body and wings raised, spread with a scalloped trailing edge, or down, each fluttering a
//   pixel up and down out of step.
// - The kite is a diamond quartered red and white with a red and white ribbon tail swaying under it
//   and its string running down to the lower left.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts; the legs, face and rim come from road.ts.
import { Mini, small, snap, STEPS } from "./mini.ts";
import {
  bitmap,
  type Colour,
  DARKER,
  type Drawable,
  edged,
  type Frame,
  Grid,
  K,
  main,
  type Point,
  type Sprite,
  type Tag,
} from "./pixel.ts";
import {
  dressed,
  faceDisc,
  HUMAN_WALK,
  HUMAN_WALK_MS,
  lit,
  rim,
  SCALE,
  scope as roadScope,
  swung,
  type Top,
} from "./road.ts";

const USAGE = `Usage:
  node art/tools/ambient.ts preview OUT.png   every frame on the zone roads
  node art/tools/ambient.ts build             export to public/art/sprites/`;

export const DRIVE_MS = 100;
export const RIDE_MS = 120;
// The lawn animals are laid out on 32x32 and drawn ANIMAL_SCALE times larger, 40x40.
export const ANIMAL_SCALE = 1.25;
export const IDLE_MS = 400;
export const RUN_MS = 90;
export const HOP_MS = 110;
export const FLY_MS = 90;
export const PLANE_MS = 250;
export const BALLOON_MS = 300;
export const PIGEON_MS = 90;
export const HELICOPTER_MS = 80;
export const GEESE_MS = 140;
export const TURBOPROP_MS = 90;
export const BANNER_PLANE_MS = 120;
export const GULLS_MS = 120;
export const HAWK_MS = 250;
export const PARTY_BALLOONS_MS = 250;
export const BLIMP_MS = 200;
export const AIRLINER_MS = 200;
export const BATS_MS = 80;
export const KITE_MS = 200;

// ---------- the pedestrian, laid out on 32x48 as road.ts's person tops are ----------

// The student facing the walker: a red jacket with its zip, the backpack's straps over the
// shoulders, its free arms swinging as it walks, and headphones over dark brown hair.
export function studentFront(g: Drawable, b: number, arms = 0): void {
  g.rect(9, 21 + b, 14, 13, "red");
  g.rect(20, 21 + b, 3, 13, "dred");
  g.rect(15, 21 + b, 2, 13, "dred");
  g.rect(9, 32 + b, 14, 2, "dred");
  const left = swung(arms, -1);
  const right = swung(arms, 1);
  g.rect(5, 22 + b, 4, 9 - left, "red");
  g.rect(5, 31 + b - left, 4, 3, "skin1");
  g.rect(23, 22 + b, 4, 9 - right, "red");
  g.rect(26, 22 + b, 1, 9 - right, "dred");
  g.rect(23, 31 + b - right, 4, 3, "skin1");
  g.rect(10, 21 + b, 2, 9, "green");
  g.rect(20, 21 + b, 2, 9, "dgreen");
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.cel(16, 8 + b, 9, 5, "dbrown", "plum", "brown");
  g.rect(7, 8 + b, 3, 7, "dbrown");
  g.rect(22, 8 + b, 3, 7, "plum");
  g.rect(10, 8 + b, 12, 2, "dbrown");
  g.rect(9, 2 + b, 14, 2, "sky");
  g.rect(5, 10 + b, 4, 6, "sky");
  g.rect(23, 10 + b, 4, 6, "blue");
  roadScope.faceFront(g, 16, 13 + b);
  g.p(10, 16 + b, "pink");
  g.p(22, 16 + b, "pink");
}

// The student walking away: the green backpack over the red jacket, its pocket and zip, the ponytail
// over the backpack's top, tied in red, the headphones' band over it and a cup over each ear; its
// arms swing as it walks.
export function studentBack(g: Drawable, b: number, arms = 0): void {
  g.rect(9, 21 + b, 14, 13, "red");
  g.rect(20, 21 + b, 3, 13, "dred");
  g.rect(9, 32 + b, 14, 2, "dred");
  const left = swung(arms, -1);
  const right = swung(arms, 1);
  g.rect(5, 22 + b, 4, 9 - left, "red");
  g.rect(5, 31 + b - left, 4, 3, "skin1");
  g.rect(23, 22 + b, 4, 9 - right, "red");
  g.rect(26, 22 + b, 1, 9 - right, "dred");
  g.rect(23, 31 + b - right, 4, 3, "skin2");
  g.rect(10, 22 + b, 12, 10, "green");
  g.rect(19, 22 + b, 3, 10, "dgreen");
  g.rect(10, 22 + b, 12, 1, "yellow");
  g.rect(12, 27 + b, 8, 4, "dgreen");
  g.rect(12, 27 + b, 8, 1, "yellow");
  g.rect(14, 19 + b, 4, 3, "skin1");
  g.cel(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown");
  g.ell(16, 22.5 + b, 2.5, 3.5, "dbrown", "plum");
  g.rect(15, 19 + b, 2, 1, "red");
  g.rect(9, 3 + b, 14, 2, "sky");
  g.rect(5, 10 + b, 4, 6, "sky");
  g.rect(23, 10 + b, 4, 6, "blue");
}

export const LEGS = { legs: "sky", shoes: "white" };

// Walk frame step at road.ts's SCALE x the depth step (s), with HUMAN_WALK's planted legs.
export function walking(s: number, top: Top, step: number): Frame {
  const q = snap(HUMAN_WALK[step] as Readonly<Record<string, number>>, s);
  return small(roadScope, roadScope, s, dressed, top, { grounded: true, ...LEGS, ...q }).outlined();
}

// The pedestrian's front and back views at a depth step.
export function* pedestrians(suffix: string, step: number): Generator<Sprite> {
  const s = SCALE * step;
  for (const [key, top] of [
    ["ambient-pedestrian", studentFront],
    ["ambient-pedestrian-back", studentBack],
  ] as const) {
    yield [
      `${key}${suffix}`,
      [["walk", HUMAN_WALK.map((_, f) => walking(s, top, f)), HUMAN_WALK_MS]],
    ];
  }
}

// ---------- cars: side elevations, laid out in design units and drawn at road.ts's SCALE ----------

// A hub's spoke a frame, an eighth of a turn clockwise each, as a wheel rolling right turns: |, /, -
// and \, as offsets from the hub's centre.
export const SPOKES: readonly (readonly Point[])[] = [
  [
    [0, -2],
    [0, -1],
    [0, 1],
    [0, 2],
  ],
  [
    [1, -1],
    [-1, 1],
  ],
  [
    [-2, 0],
    [-1, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [-1, -1],
    [1, 1],
  ],
];
// Every car's roof row; the frame keeps 2 clear rows above it and 2 columns each side.
export const ROOF = 3;
// A tire's radius; it rises 3 rows into the body.
export const TIRE = 5;

// A block over a car's body: x0, x1, y0, y1 (inclusive) and its colour.
export type Band = readonly [x0: number, x1: number, y0: number, y1: number, c: string];
// A span of columns, first and last.
export type Span = readonly [number, number];

// A car's side profile: see Car.
export interface CarOptions {
  back: number;
  bands?: readonly Band[];
  belt: number;
  body?: number;
  cabin: Span;
  doors?: readonly number[];
  front: number;
  lamp?: number;
  length: number;
  paint: readonly [base: string, shade: string, light: string];
  pillars?: readonly number[];
  pod?: Span;
  rack?: Span;
  sign?: Span;
  upper?: string;
  wheels: readonly number[];
}

// A car's side profile facing right, in design units. The greenhouse runs from the roof (ROOF) to the
// row above belt, the body from belt for body rows, and the tires reach TIRE * 2 - 3 rows past the
// body to the ground row. cabin is the roof's first and last column; back and front are how many
// columns the greenhouse widens per row behind and ahead. Columns are counted from the art's left
// edge, 2 in from the frame's. The extras: upper, the greenhouse's paint; pillars and doors, their
// columns; bands, blocks over the body; rack and pod, a roof rack's or a roof pod's columns; sign,
// the columns of an amber-lit destination sign along the greenhouse's top; lamp, the lamps' top row.
export class Car {
  readonly body: number;
  readonly cy: number;
  readonly end: number;
  readonly h: number;
  readonly q: CarOptions;
  readonly w: number;

  constructor(q: CarOptions) {
    this.q = q;
    this.body = q.body ?? 9;
    this.end = q.belt + this.body - 1;
    this.cy = this.end - 3 + TIRE + 0.5;
    this.w = q.length + 4;
    this.h = this.end + TIRE * 2 - 3 + 2;
  }

  // The greenhouse's first and last column on row y.
  span(y: number): [number, number] {
    const [x0, x1] = this.q.cabin;
    const k = y - ROOF;
    return [Math.floor(x0 - k * this.q.back), Math.ceil(x1 + k * this.q.front)];
  }

  // Drive frame roll (0 to 3) at scale s: the body 1px lower on frames 1 and 2.
  draw(s: number, roll: number): Frame {
    const g = edged(new Mini(s, this.w, this.h));
    const dip = roll === 1 || roll === 2 ? 1 / s : 0;
    const { end, q } = this;
    const { belt, length } = q;
    const [base, shade, light] = q.paint;
    const upper = q.upper ?? base;
    const rect = (x: number, y: number, w: number, h: number, c: Colour): void => {
      g.rect(x + 2, y + dip, w, h, c);
    };
    // the greenhouse: pillars in the paint round the glass, the roof lit
    const [a0, a1] = this.span(ROOF);
    const [b0, b1] = this.span(belt);
    const quad = (pts: readonly Point[], c: string): void => {
      const [p0, p1, p2, p3] = pts.map(([x, y]) => [x + 2, y + dip] as const) as [
        Point,
        Point,
        Point,
        Point,
      ];
      g.tri(p0, p1, p2, c);
      g.tri(p0, p2, p3, c);
    };
    quad(
      [
        [a0, ROOF],
        [a1 + 1, ROOF],
        [b1 + 1, belt],
        [b0, belt],
      ],
      upper,
    );
    quad(
      [
        [a0 + 2, ROOF + 1],
        [a1 - 1, ROOF + 1],
        [b1 - 1, belt],
        [b0 + 2, belt],
      ],
      "cyan",
    );
    rect(a0, ROOF, a1 - a0 + 1, 1, light);
    for (const x of q.pillars ?? []) {
      rect(x, ROOF + 1, 2, belt - ROOF - 1, upper);
    }
    const gx = this.span(ROOF + 1)[1] - 3;
    for (let i = 0; i < 3; i++) {
      rect(gx - i, ROOF + 2 + i, 1, 1, "white");
    }
    if (q.rack) {
      const [x0, x1] = q.rack;
      rect(x0, ROOF - 1, x1 - x0 + 1, 1, "dslate");
      for (const x of [x0 + 1, x1 - 1]) {
        rect(x, ROOF - 1, 1, 1, "grey");
      }
    }
    if (q.pod) {
      const [x0, x1] = q.pod;
      rect(x0, ROOF - 2, x1 - x0 + 1, 2, "lgrey");
      rect(x0, ROOF - 2, x1 - x0 + 1, 1, "white");
    }
    if (q.sign) {
      const [x0, x1] = q.sign;
      rect(x0, ROOF + 1, x1 - x0 + 1, 2, "ink");
      for (let x = x0 + 1; x < x1; x += 2) {
        rect(x, ROOF + 1.5, 1, 1, "amber");
      }
    }
    // the body: lit along the belt, a step darker along the sill and down the nose
    rect(1, belt, length - 2, this.body, base);
    rect(1, belt, length - 2, 1, light);
    rect(1, end - 1, length - 2, 2, shade);
    rect(length - 3, belt + 1, 2, this.body - 2, shade);
    for (const [x0, x1, y0, y1, c] of q.bands ?? []) {
      rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c);
    }
    for (const x of q.doors ?? []) {
      rect(x, belt + 1, 1, this.body - 3, shade);
      rect(x + 2, belt + 2, 2, 1, "lgrey");
    }
    const mx = this.span(belt - 1)[1] - 2;
    rect(mx, belt - 2, 3, 2, shade);
    // lamps and bumpers
    const lamp = q.lamp ?? belt + 1;
    rect(length - 3, lamp, 2, 2, "yellow");
    rect(length - 3, lamp, 1, 1, "white");
    rect(1, lamp, 2, 3, "red");
    rect(0, end - 3, 3, 3, "lgrey");
    rect(length - 3, end - 3, 3, 3, "lgrey");
    rect(0, end - 1, 3, 1, "grey");
    rect(length - 3, end - 1, 3, 1, "grey");
    // wheel arches, dark inside the body, cut off below it, then the tires in front of them
    for (const cx of q.wheels) {
      rect(cx - TIRE - 1.5, this.cy - TIRE - 1.5 - dip, (TIRE + 1.5) * 2, 1, null);
      g.ell(cx + 2, this.cy + dip, TIRE + 1.5, TIRE + 1.5, "navy");
    }
    g.rect(0, end + 1 + dip, this.w, this.h, null);
    lit(g, { navy: ["slate", null] });
    for (const wheelX of q.wheels) {
      const cx = wheelX + 2;
      g.ell(cx, this.cy, TIRE, TIRE, "ink");
      g.ell(cx, this.cy, 2.6, 2.6, "grey");
      for (const [dx, dy] of SPOKES[roll]!) {
        g.rect(cx - 0.5 + dx, this.cy - 0.5 + dy, 1, 1, "dslate");
      }
      g.rect(cx - 0.5, this.cy - 0.5, 1, 1, "lgrey");
    }
    rim(g.g, { ink: ["grey", null] });
    return g.outlined();
  }
}

// ambient-car is the sedan; the other bodies are extra keys the game may take in turn.
export const CARS: ReadonlyMap<string, Car> = new Map([
  [
    "ambient-car",
    new Car({
      back: 0.9,
      belt: 11,
      cabin: [16, 26],
      doors: [12, 22],
      front: 1.5,
      length: 44,
      paint: ["orange", "rust", "amber"],
      pillars: [21],
      wheels: [10, 34],
    }),
  ],
  [
    "ambient-car-hatchback",
    new Car({
      back: 0.6,
      belt: 11,
      cabin: [8, 23],
      doors: [15],
      front: 1.4,
      length: 38,
      paint: ["red", "dred", "pink"],
      pillars: [16],
      wheels: [9, 29],
    }),
  ],
  [
    "ambient-car-van",
    new Car({
      back: 0,
      bands: [[1, 40, 13, 13, "white"]],
      belt: 13,
      cabin: [3, 30],
      doors: [20],
      front: 1,
      length: 42,
      paint: ["green", "dgreen", "yellow"],
      pillars: [10, 20],
      upper: "white",
      wheels: [9, 33],
    }),
  ],
  [
    "ambient-car-wagon",
    new Car({
      back: 0,
      bands: [
        [3, 41, 14, 17, "brown"],
        [3, 41, 14, 14, "ochre"],
        [3, 41, 17, 17, "dbrown"],
      ],
      belt: 11,
      cabin: [6, 32],
      doors: [14, 24],
      front: 1.4,
      length: 46,
      paint: ["cream", "tan", "white"],
      pillars: [13, 23],
      rack: [8, 30],
      wheels: [10, 36],
    }),
  ],
  [
    "ambient-bus",
    new Car({
      back: 0,
      bands: [
        [3, 63, 4, 5, "white"],
        [1, 77, 15, 15, "white"],
        [1, 77, 22, 22, "white"],
        [34, 41, 15, 24, "cyan"],
        [37, 38, 15, 24, "white"],
        [66, 73, 15, 24, "cyan"],
        [69, 70, 15, 24, "white"],
        [75, 77, 15, 20, "cyan"],
      ],
      belt: 15,
      body: 13,
      cabin: [2, 76],
      front: 0.2,
      lamp: 23,
      length: 80,
      paint: ["ttc", "dred", "red"],
      pillars: [12, 23, 34, 45, 54, 64],
      pod: [8, 24],
      sign: [66, 78],
      upper: "white",
      wheels: [14, 58],
    }),
  ],
]);

// Every car at a depth step.
export function* cars(suffix: string, step: number): Generator<Sprite> {
  const s = SCALE * step;
  for (const [key, car] of CARS) {
    yield [`${key}${suffix}`, [["drive", [0, 1, 2, 3].map((r) => car.draw(s, r)), DRIVE_MS]]];
  }
}

// ---------- the cyclist: side on, laid out on 44x48 and drawn at road.ts's SCALE ----------

// The bike in design units: hubs, the bottom bracket, the seat cluster, the head tube's top and
// bottom.
export const REAR: Point = [9, 38.5];
export const FRONT: Point = [33, 38.5];
export const BB: Point = [20, 39];
export const SEAT: Point = [16, 26];
export const HEAD: Point = [30, 25];
export const FORK: Point = [31, 29];
// A wheel's radius: an ink tire 1.2 thick round an lgrey rim 0.8 thick, clear inside.
export const WHEEL = 8;
export const CRANK = 4;
export const HIP: Point = [16.5, 22];
export const THIGH = 10;
export const SHIN = 11;
// The near pedal a frame, a quarter turn clockwise each, as the wheels turn: top, front, bottom,
// back.
export const PEDAL: readonly Point[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// What bar draws on.
export interface Triangles {
  tri(a: Point, b: Point, c: Point, col: Colour): void;
}

// A straight bar w thick from a to b, as a quadrilateral.
export function bar(g: Triangles, a: Point, b: Point, w: number, c: Colour): void {
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

// Where the knee bends between hip and foot, forward of the line between them.
export function knee(hip: Point, foot: Point): Point {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const d = Math.max(1e-6, Math.hypot(dx, dy));
  const r = Math.min(d, THIGH + SHIN - 1e-6);
  const a = (THIGH * THIGH - SHIN * SHIN + r * r) / (2 * r);
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
  let nx = dy / d;
  let ny = -dx / d;
  if (nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [hip[0] + (dx * a) / d + nx * h, hip[1] + (dy * a) / d + ny * h];
}

// A Mini seen through a column offset: every shape lands dx design units to the right.
export class Shift implements Triangles {
  readonly dx: number;
  readonly g: Mini;

  constructor(g: Mini, dx: number) {
    this.g = g;
    this.dx = dx;
  }

  cel(cx: number, cy: number, rx: number, ry: number, c: Colour, sh?: Colour, li?: Colour): void {
    this.g.cel(cx + this.dx, cy, rx, ry, c, sh, li);
  }

  ell(cx: number, cy: number, rx: number, ry: number, c: Colour, sh?: Colour, li?: Colour): void {
    this.g.ell(cx + this.dx, cy, rx, ry, c, sh, li);
  }

  rect(x: number, y: number, w: number, h: number, c: Colour): void {
    this.g.rect(x + this.dx, y, w, h, c);
  }

  tri(a: Point, b: Point, c: Point, col: Colour): void {
    this.g.tri([a[0] + this.dx, a[1]], [b[0] + this.dx, b[1]], [c[0] + this.dx, c[1]], col);
  }
}

// Ride frame f (0 to 3) at scale s: a rider in an amber helmet, a mauve jersey and navy shorts on a
// red bike, side on, riding right. The cranks turn a quarter a frame with the feet on the pedals, the
// spokes a sixteenth (a cross of them, so the loop is seamless), and the rider's back and head sit
// 1px lower on frames 1 and 3. The spokes go on after the outline, so the road shows between them.
export function cyclist(s: number, f: number): Frame {
  const [w, h] = [44, 48];
  const g = new Shift(edged(new Mini(s, w, h)), 1);
  const b = f === 1 || f === 3 ? 1 / s : 0;
  const [px, py] = PEDAL[f]!;
  const near: Point = [BB[0] + CRANK * px, BB[1] + CRANK * py];
  const far: Point = [BB[0] - CRANK * px, BB[1] - CRANK * py];
  for (const [cx, cy] of [REAR, FRONT]) {
    g.ell(cx, cy, WHEEL, WHEEL, "ink");
    g.ell(cx, cy, WHEEL - 1.2, WHEEL - 1.2, "lgrey");
    g.ell(cx, cy, WHEEL - 2, WHEEL - 2, null);
  }
  const leg = (foot: Point, skin: string, shoe: string): void => {
    const k = knee(HIP, foot);
    bar(g, HIP, k, 4, skin);
    bar(g, k, foot, 3.5, skin);
    g.ell(k[0], k[1], 2, 2, skin);
    g.rect(foot[0] - 2.5, foot[1] - 1.5, 6, 2.5, shoe);
  };
  leg(far, "skin2", "lgrey");
  bar(g, BB, far, 1.5, "grey");
  for (const [a, c] of [
    [REAR, BB],
    [REAR, SEAT],
    [BB, SEAT],
    [SEAT, HEAD],
    [BB, FORK],
    [HEAD, FRONT],
  ] as const) {
    bar(g, a, c, 2, "red");
  }
  bar(g, SEAT, [15.5, 23], 1.5, "grey");
  g.rect(12, 22, 7, 2, "ink");
  bar(g, HEAD, [29.5, 21], 1.5, "grey");
  g.rect(27, 20, 4, 2, "ink");
  // the rider: shorts on the saddle, the back bent toward the bars, the arm to the grip
  g.ell(16.5, 21 + b, 4, 3, "navy");
  bar(g, [16.5, 19 + b], [23, 13 + b], 7.5, "mauve");
  bar(g, [19, 21 + b], [25, 15.5 + b], 2, "purple");
  bar(g, [23.5, 14 + b], [28, 19], 3, "mauve");
  bar(g, [27, 18], [29, 21], 2.5, "skin1");
  // the head side on: face, nose and eye, hair at the nape, the helmet over it all
  g.ell(26, 9 + b, 6.5, 6.5, "skin1");
  g.rect(31.5, 9 + b, 1.5, 2, "skin1");
  g.rect(20.5, 9 + b, 4, 5, "dbrown");
  g.rect(28, 8 + b, 2, 2, "ink");
  g.rect(28, 8 + b, 1, 1, "white");
  g.rect(29, 13 + b, 2, 1, "dbrown");
  g.rect(24, 9 + b, 2, 3, "skin2");
  g.cel(25, 5.5 + b, 7, 4, "amber", "orange", "yellow");
  g.rect(19.5, 7 + b, 12, 1.5, "orange");
  g.rect(30, 6.5 + b, 3, 1, "orange");
  for (const x of [23, 26]) {
    g.rect(x, 3 + b, 1.5, 1, "orange");
  }
  bar(g, BB, near, 1.5, "lgrey");
  g.ell(BB[0], BB[1], 1.5, 1.5, "grey");
  leg(near, "skin1", "white");
  const out = lit(g.g, { navy: ["grey", "slate"], purple: ["mauve", null] }).outlined();
  // the spokes: a cross through each hub, a sixteenth of a turn on per frame
  for (const [hubX, hubY] of [REAR, FRONT]) {
    const cx = (hubX + 1) * s;
    const cy = hubY * s;
    const r = (WHEEL - 2) * s;
    for (let k = 0; k < 2; k++) {
      const a = (f * 22.5 + k * 90) * (Math.PI / 180);
      for (let t = -Math.trunc(r); t <= Math.trunc(r); t++) {
        const x = Math.floor(cx + t * Math.cos(a));
        const y = Math.floor(cy + t * Math.sin(a));
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r - 0.3 && !out[y]![x]) {
          out[y]![x] = K.grey!;
        }
      }
    }
    out[Math.floor(cy)]![Math.floor(cx)] = K.dslate!;
  }
  return out;
}

// The cyclist at a depth step.
export function* bikes(suffix: string, step: number): Generator<Sprite> {
  const s = SCALE * step;
  yield [`ambient-bike${suffix}`, [["ride", [0, 1, 2, 3].map((f) => cyclist(s, f)), RIDE_MS]]];
}

// ---------- lawn animals: side on, facing right, laid out on 32x32 ----------
// Each stands on row 30 (the sitting cat on 31); frame 0 of its idle is the rest pose the game
// measures its feet from.

// A lawn animal's drawing on its grid.
export type AnimalDraw = (g: Drawable) => void;

// A cat run frame: body dy, arch lift, near and far front feet, near and far back feet, tail tip.
export type CatRun = readonly [
  dy: number,
  arch: number,
  nf: Point,
  ff: Point,
  nb: Point,
  fb: Point,
  tail: Point,
];
// A cat pose: a run frame, or sat up for the idle, its tail's tip flicking on "sit-tail".
export type CatPose = "sit" | "sit-tail" | CatRun;

// A ginger tabby side on in pose: sat up for the idle, its tail curled round, or a gallop frame.
export function gingerCat(pose: CatPose): AnimalDraw {
  return (g) => {
    if (typeof pose === "string") {
      g.cel(17, 30, 4, 1.5, "rust");
      const tip: Point = pose === "sit" ? [5, 22] : [4, 19];
      bar(g, [11, 28], [7, 27], 2.5, "orange");
      bar(g, [7, 27], tip, 2.5, "orange");
      g.ell(tip[0], tip[1], 1.5, 1.5, "rust");
      g.cel(14, 23, 6, 7, "orange", "rust", "amber");
      for (const x of [11, 14]) {
        g.rect(x, 17, 1, 4, "rust");
      }
      g.rect(18, 22, 3, 8, "orange");
      g.rect(20, 22, 1, 8, "rust");
      g.rect(17, 28, 5, 2, "cream");
      g.cel(19, 15, 5, 4.5, "orange", "rust", "amber");
      g.tri([15, 12], [18, 11], [16, 6.5], "orange");
      g.tri([19, 11], [22, 12], [21, 6.5], "orange");
      g.tri([20, 11], [21.5, 11.5], [21, 8.5], "pink");
      g.rect(20, 16, 4.5, 3, "cream");
      g.rect(21, 14, 2, 2, "green");
      g.rect(22, 14, 1, 2, "ink");
      g.rect(24, 16, 1, 1, "pink");
      return;
    }
    const [dy, arch, nf, ff, nb, fb, tail] = pose;
    for (const [[x0, y0], foot, c] of [
      [[22, 22], ff, "rust"],
      [[9, 22], fb, "rust"],
    ] as const) {
      bar(g, [x0, y0 + dy], foot, 2.5, c);
      g.rect(foot[0] - 1, foot[1] - 1, 3, 2, c);
    }
    bar(g, [8, 19 + dy], [4, 15 + dy], 2.5, "orange");
    bar(g, [4, 15 + dy], tail, 2.5, "orange");
    g.ell(tail[0], tail[1], 1.5, 1.5, "rust");
    // the arch lifts the whole body as the legs gather under it, so it keeps its bulk instead of
    // swelling
    g.cel(15, 20 + dy - arch, 9, 4.5, "orange", "rust", "amber");
    for (const x of [11, 14, 17]) {
      g.rect(x, 16 + dy - arch, 1, 3, "rust");
    }
    g.rect(12, 23 + dy - arch, 8, 1.5, "cream");
    for (const [[x0, y0], foot] of [
      [[22, 22], nf],
      [[9, 22], nb],
    ] as const) {
      bar(g, [x0, y0 + dy], foot, 3, "orange");
      g.rect(foot[0] - 1, foot[1] - 1, 3, 2, "cream");
    }
    g.cel(25, 16 + dy, 4.5, 4, "orange", "rust", "amber");
    g.tri([21.5, 14 + dy], [24.5, 13 + dy], [22.5, 8.5 + dy], "orange");
    g.tri([24.5, 13 + dy], [27.5, 13.5 + dy], [26.5, 9 + dy], "orange");
    g.rect(26, 17 + dy, 4, 2.5, "cream");
    // the same eye as when it sits: green, its pupil towards the front
    g.rect(26, 15 + dy, 2, 2, "green");
    g.rect(27, 15 + dy, 1, 2, "ink");
    g.rect(29.5, 17 + dy, 1, 1, "pink");
  };
}

// The cat's gallop: stretched out, landing on its front feet, gathered with its body lifted over its
// feet, pushing off. arch lifts the body by that many units.
export const CAT_RUN: readonly CatRun[] = [
  [0, 0, [28, 28.5], [26.5, 29.5], [3.5, 27.5], [5, 28.5], [3.5, 9]],
  [1, 0, [23, 29.5], [25, 29.5], [6, 28], [8, 29], [3.5, 12]],
  [-1, 2, [17, 29.5], [19, 29], [14, 29.5], [12, 29], [4, 8]],
  [0, 1, [27, 25], [25, 26], [6, 29.5], [8, 29.5], [3.5, 10]],
];
export const CAT_IDLE: readonly CatPose[] = ["sit", "sit-tail"];

// A rabbit pose: body dy, stretch, ear tilt, hind foot dx, front paw [dx, dy].
export type RabbitPose = readonly [
  dy: number,
  stretch: number,
  tilt: number,
  hind: number,
  paw: Point,
];

// A brown cottontail rabbit side on in pose; a nose twitch shows on the idle's second frame (stretch
// -1).
export function cottontail(pose: RabbitPose): AnimalDraw {
  const [dy, stretch, tilt, hind, paw] = pose;
  return (g) => {
    const bx = 14 + stretch;
    g.rect(9 + hind, 29 + dy, 9, 1.5, "dbrown");
    g.cel(bx, 22 + dy, 7.5 + stretch, 6.5 - stretch * 0.5, "brown", "dbrown", "tan");
    g.cel(bx - 2, 24 + dy, 4.5, 4.5, "brown", "dbrown");
    g.rect(9 + hind, 28.5 + dy, 8, 1.5, "tan");
    g.ell(bx - 8, 20 + dy, 2.5, 2.5, "white");
    g.rect(bx + 4 + paw[0], 25 + dy + paw[1], 2, 5 - paw[1], "brown");
    g.rect(bx + 4 + paw[0], 29 + dy, 3, 1, "tan");
    const [hx, hy] = [bx + 9, 16 + dy];
    const top = hy - 12 + tilt * 1.5;
    bar(g, [hx - 2, hy - 2], [hx - 5 - tilt, top], 3, "brown");
    bar(g, [hx, hy - 2], [hx - 2 - tilt, top], 3, "brown");
    bar(g, [hx, hy - 3], [hx - 2 - tilt, top + 2], 1, "pink");
    g.cel(hx, hy, 4.5, 4, "brown", "dbrown", "tan");
    g.rect(hx + 1, hy - 1, 2, 2, "ink");
    g.rect(hx + 1, hy - 1, 1, 1, "white");
    g.rect(hx + 3.5, hy + 1 - (stretch < 0 ? 0.5 : 0), 1, 1, "pink");
    g.rect(hx - 1, hy + 2, 4, 1.5, "cream");
  };
}

// Idle: sat still, then the nose twitches and the ears tip back. Hop: crouched, launching stretched
// out, airborne at the top, landing on the front paws.
export const RABBIT_IDLE: readonly RabbitPose[] = [
  [0, 0, 0, 0, [0, 0]],
  [0, -1, 1, 0, [0, 0]],
];
export const RABBIT_HOP: readonly RabbitPose[] = [
  [0, -1, 2, 1, [0, 0]],
  [-3, 2, 3, -3, [3, -1]],
  [-5, 2, 4, -1, [3, -2]],
  [-1, 1, 0, 2, [2, 0]],
];

// A wing position: raised, spread or swept down.
export type Wing = "down" | "level" | "up";

// A robin side on, facing right. With no wing it stands on the lawn (peck tips its head to the
// ground); in flight, wing is up, level or down, the legs tucked and the body a little higher.
export function robin({
  peck = false,
  wing = null,
}: { peck?: boolean; wing?: Wing | null } = {}): AnimalDraw {
  return (g) => {
    const lift = wing ? -2 : 0;
    if (wing === null) {
      for (const x of [13, 17]) {
        g.rect(x, 25, 1, 5, "ochre");
        g.rect(x, 29, 3, 1, "ochre");
      }
    }
    const [cx, cy] = [15, 20 + lift];
    const [hx, hy] = peck ? [23, 22] : [21, 13];
    g.tri([8, cy - 2], [9, cy + 2], [2, cy - 5 + (peck ? 3 : 0)], "dbrown");
    g.cel(cx, cy, 8, 5.5, "brown", "dbrown", "tan");
    g.cel(cx + 3, cy + 1.5, 5, 4, "orange", "rust", "amber");
    g.cel(hx, hy + lift, 4.5, 4.5, "brown", "dbrown", "tan");
    g.cel(hx + 1.5, hy + lift + 2, 2.5, 2.5, "orange", "rust");
    g.rect(hx + 1, hy + lift - 1.5, 2, 2, "ink");
    g.rect(hx + 1, hy + lift - 1.5, 1, 1, "white");
    g.tri([hx + 4, hy + lift - 1], [hx + 4, hy + lift + 1], [hx + 7, hy + lift], "amber");
    if (wing === null) {
      g.cel(cx - 2, cy - 1, 5.5, 3.5, "dbrown", "plum", "brown");
    } else if (wing === "up") {
      g.tri([10, cy - 3], [18, cy - 3], [7, cy - 15], "dbrown");
      g.tri([11, cy - 3], [16, cy - 3], [9, cy - 11], "brown");
    } else if (wing === "level") {
      g.tri([10, cy - 3], [18, cy - 2], [1, cy - 6], "dbrown");
      g.tri([11, cy - 3], [17, cy - 2], [5, cy - 5], "brown");
    } else {
      g.tri([10, cy], [18, cy], [8, cy + 10], "dbrown");
      g.tri([11, cy], [16, cy], [10, cy + 7], "brown");
    }
  };
}

export const BIRD_IDLE: readonly AnimalDraw[] = [robin(), robin({ peck: true })];
export const BIRD_FLY: readonly AnimalDraw[] = [
  robin({ wing: "up" }),
  robin({ wing: "level" }),
  robin({ wing: "down" }),
  robin({ wing: "level" }),
];

// One frame of a lawn animal at scale s, outlined and rimmed.
export function animal(s: number, draw: AnimalDraw): Frame {
  const g = edged(new Mini(s, 32, 32));
  draw(g);
  return lit(g).outlined();
}

// The lawn animals at a depth step; idle first, so frame 0 is the rest pose.
export function* animals(suffix: string, step: number): Generator<Sprite> {
  const s = ANIMAL_SCALE * step;
  const tag = (name: string, draws: readonly AnimalDraw[], ms: number): Tag => [
    name,
    draws.map((d) => animal(s, d)),
    ms,
  ];
  yield [
    `ambient-cat${suffix}`,
    [tag("idle", CAT_IDLE.map(gingerCat), IDLE_MS), tag("run", CAT_RUN.map(gingerCat), RUN_MS)],
  ];
  yield [
    `ambient-rabbit${suffix}`,
    [
      tag("idle", RABBIT_IDLE.map(cottontail), IDLE_MS),
      tag("hop", RABBIT_HOP.map(cottontail), HOP_MS),
    ],
  ];
  yield [`ambient-bird${suffix}`, [tag("idle", BIRD_IDLE, IDLE_MS), tag("fly", BIRD_FLY, FLY_MS)]];
}

// ---------- the sky movers: full size only, facing right ----------

// A sky mover's grid, with one ink line round every fill.
export function skyGrid(w: number, h: number): Grid {
  return edged(new Grid(w, h), "ink");
}

// frame with c on each [x, y] of points, drawn past the outline: a line one pixel thin, such as a
// rope, a skid or a rotor blur, that an ink line round it would thicken.
export function over(c: string, points: Iterable<Point>, frame: Frame): Frame {
  for (const [x, y] of points) {
    frame[y]![x] = K[c] ?? c;
  }
  return frame;
}

// [x, y] for each x in xs.
function row(y: number, xs: Iterable<number>): Point[] {
  return [...xs].map((x) => [x, y] as const);
}

// The integers from a up to b - 1.
function range(a: number, b: number): number[] {
  return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
}

// The jet side on, facing right: a white fuselage over a grey belly with one row of windows, a
// rounded nose and cockpit glass, a swept red fin, the swept wing below with its engine, and the
// wingtip light and the belly beacon red (light) or flashing white.
export function plane(light: string): Frame {
  const g = skyGrid(26, 10);
  g.rect(2, 1, 2, 1, "red");
  g.rect(2, 2, 3, 1, "red");
  g.rect(3, 3, 3, 1, "red");
  g.rect(2, 4, 20, 1, "white");
  g.rect(3, 5, 20, 1, "white");
  g.rect(5, 6, 17, 1, "lgrey");
  g.p(22, 4, "lgrey");
  g.p(23, 5, "lgrey");
  g.rect(21, 4, 2, 1, "navy");
  for (let x = 7; x < 20; x += 2) {
    g.p(x, 5, "dslate");
  }
  g.rect(9, 7, 5, 1, "slate");
  g.rect(7, 8, 4, 1, "slate");
  g.rect(14, 7, 3, 1, "grey");
  g.p(7, 8, light);
  g.p(16, 6, light === "red" ? "hot" : "white");
  return g.outlined();
}

export const BALLOON_GORES: readonly string[] = ["red", "amber"];

// The hot air balloon: a teardrop envelope of seven curved gores, red and amber, shaded down its
// right side and glinting at its upper left, two ink ropes to a wicker basket, and the burner flaring
// (flame) or low, bobbed bob rows down.
export function balloon(bob: number, flame: boolean): Frame {
  const g = skyGrid(18, 26);
  const [cx, cy, r] = [9.0, 8.5, 7.5];
  for (let y = 1; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const [px, py] = [x + 0.5, y + 0.5];
      // A circle down to two rows below its centre, then a straight taper to the skirt.
      const half =
        py <= cy + 2
          ? Math.sqrt(Math.max(0, r * r - (py - cy) * (py - cy)))
          : (Math.sqrt(r * r - 4) * (18.5 - py)) / (16.5 - cy);
      if (half <= 0 || Math.abs(px - cx) > half) {
        continue;
      }
      const u = (px - cx) / half;
      const gore = Math.min(
        6,
        Math.trunc((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 7),
      );
      const c = K[BALLOON_GORES[gore % 2]!]!;
      g.p(x, y + bob, gore === 6 ? DARKER.get(c)! : c);
    }
  }
  g.rect(5, 3 + bob, 1, 2, "yellow");
  g.rect(7, 21 + bob, 4, 2, "brown");
  g.rect(7, 22 + bob, 4, 1, "dbrown");
  const out = over(
    "ink",
    [
      [7, 19 + bob],
      [10, 19 + bob],
    ],
    g.outlined(),
  );
  return flame
    ? over(
        "yellow",
        [
          [8, 19 + bob],
          [9, 19 + bob],
        ],
        out,
      )
    : over("orange", [[9, 19 + bob]], out);
}

// One pigeon seen as a chevron centred on (cx, cy): a slate body over a grey tail, its pale wings
// raised in a V (up), spread in a shallow one (level) or swept down.
export function pigeon(g: Drawable, cx: number, cy: number, wing: Wing): void {
  const rows = { down: [1, 1, 0], level: [-1, 0, 0], up: [-2, -1, 0] }[wing];
  rows.forEach((dy, i) => {
    g.p(cx - 3 + i, cy + dy, "lgrey");
    g.p(cx + 3 - i, cy + dy, "lgrey");
  });
  g.p(cx, cy, "slate");
  g.p(cx, cy + 1, "grey");
}

// Each pigeon's centre and wingbeat phase.
export const PIGEON_FLOCK: readonly (readonly [number, number, number])[] = [
  [5, 9, 1],
  [13, 4, 3],
  [17, 11, 2],
  [24, 6, 0],
  [30, 10, 2],
];
export const WINGBEAT: readonly Wing[] = ["up", "level", "down", "level"];

// Frame i of the pigeon flock: five grey chevrons in a loose straggle, each a different step through
// its wingbeat (up, level, down, level), so the flock shimmers.
export function pigeons(i: number): Frame {
  const g = skyGrid(36, 15);
  for (const [cx, cy, phase] of PIGEON_FLOCK) {
    pigeon(g, cx, cy, WINGBEAT[(i + phase) % 4]!);
  }
  return g.outlined();
}

// The helicopter side on, facing right: a red cabin with a glass bubble at the nose, a tapered tail
// boom to a fin, the main rotor a long blur (rotor 0) or a broken one (rotor 1) and the tail rotor a
// short blur, one pixel thin past the outline, skids under it, and the fin's beacon red when light.
export function helicopter(rotor: number, light: boolean): Frame {
  const g = skyGrid(26, 12);
  g.cel(15.5, 5.5, 6, 3, "red", "dred", "pink");
  g.rect(3, 4, 8, 1, "red");
  g.rect(5, 5, 6, 1, "dred");
  g.rect(2, 2, 2, 3, "red");
  g.p(2, 2, light ? "hot" : "dred");
  g.tri([16, 3], [21.5, 6], [16, 6], "foam");
  g.p(17, 4, "white");
  const out = over(
    "ink",
    [[13, 1], [12, 10], [18, 10], ...row(11, range(10, 22)), [22, 10]],
    g.outlined(),
  );
  if (rotor === 0) {
    over("lgrey", row(0, range(4, 23)), out);
    over("white", row(0, range(10, 17)), out);
    over(
      "lgrey",
      range(2, 6).map((y) => [0, y] as const),
      out,
    );
  } else {
    over("lgrey", row(0, [...range(6, 11), ...range(15, 20)]), out);
    over("white", row(0, range(11, 15)), out);
    over(
      "white",
      [
        [0, 3],
        [0, 4],
      ],
      out,
    );
  }
  return out;
}

// One Canada goose side on with its body's back row at (ox + 1, oy), facing right: a dark brown body
// and darker wing, a black tail, its neck a straight black line out to a black head with a white
// chinstrap, and its wing up, level or down.
export function goose(g: Drawable, ox: number, oy: number, wing: Wing): void {
  g.p(ox, oy, "ink");
  g.rect(ox + 1, oy, 5, 1, "dbrown");
  g.rect(ox + 2, oy + 1, 4, 1, "dbrown");
  g.rect(ox + 6, oy, 4, 1, "ink");
  g.p(ox + 8, oy + 1, "white");
  if (wing === "up") {
    g.p(ox + 3, oy - 1, "plum");
    g.p(ox + 2, oy - 2, "plum");
  } else if (wing === "down") {
    g.p(ox + 3, oy + 2, "plum");
    g.p(ox + 2, oy + 3, "plum");
  } else {
    g.rect(ox + 2, oy - 1, 3, 1, "plum");
  }
}

// Each goose's back-row origin and wingbeat phase.
export const GEESE_V: readonly (readonly [number, number, number])[] = [
  [25, 8, 0],
  [14, 5, 1],
  [3, 2, 2],
  [14, 11, 1],
  [3, 14, 2],
];

// Frame i of the geese: five in a V, the leader at the point on the right and two down each arm,
// each a step behind the one ahead in its wingbeat. They are drawn dark with no outline, as birds
// far off read against the dusk.
export function geese(i: number): Frame {
  const g = new Grid(36, 18);
  for (const [ox, oy, phase] of GEESE_V) {
    goose(g, ox, oy, WINGBEAT[(i + phase) % 4]!);
  }
  return g.outlined(false);
}

// The turboprop side on, facing right, on approach with its gear down: a white fuselage with a navy
// belly and one row of windows, a navy T-tail, the high wing along the roof with its engine hung
// forward, the propeller a tall slate disc with a blade bright at the top (blade 0) or the bottom
// (blade 1), and the belly beacon red when light.
export function turboprop(blade: number, light: boolean): Frame {
  const g = skyGrid(32, 12);
  g.rect(1, 1, 8, 1, "navy");
  g.rect(4, 2, 2, 3, "navy");
  g.p(6, 4, "navy");
  g.rect(3, 5, 25, 1, "white");
  g.rect(4, 6, 25, 1, "white");
  g.rect(6, 7, 23, 1, "navy");
  g.rect(26, 5, 2, 1, "navy");
  for (let x = 8; x < 25; x += 2) {
    g.p(x, 6, "dslate");
  }
  g.rect(12, 4, 9, 1, "grey");
  g.rect(18, 3, 6, 1, "white");
  g.rect(18, 4, 6, 1, "lgrey");
  g.rect(24, 1, 1, 8, "slate");
  g.rect(24, 1 + 5 * blade, 1, 3, "lgrey");
  g.p(12, 7, light ? "hot" : "navy");
  for (const x of [20, 27]) {
    g.p(x, 8, "dslate");
    g.p(x, 9, "navy");
  }
  return g.outlined();
}

// Frame f of the banner plane, side on, facing right: a small white high-wing plane with a red fin
// and wing, cyan cockpit glass and fixed gear, its propeller a slate disc with a blade bright at the
// top, then the bottom, towing a white banner of red lettering on a rope one pixel thin. The banner's
// tail ripples a pixel up and down, the wave travelling back along it.
export function bannerPlane(f: number): Frame {
  const g = skyGrid(39, 10);
  for (let x = 1; x < 17; x++) {
    const k = 16 - x;
    const dy = k > 7 ? Math.round(Math.sin(k * 0.5 - (f * Math.PI) / 2) * 0.6) : 0;
    g.rect(x, 2 + dy, 1, 6, "white");
    if (x >= 3 && x <= 14 && x !== 7 && x !== 11) {
      g.rect(x, 4 + dy, 1, 2, "red");
    }
  }
  g.rect(25, 1, 2, 3, "red");
  g.rect(25, 4, 11, 2, "white");
  g.rect(27, 6, 8, 1, "lgrey");
  g.rect(29, 3, 7, 1, "red");
  g.rect(32, 4, 2, 1, "cyan");
  g.p(36, 5, "grey");
  g.rect(37, 2, 1, 6, "slate");
  g.rect(37, 2 + 3 * (f % 2), 1, 3, "lgrey");
  const out = over("ink", row(5, range(18, 24)), g.outlined());
  return over(
    "ink",
    [
      [30, 8],
      [33, 8],
    ],
    out,
  );
}

// A gull seen head on, its wings bent at the wrist: raised in a V (up), in an M (level) or swept
// down.
export const GULL: Readonly<Record<Wing, readonly string[]>> = {
  down: ["", "", "..wwwwwww..", ".w..www..w.", "w....w....w"],
  level: ["", ".ww.....ww.", "w..ww.ww..w", "....www....", ".....w....."],
  up: ["w.........w", ".w.......w.", "..ww...ww..", "....www....", ".....w....."],
};
// Each gull's centre and wingbeat phase.
export const GULL_FLOCK: readonly (readonly [number, number, number])[] = [
  [6, 8, 0],
  [18, 4, 2],
  [29, 9, 1],
];

// Frame i of the gulls: three white gulls, larger than the pigeons and bent at the wrist, a grey tail
// and an amber beak each, each a different step through its wingbeat.
export function gulls(i: number): Frame {
  const g = skyGrid(36, 12);
  for (const [cx, cy, phase] of GULL_FLOCK) {
    bitmap(g, cx - 5, cy - 3, GULL[WINGBEAT[(i + phase) % 4]!], { w: "white" });
    g.p(cx, cy + 1, "lgrey");
    g.p(cx + 1, cy, "amber");
  }
  return g.outlined();
}

// A red-tailed hawk soaring, seen from below: brown head, dark leading edges and fingertips, cream
// wing linings, a dark belly band and the fanned rust tail.
export const HAWK: readonly string[] = [
  "..........bb..........",
  "..dddddddcbbcddddddd..",
  "kkcccccccccccccccccckk",
  ".k..ccccccddcccccc..k.",
  ".........cddc.........",
  "..........rr..........",
  ".........rrrr.........",
  "........rrrrrr........",
];
export const HAWK_COLOURS: Readonly<Record<string, string>> = {
  b: "brown",
  c: "cream",
  d: "dbrown",
  k: "plum",
  r: "rust",
};

// The hawk banking: tilt lifts its left wing (1) or its right (-1) a pixel at the tip, or holds it
// level (0).
export function hawk(tilt: number): Frame {
  const g = skyGrid(24, 10);
  HAWK.forEach((line, y) => {
    [...line].forEach((ch, x) => {
      if (Object.hasOwn(HAWK_COLOURS, ch)) {
        const dy = y < 5 ? Math.round((tilt * (x - 10.5)) / 11) : 0;
        g.p(x + 1, y + 1 + dy, HAWK_COLOURS[ch]!);
      }
    });
  });
  return g.outlined();
}

// Party balloons as [centre x, centre y, colour, phase]: each rises and falls a pixel out of step.
export const PARTY_BALLOONS: readonly (readonly [number, number, string, number])[] = [
  [4, 6.5, "red", 0],
  [8.5, 4.5, "sky", 2],
  [13, 6.5, "yellow", 1],
];

// Frame f of the party balloons: red, sky and yellow, each glinting at its upper left and bobbing a
// pixel out of step with the others, on ink strings that gather to one knot, its loose end swinging.
export function partyBalloons(f: number): Frame {
  const g = skyGrid(17, 27);
  const knots: Point[] = [];
  for (const [x, y, c, phase] of PARTY_BALLOONS) {
    const dy = [0, 0, 1, 1][(f + phase) % 4]!;
    g.ell(x, y + dy, 2.8, 3.5, c);
    g.p(x - 1.5, y - 1.5 + dy, "white");
    knots.push([Math.trunc(x), Math.trunc(y + dy + 4.5)]);
  }
  const out = g.outlined();
  const [tx, ty] = [8, 23];
  for (const [kx, ky] of knots) {
    const n = Math.max(Math.abs(tx - kx), Math.abs(ty - ky));
    for (let t = 0; t <= n; t++) {
      const x = Math.round(kx + ((tx - kx) * t) / n);
      const y = Math.round(ky + ((ty - ky) * t) / n);
      if (out[y]![x] === null) {
        out[y]![x] = K.ink!;
      }
    }
  }
  return over(
    "ink",
    [
      [8, 24],
      [8 + (f % 2), 25],
      [8, 26],
    ],
    out,
  );
}

// Frame f of the blimp, side on, facing right: a white envelope shaded lgrey down its lower right,
// red fins above and below its tail and a red one between them, a navy sign along its side whose
// amber lights chase toward the nose, and a gondola with cyan windows under it.
export function blimp(f: number): Frame {
  const g = skyGrid(31, 12);
  g.tri([0, 1], [5, 1], [8, 5], "red");
  g.tri([0, 10], [5, 10], [8, 6], "red");
  g.ell(16, 5.5, 14, 4.5, "white", "lgrey");
  g.tri([0, 5], [6, 5], [6, 6], "red");
  g.rect(8, 4, 15, 3, "navy");
  for (let x = 9; x < 22; x++) {
    if ((x - f) % 3 === 0) {
      g.p(x, 5, "amber");
    }
  }
  g.rect(13, 10, 6, 1, "lgrey");
  g.rect(14, 10, 4, 1, "cyan");
  return g.outlined();
}

// Frame f of the airliner far overhead, side on, facing right: a white fuselage with a blue fin, a
// slate wing and engine, and a white contrail one pixel thin behind it whose far end breaks into
// dashes that drift back.
export function airliner(f: number): Frame {
  const g = skyGrid(36, 7);
  g.rect(25, 1, 2, 3, "blue");
  g.rect(25, 3, 10, 2, "white");
  g.p(35, 4, "white");
  g.rect(29, 5, 3, 1, "slate");
  g.p(32, 3, "dslate");
  return over(
    "white",
    row(
      4,
      range(0, 23).filter((x) => x >= 8 || (x + f) % 3),
    ),
    g.outlined(),
  );
}

// A bat seen head on, an ink silhouette: ears and body between its wings, raised, spread with a
// scalloped trailing edge, or down.
export const BAT: Readonly<Record<Wing, readonly string[]>> = {
  down: ["", "", "...b.b...", "..bbbbb..", ".b.bbb.b.", "b...b...b"],
  level: ["", "", "...b.b...", "bb.bbb.bb", ".bbbbbbb.", ".b..b..b."],
  up: ["b.......b", "bb.b.b.bb", ".bbbbbbb.", "..bbbbb..", "....b...."],
};
// Each bat's centre and wingbeat phase.
export const BAT_FLOCK: readonly (readonly [number, number, number])[] = [
  [4, 7, 0],
  [15, 4, 1],
  [24, 8, 3],
];

// Frame i of the bats: three at dusk, each a step out of time with the next, fluttering a pixel up
// and down as it beats. Like the geese they are dark with no outline, in ink so they hold on every
// sky.
export function bats(i: number): Frame {
  const g = new Grid(29, 11);
  for (const [cx, cy, phase] of BAT_FLOCK) {
    const k = (i + phase) % 4;
    bitmap(g, cx - 4, cy - 4 + [0, -1, 0, 1][k]!, BAT[WINGBEAT[k]!], { b: "ink" });
  }
  return g.outlined(false);
}

// Frame f of the kite: a diamond quartered red and white, a red and white ribbon tail swaying down
// from it, the wave travelling down the tail, and its string one pixel thin down to the lower left.
export function kite(f: number): Frame {
  const g = skyGrid(17, 28);
  const [top, right, bottom, left, mid]: Point[] = [
    [10, 1],
    [15, 6],
    [10, 13],
    [5, 6],
    [10, 6],
  ];
  g.tri(top!, mid!, left!, "red");
  g.tri(top!, right!, mid!, "white");
  g.tri(left!, mid!, bottom!, "white");
  g.tri(mid!, right!, bottom!, "red");
  for (let k = 0; k < 12; k++) {
    const x = 10 + Math.round(Math.sin(k * 0.55 - (f * Math.PI) / 2) * Math.min(1.5, k / 3));
    g.p(x, 14 + k, Math.floor(k / 3) % 2 === 0 ? "red" : "white");
  }
  return over(
    "ink",
    range(9, 28).map((y) => [6 - Math.floor((y - 9) * 0.35), y] as const),
    g.outlined(),
  );
}

// The sky movers, each at full size only.
export function* skyMovers(): Generator<Sprite> {
  yield ["ambient-plane", [["fly", [plane("red"), plane("white")], PLANE_MS]]];
  yield [
    "ambient-balloon",
    [
      [
        "fly",
        (
          [
            [0, true],
            [0, false],
            [1, true],
            [1, false],
          ] as const
        ).map(([b, f]) => balloon(b, f)),
        BALLOON_MS,
      ],
    ],
  ];
  yield ["ambient-pigeons", [["fly", [0, 1, 2, 3].map(pigeons), PIGEON_MS]]];
  const blinks = [
    [0, true],
    [1, true],
    [0, false],
    [1, false],
  ] as const;
  yield [
    "ambient-helicopter",
    [["fly", blinks.map(([r, light]) => helicopter(r, light)), HELICOPTER_MS]],
  ];
  yield ["ambient-geese", [["fly", [0, 1, 2, 3].map(geese), GEESE_MS]]];
  yield [
    "ambient-turboprop",
    [["fly", blinks.map(([b, light]) => turboprop(b, light)), TURBOPROP_MS]],
  ];
  yield ["ambient-banner-plane", [["fly", [0, 1, 2, 3].map(bannerPlane), BANNER_PLANE_MS]]];
  yield ["ambient-gulls", [["fly", [0, 1, 2, 3].map(gulls), GULLS_MS]]];
  yield ["ambient-hawk", [["fly", [0, 1, 0, -1].map(hawk), HAWK_MS]]];
  yield ["ambient-party-balloons", [["fly", [0, 1, 2, 3].map(partyBalloons), PARTY_BALLOONS_MS]]];
  yield ["ambient-blimp", [["fly", [0, 1, 2, 3].map(blimp), BLIMP_MS]]];
  yield ["ambient-airliner", [["fly", [0, 1, 2, 3].map(airliner), AIRLINER_MS]]];
  yield ["ambient-bats", [["fly", [0, 1, 2, 3].map(bats), BATS_MS]]];
  yield ["ambient-kite", [["fly", [0, 1, 2, 3].map(kite), KITE_MS]]];
}

// Every ambient sprite at full size, then at every depth step, then the sky movers: [key, [[tag,
// frames, ms]]].
export function* sprites(): Generator<Sprite> {
  for (const [suffix, step] of [
    ["", 1] as const,
    ...STEPS.map(([k, v]) => [`@${k}`, v] as const),
  ]) {
    yield* pedestrians(suffix, step);
    yield* cars(suffix, step);
    yield* bikes(suffix, step);
    yield* animals(suffix, step);
  }
  yield* skyMovers();
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
