import { randomPick } from "@andornaut/game-kit/runtime/random";

import { dk } from "../pixel.ts";
import { Canvas, rgb } from "../scene.ts";
import {
  bands,
  BASE,
  CALM,
  crescentBend,
  CROSS,
  cross,
  crossLine,
  CX,
  FAR_WALK,
  fenceCat,
  flat,
  grass,
  H,
  hashed,
  hills,
  house,
  lanes,
  LINE,
  noise,
  type Paint,
  path,
  pixelAt,
  ROAD,
  type RoadPaint,
  roofline,
  rough,
  sky,
  slabs,
  SLIM,
  stream,
  street,
  STUB,
  tree,
  treeline,
  uniform,
  verge,
  W,
  window,
  word,
  yard,
  Z0,
} from "./common.ts";

// A wrought-iron front fence whose bars end on row y + 3: a bar every 3 columns under a top rail,
// every other bar topped with a spear.
function ironFence(
  cv: Canvas,
  y: number,
  x0: number,
  x1: number,
  { col = "coal", h = 9 }: { col?: string; h?: number } = {},
): void {
  for (let i = 0, x = x0; x < x1; i++, x += 3) {
    cv.fill(x, y + 4 - h, 1, h, col);
    if (i % 2 === 0) {
      cv.fill(x, y + 3 - h, 1, 1, col);
    }
  }
  cv.fill(x0, y + 5 - h, x1 - x0, 1, col);
  cv.fill(x0, y + 1, x1 - x0, 1, col);
}

// A heritage street lamp whose post stands on row y: a lantern lit gold.
function gasLamp(cv: Canvas, x: number, y: number, post = "coal"): void {
  cv.fill(x, y - 22, 2, 22, post);
  cv.fill(x - 1, y - 2, 4, 2, post);
  cv.fill(x - 2, y - 28, 6, 6, post);
  cv.fill(x - 1, y - 27, 4, 4, "gold");
  cv.fill(x - 1, y - 30, 4, 2, post);
}

// A Victorian bay-and-gable house on row base: a steep gable trimmed along both rakes, a two-storey
// bay window on its left half, a door on its right.
function bayGable(
  cv: Canvas,
  cx: number,
  w: number,
  wall: string,
  roof: string,
  door: string,
  base: number,
  { curtains, trim = "white" }: { curtains?: string | undefined; trim?: string } = {},
): void {
  const x = cx - Math.floor(w / 2);
  const top = base - 50;
  const roofH = 22;
  house(cv, x, w, wall, roof, { base, curtains, door, eave: 2, parts: SLIM, roofH, top });
  const half = w / 2 + 2;
  for (let i = 1; i < roofH; i++) {
    const inset = Math.round((i * half) / roofH);
    const left = x - 2 + (Math.floor(w / 2) + 2) - inset;
    cv.fill(left, top + i, 1, 1, trim);
    cv.fill(left + 2 * inset - 1, top + i, 1, 1, trim);
  }
  cv.fill(cx - 2, top + 8, 4, 5, "plum");
  cv.fill(cx - 1, top + 9, 2, 3, curtains || "cyan");
  // the bay: a box standing proud of the wall, three windows a storey, its right side in shade
  const bx = x + 2;
  const bw = Math.floor(w / 2) - 1;
  cv.fill(bx, top + roofH + 2, bw, base - top - roofH - 2, wall);
  cv.fill(bx + bw - 2, top + roofH + 2, 2, base - top - roofH - 2, dk(wall));
  cv.fill(bx - 1, top + roofH + 1, bw + 2, 1, trim);
  for (const wy of [top + roofH + 4, top + roofH + 16]) {
    for (let k = 0; k < 3; k++) {
      window(
        cv,
        bx + 1 + Math.floor((k * (bw - 2)) / 3),
        wy,
        Math.max(3, Math.floor((bw - 2) / 3) - 1),
        8,
        { curtains },
      );
    }
  }
  cv.fill(bx - 1, top + roofH + 14, bw + 2, 1, trim);
}

