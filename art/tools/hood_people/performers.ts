// Neighbourhood performers and their bespoke movement poses.

import { scaled } from "../mini.ts";
import { type Drawable, edged, K, type Point, raster, rowScaleOf, scaleOf } from "../pixel.ts";
import {
  faceDisc,
  lean,
  LIT,
  person,
  PERSON_WALK,
  raisedArm,
  rim,
  type Rims,
  scope as roadScope,
  type WalkerPose,
} from "../road.ts";
import { bitmapAt, limb, range, scope } from "./primitives.ts";

// ---------- busker: facing the player, behind the open guitar case ----------

// A busker or strolling-busker idle pose: the strumming hand down (strum) and the head's nod.
export interface StrumPose {
  nod?: number;
  strum?: number;
}

// Strumming: the hand down over the sound hole, back up, down, up, the head nodding 1px on the
// second beat. 4 frames at 150ms.
export const BUSKER_IDLE: readonly StrumPose[] = [
  { strum: 0 },
  { strum: 1 },
  { nod: 1, strum: 0 },
  { nod: 1, strum: 1 },
];

export const BUSKER_IDLE_MS = 150;

const BUSKER = { legs: "blue", shoes: "dbrown" } as const;

const BUSKER_RIM: Rims = {
  ...LIT,
  blue: ["sky", null],
  dolive: ["olive", null],
  olive: ["moss", null],
};

// A note, drawn in the grid's own pixels so it keeps its strokes at any scale.
const NOTE: readonly string[] = ["..##", "..#.", "..#.", "###.", "##.."];

// NOTE with its top-left at design (x, y), one drawn pixel per character; a 1x2 dash below 1x.
function note(g: Drawable, x: number, y: number, c: string): void {
  const s = scaleOf(g);
  if (s < 1) {
    raster(g).rect(scaled(x, s), scaled(y, rowScaleOf(g)), 1, 2, c);
    return;
  }
  bitmapAt(g, NOTE, x, y, c);
}

// The busker's top for road.ts's person: the plaid shirt, the guitar across him, the fretting hand
// on its neck (screen right), the strumming hand over the sound hole (strum 1 lower), the bearded
// head (nod lowers it a row) and the open case in front of his legs.
function buskerTop(strum = 0, nod = 0): (g: Drawable, b: number) => void {
  return (g, b) => {
    const h = b + nod;
    // the plaid shirt, lit down its left side, checked in dolive
    g.rect(9, 21 + b, 14, 12, "olive");
    g.rect(20, 21 + b, 3, 12, "dolive");
    g.rect(9, 22 + b, 1, 10, "moss");
    for (const x of [12, 17]) {
      g.rect(x, 21 + b, 1, 12, "dolive");
    }
    g.rect(9, 24 + b, 14, 1, "dolive");
    // the fretting arm (screen right): the sleeve out to the elbow, the hand up on the neck
    g.rect(23, 22 + b, 4, 5, "olive");
    g.rect(26, 22 + b, 1, 5, "dolive");
    g.rect(24, 26 + b, 4, 3, "olive");
    g.rect(27, 26 + b, 1, 3, "dolive");
    // the guitar: the lower bout at his hip, the upper bout, the sound hole and bridge, the neck up
    // to screen right
    g.cel(13, 30.5 + b, 6.5, 4.5, "ochre", "rust", "tan");
    g.cel(18.5, 26.5 + b, 4.5, 3.5, "ochre", "rust", "tan");
    g.cel(17.5, 27.5 + b, 1.6, 1.6, "ink");
    g.rect(9, 31.5 + b, 4, 1, "ink");
    for (let k = 0; k < 6; k++) {
      g.rect(21 + k * 1.5, 25 - k + b, 2, 2, "plum");
    }
    g.rect(29, 18 + b, 2, 3, "plum");
    g.p(28, 18 + b, "lgrey");
    g.p(28, 20 + b, "lgrey");
    g.rect(25, 22 + b, 3, 3, "skin1");
    g.rect(27, 22 + b, 1, 3, "skin2");
    // the strumming arm (screen left): the sleeve to the elbow, the forearm across the guitar, the
    // hand over the sound hole, down a row on strum 1
    g.rect(5, 22 + b, 4, 6, "olive");
    g.rect(8, 22 + b, 1, 6, "dolive");
    g.rect(6, 28 + b, 5, 3, "olive");
    g.rect(9, 27 + b + strum, 4, 3, "olive");
    g.rect(9, 29 + b + strum, 4, 1, "dolive");
    g.rect(12, 26 + b + 2 * strum, 3, 3, "skin1");
    g.rect(12, 28 + b + 2 * strum, 3, 1, "skin2");
    // head: the face, a mop of curly brown hair, a short beard under the smile
    faceDisc(g, 16, 12.5 + h, 8, 8, "skin1", "skin2");
    g.cel(16, 8 + h, 9, 5.5, "dbrown", "plum", "brown");
    for (const [x, y] of [
      [9, 6],
      [16, 4],
      [23, 6],
      [8, 12],
      [24, 12],
    ] as const) {
      g.cel(x, y + h, 2.6, 2.6, "dbrown", "plum", "brown");
    }
    g.rect(7, 9 + h, 3, 6, "dbrown");
    g.rect(22, 9 + h, 3, 6, "dbrown");
    roadScope.faceFront(g, 16, 13 + h, { lips: "plum" });
    g.cel(16, 19.5 + h, 4.5, 1.8, "dbrown", "plum");
    // the open case lying at his feet, its red plush showing over the near side of the shell, a page
    // of sheet music and a cardboard sign with a note propped up in it
    g.rect(2, 39, 28, 2, "red");
    g.rect(2, 40, 28, 1, "dred");
    g.rect(4, 36, 6, 5, "white");
    g.rect(9, 36, 1, 5, "lgrey");
    // the page's staff and a note on it; a smaller page, too narrow for the note, keeps two staff
    // lines
    if (scaleOf(g) >= 1.3) {
      for (const y of [37, 38.5, 40]) {
        g.rect(4, y, 5, 0.67, "grey");
      }
      note(g, 5, 36.4, "ink");
    } else {
      for (const y of [37, 39]) {
        g.rect(5, y, 3, 1, "grey");
      }
    }
    g.rect(18, 34.5, 10, 6.5, "cream");
    g.rect(27, 34.5, 1, 6.5, "tan");
    note(g, 21, 35.5, "dbrown");
    g.rect(1, 41, 30, 4, "brown");
    g.rect(1, 41, 30, 1, "ochre");
    g.rect(1, 44, 30, 1, "dbrown");
    g.rect(28, 41, 2, 4, "dbrown");
    for (const x of [8, 23]) {
      g.rect(x, 42, 2, 1, "lgrey");
    }
  };
}

