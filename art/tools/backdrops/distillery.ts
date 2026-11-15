import { randomPick } from "@andornaut/game-kit/runtime/random";

import { signWidth } from "../fonts.ts";
import { dk } from "../pixel.ts";
import { Canvas } from "../scene.ts";
import {
  BASE,
  birds,
  CALM,
  cross,
  crosses,
  CX,
  FAR_WALK,
  H,
  hashed,
  type Paint,
  ROAD,
  type RoadPaint,
  stream,
  street,
  sun,
  sunset,
  verge,
  W,
  word,
  yard,
} from "./common.ts";
import { figure, gasLamp } from "./gardens.ts";

// A brick warehouse facing the camera, rows top to base: a cornice, arched windows in rows, its
// right side in shade.
function warehouse(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wall: string,
  trim = "stone",
  glass = "gold",
  { rows = 2 }: { rows?: number } = {},
): void {
  cv.fill(x, top, w, base - top, wall);
  cv.fill(x + w - 3, top, 3, base - top, dk(wall));
  cv.fill(x - 1, top, w + 2, 3, dk(wall));
  cv.fill(x - 1, top + 3, w + 2, 1, trim);
  for (let r = 0; r < rows; r++) {
    const wy = top + 7 + r * 13;
    if (wy + 10 > base - 2) {
      break;
    }
    for (let wx = x + 4; wx < x + w - 8; wx += 10) {
      cv.fill(wx, wy + 1, 6, 9, trim);
      cv.fill(wx + 1, wy, 4, 1, trim);
      cv.fill(wx + 1, wy + 1, 4, 8, glass);
      cv.fill(wx + 1, wy + 1, 4, 1, dk(glass));
      cv.fill(wx + 3, wy + 2, 1, 7, trim);
    }
  }
}

// The Gooderham & Worts chimney stack standing on row BASE: brick stepping in a column a side at 30
// and 62 rows below its top, its right 3 columns in shade, a dbrick cap, a band below it and another
// at the lower step.
function chimney(cv: Canvas, x: number, top: number, w = 12): void {
  const steps = [
    [top, w - 4],
    [top + 30, w - 2],
    [top + 62, w],
  ] as const;
  steps.forEach(([y0, sw], k) => {
    const y1 = k + 1 < steps.length ? steps[k + 1]![0] : BASE;
    const x0 = x + Math.floor((w - sw) / 2);
    cv.fill(x0, y0, sw, y1 - y0, "brick");
    cv.fill(x0 + sw - 3, y0, 3, y1 - y0, "dbrick");
  });
  cv.fill(x + 1, top - 2, w - 2, 3, "dbrick");
  cv.fill(x + 1, top + 7, w - 2, 1, "dbrick");
  cv.fill(x, top + 62, w, 1, "dbrick");
}

// A rooftop water tower whose feet stand on row low: two dstone legs legs rows tall, X-braced, under
// a bark wooden tank on a walnut ledge and a stepped walnut cap.
function waterTower(cv: Canvas, tx: number, low: number, legs = 13): void {
  const tank = low - legs;
  for (const lx of [tx - 7, tx + 6]) {
    cv.fill(lx, tank, 2, legs, "dstone");
  }
  cv.line(tx - 6, tank + 2, tx + 6, low - 4, "dstone");
  cv.line(tx + 6, tank + 2, tx - 6, low - 4, "dstone");
  cv.fill(tx - 9, tank - 12, 20, 12, "bark");
  cv.fill(tx + 7, tank - 12, 4, 12, "walnut");
  cv.fill(tx - 10, tank - 1, 22, 1, "walnut");
  for (let k = 0; k < 4; k++) {
    cv.fill(tx - 7 + 2 * k, tank - 13 - k, 16 - 4 * k, 1, "walnut");
  }
}

// A far glass condo tower from row top down to row BASE, dim in the haze: a flat body, its right
// quarter in shade, a 2-row crown, and floor lines every 4 rows a step lighter across the lit part.
function condo(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  body = "skin2",
  shade = "brown",
  glint = "tan",
): void {
  const sw = Math.max(3, Math.floor(w / 4));
  cv.fill(x, top, w, BASE - top, body);
  cv.fill(x + w - sw, top, sw, BASE - top, shade);
  for (let y = top + 5; y < BASE; y += 4) {
    cv.fill(x + 2, y, w - sw - 4, 1, glint);
  }
  cv.fill(x + 2, top - 2, w - 4, 2, shade);
}

