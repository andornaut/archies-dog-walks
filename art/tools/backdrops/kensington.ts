import { randomInt } from "@andornaut/game-kit/random";

import { dk, MURAL } from "../pixel.ts";
import { LANE_PAINT } from "../roads.ts";
import { Canvas } from "../scene.ts";
import { umbrella } from "./beaches.ts";
import {
  BASE,
  CALM,
  cross,
  crosses,
  crossLine,
  CX,
  FAR_WALK,
  flat,
  H,
  lanes,
  ROAD,
  type RoadPaint,
  roofline,
  shopfront,
  stream,
  street,
  sunburst,
  verge,
  vergePaving,
  VERGES,
  W,
  yard,
} from "./common.ts";

// Worn paint: each Kensington wall a darker, greyer tone of its colour, none green; roofs dark;
// awnings sun-faded, their stripes stone.
const WORN_WALL: Readonly<Record<string, string>> = {
  dturq: "teal",
  mauve: "dbrick",
  ochre: "clay",
  olive: "brick",
  violet: "purple",
};
const WORN_ROOF: Readonly<Record<string, string>> = {
  dbrick: "bark",
  dolive: "bark",
  navy: "shale",
  plum: "walnut",
};
const FADED: ReadonlyMap<string, string> = new Map([
  ["dred", "brick"],
  ["dturq", "slate"],
  ["lake", "slate"],
  ["ochre", "clay"],
  ["red", "brick"],
]);

// n soot streaks 2px wide running down from row y, each 3 to 8 rows long, between columns x0 and x1.
function streaks(
  cv: Canvas,
  x0: number,
  x1: number,
  y: number,
  col: string,
  seed: string,
  n: number,
): void {
  const rnd = stream(seed);
  for (let i = 0; i < n; i++) {
    const x = randomInt(rnd, x0, x1 - 2);
    cv.fill(x, y, 2, randomInt(rnd, 3, 9), col);
  }
}

// A throw-up: two bubble letters in one fill inside a 1px coal outline, a 2x2 counter in each, so
// every mark is 2px or more.
const THROWUP: readonly string[] = [
  ".xxxx.xxxx.",
  "xoooxxooox.",
  "xoxxoxoxxox",
  "xoxxoxoxxox",
  "xoooxxooox.",
  ".xxxx.xxxx.",
];

// A throw-up with its top left at x, y, mirrored with flip.
function throwUp(cv: Canvas, x: number, y: number, fill: string, flip = false): void {
  THROWUP.forEach((row, j) => {
    const chars = [...row];
    (flip ? chars.reverse() : chars).forEach((ch, i) => {
      if (ch !== ".") {
        cv.fill(x + i, y + j, 1, 1, ch === "x" ? "coal" : fill);
      }
    });
  });
}

// A worn two-storey Victorian over a shopfront, standing on BASE: a shallow gable with a round attic
// vent, two tall sashes in stone trim upstairs (lamplight in the left), the shopfront below under a
// faded awning, soot streaks down the wall and a dirty band along its foot; tag, a colour, sprays a
// throw-up between the sashes. Its paint is worn (WORN_WALL, WORN_ROOF, FADED).
function victorian(
  cv: Canvas,
  cx: number,
  w: number,
  wall: string,
  roof: string,
  awn: string,
  signText: string,
  board: string,
  letters: string,
  tag?: string,
): void {
  const wallC = WORN_WALL[wall]!;
  const roofC = WORN_ROOF[roof]!;
  const x = cx - Math.floor(w / 2);
  const top = BASE - 66;
  const roofH = 11;
  const half = w / 2 + 2;
  for (let i = 0; i < roofH; i++) {
    const inset = Math.round((i * half) / roofH);
    cv.fill(x - 2 + (Math.floor(w / 2) + 2) - inset, top + i, inset * 2, 1, roofC);
  }
  cv.fill(x - 2, top + roofH - 1, w + 4, 2, dk(roofC));
  const wallY = top + roofH + 1;
  cv.fill(x, wallY, w, BASE - wallY, wallC);
  cv.fill(x + w - 3, wallY, 3, BASE - wallY, dk(wallC));
  cv.fill(x + Math.floor(w / 2) - 2, top + 4, 4, 4, "stone");
  cv.fill(x + Math.floor(w / 2) - 1, top + 5, 2, 2, "coal");
  [x + 7, x + w - 17].forEach((wx, k) => {
    cv.fill(wx - 1, wallY + 3, 12, 15, "stone");
    cv.fill(wx, wallY + 4, 10, 13, k ? "dlake" : "ochre");
    cv.fill(wx, wallY + 10, 10, 1, "stone");
    cv.fill(wx + 4, wallY + 4, 2, 13, "stone");
    cv.fill(wx - 2, wallY + 18, 14, 2, "dstone");
  });
  shopfront(cv, x, w, BASE - 33, BASE, wallC, FADED.get(awn) ?? awn, signText, board, letters, {
    glass: "dlake",
    stripe: "stone",
  });
  if (tag) {
    throwUp(cv, x + Math.floor(w / 2) - 5, wallY + 12, tag, cx > CX);
  }
  streaks(cv, x + 2, x + w - 3, wallY + 20, dk(wallC), `victorian-${cx}`, 3);
  cv.fill(x + 1, BASE - 2, w - 2, 2, dk(wallC));
}