// The busker facing the player, with the road outline and the lit rim.
export function busker({
  bob = 0,
  nod = 0,
  strum = 0,
}: StrumPose & { bob?: number } = {}): Drawable {
  return rim(edged(person(buskerTop(strum, nod), { bob, ...BUSKER })), BUSKER_RIM);
}

// ---------- strolling-busker: facing the player, playing as he walks ----------

// A strolling-busker pose: the walk's legs and bob, the strum and nod, the flourish ("up", "down" or
// "out") and the rising note's top-left.
export interface StrollingPose extends StrumPose, WalkerPose {
  flourish?: string | null;
  note?: Point | null;
}

// Walking: PERSON_WALK at PERSON_WALK_MS, both hands on the guitar, the strumming hand down on each
// lifted foot and up as he passes over it. Idle: a bar between steps, the hand down and up with his
// head nodding 1px on the second beat, 4 frames at 150ms as the busker's. Cue: a strum flourish, the
// hand thrown up, swept down past the sound hole and flung out low, a note rising beside his hat, 4
// frames at 120ms.
export const STROLLING_WALK = PERSON_WALK;

export const STROLLING_IDLE: readonly StrollingPose[] = [
  { strum: 0 },
  { strum: 1 },
  { nod: 1, strum: 0 },
  { nod: 1, strum: 1 },
];

export const STROLLING_IDLE_MS = 150;

export const STROLLING_CUE: readonly StrollingPose[] = [
  { flourish: "up" },
  { flourish: "down", strum: 2 },
  { flourish: "out", note: [3, 13] },
  { flourish: "out", note: [2, 9] },
];

export const STROLLING_CUE_MS = 120;

const STROLLING = { legs: "brown", shoes: "dbrown" } as const;

const STROLLING_RIM: Rims = { ...LIT, green: ["lime", null], violet: ["lilac", null] };

// The strolling busker's top for road.ts's person: shaggy dark brown hair to the jaw under a violet
// felt hat with a pink band and a red feather, a plain lime shirt, a cherry-red guitar slung on a
// leather strap, the fretting hand on its neck (screen right) and the strumming hand over the sound
// hole (strum lowers it), or thrown up, down or out in the flourish. In a walk frame the swing of the
// free arms becomes the strum.
function strollingTop(
  strum = 0,
  nod = 0,
  flourish: string | null = null,
  noteAt: Point | null = null,
): (g: Drawable, b: number, arms?: number) => void {
  return (g, b, arms = 0) => {
    const h = b + nod;
    const down = strum + Math.abs(arms);
    // shaggy dark brown hair falling to the jaw behind the face, the neck under it
    g.rect(7, 10 + h, 4, 9, "dbrown");
    g.rect(21, 10 + h, 4, 9, "dbrown");
    g.rect(8, 19 + h, 2, 1, "dbrown");
    g.rect(22, 19 + h, 2, 1, "dbrown");
    g.rect(12, 18 + h, 8, 4, "skin1");
    // the lime shirt, lit down its left side, an open neck
    g.rect(9, 21 + b, 14, 12, "lime");
    g.rect(20, 21 + b, 3, 12, "green");
    g.rect(9, 22 + b, 1, 10, "yellow");
    g.rect(14, 21 + b, 4, 1, "skin1");
    g.rect(15, 22 + b, 2, 1, "skin1");
    // the fretting arm (screen right): the sleeve out to the elbow, the hand up on the neck
    g.rect(23, 22 + b, 4, 5, "lime");
    g.rect(26, 22 + b, 1, 5, "green");
    g.rect(24, 26 + b, 4, 3, "lime");
    g.rect(27, 26 + b, 1, 3, "green");
    // the leather strap from his left shoulder (screen right) down across his chest behind the
    // guitar
    for (let k = 0; k < 7; k++) {
      g.rect(21 - k * 1.5, 21 + k + b, 2, 1, "dbrown");
    }
    // the guitar: the cherry lower bout at his hip, the upper bout, the cream rosette round the
    // sound hole, then the dark neck up to screen right and its headstock
    g.cel(12.5, 31 + b, 6.5, 4.5, "red", "dred", "pink");
    g.cel(18, 27 + b, 4.5, 3.5, "red", "dred", "pink");
    g.cel(16.5, 28.5 + b, 2.2, 2.2, "cream");
    g.cel(16.5, 28.5 + b, 1.5, 1.5, "ink");
    for (let k = 0; k < 6; k++) {
      g.rect(21 + k * 1.5, 25 - k + b, 2, 2, "dbrown");
    }
    g.rect(29, 17 + b, 2, 4, "dbrown");
    g.p(28, 17 + b, "lgrey");
    g.p(28, 19 + b, "lgrey");
    g.rect(25, 22 + b, 3, 3, "skin1");
    g.rect(27, 22 + b, 1, 3, "skin2");
    // the strumming arm (screen left), the sleeve from the shoulder
    if (flourish === "up") {
      // thrown up: the arm raised beside the hat, the open hand high
      raisedArm(g, 4, 4, 13 + b, 23 + b, -1, [
        [3, "skin1", "skin2"],
        [8, "lime", "green"],
      ]);
    } else if (flourish === "out") {
      // flung out low after the chord, the open hand past his hip
      g.rect(5, 22 + b, 4, 6, "lime");
      g.rect(8, 22 + b, 1, 6, "green");
      g.rect(3, 27 + b, 4, 4, "lime");
      g.rect(6, 27 + b, 1, 4, "green");
      g.rect(1, 31 + b, 4, 3, "skin1");
      g.rect(1, 33 + b, 4, 1, "skin2");
    } else {
      g.rect(5, 22 + b, 4, 6, "lime");
      g.rect(8, 22 + b, 1, 6, "green");
      g.rect(6, 28 + b, 5, 3, "lime");
      g.rect(9, 27 + b + down, 4, 3, "lime");
      g.rect(9, 29 + b + down, 4, 1, "green");
      g.rect(12, 26 + b + 2 * down, 3, 3, "skin1");
      g.rect(12, 28 + b + 2 * down, 3, 1, "skin2");
    }
    if (noteAt) {
      note(g, noteAt[0], noteAt[1] + b, "white");
    }
    // head: the face framed by the hair, then the violet felt hat, its crown pinched, a pink band, a
    // red feather tucked in it and a brim turned up at the edges
    faceDisc(g, 16, 13 + h, 7.5, 7.5, "skin1", "skin2");
    g.rect(8, 9 + h, 3, 6, "dbrown");
    g.rect(21, 9 + h, 3, 6, "dbrown");
    roadScope.faceFront(g, 16, 13.5 + h, { lips: "plum" });
    g.cel(16, 6 + h, 6.5, 4, "violet", "purple", "lilac", 3);
    g.rect(14, 2 + h, 4, 1, "purple");
    g.rect(9.5, 7.5 + h, 13, 1.5, "pink");
    g.rect(5, 9 + h, 22, 1.5, "violet");
    g.rect(5, 10.5 + h, 22, 1, "purple");
    g.rect(4, 8 + h, 2, 2, "violet");
    g.rect(26, 8 + h, 2, 2, "purple");
    for (let k = 0; k < 4; k++) {
      g.p(21 + k * 0.75, 7 - k * 1.25 + h, "red");
    }
  };
}

