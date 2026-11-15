import { randomInt, randomPick } from "@andornaut/game-kit/runtime/random";

import { signWidth } from "../fonts.ts";
import { dk, K } from "../pixel.ts";
import { Canvas, rgb } from "../scene.ts";
import {
  BASE,
  CROSS,
  cross,
  crosses,
  crossLine,
  CX,
  FAR_WALK,
  flat,
  H,
  hashed,
  lanes,
  NEAR_CURB,
  outlineBox,
  type Paint,
  pixelAt,
  ROAD,
  type RoadPaint,
  stream,
  street,
  sunset,
  verge,
  W,
  word,
  yard,
} from "./common.ts";

// The CN Tower close up, each row's half-width from the top: the SkyPod, then the main pod, a cap
// over a skirt of window rings, its underside narrowing into the shaft.
const CN_SKY_POD: readonly number[] = [3, 5, 6, 6, 5, 4];
const CN_POD: readonly number[] = [9, 14, 17, 19, 20, 21, 21, 21, 21, 20, 18, 15, 12, 9, 7, 5];

// The CN Tower at night, huge and close, the tallest structure in the city, centred on column cx, in
// an ink outline, lgrey lit white on its left and grey in shade on its right: its antenna, 2 columns
// wide, runs off the band's top down to the SkyPod (CN_SKY_POD) on row skyPod, with its ring of lit
// 2x2 windows; a 7-column shaft on to the main pod (CN_POD), 43 wide, on row pod, a white cap, a ring
// of lit 2x2 windows gold and amber at its widest, a ring of cream ones under a grey band, its
// underside in shade; then the shaft flares from 9 columns under the pod to 29 at the street,
// widening faster toward its foot as the real tower's three legs do, down to row base.
function cnTower(cv: Canvas, cx: number, base: number, skyPod: number, pod: number): void {
  const rows = new Map<number, number>();
  for (let y = 0; y < skyPod; y++) {
    rows.set(y, 0);
  }
  CN_SKY_POD.forEach((half, k) => rows.set(skyPod + k, half));
  for (let y = skyPod + CN_SKY_POD.length; y < pod; y++) {
    rows.set(y, 3);
  }
  CN_POD.forEach((half, k) => rows.set(pod + k, half));
  const low = pod + CN_POD.length;
  for (let y = low; y < base; y++) {
    rows.set(y, 4 + Math.round(10 * ((y - low) / Math.max(1, base - 1 - low)) ** 1.6));
  }
  const inside = new Set<string>();
  for (const [y, half] of rows) {
    for (let x = cx - half; x < cx + Math.max(half, 1) + 1; x++) {
      inside.add(`${x},${y}`);
    }
  }
  for (const key of inside) {
    const [x = 0, y = 0] = key.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (!inside.has(`${x + dx},${y + dy}`) && y + dy >= 0) {
        cv.fill(x + dx, y + dy, 1, 1, "ink");
      }
    }
  }
  for (const [y, half] of rows) {
    const right = Math.max(half, 1);
    cv.fill(cx - half, y, half + right + 1, 1, "lgrey");
    cv.fill(cx - half, y, 1 + (half > 2 ? 1 : 0), 1, "white");
    const shade = Math.max(1, Math.min(right, Math.floor(right / 3) + 1));
    cv.fill(cx + right - shade + 1, y, shade, 1, "grey");
  }
  // the SkyPod's window ring
  for (let k = 0, x = cx - 4; x < cx + 5; k++, x += 3) {
    cv.fill(x, skyPod + 2, 2, 2, ["cream", "gold"][k % 2]!);
  }
  // the pod: a white cap, a ring of gold and amber windows at its widest, a grey band, a ring of
  // cream windows, the underside in shade
  cv.fill(cx - 14, pod + 2, 29, 2, "white");
  for (let k = 0, x = cx - 19; x < cx + 19; k++, x += 3) {
    cv.fill(x, pod + 5, 2, 2, ["gold", "amber"][k % 2]!);
  }
  cv.fill(cx - 21, pod + 8, 43, 1, "grey");
  for (let x = cx - 18; x < cx + 18; x += 3) {
    cv.fill(x, pod + 10, 2, 2, "cream");
  }
  CN_POD.slice(12).forEach((half, k) => {
    cv.fill(cx - half, pod + 12 + k, 2 * half + 1, 1, "grey");
  });
}