type Point = readonly [x: number, y: number];

// A wooden hydro pole 2 wide from the far sidewalk up to just under CALM, a crossarm near its top.
// Returns the crossarm's left and right ends, where the wires hang.
function hydroPole(cv: Canvas, x: number): [Point, Point] {
  cv.fill(x, CALM + 3, 2, FAR_WALK - CALM - 4, "bark");
  cv.fill(x - 4, CALM + 6, 10, 2, "walnut");
  return [
    [x - 3, CALM + 8],
    [x + 4, CALM + 8],
  ];
}

// A hydro wire 2 rows thick from a to b, sagging sag rows in the middle.
function wire(cv: Canvas, a: Point, b: Point, sag: number): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  for (let x = x0; x < x1 + 1; x++) {
    const t = (x - x0) / Math.max(1, x1 - x0);
    cv.fill(x, Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), 1, 2, "walnut");
  }
}

// Empty produce crates stacked n high on row base, each offset a column: clay with bark slats and
// ends.
function crateStack(cv: Canvas, x: number, base: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const y = base - 5 * (k + 1);
    cv.fill(x + (k % 2), y, 12, 5, "clay");
    cv.fill(x + (k % 2), y, 12, 1, "bark");
    cv.fill(x + (k % 2), y + 2, 12, 1, "bark");
    cv.fill(x + 11 + (k % 2), y, 1, 5, "bark");
  }
}

// A laneway wall 16 wide, rows top to base, painted with a mural: diagonal bands of MURAL's paint a
// ramp step darker, so the walls at the band's edges sit behind the shopfronts, under a walnut
// coping, a dog's face looking out of them, the paint stopping short of the ground.
function mural(cv: Canvas, x0: number, top: number, base: number, flip: boolean): void {
  for (let py = top; py < base; py++) {
    for (let px = x0; px < x0 + 16; px++) {
      const u = flip ? x0 + 15 - px : px - x0;
      const c = py < base - 4 ? dk(MURAL[Math.floor((u + py) / 5) % MURAL.length]!) : "coal";
      cv.fill(px, py, 1, 1, c);
    }
  }
  cv.fill(x0, top, 16, 2, "walnut");
  const fy = top + 34;
  for (let dy = -6; dy < 7; dy++) {
    for (let dx = -6; dx < 7; dx++) {
      if ((dx / 6.5) ** 2 + (dy / 6) ** 2 <= 1) {
        cv.fill(x0 + 8 + dx, fy + dy, 1, 1, "cream");
      }
    }
  }
  for (const dx of [-6, 4]) {
    cv.fill(x0 + 8 + dx, fy - 7, 3, 7, "brown");
  }
  for (const dx of [-3, 2]) {
    cv.fill(x0 + 8 + dx, fy - 2, 2, 2, "coal");
  }
  cv.fill(x0 + 7, fy + 2, 3, 2, "coal");
  cv.fill(x0 + 8, fy + 5, 1, 2, "ttc");
}

// A 1px circle of radius r round cx, cy.
function ring(cv: Canvas, cx: number, cy: number, r: number, col: string): void {
  for (let a = 0; a < 360; a += 6) {
    const t = a * (Math.PI / 180);
    cv.fill(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), 1, 1, col);
  }
}

