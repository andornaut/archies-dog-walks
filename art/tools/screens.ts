// Draw the logo and the full-screen backgrounds outside the run.
//
// logo: 145x41 on a transparent ground, "Archie's Dog Walks" stacked beside Archie's head. On the
// left, portrait-dog-archie's head (its rows 10 to 41, in its ink line) over a short red bandana,
// lit red on the left and dred on the right. On the right, ARCHIE'S in the comic letters
// (fx.ts's LETTERS, 7 rows, 2px stems, plus an apostrophe) over DOG WALKS in the sign letters at 2x
// (fonts.ts's sign), both cream in a 1px ink outline on a solid dred shadow, so the bandana is the
// one red accent. The game draws it on the end screen; the home page and screen-loading show it at
// 2x and the og-image at 1x.
//
// screen-<name>: 360x560 backgrounds in the house palette, one per screen. Where panels and text
// sit, they are low-contrast dark wood, so the cream and tan UI text reads on them.
// - screen-home: a compact, skyless Cabbagetown courtyard, drawn at native screen coordinates
//   (0,0). Rows 40 to 163 hold a continuous masonry wall, a complete recessed window at the exposed
//   left, a low autumn planter, an open iron gate and quiet broad flagstones. No roofs, skyline or
//   sky are cropped beneath the top bar. The centre stays quiet behind dialogue and the pack; the
//   red-brick path at x 164 to 195 ends below the actor's last opaque foot row 163 (anchor 164).
//   The street-name board is at 286,40, 68x12; the game prints its existing name in white title
//   lettering at 320,43. The yard sign at 6,106, 128x38 carries ARCHIE'S over DOG WALKS in the
//   existing sign letters, on two short posts. The right lot is reserved for ui-pet-shop at
//   234,54,120x108. Two quiet ground rows at 164 and 165 precede the plum divider on row 166; the
//   backing below it is flat dbrown. No strong green competes with the existing shop board and
//   Start walk.
// - screen-end: a Cabbagetown street at dusk, with plain lower sky bands and a repeating interior
//   road footer from row 511, free of lane edges and dashes. Between the logo (END_LOGO_AT 107,2)
//   and the summary panel (24,112 to 336,412), the front of the brick cottage the pack comes home
//   to: the logo stands on its slate roof's ridge (END_RIDGE, row 43), a low centre gable trimmed
//   in white rises from the ridge with a small lit arched window, two lit four-pane sash windows
//   flank the front door (171,73 18x23) under its lit transom, which opens onto a step (164,96
//   32x4), and a flagstone path (168,100 24x12) runs down behind the panel's top edge.
//   Bay-and-gables stand either side, with shaded eaves, tan bay ledges and varied room lights
//   behind orange curtains; the CN Tower rises lit over the right ones (END_CN). The moss lawn
//   from y 96 stays quiet behind the returning pack and gives the waving owners room either side,
//   feet on y 110. Cabbagetown's dusk bands (DUSK_SKY) fill the sky twice: behind the house down
//   to its lawn, and behind the panel down to the far rooftops and towers in mauve (y 450). Then
//   the street's bay-and-gables and canopy trees (from y 370), iron fences, the yards, the
//   sidewalk (rows 491 to 505) with two heritage lamps, the curb, and from END_ROAD (511)
//   Kensington Market's brick road under the button (32,514 296x44), which bobs 1px up, so at
//   least 2 rows of road show above and below it. The houses, trees and fences stay within x 8 to
//   352, so beside the badges panel (8,416 344x92) the margins show only sky, lawn and sidewalk.
// - screen-loading: a Toronto street at night, shown while the game loads, seen from the road.
//   NIGHT_SKY's bands fill the sky down to SKY_FOOT (356), stars, a crescent moon at the top left
//   and the logo drawn in at 2x (290x82 at 35,74) in the navy band. Far back, downtown's towers in
//   navy and dslate silhouette with a few gold floors lit, and the CN Tower lit (its haze shaft,
//   the pod's gold window ring, the SkyPod and a red beacon on the mast, tip at row 150) over the
//   corner lot. The near row: three Cabbagetown bay-and-gables in brick and dbrick (stone and
//   driftwood bargeboards, an arched attic window, a two-storey bay, the door with its lit
//   transom), most windows lit gold, over pine front yards behind a coal iron fence with stone
//   stoops; a board fence across the lane, a heritage lamp lit yellow in front of it at x 227; and
//   ui-pet-shop's building on the corner lot (236,306) a ramp step darker, its board lit and its
//   display window and door pane glowing gold. The sidewalk (rows 414 to 469, grey, slabs every
//   24px) carries the track and the pair, a TTC streetcar stop at its left end; then the curb, and
//   the street, flat navy and plain from the curb to row 500, where a status line could sit (the
//   game draws none), then two streetcar tracks.
//
// ui-pet-shop: a 120x108 sprite, tags normal, pressed and door-wave: the pet shop on the
// yard's right lot, which opens the shop. The game draws it at PET_SHOP_AT (234,54), its base on
// the yard's bottom row (161), and its hit area is the frame. Under the board's place (rows 0 to 21)
// the frame is clear but for the parapet trim: an ink line on row 20 and cream from row 21, so the
// board rising 1px shows a third cream row, never a gap. Under the trim a red and white awning, a
// display window with a food bag and a puppy behind its bone, and a door with a paw on its glass;
// rust brick with dbrown mortar, lit ochre on the left, dred on the right, ink outline all round,
// on a grey step. pressed dips as ui-button does: the front sinks 2px onto the step, the step 1px
// shallower. door-wave is frames 2 to 17 at 120ms each (1920ms): the right-hinged door opens, a
// shopkeeper peeks out and waves inside its aperture, then withdraws as it closes. The building
// stays fixed. Normal frame 0 is the static closed pose. An affordable item in the shop takes
// ui-afford 2px outside the frame (232,52 124x112).
//
// ui-pet-shop-board: a 114x24 sprite, tags normal and pressed: the PET SHOP board, drawn over
// ui-pet-shop at BOARD's offset (3,0 in the shop's frame, 237,54 on screen) with the same origin
// for both tags. Built and coloured as ui-button's go state (green face, yellow highlight, forest
// lip, ink line), with PET SHOP in the sign letters' shapes at 2x in ink, as the go label. normal
// fills rows 0 to 21, its bottom 2 rows over the parapet; pressed sinks 2px with the front (rows 2
// to 23) and loses its lip and highlight to face, as go-pressed. The game bobs it 1px up as Start
// walk bobs, and not while pressed.
//
// ui-loading-track: a 316x8 image, the sidewalk being walked: Lady's paw prints in dslate,
// staggered on two rows from Casey's heel to the Pet shop's door. The game draws it at TRACK_AT
// (16,456).
// ui-loading: a 98x84 sprite, tag walk (4 frames, 160ms): Casey and Lady side on, walking right on
// a plum leash, at 1.75x, larger than on the road (Casey 84 rows tall, Lady 56), cel shaded with
// the road outline, Casey's face flat skin. Frames 0 and 2 plant the feet apart, 1 and 3 pass with
// the body 1px higher, a foot lifted, and Lady's diagonal pairs swap. The game draws it at PAIR_AT
// (6,379) plus round(228 * progress) to the right, its feet on row 460, so Casey's heel starts on
// the first paw print and Lady's nose ends at the Pet shop's door pane.
//
// Run from the repository root, after the fonts and the sprite builds. A build overwrites the
// exports, so hand edits to them belong in this file instead.
import { mkdirSync, writeFileSync } from "node:fs";

import {
  composite,
  crop,
  filledImage,
  opaque,
  paste,
  resizeNearest,
  type Rgba,
} from "@andornaut/art-kit/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as bd from "./backdrops.ts";
import { sign } from "./fonts.ts";
import { LETTERS } from "./fx.ts";
import { small } from "./mini.ts";
import {
  build as buildSprites,
  dk,
  type Drawable,
  type DrawingScope,
  edged,
  type Frame,
  Grid,
  K,
  rgbPng,
  run,
  savePng,
  type Sprite,
  type Tag,
  toImage,
  UsageError,
} from "./pixel.ts";
import { LIT, rim, scope as roadScope } from "./road.ts";
import { Canvas, image, LAYOUT, rgb, text, textC, TILES, ZONES } from "./scene.ts";
import { STATES } from "./ui.ts";

// The usage text, naming every image in SCREENS.
function usage(): string {
  return `Usage:
  node art/tools/screens.ts preview OUT.png     the logo, the ui-loading frames, then every
                                                screen, scaled up, and every screen again with
                                                its UI blocked in
  node art/tools/screens.ts shop-preview OUT.png
                                                ui-pet-shop's tags on the yard at 1x and 4x, and
                                                screen-home with it in at 1x and 4x
  node art/tools/screens.ts build SCREEN        write only the SCREEN PNG, one of
                                                ${[...SCREENS.keys()].join(", ")}
  node art/tools/screens.ts build               write public/art/images/*.png and
                                                public/art/sprites/ui-loading.*, ui-pet-shop.* and
                                                ui-pet-shop-board.*`;
}

export const W = 360;
export const H = 560;
export const LOGO_W = 145;
export const LOGO_H = 41;
export const SIGN_W = 128;
export const SIGN_H = 38;
export const SIGN_AT: readonly [number, number] = [6, 106];
export const PET_SHOP_W = 120;
export const PET_SHOP_H = 108;
// Where the game draws ui-pet-shop on the start screen, from the layout export's home Pet shop.
const PET_SHOP = LAYOUT.scenes.home.petShop;
export const PET_SHOP_AT: readonly [number, number] = [PET_SHOP.x, PET_SHOP.y];
// The PET SHOP board's place in ui-pet-shop: ui-button's go state 114x22, its bottom 2 rows over
// the parapet. The building below it starts BOARD_RISE rows down. ui-pet-shop-board's frame adds
// BOARD_DROP rows under it, where pressed sinks.
export const BOARD: readonly [x: number, y: number, w: number, h: number] = [3, 0, 114, 22];
// The frame and board the game places must be the ones drawn here.
if (
  PET_SHOP.width !== PET_SHOP_W ||
  PET_SHOP.height !== PET_SHOP_H ||
  PET_SHOP.board.x !== PET_SHOP.x + BOARD[0] ||
  PET_SHOP.board.y !== PET_SHOP.y + BOARD[1] ||
  PET_SHOP.board.width !== BOARD[2] ||
  PET_SHOP.board.height !== BOARD[3]
) {
  throw new Error(`Pet shop layout ${JSON.stringify(PET_SHOP)} differs from ui-pet-shop`);
}
export const BOARD_RISE = 4;
export const BOARD_DROP = 2;
// Projected door-leaf width, keeper reveal and hand pose. All coordinates stay inside the closed
// door.
export type DoorStep = readonly [width: number, reveal: number | null, wave: number | null];
export const DOOR_WAVE: readonly DoorStep[] = [
  [26, null, null],
  [22, null, null],
  [14, 0, null],
  [6, 0.35, null],
  [6, 0.7, -1],
  [6, 1, 0],
  [6, 1, 1],
  [6, 1, 2],
  [6, 1, 1],
  [6, 1, 0],
  [6, 1, -1],
  [6, 1, null],
  [6, 0.35, null],
  [14, 0, null],
  [22, null, null],
  [26, null, null],
];
export const DOOR_WAVE_MS = 120;

// A pixel rectangle, as art-kit's raster ops take it.
type Rect = Parameters<typeof crop>[0];

// The grid every drawing here makes, which small() swaps for a Mini while it draws ui-loading.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

// A small deterministic generator, so a rebuild draws the same specks.
export function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A canvas with a transparent background, for the logo and the pasted strips. A build saves it as
// an RGBA PNG; a Canvas as an RGB one.
export class Clear extends Canvas {
  constructor(w: number, h: number) {
    super(w, h);
    this.img = blankImage(w, h);
  }
}

export function clear(w: number, h: number): Clear {
  return new Clear(w, h);
}

const key = (x: number, y: number): string => `${x},${y}`;

function xy(k: string): [number, number] {
  const [x = 0, y = 0] = k.split(",").map(Number);
  return [x, y];
}

function rgba(c: string): Rgba {
  return [...rgb(c), 255];
}

// The hex colour of image's pixel x, y, ignoring alpha.
function hexAt(img: RgbaImage, x: number, y: number): string {
  const i = (y * img.width + x) * 4;
  return [0, 1, 2].map((k) => img.data[i + k]!.toString(16).padStart(2, "0")).join("");
}

function alphaAt(img: RgbaImage, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3]!;
}

function setPixel(img: RgbaImage, x: number, y: number, c: Rgba): void {
  img.data.set(c, (y * img.width + x) * 4);
}

function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { height: y1 - y0, width: x1 - x0, x: x0, y: y0 };
}