// The Necropolis chapel's tower between the roofs, from row top down to row base: red brick banded in
// stone under its belfry, buttresses below, lit lancets, a pinnacle on each corner, a slate spire
// spire rows tall narrowing in steps, and a cream cross.
function necropolis(cv: Canvas, cx: number, top: number, base: number, spire = 26): void {
  cv.fill(cx - 4, top, 9, base - top, "brick");
  cv.fill(cx + 3, top, 2, base - top, "dbrick");
  for (const y of [top + 2, top + 12, top + 13]) {
    cv.fill(cx - 4, y, 9, 1, "stone");
  }
  for (const x of [cx - 5, cx + 5]) {
    cv.fill(x, top + 14, 1, base - top - 14, "dbrick");
  }
  for (const [y, col] of [
    [top + 5, "gold"],
    [top + 18, "gold"],
    [base - 9, "walnut"],
  ] as const) {
    cv.fill(cx - 1, y, 3, 6, col);
    cv.fill(cx, y - 1, 1, 1, col);
  }
  cv.fill(cx - 5, top - 1, 11, 2, "dslate");
  for (const x of [cx - 5, cx + 5]) {
    cv.fill(x, top - 5, 1, 4, "dslate");
  }
  for (let k = 0; k < spire; k++) {
    const half = 3 - Math.floor((k * 4) / (spire + 1));
    cv.fill(cx - half, top - 2 - k, 2 * half + 1, 1, "dslate");
    cv.fill(cx - half, top - 2 - k, 1, 1, "slate");
  }
  cv.fill(cx, top - spire - 5, 1, 4, "cream");
  cv.fill(cx - 1, top - spire - 4, 3, 1, "cream");
}