// A sign board centred on column mid from row y: a coal frame round a board of 9 rows, the text in
// sign lettering.
function signBoard(
  cv: Canvas,
  mid: number,
  y: number,
  text: string,
  board: string,
  letters: string,
): void {
  const w = signWidth(text) + 8;
  const x = Math.round(mid - w / 2);
  cv.fill(x - 1, y - 1, w + 2, 11, "coal");
  cv.fill(x, y, w, 9, board);
  word(cv, text, mid, y + 1, letters);
}

// The chocolate shop's painted bar, as rows of fills: a milk chocolate bar of scored squares in a
// coal outline, its foil peeled back at the right over a red wrapper with a cream band.
const CHOCOLATE_BAR: readonly string[] = [
  "kkkkkkkkk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kdddddddk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kbbbdbbbk...",
  "kdddddddkk..",
  "kbbbdbbflk..",
  "kbbbdbffllk.",
  "kbbbdfflllkk",
  "krrrrrrkkk..",
  "kcccccccck..",
  "krrrrrrrk...",
  "krrrrrrrk...",
  "kkkkkkkkk...",
];
const CHOCOLATE_COLOURS: Readonly<Record<string, string>> = {
  b: "brown",
  c: "cream",
  d: "dbrown",
  f: "lgrey",
  k: "coal",
  l: "white",
  r: "red",
};

// The paintings hung in a gallery's windows: (sky or ground, lower field, a spot of colour).
type Scheme = readonly [string, string, string];
const PAINTINGS: readonly Scheme[] = [
  ["azure", "moss", "red"],
  ["mauve", "peach", "gold"],
  ["teal", "lilac", "white"],
  ["ochre", "dturq", "cream"],
];

// A painting in a gold frame shaded ochre on its right and bottom: two fields and a spot of colour.
function painting(cv: Canvas, x: number, y: number, w: number, h: number, scheme: Scheme): void {
  const [a, b, c] = scheme;
  cv.fill(x, y, w, h, "gold");
  cv.fill(x + w - 1, y, 1, h, "ochre");
  cv.fill(x, y + h - 1, w, 1, "ochre");
  cv.fill(x + 1, y + 1, w - 2, h - 2, a);
  const upper = Math.floor((h - 2) / 2);
  cv.fill(x + 1, y + 1 + upper, w - 2, h - 2 - upper, b);
  cv.fill(x + 1 + Math.floor((w - 2) / 2), y + 2, 2, 2, c);
}

// A brick warehouse whose ground floor is an art gallery: two tall coal-framed shop windows lit
// skin1, framed paintings hung in them, a GALLERY board over a dturq door between them, the upper
// floor's arched windows above.
function gallery(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wall = "brick",
): void {
  warehouse(cv, x, w, top, base, wall, "stone", "skin1", { rows: 1 });
  const gy = base - 26;
  cv.fill(x + 2, gy - 1, w - 6, 1, "stone");
  signBoard(cv, x + w / 2, gy - 10, "GALLERY", "walnut", "cream");
  const ww = Math.floor((w - 26) / 2);
  let k = 0;
  for (const wx of [x + 4, x + w - 7 - ww]) {
    cv.fill(wx, gy + 2, ww, 22, "coal");
    cv.fill(wx + 1, gy, ww - 2, 2, "coal");
    cv.fill(wx + 1, gy + 2, ww - 2, 21, "cream");
    cv.fill(wx + 2, gy + 1, ww - 4, 1, "cream");
    for (let px = wx + 3; px < wx + ww - 8; px += 10) {
      painting(cv, px, gy + 6, 7, 9, PAINTINGS[k % PAINTINGS.length]!);
      k += 1;
    }
    cv.fill(wx + 1, gy + 18, ww - 2, 1, "dstone");
  }
  const dx = x + Math.floor(w / 2) - 6;
  cv.fill(dx, base - 18, 9, 18, "coal");
  cv.fill(dx + 1, base - 17, 7, 17, "dturq");
  cv.fill(dx + 4, base - 17, 1, 17, "coal");
}