// The strolling busker facing the player, with the road outline and the lit rim.
export function strollingBusker({
  flourish = null,
  nod = 0,
  note: noteAt = null,
  strum = 0,
  ...q
}: StrollingPose = {}): Drawable {
  return rim(
    edged(person(strollingTop(strum, nod, flourish, noteAt), { ...STROLLING, ...q })),
    STROLLING_RIM,
  );
}

// ---------- stilt-walker: a Pedestrian Sunday performer on stilts, facing the player ----------

// The stilt walker's design grid: 32 columns by STILT_ROWS, so 48x96 at SCALE, a third taller than
// the other movers' 48x72 so it stands a head and a half over them.
const STILT_ROWS = 64;

// The planted shoes' top row and each leg's left column (screen left, then screen right).
const STILT_SHOE = 60;

const STILT_LEGS: readonly [number, number] = [8, 18];

// The trousers' three bold stripes on each leg, from screen left, and their shade down the right
// column.
const STILT_STRIPES: readonly [string, string, string] = ["yellow", "violet", "yellow"];

const STILT_SHADE = "amber";

// Each arm pose's gloves, [screen left, screen right], on the design grid before the sway and the
// bob.
const STILT_ARMS: Readonly<Record<string, readonly [Point, Point]>> = {
  in: [
    [4, 31],
    [28, 31],
  ],
  "left-low": [
    [3.5, 29],
    [28.5, 12],
  ],
  out: [
    [3, 22],
    [29, 22],
  ],
  "right-low": [
    [3.5, 12],
    [28.5, 29],
  ],
  v: [
    [3, 8],
    [29, 8],
  ],
  wave: [
    [3.5, 29],
    [27.5, 4],
  ],
  "wave-out": [
    [3.5, 29],
    [30, 6],
  ],
};

// A stilt-walker pose: each shoe's lift (negative is up), the body's bob and sway and the arms'
// STILT_ARMS pose.
export interface StiltPose {
  arms?: string;
  bob?: number;
  lf?: number;
  rf?: number;
  sway?: number;
}

// Walking: a stilted high-knee step, each foot lifted 8 rows in turn and set down through 2, the body
// swaying 1px over the planted leg and the arms swinging out against the legs. Idle: waving the
// screen-right glove beside the hat, swaying. Cue: the wind-up before each step, the arms dropped to
// the sides as the body sinks, then swung up into a V as the first knee lifts.
export const STILT_WALK: readonly StiltPose[] = [
  { arms: "left-low", lf: -8, sway: 1 },
  { arms: "out", bob: -1, lf: -2 },
  { arms: "right-low", rf: -8, sway: -1 },
  { arms: "out", bob: -1, rf: -2 },
];

export const STILT_WALK_MS = 150;

export const STILT_IDLE: readonly StiltPose[] = [{ arms: "wave" }, { arms: "wave-out", sway: 1 }];

export const STILT_IDLE_MS = 300;

export const STILT_CUE: readonly StiltPose[] = [
  { arms: "in", bob: 1 },
  { arms: "out" },
  { arms: "v", bob: -1, lf: -3 },
];

export const STILT_CUE_MS = 120;

const STILT_RIM: Rims = { ...LIT, cobalt: ["azure", null], violet: ["lilac", null] };