// A fallen leaf lying askew, 3x3 on a diagonal with its stem a ramp step darker at the narrow end,
// tilted the other way on an odd column, so the leaves never read as crosses or sparkles.
export function leaf(cv: Canvas, x: number, y: number, col = "orange"): void {
  const flip = x % 2;
  for (const [dx, dy] of [
    [2, 0],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
  ] as const) {
    cv.fill(x + (flip ? 2 - dx : dx), y + dy, 1, 1, col);
  }
  cv.fill(x + (flip ? 2 : 0), y + 3, 1, 1, dk(col));
}

// Dark wood boards: dbrown with plum seams, staggered butt joints, nail pairs and sparse grain.
export function planks(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  { seed = 1, vertical = false }: { seed?: number; vertical?: boolean } = {},
): void {
  const r = rand(seed);
  cv.fill(x, y, w, h, "dbrown");
  const [span, run] = vertical ? [w, h] : [h, w];
  for (let b = 0; b < span; b += step) {
    if (vertical) {
      cv.fill(x + b, y, 1, h, "plum");
    } else {
      cv.fill(x, y + b, w, 1, "plum");
    }
    let at = -Math.trunc(r() * 120);
    while (at < run) {
      at += 90 + Math.trunc(r() * 70);
      if (at < run) {
        if (vertical) {
          cv.fill(x + b + 1, y + at, step - 1, 1, "plum");
          cv.fill(x + b + 2, y + at - 2, 1, 1, "plum");
          cv.fill(x + b + step - 3, y + at - 2, 1, 1, "plum");
        } else {
          cv.fill(x + at, y + b + 1, 1, step - 1, "plum");
          cv.fill(x + at - 2, y + b + 2, 1, 1, "plum");
          cv.fill(x + at - 2, y + b + step - 3, 1, 1, "plum");
        }
      }
    }
    for (let n = 0; n < Math.floor(run / 110); n++) {
      const g = Math.trunc(r() * (run - 8));
      const off = 2 + Math.trunc(r() * (step - 4));
      if (vertical) {
        cv.fill(x + b + off, y + g, 1, 5, "plum");
      } else {
        cv.fill(x + g, y + b + off, 5, 1, "plum");
      }
    }
  }
}

// ---------- logo ----------

export const PAW: readonly string[] = [".#.#.", "#...#", ".###.", ".###."];

// The comic letters' apostrophe, 2px wide like their stems, for ARCHIE'S.
export const APOSTROPHE: readonly string[] = ["##", "##", "#."];
// The bandana's rows under the portrait's collar (row 41), and the column its point is centred on.
export const BANDANA_ROWS = 8;
export const BANDANA_MID = 30.5;

// A lettering: {"x,y": colour name}.
export type Lettering = ReadonlyMap<string, string>;

// The yard sign's board, w x h: a plum rim with rounded corners, a light trim (cream top, tan
// sides) so it keeps its edge on the dark yard, a dark-stained dbrown face, and a brown lip.
export function board(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fill(x + 1, y, w - 2, h, "plum");
  cv.fill(x, y + 1, w, h - 2, "plum");
  cv.fill(x + 1, y + 1, w - 2, h - 5, "tan");
  cv.fill(x + 1, y + 1, w - 2, 1, "cream");
  cv.fill(x + 2, y + 2, w - 4, h - 6, "dbrown");
  cv.fill(x + 1, y + h - 4, w - 2, 2, "brown");
}

function corner(keys: Iterable<string>): [number, number] {
  const pts = [...keys].map(xy);
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))];
}

// Draw a lettering at x, y by its top-left inked pixel.
export function lettering(px: Lettering, cv: Canvas, x: number, y: number): void {
  const [x0, y0] = corner(px.keys());
  for (const [k, col] of px) {
    const [px_, py] = xy(k);
    cv.fill(x + px_ - x0, y + py - y0, 1, 1, col);
  }
}

// The width and height of a lettering (or any "x,y" keyed pixels).
export function extent(px: ReadonlyMap<string, unknown>): [number, number] {
  const pts = [...px.keys()].map(xy);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.max(...xs) + 1 - Math.min(...xs), Math.max(...ys) + 1 - Math.min(...ys)];
}

// text in the comic letters (fx.ts's LETTERS and APOSTROPHE), built as fx.ts's word builds them:
// letters 1px apart, a 1px ink ring that fills the gaps, a solid dred shadow 2px down and right.
export function comic(textIn: string, fillColour: string): Lettering {
  const letters = new Set<string>();
  let x = 1;
  for (const ch of textIn) {
    const rows = ch === "'" ? APOSTROPHE : LETTERS[ch]!;
    rows.forEach((row, j) => {
      [...row].forEach((c, i) => {
        if (c === "#") {
          letters.add(key(x + i, 1 + j));
        }
      });
    });
    x += rows[0]!.length + 1;
  }
  const ring = new Set<string>();
  for (const k of letters) {
    const [a, b] = xy(k);
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        ring.add(key(a + dx, b + dy));
      }
    }
  }
  const out = new Map<string, string>();
  for (const k of ring) {
    const [a, b] = xy(k);
    for (const d of [1, 2]) {
      const s = key(a + d, b + d);
      if (!ring.has(s)) {
        out.set(s, "dred");
      }
    }
  }
  for (const k of ring) {
    if (!letters.has(k)) {
      out.set(k, "ink");
    }
  }
  for (const k of letters) {
    out.set(k, fillColour);
  }
  return out;
}

// A pixel of Archie's face in portrait-dog-archie, where bust() gathers his head from.
export const HEAD_SEED: readonly [number, number] = [29, 25];

// Archie's head from portrait-dog-archie (its rows 10 to 41, the collar's ink line last, only what
// joins his face, so the tip of his tail is left out) over a short bandana in a closed ink line:
// {"x,y": RGBA} from the portrait's top-left.
export function bust(): Map<string, Rgba> {
  const img = image("portrait-dog-archie");
  const rows = new Map<string, Rgba>();
  for (let y = 10; y < 42; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3]) {
        rows.set(key(x, y), [...img.data.subarray(i, i + 4)] as unknown as Rgba);
      }
    }
  }
  const px = new Map<string, Rgba>();
  const todo: [number, number][] = [[HEAD_SEED[0], HEAD_SEED[1]]];
  while (todo.length) {
    const [qx, qy] = todo.pop()!;
    const k = key(qx, qy);
    if (rows.has(k) && !px.has(k)) {
      px.set(k, rows.get(k)!);
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          todo.push([qx + dx, qy + dy]);
        }
      }
    }
  }
  const band = new Map<string, Rgba>();
  for (let k = 0; k < BANDANA_ROWS; k++) {
    const half = 12.5 - 1.7 * k;
    for (let x = Math.round(BANDANA_MID - half); x < Math.round(BANDANA_MID + half) + 1; x++) {
      band.set(key(x, 42 + k), rgba(x < 33 - Math.floor(k / 2) ? "red" : "dred"));
    }
  }
  band.forEach((c, k) => px.set(k, c));
  for (const k of band.keys()) {
    const [x, y] = xy(k);
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const q = key(x + dx, y + dy);
        if (!px.has(q)) {
          px.set(q, rgba("ink"));
        }
      }
    }
  }
  const [x0, y0] = corner(px.keys());
  return new Map(
    [...px].map(([k, c]) => {
      const [x, y] = xy(k);
      return [key(x - x0, y - y0), c];
    }),
  );
}

export function logo(): Clear {
  const cv = clear(LOGO_W, LOGO_H);
  const head = bust();
  for (const [k, c] of head) {
    const [x, y] = xy(k);
    setPixel(cv.img, x, y, c);
  }
  const [hw, hh] = extent(head);
  const smallText = comic("ARCHIE'S", "cream");
  const [big] = sign("DOG WALKS", 2, "cream");
  const [, sh] = extent(smallText);
  const [, bh] = extent(big);
  const y = Math.floor((hh - sh - bh) / 2) + 1;
  lettering(smallText, cv, hw + 2, y);
  lettering(big, cv, hw + 1, y + sh);
  return cv;
}

// ---------- screen-home ----------

// crowns' leaf lobes: (cx, cy, radius), back to front.
export type Lobe = readonly [cx: number, cy: number, rad: number];

// A crown of round lobes, back to front, lit as one mass from the top left: each lobe takes a
// crescent of shade along its lower right rim and of light along its upper left, the shade only where
// the lobe lies off the crown's lit side and the light only off its shaded side, so the lobes read as
// clumps of one tree rather than separate balls.
export function crowns(
  cv: Canvas,
  lobes: readonly Lobe[],
  lit: string,
  face: string,
  shade: string,
): void {
  const mx = lobes.reduce((sum, [x]) => sum + x, 0) / lobes.length;
  const my = lobes.reduce((sum, [, y]) => sum + y, 0) / lobes.length;
  const reach = Math.max(...lobes.map(([x, y, r]) => Math.hypot(x - mx, y - my) + r));
  const px = new Map<string, string>();
  for (const [cx, cy, rad] of lobes) {
    const dark = rad * 0.4;
    const light = rad * 0.35;
    for (let dy = -rad; dy < rad + 1; dy++) {
      for (let dx = -rad; dx < rad + 1; dx++) {
        if (dx * dx + dy * dy <= rad * rad) {
          const g = (cx + dx - mx + cy + dy - my) / reach;
          let c = face;
          if ((dx + dark) ** 2 + (dy + dark) ** 2 > rad * rad && g > -0.35) {
            c = shade;
          } else if ((dx - light) ** 2 + (dy - light) ** 2 > rad * rad && g < 0.35) {
            c = lit;
          }
          px.set(key(cx + dx, cy + dy), c);
        }
      }
    }
  }
  for (const [k, c] of px) {
    const [x, y] = xy(k);
    cv.fill(x, y, 1, 1, c);
  }
}

// A complete masonry wall with quiet courses and one recessed sash window.
function courtyardWall(cv: Canvas): void {
  cv.fill(0, 40, W, 57, "stone");
  for (const [y, joints] of [
    [61, [49, 124, 201]],
    [82, [78, 162, 226]],
  ] as const) {
    cv.fill(0, y, 234, 1, "dstone");
    for (const x of joints) {
      cv.fill(x, y - 16, 1, 16, "dstone");
    }
  }
  cv.fill(0, 94, 234, 3, "dstone");
  // The exposed left window has its whole lintel and sill inside the courtyard band.
  cv.fill(7, 51, 27, 37, "dstone");
  cv.fill(8, 52, 25, 2, "driftwood");
  cv.fill(9, 54, 23, 31, "bark");
  cv.fill(11, 56, 19, 27, "navy");
  cv.fill(12, 57, 17, 24, "dlake");
  cv.fill(12, 57, 17, 2, "lake");
  cv.fill(20, 57, 2, 24, "stone");
  cv.fill(12, 69, 17, 2, "stone");
  cv.fill(10, 83, 23, 2, "driftwood");
  cv.fill(7, 85, 28, 2, "dstone");
}

// Broad flagstones and a quiet brick path, with sparse joints behind the pack.
function courtyardPaving(cv: Canvas): void {
  cv.fill(0, 97, W, 67, "driftwood");
  for (const y of [113, 137, 163]) {
    cv.fill(0, y, 151, 1, "stone");
    cv.fill(208, y, W - 208, 1, "stone");
  }
  for (const [x, y, h] of [
    [28, 98, 15],
    [103, 98, 15],
    [62, 114, 23],
    [116, 138, 25],
    [25, 138, 25],
    [222, 114, 23],
    [288, 138, 25],
    [338, 114, 23],
  ] as const) {
    cv.fill(x, y, 1, h, "stone");
  }
  cv.fill(162, 97, 36, 67, "dstone");
  cv.fill(164, 97, 32, 67, "clay");
  for (let n = 0, y = 102; y < 164; n++, y += 8) {
    cv.fill(164, y, 32, 1, "bark");
    for (let x = 164 + (n % 2) * 8; x < 196; x += 16) {
      cv.fill(x, y + 1, 1, Math.min(7, 163 - y), "bark");
    }
  }
  cv.fill(164, 97, 1, 67, "driftwood");
}

