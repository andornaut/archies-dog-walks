// Ground decals, surface effects and the ice cream truck drawings.

import { type Colour, type Drawable, edged, type Point, raster, scaleOf } from "../pixel.ts";
import { key, LIT, range, rim, scope, treads, unit } from "./primitives.ts";

// The road's 2-lane puddle, 112x48 (64n-16 wide for n = 2); cards draw a 32x16 one. Wide puddles get
// a second lobe.
export function puddle(f: number | boolean, w = 112, h = 48): Drawable {
  const g = scope.Grid(w, h);
  let lobes: (readonly [number, number, number, number])[] = [[w / 2, h / 2, w / 2 - 2, h / 2 - 2]];
  if (w > 40) {
    lobes = [
      [w * 0.36, h * 0.52, w * 0.34, h / 2 - 3],
      [w * 0.66, h * 0.46, w * 0.32, h / 2 - 4],
    ];
  }
  for (const [cx, cy, rx, ry] of lobes) {
    g.ell(cx, cy, rx, ry, "blue");
  }
  for (const [cx, cy, rx, ry] of lobes) {
    g.ell(cx, cy + 0.5, rx - 1, ry - 1, "sky");
  }
  if (w > 40) {
    // the far bank's shade, a blue band down the top edge inside the rim, and the sky's glint in the
    // near lobe: a white streak over a cyan one
    for (const [cx, cy, rx, ry] of lobes) {
      g.ell(cx, cy + 0.5, rx - 1, ry - 1, "blue");
    }
    for (const [cx, cy, rx, ry] of lobes) {
      g.ell(cx, cy + 2, rx - 1.5, ry - 2, "sky");
    }
    g.rect(Math.round(w * 0.16), Math.round(h * 0.4), Math.round(w * 0.08), 2, "white");
    g.rect(Math.round(w * 0.14), Math.round(h * 0.4) + 2, Math.round(w * 0.13), 1, "cyan");
  }
  const s = f ? 1 : 0;
  for (const [fx, fy, fw] of [
    [0.28, 0.31, 0.125],
    [0.59, 0.56, 0.16],
    [0.41, 0.69, 0.06],
    [0.75, 0.3, 0.1],
  ] as const) {
    if (w > 40 || fx < 0.7) {
      g.rect(
        Math.round(fx * w) + (fx < 0.5 ? s : -s),
        Math.round(fy * h),
        Math.max(2, Math.round(fw * w)),
        1,
        "cyan",
      );
    }
  }
  return g;
}

// The pothole's edge, star-shaped about POTHOLE_CENTRE, as [x, y] corners on its 112x48 frame, joined
// straight: the far rim broken into teeth and steps, the near rim smoother with one chip out of it.
const POTHOLE_CENTRE: Point = [54, 25];

const POTHOLE_EDGE: readonly Point[] = [
  [8, 28],
  [10, 21],
  [14, 19],
  [15, 15],
  [21, 14],
  [23, 10],
  [31, 10],
  [34, 6],
  [39, 8],
  [46, 7],
  [49, 4],
  [55, 6],
  [60, 5],
  [63, 9],
  [70, 9],
  [72, 12],
  [79, 11],
  [82, 9],
  [87, 12],
  [93, 12],
  [95, 16],
  [101, 17],
  [104, 22],
  [104, 27],
  [101, 31],
  [95, 35],
  [88, 35],
  [84, 37],
  [80, 37],
  [73, 39],
  [71, 42],
  [63, 42],
  [61, 40],
  [52, 41],
  [40, 42],
  [30, 41],
  [20, 40],
  [13, 37],
  [9, 33],
];

// How many rows the far wall drops to the water.
const POTHOLE_DEPTH = 12;

// How many pixels each side the wall's foot smooths the far rim's top over, so its teeth stay on the
// rim.
const POTHOLE_FOOT = 5;

// The slabs of the near lip broken and tipped into the water, as four corners clockwise from the top
// left: a grey face, lgrey along its broken top edge, over an ash edge POTHOLE_SLAB_EDGE rows deep
// along its bottom.
const POTHOLE_SLABS: readonly (readonly [Point, Point, Point, Point])[] = [
  [
    [19, 35],
    [31, 34],
    [35, 42],
    [14, 40],
  ],
];

