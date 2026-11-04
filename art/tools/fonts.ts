// Rasterize the game's pixel fonts into BMFonts (XML .fnt plus a PNG atlas).
//
// - font-body: Tiny5 at 8px made a row taller, for body text, quips and floating labels.
// - font-title: Silkscreen at 8px, for titles, numbers and buttons.
// - font-display and font-display-cream: the yard sign's lettering, for big display words only
//   (zone names, "WHICH WAY?", "FIRED!", "NEW BEST!", the end screen title, hit labels). Upright blocky
//   capitals 5 rows tall drawn at 2x (10px caps), each in a 1px ink outline on a solid dred shadow 2px
//   down and right. The colours are baked in: yellow letters in font-display, cream in
//   font-display-cream, a red heart in both. Draw them untinted.
// - font-comic: the comic words' lettering from fx.ts, for the word over a hit burst. Draw it untinted.
//
// font-body and font-title are SIL Open Font License fonts; the font files and licences are in
// art/fonts/. Their glyphs are white on transparent so the game tints them. Printable ASCII, the
// middle dot (U+00B7) and a drawn heart for ♥ (U+2665), which neither font has. Skia rasterizes them
// unhinted without antialiasing, so every pixel is fully on or off.
//
// font-body keeps Tiny5's 10-row line and its capitals' top on row 2, a row taller than Tiny5 so
// small text reads: capitals and digits 6 rows (rows 2 to 7, Tiny5's with one row drawn twice,
// REPEAT), a drawn lower case (LOWER) on a 5-row x-height (rows 3 to 7) with round letters 4 wide,
// ascenders a row above the capitals (row 1) and descenders one row (row 8), base 8. Marks that span
// the capitals get a row more; marks on the baseline or the x-height's middle move a row down
// (LOWERED). Its $ and % are drawn (DRAWN), as Tiny5's are too thin to read at 1x.
//
// font-display has A to Z, 0 to 9, ! ? , . ' - + $, space and ♥. Its line is 18px: the capitals'
// outline on rows 2 to 13 and their fill on rows 3 to 12 (base 13), with room above for the $ and
// below for the comma's tail and the shadow. Letters sit 2px apart, which their outlines fill;
// pairs whose shapes leave room (LT, P., T., Y.) kern 2px closer. Lower case is not in the font: set it
// in capitals.
//
// font-comic is the comic words' lettering from fx.ts, for the word drawn over a hit burst: flat yellow
// capitals 7 rows tall with 2px stems in a 1px ink ring that fills the gaps between letters, on a solid
// dred shadow 2px down and right, colours baked in (draw untinted). A to Z, ! ? - and space. Its line is
// 11px: the ring on rows 0 to 8, the fill on rows 1 to 7 (base 8), the shadow to row 10. Letters sit 1px
// apart, which their rings fill, with no kerning. A word is its letters' widths, plus 1 between each pair,
// plus 4.
//
// In-art signs (shop boards, the High Park gate, the Distillery and TTC signs) use the same letters and
// outline at 1x, with a 1px shadow, through sign().
//
// Run from the repository root.
import { mkdirSync, writeFileSync } from "node:fs";