export function home(): Canvas {
  const cv = new Canvas(W, H);
  cv.fill(0, 0, W, H, "dbrown");
  cv.fill(0, 0, W, 38, "plum");
  courtyardWall(cv);
  courtyardPaving(cv);
  // A contained low planter leaves the top bar and dialogue free of foliage.
  cv.fill(2, 95, 46, 10, "bark");
  cv.fill(3, 96, 44, 8, "clay");
  cv.fill(2, 95, 46, 2, "driftwood");
  crowns(
    cv,
    [
      [10, 92, 5],
      [19, 90, 6],
      [29, 91, 5],
      [39, 92, 5],
    ],
    "brown",
    "bark",
    "walnut",
  );
  for (const [x, y] of [
    [10, 90],
    [23, 87],
    [36, 91],
  ] as const) {
    cv.fill(x, y, 3, 2, "ochre");
  }
  // Open gate and short piers share the courtyard's ground plane.
  for (const [x, w] of [
    [0, 152],
    [208, 26],
  ] as const) {
    cv.fill(x, 108, w, 3, "dstone");
    cv.fill(x, 108, w, 1, "stone");
    for (let px = x + 4; px < x + w; px += 8) {
      cv.fill(px, 96, 1, 12, "shale");
    }
    cv.fill(x, 98, w, 1, "shale");
    cv.fill(x, 105, w, 1, "shale");
  }
  for (const x of [152, 202]) {
    cv.fill(x, 91, 6, 23, "clay");
    cv.fill(x + 4, 91, 2, 23, "bark");
    for (let y = 96; y < 114; y += 6) {
      cv.fill(x, y, 6, 1, "bark");
    }
    cv.fill(x - 1, 89, 8, 2, "dstone");
    cv.fill(x - 1, 89, 8, 1, "driftwood");
  }
  // The street-name plate keeps its existing text anchor without adding lettering to art.
  cv.fill(319, 50, 2, 44, "dstone");
  cv.fill(319, 50, 1, 44, "stone");
  cv.fill(286, 40, 68, 12, "dslate");
  cv.fill(287, 41, 66, 10, "navy");
  // A shallow contact shadow seats the existing shop's step on the same paving.
  cv.fill(233, 160, 122, 3, "dstone");
  // The logo board is the foreground focal point on the exposed left.
  for (const x of [16, 120]) {
    cv.fill(x, 140, 3, 23, "bark");
    cv.fill(x, 140, 1, 22, "clay");
    cv.fill(x - 1, 162, 5, 1, "stone");
  }
  board(cv, SIGN_AT[0], SIGN_AT[1], SIGN_W, SIGN_H);
  let y = SIGN_AT[1] + 6;
  for (const line of ["ARCHIE'S", "DOG WALKS"]) {
    const [letters] = sign(line, 2, "yellow");
    const [w, h] = extent(letters);
    lettering(letters, cv, SIGN_AT[0] + Math.floor((SIGN_W - w) / 2) + 1, y);
    y += h - 2;
  }
  // Sparse grounded props stay outside the pack's clear central path.
  leaf(cv, 43, 153, "ochre");
  leaf(cv, 139, 145, "rust");
  cv.fill(220, 157, 10, 4, "dstone");
  cv.fill(221, 157, 8, 2, "dlake");
  cv.fill(222, 157, 3, 1, "shallow");
  cv.fill(0, 164, W, 2, "brown");
  cv.fill(0, 166, W, 1, "plum");
  return cv;
}

// ---------- ui-pet-shop ----------

export const BONE: readonly string[] = [
  "..cc.......cc..",
  ".cccc.....cccc.",
  "ccccccccccccccc",
  "ccccccccccccccc",
  ".cccc.....cccc.",
  "..cc.......cc..",
];

// 17x21: a tan puppy sitting up in the shop window, front view, floppy brown ears, a white muzzle
// and chest, a pink tongue out; cel shaded in an ink line, as the faces are.
export function windowPuppy(): Drawable {
  const g = edged(scope.Grid(17, 21), "ink");
  g.cel(8.5, 16, 5.5, 4.5, "tan", "brown");
  g.cel(8.5, 16.5, 2.5, 3, "white", "lgrey");
  g.cel(8.5, 8.2, 6, 5.3, "tan", "brown", "skin1", 2.6);
  for (const x of [2.5, 14.5]) {
    g.cel(x, 9, 1.8, 3.6, "brown", "dbrown");
  }
  g.cel(8.5, 11, 2.6, 1.9, "white", "lgrey");
  for (const x of [5, 11]) {
    g.rect(x, 7, 2, 2, "ink");
    g.p(x, 7, "white");
  }
  g.rect(8, 9, 2, 1, "ink");
  g.rect(8, 11, 2, 2, "pink");
  g.p(4, 10, "pink");
  g.p(13, 10, "pink");
  return g;
}

export interface PetShopOptions {
  // A DOOR_WAVE frame index for door-wave, or null for the static closed door.
  doorFrame?: number | null;
  pressed?: boolean;
}

// ui-pet-shop's frame, PET_SHOP_W x PET_SHOP_H: the building from BOARD_RISE down, without its
// board. Everything but the step is drawn t rows lower, so pressed sinks the front 2px onto a step
// 1px shallower, as ui-button's face sinks into its lip.
export function petShop({ doorFrame = null, pressed = false }: PetShopOptions = {}): Clear {
  const cv = clear(PET_SHOP_W, PET_SHOP_H);
  building(cv, PET_SHOP_W, PET_SHOP_H - BOARD_RISE, pressed, doorFrame);
  return cv;
}

// ui-pet-shop-board's frame, BOARD's width x its height plus BOARD_DROP.
export function petShopBoard(pressed = false): Clear {
  const cv = clear(BOARD[2], BOARD[3] + BOARD_DROP);
  shopBoard(cv, pressed);
  return cv;
}

// The shop with its board at rest, as the yard shows them.
export function petShopFront({ doorFrame = null, pressed = false }: PetShopOptions = {}): Clear {
  const cv = petShop({ doorFrame, pressed });
  composite({ x: BOARD[0], y: BOARD[1] }, petShopBoard(pressed).img, cv.img);
  return cv;
}

// The PET SHOP board from its frame's top left: ui-button's go state, a green face with a yellow
// top highlight on a forest lip 4px deep, in an ink line with its corners cut, and PET SHOP in the
// sign letters' shapes at 2x, filled ink (8.41:1 on green) with no outline or shadow, as the go
// label. Raised, row 0 is ink, row 1 the highlight, the face runs to row 16, the lip fills rows 17
// to 20 and ink row 21; the caps fill rows 4 to 13. Pressed, the lip and highlight give way to
// face, as go-pressed, and the board rides down with the front: face and letters sink BOARD_DROP.
export function shopBoard(cv: Canvas, pressed: boolean): void {
  const [, , bw, bh] = BOARD;
  const t = pressed ? BOARD_DROP : 0;
  const [face, lip, hi] = STATES.go!;
  cv.fill(1, t, bw - 2, bh, "ink");
  cv.fill(0, 1 + t, bw, bh - 2, "ink");
  cv.fill(1, 1 + t, bw - 2, bh - 2, face);
  if (!pressed) {
    cv.fill(1, 1, bw - 2, 1, hi!);
    cv.fill(1, bh - 5, bw - 2, 4, lip!);
  }
  const [letters] = sign("PET SHOP", 2);
  const caps = [...letters].filter(([, c]) => c !== "ink" && c !== "dred").map(([k]) => xy(k));
  const x0 = Math.min(...caps.map(([x]) => x));
  const y0 = Math.min(...caps.map(([, y]) => y));
  const lw = Math.max(...caps.map(([x]) => x)) + 1 - x0;
  const lx = Math.floor((bw - lw) / 2);
  for (const [x, y] of caps) {
    cv.fill(lx + x - x0, 4 + t + y - y0, 1, 1, "ink");
  }
}

// The shop below the board, w x h from BOARD_RISE down: walls, parapet, awning, window, door and
// step.
export function building(
  full: Canvas,
  w: number,
  h: number,
  pressed: boolean,
  doorFrame: number | null = null,
): void {
  const cv = clear(w, h);
  const t = pressed ? 2 : 0;
  // walls: rust brick in an ink line, lit ochre on the left, dred on the right, so the green board
  // stands off them; dbrown mortar every 4 rows, the joints 8px apart and staggered a half brick
  cv.fill(4, 18 + t, w - 8, h - 18 - t, "ink");
  cv.fill(5, 19 + t, w - 10, h - 19 - t, "rust");
  for (let n = 0, y = 22 + t; y < h; n++, y += 4) {
    cv.fill(7, y, w - 14, 1, "dbrown");
    for (let x = 7 + (n % 2) * 4; x < w - 7; x += 8) {
      cv.fill(x, y + 1, 1, 3, "dbrown");
    }
  }
  cv.fill(5, 19 + t, 2, h - 19 - t, "ochre");
  cv.fill(w - 7, 19 + t, 2, h - 19 - t, "dred");
  // the parapet trim
  cv.fill(2, 16 + t, w - 4, 4, "ink");
  cv.fill(3, 17 + t, w - 6, 2, "cream");
  // the awning: red and white stripes 6px wide, shaded along the bottom, over a scalloped ink edge
  const top = 24 + t;
  const bot = 36 + t;
  cv.fill(2, top - 1, w - 4, bot - top + 2, "ink");
  for (let x = 3; x < w - 3; x++) {
    const red = Math.floor((x - 3) / 6) % 2 === 0;
    cv.fill(x, top, 1, bot - top - 3, red ? "red" : "white");
    cv.fill(x, bot - 3, 1, 3, red ? "dred" : "lgrey");
    if ([1, 2, 3, 4].includes((x - 3) % 6)) {
      cv.fill(x, bot, 1, 1, red ? "dred" : "lgrey");
      cv.fill(x, bot + 1, 1, 1, "ink");
    } else {
      cv.fill(x, bot, 1, 1, "ink");
    }
  }
  // the display window: a cream frame, sky glass with two glints, a blue sill
  const [wx, wy, ww, wh] = [10, 44 + t, 56, 46];
  cv.fill(wx - 1, wy - 1, ww + 2, wh + 2, "ink");
  cv.fill(wx, wy, ww, wh, "cream");
  cv.fill(wx + 2, wy + 2, ww - 4, wh - 4, "sky");
  cv.fill(wx + 2, wy + wh - 8, ww - 4, 6, "blue");
  cv.fill(wx + 2, wy + wh - 3, ww - 4, 1, "plum");
  for (let i = 0; i < 10; i++) {
    cv.fill(wx + 6 + i, wy + 14 - i, 1, 1, "cyan");
    cv.fill(wx + 10 + i, wy + 18 - i, 1, 1, "white");
  }
  // a food bag and a bone on the sill
  cv.fill(wx + 8, wy + 20, 14, 18, "ink");
  cv.fill(wx + 9, wy + 21, 12, 16, "amber");
  cv.fill(wx + 9, wy + 21, 12, 2, "yellow");
  cv.fill(wx + 19, wy + 23, 2, 14, "orange");
  cv.fill(wx + 11, wy + 26, 7, 6, "red");
  cv.fill(wx + 13, wy + 28, 3, 2, "white");
  // a puppy sitting on the sill behind the bone, waiting to be taken home
  windowPuppy()
    .outlined()
    .forEach((row, y) => {
      row.forEach((c, x) => {
        if (c) {
          cv.fill(wx + 28 + x, wy + 15 + y, 1, 1, c);
        }
      });
    });
  const bone = new Set<string>();
  BONE.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "c") {
        bone.add(key(x, y));
      }
    });
  });
  const rimSet = new Set<string>();
  for (const k of bone) {
    const [x, y] = xy(k);
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const q = key(x + dx, y + dy);
      if (!bone.has(q)) {
        rimSet.add(q);
      }
    }
  }
  for (const k of rimSet) {
    const [x, y] = xy(k);
    cv.fill(wx + 29 + x, wy + 31 + y, 1, 1, "blue");
  }
  for (const k of bone) {
    const [x, y] = xy(k);
    cv.fill(wx + 29 + x, wy + 31 + y, 1, 1, y < 2 ? "white" : y > 3 ? "lgrey" : "cream");
  }
  shopDoor(cv, h, pressed, doorFrame);
  // the step: 4 rows, 3 when pressed
  const sy = pressed ? h - 3 : h - 4;
  cv.fill(2, sy, w - 4, h - sy, "ink");
  cv.fill(3, sy + 1, w - 6, h - sy - 2, "lgrey");
  if (!pressed) {
    cv.fill(3, h - 2, w - 6, 1, "grey");
  }
  composite({ x: 0, y: BOARD_RISE }, cv.img, full.img);
}

// The keeper's raised near arm in each wave pose: [elbow, hand] offsets from the body's centre column
// and rows on its clip. -1 lifts the forearm on the way up; 0, 1 and 2 hold the hand at head height,
// then swing it out and in about the elbow. Upper arm and forearm keep the hanging arm's lengths, so
// the arm reads as one limb.
const KEEPER_WAVE: ReadonlyMap<
  number,
  readonly [readonly [number, number], readonly [number, number]]
> = new Map([
  [
    -1,
    [
      [-9, 21],
      [-9, 15],
    ],
  ],
  [
    0,
    [
      [-9, 12],
      [-8, 6],
    ],
  ],
  [
    1,
    [
      [-9, 12],
      [-10, 7],
    ],
  ],
  [
    2,
    [
      [-9, 12],
      [-7, 6],
    ],
  ],
]);