const POTHOLE_SLAB_EDGE = 1;

// The cracks running out from the rim into the road, each a run of [x, y] corners: an ink line over a
// grey one, lit along its lower edge.
const POTHOLE_CRACKS: readonly (readonly Point[])[] = [
  [
    [23, 10],
    [19, 7],
    [11, 6],
  ],
  [
    [49, 4],
    [51, 2],
  ],
  [
    [8, 28],
    [4, 28],
    [2, 25],
  ],
  [
    [104, 27],
    [109, 26],
  ],
  [
    [71, 42],
    [73, 44],
  ],
];

// The water's white glint, [x, y, w, h]; it moves a pixel right on frame 1.
const POTHOLE_GLINT: readonly [number, number, number, number] = [54, 31, 7, 2];

// The road's 2-lane pothole, 112x48 like the puddle, a ground decal with no outline, seen from the
// walker's eye: a coal far wall dropping POTHOLE_DEPTH rows from a broken far rim, its cut asphalt ash
// along the top (and down the lit right wall), to murky water. The water is the hole lowered by the
// wall, inside the hole, its far edge an ink line with the wall's reflection navy under it, then dlake
// with one white glint. The near lip is lit lgrey, with a grey slab tipped into the water at its left
// and a chip out of it at the right, and lit ink cracks run out into the road. Every band and line is
// drawn on the drawn grid, so it stays whole at every depth step.
export function pothole(f: number | boolean, w = 112, h = 48): Drawable {
  const g = scope.Grid(w, h);
  const [cx, cy] = POTHOLE_CENTRE;
  const s = scaleOf(g);
  const px = raster(g);

  const fan = (pts: readonly Point[], col: string, c: Point = [cx, cy]): void => {
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      // a triangle with no area would fill the whole line through it
      if ((a[0] - c[0]) * (b[1] - c[1]) !== (a[1] - c[1]) * (b[0] - c[0])) {
        g.tri(c, a, b, col);
      }
    });
  };
  const at = (x: number, y: number): Colour =>
    x >= 0 && x < px.w && y >= 0 && y < px.h ? px.px[y]![x]! : null;
  // An ink line through run's corners on the drawn grid, unbroken at every scale, over a grey one a
  // pixel lower, lit along its lower edge.
  const crack = (run: readonly Point[]): void => {
    const pts = run.map(([x, y]) => [Math.round(x * s), Math.round(y * s)] as const);
    const ink: (readonly [number, number])[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) {
        ink.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)]);
      }
    }
    const inkSet = new Set(ink.map(([x, y]) => key(x, y)));
    for (const [x, y] of ink) {
      if (!inkSet.has(key(x, y + 1)) && at(x, y + 1) === null) {
        px.p(x, y + 1, "grey");
      }
    }
    for (const [x, y] of ink) {
      px.p(x, y, "ink");
    }
  };

  fan(POTHOLE_EDGE, "coal");
  const d = Math.max(2, Math.round(POTHOLE_DEPTH * s));
  const band = Math.max(1, Math.round(2 * s));
  const hole = new Set<string>();
  const holeCells: [number, number][] = [];
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (at(x, y)) {
        hole.add(key(x, y));
        holeCells.push([x, y]);
      }
    }
  }
  // the water's far edge follows the wall's foot, the far rim's top smoothed over POTHOLE_FOOT pixels
  // each side and dropped d rows, so the rim's broken teeth stay on the rim
  const top = new Map<number, number>();
  for (const [x, y] of holeCells) {
    top.set(x, Math.min(top.get(x) ?? y, y));
  }
  const r = Math.max(1, Math.round(POTHOLE_FOOT * s));
  const foot = new Map<number, number>();
  for (const x of top.keys()) {
    let sum = 0;
    let count = 0;
    for (let k = x - r; k <= x + r; k++) {
      const t = top.get(k);
      if (t !== undefined) {
        sum += t;
        count += 1;
      }
    }
    foot.set(x, sum / count + d);
  }
  const water = new Set<string>();
  for (const [x, y] of holeCells) {
    if (y >= foot.get(x)! && hole.has(key(x, y - d))) {
      water.add(key(x, y));
    }
  }
  for (const [x, y] of holeCells) {
    let c: string;
    if (!hole.has(key(x, y + 1))) {
      c = "lgrey";
    } else if (water.has(key(x, y))) {
      // the far wall's foot: an ink line along the water's top, the wall's reflection navy under it
      let k = d + 1;
      for (let j = 1; j <= d; j++) {
        if (!water.has(key(x, y - j))) {
          k = j;
          break;
        }
      }
      if (k === 1) {
        c = "ink";
      } else {
        c = k <= 1 + 2 * band ? "navy" : "dlake";
      }
    } else if (
      range(1, band + 1).some((j) => !hole.has(key(x, y - j))) ||
      range(1, band + 1).some((j) => !hole.has(key(x + j, y)))
    ) {
      // the far rim's broken asphalt, its cut face ash over the coal wall, and the right wall lit
      c = "ash";
    } else {
      continue;
    }
    px.p(x, y, c);
  }
  for (const slab of POTHOLE_SLABS) {
    const before = px.px.map((row) => [...row]);
    const [a, b, q, dd] = slab;
    g.tri(a, b, q, "grey");
    g.tri(a, q, dd, "grey");
    const mine = new Set<string>();
    const mineCells: [number, number][] = [];
    for (let y = 0; y < px.h; y++) {
      for (let x = 0; x < px.w; x++) {
        if (at(x, y) !== before[y]![x]) {
          mine.add(key(x, y));
          mineCells.push([x, y]);
        }
      }
    }
    const edge = Math.max(1, Math.round(POTHOLE_SLAB_EDGE * s));
    for (const [x, y] of mineCells) {
      if (!mine.has(key(x, y - 1))) {
        px.p(x, y, "lgrey");
      } else if (range(1, edge + 1).some((k) => !mine.has(key(x, y + k)))) {
        px.p(x, y, "ash");
      }
    }
  }
  for (const run of POTHOLE_CRACKS) {
    crack(run);
  }
  const [gx, gy, gw, gh] = POTHOLE_GLINT;
  g.rect(gx + (f ? 1 : 0), gy, gw, gh, "white");
  return g;
}