// The Young Centre, a tank house turned theatre: dark brick with two rows of arched windows, its
// ground floor a glazed lobby lit gold with theatregoers' silhouettes inside, and a marquee over the
// doors, its THEATRE board in gold letters edged with yellow bulbs.
function theatre(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  base: number,
  wall = "dbrick",
): void {
  warehouse(cv, x, w, top, base, wall, "stone", "gold", { rows: 2 });
  const ly = base - 20;
  cv.fill(x + 3, ly, w - 6, 20, "coal");
  cv.fill(x + 4, ly + 1, w - 8, 19, "gold");
  for (let mx = x + 13; mx < x + w - 6; mx += 10) {
    cv.fill(mx, ly + 1, 1, 19, "coal");
  }
  const rnd = stream("theater-lobby");
  for (let px = x + 8; px < x + w - 10; px += 13) {
    const h = randomPick(rnd, [7, 8, 9]);
    cv.fill(px, base - h, 4, h, "dbrown");
    cv.fill(px + 1, base - h - 3, 2, 3, "dbrown");
  }
  const mw = Math.min(w - 10, 70);
  const mx0 = x + Math.floor((w - mw) / 2);
  const my = ly - 12;
  cv.fill(mx0 - 2, my + 10, mw + 4, 3, "coal");
  cv.fill(mx0, my, mw, 10, "coal");
  cv.fill(mx0 + 1, my + 1, mw - 2, 8, "dbrick");
  word(cv, "THEATRE", mx0 + mw / 2, my + 1, "gold");
  for (let bx = mx0; bx < mx0 + mw; bx += 3) {
    cv.fill(bx, my - 1, 1, 1, "yellow");
    cv.fill(bx + 1, my + 10, 1, 1, "yellow");
  }
}

// A café's market umbrella on a cream pole from row base: a canopy of col widening to 21 columns
// over 4 rows, its eave a ramp step darker with a valance dotted in trim, and a finial.
function cafeUmbrella(
  cv: Canvas,
  cx: number,
  base: number,
  col: string,
  trim: string,
  top = 16,
): void {
  cv.fill(cx, base - top, 1, top, "cream");
  cv.fill(cx, base - top - 6, 1, 2, "cream");
  (
    [
      [-4, 9],
      [-7, 15],
      [-9, 19],
      [-10, 21],
    ] as const
  ).forEach(([dx, w], k) => {
    cv.fill(cx + dx, base - top - 4 + k, w, 1, col);
  });
  cv.fill(cx - 10, base - top, 21, 2, dk(col));
  for (let vx = cx - 10; vx < cx + 11; vx += 4) {
    cv.fill(vx, base - top + 2, 2, 1, trim);
  }
}

// A round bistro table with a red flower and a cream cup, and a chair either side, in coal iron on
// row base.
function bistroSet(cv: Canvas, cx: number, base: number): void {
  cv.fill(cx - 4, base - 6, 9, 1, "lgrey");
  cv.fill(cx, base - 5, 1, 5, "coal");
  cv.fill(cx - 2, base - 1, 5, 1, "coal");
  for (const [sx, seat] of [
    [cx - 8, cx - 7],
    [cx + 7, cx + 5],
  ] as const) {
    cv.fill(sx, base - 8, 1, 8, "coal");
    cv.fill(seat, base - 4, 2, 1, "coal");
    cv.fill(seat, base - 3, 1, 3, "coal");
  }
  cv.fill(cx - 2, base - 8, 2, 2, "red");
  cv.fill(cx + 1, base - 7, 1, 1, "cream");
}