import { rgb } from "@andornaut/art-kit/colour";
import { buildBitmapFont } from "@andornaut/art-kit/fonts";
import { buildBitmapFontFromGlyphs, type GlyphKerning } from "@andornaut/art-kit/glyphAtlas";
import {
  channel,
  crop,
  fill,
  filledImage,
  resizeNearest,
  type Rgba,
} from "@andornaut/art-kit/raster";
import { blankImage, opaqueRect, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { LETTERS, word, wordSize } from "./fx.ts";
import { Grid, HEART, K, rgbPng, run, savePng, toImage } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/fonts.ts preview OUT.png   a sample of every font but font-comic, scaled up
  node art/tools/fonts.ts build             write public/art/fonts/*.png and *.fnt`;

// A glyph: its image (white on clear for a tinted font, baked colours otherwise; none for a space),
// the offsets of its top-left from the pen and the line's top, and the pen's advance.
export interface Glyph {
  image: RgbaImage | undefined;
  xadvance: number;
  xoffset: number;
  yoffset: number;
}

export type Glyphs = ReadonlyMap<string, Glyph>;

// The TrueType fonts by key: face, file and pixel size.
export const FONTS: ReadonlyMap<string, readonly [face: string, path: string, size: number]> =
  new Map([
    ["font-body", ["Tiny5", "art/fonts/tiny5/Tiny5.ttf", 8]],
    ["font-title", ["Silkscreen", "art/fonts/silkscreen/Silkscreen-Regular.ttf", 8]],
  ]);
export const CHARS: readonly string[] = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  "·",
  "♥",
];
const TINY5 = "art/fonts/tiny5/Tiny5.ttf";
const SILKSCREEN = "art/fonts/silkscreen/Silkscreen-Regular.ttf";
// Glyphs drawn in place of a font's own, by font file: rows, then the top row's offset and the advance.
const DRAWN: ReadonlyMap<
  string,
  ReadonlyMap<string, readonly [readonly string[], number, number]>
> = new Map([
  [
    TINY5,
    new Map<string, readonly [readonly string[], number, number]>([
      // Tiny5's $ is a 3px S that reads as a stray mark at 1x: a 4px S with 2px diagonals, its stem a
      // row above and below it.
      ["$", [["..1.", ".111", "11..", "11..", "..11", "111.", ".1.."], 1, 5]],
      // Tiny5's 9 closes its bowl on row 3, so it differs from the 3 only in its top two rows: a 6 turned
      // round, the bowl two rows deep.
      ["9", [[".1.", "1.1", "1.1", ".11", "..1", "11."], 2, 4]],
      // Tiny5's % is 4 rows of single pixels that read as an x: the capitals' height, 2px dots either side
      // of an unbroken slash.
      ["%", [["11..1", "11.1.", "..1..", "..1..", ".1.11", "1..11"], 2, 6]],
      // The lower case: x-height rows 3 to 7, ascenders from row 1, descenders on row 8.
      ["a", [[".11.", "...1", ".111", "1..1", ".111"], 3, 5]],
      ["b", [["1...", "1...", "111.", "1..1", "1..1", "1..1", "111."], 1, 5]],
      ["c", [[".111", "1...", "1...", "1...", ".111"], 3, 5]],
      ["d", [["...1", "...1", ".111", "1..1", "1..1", "1..1", ".111"], 1, 5]],
      ["e", [[".11.", "1..1", "1111", "1...", ".111"], 3, 5]],
      ["f", [[".11", "1..", "111", "1..", "1..", "1..", "1.."], 1, 4]],
      ["g", [[".111", "1..1", "1..1", ".111", "...1", "111."], 3, 5]],
      ["h", [["1...", "1...", "111.", "1..1", "1..1", "1..1", "1..1"], 1, 5]],
      ["i", [["1", ".", "1", "1", "1", "1", "1"], 1, 2]],
      ["j", [[".1", "..", ".1", ".1", ".1", ".1", ".1", "1."], 1, 3]],
      ["k", [["1...", "1...", "1..1", "1.1.", "11..", "1.1.", "1..1"], 1, 5]],
      ["l", [["1.", "1.", "1.", "1.", "1.", "1.", ".1"], 1, 3]],
      ["m", [["1111.", "1.1.1", "1.1.1", "1.1.1", "1.1.1"], 3, 6]],
      ["n", [["111.", "1..1", "1..1", "1..1", "1..1"], 3, 5]],
      ["o", [[".11.", "1..1", "1..1", "1..1", ".11."], 3, 5]],
      ["p", [["111.", "1..1", "1..1", "1..1", "111.", "1..."], 3, 5]],
      ["q", [[".111", "1..1", "1..1", "1..1", ".111", "...1"], 3, 5]],
      ["r", [["1.11", "11..", "1...", "1...", "1..."], 3, 5]],
      ["s", [[".111", "1...", ".11.", "...1", "111."], 3, 5]],
      ["t", [["1..", "111", "1..", "1..", "1..", ".11"], 2, 4]],
      ["u", [["1..1", "1..1", "1..1", "1..1", ".111"], 3, 5]],
      ["v", [["1...1", "1...1", ".1.1.", ".1.1.", "..1.."], 3, 6]],
      ["w", [["1...1", "1...1", "1.1.1", "1.1.1", ".1.1."], 3, 6]],
      ["x", [["1...1", ".1.1.", "..1..", ".1.1.", "1...1"], 3, 6]],
      ["y", [["1..1", "1..1", "1..1", ".111", "...1", "111."], 3, 5]],
      ["z", [["1111", "...1", "..1.", ".1..", "1111"], 3, 5]],
    ]),
  ],
]);
// Tiny5's capitals, digits and the marks that span them, a row taller: the row named here is drawn
// twice (a crossbar's lower half, a bowl's side, a diagonal's top).
const REPEAT: ReadonlyMap<string, ReadonlyMap<string, number>> = new Map([
  [
    TINY5,
    new Map(
      (
        [
          ["ABEFHIJKLMNPRSTUY1356789", 3],
          ["CDGOQ04", 2],
          ["VWX", 0],
          ["Z2", 1],
          ["!?()[]{}/\\|#&@<>", 2],
        ] as const
      ).flatMap(([chars, row]) => [...chars].map((ch): [string, number] => [ch, row])),
    ),
  ],
]);
// Marks on the baseline or the x-height's middle, a row lower with them.
const LOWERED: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [TINY5, new Set(".,;:-+=*~_·♥")],
]);
// Marks a row higher than Skia sets them: Silkscreen's period and comma start level with the colon's
// lower dot, a row above the capitals' bottom, so a comma's tail stays inside the capitals' rows.
const RAISED: ReadonlyMap<string, ReadonlySet<string>> = new Map([[SILKSCREEN, new Set(".,")]]);
// How many rows lower than the face's ascent the baseline is.
const BASE_DROP: ReadonlyMap<string, number> = new Map([[TINY5, 1]]);
// Kerning pairs by font file. Silkscreen's $ inks its right column on two rows only, so a digit
// after it reads a column further off than the next letter: it moves 1px closer.
const KERNS: ReadonlyMap<string, readonly (readonly [string, string, number])[]> = new Map([
  [SILKSCREEN, [..."0123456789"].map((d) => ["$", d, -1] as const)],
]);
const ATLAS_W = 128;

// ---------- the sign lettering ----------

// The yard sign's letters, 5 rows from the top of the capitals, one cell a row. A glyph with more rows
// starts RISE[ch] rows above the capitals ($) or runs below them (the comma's tail).
export const SIGN: ReadonlyMap<string, readonly string[]> = new Map([
  ["A", [".###.", "#...#", "#####", "#...#", "#...#"]],
  ["B", ["####.", "#...#", "####.", "#...#", "####."]],
  ["C", [".####", "#....", "#....", "#....", ".####"]],
  ["D", ["####.", "#...#", "#...#", "#...#", "####."]],
  ["E", ["#####", "#....", "####.", "#....", "#####"]],
  ["F", ["#####", "#....", "####.", "#....", "#...."]],
  ["G", [".####", "#....", "#..##", "#...#", ".####"]],
  ["H", ["#...#", "#...#", "#####", "#...#", "#...#"]],
  ["I", ["###", ".#.", ".#.", ".#.", "###"]],
  ["J", ["....#", "....#", "....#", "#...#", ".###."]],
  ["K", ["#..#", "#.#.", "##..", "#.#.", "#..#"]],
  ["L", ["#....", "#....", "#....", "#....", "#####"]],
  ["M", ["#....#", "##..##", "#.##.#", "#....#", "#....#"]],
  ["N", ["#...#", "##..#", "#.#.#", "#..##", "#...#"]],
  ["O", [".###.", "#...#", "#...#", "#...#", ".###."]],
  ["P", ["####.", "#...#", "####.", "#....", "#...."]],
  ["Q", [".###.", "#...#", "#...#", "#..#.", ".##.#"]],
  ["R", ["####.", "#...#", "####.", "#..#.", "#...#"]],
  ["S", [".####", "#....", ".###.", "....#", "####."]],
  ["T", ["#####", "..#..", "..#..", "..#..", "..#.."]],
  ["U", ["#...#", "#...#", "#...#", "#...#", ".###."]],
  ["V", ["#...#", "#...#", "#...#", ".#.#.", "..#.."]],
  ["W", ["#....#", "#....#", "#.##.#", "#.##.#", ".#..#."]],
  ["X", ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"]],
  ["Y", ["#...#", ".#.#.", "..#..", "..#..", "..#.."]],
  ["Z", ["#####", "...#.", "..#..", ".#...", "#####"]],
  ["0", [".##.", "#..#", "#..#", "#..#", ".##."]],
  ["1", [".#.", "##.", ".#.", ".#.", "###"]],
  ["2", ["###.", "...#", ".##.", "#...", "####"]],
  ["3", ["###.", "...#", ".##.", "...#", "###."]],
  ["4", ["#..#", "#..#", "####", "...#", "...#"]],
  ["5", ["####", "#...", "###.", "...#", "###."]],
  ["6", [".##.", "#...", "###.", "#..#", ".##."]],
  ["7", ["####", "...#", "..#.", ".#..", ".#.."]],
  ["8", [".##.", "#..#", ".##.", "#..#", ".##."]],
  ["9", [".##.", "#..#", ".###", "...#", ".##."]],
  ["!", ["#", "#", "#", ".", "#"]],
  ["?", ["###.", "...#", ".##.", "....", ".#.."]],
  [".", [".", ".", ".", ".", "#"]],
  [",", ["..", "..", "..", "..", ".#", "#."]],
  ["'", ["#", "#"]],
  ["-", ["...", "...", "###"]],
  ["+", ["...", ".#.", "###", ".#."]],
  ["$", ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."]],
  ["♥", [".#.#.", "#####", "#####", ".###.", "..#.."]],
]);
const RISE: ReadonlyMap<string, number> = new Map([["$", 1]]);
// The heart keeps its own colour in every colourway.
const FILL: ReadonlyMap<string, string> = new Map([["♥", "red"]]);
// The space's advance at 2x, as the yard sign spaces its words; half that, rounded up, at 1x.
const SPACE = 3.5;
const DISPLAY: ReadonlyMap<string, string> = new Map([
  ["font-display", "yellow"],
  ["font-display-cream", "cream"],
]);
export const DISPLAY_SCALE = 2;
// The capitals' fill starts this far below the line's top at 2x, leaving room for the $ and its outline.
export const CAP_TOP = 3;
export const LINE_HEIGHT = 18;

// A sign pixel's colour name, keyed by "x,y".
export type SignPixels = Map<string, string>;

const at = (x: number, y: number): string => `${x},${y}`;

function xy(key: string): [number, number] {
  const [x = 0, y = 0] = key.split(",").map(Number);
  return [x, y];
}

function signRows(ch: string): readonly string[] {
  const rows = SIGN.get(ch);
  if (!rows) {
    throw new RangeError(`No sign letter for ${ch}`);
  }
  return rows;
}

// The glyph's filled cells as [column, row], rows from the top of the capitals.
export function cells(ch: string): [number, number][] {
  const rise = RISE.get(ch) ?? 0;
  return signRows(ch).flatMap((row, j) =>
    [...row].flatMap((c, i): [number, number][] => (c === "#" ? [[i, j - rise]] : [])),
  );
}

// Whether b can sit a cell closer after a: their fills stay two cells apart, so each letter keeps
// its own outline.
export function kerned(a: string, b: string): boolean {
  if (!SIGN.has(a) || !SIGN.has(b)) {
    return false;
  }
  const adv = signRows(a)[0]!.length;
  const second = cells(b).map(([x, y]) => [x + adv, y] as const);
  return cells(a).every(([x, y]) =>
    second.every(([u, v]) => Math.max(Math.abs(x - u), Math.abs(y - v)) >= 2),
  );
}

// text in the sign letters at scale: [{"x,y": colour}, the advance]. x runs from the pen, where the
// first letter's outline starts, and y from the top of the capitals' outline; a raised glyph ($)
// reaches above 0. Letters are drawn first, then their 1px ink outline (8-neighbour) and a solid dred
// shadow: the outline moved 1 to scale px down and right, under the outline and the letters.
export function sign(
  text: string,
  scale = 1,
  fillColour = "yellow",
  { kern = true }: { kern?: boolean } = {},
): [SignPixels, number] {
  const letters: SignPixels = new Map();
  let x = 1;
  let prev: string | undefined;
  for (const ch of text) {
    if (ch === " ") {
      x += Math.floor(SPACE * scale + 0.5);
      prev = undefined;
      continue;
    }
    if (kern && prev !== undefined && kerned(prev, ch)) {
      x -= scale;
    }
    const col = FILL.get(ch) ?? fillColour;
    for (const [cx, cy] of cells(ch)) {
      for (let dx = 0; dx < scale; dx++) {
        for (let dy = 0; dy < scale; dy++) {
          letters.set(at(x + cx * scale + dx, 1 + cy * scale + dy), col);
        }
      }
    }
    x += scale * (signRows(ch)[0]!.length + 1);
    prev = ch;
  }
  const ring = new Set<string>();
  for (const key of letters.keys()) {
    const [px, py] = xy(key);
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        ring.add(at(px + dx, py + dy));
      }
    }
  }
  const shadow = new Set<string>();
  for (const key of ring) {
    const [px, py] = xy(key);
    for (let d = 1; d <= scale; d++) {
      const k = at(px + d, py + d);
      if (!ring.has(k)) {
        shadow.add(k);
      }
    }
  }
  // a counter too small to show the shadow (the middle of O at 1x) stays ink
  const counters = [...shadow].filter((key) => {
    const [px, py] = xy(key);
    return [at(px - 1, py), at(px + 1, py), at(px, py - 1), at(px, py + 1)].every((q) =>
      ring.has(q),
    );
  });
  counters.forEach((key) => ring.add(key));
  const out: SignPixels = new Map();
  for (const key of shadow) {
    if (!ring.has(key)) {
      out.set(key, "dred");
    }
  }
  ring.forEach((key) => out.set(key, "ink"));
  letters.forEach((col, key) => out.set(key, col));
  return [out, x - 1];
}

// The width of text's letters and outline, without the shadow.
export function signWidth(text: string, scale = 1): number {
  const [px] = sign(text, scale);
  const xs = [...px].filter(([, c]) => c !== "dred").map(([key]) => xy(key)[0]);
  return Math.max(...xs) + 1 - Math.min(...xs);
}

function opaqueRgba(col: string): Rgba {
  const [r, g, b] = rgb(K[col]!);
  return [r, g, b, 255];
}

// font-display's glyphs in fillColour.
export function displayGlyphs(fillColour: string): Map<string, Glyph> {
  const out = new Map<string, Glyph>([
    [
      " ",
      {
        image: undefined,
        xadvance: Math.floor(SPACE * DISPLAY_SCALE + 0.5),
        xoffset: 0,
        yoffset: 0,
      },
    ],
  ]);
  for (const ch of SIGN.keys()) {
    const [px, adv] = sign(ch, DISPLAY_SCALE, fillColour, { kern: false });
    const points = [...px.keys()].map(xy);
    const x0 = Math.min(...points.map(([x]) => x));
    const y0 = Math.min(...points.map(([, y]) => y));
    const w = Math.max(...points.map(([x]) => x)) + 1 - x0;
    const h = Math.max(...points.map(([, y]) => y)) + 1 - y0;
    const image = blankImage(w, h);
    for (const [key, c] of px) {
      const [x, y] = xy(key);
      image.data.set(opaqueRgba(c), ((y - y0) * w + x - x0) * 4);
    }
    // the sign's y 0 is the capitals' outline, one row above their fill
    out.set(ch, { image, xadvance: adv, xoffset: x0, yoffset: y0 + CAP_TOP - 1 });
  }
  return out;
}

// ---------- the comic lettering ----------

// font-comic: fx.ts's comic words as a font, for the words the game draws over a burst. Each glyph is
// one letter as fx.word draws it alone: its ring from the image's column 0, the letter from column 1,
// the dred shadow to the right and below. The advance is the letter's width plus 1, so the next glyph's
// ring lands on the 1px gap and the two rings merge. Glyphs drawn left to right, each over the last,
// give fx.word's pixels exactly: a glyph's shadow that reaches the next letter falls under that
// letter's ring and fill.
const COMIC = "font-comic";
const COMIC_LINE = 11;
// The letters' fill runs from row 1 to row 7.
const COMIC_BASE = 8;
const COMIC_SPACE = 4;

// font-comic's glyphs.
export function comicGlyphs(): Map<string, Glyph> {
  const out = new Map<string, Glyph>([
    [" ", { image: undefined, xadvance: COMIC_SPACE, xoffset: 0, yoffset: 0 }],
  ]);
  for (const [ch, rows] of Object.entries(LETTERS)) {
    const [w, h] = wordSize(ch);
    out.set(ch, {
      image: toImage(word(new Grid(w, h), ch, w / 2, 0).px),
      xadvance: rows[0]!.length + 1,
      xoffset: 0,
      yoffset: 0,
    });
  }
  return out;
}

function displayKernings(): [string, string, number][] {
  const signs = [...SIGN.keys()];
  return signs.flatMap((a) =>
    signs.filter((b) => kerned(a, b)).map((b): [string, string, number] => [a, b, -DISPLAY_SCALE]),
  );
}

// ---------- the TrueType fonts ----------

// A white glyph image from rows of "1" (ink) and anything else (clear).
function maskImage(rows: readonly string[]): RgbaImage {
  const width = rows[0]!.length;
  const image = blankImage(width, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "1") {
        image.data.set([255, 255, 255, 255], (y * width + x) * 4);
      }
    }),
  );
  return image;
}

// image one row taller, its row drawn twice.
export function repeatRow(row: number, image: RgbaImage): RgbaImage {
  const stride = image.width * 4;
  const out = blankImage(image.width, image.height + 1);
  out.data.set(image.data.subarray(0, (row + 1) * stride), 0);
  out.data.set(image.data.subarray(row * stride), (row + 1) * stride);
  return out;
}

// The font's glyphs as Skia draws them in mono, each trimmed to its ink, with its offsets from the pen
// and the line's top (the ascent's top), and the font's ascent and descent: a line is ascent + descent
// rows. A glyph with no ink has no image.
function rasterized(
  path: string,
  size: number,
  characters: readonly string[],
): { ascent: number; descent: number; glyphs: Map<string, Glyph> } {
  const font = buildBitmapFont({
    antialias: false,
    atlasWidth: ATLAS_W,
    characters,
    hinting: false,
    key: "raster",
    path,
    size,
  });
  const { base, glyphs: placed, lineHeight } = font.metadata;
  const { height, width } = font.image;
  const pixels = font.image.getContext("2d").getImageData(0, 0, width, height).data;
  const atlas: RgbaImage = { data: new Uint8Array(pixels), height, width };
  for (let i = 3; i < atlas.data.length; i += 4) {
    if (atlas.data[i] !== 0 && atlas.data[i] !== 255) {
      throw new RangeError(`${path} rasterized partial coverage at ${size}px`);
    }
  }
  const glyphs = new Map<string, Glyph>();
  for (const ch of characters) {
    const g = placed.get(ch)!;
    const ink =
      g.width && g.height
        ? opaqueRect({ height: g.height, width: g.width, x: g.x, y: g.y }, atlas)
        : undefined;
    glyphs.set(
      ch,
      ink
        ? {
            image: crop(ink, atlas),
            xadvance: g.xadvance,
            xoffset: g.xoffset + ink.x - g.x,
            yoffset: g.yoffset + ink.y - g.y,
          }
        : { image: undefined, xadvance: g.xadvance, xoffset: 0, yoffset: 0 },
    );
  }
  return { ascent: base, descent: lineHeight - base, glyphs };
}

// The TrueType font at path and size as the game's glyphs, with the overrides drawn in place of its own,
// and its ascent and descent.
export function glyphs(
  path: string,
  size: number,
): { ascent: number; descent: number; glyphs: Map<string, Glyph> } {
  const drawn = DRAWN.get(path) ?? new Map<string, readonly [readonly string[], number, number]>();
  const repeat = REPEAT.get(path) ?? new Map<string, number>();
  const lowered = LOWERED.get(path) ?? new Set<string>();
  const raised = RAISED.get(path) ?? new Set<string>();
  const font = rasterized(
    path,
    size,
    CHARS.filter((ch) => ch !== "♥" && !drawn.has(ch)),
  );
  const { ascent } = font;
  const out = new Map<string, Glyph>();
  for (const ch of CHARS) {
    const override = drawn.get(ch);
    if (override) {
      const [rows, top, adv] = override;
      out.set(ch, { image: maskImage(rows), xadvance: adv, xoffset: 0, yoffset: top });
      continue;
    }
    if (ch === "♥") {
      out.set(ch, {
        image: maskImage(HEART),
        xadvance: 8,
        xoffset: 0,
        yoffset: ascent - 6 + Number(lowered.has(ch)),
      });
      continue;
    }
    const g = font.glyphs.get(ch)!;
    if (!g.image) {
      out.set(ch, g);
      continue;
    }
    const row = repeat.get(ch);
    out.set(ch, {
      ...g,
      image: row === undefined ? g.image : repeatRow(row, g.image),
      yoffset: g.yoffset + Number(lowered.has(ch)) - Number(raised.has(ch)),
    });
  }
  return { ascent, descent: font.descent, glyphs: out };
}

// font-title's glyphs, for text baked into UI art.
export function titleGlyphs(): Map<string, Glyph> {
  const [, path, size] = FONTS.get("font-title")!;
  return glyphs(path, size).glyphs;
}

// The pen's advance over text.
export function textWidth(gl: Glyphs, text: string): number {
  return [...text].reduce((sum, ch) => sum + glyph(gl, ch).xadvance, 0);
}

function glyph(gl: Glyphs, ch: string): Glyph {
  const g = gl.get(ch);
  if (!g) {
    throw new RangeError(`No glyph for ${ch}`);
  }
  return g;
}

// text's glyphs filled with rgba into image through their ink, from pen column x, each glyph's yoffset
// below row y; returns the pen's column after the text.
export function drawText(
  { glyphs: gl, rgba }: { glyphs: Glyphs; rgba: Rgba },
  text: string,
  x: number,
  y: number,
  image: RgbaImage,
): number {
  let pen = x;
  for (const ch of text) {
    const g = glyph(gl, ch);
    if (g.image) {
      fill(
        {
          mask: channel(3, g.image),
          rect: {
            height: g.image.height,
            width: g.image.width,
            x: pen + g.xoffset,
            y: y + g.yoffset,
          },
        },
        rgba,
        image,
      );
    }
    pen += g.xadvance;
  }
  return pen;
}

// ---------- writing ----------

function writeFont(
  {
    base,
    face,
    kerns = [],
    lineHeight,
    size,
  }: {
    base: number;
    face: string;
    kerns?: readonly (readonly [string, string, number])[];
    lineHeight: number;
    size: number;
  },
  key: string,
  gl: Glyphs,
): void {
  const code = (ch: string): number => ch.codePointAt(0)!;
  const kernings: GlyphKerning[] = kerns.map(([a, b, amount]) => ({
    amount,
    first: code(a),
    second: code(b),
  }));
  const font = buildBitmapFontFromGlyphs(
    { atlasWidth: ATLAS_W, base, face, kernings, key, lineHeight, padding: 1, size },
    gl,
  );
  mkdirSync("public/art/fonts", { recursive: true });
  writeFileSync(`public/art/fonts/${key}.png`, savePng(font.image));
  writeFileSync(`public/art/fonts/${key}.fnt`, font.xml);
}

export function build(): void {
  for (const [key, [face, path, size]] of FONTS) {
    const { ascent, descent, glyphs: gl } = glyphs(path, size);
    writeFont(
      {
        base: ascent + (BASE_DROP.get(path) ?? 0),
        face,
        kerns: KERNS.get(path) ?? [],
        lineHeight: ascent + descent + 1,
        size,
      },
      key,
      gl,
    );
  }
  for (const [key, fillColour] of DISPLAY) {
    writeFont(
      {
        base: CAP_TOP + 5 * DISPLAY_SCALE,
        face: "Sign",
        kerns: displayKernings(),
        lineHeight: LINE_HEIGHT,
        size: 5 * DISPLAY_SCALE,
      },
      key,
      displayGlyphs(fillColour),
    );
  }
  writeFont(
    { base: COMIC_BASE, face: "Comic", lineHeight: COMIC_LINE, size: 7 },
    COMIC,
    comicGlyphs(),
  );
  console.log("built", [...FONTS.keys(), ...DISPLAY.keys(), COMIC].join(", "));
}

export function preview(out: string, scale = 3): void {
  const samples = [
    "ARCHIE'S DOG WALKS  $42  ZONE 1: HIGH PARK",
    "Eve: No rush, dear. ♥",
    "-2 ♥, dramatic   +$1.50 tip, solo",
    "0123456789 !?.,:'+-/$%&()",
  ];
  const display = ["OOPS, PETUNIAS!", "WHICH WAY? $1.50 ♥"];
  const sheet = filledImage(
    [115, 62, 57, 255],
    300,
    26 + 14 * samples.length * FONTS.size + 20 * display.length * DISPLAY.size,
  );
  let y = 4;
  for (const [, path, size] of FONTS.values()) {
    const gl = glyphs(path, size).glyphs;
    for (const s of samples) {
      const text = [...s].map((ch) => (gl.has(ch) ? ch : "?")).join("");
      drawText({ glyphs: gl, rgba: [234, 212, 170, 255] }, text, 4, y, sheet);
      y += 12;
    }
    y += 6;
  }
  for (const fillColour of DISPLAY.values()) {
    for (const s of display) {
      const [px] = sign(s, DISPLAY_SCALE, fillColour);
      for (const [key, c] of px) {
        const [x, yy] = xy(key);
        fill(
          { rect: { height: 1, width: 1, x: 4 + x, y: y + CAP_TOP - 1 + yy } },
          opaqueRgba(c),
          sheet,
        );
      }
      y += LINE_HEIGHT + 2;
    }
  }
  writeFileSync(out, rgbPng(resizeNearest(sheet.width * scale, sheet.height * scale, sheet)));
}

if (import.meta.main) {
  await run({
    commands: { build: () => build(), "preview OUT.png": (out) => preview(out) },
    doc: USAGE,
  });
}