// A bicycle side on, 15 wide and 9 tall, its wheels on row base: coal tires round ash hubs, a
// diamond frame, a saddle, and the handlebars at the front (right, or left when flipped).
function bike(cv: Canvas, x: number, base: number, frame = "red", flip = false): void {
  const atX = (dx: number): number => x + (flip ? 14 - dx : dx);

  for (const wx of [2, 12]) {
    ring(cv, atX(wx), base - 3, 3, "coal");
    cv.fill(atX(wx), base - 3, 1, 1, "ash");
  }
  for (const [[x0, y0], [x1, y1]] of [
    [
      [2, 3],
      [6, 7],
    ],
    [
      [6, 7],
      [11, 7],
    ],
    [
      [6, 7],
      [7, 3],
    ],
    [
      [7, 3],
      [2, 3],
    ],
    [
      [7, 3],
      [11, 7],
    ],
    [
      [11, 7],
      [12, 3],
    ],
  ] as const) {
    cv.line(atX(x0), base - y0, atX(x1), base - y1, frame);
  }
  cv.fill(Math.min(atX(4), atX(7)), base - 9, 4, 1, "coal");
  cv.fill(atX(6), base - 8, 1, 1, "coal");
  cv.fill(atX(11), base - 9, 1, 2, "coal");
  cv.fill(Math.min(atX(10), atX(13)), base - 9, 3, 1, "coal");
}

const GARMENTS: readonly string[] = [
  "red",
  "dturq",
  "gold",
  "lilac",
  "pink",
  "moss",
  "orange",
  "cream",
];

// A vintage clothes rail out front, w wide: two coal posts and a rail 14 rows up, hung with shirts
// and dresses in GARMENTS from the first, each 3 wide on a hanger, every third a dress flaring at the
// hem, its right column in shade.
function clothesRack(cv: Canvas, x: number, w: number, base: number, first = 0): void {
  const top = base - 14;
  cv.fill(x, top, 1, 14, "coal");
  cv.fill(x + w - 1, top, 1, 14, "coal");
  cv.fill(x, top, w, 1, "coal");
  for (let k = first, gx = x + 2; gx < x + w - 4; k++, gx += 4) {
    const c = GARMENTS[k % GARMENTS.length]!;
    const n = k % 3 === 1 ? 9 : 6;
    cv.fill(gx + 1, top + 1, 1, 1, "ash");
    cv.fill(gx, top + 2, 3, n, c);
    cv.fill(gx + 2, top + 2, 1, n, dk(c));
    if (k % 3 === 1) {
      cv.fill(gx - 1, top + n, 5, 2, c);
      cv.fill(gx + 3, top + n, 1, 2, dk(c));
    }
  }
}

// A busker's pitch with no one at it, on row base: an amp and a guitar leaning on it beside its open
// case, below the shop's sign board.
function busker(cv: Canvas, x: number, base: number): void {
  cv.fill(x, base - 8, 8, 8, "coal");
  cv.fill(x + 1, base - 7, 6, 5, "ash");
  cv.fill(x + 3, base - 5, 2, 2, "coal");
  cv.fill(x + 1, base - 9, 6, 1, "coal");
  const gx = x + 10;
  for (let dy = -3; dy < 4; dy++) {
    for (let dx = -3; dx < 4; dx++) {
      if ((dx / 3.4) ** 2 + (dy / 3.4) ** 2 <= 1) {
        cv.fill(gx + dx, base - 4 + dy, 1, 1, dx + dy < 2 ? "ochre" : "brown");
      }
    }
  }
  cv.fill(gx, base - 4, 1, 1, "walnut");
  cv.line(gx, base - 7, gx - 2, base - 17, "walnut");
  cv.fill(gx - 3, base - 18, 2, 2, "walnut");
  cv.fill(x + 15, base - 3, 12, 3, "walnut");
  cv.fill(x + 16, base - 2, 10, 1, "dred");
}

// A cafe table under an umbrella striped a and b, a chair each side, on row base.
function patio(cv: Canvas, cx: number, base: number, a: string, b: string): void {
  umbrella(cv, cx, base, a, b);
  cv.fill(cx - 4, base - 5, 9, 1, "walnut");
  cv.fill(cx, base - 4, 1, 4, "walnut");
  for (const sx of [cx - 7, cx + 6]) {
    cv.fill(sx, base - 4, 2, 1, "walnut");
    cv.fill(sx, base - 3, 2, 3, "walnut");
  }
}

