import { composite } from "@andornaut/art-kit/build/raster";
import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";

import { sign } from "../fonts.ts";
import { type Drawable, edged, type Frame, Grid, LAYOUT, toImage } from "../pixel.ts";
import { Canvas } from "../scene.ts";
import { STATES } from "../ui.ts";
import { alphaAt, Clear, clear, hexAt, key, PAW, scope, xy } from "./drawing.ts";

export const PET_SHOP_W = 120;

export const PET_SHOP_H = 108;

// Where the game draws ui-pet-shop on the start screen, from the layout export's home Pet shop.
const PET_SHOP = LAYOUT.scenes.home.petShop;

export const PET_SHOP_AT: readonly [number, number] = [PET_SHOP.x, PET_SHOP.y];

// The PET SHOP board's place in ui-pet-shop: a go-state face 114x22, its bottom 2 rows over
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

const BOARD_RISE = 4;

const BOARD_DROP = 2;

// Projected door-leaf width, keeper reveal and hand pose. All coordinates stay inside the closed
// door.
type DoorStep = readonly [width: number, reveal: number | null, wave: number | null];

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

// ---------- ui-pet-shop ----------

const BONE: readonly string[] = [
  "..cc.......cc..",
  ".cccc.....cccc.",
  "ccccccccccccccc",
  "ccccccccccccccc",
  ".cccc.....cccc.",
  "..cc.......cc..",
];

// 17x21: a tan puppy sitting up in the shop window, front view, floppy brown ears, a white muzzle
// and chest, a pink tongue out; cel shaded in an ink line, as the faces are.
function windowPuppy(): Drawable {
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

interface PetShopOptions {
  // A DOOR_WAVE frame index for door-wave, or null for the static closed door.
  doorFrame?: number | null;
  pressed?: boolean;
}

// ui-pet-shop's frame, PET_SHOP_W x PET_SHOP_H: the building from BOARD_RISE down, without its
// board. Everything but the step is drawn t rows lower, so pressed sinks the front 2px onto a step
// 1px shallower, as a pressed button's face sinks into its lip.
export function petShop({ doorFrame = null, pressed = false }: PetShopOptions = {}): Clear {
  const cv = clear(PET_SHOP_W, PET_SHOP_H);
  building(cv, PET_SHOP_W, PET_SHOP_H - BOARD_RISE, pressed, doorFrame);
  return cv;
}

type BoardState = "normal" | "pressed" | "focused";

// ui-pet-shop-board's frame, BOARD's width x its height plus BOARD_DROP.
export function petShopBoard(state: BoardState = "normal"): Clear {
  const cv = clear(BOARD[2], BOARD[3] + BOARD_DROP);
  shopBoard(cv, state);
  return cv;
}

// The shop with its board, as the yard shows them: pressed, only the board presses and the
// building stays up.
export function petShopFront({ doorFrame = null, pressed = false }: PetShopOptions = {}): Clear {
  const cv = petShop({ doorFrame });
  composite({ x: BOARD[0], y: BOARD[1] }, petShopBoard(pressed ? "pressed" : "normal").img, cv.img);
  return cv;
}

// The PET SHOP board from its frame's top left: the go state (STATES.go), a green face with a yellow
// top highlight on a forest lip 4px deep, in an ink line with clipped upper corners and a square
// lower edge. PET SHOP uses the sign letters' shapes at 2x, filled ink (8.41:1 on green) without an
// outline or shadow. Raised, row 0 is ink, row 1 the highlight, the face runs to row 16, the lip fills rows 17
// to 20 and ink row 21; the caps fill rows 4 to 13. Pressed fills the face forest with white
// letters (7.80:1), the pressed treatment of Start walk and every standard button; the lip and
// highlight give way to face, and face and letters sink BOARD_DROP, a dip that only adds to the
// fill. Focused keeps the raised
// chrome and replaces the green face with cyan (ink letters 11.98:1). No state adds an outline.
const BOARD_FACES: Readonly<Record<BoardState, readonly [face: string, letters: string]>> = {
  focused: ["cyan", "ink"],
  normal: [STATES.go![0], "ink"],
  pressed: ["forest", "white"],
};

function shopBoard(cv: Canvas, state: BoardState): void {
  const [, , bw, bh] = BOARD;
  const pressed = state === "pressed";
  const t = pressed ? BOARD_DROP : 0;
  const [, lip, hi] = STATES.go!;
  const [face, ink] = BOARD_FACES[state];
  cv.fill(1, t, bw - 2, bh - 1, "ink");
  cv.fill(0, 1 + t, bw, bh - 1, "ink");
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
    cv.fill(lx + x - x0, 4 + t + y - y0, 1, 1, ink);
  }
}

// The shop below the board, w x h from BOARD_RISE down: walls, parapet, awning, window, door and
// step.
function building(
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
function shopKeeper(reveal: number, wave: number | null): RgbaImage {
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
function shopDoor(cv: Canvas, h: number, pressed: boolean, doorFrame: number | null): void {
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