// A rooftop antenna h rows tall from row top, a red light at its tip.
function mast(cv: Canvas, cx: number, top: number, h: number): void {
  cv.fill(cx, top, 1, h, "ash");
  cv.fill(cx, top, 1, 1, "red");
}

// Scotia Plaza: red granite in brick and dbrick facets, its top stepped down to a chevron notch, a
// few windows lit.
function scotia(cv: Canvas, x: number, w: number, top: number): void {
  for (let k = 0; k < Math.floor(w / 2); k++) {
    const notch = Math.floor(Math.abs(Math.floor(w / 4) - k) / 2);
    cv.fill(x + k, top + notch, 1, BASE - top, "brick");
    cv.fill(x + w - 1 - k, top + notch, 1, BASE - top, "dbrick");
  }
  for (let c = x + 2; c < x + w - 2; c += 3) {
    cv.fill(c, top + 6, 1, BASE - top - 6, "dbrick");
  }
  lit(cv, x + 3, x + w - 3, top + 7, BASE, "scotia", 0.15, ["gold", "amber"]);
  cv.fill(x, top, 1, BASE - top, "coal");
  cv.fill(x + w - 1, top, 1, BASE - top, "coal");
}

// A full moon: a haze disc lit white on its upper left, three lgrey seas.
function fullMoon(cv: Canvas, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy < r + 1; dy++) {
    for (let dx = -r; dx < r + 1; dx++) {
      if (dx * dx + dy * dy <= r * (r + 1)) {
        cv.fill(cx + dx, cy + dy, 1, 1, dx + dy < -r ? "white" : "haze");
      }
    }
  }
  for (const [dx, dy, w] of [
    [0, -2, 2],
    [-2, 1, 2],
    [1, 2, 2],
  ] as const) {
    cv.fill(cx + dx, cy + dy, w, 1, "lgrey");
  }
}

// Lit windows across columns x0..x1 and rows y0..y1 in blocks, never speckle: a floor every 4 rows,
// a 2x2 window every 3 columns, lit in runs of 2 to 4 windows of one colour; rate sets how many.
function lit(
  cv: Canvas,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  seed: string,
  rate: number,
  cols: readonly string[] = ["gold", "amber", "cream"],
): void {
  const rnd = stream(`lit-${seed}`);
  for (let y = y0; y < y1 - 1; y += 4) {
    let run = 0;
    let col = "";
    for (let x = x0; x < x1 - 1; x += 3) {
      if (run === 0 && rnd() < rate * 0.45) {
        run = randomInt(rnd, 2, 5);
        col = randomPick(rnd, cols);
      }
      if (run) {
        cv.fill(x, y, 2, 2, col);
        run -= 1;
      }
    }
  }
}

// A tower behind the front row: (x, w, top, wall).
type Tower = readonly [x: number, w: number, top: number, wall: string];

// The towers behind the front row: silhouettes standing on BASE, with runs of lit windows, gold and
// amber and a few pink and cyan.
function skyline(cv: Canvas, towers: readonly Tower[]): void {
  towers.forEach(([x, w, top, wall], k) => {
    cv.fill(x, top, w, BASE - top, wall);
    lit(cv, x + 2, x + w - 1, top + 3, BASE, `far-${k}`, 0.3, [
      "gold",
      "amber",
      "gold",
      "amber",
      "pink",
      "cyan",
    ]);
  });
}