// The stilt walker facing the player: yellow and violet striped trousers down over the stilts to big
// black shoes, an oversized patched denim jacket, white gloves, a red bow tie, curly orange hair and a
// green top hat with a pink band and a daisy. lf and rf lift each shoe (negative is up), bob lifts the
// body, sway moves the body above the legs sideways and arms names the gloves' pose in STILT_ARMS.
export function stiltWalker({
  arms = "out",
  bob = 0,
  lf = 0,
  rf = 0,
  sway = 0,
}: StiltPose = {}): Drawable {
  const g = edged(scope.Grid(32, STILT_ROWS));
  const b = bob;
  const o = sway;
  // the legs: each a trouser leg of three bold stripes from under the jacket to a flared cuff, a
  // lifted one shorter with its knee bent up toward the player, then a big black shoe
  for (const [x, f] of [
    [STILT_LEGS[0], lf],
    [STILT_LEGS[1], rf],
  ] as const) {
    const top = 33 + b;
    const foot = STILT_SHOE + f;
    STILT_STRIPES.forEach((c, k) => {
      g.rect(x + 2 * k, top, 2, foot - top, c);
    });
    g.rect(x + 5, top, 1, foot - top, STILT_SHADE);
    g.rect(x - 1, foot - 3, 1, 3, STILT_STRIPES[0]);
    g.rect(x + 6, foot - 3, 1, 3, STILT_SHADE);
    if (f <= -4) {
      // the bent knee pushed toward the player: the leg 1 column wider each side over it, a crease
      // under it
      const knee = Math.round(top + (foot - top) * 0.4);
      g.rect(x - 1, knee - 1, 1, 3, STILT_STRIPES[0]);
      g.rect(x + 6, knee - 1, 1, 3, STILT_SHADE);
      g.rect(x, knee + 2, 6, 1, STILT_SHADE);
    }
    g.cel(x + 3, foot + 1.5, 4, 1.6, "ink", "ink", "dslate", 3);
  }
  // the oversized denim jacket, broad shoulders to a band at the hips, lit down its left edge
  g.rect(6 + o, 20 + b, 20, 14, "azure");
  g.rect(23 + o, 20 + b, 3, 14, "cobalt");
  g.rect(6 + o, 21 + b, 1, 11, "sky");
  g.rect(6 + o, 32 + b, 20, 2, "cobalt");
  // the open front over a yellow shirt, its lapels and gold buttons
  g.tri([12 + o, 20 + b], [20 + o, 20 + b], [16 + o, 28 + b], "yellow");
  g.rect(15.5 + o, 28 + b, 1, 4, "cobalt");
  for (const y of [29, 31]) {
    g.p(14 + o, y + b, "gold");
  }
  // the patches: red on the left breast, lime on the left shoulder, gold low on the right
  for (const [x, y, c] of [
    [7.5, 25, "red"],
    [8, 21, "lime"],
    [19.5, 28, "gold"],
  ] as const) {
    g.rect(x + o, y + b, 3, 3, c);
  }
  // the neck and the red bow tie
  g.rect(13 + o, 18 + b, 6, 2, "skin1");
  g.tri([11.5 + o, 18.5 + b], [11.5 + o, 22.5 + b], [16 + o, 20.5 + b], "red");
  g.tri([20.5 + o, 18.5 + b], [20.5 + o, 22.5 + b], [16 + o, 20.5 + b], "red");
  g.rect(15 + o, 19.5 + b, 2, 2, "dred");
  // the arms: denim sleeves from the shoulders, each to a white glove
  const gloves = STILT_ARMS[arms]!;
  for (const [[sx, sy], [hx, hy]] of [
    [[8, 22], gloves[0]],
    [[24, 22], gloves[1]],
  ] as const) {
    limb(g, sx + o, sy + b, hx + o, hy + b, 4, [[1, "cobalt"]]);
    limb(g, sx - 0.5 + o, sy + b, hx - 0.5 + o, hy + b, 3, [[1, "azure"]]);
    g.cel(hx + o, hy + b, 2.2, 2.2, "white", "lgrey");
  }
  // the big friendly face: curly orange hair out at the sides, rosy cheeks and a wide smile
  for (const cx of [8.5, 23.5]) {
    g.cel(cx + o, 13 + b, 2.5, 3.5, "orange", "rust", "amber");
  }
  faceDisc(g, 16 + o, 13 + b, 7, 6.5, "skin1", "skin2");
  roadScope.faceFront(g, 16 + o, 12 + b, { lips: "dred" });
  for (const x of [10, 21]) {
    g.p(x + o, 15 + b, "pink");
  }
  // the green top hat: its tall crown, a pink band with a daisy, and the brim
  g.rect(10.5 + o, 2 + b, 11, 6, "green");
  g.rect(19.5 + o, 2 + b, 2, 6, "dgreen");
  g.rect(10.5 + o, 2 + b, 1, 5, "lime");
  g.rect(10.5 + o, 6 + b, 11, 1.5, "pink");
  g.cel(13 + o, 6.5 + b, 1.6, 1.6, "white");
  g.p(13 + o, 6.5 + b, "amber");
  g.rect(7 + o, 7.5 + b, 18, 1.5, "green");
  g.rect(7 + o, 8.5 + b, 18, 1, "dgreen");
  return rim(g, STILT_RIM);
}

// ---------- sign-spinner: facing the player, twirling an arrow sign between hops ----------

// The arrow sign, pointing right, about its pivot (the hands, at the centre of the board): [along,
// across] corners in design pixels. The board is yellow, rimmed red, its arrow shape the only mark on
// it.
const SIGN_BOARD: readonly Point[] = [
  [-10, -3],
  [2, -3],
  [2, -6.5],
  [11, 0],
  [2, 6.5],
  [2, 3],
  [-10, 3],
];

const SIGN_FACE: readonly Point[] = [
  [-8.3, -1.3],
  [3.6, -1.3],
  [3.6, -3.4],
  [8.2, 0],
  [3.6, 3.4],
  [3.6, 1.3],
  [-8.3, 1.3],
];

// Where the hands hold the sign, in front of the hips.
const SIGN_PIVOT: Point = [16, 32];

// A sign-spinner pose: the sign's turn in degrees, the bob and the feet's lift.
export interface SpinnerPose {
  bob?: number;
  lf?: number;
  rf?: number;
  turn?: number;
}

// The twirl: the sign turned 45 degrees a frame, anticlockwise on screen, a full turn in 8 frames at
// 120ms; the fast spin before each hop turns it 90 degrees a frame, 4 frames at 60ms, the knees bent
// 1px for the hop.
export const SPINNER_IDLE: readonly SpinnerPose[] = range(0, 8).map((k) => ({ turn: 45 * k }));

export const SPINNER_IDLE_MS = 120;

export const SPINNER_CUE: readonly SpinnerPose[] = range(0, 4).map((k) => ({
  bob: 1,
  turn: 90 * k,
}));

export const SPINNER_CUE_MS = 60;

// The hop sideways across a lane, the sign held level pointing the way (the game mirrors the sprite
// for a hop to the left): crouched, pushing off stretched, tucked at the top with the feet drawn up
// under the body, reaching down to land. The head clears the frame's top by a row at the top of the
// hop.
export const SPINNER_HOP: readonly SpinnerPose[] = [
  { bob: 1 },
  { bob: -2, lf: -2, rf: -2 },
  { bob: -2, lf: -6, rf: -6 },
  { bob: -1, lf: -3, rf: -3 },
];

export const SPINNER_HOP_MS = 75;

const SPINNER = { legs: "dslate", shoes: "white" } as const;

const SPINNER_RIM: Rims = { ...LIT, cobalt: ["azure", null] };

// points [along, across] turned turn degrees anticlockwise on screen about SIGN_PIVOT, raised b rows.
function turned(points: readonly Point[], turn: number, b: number): Point[] {
  const a = turn * (Math.PI / 180);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const [x0, y0] = SIGN_PIVOT;
  return points.map(([u, v]) => [x0 + u * c + v * s, y0 + b - u * s + v * c] as const);
}

// A polygon that is convex but for its arrow's notches, filled as triangles: the shaft's two corners
// with the head's root, then the head.
function fan(g: Drawable, pts: readonly Point[], c: string): void {
  const [t0, s0, h0, tip, h1, s1, t1] = pts as [Point, Point, Point, Point, Point, Point, Point];
  g.tri(t0, s0, s1, c);
  g.tri(t0, s1, t1, c);
  g.tri(h0, tip, h1, c);
}