// A friendly native keeper on a 20x48 clip, behind the door leaf, standing on the doorway's floor
// with his head 5px under the lintel: a third of his height is head, the rest a short-sleeved shirt
// and apron over trousers. Both arms hang from the shoulders' top row; the near one raises from there
// to wave. The keeper draws lines, which only a full-size Grid has, so it is never drawn small.
export function shopKeeper(reveal: number, wave: number | null): RgbaImage {
  const g = edged(new Grid(20, 48), "ink");
  const cx = 11 + Math.round((1 - reveal) * 4);
  // A short apron exposes two trouser legs, a dark gap and grounded shoes.
  g.rect(cx - 4, 30, 3, 16, "navy");
  g.rect(cx - 4, 32, 1, 12, "dslate");
  g.rect(cx + 1, 30, 3, 16, "navy");
  g.rect(cx + 1, 32, 1, 12, "dslate");
  g.rect(cx - 5, 46, 4, 1, "brown");
  g.rect(cx + 1, 46, 4, 1, "brown");
  g.rect(cx - 6, 16, 12, 14, "cream");
  g.rect(cx + 4, 17, 2, 13, "tan");
  g.rect(cx - 2, 14, 4, 3, "skin2");
  g.rect(cx - 4, 20, 8, 12, "blue");
  g.rect(cx - 4, 17, 2, 7, "sky");
  g.rect(cx + 2, 17, 2, 7, "sky");
  g.rect(cx - 3, 31, 6, 1, "sky");
  g.rect(cx - 1, 23, 2, 2, "yellow");
  // A rounded short haircut, calm eyes and a small open smile.
  g.cel(cx, 9, 5.5, 6, "skin1", "skin2");
  g.cel(cx, 5, 5.5, 3, "dbrown", "plum", "brown");
  g.rect(cx - 5, 7, 1, 4, "dbrown");
  g.rect(cx + 4, 7, 1, 4, "plum");
  g.p(cx - 2, 10, "ink");
  g.p(cx + 2, 10, "ink");
  g.p(cx - 1, 12, "dred");
  g.p(cx, 13, "dred");
  g.p(cx + 1, 12, "dred");
  // Short sleeves from the shoulder's top row, then bare forearms, the hands at the hips.
  g.rect(cx + 6, 16, 2, 5, "cream");
  g.rect(cx + 6, 21, 2, 11, "skin1");
  if (wave === null) {
    g.rect(cx - 8, 16, 3, 5, "cream");
    g.rect(cx - 8, 21, 2, 11, "skin1");
  } else {
    const [[ex, ey], [hx, hy]] = KEEPER_WAVE.get(wave)!;
    const elbow = [cx + ex, ey] as const;
    const hand = [cx + hx, hy] as const;
    const sleeve = [
      cx - 8 + Math.floor((elbow[0] - cx + 8) / 2),
      18 + Math.floor((elbow[1] - 18) / 2),
    ] as const;
    for (const offset of [0, 1]) {
      g.line(cx - 8 + offset, 18, elbow[0] + offset, elbow[1], "skin1");
      g.line(cx - 8 + offset, 18, sleeve[0] + offset, sleeve[1], "cream");
      g.line(elbow[0] + offset, elbow[1], hand[0] + offset, hand[1], "skin1");
    }
    g.rect(cx - 8, 16, 3, 3, "cream");
    g.rect(hand[0] - 1, hand[1] - 2, 3, 3, "skin1");
    g.p(hand[0], hand[1] - 3, "skin1");
  }
  return toImage(g.outlined());
}

// The static closed door or a projected right-hinged leaf over the keeper.
export function shopDoor(cv: Canvas, h: number, pressed: boolean, doorFrame: number | null): void {
  const t = pressed ? 2 : 0;
  const [dx, dy, dw] = [76, 44 + t, 30];
  cv.fill(dx - 1, dy - 1, dw + 2, h - dy + 1, "ink");
  cv.fill(dx, dy, dw, h - dy, "cream");
  cv.fill(dx + 2, dy + 2, dw - 4, h - dy - 2, "navy");
  cv.fill(dx + 2, dy + 2, 1, h - dy - 2, "dslate");
  cv.fill(dx + 6, dy + 6, dw - 12, 14, "sky");
  cv.fill(dx + 6, dy + 6, dw - 12, 1, "cyan");
  PAW.forEach((row, j) => {
    [...row].forEach((c, i) => {
      if (c === "#") {
        cv.fill(dx + 13 + i, dy + 11 + j, 1, 1, "cream");
      }
    });
  });
  cv.fill(dx + 5, dy + 30, 3, 3, "amber");
  if (doorFrame === null) {
    return;
  }
  const [width, reveal, wave] = DOOR_WAVE[doorFrame]!;
  if (width === 26) {
    return;
  }
  // The aperture ends above the unchanged doorstep. The hinge column stays at x=103.
  const [left, top, height] = [104 - width, 46, 54];
  cv.fill(78, top, 26, height, "ink");
  cv.fill(79, top + 1, 24, 2, "navy");
  cv.fill(78, 95, 26, 5, "dbrown");
  if (reveal !== null) {
    composite({ x: 79, y: 52 }, shopKeeper(reveal, wave), cv.img);
  }
  const ratio = width / 26;
  cv.fill(left, top, width, height, "navy");
  cv.fill(left, top, 1, height, "dslate");
  const paneX = left + Math.max(1, Math.round(4 * ratio));
  const paneW = Math.max(1, Math.round(18 * ratio));
  cv.fill(paneX, dy + 6, paneW, 14, "sky");
  cv.fill(paneX, dy + 6, paneW, 1, "cyan");
  PAW.forEach((row, j) => {
    [...row].forEach((c, i) => {
      if (c === "#") {
        cv.fill(left + Math.round((11 + i) * ratio), dy + 11 + j, 1, 1, "cream");
      }
    });
  });
  const knobX = left + Math.max(1, Math.round(3 * ratio));
  cv.fill(knobX, dy + 30, Math.max(1, Math.round(3 * ratio)), 3, "amber");
}

// An RGBA image as sprite frame rows: hex colours, null where clear.
export function imageRows(img: RgbaImage): Frame {
  return Array.from({ length: img.height }, (_, y) =>
    Array.from({ length: img.width }, (_, x) => (alphaAt(img, x, y) ? hexAt(img, x, y) : null)),
  );
}

// The sky after dark, top to horizon: night falling over a last mauve glow, on screen-loading.
export const NIGHT_SKY: readonly string[] = ["navy", "purple", "mauve"];

// ---------- screen-end ----------

export const END_STREET = 370; // top of the street strip on screen-end
// The street strip's front yards, the lawn from its row 104; the sidewalk, curb and gutter's 20 rows
// follow, so the road starts on screen row END_ROAD, 3 rows over the button's top (514) and 2 over
// its 1px bob
export const END_YARD = 17;
export const END_WALK = 104 + END_YARD; // the strip's first sidewalk row
export const END_ROAD = END_STREET + END_WALK + 20;
// Cabbagetown's dusk, top to horizon, as its backdrop: lilac over pink and peach to a gold glow.
export const DUSK_SKY: readonly string[] = ["lilac", "pink", "peach", "gold"];
// The CN Tower's centre column, foot and mast tip on screen-end.
export const END_CN: readonly [number, number, number] = [306, 96, 4];
export const END_RIDGE = 43; // the house's roof ridge on screen-end, under the logo's foot
// Where EndScene draws the logo, 107,2.
export const END_LOGO_AT: readonly [number, number] = [
  Math.floor((W - LOGO_W) / 2),
  END_RIDGE - LOGO_H,
];

// An end-screen sash: warm glass behind orange curtains, or a room left dark, in a shaded frame.
export function endWindow(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  lit = true,
  trim = "tan",
): void {
  cv.fill(x - 1, y - 1, w + 2, h + 2, "plum");
  cv.fill(x, y, w, h, trim);
  cv.fill(x + 1, y + 1, w - 2, h - 2, lit ? "amber" : "dslate");
  if (lit) {
    cv.fill(x + 2, y + 2, Math.max(2, w - 4), h - 4, "gold");
    cv.fill(x + 1, y + 1, 2, h - 2, "orange");
    cv.fill(x + w - 3, y + 1, 2, h - 2, "orange");
  } else if (w >= 6) {
    cv.fill(x + 2, y + 2, 2, h - 4, "ash");
  }
  cv.fill(x + 1, y + Math.floor(h / 2), w - 2, 1, trim);
  if (w >= 12) {
    cv.fill(x + Math.floor(w / 2), y + 1, 1, h - 2, trim);
  }
  cv.fill(x - 1, y + h, w + 2, 1, lit ? "tan" : "stone");
}

// An end-screen bay-and-gable with defined eaves and bay ledges, each room lit separately.
export function endHouse(
  cv: Canvas,
  cx: number,
  w: number,
  wall: string,
  roof: string,
  door: string,
  base: number,
): void {
  bd.bayGable(cv, cx, w, wall, roof, door, base, { curtains: "orange", trim: "cream" });
  const x = cx - Math.floor(w / 2);
  const top = base - 50;
  const roofH = 22;
  const wy = top + roofH;
  const bx = x + 2;
  const bw = Math.floor(w / 2) - 1;
  cv.fill(x - 2, wy + 1, w + 4, 2, "coal");
  cv.fill(bx - 1, wy + 3, bw + 2, 1, "tan");
  [wy + 4, wy + 16].forEach((yy, storey) => {
    for (let k = 0; k < 3; k++) {
      const wx = bx + 1 + Math.floor((k * (bw - 2)) / 3);
      const ww = Math.max(3, Math.floor((bw - 2) / 3) - 1);
      const lit = !(storey === 0 && (cx === 114 || (cx === 300 && k === 1)));
      endWindow(cv, wx, yy, ww, 8, lit);
    }
  });
  endWindow(cv, x + w - 12, wy + 4, 8, 10, cx !== 354);
  cv.fill(bx - 1, wy + 15, bw + 2, 1, "tan");
  cv.fill(x + w - 14, top + 5, 2, 6, "clay");
}

// Quiet brick clusters and four-pane sashes around the cottage's gable, doorway and flower beds.
function endCottageFace(cv: Canvas): void {
  const rects = [
    rect(154, 43, 206, 55),
    rect(167, 63, 200, 96),
    rect(124, 90, 164, 96),
    rect(196, 90, 236, 96),
  ];
  const details = rects.map((r) => [r, crop(r, cv.img)] as const);
  cv.fill(124, 53, 112, 43, "brick");
  cv.fill(233, 53, 3, 43, "dbrick");
  for (let y = 57; y < 96; y += 8) {
    for (let x = 126 + (Math.floor(y / 8) % 2) * 8; x < 232; x += 18) {
      cv.fill(x, y, 2, 1, "dbrick");
    }
  }
  for (const wx of [134, 208]) {
    cv.fill(wx - 2, 58, 22, 3, "stone");
    endWindow(cv, wx, 62, 18, 24, true, "cream");
  }
  for (const [r, detail] of details) {
    paste({ at: { x: r.x, y: r.y } }, detail, cv.img);
  }
}

// Moss and olive lawns keep the foreground figures clear, with no tufts across their central stage.
function endLawns(cv: Canvas): void {
  const img = cv.img;
  const colours = new Map([
    [K.green!, rgba("moss")],
    [K.dgreen!, rgba("olive")],
  ]);
  const rows = [
    ...Array.from({ length: 16 }, (_, i) => 96 + i),
    ...Array.from({ length: END_WALK - 104 }, (_, i) => END_STREET + 104 + i),
  ];
  for (const y of rows) {
    for (let x = 0; x < W; x++) {
      const to = colours.get(hexAt(img, x, y));
      if (to) {
        setPixel(img, x, y, to);
      }
    }
  }
  for (let i = 0; i < 30; i++) {
    const x = (i * 41) % W;
    const y = 98 + ((i * 7) % 13);
    if (x >= 80 && x <= 300) {
      for (const row of [y, y + 1]) {
        if (hexAt(img, x, row) === K.olive) {
          setPixel(img, x, row, rgba("moss"));
        }
      }
    }
  }
}