// The SkyDome far off, in the far landmarks' haze: a dome ry rows tall on row wall, its four panels'
// seams lgrey arcs nested at its right foot, lit white along its upper left, an ink line along its
// top arc so it reads apart from light scenery behind it. Its foot stays hidden behind the nearer
// towers.
function skydome(cv: Canvas, x: number, w: number, wall: number, ry: number): void {
  const rx = w / 2;

  function inside(px: number, py: number, r: number): boolean {
    const dx = (px + 0.5 - (x + w - r)) / r;
    const dy = (py + 0.5 - wall) / (ry * (r / rx) ** 0.5);
    return dx * dx + dy * dy <= 1;
  }

  for (let py = wall - ry; py < wall; py++) {
    for (let px = x; px < x + w; px++) {
      if (!inside(px, py, rx)) {
        continue;
      }
      let c = !inside(px - 1, py - 1, rx) && px < x + w * 0.6 ? "white" : "haze";
      for (const r of [rx * 0.75, rx * 0.5, rx * 0.25]) {
        if (inside(px, py, r) && !inside(px - 1, py, r)) {
          c = "lgrey";
        }
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
  for (let px = x; px < x + w; px++) {
    let rim: number | undefined;
    for (let py = wall - ry; py < wall; py++) {
      if (inside(px, py, rx)) {
        rim = py;
        break;
      }
    }
    if (rim !== undefined) {
      cv.fill(px, rim - 1, 1, 1, "ink");
      if (px > x && !inside(px - 1, rim, rx)) {
        cv.fill(px - 1, rim, 1, 1, "ink");
      }
      if (px < x + w - 1 && !inside(px + 1, rim, rx)) {
        cv.fill(px + 1, rim, 1, 1, "ink");
      }
    }
  }
}

// A tower's stepped top: steps rows each 2 columns narrower a side, above row top.
function crown(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  wall: string,
  line = "coal",
  steps = 2,
): void {
  for (let k = 1; k < steps + 1; k++) {
    cv.fill(x + 2 * k, top - k, w - 4 * k, 1, line);
    cv.fill(x + 2 * k + 1, top - k + 1, w - 4 * k - 2, 1, wall);
  }
}

// A Royal Bank Plaza tower: gold glass in sawtooth facets, a gold and amber pair lit and ochre in
// shade every 4 columns, ochre floors every 3 rows.
function royalBank(cv: Canvas, x: number, w: number, top: number): void {
  crown(cv, x, w, top, "gold");
  for (let c = x + 1; c < x + w - 1; c++) {
    cv.fill(c, top + 1, 1, BASE - top - 1, ["gold", "gold", "amber", "ochre"][(c - x) % 4]!);
  }
  for (let y = top + 3; y < BASE; y += 3) {
    cv.fill(x + 1, y, w - 2, 1, "ochre");
  }
  cv.fill(x + w - 3, top + 1, 2, BASE - top - 1, "ochre");
  outlineBox(cv, x, top, w, BASE - top + 1, "coal");
}

// First Canadian Place: white marble, grey fins every 3 columns, its notched corners in grey, the red
// BMO band at the top.
function firstCanadian(cv: Canvas, x: number, w: number, top: number): void {
  crown(cv, x, w, top, "lgrey", "coal", 1);
  cv.fill(x, top, w, BASE - top, "lgrey");
  for (let c = x + 3; c < x + w - 3; c += 3) {
    cv.fill(c, top + 5, 1, BASE - top - 5, "grey");
  }
  cv.fill(x + 1, top + 1, 2, BASE - top - 1, "white");
  cv.fill(x + w - 3, top + 1, 2, BASE - top - 1, "grey");
  cv.fill(x + 2, top + 1, w - 4, 3, "ttc");
  cv.fill(x + Math.floor(w / 2) - 3, top + 2, 6, 1, "white");
  lit(cv, x + 4, x + w - 4, top + 7, BASE, "fcp", 0.18, ["cream", "gold"]);
  outlineBox(cv, x, top, w, BASE - top + 1, "slate");
}

// A TD Centre tower: black steel and bronze glass, coal in an ink grid every 3 columns and rows,
// whole runs of each floor lit, the green logo near the top and an ash edge to the light.
function dominion(cv: Canvas, x: number, w: number, top: number, seed: number): void {
  cv.fill(x, top, w, BASE - top, "coal");
  for (let c = x + 3; c < x + w - 1; c += 3) {
    cv.fill(c, top + 1, 1, BASE - top - 1, "ink");
  }
  const rnd = stream(`td-${seed}`);
  for (let y = top + 6; y < BASE; y += 3) {
    let run = 0;
    for (let c = x + 1; c < x + w - 2; c += 3) {
      run = run === 0 && rnd() < 0.4 ? randomInt(rnd, 2, 6) : Math.max(0, run - 1);
      if (run) {
        cv.fill(c, y, 2, 1, randomPick(rnd, ["gold", "amber", "cream"]));
      }
    }
  }
  cv.fill(x + 2, top + 2, 3, 3, "green");
  cv.fill(x + 3, top + 3, 1, 1, "white");
  outlineBox(cv, x, top, w, BASE - top + 1, "ink");
  cv.fill(x, top, 1, BASE - top, "ash");
  cv.fill(x, top, w - 1, 1, "ash");
}

// A glass tower at night: dark glass, a floor line every 3 rows, its right side in shade, some
// floors' windows lit.
function glassTower(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  seed: number,
  glass = "dlake",
  line = "ink",
): void {
  cv.fill(x, top, w, BASE - top, glass);
  for (let y = top + 2; y < BASE; y += 3) {
    cv.fill(x + 1, y, w - 2, 1, dk(glass));
  }
  cv.fill(x + w - 3, top, 3, BASE - top, dk(glass));
  lit(cv, x + 2, x + w - 3, top + 3, BASE, `glass-${seed}`, 0.35, ["gold", "amber", "foam"]);
  outlineBox(cv, x, top, w, BASE - top + 1, line);
  cv.fill(x + 1, top + 1, 1, BASE - top - 1, "lake");
}

// Screen art: drawn on the screen x, y, w, h in big shapes.
type ScreenArt = (cv: Canvas, x: number, y: number, w: number, h: number) => void;

// A video screen: back inside an ink frame 1px round it, and art on it.
function screen(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  back: string,
  art?: ScreenArt,
): void {
  cv.fill(x - 1, y - 1, w + 2, h + 2, "ink");
  cv.fill(x, y, w, h, back);
  if (art) {
    art(cv, x, y, w, h);
  }
}

// A paw print, 11 by 10: four toe beans over the pad.
const PAW: readonly string[] = [
  "..##...##..",
  ".####.####.",
  ".####.####.",
  "..##...##..",
  "##.......##",
  "##..###..##",
  "...#####...",
  "..#######..",
  "..#######..",
  "...##.##...",
];

// A white paw print in the middle of a screen.
function pawArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const px = x + Math.floor((w - PAW[0]!.length) / 2);
  const py = y + Math.floor((h - PAW.length) / 2);
  PAW.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        cv.fill(px + i, py + j, 1, 1, "white");
      }
    });
  });
}