// A mature street tree on row base: a 4-wide trunk under a wide crown of three lobes whose top row
// is top, the big one radius r over two smaller ones low on each side, shaded lower right.
function oldTree(
  cv: Canvas,
  cx: number,
  top: number,
  r: number,
  base: number,
  {
    leaf = "canopy",
    shade = "pine",
    trunk = "bark",
  }: { leaf?: string; shade?: string; trunk?: string } = {},
): void {
  const cy = top + r;
  const lobes = [
    [cx, cy, r],
    [cx - Math.round(r * 0.75), cy + Math.round(r * 0.45), Math.round(r * 0.7)],
    [cx + Math.round(r * 0.75), cy + Math.round(r * 0.5), Math.round(r * 0.68)],
  ] as const;
  cv.fill(cx - 2, cy, 4, base - cy, trunk);
  for (let px = cx - 2 * r; px < cx + 2 * r + 1; px++) {
    for (let py = top; py < cy + 2 * r; py++) {
      if (lobes.some(([lx, ly, lr]) => (px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2 <= lr * lr)) {
        const lit = px - cx + 1.2 * (py - cy);
        cv.fill(px, py, 1, 1, lit > r * 0.55 ? shade : leaf);
      }
    }
  }
}

// The downtown towers far off to the southwest, one flat silhouette of col standing on row base:
// flat-topped slabs of differing heights and the CN Tower's antenna, SkyPod, main pod and shaft.
function downtown(cv: Canvas, base: number, col = "violet"): void {
  for (const [x, w, top] of [
    [100, 8, 56],
    [108, 6, 50],
    [124, 8, 46],
    [132, 6, 52],
    [138, 8, 44],
    [146, 6, 54],
    [152, 8, 48],
    [160, 6, 56],
    [166, 8, 52],
    [174, 10, 58],
  ] as const) {
    cv.fill(x, top, w, base - top, col);
  }
  const tx = 118;
  cv.fill(tx - 1, 34, 2, base - 34, col);
  cv.fill(tx - 4, 36, 8, 3, col);
  cv.fill(tx - 3, 35, 6, 1, col);
  cv.fill(tx - 3, 39, 6, 1, col);
  cv.fill(tx - 2, 26, 4, 3, col);
  cv.fill(tx - 1, 29, 2, 5, col);
  cv.fill(tx - 1, 12, 1, 14, col);
}

// the Necropolis chapel's column: the gap between the second and third houses, left treeless
const CHAPEL = 87;
// the old trees behind the houses, in the gaps between them: (column, crown's top row, radius)
const OLD_TREES: readonly (readonly [number, number, number])[] = [
  [25, 42, 15],
  [211, 44, 14],
  [273, 40, 16],
  [335, 44, 14],
];
// the gap in front of the downtown towers, a young tree that leaves them in view
const YOUNG_TREE = 149;

function cabbagetown(): Canvas {
  const cv = new Canvas(W, H);
  // a lavender dusk, a last gold glow over the hills, a crescent moon and the first stars
  cv.fill(0, 0, W, CALM, "lilac");
  const rows = bands(cv, CALM, BASE - 36, ["lilac", "pink", "peach", "gold"]);
  cv.fill(0, BASE - 36, W, 36, "gold");
  for (let dy = -6; dy < 7; dy++) {
    for (let dx = -6; dx < 7; dx++) {
      if (dx * dx + dy * dy <= 36 && (dx + 3) ** 2 + (dy - 2) ** 2 > 25) {
        cv.fill(CX - 128 + dx, CALM + 10 + dy, 1, 1, "cream");
      }
    }
  }
  for (const [x, y] of [
    [40, 4],
    [96, 9],
    [162, 2],
    [212, 7],
    [262, 1],
    [344, 11],
    [120, 16],
    [300, 14],
    [186, 12],
  ] as const) {
    if (CALM - 12 + y < rows[0]![1] - 6) {
      cv.fill(x, CALM - 12 + y, 1, 1, "white");
    }
  }
  // far off, the downtown towers; then the old neighbourhood: brick roofs up a leafy rise, the
  // Necropolis chapel's spire
  downtown(cv, BASE - 30);
  hills(cv, BASE - 40, BASE, "canopy", "olive", 3.1, { amp: 6 });
  roofline(
    cv,
    BASE - 28,
    [
      [10, 16, 8],
      [40, 14, 6],
      [150, 16, 8],
      [212, 16, 9],
      [258, 16, 7],
      [282, 14, 9],
      [326, 18, 8],
    ],
    "dbrick",
  );
  necropolis(cv, CHAPEL, BASE - 56, BASE);

  const road: RoadPaint = (x, _z, _span, px, py) => {
    if (Math.abs(x) >= ROAD - 4) {
      return "stone";
    }
    return hashed(px, py, 53) ? "slate" : "grey";
  };

  const homes = [
    [-6, 44, "brick", "shale", "forest", undefined],
    [56, 44, "cream", "slate", "ttc", undefined],
    [118, 46, "brick", "dslate", "navy", "gold"],
    [180, 48, "dbrick", "shale", "forest", "gold"],
    [242, 46, "brick", "slate", "navy", undefined],
    [304, 44, "clay", "shale", "ttc", "gold"],
    [366, 44, "brick", "dslate", "forest", undefined],
  ] as const;
  for (const [cx, top, r] of OLD_TREES) {
    const rise = crescentBend(cx);
    oldTree(cv, cx, top - rise, r, BASE - rise);
  }
  const lift = crescentBend(YOUNG_TREE);
  tree(cv, YOUNG_TREE, BASE - 34 - lift, {
    base: BASE - lift,
    girth: 4,
    leaf: "canopy",
    r: 11,
    shade: "pine",
  });
  for (const [cx, w, wallC, roof, door, curtains] of homes) {
    bayGable(cv, cx, w, wallC, roof, door, BASE - crescentBend(cx), { curtains });
  }
  const lawn = grass("olive");
  yard(cv, BASE, FAR_WALK, lawn);
  for (let px = 0; px < W; px++) {
    for (let py = BASE - crescentBend(px); py < BASE; py++) {
      cv.fill(px, py, 1, 1, lawn(px, py));
    }
  }
  for (const [cx, w] of homes) {
    const x = cx - Math.floor(w / 2);
    path(cv, cx + 4, BASE - crescentBend(cx), FAR_WALK, "stone", "dstone");
    ironFence(cv, FAR_WALK - 4 - crescentBend(x), Math.max(0, x - 6), cx + 2);
    ironFence(cv, FAR_WALK - 4 - crescentBend(x + w), cx + 18, x + w + 6);
  }
  for (const [x, col, lit] of [
    [CX - 70, "plum", "purple"],
    [CX + 30, "orange", "amber"],
  ] as const) {
    fenceCat(cv, x, FAR_WALK - 9 - crescentBend(x + 3), col, lit);
  }
  for (const x of [CX - 150, CX - 30, CX + 92]) {
    gasLamp(cv, x, FAR_WALK + 1 - crescentBend(x));
  }
  cross(cv, flat(road), "stone", slabs, { bend: crescentBend, curb: "dstone" });
  crossLine(cv, "white", { bend: crescentBend, dash: [8, 64] });
  street(cv, verge("cabbagetown", road));
  lanes(cv, "white", { dash: [12, 64], edge: "slate" });
  return cv;
}

// A cherry tree in blossom on row base: a dark trunk under a wide crown of pink lobes, mauve on the
// lower right, white petals picked out on the lit upper left.
function cherry(cv: Canvas, cx: number, cy: number, r: number, base: number): void {
  cv.fill(cx - 1, cy, 2, base - cy, "dbrown");
  const lobes = [
    [cx - r, cy + 1, r * 0.8],
    [cx + r, cy + 1, r * 0.8],
    [cx, cy - 2, r],
  ] as const;
  for (let px = cx - 2 * r - 1; px < cx + 2 * r + 2; px++) {
    for (let py = cy - 2 * r; py < cy + r + 1; py++) {
      const d = Math.min(
        ...lobes.map(([lx, ly, lr]) => ((px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2) / lr ** 2),
      );
      if (d <= 1) {
        const lit = px - cx + 1.5 * (py - cy);
        const c = lit > r ? "mauve" : lit < -r * 1.2 && hashed(px, py, 3) ? "white" : "pink";
        cv.fill(px, py, 1, 1, c);
      }
    }
  }
}

// The castle playground's wooden towers over the trees, centred on cx and standing on row base: two
// round-topped towers under red cones with pennants, a crenellated wall between them, a lookout door.
function castle(cv: Canvas, cx: number, base: number): void {
  cv.fill(cx - 10, base - 14, 20, 14, "brown");
  for (let x = cx - 10; x < cx + 10; x += 4) {
    cv.fill(x, base - 16, 2, 2, "brown");
  }
  for (let x = cx - 9; x < cx + 10; x += 3) {
    cv.fill(x, base - 13, 1, 13, "dbrown");
  }
  cv.fill(cx - 2, base - 9, 4, 9, "walnut");
  for (const [tx, h] of [
    [cx - 13, 26],
    [cx + 10, 22],
  ] as const) {
    cv.fill(tx - 3, base - h, 7, h, "tan");
    cv.fill(tx + 2, base - h, 2, h, "brown");
    cv.fill(tx - 1, base - h + 5, 3, 4, "walnut");
    for (let k = 0; k < 7; k++) {
      const step = Math.floor(k / 2);
      cv.fill(tx - 4 + step, base - h - 1 - k, 9 - 2 * step, 1, "red");
    }
    cv.fill(tx - 4, base - h - 1, 9, 1, "dred");
    cv.fill(tx, base - h - 11, 1, 4, "coal");
    cv.fill(tx + 1, base - h - 11, 3, 2, "gold");
  }
}

// A hot dog cart by the zoo gate, side on with its wheels on row base: a stainless box with a
// counter, ketchup and mustard on it, under a red and yellow striped umbrella.
function hotDogCart(cv: Canvas, cx: number, base: number): void {
  for (let k = 0; k < 4; k++) {
    for (let x = cx - 2 - 2 * k; x < cx + 3 + 2 * k; x++) {
      cv.fill(x, base - 22 + k, 1, 1, Math.floor((x - cx + 9) / 3) % 2 ? "red" : "yellow");
    }
  }
  cv.fill(cx - 9, base - 18, 19, 1, "dred");
  cv.fill(cx, base - 18, 1, 8, "coal");
  cv.fill(cx - 7, base - 10, 15, 7, "lgrey");
  cv.fill(cx + 5, base - 10, 3, 7, "grey");
  cv.fill(cx - 7, base - 10, 15, 1, "white");
  cv.fill(cx - 6, base - 7, 9, 2, "red");
  cv.fill(cx - 5, base - 7, 2, 1, "yellow");
  cv.fill(cx - 5, base - 12, 1, 2, "red");
  cv.fill(cx - 3, base - 12, 1, 2, "yellow");
  for (const x of [cx - 5, cx + 4]) {
    cv.fill(x - 1, base - 3, 3, 3, "coal");
    cv.fill(x, base - 2, 1, 1, "ash");
  }
}

// A far wooded ridge in col: round treetops of radius about r along a rolling crest from row top
// (amp rows lower at its dips), filled down to row bottom.
function ridge(
  cv: Canvas,
  top: number,
  bottom: number,
  col: string,
  seed: number,
  { amp = 6, r = 4 }: { amp?: number; r?: number } = {},
): void {
  const rnd = stream(`ridge-${seed}`);
  const crest = Array.from(
    { length: W },
    (_, x) =>
      top + amp * (0.5 + 0.5 * Math.sin(x * 0.011 + seed) * Math.cos(x * 0.027 + seed * 2.1)),
  );
  const tops = Array<number>(W).fill(bottom);
  let cx = -r;
  while (cx < W + r) {
    const rr = r + randomPick(rnd, [-1, 0, 0, 1]);
    const cy = crest[Math.min(W - 1, Math.max(0, Math.round(cx)))]! + rr;
    for (let x = Math.max(0, Math.round(cx - rr)); x < Math.min(W, Math.round(cx + rr) + 1); x++) {
      const d = (x + 0.5 - cx) / rr;
      if (Math.abs(d) <= 1) {
        tops[x] = Math.min(tops[x]!, Math.round(cy - rr * Math.sqrt(1 - d * d)));
      }
    }
    cx += rr * 1.5;
  }
  for (let x = 0; x < W; x++) {
    cv.fill(x, tops[x]!, 1, bottom - tops[x]!, col);
  }
}

// A tall black oak of the savannah: a trunk on row base forking under a broad, ragged crown w wide
// of flat-bottomed lobes, its top on row top; hi on the lit upper left, shade on the lower right and
// along each lobe's underside.
function oak(
  cv: Canvas,
  cx: number,
  top: number,
  w: number,
  base: number,
  seed: number,
  {
    hi = "olive",
    lit = "canopy",
    shade = "pine",
    trunk = "bark",
  }: { hi?: string; lit?: string; shade?: string; trunk?: string } = {},
): void {
  const rnd = stream(`oak-${seed}`);
  const h = Math.round(w * 0.62);
  const lobes: [number, number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const lx = cx + ((i - 2.5) / 2.5) * w * 0.36 + uniform(rnd, -2, 2);
    const ly = top + h * 0.5 + Math.abs(i - 2.5) * h * 0.08 + uniform(rnd, -2, 2);
    const rx = w * uniform(rnd, 0.2, 0.26);
    const ry = h * uniform(rnd, 0.32, 0.4);
    lobes.push([lx, ly, rx, ry]);
  }
  lobes.push([cx + uniform(rnd, -3, 3), top + h * 0.36, w * 0.24, h * 0.36]);
  const under = top + h;
  cv.fill(cx - 2, under - 6, 4, base - under + 6, trunk);
  for (let k = 0; k < 8; k++) {
    cv.fill(cx - 3 - k, under - 2 - k, 2, 2, trunk);
    cv.fill(cx + 2 + k, under - 3 - k, 2, 2, trunk);
  }
  for (let py = top - 2; py < under + 2; py++) {
    for (let px = Math.round(cx - w / 2) - 3; px < Math.round(cx + w / 2) + 4; px++) {
      const inside = lobes.filter(
        ([lx, ly, rx, ry]) =>
          ((px + 0.5 - lx) / rx) ** 2 + ((py + 0.5 - ly) / ry) ** 2 <= 1 && py < ly + ry * 0.6,
      );
      if (inside.length === 0) {
        continue;
      }
      // the highest lobe, the first on a tie
      const [lx, ly, rx, ry] = inside.reduce((best, q) => (q[1] < best[1] ? q : best));
      const u = (px + 0.5 - lx) / rx;
      const v = (py + 0.5 - ly) / ry;
      const c = v > 0.25 || u + v > 0.9 ? shade : u + v < -0.75 && v < -0.2 ? hi : lit;
      cv.fill(px, py, 1, 1, c);
    }
  }
}

// The zoo's animals, side on and facing left, as rows of fills: a bison (walnut forequarters and
// hump, bark hindquarters, a cream horn) and a llama (cream, driftwood on its shaded right and
// underside and its far legs).
const BISON: readonly string[] = [
  "......wwww..........",
  "....wwwwwwww........",
  "...wwwwwwwwwwbbbbb..",
  "..wwwwwwwwwwwbbbbbbb",
  ".hwwwwwwwwwwwbbbbbbb",
  "hwwwwwwwwwwwwbbbbbbd",
  "wwwwwwwwwwwwwbbbbbbd",
  "wwwww.wwwwwwwbbbbbd.",
  ".www..wwwwwwwddddd..",
  ".ww...ww.ww...dd.dd.",
  "......ww.ww...dd.dd.",
  "......ww.ww...dd.dd.",
];
const BISON_COLOURS: Readonly<Record<string, string>> = {
  b: "bark",
  d: "walnut",
  h: "cream",
  w: "walnut",
};
const LLAMA: readonly string[] = [
  ".c.c........",
  ".ccc........",
  "cccc........",
  ".ccs........",
  ".ccs........",
  ".ccs........",
  ".ccs........",
  ".cccccccccc.",
  "cccccccccccs",
  ".ccccccccccs",
  "..ssssssssss",
  "..cs.....cs.",
  "..cs.....cs.",
  "..cs.....cs.",
];
const LLAMA_COLOURS: Readonly<Record<string, string>> = { c: "cream", s: "driftwood" };

// A figure drawn from rows of characters, its left column on x and its bottom row on row base: each
// character a colour from cols, '.' left clear.
function figure(
  cv: Canvas,
  x: number,
  base: number,
  rows: readonly string[],
  cols: Readonly<Record<string, string>>,
): void {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        cv.fill(x + i, base - rows.length + j, 1, 1, cols[ch]!);
      }
    });
  });
}