// The arrow sign turned turn degrees: a red board with a yellow face inset, the face shaded amber
// along its lower and right edges against the red. Drawn under 1x, the face is its shaft alone, so
// the head stays a solid red point: an inset head that small rasterizes as a bar across the shaft and
// reads as a cross.
function arrowSign(g: Drawable, turn: number, b: number): void {
  fan(g, turned(SIGN_BOARD, turn, b), "red");
  if (scaleOf(g) >= 1) {
    fan(g, turned(SIGN_FACE, turn, b), "yellow");
  } else {
    const [t0, s0, s1, t1] = turned(
      [...SIGN_FACE.slice(0, 2), ...SIGN_FACE.slice(-2)],
      turn,
      b,
    ) as [Point, Point, Point, Point];
    g.tri(t0, s0, s1, "yellow");
    g.tri(t0, s1, t1, "yellow");
  }
  const px = raster(g);
  const yellow = K.yellow!;
  const red = K.red!;
  const shade: [number, number][] = [];
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (
        px.px[y]![x] === yellow &&
        (
          [
            [1, 0],
            [0, 1],
          ] as const
        ).some(
          ([dx, dy]) =>
            y + dy >= 0 &&
            y + dy < px.h &&
            x + dx >= 0 &&
            x + dx < px.w &&
            px.px[y + dy]![x + dx] === red,
        )
      ) {
        shade.push([x, y]);
      }
    }
  }
  for (const [x, y] of shade) {
    px.px[y]![x] = K.amber!;
  }
}

// The sign spinner's top for road.ts's person: the bright azure tee, both arms down and in to the
// sign's middle, the head in a red cap and black sunglasses, then the sign in front of the hips and
// the hands over it.
function spinnerTop(turn = 0): (g: Drawable, b: number) => void {
  return (g, b) => {
    // the tee, shaded down its right side, a white crew neck
    g.rect(9, 21 + b, 14, 13, "azure");
    g.rect(20, 21 + b, 3, 13, "cobalt");
    g.rect(14, 21 + b, 4, 1, "white");
    // short sleeves, then the bare forearms reaching down and in to the middle of the sign
    const [x0, y0] = SIGN_PIVOT;
    for (const [x, k] of [
      [5, 1],
      [23, -1],
    ] as const) {
      g.rect(x, 22 + b, 4, 4, "azure");
      g.rect(x + 3, 22 + b, 1, 4, "cobalt");
      const wrist = k > 0 ? x0 - 3 : x0 + 3;
      g.tri([x, 26 + b], [x + 4, 26 + b], [wrist + 1.5, y0 + b], "skin2");
      g.tri([x, 26 + b], [wrist + 1.5, y0 + b], [wrist - 1.5, y0 + b], "skin2");
    }
    // head: the neck, the face under a red cap with its brim to the player
    g.rect(14, 19 + b, 4, 3, "skin2");
    faceDisc(g, 16, 12.5 + b, 8, 8, "skin2", "brown");
    g.cel(16, 7 + b, 8.5, 4.5, "red", "dred", "pink");
    g.rect(7.5, 9 + b, 17, 2, "dred");
    g.rect(15, 3 + b, 2, 1.5, "white");
    // black sunglasses across the eyes, a glint on each lens, and a smile under them
    g.rect(9, 12.5 + b, 14, 2.5, "ink");
    g.rect(15, 12.5 + b, 2, 1, "slate");
    g.p(10.5, 12.5 + b, "white");
    g.p(18.5, 12.5 + b, "white");
    g.p(14, 17 + b, "dbrown");
    g.p(17, 17 + b, "dbrown");
    g.rect(15, 18 + b, 2, 1, "dbrown");
    // the sign, then the hands, one over the other, gripping it by the middle
    arrowSign(g, turn, b);
    g.cel(x0, y0 + b, 2.2, 1.7, "skin2", "brown");
  };
}

// The sign spinner facing the player, with the road outline and the lit rim.
export function signSpinner({ bob = 0, lf = 0, rf = 0, turn = 0 }: SpinnerPose = {}): Drawable {
  return rim(edged(person(spinnerTop(turn), { bob, lf, rf, ...SPINNER })), SPINNER_RIM);
}

// ---------- hopscotch-kid: a kid hopping on one foot, facing the player ----------

// A hopscotch-kid pose: the bob, the standing foot's lift, the hands' rise and see-saw, the bent
// leg's kick, the ponytail's drop and the lean at the head.
export interface KidPose {
  arms?: number;
  bob?: number;
  foot?: number;
  kick?: number;
  sway?: number;
  tail?: number;
  tilt?: number;
}

// The hop sideways across a lane on the one foot: crouched on it, pushing off with the arms flung up,
// at the top with the foot tucked up and the ponytail floating, landing crouched on the same foot.
// The game mirrors the sprite for a hop to the left.
export const KID_HOP: readonly KidPose[] = [
  { arms: -1, bob: 2, kick: -1 },
  { arms: 2, bob: -2, foot: -2, kick: 1, sway: 1, tail: 1 },
  { arms: 3, bob: -4, foot: -5, kick: 2, sway: 1, tail: -1 },
  { arms: 1, bob: 1, tail: 1 },
];

export const KID_HOP_MS = 75;

// Balancing on the one foot between hops: the arms see-saw and the body wobbles 1px each way.
export const KID_IDLE: readonly KidPose[] = [
  { sway: -1, tilt: 1 },
  { sway: 1, tilt: -1 },
];

export const KID_IDLE_MS = 300;

// The wind-up before each hop, played once over 600ms: the arms swing down as the knee dips, then up
// as it straightens to go.
export const KID_CUE: readonly KidPose[] = [
  { arms: -2, bob: 1 },
  { arms: -4, bob: 2, kick: -1 },
  { arms: 1, bob: 1 },
];

export const KID_CUE_MS = 200;

const KID_RIM: Rims = { ...LIT, cobalt: ["azure", null] };

// How many rows lower than road.ts's person's adults the kid's hips, top and head sit, its legs that
// much shorter.
const KID_DROP = 2;

// White stripes across the pink top, lgrey over its mauve shade: every third drawn row from the
// collar, at least every other one, so they stay even at every size.
function kidStripes(g: Drawable, light: string, shade: string, b: number): void {
  const px = raster(g);
  const s = scaleOf(g);
  const period = Math.max(2, Math.floor(3 * s + 0.5));
  const top = Math.floor((23 + b) * s + 0.5);
  for (let y = top; y < px.h; y++) {
    if ((y - top) % period !== period - 1) {
      continue;
    }
    for (let x = 0; x < px.w; x++) {
      const c = px.px[y]![x];
      if (c === K.pink) {
        px.px[y]![x] = K[light]!;
      } else if (c === K.mauve) {
        px.px[y]![x] = K[shade]!;
      }
    }
  }
}