// The stink haze's puffs as [centre x, centre y, radius across], laid out on an 88x40 design that the
// sprite stretches to CLOUD_SIZE (2 lanes, 64n-16 wide, by 1.5 x 40 rows). The haze hugs the road:
// each puff is CLOUD_SQUASH as tall as it is wide, so together they make a low, wide bank with a lumpy
// top, its base on the frame's last row. A swollen puff still stops a pixel short of the frame's top
// and sides, so no lobe is clipped flat; along the bottom the frame's last row cuts them level, where
// the haze meets the road.
const CLOUD_PUFFS: readonly (readonly [number, number, number])[] = [
  [44, 28, 30],
  [22, 31, 15],
  [66, 31, 15],
  [31, 36, 15],
  [57, 36, 15],
  [32, 20, 11],
  [57, 19, 11],
  [44, 14, 9],
  [11, 35, 9],
  [77, 35, 9],
  [19, 24, 7],
  [70, 24, 7],
];

const CLOUD_SQUASH = 0.42;

const CLOUD_W = 88;

const CLOUD_H = 40;

const CLOUD_SIZE: readonly [number, number] = [112, 60];

// Where each stink wisp starts, trailing 6 design rows down.
const CLOUD_WISPS: readonly Point[] = [
  [22, 25],
  [62, 22],
  [72, 30],
  [14, 31],
  [42, 17],
];

// The haze's colours: the outer and inner rim, the fill, the seams between lobes, and the wisps.
export const CLOUD_INK = {
  dark: "purple",
  fill: "mauve",
  inner: "pink",
  outer: "plum",
  wisp: "purple",
} as const;