// A split-rail paddock fence on row base, columns x0 to x1 - 1: bark posts h rows tall every every
// columns and at the far end, two tan rails with brown under them.
function splitRail(
  cv: Canvas,
  x0: number,
  x1: number,
  base: number,
  { every = 10, h = 10 }: { every?: number; h?: number } = {},
): void {
  for (const y of [base - h + 2, base - Math.floor(h / 2) + 1]) {
    cv.fill(x0, y, x1 - x0, 1, "tan");
    cv.fill(x0, y + 1, x1 - x0, 1, "brown");
  }
  const posts: number[] = [];
  for (let x = x0; x < x1 - 1; x += every) {
    posts.push(x);
  }
  for (const x of [...posts, x1 - 2]) {
    cv.fill(x, base - h, 2, h, "bark");
  }
}

// The High Park Zoo's entrance at the trail's end, standing on row BASE + 6: grazed olive paddocks
// behind split rails either side, a bison in the left one and a llama in the right; a closed plank
// double gate, each leaf Z-braced, between two log posts under a log crossbeam with cut ends; and a
// plank sign hung from the beam, HIGH PARK ZOO in cream.
function zooGate(cv: Canvas): void {
  for (let py = BASE - 12; py < BASE + 6; py++) {
    for (let px = 118; px < 244; px++) {
      cv.fill(px, py, 1, 1, noise(px, py) < 0.04 || noise(px, py - 1) < 0.04 ? "dolive" : "olive");
    }
  }
  splitRail(cv, 118, 244, BASE - 10, { every: 12, h: 7 });
  figure(cv, 126, BASE - 1, BISON, BISON_COLOURS);
  figure(cv, 216, BASE - 1, LLAMA, LLAMA_COLOURS);
  for (const [x0, x1] of [
    [118, CX - 30],
    [CX + 30, 244],
  ] as const) {
    splitRail(cv, x0, x1, BASE + 6);
  }
  for (const gx of [CX - 26, CX]) {
    cv.fill(gx, BASE - 6, 26, 12, "tan");
    for (let k = gx + 3; k < gx + 26; k += 4) {
      cv.fill(k, BASE - 6, 1, 12, "brown");
    }
    cv.fill(gx, BASE - 5, 26, 2, "brown");
    cv.fill(gx, BASE + 2, 26, 2, "brown");
    cv.line(gx + 1, BASE + 2, gx + 24, BASE - 4, "brown");
  }
  cv.fill(CX - 1, BASE - 6, 2, 12, "walnut");
  for (const x of [CX - 31, CX + 27]) {
    cv.fill(x, BASE - 34, 5, 40, "bark");
    cv.fill(x + 4, BASE - 34, 1, 40, "walnut");
    cv.fill(x, BASE - 34, 5, 1, "tan");
  }
  cv.fill(CX - 38, BASE - 38, 76, 4, "bark");
  cv.fill(CX - 38, BASE - 35, 76, 1, "walnut");
  for (const x of [CX - 38, CX + 35]) {
    cv.fill(x, BASE - 38, 3, 4, "tan");
    cv.fill(x + 1, BASE - 37, 1, 2, "skin2");
  }
  for (const x of [CX - 30, CX + 29]) {
    cv.fill(x, BASE - 34, 1, 3, "walnut");
  }
  cv.fill(CX - 41, BASE - 31, 82, 12, "walnut");
  cv.fill(CX - 40, BASE - 30, 80, 10, "brown");
  cv.fill(CX - 40, BASE - 30, 80, 1, "tan");
  word(cv, "HIGH PARK ZOO", CX, BASE - 29, "cream");
}