export function end(): Canvas {
  const cv = new Canvas(W, H);
  // Cabbagetown's dusk, twice: behind the house down to its lawn, and behind the panel down to the
  // far rooftops of the street below; the CN Tower lit over the roofs at the right
  cv.fill(0, 0, W, 520, DUSK_SKY.at(-1)!);
  bd.bands(cv, 0, 96, DUSK_SKY);
  // Plain lower sky bands keep the open area behind the results calm.
  bd.bandRows(112, END_STREET + 80, DUSK_SKY.length, { ratio: 0.7 }).forEach(([top, bottom], i) => {
    cv.fill(0, top, W, bottom - top, DUSK_SKY[i]!);
  });
  for (const [x, y] of [
    [40, 6],
    [92, 14],
    [262, 4],
    [348, 20],
    [20, 30],
  ] as const) {
    cv.fill(x, y, 1, 1, "white");
  }
  cnTower(cv, ...END_CN);
  // two gulls heading home
  for (const [bx, by] of [
    [84, 50],
    [100, 42],
  ] as const) {
    cv.fill(bx, by, 2, 1, "plum");
    cv.fill(bx + 2, by + 1, 1, 1, "plum");
    cv.fill(bx + 3, by, 2, 1, "plum");
  }
  // the neighbours either side: bay-and-gables with their lamps lit behind the curtains
  for (const [cx, wall, roof, door] of [
    [6, "brick", "dslate", "navy"],
    [60, "dbrick", "shale", "forest"],
    [300, "brick", "shale", "ttc"],
    [354, "dbrick", "dslate", "forest"],
  ] as const) {
    endHouse(cv, cx, 46, wall, roof, door, 96);
  }
  // the house the pack comes home to, between the logo and the panel: a brick Cabbagetown cottage
  // whose slate roof's ridge (END_RIDGE) the logo stands on, a low centre gable trimmed in white over
  // the door
  for (let i = 0; i < 49 - END_RIDGE; i++) {
    cv.fill(122 - 2 * i, END_RIDGE + i, 116 + 4 * i, 1, "shale");
    cv.fill(122 - 2 * i, END_RIDGE + i, 2, 1, "ash");
  }
  cv.fill(108, 49, 144, 2, "coal");
  cv.fill(124, 51, 112, 45, "brick");
  cv.fill(233, 51, 3, 45, "dbrick");
  for (let y = 55; y < 96; y += 5) {
    for (let x = 124 + (Math.floor(y / 5) % 2) * 6; x < 233; x += 12) {
      cv.fill(x, y, 1, 1, "dbrick");
    }
  }
  const rows = 54 - END_RIDGE;
  for (let i = 0; i < rows; i++) {
    const half = 2 + Math.floor((i * 22) / (rows - 1));
    cv.fill(180 - half, END_RIDGE + i, 2 * half, 1, "brick");
    cv.fill(180 - half - 1, END_RIDGE + i, 2, 1, "white");
    cv.fill(180 + half - 1, END_RIDGE + i, 2, 1, "white");
  }
  cv.fill(158, 54, 44, 1, "white");
  litWindow(cv, 178, 47, 5, 5, "stone", true, true);
  // two tall sash windows lit gold under stone lintels
  for (const wx of [134, 208]) {
    cv.fill(wx - 2, 58, 22, 3, "stone");
    litWindow(cv, wx, 62, 18, 24, "white", true);
  }
  // the front door in a stone surround under its lit transom, a porch light beside it, and the step
  cv.fill(167, 63, 26, 33, "stone");
  cv.fill(169, 65, 22, 31, "white");
  cv.fill(171, 66, 18, 6, "gold");
  cv.fill(179, 66, 2, 6, "white");
  cv.fill(171, 73, 18, 23, "dgreen");
  for (const py of [75, 85]) {
    cv.fill(173, py, 6, 8, "forest");
    cv.fill(181, py, 6, 8, "forest");
  }
  cv.fill(186, 83, 2, 2, "amber");
  cv.fill(196, 70, 4, 2, "coal");
  cv.fill(197, 72, 2, 3, "yellow");
  // the lawn, flower beds along the wall and a low hedge either side of the house
  cv.fill(0, 96, W, 16, "green");
  for (let i = 0; i < 30; i++) {
    cv.fill((i * 41) % W, 98 + ((i * 7) % 13), 1, 2, "dgreen");
  }
  for (const [x0, x1] of [
    [124, 164],
    [196, 236],
  ] as const) {
    cv.fill(x0, 92, x1 - x0, 4, "dbrown");
    cv.fill(x0, 92, x1 - x0, 1, "plum");
    bd.flowers(cv, x0 + 2, x1 - 2, 90, { cols: ["orange", "yellow", "red", "pink"] });
  }
  for (const x of [90, 104, 240, 254]) {
    bd.bush(cv, x, 93, { col: "dgreen", lobes: bd.SHRUB });
  }
  cv.fill(164, 96, 32, 4, "stone");
  cv.fill(164, 99, 32, 1, "dstone");
  // the front path: tan flagstones from the step down behind the panel
  cv.fill(168, 100, 24, 12, "tan");
  cv.fill(168, 106, 24, 1, "brown");
  cv.fill(178, 100, 1, 6, "brown");
  cv.fill(184, 107, 1, 5, "brown");
  cv.fill(167, 100, 1, 12, "dgreen");
  cv.fill(192, 100, 1, 12, "dgreen");
  endCottageFace(cv);
  // the rest of the city, far off: rooftops and towers in mauve against the glow
  bd.roofline(
    cv,
    END_STREET + 110,
    [
      [8, 22, 30],
      [50, 40, 26],
      [118, 36, 28],
      [178, 44, 24],
      [250, 38, 30],
      [314, 38, 26],
    ],
    "mauve",
  );
  const r = rand(17);
  for (const [x, w, h] of [
    [30, 14, 56],
    [96, 18, 70],
    [160, 12, 50],
    [226, 16, 64],
    [292, 14, 58],
  ] as const) {
    const top = END_STREET + 80 - h;
    cv.fill(x, top, w, h + 30, "mauve");
    cv.fill(x + 3, top - 3, w - 6, 3, "mauve");
    for (let wy = top + 4; wy < END_STREET + 60; wy += 5) {
      for (let wx = x + 3; wx < x + w - 3; wx += 4) {
        if (r() < 0.3) {
          cv.fill(wx, wy, 2, 1, "gold");
        }
      }
    }
  }
  // The street below at dusk: Cabbagetown's bay-and-gables, lamps lit behind their curtains, canopy
  // trees, iron fences, the yards and the sidewalk with its heritage lamps. Everything standing is
  // kept within x 8 to 352, so the badges panel never cuts it into slivers.
  const strip = clear(W, 150);
  for (const [cx, top] of [
    [28, 50],
    [180, 46],
    [330, 52],
  ] as const) {
    bd.tree(strip, cx, top, { leaf: "canopy", r: 16, shade: "pine", trunk: "bark" });
  }
  for (const [cx, wall, roof, door] of [
    [60, "brick", "shale", "forest"],
    [114, "cream", "slate", "ttc"],
    [246, "dbrick", "dslate", "navy"],
    [300, "brick", "shale", "ttc"],
  ] as const) {
    endHouse(strip, cx, 46, wall, roof, door, 104);
  }
  bd.ground(strip, { yard: END_YARD });
  bd.flowers(strip, 40, 84, END_WALK - 13, { cols: ["orange", "yellow", "red"] });
  bd.flowers(strip, 226, 270, END_WALK - 12, { cols: ["orange", "yellow", "red"] });
  for (const [x0, x1] of [
    [8, 52],
    [72, 106],
    [126, 236],
    [258, 292],
    [312, 352],
  ] as const) {
    bd.ironFence(strip, END_WALK - 10, x0, x1);
  }
  for (const x of [150, 210]) {
    bd.gasLamp(strip, x, END_WALK + 14);
  }
  cv.paste(strip.img, 0, END_STREET);
  // Repeat the road's interior columns 64 to 126 across the footer, without lane edges or dashes.
  // Anchor the repeats at the right edge so the rightmost strip keeps its texture phase.
  const zone = [...ZONES].find(([, v]) => v.art === "kensington-market")![0];
  const tile = crop(rect(64, 5, 127, 5 + H - END_ROAD), TILES.get(zone)!);
  for (let x = W - tile.width; x > -tile.width; x -= tile.width) {
    paste({ at: { x, y: END_ROAD } }, tile, cv.img);
  }
  endLawns(cv);
  return cv;
}

// ---------- screen-loading, ui-loading-track, ui-loading ----------

export const SKY_FOOT = 356; // NIGHT_SKY's bands end here, behind the skyline's foot
// The iron fences' and the Pet shop's bottom row: the sidewalk starts under it.
export const YARD_FOOT = 414;
export const CURB = 470; // the sidewalk's last row is CURB - 1; the curb, then the street
// The logo at 2x, 290x82, inside the navy band.
export const LOADING_LOGO_AT: readonly [number, number] = [Math.floor((W - 2 * LOGO_W) / 2), 74];
// ui-pet-shop's building on the corner lot.
export const SHOP_AT: readonly [number, number] = [W - 4 - PET_SHOP_W, YARD_FOOT - PET_SHOP_H];
// ui-pet-shop's display window and door pane in its frame, left lit on screen-loading.
export const SHOP_WINDOW = rect(9, 47, 67, 96);
export const SHOP_DOOR_PANE = rect(82, 54, 100, 68);
// The display window's and door pane's day glass, lamplit at night; the door's cream paw turns clay
// on it.
export const SHOP_GLOW: ReadonlyMap<string, string> = new Map([
  [K.sky!, "gold"],
  [K.cyan!, "yellow"],
  [K.blue!, "ochre"],
]);
// The track's end and Lady's last nose column, at the Pet shop's door pane (318 to 335).
export const TRACK_END = 332;
export const LAMP_X = 227;
export const MOON: readonly [number, number] = [40, 42];
export const PAIR_W = 98;
export const PAIR_H = 84;
export const PAIR_FEET = 81; // the pair's bottom opaque row (the shoes' and paws' outline) in its frame
export const WALK_FOOT = 460; // the screen row the pair's feet stand on
// Casey's rear heel on the contact frames and Lady's nose, opaque columns.
export const PAIR_HEEL = 10;
export const PAIR_NOSE = 97;
export const TRACK_AT: readonly [number, number] = [16, WALK_FOOT - 4];
export const TRACK_W = TRACK_END - TRACK_AT[0];
export const TRACK_H = 8;
// Where the game draws ui-loading (origin top left) at progress 0, and how far right it walks by 1:
// Casey's heel starts on the first paw print and Lady's nose ends at the Pet shop's door. Its feet
// stand on WALK_FOOT.
export const PAIR_AT: readonly [number, number] = [TRACK_AT[0] - PAIR_HEEL, WALK_FOOT - PAIR_FEET];
export const PAIR_TRAVEL = TRACK_AT[0] + TRACK_W - PAIR_NOSE - 1 - PAIR_AT[0];

// The skyline, far back: (left, width, top, wall) for each downtown tower, its foot hidden behind
// the street.
export const TOWERS: readonly bd.Tower[] = [
  [-6, 28, 286, "dslate"],
  [44, 18, 270, "navy"],
  [110, 24, 258, "dslate"],
  [172, 20, 276, "navy"],
  [200, 26, 250, "dslate"],
  [290, 24, 262, "dslate"],
  [318, 16, 284, "navy"],
  [338, 26, 272, "dslate"],
];
// The CN Tower's centre column, its foot and its mast's tip.
export const CN_X = 258;
export const CN_FOOT = 372;
export const CN_TIP = 150;
// The near row, Cabbagetown's bay-and-gables, the lit windows by their order in victorian.
export type Home = readonly [
  x: number,
  w: number,
  wall: string,
  trim: string,
  door: string,
  bayLeft: boolean,
  lit: readonly number[],
];
export const HOMES: readonly Home[] = [
  [-10, 76, "brick", "stone", "forest", false, [0, 2, 3, 5]],
  [66, 76, "dbrick", "driftwood", "ttc", true, [0, 1, 2, 4, 6]],
  [142, 76, "brick", "stone", "navy", true, [1, 3, 4, 5]],
];
export const HOME_BASE = YARD_FOOT - 10; // the houses' ground row, over the front yards

// A transparent strip drawn in daylight, turned to night: every colour steps ramp steps darker, the
// window glass lit yellow and the white mullions beside it amber.
export function afterDark(img: RgbaImage, steps = 2): RgbaImage {
  const { height: h, width: w } = img;
  const out: RgbaImage = { data: new Uint8Array(img.data), height: h, width: w };
  const cyan = K.cyan!;
  const white = K.white!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaAt(img, x, y) === 0) {
        continue;
      }
      const c = hexAt(img, x, y);
      if (c === cyan) {
        setPixel(out, x, y, rgba("yellow"));
      } else if (
        c === white &&
        (
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ] as const
        ).some(
          ([dx, dy]) =>
            x + dx >= 0 &&
            x + dx < w &&
            y + dy >= 0 &&
            y + dy < h &&
            hexAt(img, x + dx, y + dy) === cyan,
        )
      ) {
        setPixel(out, x, y, rgba("amber"));
      } else {
        let d = c;
        for (let i = 0; i < steps; i++) {
          d = dk(d);
        }
        setPixel(out, x, y, rgba(d));
      }
    }
  }
  return out;
}