// Screen art: text in the sign letters, centred on the screen.
function wordArt(text: string, col: string): ScreenArt {
  return (cv, x, y, w, h) => {
    word(cv, text, x + w / 2, y + Math.floor((h - 8) / 2), col);
  };
}

// The Yonge-Dundas tower: shale from row top with runs of lit windows over its wall of screens, low
// enough to show while a message is up: the giant LIVE! screen at 2x on cobalt over blue from row 62
// and, under it, three ads (EAT on red, a paw print on turquoise, NEW on hot pink).
function dundasScreens(cv: Canvas, x: number, w: number, top: number): void {
  cv.fill(x, top, w, BASE - top, "shale");
  outlineBox(cv, x, top, w, BASE - top + 1, "ink");
  lit(cv, x + 2, x + w - 3, top + 3, 59, "dundas", 0.5, ["gold", "amber"]);
  const sx = x + 3;
  const sw = w - 6;
  const sy = 62;
  const sh = 17;
  screen(cv, sx, sy, sw, sh, "cobalt");
  cv.fill(sx, sy + sh - 6, sw, 6, "blue");
  word(cv, "LIVE!", x + w / 2, sy, "gold", { scale: 2 });
  const ay = sy + sh + 3;
  const aw = Math.floor((sw - 4) / 3);
  (
    [
      ["ttc", wordArt("EAT", "white")],
      ["turquoise", pawArt],
      ["hot", wordArt("NEW", "white")],
    ] as const
  ).forEach(([back, art], k) => {
    screen(cv, sx + k * (aw + 2), ay, aw, 11, back, art);
  });
}

// A tower's lit podium seen from far off, rows BASE - 18 to BASE: coal under an ash top edge, its
// floors lit in runs of 2x2 windows, gold, amber and cream, with no doors or shopfronts; and over it
// a neon sign, (word, colour), on an ink board edged in its colour.
function streetLevel(
  cv: Canvas,
  x: number,
  w: number,
  seed: number,
  signOf?: readonly [string, string] | null,
): void {
  cv.fill(x, BASE - 18, w, 18, "coal");
  cv.fill(x, BASE - 18, w, 1, "ash");
  lit(cv, x + 2, x + w - 2, BASE - 14, BASE, `podium-${seed}`, 1.2, ["gold", "amber", "cream"]);
  if (signOf) {
    const [s, col] = signOf;
    const bw = signWidth(s) + 4;
    const bx = Math.round(x + w / 2 - bw / 2);
    cv.fill(bx, BASE - 17, bw, 9, "ink");
    outlineBox(cv, bx, BASE - 17, bw, 9, col);
    word(cv, s, x + w / 2, BASE - 17, col);
  }
}

