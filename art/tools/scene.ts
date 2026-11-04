// Shared tools for the pictures composed from exported art (card illustrations, screens, backdrops,
// the share card): an RGB canvas on the palette, the 3x5 pixel font, the game's data and layout from
// its export in shared/export/, the zones and their road-<zone> strips (roads.ts), the pack's hands
// and collars, and the exported sprites and images in public/art/. Run from the repository root. It
// has no commands.
//
// Images are art-kit RgbaImages. A paste is masked by the pasted image's alpha, which must be 0 or
// 255 at every pixel.
import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/png";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { Grid, HEART, K, toImage } from "./pixel.ts";
import { chrome } from "./ui.ts";

export type Rgb = readonly [number, number, number];

// Every house colour by name as RGB.
export const HEX: ReadonlyMap<string, Rgb> = new Map(
  Object.entries(K).map(([k, v]) => [k, parseHex(v)]),
);

function parseHex(c: string): Rgb {
  return [0, 2, 4].map((i) => Number.parseInt(c.slice(i, i + 2), 16)) as unknown as Rgb;
}

// A house colour name's or a hexadecimal colour's RGB.
export function rgb(c: string): Rgb {
  return HEX.get(c) ?? parseHex(c);
}

// ---------- images ----------

// A copy of image, alpha set opaque everywhere.
export function opaque(image: RgbaImage): RgbaImage {
  const data = new Uint8Array(image.data);
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255;
  }
  return { data, height: image.height, width: image.width };
}

// The pixels of image inside [x0, x1) x [y0, y1), clear past its edges.
export function crop(image: RgbaImage, x0: number, y0: number, x1: number, y1: number): RgbaImage {
  const out = blankImage(x1 - x0, y1 - y0);
  for (let y = Math.max(y0, 0); y < Math.min(y1, image.height); y++) {
    for (let x = Math.max(x0, 0); x < Math.min(x1, image.width); x++) {
      const from = (y * image.width + x) * 4;
      out.data.set(image.data.subarray(from, from + 4), ((y - y0) * out.width + x - x0) * 4);
    }
  }
  return out;
}

// image flipped left to right.
export function flipped(image: RgbaImage): RgbaImage {
  const out = blankImage(image.width, image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4;
      out.data.set(
        image.data.subarray(from, from + 4),
        (y * image.width + image.width - 1 - x) * 4,
      );
    }
  }
  return out;
}

// Lay sprite on target with its top-left at (x, y), clipped to target, masked by its alpha: every
// opaque pixel replaces the one under it and every clear one leaves it.
export function pasteMasked(target: RgbaImage, sprite: RgbaImage, x: number, y: number): void {
  for (let sy = 0; sy < sprite.height; sy++) {
    const ty = y + sy;
    if (ty < 0 || ty >= target.height) {
      continue;
    }
    for (let sx = 0; sx < sprite.width; sx++) {
      const tx = x + sx;
      const from = (sy * sprite.width + sx) * 4;
      const alpha = sprite.data[from + 3]!;
      if (alpha !== 0 && alpha !== 255) {
        throw new RangeError("A masked paste needs an alpha of 0 or 255 at every pixel");
      }
      if (alpha && tx >= 0 && tx < target.width) {
        target.data.set(sprite.data.subarray(from, from + 4), (ty * target.width + tx) * 4);
      }
    }
  }
}

function readPng(path: string): RgbaImage {
  return decodePng(readFileSync(path));
}

// An RGB canvas filled with ink.
export class Canvas {
  img: RgbaImage;

  constructor(w: number, h: number) {
    this.img = blankImage(w, h);
    const ink = [...rgb("ink"), 255];
    for (let i = 0; i < this.img.data.length; i += 4) {
      this.img.data.set(ink, i);
    }
  }

  fill(x: number, y: number, w: number, h: number, c: string): void {
    const x0 = Math.max(0, Math.trunc(x));
    const y0 = Math.max(0, Math.trunc(y));
    const x1 = Math.min(this.img.width, Math.trunc(x + w));
    const y1 = Math.min(this.img.height, Math.trunc(y + h));
    if (x1 > x0 && y1 > y0) {
      const colour = [...rgb(c), 255];
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          this.img.data.set(colour, (yy * this.img.width + xx) * 4);
        }
      }
    }
  }

  paste(sprite: RgbaImage, x: number, y: number, flip = false): void {
    pasteMasked(this.img, flip ? flipped(sprite) : sprite, Math.round(x), Math.round(y));
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i < Math.trunc(n) + 1; i++) {
      this.fill(
        Math.round(x0 + ((x1 - x0) * i) / n),
        Math.round(y0 + ((y1 - y0) * i) / n),
        1,
        1,
        c,
      );
    }
  }
}