// n single specks in lgrey and slate between rows top and bottom.
export function stars(cv: Canvas, r: () => number, top: number, bottom: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = Math.trunc(r() * W);
    const y = top + Math.trunc(r() * (bottom - top));
    cv.fill(x, y, 1, 1, r() < 0.7 ? "lgrey" : "slate");
  }
}

// A downtown tower in silhouette from row top down to the street, a 3-row crown stepped in 3 columns
// a side, and its lit floors: 2x1 gold windows on a 4-column, 5-row grid, about one in five lit.
export function towerBlock(
  cv: Canvas,
  x: number,
  w: number,
  top: number,
  wall: string,
  seed: number,
): void {
  cv.fill(x, top, w, YARD_FOOT - top, wall);
  cv.fill(x + 3, top - 3, w - 6, 3, wall);
  const r = rand(seed);
  for (let wy = top + 4; wy < SKY_FOOT; wy += 5) {
    for (let wx = x + 3; wx < x + w - 4; wx += 4) {
      if (r() < 0.22) {
        cv.fill(wx, wy, 2, 1, "gold");
      }
    }
  }
}

// The CN Tower lit for the night: a tapering haze shaft in its floodlight, shaded on the right, the
// main pod at 62% of its height with a ring of gold windows, the SkyPod above it, then the mast, a
// red beacon at its tip.
export function cnTower(cv: Canvas, cx: number, foot: number, tip: number, lit = true): void {
  const h = foot - tip;
  const pod = foot - Math.round(h * 0.62);
  const skyPod = foot - Math.round(h * 0.81);
  const mast = foot - Math.round(h * 0.84);
  for (let y = pod; y < foot; y++) {
    const half = 2 + Math.floor(((y - pod) * 7) / (foot - pod));
    cv.fill(cx - half, y, 2 * half + 1, 1, "haze");
    cv.fill(cx + 1, y, half, 1, "lgrey");
    cv.fill(cx - half, y, 1, 1, "white");
  }
  for (let y = mast; y < pod; y++) {
    cv.fill(cx - 1, y, 3, 1, "haze");
    cv.fill(cx + 1, y, 1, 1, "lgrey");
  }
  // the main pod: a flared skirt, the window ring, the observation deck's cap
  cv.fill(cx - 5, pod + 6, 11, 2, "lgrey");
  cv.fill(cx - 8, pod + 4, 17, 2, "lgrey");
  cv.fill(cx - 10, pod + 2, 21, 2, "haze");
  cv.fill(cx - 11, pod - 2, 23, 4, "dlake");
  for (let wx = cx - 10; wx < cx + 11; wx += 2) {
    cv.fill(wx, pod - 1, 1, 2, lit ? "gold" : "foam");
  }
  cv.fill(cx - 10, pod - 4, 21, 2, "haze");
  cv.fill(cx - 7, pod - 6, 15, 2, "lgrey");
  cv.fill(cx - 4, pod - 8, 9, 2, "lgrey");
  // the SkyPod
  cv.fill(cx - 3, skyPod - 1, 7, 3, "lgrey");
  cv.fill(cx - 2, skyPod, 5, 1, lit ? "gold" : "foam");
  // the mast, a beacon at its tip and one partway up
  cv.fill(cx, tip, 1, mast - tip, "lgrey");
  cv.fill(cx - 1, tip, 3, 1, "ttc");
  cv.fill(cx, tip - 1, 1, 1, "ttc");
  cv.fill(cx - 1, Math.floor((tip + mast) / 2), 3, 1, "ttc");
}

// A sash window in a trim frame on a sill: lit gold glass behind amber curtains drawn back to its
// sides, or dark shale glass. arch rounds its head.
export function litWindow(
  cv: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  trim: string,
  lit: boolean,
  arch = false,
): void {
  cv.fill(x - 1, y - 1, w + 2, h + 2, trim);
  cv.fill(x, y, w, h, lit ? "gold" : "shale");
  if (lit) {
    cv.fill(x, y, 1, h, "amber");
    cv.fill(x + w - 1, y, 1, h, "amber");
  }
  cv.fill(x, y + Math.floor(h / 2), w, 1, trim);
  cv.fill(x - 2, y + h + 1, w + 4, 1, trim);
  if (arch) {
    cv.fill(x - 1, y - 1, 1, 1, dk(trim));
    cv.fill(x + w, y - 1, 1, 1, dk(trim));
    cv.fill(x, y - 2, w, 1, trim);
  }
}

// The centre column of a HOMES house's front door, on the half its bay leaves.
export function doorColumn(homeRow: Home): number {
  const [x, w, , , , bayLeft] = homeRow;
  const bw = Math.floor(w / 2) - 2;
  return (bayLeft ? x + w - 3 - bw : x + 3) + Math.floor(bw / 2);
}

// A Cabbagetown bay-and-gable on HOME_BASE, w wide: a steep front gable over the full width, its
// brick face edged with a coal roof and a bargeboard in trim, a king post under the peak and an
// arched attic window; below, a two-storey bay on one half (three windows a storey, the outer two on
// its shaded sides) and the front door with its transom on the other, a window over it, and a stone
// stoop. lit lists which windows glow: 0 the attic, 1 to 3 the bay's lower storey, 4 to 6 its upper
// one, then the window over the door as 7.
export function victorian(
  cv: Canvas,
  x: number,
  w: number,
  wall: string,
  trim: string,
  door: string,
  bayLeft: boolean,
  lit: readonly number[],
): void {
  const base = HOME_BASE;
  const gableH = 40;
  const wallH = 86;
  const top = base - wallH - gableH;
  const cx = x + Math.floor(w / 2);
  const half = Math.floor(w / 2) + 2;
  for (let i = 0; i < gableH; i++) {
    const inset = Math.round((i * half) / gableH);
    cv.fill(cx - inset, top + i, 2 * inset, 1, wall);
    cv.fill(cx - inset - 1, top + i, 1, 1, "coal");
    cv.fill(cx + inset, top + i, 1, 1, "coal");
    if (inset > 2) {
      cv.fill(cx - inset, top + i, 2, 1, trim);
      cv.fill(cx + inset - 2, top + i, 2, 1, trim);
    }
  }
  cv.fill(x - 3, top + gableH - 1, w + 6, 2, "coal");
  cv.fill(cx - 1, top - 3, 1, 4, trim);
  cv.fill(cx - 1, top + 2, 1, 7, trim);
  cv.fill(cx - 5, top + 9, 9, 1, trim);
  litWindow(cv, cx - 4, top + 16, 7, 14, trim, lit.includes(0), true);
  const wy = top + gableH + 1;
  cv.fill(x, wy, w, base - wy, wall);
  cv.fill(x + w - 3, wy, 3, base - wy, dk(wall));
  // the bay
  const bw = Math.floor(w / 2) - 2;
  const bx = bayLeft ? x + 3 : x + w - 3 - bw;
  cv.fill(bx - 1, wy + 6, bw + 2, 2, "coal");
  cv.fill(bx, wy + 8, bw, base - wy - 8, wall);
  cv.fill(bx, wy + 8, 6, base - wy - 8, dk(wall));
  cv.fill(bx + bw - 6, wy + 8, 6, base - wy - 8, dk(wall));
  cv.fill(bx - 1, wy + 44, bw + 2, 2, trim);
  for (const [storey, sy] of [
    [4, wy + 14],
    [1, wy + 52],
  ] as const) {
    litWindow(cv, bx + 2, sy, 3, 22, trim, lit.includes(storey));
    litWindow(cv, bx + 9, sy, bw - 18, 22, trim, lit.includes(storey + 1));
    litWindow(cv, bx + bw - 5, sy, 3, 22, trim, lit.includes(storey + 2));
  }
  // the door half
  const dc = doorColumn([x, w, wall, trim, door, bayLeft, lit]);
  litWindow(cv, dc - 5, wy + 14, 10, 22, trim, lit.includes(7));
  cv.fill(dc - 7, base - 34, 14, 34, trim);
  cv.fill(dc - 5, base - 32, 10, 5, "gold");
  cv.fill(dc - 5, base - 26, 10, 26, door);
  cv.fill(dc - 5, base - 26, 1, 26, dk(door));
  cv.fill(dc + 2, base - 13, 1, 2, "gold");
  for (let k = 0; k < 3; k++) {
    cv.fill(dc - 7 - k, base + 3 * k, 14 + 2 * k, 3, "stone");
    cv.fill(dc - 7 - k, base + 3 * k + 2, 14 + 2 * k, 1, "dstone");
  }
}

// A coal wrought-iron fence on row foot - 1, 9 rows tall: a bar every 3 columns, every other one
// topped with a spear, between two rails, left open over gaps ([left, right) column pairs).
export function ironFence(
  cv: Canvas,
  x0: number,
  x1: number,
  foot: number,
  gaps: readonly (readonly [number, number])[] = [],
): void {
  for (let i = 0, x = x0; x < x1; i++, x += 3) {
    if (gaps.some(([a, b]) => a <= x && x < b)) {
      continue;
    }
    cv.fill(x, foot - 9, 1, 9, "coal");
    if (i % 2 === 0) {
      cv.fill(x, foot - 10, 1, 1, "coal");
    }
  }
  const edges = [...new Set([x0, x1, ...gaps.flat()])].sort((a, b) => a - b);
  for (let k = 0; k + 1 < edges.length; k += 2) {
    const a = edges[k]!;
    const b = edges[k + 1]!;
    cv.fill(a, foot - 8, b - a, 1, "coal");
    cv.fill(a, foot - 2, b - a, 1, "coal");
  }
}

// A Toronto heritage street lamp: a coal post from row top down to foot, a fluted base, and an acorn
// lantern lit yellow with a gold rim, a cap and a finial.
export function heritageLamp(cv: Canvas, x: number, foot: number, top: number): void {
  cv.fill(x - 1, top, 3, foot - top, "coal");
  cv.fill(x - 1, top, 1, foot - top, "ash");
  cv.fill(x - 3, foot - 10, 7, 10, "coal");
  cv.fill(x - 3, foot - 10, 1, 10, "ash");
  cv.fill(x - 4, foot - 1, 9, 2, "coal");
  cv.fill(x - 3, top - 2, 7, 2, "coal");
  cv.fill(x - 4, top - 12, 9, 10, "yellow");
  cv.fill(x - 4, top - 12, 1, 10, "gold");
  cv.fill(x + 4, top - 12, 1, 10, "gold");
  cv.fill(x - 2, top - 10, 2, 4, "cream");
  cv.fill(x - 3, top - 14, 7, 2, "coal");
  cv.fill(x - 1, top - 16, 3, 2, "coal");
  cv.fill(x, top - 18, 1, 2, "coal");
}

// A TTC streetcar stop: a coal pole on row foot - 1 carrying the red and white stop sign, a white
// streetcar on its red face.
export function ttcStop(cv: Canvas, x: number, foot: number): void {
  cv.fill(x, foot - 58, 2, 58, "coal");
  cv.fill(x - 6, foot - 72, 14, 16, "white");
  cv.fill(x - 5, foot - 71, 12, 14, "ttc");
  cv.fill(x - 3, foot - 68, 8, 5, "white");
  cv.fill(x - 2, foot - 67, 2, 2, "ttc");
  cv.fill(x + 1, foot - 67, 2, 2, "ttc");
  cv.fill(x - 3, foot - 62, 1, 1, "white");
  cv.fill(x + 4, foot - 62, 1, 1, "white");
  cv.fill(x, foot - 70, 2, 2, "white");
}