// A kid hopping on one foot facing the player, drawn shorter than road.ts's person's adults: the
// standing leg (screen left) lifted foot rows by a hop, the other bent up behind, its sneaker kick
// rows higher; the arms out for balance, the hands arms rows up, see-sawing tilt rows; the ponytail
// tail rows down; the body leaning sway pixels at the head. The road outline and the lit rim.
export function hopscotchKid({
  arms = 0,
  bob = 0,
  foot = 0,
  kick = 0,
  sway = 0,
  tail = 0,
  tilt = 0,
}: KidPose = {}): Drawable {
  let g = edged(scope.Grid(32, 48));
  // the body sits KID_DROP rows lower than an adult's, the legs shorter
  const b = bob + KID_DROP;
  // the bent leg behind: the shin folded up from the knee, the sneaker's sole to the player beside
  // the skirt
  const knee: Point = [19.5, 38.5 + b];
  const heel: Point = [23.5, 35 + b - kick];
  volleyBar(g, knee, heel, 2.6, "skin2");
  g.cel(24, 34 + b - kick, 2.2, 2, "white", "lgrey");
  g.rect(23, 35 + b - kick, 3, 1, "lgrey");
  g.rect(17.5, 35 + b, 3, 3.5, "skin1");
  g.rect(19.5, 35 + b, 1, 3.5, "skin2");
  g.cel(19, 38.5 + b, 1.6, 1.2, "skin1", "skin2");
  // the standing leg, white ankle socks and a white sneaker with a pink toe
  g.rect(12.5, 35 + b, 3, 8 + foot - b, "skin1");
  g.rect(14.5, 35 + b, 1, 8 + foot - b, "skin2");
  g.rect(12.5, 41.5 + foot, 3, 1.5, "white");
  g.rect(11.5, 43 + foot, 5, 2, "white");
  g.rect(11.5, 44 + foot, 5, 1, "lgrey");
  g.rect(11.5, 43 + foot, 1.5, 1, "pink");
  // the skirt, azure and flared, a pleat shaded down each side of the middle
  g.rect(10, 30 + b, 12, 2, "azure");
  g.tri([10, 31.5 + b], [22, 31.5 + b], [7, 36.5 + b], "azure");
  g.tri([10, 31.5 + b], [22, 31.5 + b], [25, 36.5 + b], "azure");
  g.rect(8.5, 31.5 + b, 15, 5, "azure");
  g.tri([19, 31.5 + b], [22, 31.5 + b], [25, 36.5 + b], "cobalt");
  g.rect(13, 32 + b, 1, 4.5, "cobalt");
  g.rect(17.5, 32 + b, 1, 4.5, "cobalt");
  // the arms out for balance, short pink sleeves, the hands see-sawing
  for (const [sx, hx, t] of [
    [10.5, 3.5, tilt],
    [21.5, 28.5, -tilt],
  ] as const) {
    const hand: Point = [hx, 23.5 + b - arms - t];
    volleyBar(g, [sx, 24.5 + b], hand, 2.6, "skin2");
    volleyBar(g, [sx, 24 + b], [hand[0], hand[1] - 0.5], 1.6, "skin1");
    g.cel(hand[0], hand[1], 1.6, 1.6, "skin1", "skin2");
  }
  // the striped top: pink, its right side mauve, white stripes, a round white collar
  g.rect(10, 23 + b, 12, 8, "pink");
  g.rect(19, 23 + b, 3, 8, "mauve");
  for (const x of [7.5, 21.5]) {
    g.cel(x + 1.5, 24.5 + b, 2.5, 2, "pink", "mauve");
  }
  kidStripes(g, "white", "lgrey", b);
  g.rect(13.5, 23 + b, 5, 1, "white");
  // the head: the face, auburn hair with a fringe, a high ponytail tied with a yellow scrunchie
  g.rect(14.5, 21 + b, 3, 2.5, "skin2");
  g.cel(7, 9.5 + b + tail, 3.5, 2.6, "rust", "dbrown", "ochre");
  g.cel(5, 12.5 + b + tail, 2, 2.6, "rust", "dbrown");
  faceDisc(g, 16, 16 + b, 6.5, 6, "skin1", "skin2");
  g.cel(16, 12.5 + b, 7.5, 4.5, "rust", "dbrown", "ochre");
  g.rect(8.5, 12.5 + b, 15, 2, "rust");
  g.rect(21, 12.5 + b, 2.5, 2, "dbrown");
  g.rect(8.5, 13.5 + b, 1.5, 4, "rust");
  g.rect(22, 13.5 + b, 1.5, 4, "dbrown");
  g.cel(10.5, 9 + b, 2, 1.6, "yellow", "amber");
  roadScope.faceFront(g, 16, 16 + b, { mouth: 3, spread: 3 });
  g.p(11.5, 19 + b, "pink");
  g.p(20.5, 19 + b, "pink");
  if (sway) {
    g = lean(g, sway);
  }
  return rim(g, KID_RIM);
}

// ---------- volleyball-player: side on, darting across the road after a ball ----------

// A volleyball-player frame: the VOLLEY_POSES key, the bob and the ponytail's swing.
export interface VolleyFrame {
  bob?: number;
  pose?: string;
  tail?: number;
}

// Running across: the near leg reaching forward to plant as the far foot kicks up behind, the far
// knee coming through under the body (1px higher), the same on the other side; the arms pump against
// the legs. 4 frames at 100ms, social-frisbee-dog's run.
export const VOLLEY_RUN: readonly VolleyFrame[] = [
  { pose: "run-reach", tail: 0 },
  { bob: -1, pose: "run-pass", tail: 1 },
  { pose: "run-kick", tail: 0 },
  { bob: -1, pose: "run-tuck", tail: 1 },
];

export const VOLLEY_RUN_MS = 100;

// Diving one lane: the push off, arms out low after the ball; flat out in the air, the near forearm
// under it; the belly landing, the ball popped up off the fist and the sand kicked up; the slide, the
// ball going up out of the frame and the sand flying. 4 frames at 90ms, about the time the dart takes
// to cross a lane.
export const VOLLEY_DIVE: readonly VolleyFrame[] = [
  "dive-launch",
  "dive-fly",
  "dive-land",
  "dive-slide",
].map((p) => ({ pose: p }));