// ---------- pixel font (3x5) ----------

// Each glyph's 3x5 bits, row by row.
export const G: ReadonlyMap<string, string> = new Map([
  ["A", "010101111101101"],
  ["B", "110101110101110"],
  ["C", "011100100100011"],
  ["D", "110101101101110"],
  ["E", "111100110100111"],
  ["F", "111100110100100"],
  ["G", "011100101101011"],
  ["H", "101101111101101"],
  ["I", "111010010010111"],
  ["J", "001001001101010"],
  ["K", "101101110101101"],
  ["L", "100100100100111"],
  ["M", "101111111101101"],
  ["N", "110101101101101"],
  ["O", "010101101101010"],
  ["P", "110101110100100"],
  ["Q", "010101101110011"],
  ["R", "110101110101101"],
  ["S", "011100010001110"],
  ["T", "111010010010010"],
  ["U", "101101101101111"],
  ["V", "101101101101010"],
  ["W", "101101111111101"],
  ["X", "101101010101101"],
  ["Y", "101101010010010"],
  ["Z", "111001010100111"],
  ["0", "111101101101111"],
  ["1", "010110010010111"],
  ["2", "110001010100111"],
  ["3", "110001010001110"],
  ["4", "101101111001001"],
  ["5", "111100110001110"],
  ["6", "011100111101111"],
  ["7", "111001010010010"],
  ["8", "111101111101111"],
  ["9", "111101111001110"],
  ["$", "011110111011110"],
  ["+", "000010111010000"],
  ["-", "000000111000000"],
  ["/", "001001010100100"],
  [":", "000010000010000"],
  [".", "000000000000010"],
  ["!", "010010010000010"],
  ["?", "110001010000010"],
  ["'", "010010000000000"],
  [",", "000000000010100"],
  ["%", "101001010100101"],
  ["×", "000101010101000"],
]);

// The width of s in the 3x5 font at scale sc: 3 columns a glyph, 1 between.
export function textW(s: string, sc = 1): number {
  return Math.max(0, 4 * sc * [...s].length - sc);
}

// s in the 3x5 font with its top-left at (x, y), each glyph in col or its colour in acc.
export function text(
  cv: Canvas,
  s: string,
  x: number,
  y: number,
  col: string,
  sc = 1,
  acc: Readonly<Record<string, string>> = {},
): void {
  let cx = x;
  for (const ch of s) {
    const bits = G.get(ch);
    if (bits) {
      for (let r = 0; r < 5; r++) {
        for (let k = 0; k < 3; k++) {
          if (bits[r * 3 + k] === "1") {
            cv.fill(cx + k * sc, y + r * sc, sc, sc, Object.hasOwn(acc, ch) ? acc[ch]! : col);
          }
        }
      }
    }
    cx += 4 * sc;
  }
}

// s in the 3x5 font centred on column mid.
export function textC(
  cv: Canvas,
  s: string,
  mid: number,
  y: number,
  col: string,
  sc = 1,
  acc: Readonly<Record<string, string>> = {},
): void {
  text(cv, s, Math.round(mid - textW(s, sc) / 2), y, col, sc, acc);
}

// ---------- game data and layout, from the game's export in shared/export/ ----------

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

interface GameData {
  zones: { art: string; id: string; leashColour: string; name: string; roadShadowColour: string }[];
}
interface Layout {
  pack: {
    collarHeights: Record<string, number>;
    laneHalfWidth: number;
    walkerHands: { heightAboveFeet: number; leftDx: number; rightDx: number };
  };
}
export interface Zone {
  art: string;
  leash: string;
  name: string;
  shadow: string;
}