function highPark(): Canvas {
  const cv = new Canvas(W, H);
  // a deep clear blue, two white clouds high over the oaks
  sky(cv, {
    clouds: [
      [CX - 70, 30, 46, 8],
      [CX + 62, 22, 40, 6],
    ],
    low: "sky",
    top: "azure",
  });
  // a far wooded ridge, dturq in the haze, then the park's dense canopy over the near hills: dark
  // green rises and a fir tree line
  ridge(cv, BASE - 70, BASE - 40, "dturq", 1.3, { amp: 12, r: 5 });
  hills(cv, BASE - 54, BASE - 18, "pine", "canopy", 0.4, { amp: 8 });
  treeline(cv, BASE - 34, ["fir", "pine"], 0.9, 3, 8);
  // the black oaks of the savannah stand tall over the canopy at the band's edges and by the pond
  for (const [cx, top, w, seed] of [
    [40, BASE - 92, 64, 1],
    [CX + 150, BASE - 86, 58, 2],
    [112, BASE - 72, 36, 3],
  ] as const) {
    oak(cv, cx, top, w, BASE - 26, seed);
  }
  const patches = [
    [60, BASE - 26, 30, 2],
    [CX + 40, BASE - 24, 24, 2],
    [CX - 50, BASE - 12, 26, 3],
    [CX - 24, BASE - 10, 20, 2],
    [CX + 100, BASE - 5, 30, 3],
    [CX + 128, BASE - 2, 18, 3],
    [40, BASE + 6, 24, 2],
  ] as const;

  const lawn: Paint = (px, py) => {
    let c = "pine";
    if (patches.some(([qx, qy, rx, ry]) => ((px - qx) / rx) ** 2 + ((py - qy) / ry) ** 2 <= 1)) {
      c = "canopy";
    }
    return grass(c, 0.03 * (Math.max(0, py - (BASE - 40)) / (H - BASE + 40)) ** 2)(px, py);
  };

  yard(cv, BASE - 33, CROSS, lawn);
  treeline(cv, BASE - 20, ["pine", "canopy"], 2.5, 3, 9);
  // Grenadier Pond on the left, reeds along its near bank, a cherry in blossom over it
  for (let py = BASE - 16; py < BASE - 1; py++) {
    for (let px = 0; px < 118; px++) {
      const e = ((px + 0.5 - 54) / 60) ** 2 + ((py + 0.5 - (BASE - 8)) / 7.5) ** 2;
      if (e <= 1) {
        const c = py < BASE - 13 ? "dlake" : e > 0.4 ? "lake" : "shallow";
        cv.fill(px, py, 1, 1, hashed(Math.floor(px / 2), py, 13) && py % 2 === 0 ? "foam" : c);
      }
    }
  }
  for (let x = 6; x < 110; x += 5) {
    const h = 3 + ((x * 7) % 4);
    cv.fill(x, BASE - 1 - h, 1, h, "olive");
    cv.fill(x + 2, BASE - h, 1, h - 1, "moss");
  }
  for (const [cx, top, r, leaf, shade] of [
    [8, BASE - 30, 10, "pink", "mauve"],
    [118, BASE - 30, 9, "pine", "fir"],
    [CX + 100, BASE - 30, 9, "olive", "dolive"],
    [352, BASE - 28, 9, "pine", "fir"],
  ] as const) {
    tree(cv, cx, top, { base: BASE - 14, girth: 4, leaf, r, shade });
  }
  castle(cv, CX + 112, BASE - 15);
  for (const [cx, r] of [
    [CX - 30, 8],
    [CX + 30, 8],
    [CX + 64, 8],
    [CX + 84, 6],
    [CX + 166, 7],
  ] as const) {
    tree(cv, cx, BASE - 17 - 2 * r - (r < 8 ? 2 : 0), {
      base: BASE - 14 - (r < 8 ? 4 : 0),
      girth: 3,
      leaf: cx % 2 ? "canopy" : "pine",
      r,
      shade: "fir",
    });
  }
  // the cherry trees in blossom along Grenadier Pond's far bank, their petals on the water
  for (const [cx, r] of [
    [34, 6],
    [62, 7],
    [92, 6],
  ] as const) {
    cherry(cv, cx, BASE - 16 - r, r, BASE - 14);
  }
  for (let px = 20; px < 104; px++) {
    for (let py = BASE - 13; py < BASE - 9; py++) {
      if (hashed(px, py, 17) && Math.abs(((px - 20) % 29) - 14) < 9) {
        cv.fill(px, py, 1, 1, "pink");
      }
    }
  }
  for (const [cx, top, r, leaf, shade] of [
    [CX - 80, BASE - 28, 13, "canopy", "pine"],
    [CX + 150, BASE - 30, 14, "canopy", "pine"],
    [-2, BASE - 24, 15, "olive", "dolive"],
  ] as const) {
    tree(cv, cx, top, { base: BASE + 4, leaf, r, shade, trunk: "bark" });
  }
  // the High Park Zoo at the end of the trail, its sign facing the street, lamps either side
  zooGate(cv);
  for (const x of [CX - 66, CX + 66]) {
    cv.fill(x, BASE - 18, 2, 24, "coal");
    cv.fill(x - 4, BASE - 24, 10, 7, "coal");
    cv.fill(x - 2, BASE - 22, 6, 4, "gold");
  }
  hotDogCart(cv, CX + 84, BASE + 3);

  // The trail's packed earth: tan, flecked brown and skin2, skin1 where feet wear it.
  function dirt(px: number, py: number, worn = false): string {
    if (hashed(px, py, 31)) {
      return "brown";
    }
    if (hashed(px, py + 5, 37)) {
      return "skin2";
    }
    return worn ? "skin1" : "tan";
  }

  const trail: RoadPaint = (x, _z, _span, px, py) => {
    const a = Math.abs(x);
    if (a >= ROAD - 5) {
      return "pine";
    }
    if (a >= ROAD - 6) {
      return "brown";
    }
    const lane = ((x + ROAD) % 64) - 32;
    return dirt(px, py, Math.abs(lane) < 5 && noise(Math.floor(px / 3), Math.floor(py / 2)) < 0.7);
  };

  // the trail up to the zoo gate's foot, where it ends, its worn middle drifting, ragged brown edges
  for (let py = BASE + 6; py < CROSS; py++) {
    const half = 18 + Math.floor((py - BASE + 8) / 3) + (hashed(0, py, 3) ? 1 : 0);
    cv.fill(CX - half, py, 2 * half, 1, "brown");
    for (let px = CX - half + 1; px < CX + half - 1; px++) {
      const drift = py % 7 > 3 ? 1 : 0;
      cv.fill(
        px,
        py,
        1,
        1,
        dirt(px, py, Math.abs(px + 0.5 - CX - drift) < 6 + Math.floor((py - BASE) / 4)),
      );
    }
  }
  // the cross path, packed earth with no line painted on it: a skin1 strip worn along its middle,
  // broken where the grass edges hold
  cross(cv, () => "tan", "brown", lawn, { curb: null, top: CROSS });
  for (let px = 0; px < W; px++) {
    if (noise(Math.floor(px / 6), 3) < 0.75) {
      cv.fill(px, LINE - 1, 1, 2, "skin1");
    }
    if (hashed(px, LINE + 2, 9)) {
      cv.fill(px, LINE + 2 + (px % 3 === 0 ? 1 : 0), 1, 1, "skin2");
    }
  }
  // grass tufts break the path's edges
  const brown = rgb("brown").join(",");
  for (let py = CROSS; py < STUB; py++) {
    for (let px = 0; px < W; px++) {
      if (pixelAt(cv, px, py) === brown && hashed(px, py, 4)) {
        cv.fill(px, py, 1, 1, "pine");
      }
    }
  }
  const roughPatches = rough("high-park-lawn", 10, ROAD + 30, ROAD + 460, Z0 + 10, Z0 + 90);
  street(cv, verge("high-park", trail, roughPatches));
  return cv;
}

export { bayGable, cabbagetown, figure, gasLamp, highPark, ironFence, LLAMA_COLOURS };