// The stink haze under the skunk at depth step s (CLOUD_SIZE at 1), low and wide on the road: flat
// mauve lobes, a purple seam where one meets the next, with no dither, so it holds on the dark roads.
// The puffs swell in turn by a whole pixel; the base stays on the last row. The rim is two pixels at
// every size: plum outside, which holds 3:1 on the light roads, and pink inside it, which holds on the
// dslate road. The seams and the wisps' 1px wave are laid on the drawn grid, so they keep their pixels
// at every step. A puff near the frame's top or sides is trimmed so that, swollen, it still stops a
// pixel short of them. Mauve keeps it apart from the green hedges, and matches fx-hit-skunk.
export function skunkCloud(step: number, s = 1): Drawable {
  const [w, h] = CLOUD_SIZE.map((v) => Math.floor(v * s + 0.5)) as [number, number];
  const sx = w / CLOUD_W;
  const sy = h / CLOUD_H;
  const g = scope.Grid(w, h);
  const k = (CLOUD_SQUASH * sy) / sx;
  const puffs = CLOUD_PUFFS.map(([puffX, puffY, puffR], i) => {
    const cx = puffX * sx;
    const cy = puffY * sy;
    const r = Math.min(puffR * sx, cx - 1.6, w - cx - 1.6, (cy - 1.6) / k);
    return [cx, cy, r + ((i + step) % 4 === 0 ? 1 : 0)] as const;
  });
  // how far inside the nearest puff each pixel is, in pixels across
  const depthOf = ([cx, cy, r]: readonly [number, number, number], x: number, y: number): number =>
    r - Math.sqrt((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / k) ** 2);
  const depth = range(0, h).map((y) =>
    range(0, w).map((x) => Math.max(...puffs.map((p) => depthOf(p, x, y)))),
  );
  const inside = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && depth[y]![x]! >= 0;
  const beside = (x: number, y: number, test: (a: number, b: number) => boolean): boolean =>
    test(x, y - 1) || test(x, y + 1) || test(x - 1, y) || test(x + 1, y);
  const outer = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inside(x, y) && beside(x, y, (a, b) => !inside(a, b))) {
        outer.add(key(x, y));
      }
    }
  }
  // each pixel belongs to the puff it is deepest inside; where two lobes meet, the later one's edge is
  // a purple seam, so the haze reads as flat lobes
  const owner = range(0, h).map((y) =>
    range(0, w).map((x) => {
      let best = 0;
      let bestDepth = depthOf(puffs[0]!, x, y);
      for (let i = 1; i < puffs.length; i++) {
        const dp = depthOf(puffs[i]!, x, y);
        if (dp > bestDepth) {
          best = i;
          bestDepth = dp;
        }
      }
      return best;
    }),
  );
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) {
        continue;
      }
      if (outer.has(key(x, y))) {
        g.p(x, y, CLOUD_INK.outer);
      } else if (beside(x, y, (a, b) => outer.has(key(a, b)))) {
        g.p(x, y, CLOUD_INK.inner);
      } else if (beside(x, y, (a, b) => inside(a, b) && owner[b]![a]! < owner[y]![x]!)) {
        g.p(x, y, CLOUD_INK.dark);
      } else {
        g.p(x, y, CLOUD_INK.fill);
      }
    }
  }
  for (const [x0, y0] of CLOUD_WISPS) {
    for (let j = 0; j < Math.max(1, Math.floor(6 * sy + 0.5)); j++) {
      g.p(Math.floor(x0 * sx) + ((j + step) % 3) - 1, Math.floor(y0 * sy) + j, CLOUD_INK.wisp);
    }
  }
  return g;
}

// ---------- forced stops ----------

// The ice cream truck's drive: 4 frames of iceCreamTruck's roll, and their duration in ms.
export const TRUCK_DRIVE: readonly [readonly number[], number] = [[0, 1, 2, 3], 100];