// A lit podium's light on the far sidewalk, rows BASE to FAR_WALK, under columns x0 to x1: stone on
// its first 2 rows inside a dstone edge, each row out a column wider a side, with no pixel in the
// column ranges skip (the side street's mouth).
function frontPool(
  cv: Canvas,
  x0: number,
  x1: number,
  skip: readonly (readonly [number, number])[] = [],
): void {
  const rows = FAR_WALK - BASE;
  for (let k = 0; k < rows; k++) {
    const a = x0 + (rows - 1 - k);
    const z = x1 - (rows - 1 - k);
    for (let x = Math.max(0, a); x < Math.min(W, z); x++) {
      if (skip.some(([lo, hi]) => lo <= x && x <= hi)) {
        continue;
      }
      cv.fill(x, BASE + k, 1, 1, k < 2 && a + 2 <= x && x < z - 2 ? "stone" : "dstone");
    }
  }
}

// A 2px-deep border of marquee bulbs round the box x, y, w, h: 2x2 bulbs every 4 px on ink, the
// colours in turn.
function bulbs(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: readonly string[] = ["gold", "cream"],
): void {
  for (const [fx, fy, fw, fh] of [
    [x, y, w, 2],
    [x, y + h - 2, w, 2],
    [x, y, 2, h],
    [x + w - 2, y, 2, h],
  ] as const) {
    cv.fill(fx, fy, fw, fh, "ink");
  }
  let k = 0;
  for (let px = x; px < x + w - 1; px += 4) {
    for (const py of [y, y + h - 2]) {
      cv.fill(px, py, 2, 2, cols[k % cols.length]!);
    }
    k += 1;
  }
  for (let py = y + 4; py < y + h - 3; py += 4) {
    for (const px of [x, x + w - 2]) {
      cv.fill(px, py, 2, 2, cols[k % cols.length]!);
    }
    k += 1;
  }
}

// A vertical neon sign hung from a wall: an ink board from row top with text read down it, a letter
// every 7 rows, edged in col.
function blade(cv: Canvas, x: number, top: number, text: string, col: string): void {
  const h = 7 * [...text].length + 3;
  cv.fill(x, top, 9, h, "ink");
  outlineBox(cv, x, top, 9, h, col);
  [...text].forEach((ch, k) => {
    word(cv, ch, x + 4.5, top + 1 + 7 * k, col);
  });
}

// The Eaton Centre seen from far off, one huge mall mass with no entrance: the galleria's long barrel
// vault of lake glass on white ribs across its whole width, then a dlake glass facade from the vault
// down to the street, its right 3 columns navy in shade, white-foam mullions every 4 columns and 4
// rows, its floors lit gold and amber in long runs of 3x3 panes; and on the roof the EATON CENTRE
// sign: cyan letters on an ink board in a 2px border of marquee bulbs, on coal legs.
function eatonCentre(cv: Canvas, x: number, w: number, top: number): void {
  const vault = 7;
  for (let dy = 0; dy < vault; dy++) {
    const half = Math.round((w / 2) * Math.sqrt(1 - ((vault - dy) / vault) ** 2));
    cv.fill(Math.round(x + w / 2 - half), top + dy, 2 * half, 1, "lake");
  }
  for (let c = x + 4; c < x + w - 2; c += 8) {
    cv.fill(c, top + 2, 1, vault - 2, "white");
  }
  cv.fill(x, top + vault, w, BASE - top - vault, "dlake");
  cv.fill(x + w - 3, top + vault, 3, BASE - top - vault, "navy");
  const rnd = stream("eaton");
  for (let y = top + vault + 1; y < BASE - 2; y += 4) {
    let run = 0;
    let col = "";
    for (let c = x + 1; c < x + w - 4; c += 4) {
      if (run === 0 && rnd() < 0.3) {
        run = randomInt(rnd, 2, 6);
        col = randomPick(rnd, ["gold", "amber", "gold"]);
      }
      if (run) {
        cv.fill(c, y, 3, 3, col);
        run -= 1;
      }
    }
    cv.fill(x, y + 3, w - 3, 1, "foam");
  }
  for (let c = x + 4; c < x + w - 3; c += 4) {
    cv.fill(c, top + vault, 1, BASE - top - vault, "foam");
  }
  outlineBox(cv, x, top + vault, w, BASE - top - vault + 1, "navy");
  const text = "EATON CENTRE";
  const bw = signWidth(text) + 8;
  const bx = Math.round(x + w / 2 - bw / 2);
  const by = top - 17;
  for (const c of [bx + 6, bx + bw - 7]) {
    cv.fill(c, by + 13, 2, top - by - 13 + 2, "coal");
  }
  cv.fill(bx, by, bw, 14, "ink");
  bulbs(cv, bx, by, bw, 14, ["gold", "cream", "hot", "cream"]);
  word(cv, text, x + w / 2, by + 3, "cyan");
}