export const VOLLEY_DIVE_MS = 90;

// Lying where they landed, on the belly, propped on the elbows with the feet up behind: at rest, a
// breath (the head and shoulders 1px higher), then a thumbs up held over two frames, a breath on the
// second. 4 frames at 400ms, frame 0 the rest pose.
export const VOLLEY_IDLE: readonly VolleyFrame[] = [
  { pose: "lie" },
  { bob: -1, pose: "lie" },
  { pose: "lie-thumb" },
  { bob: -1, pose: "lie-thumb" },
];

export const VOLLEY_IDLE_MS = 400;

// A limb's two joints: [elbow, hand] for an arm, [knee, foot] for a leg.
type Joints = readonly [Point, Point];

// A volleyball-player pose's joints in design units, side on facing right.
interface VolleyPose {
  ball?: Point;
  farArm: Joints;
  farLeg: Joints;
  front?: boolean;
  head: Point;
  hip: Point;
  nearArm: Joints;
  nearLeg: Joints;
  sand?: readonly (readonly [number, number, number])[];
  sh: Point;
  thumb?: boolean;
}

// Every pose's joints in design units, side on facing right: the hip, the shoulder and the head's
// centre, the near and far arms as [elbow, hand] and legs as [knee, foot], the ball's centre (none for
// no ball) and the sand thrown up as [x, y, r] puffs. A foot on row 43.5 or lower is planted on the
// road and stays put under a bob. Every limb, ball and puff keeps clear of the frame's sides, so the
// outline closes round it at every step. front turns the face to the player, as the lying player does
// to give the thumbs up.
const VOLLEY_LAND = {
  farArm: [
    [21.5, 42.2],
    [27.5, 42.5],
  ],
  head: [21.5, 35],
  hip: [8.5, 41],
  nearArm: [
    [21.5, 43.2],
    [28, 43.5],
  ],
  sh: [15.5, 40.5],
} as const satisfies Partial<VolleyPose>;

const VOLLEY_LIE = {
  farArm: [
    [17.5, 43],
    [24.5, 43],
  ],
  farLeg: [
    [3.5, 43],
    [6, 37],
  ],
  front: true,
  head: [19.5, 33.5],
  hip: [8, 41.5],
  nearLeg: [
    [3, 43.5],
    [3.5, 37],
  ],
  sh: [15, 40],
} as const satisfies Partial<VolleyPose>;

const VOLLEY_POSES: Readonly<Record<string, VolleyPose>> = {
  "dive-fly": {
    ball: [27, 36],
    farArm: [
      [21, 38.5],
      [25.5, 39],
    ],
    farLeg: [
      [4, 38.5],
      [4, 33.5],
    ],
    head: [20.5, 31.5],
    hip: [8.5, 37],
    nearArm: [
      [21, 39.5],
      [26, 40],
    ],
    nearLeg: [
      [3.5, 37.5],
      [2.5, 32.5],
    ],
    sh: [15, 36.5],
  },
  "dive-land": {
    ...VOLLEY_LAND,
    ball: [27, 26],
    farLeg: [
      [3.5, 43],
      [4, 39],
    ],
    nearLeg: [
      [3, 43.5],
      [2.5, 38],
    ],
    sand: [
      [30, 42.5, 1.3],
      [29.5, 39, 1],
    ],
  },
  "dive-launch": {
    ball: [27, 40.5],
    farArm: [
      [22.5, 32],
      [27, 36.5],
    ],
    farLeg: [
      [14, 38],
      [11, 43.5],
    ],
    head: [21.5, 22],
    hip: [10, 33],
    nearArm: [
      [22, 33],
      [26.5, 37.5],
    ],
    nearLeg: [
      [6, 38],
      [2.5, 43.5],
    ],
    sh: [16.5, 28.5],
  },
  "dive-slide": {
    ...VOLLEY_LAND,
    ball: [25.5, 15],
    farLeg: [
      [3.5, 43],
      [4.5, 38],
    ],
    nearLeg: [
      [3, 43.5],
      [3, 37],
    ],
    sand: [
      [30, 40.5, 1.2],
      [29.5, 36.5, 1.1],
      [30.5, 33, 0.8],
      [27.5, 31.5, 0.7],
    ],
  },
  lie: {
    ...VOLLEY_LIE,
    nearArm: [
      [18, 43.5],
      [25, 43.5],
    ],
  },
  "lie-thumb": {
    ...VOLLEY_LIE,
    nearArm: [
      [27, 43],
      [29, 37],
    ],
    thumb: true,
  },
  "run-kick": {
    farArm: [
      [13, 26.5],
      [11, 30],
    ],
    farLeg: [
      [19.5, 36.5],
      [21, 43.5],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [20.5, 26],
      [23.5, 23],
    ],
    nearLeg: [
      [12.5, 37.5],
      [8, 39.5],
    ],
    sh: [17, 22],
  },
  "run-pass": {
    farArm: [
      [17.5, 27.5],
      [20, 30],
    ],
    farLeg: [
      [19.5, 35],
      [15, 39],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [15, 27.5],
      [17.5, 30],
    ],
    nearLeg: [
      [16.5, 37.5],
      [16, 44.5],
    ],
    sh: [17, 22],
  },
  "run-reach": {
    farArm: [
      [20.5, 26],
      [23.5, 23],
    ],
    farLeg: [
      [12.5, 37.5],
      [8, 39.5],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [13, 26.5],
      [11, 30],
    ],
    nearLeg: [
      [19.5, 36.5],
      [21, 43.5],
    ],
    sh: [17, 22],
  },
  "run-tuck": {
    farArm: [
      [15, 27.5],
      [17.5, 30],
    ],
    farLeg: [
      [16.5, 37.5],
      [16, 44.5],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [17.5, 27.5],
      [20, 30],
    ],
    nearLeg: [
      [19.5, 35],
      [15, 39],
    ],
    sh: [17, 22],
  },
};

const VOLLEY_RIM: Rims = { ...LIT, dturq: ["turquoise", null] };