export function loading(): Canvas {
  const cv = new Canvas(W, H);
  const r = rand(13);
  // the night sky in bands, navy down to a mauve glow over the city, stars and a crescent moon in the
  // navy band
  const rows = bd.bands(cv, 0, SKY_FOOT, NIGHT_SKY);
  cv.fill(0, SKY_FOOT, W, YARD_FOOT - SKY_FOOT, "coal");
  stars(cv, r, 0, rows[0]![1] - 6, 36);
  for (const [x, y] of [
    [334, 34],
    [338, 120],
    [22, 150],
    [180, 28],
  ] as const) {
    cv.fill(x - 1, y, 3, 1, "lgrey");
    cv.fill(x, y - 1, 1, 3, "lgrey");
    cv.fill(x, y, 1, 1, "white");
  }
  for (let dy = -10; dy < 11; dy++) {
    for (let dx = -10; dx < 11; dx++) {
      if (dx * dx + dy * dy <= 100 && (dx + 5) ** 2 + (dy - 3) ** 2 > 64) {
        cv.fill(MOON[0] + dx, MOON[1] + dy, 1, 1, "cream");
      }
    }
  }
  // the skyline far back: downtown's towers in silhouette, their lit floors, and the CN Tower lit
  TOWERS.forEach(([x, w, top, wall], k) => {
    towerBlock(cv, x, w, top, wall, 31 + k);
  });
  cnTower(cv, CN_X, CN_FOOT, CN_TIP);
  // the near row: Cabbagetown's bay-and-gables behind their iron fences, a board fence across the
  // lane and the lamp in front of it, and ui-pet-shop's building on the corner lot, its board, window
  // and door pane lit
  const last = HOMES.at(-1)!;
  const endX = last[0] + last[1];
  const lane = [endX, SHOP_AT[0] + 3] as const;
  cv.fill(lane[0], YARD_FOOT - 22, lane[1] - lane[0], 22, "bark");
  for (let x = lane[0] + 3; x < lane[1]; x += 4) {
    cv.fill(x, YARD_FOOT - 22, 1, 22, "walnut");
  }
  cv.fill(lane[0], YARD_FOOT - 23, lane[1] - lane[0], 1, "walnut");
  cv.fill(0, HOME_BASE, endX, YARD_FOOT - HOME_BASE, "pine");
  for (const [x, w, wall, trim, door, bayLeft, lit] of HOMES) {
    victorian(cv, x, w, wall, trim, door, bayLeft, lit);
  }
  ironFence(
    cv,
    0,
    endX,
    YARD_FOOT,
    HOMES.map(doorColumn).map((c) => [c - 9, c + 9] as const),
  );
  const shop = petShopFront().img;
  const near = clear(W, H);
  const at = { x: SHOP_AT[0], y: SHOP_AT[1] };
  composite(at, shop, near.img);
  const lit = afterDark(near.img, 1);
  composite(at, crop(rect(0, 0, PET_SHOP_W, BOARD[3]), shop), lit);
  for (const [box, paw] of [
    [SHOP_WINDOW, new Map<string, string>()],
    [SHOP_DOOR_PANE, new Map([[K.cream!, "clay"]])],
  ] as const) {
    const glow = crop(box, shop);
    const colours = new Map([...SHOP_GLOW, ...paw]);
    for (let y = 0; y < glow.height; y++) {
      for (let x = 0; x < glow.width; x++) {
        const c = colours.get(hexAt(glow, x, y));
        if (c && alphaAt(glow, x, y)) {
          setPixel(glow, x, y, rgba(c));
        }
      }
    }
    composite({ x: SHOP_AT[0] + box.x, y: SHOP_AT[1] + box.y }, glow, lit);
  }
  cv.paste(lit, 0, 0);
  heritageLamp(cv, LAMP_X, YARD_FOOT + 2, YARD_FOOT - 80);
  // the sidewalk, grey, slabs every 24px, the TTC stop at its back
  cv.fill(0, YARD_FOOT, W, CURB - YARD_FOOT, "grey");
  for (let x = 0; x < W; x += 24) {
    cv.fill(x, YARD_FOOT, 1, CURB - YARD_FOOT, "slate");
  }
  cv.fill(0, YARD_FOOT, W, 2, "slate");
  ttcStop(cv, 12, YARD_FOOT + 3);
  // the curb, then the street: flat navy, plain from the curb to row 500, then the streetcar tracks,
  // two rails a track, set in the asphalt; the near curb and sidewalk along the bottom
  cv.fill(0, CURB, W, 4, "slate");
  cv.fill(0, CURB, W, 1, "grey");
  cv.fill(0, CURB + 4, W, 2, "ink");
  cv.fill(0, CURB + 6, W, 536 - CURB - 6, "navy");
  for (const y of [506, 512, 524, 530]) {
    cv.fill(0, y, W, 1, "slate");
    cv.fill(0, y + 1, W, 1, "ink");
  }
  cv.fill(0, 536, W, 4, "dslate");
  cv.fill(0, 536, W, 1, "slate");
  cv.fill(0, 540, W, 20, "dslate");
  for (let x = 12; x < W; x += 24) {
    cv.fill(x, 540, 1, 20, "navy");
  }
  const big = resizeNearest(2 * LOGO_W, 2 * LOGO_H, logo().img);
  cv.paste(big, LOADING_LOGO_AT[0], LOADING_LOGO_AT[1]);
  return cv;
}

// The sidewalk being walked: Lady's paw prints in dslate (3.39:1 on the night sidewalk's grey), left
// and right paws 8px apart, staggered on two rows, from Casey's heel to the Pet shop's door.
export function loadingTrack(): Clear {
  const cv = clear(TRACK_W, TRACK_H);
  for (let n = 0, x = 0; x < TRACK_W - 4; n++, x += 8) {
    const y = n % 2 ? 0 : 4;
    PAW.forEach((row, j) => {
      [...row].forEach((c, i) => {
        if (c === "#") {
          cv.fill(x + i, y + j, 1, 1, "dslate");
        }
      });
    });
  }
  return cv;
}

export const SCREENS: ReadonlyMap<string, () => Canvas> = new Map<string, () => Canvas>([
  ["logo", logo],
  ["screen-home", home],
  ["screen-end", end],
  ["screen-loading", loading],
  ["ui-loading-track", loadingTrack],
]);

// ui-loading is drawn on a PAIR_DESIGN design grid at PAIR_SCALE on a Mini that keeps 1px lines and
// single pixels 1px, so Casey stands 84 rows tall and Lady 56.
export const PAIR_DESIGN: readonly [number, number] = [56, 48];
export const PAIR_SCALE = 1.75;
// The pair's stride, one pose per frame: Casey's near and far feet (forward of the hip, in design px)
// and which is lifted, the body's bob, Lady's near front and hind paws, its bob and its tail's wag.
// Contact frames (0, 2) plant both feet apart; on the passing frames (1, 3) the swinging foot lifts
// 1px under the hip as the body rises 1px, as the walkers' stride has it, and Lady's diagonal pairs
// swap with its ears lagging.
export interface PairPose {
  bob: number;
  dbob: number;
  far: number;
  flop: number;
  front: number;
  hind: number;
  lift: "far" | "near" | null;
  near: number;
  wag: number;
}
export const PAIR_WALK: readonly PairPose[] = [
  { bob: 0, dbob: 0, far: -4, flop: 0, front: 2, hind: -2, lift: null, near: 4, wag: -1 },
  { bob: -1, dbob: -1, far: 0, flop: 1, front: 0, hind: 0, lift: "far", near: 0, wag: 0 },
  { bob: 0, dbob: 0, far: 4, flop: 0, front: -2, hind: 2, lift: null, near: -4, wag: 1 },
  { bob: -1, dbob: -1, far: 0, flop: 1, front: 0, hind: 0, lift: "near", near: 0, wag: 0 },
];
export const PAIR_WALK_MS = 160;
// Casey's hand and Lady's collar on the design grid, before the bob: the leash's two ends.
export const HAND: readonly [number, number] = [21, 28];
export const COLLAR: readonly [number, number] = [44, 28];

// One of Casey's legs, from the hip (x, row) to its shoe on row 43, the foot lift rows up: 3 wide, in
// 2-row steps so it stays unbroken at any scale, the shoe pointing right.
export function leg(
  g: Drawable,
  hip: readonly [number, number],
  foot: number,
  lift: number,
  trouser: string,
  shade: string,
  shoe: string,
  sole: string,
): void {
  const [hx, hy] = hip;
  const endRow = 42 - lift;
  const n = Math.max(1, endRow - hy);
  for (let k = 0; k < n + 1; k++) {
    const x = hx + ((foot - hx) * k) / n;
    g.rect(Math.round(x), hy + k, 3, 2, trouser);
    g.rect(Math.round(x) + 2, hy + k, 1, 2, shade);
  }
  g.rect(foot, 43 - lift, 5, 2, shoe);
  g.rect(foot, 45 - lift - 1, 5, 1, sole);
}

// One of Lady's legs, from the hip or shoulder to its paw on row 45: the coat colour above a white
// sock 3 rows deep.
export function dogLeg(
  g: Drawable,
  hip: readonly [number, number],
  paw: number,
  upper: string,
  sock: string,
  sockShade: string,
): void {
  const [hx, hy] = hip;
  const n = Math.max(1, 43 - hy);
  for (let k = 0; k < n + 1; k++) {
    const x = Math.round(hx + ((paw - hx) * k) / n);
    g.rect(x, hy + k, 3, 2, hy + k < 41 ? upper : sock);
  }
  g.rect(paw, 44, 3, 2, sock);
  g.p(paw + 2, 45, sockShade);
}

// One frame of ui-loading on the PAIR_DESIGN grid: Casey side on, walking right, and Lady trotting
// ahead of her, cel shaded with the road outline and the lit rim, as the road sprites.
export function pairDesign({
  bob = 0,
  dbob = 0,
  far = 0,
  flop = 0,
  front = 0,
  hind = 0,
  lift = null,
  near = 0,
  wag = 0,
}: Partial<PairPose> = {}): Grid {
  const g = edged(scope.Grid(...PAIR_DESIGN));
  const b = bob;
  const ln = lift === "near" ? 1 : 0;
  const lf = lift === "far" ? 1 : 0;
  // Casey: the far leg and arm a shade darker, behind the body
  leg(g, [10, 33 + b], 10 + far, lf, "navy", "navy", "lgrey", "grey");
  g.rect(7 - Math.floor(near / 2), 23 + b, 3, 8, "blue");
  g.rect(7 - Math.floor(near / 2), 31 + b, 3, 2, "skin2");
  // the hoodie, its hood at the back of the neck, and a white drawstring at the front
  g.cel(11.5, 27.5 + b, 6, 6.5, "sky", "blue", "cyan", 4);
  g.rect(6, 33 + b, 11, 1, "blue");
  g.cel(7.5, 21.5 + b, 3, 2.5, "blue", "navy");
  g.rect(15, 22 + b, 1, 4, "white");
  leg(g, [10, 33 + b], 10 + near, ln, "blue", "navy", "white", "lgrey");
  // head: the ponytail and hair behind a flat-skin face in profile, the ear, then the cap, its brim
  // forward
  g.rect(11, 19 + b, 3, 3, "skin2");
  g.cel(4.5, 17 + b, 2, 3.5, "dbrown", "plum");
  g.cel(12, 12.5 + b, 8, 8.5, "dbrown", "plum", "brown");
  g.ell(15.5, 14.5 + b, 5.5, 5.5, "skin1");
  g.p(21, 15 + b, "skin1");
  g.rect(10, 13 + b, 2, 3, "skin1");
  g.p(11, 14 + b, "skin2");
  g.rect(17, 13 + b, 2, 2, "ink");
  g.p(17, 13 + b, "white");
  g.p(15, 16 + b, "pink");
  g.rect(17, 18 + b, 2, 1, "dbrown");
  g.p(19, 17 + b, "dbrown");
  g.cel(12, 8 + b, 8.5, 5, "amber", "orange", "yellow");
  g.rect(14, 10 + b, 9, 2, "orange");
  g.rect(14, 11 + b, 9, 1, "rust");
  g.p(12, 3 + b, "yellow");
  // the near arm reaching forward to hold the leash
  g.rect(10, 22 + b, 4, 5, "sky");
  g.rect(10, 22 + b, 1, 5, "cyan");
  g.rect(12, 25 + b, 7, 3, "sky");
  g.rect(12, 27 + b, 7, 1, "blue");
  g.rect(HAND[0] - 2, HAND[1] - 2 + b, 3, 3, "skin1");
  g.p(HAND[0], HAND[1] + b, "skin2");
  // Lady: far legs a shade darker, the tail flagged up with its white tip, then the tan body under
  // the black saddle, white belly and chest, the near legs, and the head with a long rust ear
  const d = dbob;
  dogLeg(g, [33, 36 + d], 33 - hind, "rust", "lgrey", "grey");
  dogLeg(g, [44, 36 + d], 44 - front, "rust", "lgrey", "grey");
  for (let k = 0; k < 8; k++) {
    g.rect(Math.round(29.5 - k * 0.35 + (wag * k) / 7), 31 - k + d, 2, 2, "navy");
  }
  g.rect(Math.round(29.5 - 7 * 0.35) + wag, 22 + d, 2, 2, "white");
  g.cel(37.5, 34.5 + d, 9, 5, "ochre", "rust", "tan");
  g.cel(36.5, 31.5 + d, 6.5, 2.6, "navy", "ink", "dslate");
  g.cel(39, 38 + d, 6, 1.5, "white", "lgrey");
  g.cel(45, 34.5 + d, 2.5, 3.5, "white", "lgrey");
  dogLeg(g, [31, 36 + d], 31 + hind, "ochre", "white", "lgrey");
  dogLeg(g, [42, 36 + d], 42 + front, "ochre", "white", "lgrey");
  g.cel(48, 26 + d, 5.5, 5, "ochre", "rust", "tan");
  g.cel(52.5, 28.5 + d, 3, 2.2, "white", "lgrey");
  g.rect(50, 21 + d, 2, 4, "white");
  g.rect(54, 26 + d, 2, 2, "ink");
  g.rect(49, 24 + d, 2, 2, "ink");
  g.p(49, 24 + d, "white");
  g.p(52, 30 + d, "dbrown");
  g.cel(45.5, 28.5 + d + flop, 2.2, 4.5, "rust", "dbrown");
  g.rect(COLLAR[0] - 1, COLLAR[1] - 2 + d, 2, 6, "green");
  g.rect(COLLAR[0], COLLAR[1] - 2 + d, 1, 6, "dgreen");
  return rim(g, LIT);
}