// A car in a jam far down a side street, w columns wide on row y: from behind, a slate body with red
// tail lights at its corners; from the front, gold headlights.
function carLights(cv: Canvas, cx: number, y: number, w: number, back: boolean): void {
  const h = Math.max(2, Math.round(w * 0.6));
  const x = cx - Math.floor(w / 2);
  cv.fill(x, y - h + 1, w, h, "slate");
  if (h > 3) {
    cv.fill(x + 1, y - h + 1, w - 2, 1, "ink");
  }
  const lamp = back ? "red" : "gold";
  const size = 1 + (w >= 6 ? 1 : 0);
  cv.fill(x, y - Math.floor(h / 2), size, 1, lamp);
  cv.fill(x + w - size, y - Math.floor(h / 2), size, 1, lamp);
}

// A TTC bus from behind at the mouth of the side street: white over red, a dark back window, red
// tail lights low at its corners and an amber route sign.
function busBack(cv: Canvas, cx: number, y: number): void {
  cv.fill(cx - 6, y - 12, 13, 13, "ink");
  cv.fill(cx - 5, y - 11, 11, 6, "white");
  cv.fill(cx - 5, y - 5, 11, 5, "ttc");
  cv.fill(cx - 4, y - 10, 9, 4, "dslate");
  cv.fill(cx - 2, y - 11, 5, 1, "amber");
  cv.fill(cx - 5, y - 3, 2, 2, "red");
  cv.fill(cx + 4, y - 3, 2, 2, "red");
  cv.fill(cx - 5, y - 6, 11, 1, "white");
}

// A side street running away between two towers, columns x0 to x1, in one-point perspective to a
// vanishing point on row vy: its two side walls, rise rows tall at the mouth, the right one shale and
// the left coal, both in the canyon's shade, with rows of lit windows running to the vanishing point;
// a far block at its end; a shale road between stone curbs; and gridlock on it, cars going away
// showing their tail lights on the left, cars coming in their headlights on the right, a TTC bus at
// the mouth.
function sideStreet(cv: Canvas, x0: number, x1: number, vy: number, rise = 34): void {
  const mid = (x0 + x1 + 1) / 2;
  const floor = FAR_WALK - 1;
  const half = (x1 - x0 + 1) / 2;
  const depth = floor + 0.5 - vy;
  const rnd = stream("side-street");
  for (let px = x0; px < x1 + 1; px++) {
    const d = px + 0.5 - mid;
    // 0 at the vanishing point, 1 at the mouth
    const k = Math.abs(d) / half;
    const top = vy - rise * k;
    const foot = vy + depth * k;
    const floors = new Set(
      [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f) => Math.floor(vy - rise * k * f)),
    );
    for (let py = Math.floor(top); py < floor + 1; py++) {
      let c: string;
      if (py + 0.5 < foot) {
        c = d < 0 ? "coal" : "shale";
        if (floors.has(py) && px % 2 && rnd() < 0.55) {
          c = randomPick(rnd, ["gold", "amber", "cream"]);
        }
      } else {
        const t = (py + 0.5 - vy) / depth;
        c =
          Math.abs(d) < half * t * 0.75
            ? "shale"
            : Math.abs(d) < half * t * 0.8
              ? "stone"
              : "dstone";
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
  cv.fill(Math.round(mid) - 3, vy - 7, 6, 7, "dslate");
  lit(cv, Math.round(mid) - 2, Math.round(mid) + 3, vy - 6, vy, "side-end", 0.6, ["gold", "cream"]);
  for (const t of [0.12, 0.2, 0.3, 0.42, 0.56, 0.72]) {
    const y = Math.round(vy + depth * t);
    const w = Math.max(2, Math.round(11 * t));
    carLights(cv, Math.round(mid - half * t * 0.38), y, w, true);
    carLights(cv, Math.round(mid + half * t * 0.38), y, w, false);
  }
  busBack(cv, Math.round(mid - half * 0.38), floor);
}

// A theatre's vertical blade sign, 13 columns wide from row top: text read down it in col on cream,
// a letter every step rows, in a 2px border of marquee bulbs, on a coal bracket down to row base.
function elgin(
  cv: Canvas,
  x: number,
  top: number,
  base: number,
  { col = "red", step = 8, text = "ELGIN" }: { col?: string; step?: number; text?: string } = {},
): void {
  const h = step * [...text].length + 6;
  cv.fill(x, top, 13, h, "cream");
  bulbs(cv, x, top, 13, h);
  [...text].forEach((ch, k) => {
    word(cv, ch, x + 6.5, top + 3 + step * k, col);
  });
  cv.fill(x + 5, top + h, 3, base - top - h, "coal");
}

// A theatre marquee over a street level, columns x to x + w - 1, rows BASE - 25 to BASE - 11: text in
// col on a cream board in a 2px border of marquee bulbs.
function marquee(cv: Canvas, x: number, w: number, text: string, col: string): void {
  const y = BASE - 25;
  cv.fill(x, y, w, 15, "ink");
  cv.fill(x + 2, y + 2, w - 4, 11, "cream");
  bulbs(cv, x, y, w, 15);
  word(cv, text, x + w / 2, y + 4, col);
}

// One ramp step lighter, for the street's glow on the towers' feet.
const UP: ReadonlyMap<string, string> = new Map([
  ["navy", "dslate"],
  ["dslate", "slate"],
  ["dlake", "lake"],
  ["shale", "ash"],
  ["coal", "shale"],
  ["ink", "coal"],
  ["lake", "shallow"],
  ["blue", "cobalt"],
  ["purple", "mauve"],
  ["dbrick", "brick"],
  ["brick", "rust"],
  ["ochre", "amber"],
  ["slate", "grey"],
  ["ash", "stone"],
  ["teal", "dturq"],
]);
// Each house colour's name by "r,g,b", the first name for a colour two names share.
const NAMES: ReadonlyMap<string, string> = new Map(
  Object.entries(K)
    .reverse()
    .map(([n, h]) => [rgb(h).join(","), n]),
);

// The street's glow on the towers' feet: every pixel on rows y0 to y1 with a lighter step in UP takes
// it.
function uplight(cv: Canvas, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const n = NAMES.get(pixelAt(cv, x, y));
      const up = n === undefined ? undefined : UP.get(n);
      if (up !== undefined) {
        cv.fill(x, y, 1, 1, up);
      }
    }
  }
}