// The ice cream truck from straight behind, a lane wide like obstacles.ts's delivery truck, laid out
// on 56x50 and drawn at TRUCK_SCALE to 56x60: a white box van lit along its top and left, its cone
// sign on the roof. The rear doors split down the middle, each with a window; a pink drip stripe runs
// across them; tall red tail lights sit at the outer corners, amber blinkers under them; then the
// plate, the bumper and both rear wheels. A mirror pokes out on the left and the serving hatch's
// striped awning on the right. f swaps the lit blinker and the white music note. roll (0 to 3) is a
// drive frame: tread lines climb the tires, the body dips 1px onto them on frames 1 and 2, the cone
// sign rocks on its post the other way, and a note floats up beside it. The road outline and the lit
// rim.
export function iceCreamTruck(f = 0, roll: number | null = null): Drawable {
  const g = edged(scope.Grid(56, 50));
  const px = raster(g);
  const uy = unit(g)[1];
  for (const x of [5, 42]) {
    g.rect(x, 39, 9, 10, "ink");
    g.rect(x, 39, 2, 9, "dslate");
    if (roll !== null) {
      treads(g, x + 2, 42, 7, 7, roll, uy);
    }
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = Array.from({ length: px.h }, () => Array<Colour>(px.w).fill(null));
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  const rock = roll !== null ? -dip : 0;
  // the cone sign on the roof: a tall waffle cone, lit tan and shaded ochre, under a pink scoop with a
  // cherry
  g.tri([23.5, 5.5 + rock], [32.5, 5.5 + rock], [28, 12.5 + rock], "tan");
  g.tri([28, 5.5 + rock], [32.5, 5.5 + rock], [28, 12.5 + rock], "ochre");
  g.ell(28, 4 + rock, 4.6, 2.6, "pink", "mauve", "white");
  g.rect(28, 0.5 + rock, 1.5, 1.5, "red");
  // the music note: left of the sign at rest (f 0) or right (f 1); driving, it floats up a row a frame
  let [nx, ny] = f === 0 ? [12, 4] : [41, 3];
  if (roll !== null) {
    [nx, ny] = roll < 2 ? [12, 5 - roll] : [41, 7 - roll];
  }
  g.rect(nx + 2, ny, 1, 6, "white");
  g.rect(nx + 2, ny, 3, 1, "white");
  g.rect(nx, ny + 5, 3, 2, "white");
  // the roof edge, then the box: lit along the top and the left, shaded down the right
  g.rect(5, 12, 46, 2, "lgrey");
  g.rect(5, 12, 46, 1, "white");
  g.rect(3, 14, 50, 25, "white");
  g.rect(49, 14, 4, 25, "lgrey");
  // a mirror on the left, the serving hatch's awning on the right, striped pink and white
  g.rect(0, 18, 3, 5, "dslate");
  g.rect(0, 18, 3, 1, "slate");
  for (let k = 0; k < 4; k++) {
    g.rect(53, 15 + k * 2, 2, 2, k % 2 === 0 ? "pink" : "white");
  }
  // the rear doors: a seam down the middle, a window in each, handles by the seam
  g.rect(27, 15, 2, 23, "lgrey");
  for (const x of [9, 31]) {
    g.rect(x, 16, 16, 9, "navy");
    g.rect(x, 16, 16, 1, "slate");
    g.tri([x + 3, 24], [x + 8, 17], [x + 11, 17], "slate");
  }
  g.rect(24, 27, 2, 3, "grey");
  g.rect(30, 27, 2, 3, "grey");
  // the drip stripe: a pink band with drips hanging from it
  g.rect(3, 30, 50, 3, "pink");
  g.rect(3, 32, 50, 1, "mauve");
  range(6, 50, 8).forEach((x, i) => {
    g.rect(x, 33, 2, 1 + (i % 2), "pink");
  });
  // tail lights up the outer corners, blinkers under them, the plate between
  for (const x of [4, 48]) {
    g.rect(x, 15, 4, 14, "red");
    g.rect(x, 15, 4, 1, "pink");
    g.rect(x + 3, 16, 1, 13, "dred");
  }
  g.rect(4, 34, 4, 3, f ? "yellow" : "amber");
  g.rect(48, 34, 4, 3, f ? "amber" : "yellow");
  g.rect(22, 34, 12, 4, "cream");
  g.rect(24, 35, 8, 1, "tan");
  // the bumper step across the full width
  g.rect(1, 38, 54, 3, "dslate");
  g.rect(1, 38, 54, 1, "slate");
  g.rect(1, 38, 1, 3, "grey");
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => (y >= dip ? body[y - dip]![x]! : null) || wheels[y]![x]!),
  );
  rim(px, LIT);
  return g;
}