// PAIR_W x PAIR_H, one frame of the walk: pairDesign at PAIR_SCALE, outlined, then the leash sagging
// 1px wide from Casey's hand to Lady's collar, over the outline: plum, as on Cabbagetown's grey road,
// since the night sidewalk is grey (4.84:1).
export function pair(step: number): Frame {
  const q = PAIR_WALK[step]!;
  const g = small(roadScope, scope, PAIR_SCALE, pairDesign, q);
  const px = g.outlined();
  const s = PAIR_SCALE;
  const a = [Math.floor((HAND[0] + 0.5) * s), Math.floor((HAND[1] - 1 + q.bob + 0.5) * s)] as const;
  const z = [
    Math.floor((COLLAR[0] - 0.5) * s),
    Math.floor((COLLAR[1] - 1 + q.dbob + 0.5) * s),
  ] as const;
  const sag = 3 + (q.bob !== 0 ? 1 : 0);
  for (let x = a[0] + 1; x < z[0]; x++) {
    const t = (x - a[0]) / (z[0] - a[0]);
    const y = Math.round(a[1] + (z[1] - a[1]) * t + sag * 4 * t * (1 - t));
    if (g.px[y]![x] === null) {
      px[y]![x] = K.plum!;
    }
  }
  return px;
}

// ---------- ui-slot-sign ----------

// The dog-slot sign hung from the Pet shop's awning across its front, which the game draws at 255,88:
// the frame's size, and the cream board in the frame, where the game writes its two lines.
export const SLOT_SIGN_W = 81;
export const SLOT_SIGN_H = 30;
export const SLOT_BOARD: readonly [x: number, y: number, w: number, h: number] = [1, 5, 79, 24];

// ui-slot-sign: a cream board in a 1px dbrown frame, lit white along its top and tan along its
// bottom, hung by two dbrown cords from the awning's bottom edge. pressed lets the board drop 1px on
// longer cords.
export function slotSign(pressed = false): Frame {
  const g = scope.Grid(SLOT_SIGN_W, SLOT_SIGN_H);
  const [x, y, w, h] = SLOT_BOARD;
  const d = pressed ? 1 : 0;
  for (const cx of [8, SLOT_SIGN_W - 9]) {
    g.rect(cx, 0, 1, y + d, "dbrown");
  }
  g.rect(x, y + d, w, h, "dbrown");
  g.rect(x + 1, y + d + 1, w - 2, h - 2, "cream");
  g.rect(x + 1, y + d + 1, w - 2, 1, "white");
  g.rect(x + 1, y + d + h - 2, w - 2, 1, "tan");
  return g.outlined(false);
}

export function* sprites(): Generator<Sprite> {
  const pressedTags = (draw: (pressed: boolean) => Frame): Tag[] =>
    ["normal", "pressed"].map((tag): Tag => [tag, [draw(tag === "pressed")], 1000]);
  yield ["ui-slot-sign", pressedTags(slotSign)];
  yield ["ui-loading", [["walk", PAIR_WALK.map((_, i) => pair(i)), PAIR_WALK_MS]]];
  yield [
    "ui-pet-shop",
    [
      ...pressedTags((pressed) => imageRows(petShop({ pressed }).img)),
      [
        "door-wave",
        DOOR_WAVE.map((_, i) => imageRows(petShop({ doorFrame: i }).img)),
        DOOR_WAVE_MS,
      ],
    ],
  ];
  yield ["ui-pet-shop-board", pressedTags((pressed) => imageRows(petShopBoard(pressed).img))];
}

// Block in the UI that sits on a screen, for the preview only (layout from StartScene, StatsScene on
// its badges tab, EndScene and loadingScreen.ts, which draws no text).
export function ui(cv: Canvas, screen: string): void {
  const panel = (x: number, y: number, w: number, h: number, face = "cream"): void => {
    cv.fill(x, y, w, h, "plum");
    cv.fill(x + 1, y + 1, w - 2, h - 2, face);
  };
  const figure = (x: number, foot: number, w: number, h: number, col: string): void => {
    cv.fill(x - Math.floor(w / 2), foot - h, w, h, "plum");
    cv.fill(x - Math.floor(w / 2) + 1, foot - h + 1, w - 2, h - 2, col);
  };

  if (screen === "screen-home") {
    // The gate scene at 40..196, then StartScene's walker, dog and gear rows and Start walk on the
    // deck, which has a flat dark-brown backing.
    text(cv, "$385", 26, 15, "cream", 2);
    for (const x of [216, 268]) {
      panel(x, 10, 20, 20, "tan");
    }
    for (const x of [8, 332]) {
      panel(x, 46, 20, 20, "tan");
    }
    textC(cv, "HIGH PARK", 327, 75, "white");
    panel(130, 46, 100, 34, "white");
    cv.paste(petShopFront().img, PET_SHOP_AT[0], PET_SHOP_AT[1]);
    panel(194, 166, 18, 18);
    figure(180, 196, 16, 40, "sky");
    for (const [x, foot] of [
      [180, 150],
      [154, 182],
      [206, 184],
    ] as const) {
      figure(x, foot, 20, 16, "ochre");
    }
    panel(4, 210, 132, 24, "tan");
    for (let i = 0; i < 4; i++) {
      panel(156 + i * 52, 200, 44, 44);
    }
    panel(4, 248, 132, 24, "tan");
    text(cv, "2/3 DOGS", 308, 255, "cream");
    for (let i = 0; i < 9; i++) {
      panel(4 + (i % 3) * 120, 276 + Math.floor(i / 3) * 52, 112, 44);
    }
    panel(4, 428, 132, 24, "tan");
    for (let i = 0; i < 5; i++) {
      panel(4 + i * 72, 456, 64, 44);
    }
    textC(cv, "PACK FEE $40 PER ZONE", 180, 502, "cream");
    cv.fill(4, 518, 352, 40, "orange");
    cv.fill(4, 514, 352, 40, "amber");
  } else if (screen === "screen-end") {
    cv.paste(logo().img, END_LOGO_AT[0], END_LOGO_AT[1]);
    for (const [x, foot] of [
      [116, 110],
      [144, 110],
      [216, 110],
    ] as const) {
      figure(x, foot, 16, 40, "skin1");
    }
    figure(180, 110, 16, 40, "sky");
    for (const [x, foot] of [
      [166, 106],
      [194, 105],
      [152, 108],
    ] as const) {
      figure(x, foot, 20, 16, "ochre");
    }
    panel(24, 112, 312, 300);
    panel(8, 416, 344, 92);
    cv.fill(48, 516, 264, 40, "orange");
    cv.fill(48, 512, 264, 40, "amber");
  } else if (screen === "screen-loading") {
    cv.paste(loadingTrack().img, TRACK_AT[0], TRACK_AT[1]);
    cv.paste(toImage(pair(0)), PAIR_AT[0] + Math.round(PAIR_TRAVEL * 0.4), PAIR_AT[1]);
  }
}

export function preview(out: string, scale = 2): void {
  const keys = [...SCREENS.keys()].filter((k) => k.startsWith("screen-"));
  const shots = [...keys.map((k) => [k, false] as const), ...keys.map((k) => [k, true] as const)];
  const gap = 8;
  const top = LOGO_H * 3 + gap;
  const sheet = filledImage(rgba("ink"), (W + gap) * shots.length * scale, (top + H) * scale);
  let x = 0;
  for (const ground of ["green", "dbrown", "amber", "navy"]) {
    const bg = filledImage(rgba(ground), LOGO_W, LOGO_H);
    composite({ x: 0, y: 0 }, logo().img, bg);
    paste(
      { at: { x: x * scale, y: 0 } },
      resizeNearest(LOGO_W * 3 * scale, LOGO_H * 3 * scale, bg),
      sheet,
    );
    x += LOGO_W * 3 + gap;
  }
  // the ui-loading frames, on the night sidewalk
  for (let i = 0; i < 4; i++) {
    const bg = filledImage(rgba("grey"), PAIR_W, PAIR_H);
    composite({ x: 0, y: 0 }, toImage(pair(i)), bg);
    paste({ at: { x: x * scale, y: 0 } }, resizeNearest(PAIR_W * scale, PAIR_H * scale, bg), sheet);
    x += PAIR_W + gap;
  }
  shots.forEach(([screen, blocked], i) => {
    const cv = SCREENS.get(screen)!();
    if (blocked) {
      ui(cv, screen);
    }
    paste(
      { at: { x: i * (W + gap) * scale, y: top * scale } },
      resizeNearest(W * scale, H * scale, opaque(cv.img)),
      sheet,
    );
  });
  writeFileSync(out, rgbPng(sheet));
}

// ui-pet-shop's tags on the yard at 1x and scale, then screen-home with the building in, at 1x and
// scale. Also writes the lot around the building at scale beside out, as <out>-lot.png.
export function shopPreview(out: string, scale = 4): void {
  const tags = [false, true].map((pressed) => petShopFront({ pressed }).img);
  const homeCv = home();
  homeCv.paste(tags[0]!, PET_SHOP_AT[0], PET_SHOP_AT[1]);
  const lot = crop(
    rect(
      PET_SHOP_AT[0] - 4,
      PET_SHOP_AT[1] - 4,
      PET_SHOP_AT[0] + PET_SHOP_W + 4,
      PET_SHOP_AT[1] + PET_SHOP_H + 4,
    ),
    homeCv.img,
  );
  const tiles = tags.map((t) => {
    const bg = new Canvas(PET_SHOP_W, PET_SHOP_H);
    bg.img = crop(
      rect(
        PET_SHOP_AT[0],
        PET_SHOP_AT[1],
        PET_SHOP_AT[0] + PET_SHOP_W,
        PET_SHOP_AT[1] + PET_SHOP_H,
      ),
      home().img,
    );
    bg.paste(t, 0, 0);
    return bg.img;
  });
  const gap = 8;
  const top = PET_SHOP_H * (scale + 1) + gap;
  const sheet = filledImage(
    rgba("ink"),
    Math.max(W * (scale + 1) + gap, (PET_SHOP_W * (scale + 1) + gap) * 2),
    top + H * scale,
  );
  let x = 0;
  for (const t of tiles) {
    paste({ at: { x, y: 0 } }, t, sheet);
    paste(
      { at: { x: x + PET_SHOP_W + gap / 2, y: 0 } },
      resizeNearest(PET_SHOP_W * scale, PET_SHOP_H * scale, t),
      sheet,
    );
    x += PET_SHOP_W * (scale + 1) + gap;
  }
  paste({ at: { x: 0, y: top } }, opaque(homeCv.img), sheet);
  paste(
    { at: { x: W + gap, y: top } },
    resizeNearest(W * scale, H * scale, opaque(homeCv.img)),
    sheet,
  );
  writeFileSync(out, rgbPng(sheet));
  writeFileSync(
    out.replaceAll(".png", "-lot.png"),
    rgbPng(resizeNearest(lot.width * scale, lot.height * scale, lot)),
  );
}

export async function build(only?: string): Promise<void> {
  const screens = only === undefined ? SCREENS : new Map([[only, SCREENS.get(only)!]]);
  mkdirSync("public/art/images", { recursive: true });
  for (const [k, draw] of screens) {
    const png = `public/art/images/${k}.png`;
    const cv = draw();
    writeFileSync(png, cv instanceof Clear ? savePng(cv.img) : rgbPng(cv.img));
  }
  if (only === undefined) {
    await buildSprites({}, sprites());
  }
  console.log("built", [...screens.keys()].join(", "));
}

if (import.meta.main) {
  await run({
    commands: {
      build: () => build(),
      "build SCREEN": (screen) => {
        if (!SCREENS.has(screen)) {
          console.error(`unknown screen ${screen}`);
          throw new UsageError();
        }
        return build(screen);
      },
      "preview OUT.png": (out) => preview(out),
      "shop-preview OUT.png": (out) => shopPreview(out),
    },
    doc: usage(),
  });
}