// A restaurant patio from column x0 to x1 on row base: bistro sets under umbrellas every 26 columns,
// their canopies alternating the two cols, behind a low coal rail with a geranium planter at each
// end.
function bistroPatio(
  cv: Canvas,
  x0: number,
  x1: number,
  base: number,
  cols: readonly [string, string],
): void {
  for (let k = 0, cx = x0 + 12; cx < x1 - 8; k++, cx += 26) {
    const [col, trim] = k % 2 === 0 ? cols : [cols[1], cols[0]];
    cafeUmbrella(cv, cx, base, col, trim);
    bistroSet(cv, cx, base);
  }
  cv.fill(x0, base - 5, x1 - x0, 1, "coal");
  for (let px = x0; px < x1; px += 4) {
    cv.fill(px, base - 5, 1, 5, "coal");
  }
  for (const px of [x0, x1 - 6]) {
    cv.fill(px, base - 6, 6, 6, "bark");
    cv.fill(px + 4, base - 6, 2, 6, "walnut");
    for (let gx = px; gx < px + 6; gx += 2) {
      cv.fill(gx, base - 8, 2, 2, "canopy");
    }
    cv.fill(px + 2, base - 9, 1, 1, "pink");
  }
}

// Still Dancing's loops of track, from the top: (rows below the cupola, radius, colour, tilt).
const DANCING_LOOPS: readonly (readonly [number, number, string, number])[] = [
  [6, 9, "red", 0.35],
  [18, 11, "turquoise", -0.3],
  [31, 10, "lilac", 0.25],
  [43, 8, "cream", -0.2],
];

// Still Dancing, Dennis Oppenheim's sculpture in the square, standing on row base: a coal mast on a
// tripod, lit ash on its left, ringed by four tilted loops of coloured track, their far halves a ramp
// step darker behind it, under a gold cupola on row top.
function stillDancing(cv: Canvas, cx: number, base: number, top: number): void {
  for (const fx of [-10, 0, 10]) {
    cv.line(cx + fx, base, cx, base - 22, "coal");
  }

  function loops(near: boolean): void {
    for (const [dy, r, col, tilt] of DANCING_LOOPS) {
      for (let a = 0; a < 360; a += 2) {
        const t = a * (Math.PI / 180);
        if (Math.sin(t) > 0 !== near) {
          continue;
        }
        const x = cx + r * Math.cos(t);
        const y = top + 4 + dy + r * (0.32 * Math.sin(t) + tilt * Math.cos(t));
        cv.fill(Math.round(x), Math.round(y), 1, 2, near ? col : dk(col));
      }
    }
  }

  loops(false);
  cv.fill(cx - 1, top + 3, 3, base - 25 - top, "coal");
  cv.fill(cx - 1, top + 3, 1, base - 25 - top, "ash");
  loops(true);
  cv.fill(cx - 3, top - 1, 7, 4, "gold");
  cv.fill(cx + 2, top - 1, 2, 4, "ochre");
  cv.fill(cx - 1, top - 3, 3, 2, "gold");
}

// The LOVE sign's heart, beside its letters.
const LOVE_HEART: readonly string[] = [
  ".##.##.",
  "#######",
  "#######",
  ".#####.",
  "..###..",
  "...#...",
];

// The LOVE sign standing on row base, centred on column cx: a ttc heart and the red letters LOVE on
// a coal rail on two posts, padlocks hung along the rail.
function loveSign(cv: Canvas, cx: number, base: number): void {
  const w = signWidth("LOVE") + 12;
  const x0 = Math.round(cx - w / 2);
  const top = base - 17;
  cv.fill(x0, top + 9, w, 2, "coal");
  for (const px of [x0 + 1, x0 + w - 3]) {
    cv.fill(px, top + 9, 2, base - top - 9, "coal");
  }
  LOVE_HEART.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        cv.fill(x0 + i, top + 1 + j, 1, 1, "ttc");
      }
    });
  });
  word(cv, "LOVE", x0 + 9 + signWidth("LOVE") / 2, top, "red");
  for (let k = 0, px = x0 + 2; px < x0 + w - 2; k++, px += 3) {
    cv.fill(px, top + 11, 1, 2, ["gold", "lgrey", "amber", "turquoise"][k % 4]!);
  }
}