// A limb w thick from a to b, as a quadrilateral, with a round joint at b.
function volleyBar(g: Drawable, a: Point, b: Point, w: number, c: string): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.max(1e-6, (dx * dx + dy * dy) ** 0.5);
  const px = ((-dy / n) * w) / 2;
  const py = ((dx / n) * w) / 2;
  const p: [Point, Point, Point, Point] = [
    [a[0] + px, a[1] + py],
    [b[0] + px, b[1] + py],
    [b[0] - px, b[1] - py],
    [a[0] - px, a[1] - py],
  ];
  g.tri(p[0], p[1], p[2], c);
  g.tri(p[0], p[2], p[3], c);
  g.ell(b[0], b[1], w / 2, w / 2, c);
}

// The volleyball: white, two yellow panels curving across it, its lower right a step darker.
export function volleyBall(g: Drawable, cx: number, cy: number): void {
  g.cel(cx, cy, 3.5, 3.5, "white", "lgrey");
  g.cel(cx - 1, cy - 1.5, 2.6, 1, "yellow");
  g.cel(cx + 1, cy + 1.2, 2.4, 0.9, "yellow");
}

// The volleyball player side on, facing right: a turquoise visor over dark brown hair in a ponytail,
// a red racerback tank with a white side stripe, navy shorts, bare legs and bare feet. pose is a
// VOLLEY_POSES key; bob lifts all but the feet planted on row 44 or below; tail swings the ponytail
// down behind.
export function volleyballPlayer({
  bob = 0,
  pose = "run-reach",
  tail = 0,
}: VolleyFrame = {}): Drawable {
  const q = VOLLEY_POSES[pose]!;
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const planted = (f: Point): boolean => f[1] >= 43.5;
  const up = (pt: Point): Point => [pt[0], pt[1] + b];
  const hip = up(q.hip);
  const sh = up(q.sh);
  const [hx, hy] = up(q.head);

  const leg = (knee: Point, foot: Point, skin: string, shade: string): void => {
    const f = planted(foot) ? foot : up(foot);
    const k = up(knee);
    volleyBar(g, hip, k, 4, skin);
    volleyBar(g, k, f, 3.5, skin);
    // the bare foot: toes forward along the road, or the sole up behind on a kicked foot
    if (planted(f)) {
      g.rect(f[0] - 1.5, f[1] - 0.5, 4.5, 1.5, skin);
      g.p(f[0] + 2.5, f[1] + 0.5, shade);
    } else {
      g.ell(f[0], f[1], 1.8, 1.8, skin);
    }
  };

  const arm = (e: Point, h: Point, skin: string): void => {
    volleyBar(g, sh, up(e), 3, skin);
    volleyBar(g, up(e), up(h), 2.5, skin);
  };

  // the far limbs, a step darker
  arm(...q.farArm, "skin2");
  leg(...q.farLeg, "skin2", "brown");
  // the ponytail out the back of the visor (to the side, face on), then the torso: the red tank with
  // its white side stripe, the navy shorts
  if (q.front) {
    g.cel(hx + 7.5, hy + 1 + tail, 2, 3.5, "dbrown", "plum", "brown");
  } else {
    g.cel(hx - 9, hy + 1.5 + tail, 2.2, 3.5, "dbrown", "plum", "brown");
  }
  volleyBar(g, hip, sh, 8, "red");
  const mid: Point = [(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2];
  volleyBar(g, [(hip[0] + mid[0]) / 2, (hip[1] + mid[1]) / 2], sh, 1, "white");
  g.cel(hip[0], hip[1], 4.2, 3.6, "navy", "ink", "dslate");
  leg(...q.nearLeg, "skin1", "skin2");
  const nk = up(q.nearLeg[0]);
  volleyBar(
    g,
    hip,
    [hip[0] + (nk[0] - hip[0]) * 0.45, hip[1] + (nk[1] - hip[1]) * 0.45],
    5,
    "navy",
  );
  volleyBar(g, sh, [hx - 0.5, hy + 5], 3.5, "skin1");
  if (q.front) {
    // the head face on: the face, the hair over the crown, the visor's band and its brim seen from
    // the front
    faceDisc(g, hx, hy, 7, 7, "skin1", "skin2");
    g.cel(hx, hy - 3.5, 7.5, 4, "dbrown", "plum", "brown");
    g.rect(hx - 7.5, hy - 3.5, 2, 5, "dbrown");
    g.rect(hx + 5.5, hy - 3.5, 2, 5, "dbrown");
    g.rect(hx - 7, hy - 5, 14, 2, "turquoise");
    g.rect(hx - 8, hy - 3, 16, 1.5, "dturq");
    roadScope.faceFront(g, hx, hy - 0.5, { mouth: 3.5 });
    g.p(hx - 5, hy + 2.5, "pink");
    g.p(hx + 4, hy + 2.5, "pink");
  } else {
    // the head side on: the face, nose, eye, smile and cheek, the hair over the crown and at the
    // nape, the ear, then the visor's band and brim
    g.ell(hx, hy, 7, 7, "skin1");
    g.rect(hx + 6.5, hy - 0.5, 1.2, 2, "skin1");
    g.cel(hx - 2, hy - 3, 6, 4.5, "dbrown", "plum", "brown");
    g.cel(hx - 4.5, hy, 3, 4, "dbrown", "plum");
    g.rect(hx - 2.5, hy - 0.5, 2, 3, "skin2");
    g.rect(hx + 2.5, hy - 1, 2, 2, "ink");
    g.p(hx + 2.5, hy - 1, "white");
    g.rect(hx + 3.5, hy + 3.5, 1.5, 1, "dbrown");
    g.p(hx + 1.5, hy + 2, "pink");
    g.rect(hx - 7, hy - 4.5, 13.5, 2, "turquoise");
    g.rect(hx - 7, hy - 3.5, 13.5, 1, "dturq");
    g.tri([hx + 4, hy - 4.5], [hx + 10, hy - 3], [hx + 4, hy - 2.5], "turquoise");
    g.rect(hx + 5, hy - 3, 4.5, 0.8, "dturq");
  }
  // the near arm, over the body, its fist and thumb up in the thumbs up
  arm(...q.nearArm, "skin1");
  if (q.thumb) {
    const [hx2, hy2] = up(q.nearArm[1]);
    g.cel(hx2, hy2, 2, 2, "skin1", "skin2");
    g.rect(hx2 - 1.5, hy2 - 5, 1.5, 3.5, "skin1");
  }
  if (q.ball) {
    volleyBall(g, ...q.ball);
  }
  for (const [x, y, r] of q.sand ?? []) {
    g.cel(x, y, r, r, "tan", "brown", "cream");
  }
  return rim(g, VOLLEY_RIM);
}