export const GAME = readJson<GameData>("shared/export/game-data.json");
export const LAYOUT = readJson<Layout>("shared/export/layout.json");
// {zone id: zone} in the world's order: each zone's name, art key, road shadow and leash colours.
export const ZONES: ReadonlyMap<string, Zone> = new Map(
  GAME.zones.map((z) => [
    z.id,
    {
      art: z.art,
      leash: z.leashColour.replace(/^#+/, ""),
      name: z.name,
      shadow: z.roadShadowColour.replace(/^#+/, ""),
    },
  ]),
);
// Each zone's road strip: the exported road-<zone> image (roads.ts), opaque.
export const TILES: ReadonlyMap<string, RgbaImage> = new Map(
  [...ZONES].map(([z, zone]) => [z, opaque(readPng(`public/art/images/road-${zone.art}.png`))]),
);
// The pack, as src/layout/packFormation.ts: the walker's hands (left dx, right dx, height above the
// feet) and each dog's collar height above its feet (COLLAR, the highest, for a dog with none listed).
export const PACK = LAYOUT.pack;
export const HANDS: readonly [number, number, number] = [
  PACK.walkerHands.leftDx,
  PACK.walkerHands.rightDx,
  PACK.walkerHands.heightAboveFeet,
];
export const COLLARS: Readonly<Record<string, number>> = PACK.collarHeights;
export const COLLAR = Math.max(...Object.values(COLLARS));
// Each sprite's anchor (feetY, opaqueWidth) from the manifest, empty for one the game does not stand
// on the ground.
export const ANCHORS: ReadonlyMap<string, { feetY?: number; opaqueWidth?: number }> = new Map(
  readJson<{ sprites: { anchor?: { feetY: number; opaqueWidth: number }; key: string }[] }>(
    "public/art/manifest.json",
  ).sprites.map((s) => [s.key, s.anchor ?? {}]),
);

// A dog's collar height above its feet, at full size.
export function collar(key: string): number {
  const name = key.startsWith("dog-") ? key.slice(4) : key;
  return Object.hasOwn(COLLARS, name) ? COLLARS[name]! : COLLAR;
}

// A dog's dx off the lane centre on side -1, 0 or 1: half the lane less half its opaque width.
export function sideDx(key: string, side: number): number {
  return side * Math.floor(PACK.laneHalfWidth - ANCHORS.get(key)!.opaqueWidth! / 2);
}

// ---------- exported sprites ----------

interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}
interface FrameTag {
  from: number;
  name: string;
  to: number;
}
export type Sheet = readonly [image: RgbaImage, frames: Rect[], tags: Map<string, FrameTag>];

const SHEETS = new Map<string, Sheet>();

// An exported sprite: its sheet, each frame's rectangle and {tag name: tag}.
export function sheet(key: string): Sheet {
  let out = SHEETS.get(key);
  if (!out) {
    const meta = readJson<{
      frames: Record<string, { frame: Rect }>;
      meta: { frameTags: FrameTag[] };
    }>(`public/art/sprites/${key}.json`);
    out = [
      readPng(`public/art/sprites/${key}.png`),
      Object.values(meta.frames).map((fr) => fr.frame),
      new Map(meta.meta.frameTags.map((t) => [t.name, t])),
    ];
    SHEETS.set(key, out);
  }
  return out;
}

// Frame i of an exported sprite's tag, wrapping round the tag.
export function frame(key: string, tag: string, i = 0): RgbaImage {
  const [img, frames, tags] = sheet(key);
  const t = tags.get(tag)!;
  const n = t.to - t.from + 1;
  const f = frames[t.from + (((i % n) + n) % n)]!;
  return crop(img, f.x, f.y, f.x + f.w, f.y + f.h);
}

// An exported image.
export function image(key: string): RgbaImage {
  return readPng(`public/art/images/${key}.png`);
}

// A canvas with sprites standing on their shadows, leashes in the zone's colour, callouts and hearts.
export class Scene extends Canvas {
  leashCol = "dred";
  shade = "navy";

  shadow(cx: number, foot: number, w: number): void {
    const rx = Math.max(3, w / 2 - 2);
    for (let y = -3; y < 4; y++) {
      for (let x = Math.trunc(-rx - 1); x < Math.trunc(rx + 2); x++) {
        const dx = (x + 0.5) / rx;
        const dy = (y + 0.5) / 2.5;
        if (dx * dx + dy * dy <= 1) {
          this.fill(Math.trunc(cx + x), Math.trunc(foot - 1 + y), 1, 1, this.shade);
        }
      }
    }
  }

  feet(
    key: string,
    tag: string,
    cx: number,
    foot: number,
    { flip = false, i = 0, shadow = true }: { flip?: boolean; i?: number; shadow?: boolean } = {},
  ): void {
    const s = frame(key, tag, i);
    if (shadow) {
      this.shadow(cx, foot, s.width);
    }
    this.paste(s, cx - s.width / 2, foot - s.height, flip);
  }

  // A callout in ui.ts's chrome, w wide, one 8px row per line: plum text on cream (9.42:1), $ in
  // forest (5.39:1).
  bubble(x: number, y: number, w: number, lines: readonly string[], col = "plum"): void {
    const h = lines.length * 8 + 7;
    this.paste(toImage(chrome(new Grid(w, h), 0, 0, w, h).px), x, y);
    lines.forEach((ln, i) => {
      textC(this, ln, x + w / 2, y + 4 + i * 8, col, 1, { $: "forest" });
    });
  }

  heart(x: number, y: number, col: string, hi?: string): void {
    HEART.forEach((r, j) => {
      [...r].forEach((c, i) => {
        if (c === "1") {
          this.fill(x + i, y + j, 1, 1, col);
        }
      });
    });
    if (hi) {
      this.fill(x + 1, y + 1, 1, 1, hi);
    }
  }
}