// Far passers-by on row base, one at each column in spots: 3 columns wide and 10 rows tall, coal
// legs, a top of a mixed colour shaded on its right column, a face and hair.
function strollers(cv: Canvas, spots: readonly number[], base: number, seed: string): void {
  const rnd = stream(seed);
  for (const x of spots) {
    const top = randomPick(rnd, ["dred", "teal", "cream", "mauve", "navy", "ochre", "forest"]);
    cv.fill(x, base - 3, 1, 3, "coal");
    cv.fill(x + 2, base - 3, 1, 3, "coal");
    cv.fill(x, base - 7, 3, 4, top);
    cv.fill(x + 2, base - 7, 1, 4, dk(top));
    cv.fill(x, base - 9, 3, 2, randomPick(rnd, ["skin1", "skin2", "brown"]));
    cv.fill(x, base - 10, 3, 1, randomPick(rnd, ["walnut", "dbrown", "ochre", "coal"]));
  }
}

// The golden-hour sky's bands, from the top, down to the square's roof.
const DISTILLERY_SKY: readonly string[] = ["peach", "orange", "amber"];

function distillery(): Canvas {
  const cv = new Canvas(W, H);
  // Trinity Square at golden hour: bands of peach, orange and amber, the striped sun low over the
  // square's far side, gulls
  sunset(cv, DISTILLERY_SKY, BASE - 36);
  sun(cv, CX + 4, BASE - 49, 12, "yellow", BASE - 37);
  // glass condo towers rising behind the old brick either side of the sun, the chimney stack, and
  // the water tower on the right warehouse's roof
  for (const [x, w, top] of [
    [132, 22, 22],
    [206, 26, 10],
    [236, 18, 32],
  ] as const) {
    condo(cv, x, w, top);
  }
  birds(cv, [
    [30, BASE - 64],
    [84, BASE - 60],
    [290, BASE - 76],
  ]);
  chimney(cv, CX - 121, 12);
  waterTower(cv, CX + 142, BASE - 46);
  // round the square: the gallery and an old limestone mill on the left, the chocolate shop in the
  // long low warehouse across it, its CHOCOLATE sign and a painted bar beside it, the theatre and
  // another warehouse on the right
  gallery(cv, -10, 80, BASE - 44, BASE);
  warehouse(cv, 70, 56, BASE - 36, BASE, "driftwood", "dstone");
  warehouse(cv, CX - 54, 108, BASE - 36, BASE, "brick", "stone", "gold", { rows: 0 });
  signBoard(cv, CX, BASE - 30, "CHOCOLATE", "dbrick", "cream");
  figure(cv, CX + 38, BASE - 14, CHOCOLATE_BAR, CHOCOLATE_COLOURS);
  theatre(cv, CX + 54, 80, BASE - 50, BASE);
  warehouse(cv, CX + 134, 56, BASE - 46, BASE, "brick", "stone", "gold", { rows: 3 });

  // the square's paving, café tables under umbrellas, Still Dancing, the LOVE sign, lamps and
  // passers-by
  const paving: Paint = (px, py) => (hashed(px, py, 19) ? "brick" : "brown");

  yard(cv, BASE, FAR_WALK, paving);
  bistroPatio(cv, CX - 50, CX + 46, FAR_WALK - 1, ["cream", "forest"]);
  stillDancing(cv, CX - 72, FAR_WALK - 1, CALM + 4);
  loveSign(cv, 104, FAR_WALK - 1);
  for (const x of [8, CX + 60, CX + 132]) {
    gasLamp(cv, x, FAR_WALK - 1);
  }
  strollers(cv, [40, 52, CX + 70, CX + 100, CX + 110, 330], FAR_WALK - 1, "distillery");

  const road: RoadPaint = (x, z, span, px, py) => {
    const a = Math.abs(x);
    if (a >= ROAD - 4) {
      return "brick";
    }
    if (span < 6 && crosses(z, span, 8)) {
      return "navy";
    }
    return hashed(px, py, 31) ? "slate" : "dslate";
  };

  // the lane across is cobbled and car-free: dslate setts between brick gutters, with no curbs and
  // no centre line
  cross(cv, () => "dslate", "brick", paving, { curb: null });
  street(cv, verge("distillery-district", road));
  return cv;
}

export { distillery, DISTILLERY_SKY, warehouse };
