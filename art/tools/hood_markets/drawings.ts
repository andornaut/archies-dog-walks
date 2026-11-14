import { small } from "../mini.ts";
import * as ob from "../obstacles.ts";
import {
  type Drawable,
  type DrawingScope,
  edged,
  type FaceFront,
  Grid,
  K,
  type Point,
  raster,
  rowScaleOf,
  scaleOf,
} from "../pixel.ts";
import * as road from "../road.ts";
import { faceDisc, lit, scope as roadScope } from "../road.ts";

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
const scope: MarketsScope = {
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

export {
  artSculpture,
  BARREL_IDLE,
  BARREL_RUN,
  barrelStack,
  BIN_IDLE,
  CARGO_RIDE,
  cargoBike,
  CHEESE,
  CHEESE_IDLE,
  cheeseCrates,
  cheeseWheel,
  clothingRack,
  drawn,
  GREEN_BIN_SPILL,
  greenBinSpill,
  line,
  marketStall,
  OBSTACLE,
  pairs,
  PERSON,
  poly,
  PRODUCE_IDLE,
  produceCrates,
  RACK_IDLE,
  radians,
  range,
  rollingBarrel,
  scope,
  SCULPTURE_IDLE,
  SHOOT_IDLE,
  type ShootPart,
  STACK_IDLE,
  STALL_IDLE,
  stinkWisps,
  VELVET_IDLE,
  velvetRope,
  weddingPhotoShoot,
};