// Kensington Market's road and paving, as its road strip (roads.ts) and its verge (VERGES) paint
// them.
const KENSINGTON_ROAD = "stone";
const KENSINGTON_GUTTER = "dstone";

function kensington(): Canvas {
  const cv = new Canvas(W, H);
  // a Pedestrian Sunday at twilight: a sunburst of purple rays from the end of the street, flat
  // violet beyond its arc
  sunburst(cv, CX, BASE + 6, 7, "purple", "violet", FAR_WALK, { r: [W * 0.65, BASE + 6 - CALM] });
  // rooftops of the back lanes behind the houses
  roofline(
    cv,
    BASE - 34,
    [
      [24, 18, 10],
      [76, 16, 8],
      [228, 18, 9],
      [300, 16, 10],
    ],
    "walnut",
  );
  // a worn row of two-storey Victorians turned shops across the street, throw-ups on two of them
  for (const [cx, w, wallC, roof, awn, signText, board, letters, tag] of [
    [47, 56, "dturq", "navy", "dred", "FRUIT", "forest", "gold", "white"],
    [CX - 69, 60, "violet", "plum", "ochre", "RECORDS", "navy", "gold", undefined],
    [CX, 68, "ochre", "dbrick", "dturq", "VINTAGE", "purple", "cream", undefined],
    [CX + 69, 60, "olive", "dolive", "red", "CHEESE", "dbrick", "gold", "lime"],
    [313, 56, "mauve", "plum", "lake", "TACOS", "coal", "cream", undefined],
  ] as const) {
    victorian(cv, cx, w, wallC, roof, awn, signText, board, letters, tag);
  }
  // hydro poles in the gaps between the houses, two wires sagging across the band over the roofs
  const ends: [Point, Point][] = [
    [
      [-2, CALM + 10],
      [-2, CALM + 10],
    ],
    ...[78, 216].map((x) => hydroPole(cv, x)),
    [
      [W + 2, CALM + 10],
      [W + 2, CALM + 10],
    ],
  ];
  for (let i = 0; i + 1 < ends.length; i++) {
    const a = ends[i]![1];
    const b = ends[i + 1]![0];
    wire(cv, a, b, 5);
    wire(cv, [a[0], a[1] + 4], [b[0], b[1] + 4], 6);
  }

  const paving = vergePaving("kensington-market");
  yard(cv, BASE, FAR_WALK, paving);
  // out front: empty crates, two vintage rails, a busker's pitch, a bike and a patio
  crateStack(cv, 3, FAR_WALK - 1, 3);
  crateStack(cv, 17, FAR_WALK - 1, 2);
  clothesRack(cv, 56, 22, FAR_WALK - 1, 1);
  crateStack(cv, 82, FAR_WALK - 1, 3);
  clothesRack(cv, CX - 28, 22, FAR_WALK - 1, 5);
  busker(cv, CX + 6, FAR_WALK - 1);
  bike(cv, CX + 40, FAR_WALK - 1, "lilac");
  crateStack(cv, CX + 60, FAR_WALK - 1, 2);
  patio(cv, CX + 96, FAR_WALK - 1, "red", "cream");
  // the laneway walls at both ends of the street, painted with murals and tagged at their feet
  for (const x0 of [0, W - 16]) {
    mural(cv, x0, BASE - 66, FAR_WALK, x0 > 0);
    throwUp(cv, x0 + 3, FAR_WALK - 11, x0 ? "lime" : "pink", x0 > 0);
  }

  const road: RoadPaint = (x, z, span) => {
    const a = Math.abs(x);
    if (a >= ROAD - 4) {
      return KENSINGTON_GUTTER;
    }
    if (a >= ROAD - 5) {
      return "coal";
    }
    if (span < 4 && crosses(z, span, 32)) {
      return KENSINGTON_GUTTER;
    }
    return KENSINGTON_ROAD;
  };

  cross(cv, flat(road), KENSINGTON_GUTTER, paving, {
    curb: VERGES["kensington-market"]!.curbColour,
  });
  crossLine(cv, "plum", { dash: [12, 64] });
  street(cv, verge("kensington-market", road));
  lanes(cv, LANE_PAINT, { dash: [10, 32], edge: LANE_PAINT.map((c) => dk(c)) });
  return cv;
}

export {
  FADED,
  kensington,
  KENSINGTON_GUTTER,
  KENSINGTON_ROAD,
  type Point,
  wire,
  WORN_ROOF,
  WORN_WALL,
};