// A crosswalk over the cross street, w columns centred on mid: white bars along the street on every
// other row, the road between them clear of the centre line.
function crosswalk(cv: Canvas, mid: number, w: number, road: string): void {
  const x = Math.round(mid - w / 2);
  cv.fill(x, CROSS + 1, w, NEAR_CURB - CROSS - 1, road);
  for (let py = CROSS + 1; py < NEAR_CURB; py += 2) {
    cv.fill(x, py, w, 1, "white");
  }
}

const YONGE_SKY: readonly string[] = ["slate", "dslate", "purple", "mauve"];

function yonge(): Canvas {
  const cv = new Canvas(W, H);
  // an evening sky, slate down to dslate and purple, a mauve city glow at the horizon, a full moon
  // and a few stars
  sunset(cv, YONGE_SKY, BASE);
  for (const [x, y] of [
    [8, 6],
    [62, 2],
    [108, 9],
    [150, 4],
    [196, 11],
    [232, 3],
    [288, 22],
    [318, 4],
    [352, 12],
  ] as const) {
    cv.fill(x, y, 1, 1, "white");
  }
  fullMoon(cv, 304, 14, 5);
  // downtown seen from far off, its towers stepping up toward the top third, the CN Tower huge and
  // close over them all: its antenna running off the band's top over the SkyPod and the main pod,
  // the shaft flaring down to the street. The message strip covers the band's top rows while a
  // message shows, so the screens and signs stay below row 57. Far back, dark towers in navy and
  // dslate with runs of windows lit, those either side of the tower's shaft kept low
  skyline(cv, [
    [-2, 16, 30, "navy"],
    [40, 14, 62, "dslate"],
    [78, 16, 52, "navy"],
    [114, 22, 26, "navy"],
    [150, 18, 16, "dslate"],
    [170, 20, 30, "navy"],
    [196, 16, 24, "dslate"],
    [214, 14, 18, "navy"],
    [228, 18, 28, "navy"],
    [268, 16, 36, "dslate"],
    [300, 18, 30, "navy"],
    [322, 16, 22, "dslate"],
    [342, 20, 34, "navy"],
  ]);
  for (const [cx, top, h] of [
    [122, 26, 6],
    [156, 22, 5],
    [178, 30, 6],
    [220, 24, 4],
    [348, 34, 6],
  ] as const) {
    mast(cv, cx, top - h, h);
  }
  // the SkyDome off to the tower's right, its foot behind the Eaton Centre; lit towers behind it;
  // then the CN Tower, its shaft clear down to the street
  skydome(cv, 84, 70, BASE - 32, 16);
  glassTower(cv, 10, 30, 36, 7);
  scotia(cv, 96, 24, 30);
  dominion(cv, 120, 22, 40, 5);
  glassTower(cv, -4, 16, 22, 4);
  cnTower(cv, 56, BASE, 8, 26);
  // the nearer towers: dark glass on the left and up to the SkyDome's lower half; then, down to the
  // street, the Yonge-Dundas screens, the Royal Bank Plaza's gold pair, First Canadian Place, a TD
  // Centre tower and glass under a turquoise crown, the street's glow on their feet and most with
  // neon over a lit street level; in front, the Eaton Centre under its sign, a HOTEL sign down the
  // left tower, screens on the glass, the TD tower and the crowned tower, and the theatre: the ELGIN
  // blade over a marquee in front of the Royal Bank pair
  dundasScreens(cv, CX - 32, 64, 34);
  royalBank(cv, 210, 20, 30);
  royalBank(cv, 230, 14, 50);
  firstCanadian(cv, 246, 22, 20);
  dominion(cv, 270, 34, 28, 1);
  glassTower(cv, 332, 32, 32, 3);
  crown(cv, 332, 32, 32, "turquoise", "turquoise", 3);
  uplight(cv, BASE - 24, BASE - 18);
  uplight(cv, BASE - 21, BASE - 18);
  const fronts = [
    [-4, 18, null],
    [14, 30, ["CAFE", "turquoise"]],
    [44, 30, null],
    [74, 14, null],
    [CX - 32, 64, ["PIZZA", "gold"]],
    [210, 20, null],
    [230, 14, null],
    [246, 22, null],
    [270, 34, ["BOOKS", "lilac"]],
    [332, 32, ["BAR", "pink"]],
  ] as const;
  fronts.forEach(([x, w, signOf], k) => {
    streetLevel(cv, x, w, k, signOf);
  });
  eatonCentre(cv, 72, 76, BASE - 36);
  blade(cv, 3, 62, "HOTEL", "pink");
  screen(cv, 14, 72, 30, 18, "turquoise", wordArt("WOOF!", "white"));
  screen(cv, 274, 70, 26, 18, "azure", pawArt);
  screen(cv, 334, 72, 26, 18, "hot", wordArt("SALE", "white"));
  elgin(cv, 236, BASE - 25 - 41, BASE - 25, { step: 7 });
  marquee(cv, 208, 40, "SHOW", "red");
  // the subway entrance sign
  const sx = 64;
  cv.fill(sx, BASE - 4, 2, FAR_WALK - BASE + 4, "coal");
  cv.fill(sx - 9, BASE - 14, 20, 12, "coal");
  cv.fill(sx - 8, BASE - 13, 18, 10, "ttc");
  word(cv, "TTC", sx + 1, BASE - 12, "white");

  const paving: Paint = (px, py) => (hashed(px, py, 67) ? "slate" : "dslate");

  yard(cv, BASE, FAR_WALK, paving);
  // the lit podiums' and the Eaton Centre's light on the far sidewalk
  for (const [x0, x1] of [
    ...fronts.map(([x, w]): [number, number] => [x + 1, x + w - 1]),
    [79, 153] as const,
  ]) {
    frontPool(cv, x0, x1, [[300, 334]]);
  }
  // a side street jammed with traffic between the TD tower and the glass, down to the far sidewalk
  sideStreet(cv, 304, 331, BASE - 26, 18);

  const road: RoadPaint = (x, z, span, px, py) => {
    if (Math.abs(x) >= ROAD - 5) {
      return "dstone";
    }
    if (span < 6 && crosses(z, span, 32)) {
      return "coal";
    }
    return hashed(px, py, 41) ? "ash" : "shale";
  };

  cross(cv, flat(road), "dstone", paving, { curb: "grey" });
  crossLine(cv, "amber", { dash: [14, 64], edge: "coal" });
  // crosswalks over the cross street from the stub's two sidewalks
  for (const mid of [94, 266]) {
    crosswalk(cv, mid, 14, "shale");
  }
  street(cv, verge("yonge-street", road));
  lanes(cv, "white", { dash: [14, 64], edge: "coal" });
  return cv;
}

export { type Tower, yonge, YONGE_SKY };
