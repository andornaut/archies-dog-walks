// Draw the UI kit: icons, nine-slice panels and buttons, the hint bubble and badges.
//
// Images (16x16 icons unless noted): icon-pause, icon-play, icon-home, icon-help, icon-close,
// icon-logbook, icon-settings, icon-exit, icon-share (Safari's Share button, on the iOS install steps
// card), icon-browser-menu (the browser menu button's three dots, on the Firefox for Android install
// steps card), icon-update (a green down arrow into a tray, on the home screen's update notice),
// icon-lock, icon-bill (a green dollar bill with a white $, on an item for sale the bank covers),
// icon-treat (the treat pickup, its bone and heart as road.ts's treat lays them out at 16x16, for the
// message strip), icon-stinky; icon-dog-slot (32x32, a pack slot for sale in the shop: a doghouse with
// a green plus badge, as the shop's item-<gear> art, outlined with iconEdge); ui-panel (24x24
// nine-slice, 4px corners), ui-hint (24x24 nine-slice, 8px corners), ui-hint-tail (8x6), ui-new-best
// (72x20 ribbon, text baked in with font-title); the start screen's ui-detail-card (24x24 nine-slice,
// 8px corners) and ui-detail-well (68x68); the shop list's ui-scroll-track (8x24) and ui-scroll-thumb
// (6x24, three-slices with 3px caps); the walker section's ui-cork (32x32 solid pickerWalkerBody
// tile), the dogs section's ui-plaid (16x16 solid pickerDogsBody tile), the Pocket section's ui-denim
// (16x16 solid pickerPocketBody tile), all repeated with TileSprite; the card rows' ui-strip-well
// (24x24 nine-slice, the band behind a card row's subtitle), ui-quip (24x24 nine-slice, 8px corners),
// ui-quip-tail (6x8), ui-quip-tail-down and ui-quip-tail-up (8x6), ui-celebrate-burst (148x132, the
// starburst behind the walker in the zone celebration), ui-zone-banner (248x48); the start screen top
// bar's bank well, drawn at (5, 5) in three pieces that stretch it to the bank's width,
// ui-home-cash-well-left, ui-home-cash-well-mid
// (repeated across) and ui-home-cash-well-right (1x29 each); the walk HUD's ui-walk-bar (360x40),
// ui-effect-well (22x22), ui-zone-pill (13x13 three-slice, 4px ends), ui-dog-card-band (360x76, drawn
// at (0, 480)), ui-lead-tag (27x11, LEAD baked in with font-title) and ui-owner-tab (36x36).
//
// Sprites: ui-dog-card (120x70, one of three cards in the walk's card row; a tag per dog key and
// `empty`, then heart-loss: 4 frames, 60, 60, 80 and 80ms, an overlay drawn over the card and under
// the game's faces, hearts and text), ui-dog-card-warn (120x70, the low-hearts rim drawn over
// ui-dog-card; tags pulse, static), ui-debuff-bar (360x16, one active debuff's bar under the walk
// bar; tags muddy, stinky, zoomies, spotlight), ui-select (24x24 nine-slice, 8px corners; tag pulse),
// ui-shop-focus (32x32 nine-slice, 13px corners; tag pulse, two 180ms phases), ui-afford (24x24
// nine-slice, 8px corners; tag glint), ui-check (16x16; tags 1, 2, 3, tick), ui-section (24x32
// nine-slice, 3px sides and bottom, 24px top; tags complete, neutral, neutral-walker, neutral-dogs,
// neutral-pocket), fx-tap and fx-dust (16x16; tag play), ui-heart (8x7; tags full, empty, and
// full-dark and empty-dark for the navy ui-dog-card), ui-button (24x24 nine-slice, 3px corners and a
// 5px bottom; tags normal, pressed, disabled, secondary, secondary-pressed, go, go-pressed,
// go-disabled), ui-icon-button (20x20, the face under a 16x16 icon such as pause, help or sound; tags
// normal, pressed), ui-switch (32x16; tags on, off), ui-slider (24x10 three-slice, 4px caps; tags
// filled, empty, filled-disabled, empty-disabled), ui-slider-knob (10x16; tags normal, pressed,
// disabled), icon-sound (tags on, off), icon-sound-panel, icon-music-panel, icon-effects-panel,
// icon-motion-panel and icon-install-panel (tags on, off), ui-zone-pips (18x8; tags todo, and <zone>
// and <zone>-done for each zone in pixel.ts's ZONE_ROAD_COLOURS), ui-tile (24x24 nine-slice, 4px on
// every side; normal frame 0, selected-static 1, disabled 2, selected 3 to 4 at 180ms),
// ui-touch-drag (104x40, the help screen's swipe, a white glove dragging one lane-width; tags right
// and left, each a whole swipe of 15 frames timed per frame (TOUCH_MS) and ending on an empty frame,
// and still (one frame for reduced motion)).
//
// Panels, bubbles, plates, tiles and card frames share one chrome (chromeShape); hits.ts, moments.ts,
// scene.ts and cards.ts draw their plates, callouts and frames with it.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead.
import { mkdirSync, writeFileSync } from "node:fs";

import { rgb } from "@andornaut/art-kit/colour";
import { filledImage, paste, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { drawText, type Glyphs, textWidth, titleGlyphs as fontTitleGlyphs } from "./fonts.ts";
import {
  bitmap,
  build as buildSprites,
  contrast,
  DARKER,
  type Drawable,
  edged,
  type Frame,
  Grid,
  HEART,
  hexOf,
  iconEdge,
  K,
  LAYOUT,
  raster,
  rgbPng,
  run,
  savePng,
  type Sprite,
  type Tag,
  toImage,
  ZONE_ROAD_COLOURS,
} from "./pixel.ts";
import { treat } from "./road.ts";

const USAGE = `Usage:
  node art/tools/ui.ts preview OUT.png   every piece, scaled up
  node art/tools/ui.ts build             export to public/art/images/ and public/art/sprites/`;

// ---------- the chrome: one frame for every panel, bubble, plate and card frame ----------

interface ChromeColours {
  // The face, under any text.
  face?: string;
  // The inner line, or null to leave it out, for shapes too small to hold it.
  line?: string | null;
  // The lip along the face's bottom row and right column.
  lip?: string;
}

const SIDES: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// Frame the shape inside(x, y) on g in the UI chrome: a 1px ink outer line, a 1px inner line (plum;
// null leaves it out, for shapes too small to hold it), the face, and the lip (tan on cream) along the
// face's bottom row and right column. openEdge(x, y) is true for points off the grid that continue
// the shape, so a tail laid over a bubble's rim stays open on that side. Ink holds 3:1 on the light
// roads, the cream face on navy, ink and dark wood; text sits on the face.
function chromeShape<G extends Drawable>(
  {
    face = "cream",
    line = "plum",
    lip = "tan",
    openEdge,
  }: ChromeColours & { openEdge?: (x: number, y: number) => boolean },
  g: G,
  inside: (x: number, y: number) => boolean,
): G {
  const solid = (x: number, y: number): boolean =>
    x >= 0 && x < g.w && y >= 0 && y < g.h ? inside(x, y) : Boolean(openEdge?.(x, y));
  const key = (x: number, y: number): string => `${x},${y}`;
  // Each inside pixel by position: 0 on the outer line, 1 on the inner line, null on the face.
  const ring = new Map<string, [number, number, 0 | 1 | null]>();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (inside(x, y)) {
        ring.set(key(x, y), [x, y, SIDES.some(([dx, dy]) => !solid(x + dx, y + dy)) ? 0 : null]);
      }
    }
  }
  const depth = (x: number, y: number): 0 | 1 | null | -1 => {
    const cell = ring.get(key(x, y));
    return cell ? cell[2] : -1;
  };
  for (const cell of ring.values()) {
    const [x, y, d] = cell;
    if (line && d === null && SIDES.some(([dx, dy]) => depth(x + dx, y + dy) === 0)) {
      cell[2] = 1;
    }
  }
  for (const [x, y, d] of ring.values()) {
    if (d === 0) {
      g.p(x, y, "ink");
    } else if (d === 1) {
      g.p(x, y, line);
    } else {
      const framed = [depth(x, y + 1), depth(x + 1, y)];
      g.p(x, y, framed.some((v) => v !== null && v >= 0) ? lip : face);
    }
  }
  return g;
}

// A box with each corner cut on a diagonal r pixels long, as an inside(x, y) test.
function roundedInside(
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
): (x: number, y: number) => boolean {
  return (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (!(i >= 0 && i < w && j >= 0 && j < h)) {
      return false;
    }
    return Math.min(i, w - 1 - i) + Math.min(j, h - 1 - j) >= r;
  };
}

// A chrome box (chromeShape) at x, y, w x h, its corners cut r pixels.
export function chrome<G extends Drawable>(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  { r = 1, ...colours }: ChromeColours & { r?: number } = {},
): G {
  return chromeShape(colours, g, roundedInside(x, y, w, h, r));
}

// A coloured plate in the chrome: the frame and a cream band 2px wide (the lip on its bottom and
// right), then the face from 4px in, lit along its top and left and shaded along its bottom and right.
// Rows and columns 8 to w - 9 are uniform, so a nine-slice with 8px corners keeps them crisp. White
// text on the face: 7.34:1 on dred, 8.48:1 on blue, 8.86:1 on purple.
export function plate(face: string, lit: string, shade: string, w = 24, h = 24): Grid {
  const g = new Grid(w, h);
  chrome(g, 0, 0, w, h);
  g.rect(4, 4, w - 8, h - 8, face);
  g.rect(4, 4, w - 8, 1, lit);
  g.rect(4, 4, 1, h - 8, lit);
  g.rect(4, h - 5, w - 8, 1, shade);
  g.rect(w - 5, 5, 1, h - 9, shade);
  return g;
}

// Stamp rows of characters at (x0, y0), each character other than "." in the colour ink(ch).
function rows(
  g: Drawable,
  x0: number,
  y0: number,
  lines: readonly string[],
  ink: (ch: string) => string,
): void {
  lines.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== ".") {
        g.p(x0 + x, y0 + y, ink(ch));
      }
    });
  });
}

// ---------- icons ----------
// icon-pause, icon-play, icon-home, icon-help, icon-close, icon-logbook, icon-settings, icon-exit and
// icon-sound sit on ui-icon-button's navy face, so they have no outline: cream holds 9.6:1 there, tan
// 6.6:1, amber 7.5:1, orange 5.0:1 and pink 5.1:1. The -panel icons sit on the Settings panel's cream,
// and icon-share and icon-browser-menu on the install steps card's: dbrown holds 5.85:1 there, plum
// 9.42:1 and dred 5.07:1.

// The speaker, note and effects inks: face, shade on the lower-right edges, and the mute X.
type Ink = readonly [face: string, shade: string, x: string];
const NAVY_FACE: Ink = ["cream", "tan", "pink"];
const CREAM_PANEL: Ink = ["dbrown", "plum", "dred"];

// Amber bars, like the Home glyph, so the walk controls stand apart from the cream help and sound
// glyphs.
function pause(): Grid {
  const g = new Grid(16, 16);
  g.rect(4, 3, 3, 10, "amber");
  g.rect(9, 3, 3, 10, "amber");
  g.rect(6, 3, 1, 10, "orange");
  g.rect(11, 3, 1, 10, "orange");
  return g;
}

// The pause button's face while paused: an amber triangle as tall as the pause bars, its lower edge
// orange, 1px right of centre so it looks centred.
function play(): Grid {
  const g = new Grid(16, 16);
  for (let j = 0; j < 10; j++) {
    const w = Math.round(Math.min(j, 9 - j) * 1.6) + 2;
    g.rect(5, 3 + j, w, 1, "amber");
    if (j >= 5) {
      g.p(4 + w, 3 + j, "orange");
    }
  }
  return g;
}

// The Home button: a house as tall as the pause bars, amber with orange on its lower-right edges like
// them, a chimney on the right slope and a doorway the navy face shows through.
function homeIcon(): Grid {
  const g = new Grid(16, 16);
  rows(
    g,
    2,
    3,
    [
      ".....aa.ao..",
      "....aaaaao..",
      "...aaaaaao..",
      "..aaaaaaao..",
      ".aaaaaaaaao.",
      "aaaaaaaaaaao",
      "..aaaaaaao..",
      "..aaa..aao..",
      "..aaa..aao..",
      "..ooo..ooo..",
    ],
    (ch) => (ch === "a" ? "amber" : "orange"),
  );
  return g;
}

// A bold question mark, 2px strokes with a tan right edge like the pause bars.
function helpIcon(): Grid {
  const g = new Grid(16, 16);
  rows(
    g,
    4,
    2,
    [
      "..cccc..",
      ".cccccct",
      "cct..cct",
      "tt...cct",
      "....ccct",
      "...ccct.",
      "...cct..",
      "...cct..",
      "........",
      "...cct..",
      "...cct..",
    ],
    (ch) => (ch === "c" ? "cream" : "tan"),
  );
  return g;
}

function close(): Grid {
  const g = new Grid(16, 16);
  for (let i = 0; i < 9; i++) {
    g.rect(3 + i, 3 + i, 2, 2, "cream");
    g.rect(11 - i, 3 + i, 2, 2, "cream");
  }
  return g;
}

function lock(): Grid {
  const g = new Grid(16, 16);
  g.ell(8, 6, 4, 4.5, "grey", "slate", "lgrey");
  g.ell(8, 6.5, 2, 3, null);
  g.rect(3, 7, 10, 8, "amber");
  g.rect(3, 7, 10, 1, "yellow");
  g.rect(12, 7, 1, 8, "orange");
  g.rect(7, 9, 2, 4, "dbrown");
  return g;
}

// The $ on icon-bill, 5x7: a stroke down the middle through an S.
const DOLLAR: readonly string[] = ["..a..", ".aaaa", "a.a..", ".aaa.", "..a.a", "aaaa.", "..a.."];

// A green dollar bill, its border and its seal's ring in dgreen round a white $, on an item for sale
// the bank covers, where icon-lock marks one it does not: the two differ by shape as well as colour.
function bill(): Grid {
  const g = new Grid(16, 16);
  g.rect(1, 4, 14, 9, "green");
  g.rect(1, 12, 14, 1, "dgreen");
  g.rect(14, 4, 1, 9, "dgreen");
  g.rect(2, 5, 12, 1, "dgreen");
  g.rect(2, 11, 12, 1, "dgreen");
  g.ell(8.5, 8.5, 3.6, 3.2, "dgreen");
  bitmap(g, 6, 5, DOLLAR, { a: "white" });
  return g;
}

// The treat pickup's bone and heart as road.ts's treat lays them out at 16x16 (idle frame 0), outlined
// with iconEdge as the content icons are.
function treatIcon(): Drawable {
  const g = treat({ lift: 0 });
  raster(g).edge = iconEdge;
  return g;
}

// Three broad pink wisps above a mauve gas cloud, with a shared plum keyline.
function stinky(): Frame {
  const g = new Grid(16, 16);
  g.edge = () => K.plum!;
  for (const [x, y] of [
    [2, 10],
    [7, 9],
    [12, 10],
  ] as const) {
    g.ell(x + 1, y + 2, 3, 2.5, "mauve", "purple", "pink");
  }
  g.rect(3, 12, 10, 2, "mauve");
  for (const [x, top] of [
    [2, 2],
    [7, 1],
    [12, 2],
  ] as const) {
    [1, 0, 0, 1, 2, 2, 1].forEach((dx, y) => g.rect(x + dx, top + y, 2, 1, "pink"));
  }
  g.rect(4, 12, 7, 1, "pink");
  return g.outlined();
}

// The X that marks a muted icon, 5x5 in 2px strokes from (x, y).
function muteX(g: Drawable, x: number, y: number, col: string): void {
  for (let i = 0; i < 4; i++) {
    g.rect(x + i, y + i, 2, 2, col);
    g.rect(x + 3 - i, y + i, 2, 2, col);
  }
}

// The states differ by shape: the speaker has two sound waves for on and an X in their place for off;
// the music note (an eighth note, its flag curling right) is bare for on and has the same X below its
// flag for off. Neither has an outline, which would fill the gaps between the waves. ink is NAVY_FACE
// or CREAM_PANEL.
function speaker(ink: Ink, on: boolean, note = false): Grid {
  const [face, shade, xCol] = ink;
  const g = new Grid(16, 16);
  if (note) {
    g.ell(4.5, 12, 3.5, 2.6, face, shade);
    g.rect(7, 2, 1, 10, face);
    g.rect(8, 2, 1, 9, shade);
    for (const [x, y] of [
      [9, 2],
      [10, 2],
      [9, 3],
      [10, 3],
      [11, 3],
      [10, 4],
      [11, 4],
      [12, 4],
      [11, 5],
      [12, 5],
      [12, 6],
      [12, 7],
      [11, 7],
    ] as const) {
      g.p(x, y, face);
    }
    if (!on) {
      muteX(g, 10, 9, xCol);
    }
    return g;
  }
  g.rect(1, 5, 4, 6, face);
  for (let i = 0; i < 4; i++) {
    g.rect(5 + i, 4 - i, 1, 8 + 2 * i, face);
  }
  g.rect(1, 10, 4, 1, shade);
  g.rect(8, 1, 1, 14, shade);
  if (on) {
    for (const [x, y] of [
      [10, 5],
      [10, 10],
      [12, 3],
      [13, 4],
      [13, 11],
      [12, 12],
    ] as const) {
      g.p(x, y, face);
    }
    g.rect(11, 6, 1, 4, face);
    g.rect(14, 5, 1, 6, face);
  } else {
    muteX(g, 10, 5, xCol);
  }
  return g;
}

// The Settings Effects row: a four-point sparkle with two small ones in the waves' place for on, and
// the speaker's X there instead for off.
function effects(ink: Ink, on: boolean): Grid {
  const [face, shade, xCol] = ink;
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    3,
    [
      "....f....",
      "....f....",
      "...ffs...",
      "...ffs...",
      "..fffss..",
      "fffffffss",
      "..fffss..",
      "...fss...",
      "...fss...",
      "....s....",
      "....s....",
    ],
    (ch) => (ch === "f" ? face : shade),
  );
  if (on) {
    g.rect(12, 2, 1, 5, face);
    g.rect(10, 4, 5, 1, face);
    g.p(13, 4, shade);
    g.rect(13, 9, 1, 3, face);
    g.rect(12, 10, 3, 1, face);
    g.p(10, 13, face);
  } else {
    muteX(g, 10, 5, xCol);
  }
  return g;
}

// Reduced motion: a large ball resting on a line when on, travelling past three trails when off.
function motion(ink: Ink, on: boolean): Grid {
  const [face, shade] = ink;
  const g = new Grid(16, 16);
  g.ell(11.5, on ? 10 : 7, 4.2, 4.2, face, shade);
  if (on) {
    g.rect(1, 14, 15, 1, face);
    g.rect(1, 15, 15, 1, shade);
  } else {
    for (const [x, y, w] of [
      [2, 2, 4],
      [0, 6, 6],
      [2, 10, 4],
    ] as const) {
      g.rect(x, y, w, 2, face);
    }
  }
  return g;
}

// The Settings Install app row: a phone, its screen a gap the panel shows through, with a down arrow
// into the screen for on and the speaker's X in the arrow's place for off.
function install(ink: Ink, on: boolean): Grid {
  const [face, shade, xCol] = ink;
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    0,
    [
      "...ffffffffff...",
      "..fffffffffffs..",
      "..ff........fs..",
      "..ff........fs..",
      "..ff...fs...fs..",
      "..ff...fs...fs..",
      "..ff...fs...fs..",
      "..ff...fs...fs..",
      "..ff.ffffss.fs..",
      "..ff..ffss..fs..",
      "..ff...fs...fs..",
      "..ff........fs..",
      "..ff........fs..",
      "..fffffffffffs..",
      "..fffffffffffs..",
      "...ssssssssss...",
    ],
    (ch) => (ch === "f" ? face : shade),
  );
  if (!on) {
    g.rect(4, 4, 8, 7, null);
    muteX(g, 5, 5, xCol);
  }
  return g;
}

// Safari's Share button, for the iOS install steps card: a box open at the top with an arrow rising
// out of it, its chevron head and box in 2px strokes, in the -panel icons' inks.
function shareIcon(): Grid {
  const [face, shade] = CREAM_PANEL;
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    0,
    [
      ".......fs.......",
      "......ffss......",
      ".....fffsss.....",
      "....ff.fs.ss....",
      ".......fs.......",
      ".......fs.......",
      "..fff..fs..ffs..",
      "..ff...fs...fs..",
      "..ff...fs...fs..",
      "..ff...fs...fs..",
      "..ff...fs...fs..",
      "..ff........fs..",
      "..ff........fs..",
      "..ff........fs..",
      "..fffffffffffs..",
      "...ssssssssss...",
    ],
    (ch) => (ch === "f" ? face : shade),
  );
  return g;
}

// The browser menu button, for the Firefox for Android install steps card: three round 4x4 dots
// stacked on the centre line with 2px gaps, lit like icon-share.
function browserMenuIcon(): Grid {
  const [face, shade] = CREAM_PANEL;
  const g = new Grid(16, 16);
  for (const top of [0, 6, 12]) {
    rows(g, 6, top, [".ff.", "fffs", "ffss", ".ss."], (ch) => (ch === "f" ? face : shade));
  }
  return g;
}

// icon-update, 16x16 fills: lime lights the top-left edges, dgreen shades the lower-right.
const UPDATE_ROWS: readonly string[] = [
  "................",
  "................",
  "......LLLL......",
  "......LGGD......",
  "......LGGD......",
  "..LLLLLGGDLLLD..",
  "...LGGGGGGGGD...",
  "....LGGGGGGD....",
  ".....LGGGGD.....",
  "......LGGD......",
  ".LL....GD....LL.",
  ".LG..........GD.",
  ".LG..........GD.",
  ".LGGGGGGGGGGGGD.",
  ".DDDDDDDDDDDDDD.",
  "................",
];

// The home screen's update notice: a green down arrow, its head 12 wide over a 4-wide shaft, pointing
// into a tray of 2px walls and floor, with 2px or more clear between the head and the walls. One
// forest line round every fill, which holds 3:1 on cream and tan as iconEdge's outline on green does.
function updateIcon(): Grid {
  const g = edged(new Grid(16, 16), "forest");
  bitmap(g, 0, 0, UPDATE_ROWS, { D: "dgreen", G: "green", L: "lime" });
  return g;
}

// An open ledger, its two pages bowed up from the spine with three ruled lines each; the spine is a
// navy gap, so the face shows through.
function logbookIcon(): Grid {
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    2,
    [
      "cc..........cc..",
      "cccc......cccc..",
      "ccccccc.cccccct.",
      "c-----c.c-----t.",
      "ccccccc.cccccct.",
      "c----cc.c----ct.",
      "ccccccc.cccccct.",
      "c-----c.c-----t.",
      "ccccccc.cccccct.",
      "cccccct.ccccctt.",
      "tttccct.ccctttt.",
      "...ttt.t.ttt....",
    ],
    (ch) => (ch === "c" ? "cream" : "tan"),
  );
  return g;
}

// A cog: eight teeth around a ring with an eight-sided hole, the shape the sibling duck-platformer
// game's Settings button shares, cream with tan on the lower-right edges like the other navy-face
// glyphs.
function settingsIcon(): Grid {
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    0,
    [
      "......ccct......",
      "......ccct......",
      "..ct..ccct..ct..",
      "..tcccccccccct..",
      "...ccccttccct...",
      "...ccct..tcct...",
      "ccccct....tcccct",
      "cccct......cccct",
      "cccct......cccct",
      "tttcct....cccttt",
      "...ccct..ccct...",
      "...ccccccccct...",
      "..ccttccccttct..",
      "..tt..ccct..tt..",
      "......ccct......",
      "......tttt......",
    ],
    (ch) => (ch === "c" ? "cream" : "tan"),
  );
  return g;
}

// The home top bar's Exit button: a doorway with an arrow leaving it to the right, the shape the
// sibling duck-platformer game's shares, cream with tan on the lower-right edges like the other
// navy-face glyphs.
function exitIcon(): Grid {
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    2,
    [
      ".cccccccct......",
      ".cctttttct......",
      ".ct.....ct..t...",
      ".ct.....tt..ct..",
      ".ct.........cct.",
      ".ct...ccccccccct",
      ".ct...ttttttccct",
      ".ct.........cct.",
      ".ct.....ct..ct..",
      ".ct.....ct..t...",
      ".cccccccct......",
      ".ttttttttt......",
    ],
    (ch) => (ch === "c" ? "cream" : "tan"),
  );
  return g;
}

// 8x7: a full heart is filled dark red; an empty one is a dark brown outline, so the two differ by fill
// as well as colour (5:1 or more on cream). dark is for the navy dog card: the full heart red (3.31:1)
// lit pink and white, the empty one a grey outline (4.93:1).
function heart(full: boolean, dark = false): Grid {
  const g = new Grid(8, 7);
  const on = (x: number, y: number): boolean =>
    y >= 0 && y < HEART.length && x >= 0 && x < HEART[y]!.length && HEART[y]![x] === "1";
  HEART.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c !== "1") {
        return;
      }
      if (full) {
        g.p(x, y, dark ? "red" : "dred");
      } else if (!SIDES.every(([dx, dy]) => on(x + dx, y + dy))) {
        g.p(x, y, dark ? "grey" : "dbrown");
      }
    });
  });
  if (full) {
    g.p(1, 1, dark ? "pink" : "red");
    g.p(2, 1, dark ? "white" : "pink");
  }
  return g;
}

// ---------- nine-slices and badges ----------

// 24x24 nine-slice (4px corners): the chrome box (chrome) with its corners cut 1px.
function panel(): Grid {
  return chrome(new Grid(24, 24), 0, 0, 24, 24);
}

// An interaction state's face, its lip and a button face's top highlight.
type State = readonly [face: string, lip: string | null, hi: string | null];

// The interaction states shared by tiles and buttons: each state's face, its lip and a button face's
// top highlight. normal is the chrome's cream, selected the gold of ui-section's complete state, go the
// one primary action on a screen, disabled a flat grey with no lip.
export const STATES: Readonly<Record<string, State>> = {
  disabled: ["ngrey", null, null],
  go: ["green", "forest", "yellow"],
  normal: ["cream", "tan", "white"],
  selected: ["yellow", "amber", null],
};

const BUTTON_KINDS: Readonly<Record<string, string>> = {
  disabled: "disabled",
  go: "go",
  "go-disabled": "disabled",
  "go-pressed": "go",
  normal: "normal",
  pressed: "normal",
  secondary: "normal",
  "secondary-pressed": "normal",
};

// 24x24 nine-slice, 3px top and sides and a 5px bottom: a face in a 1px ink line on its lip, in one of
// the interaction states (STATES). normal and pressed are the cream standard button, plum label
// (9.42:1); go and go-pressed the primary action, one per screen, ink label on green (8.41:1);
// disabled and go-disabled are the same flat ngrey face sunk to the pressed depth with no lip or
// highlight, ndslate label (3.56:1; inactive, so exempt). secondary and secondary-pressed are copies
// of normal and pressed.
// Raised, row 0 is ink, row 1 the highlight, the face runs to row 18, the lip fills rows 19 to 22 and
// ink row 23. Sunk, rows 0 and 1 are clear, row 2 is ink and the face fills rows 3 to 22, 2px lower,
// so every row from 3 to 18 is plain face and the plate stretches cleanly.
function button(state: string): Grid {
  const kind = BUTTON_KINDS[state];
  if (kind === undefined) {
    throw new RangeError(`No button state ${state}`);
  }
  const [face, lip, hi] = STATES[kind]!;
  const sunk = state.endsWith("pressed") || kind === "disabled";
  const top = sunk ? 2 : 0;
  const g = new Grid(24, 24);
  g.rect(1, top, 22, 24 - top, "ink");
  g.rect(0, top + 1, 24, 22 - top, "ink");
  g.rect(1, top + 1, 22, 22 - top, face);
  if (!sunk) {
    g.rect(1, 19, 22, 4, lip);
    g.rect(1, 1, 22, 1, hi);
  }
  return g;
}

const TILE = 24;
// A normal tile's lip: brown, not the chrome's tan, so it reads apart from the tan box behind an owned
// item's picture, which sits on it.
const TILE_LIP = "brown";

// 24x24 nine-slice, 4px on every side: a pickable tile (walker, dog or gear) in one of the interaction
// states. normal is the chrome's ink and plum lines and cream face on a TILE_LIP lip 2px deep at the
// bottom and 1px at the right. selected is the gold of ui-section's complete state: an ink line, a 1px
// amber band and an orange line round a yellow face on a 1px amber lip. disabled (not owned and short,
// the pack full, not available) is flat in the neutral greys: an ink line, an nslate line and an ngrey
// face with no lip. Content sits from 3px in.
function tile(state: string, phase: number | null = null): Grid {
  const [face, stateLip] = STATES[state]!;
  const lip = state === "normal" ? TILE_LIP : stateLip;
  const g = new Grid(TILE, TILE);
  if (state === "selected") {
    g.rect(1, 0, TILE - 2, TILE, "ink");
    g.rect(0, 1, TILE, TILE - 2, "ink");
    g.rect(1, 1, TILE - 2, TILE - 2, "amber");
    g.rect(2, 2, TILE - 4, TILE - 4, "orange");
    g.rect(3, 3, TILE - 6, TILE - 6, face);
    g.rect(3, TILE - 4, TILE - 6, 1, lip);
    g.rect(TILE - 4, 3, 1, TILE - 6, lip);
    if (phase !== null) {
      selectionGlints(g, phase);
    }
    return g;
  }
  chrome(g, 0, 0, TILE, TILE, {
    face,
    line: lip === null ? "nslate" : "plum",
    lip: lip ?? face,
  });
  if (lip) {
    g.rect(2, TILE - 4, TILE - 4, 1, lip);
  }
  return g;
}

// 20x20, for a 16x16 icon at (2, 1), or (2, 3) when pressed: a navy face in a tan rim on a brown lip,
// so the rim holds 6.5:1 on the plum bar and 4.5:1 on the home street. Pressed, the face sinks 2px
// into its lip.
function iconButton(state: string): Grid {
  const top = state === "pressed" ? 2 : 0;
  const g = new Grid(20, 20);
  if (!top) {
    g.rect(1, 16, 18, 4, "brown");
    g.rect(0, 16, 20, 3, "brown");
  }
  g.rect(1, top, 18, 18, "tan");
  g.rect(0, top + 1, 20, 16, "tan");
  g.rect(1, top + 1, 18, 16, "navy");
  g.rect(1, top + 1, 18, 1, "dslate");
  g.p(18, top + 1, "navy");
  return g;
}

// 32x16, for the Settings panel's cream: a plum-rimmed track with the cream knob at the right and a
// white tick on forest when on, at the left with a white cross on slate when off, so the state reads
// by knob side and glyph as well as colour.
function toggle(on: boolean): Grid {
  const [track, sh] = on ? ["forest", "teal"] : ["slate", "dslate"];
  const g = new Grid(32, 16);
  for (let dy = 0; dy < 16; dy++) {
    const inset = Math.abs(dy - 7.5) < 8 ? Math.round(8 - Math.sqrt(64 - (dy - 7.5) ** 2)) : 8;
    g.rect(inset, dy, 32 - 2 * inset, 1, "plum");
    if (dy > 0 && dy < 15) {
      const inner = Math.abs(dy - 7.5) < 7 ? Math.round(8 - Math.sqrt(49 - (dy - 7.5) ** 2)) : 8;
      g.rect(inner + 1, dy, 30 - 2 * inner, 1, dy === 1 ? sh : track);
    }
  }
  const kx = on ? 23.5 : 8.5;
  g.ell(kx, 8, 6, 6, "plum");
  g.ell(kx, 8, 5, 5, "cream", "tan");
  g.p(Math.trunc(kx) - 2, 5, "white");
  if (on) {
    for (const [x, y] of [
      [4, 8],
      [5, 9],
      [6, 10],
      [7, 9],
      [8, 8],
      [9, 7],
      [10, 6],
      [11, 5],
    ] as const) {
      g.rect(x, y, 1, 2, "white");
    }
  } else {
    for (let i = 0; i < 5; i++) {
      g.rect(19 + i, 5 + i, 1, 2, "white");
      g.rect(23 - i, 5 + i, 1, 2, "white");
    }
  }
  return g;
}

// 24x10 three-slice (4px caps; the middle 16 columns tile) for the Settings volume track on cream.
// filled is a solid forest bar in a plum rim the full 10px tall; empty is a hollow plum groove 6px tall
// in rows 2 to 7, so the level reads by height and fill as well as colour. The plum rim holds 9.42:1 on
// cream and forest 5.39:1. Muted (on false), both keep their shapes in the neutral greys.
function sliderTrack(filled: boolean, on = true): Grid {
  const [rim, face, hi, sh, inner] = on
    ? ["plum", "forest", "dgreen", "teal", "tan"]
    : ["nslate", "ngrey", "nlgrey", "nslate", "nlgrey"];
  const g = new Grid(24, 10);
  if (filled) {
    g.rect(1, 0, 22, 10, rim);
    g.rect(0, 1, 24, 8, rim);
    g.rect(1, 1, 22, 8, face);
    g.rect(1, 1, 22, 1, hi);
    g.rect(1, 8, 22, 1, sh);
  } else {
    g.rect(1, 2, 22, 6, rim);
    g.rect(0, 3, 24, 4, rim);
    g.rect(1, 3, 22, 4, "cream");
    g.rect(1, 3, 22, 1, inner);
  }
  return g;
}

const KNOBS: Readonly<Record<string, readonly [string, string, string, string]>> = {
  disabled: ["nslate", "nlgrey", "ngrey", "ngrey"],
  normal: ["plum", "cream", "tan", "brown"],
  pressed: ["plum", "yellow", "amber", "orange"],
};

// 10x16, drawn 3px above the track so it overhangs it 3px each way. A cream face in a plum rim on a tan
// lip; dragged, the face sinks 2px into its lip and turns yellow, the active-state face. Disabled while
// sound is muted.
function sliderKnob(state: string): Grid {
  const [rim, face, sh, grip] = KNOBS[state]!;
  const top = state === "pressed" ? 2 : 0;
  const g = new Grid(10, 16);
  g.rect(1, top, 8, 16 - top, rim);
  g.rect(0, top + 1, 10, 14 - top, rim);
  g.rect(1, top + 1, 8, 14 - top, sh);
  g.rect(1, top + 1, 7, 12, face);
  g.rect(3, top + 4, 1, 6, grip);
  g.rect(6, top + 4, 1, 6, grip);
  g.p(2, top + 2, "white");
  return g;
}

// 24x24 nine-slice (8px corners): the first-run hint, the chrome box with corners cut 2px, so it reads
// apart from the rounder quip bubble. Text in font-body, plum (9.42:1).
function hint(): Grid {
  return chrome(new Grid(24, 24), 0, 0, 24, 24, { r: 2 });
}

const DOWN_TAILS: ReadonlyMap<number, readonly string[]> = new Map([
  [4, ["########", ".######.", ".######.", "..####..", "..####..", "...##..."]],
  [5, ["########", ".#######", "..######", "...#####", "....###.", ".....#.."]],
]);

// A chrome tail from rows of "#", open past the grid where openEdge(x, y) holds.
function tail(
  w: number,
  shape: readonly string[],
  openEdge: (x: number, y: number) => boolean,
): Grid {
  return chromeShape(
    { line: null, openEdge },
    new Grid(w, shape.length),
    (x, y) => shape[y]![x] === "#",
  );
}

// 8x6, a tail pointing down from a bubble's bottom rim to its tip column: cream in an ink line, the
// lip down its right side. Its top row lies over the rim's ink row, open there, so the cream meets the
// bubble's plum line.
function downTail(tip: number): Grid {
  return tail(8, DOWN_TAILS.get(tip)!, (x, y) => y < 0 && x >= 1 && x < 7);
}

// 8x6, centred under the hint bubble with its top row over the bubble's bottom rim; the tip is at
// columns 3 and 4.
function hintTail(): Grid {
  return downTail(4);
}

let titleCache: Glyphs | undefined;

// font-title's glyphs (fonts.ts's titleGlyphs), rasterised once.
function titleGlyphs(): Glyphs {
  titleCache ??= fontTitleGlyphs();
  return titleCache;
}

// image with text baked in, in font-title and colour col, from column x, each glyph's yoffset below
// row y.
function baked(image: RgbaImage, text: string, x: number, y: number, col: string): RgbaImage {
  drawText({ glyphs: titleGlyphs(), rgba: [...rgb(hexOf(col)), 255] }, text, x, y, image);
  return image;
}

// 72x20: the end screen's NEW BEST! ribbon, the words baked in white font-title.
function newBest(): RgbaImage {
  const g = new Grid(72, 20);
  g.tri([0, 4], [8, 4], [4, 10], "dred");
  g.tri([0, 16], [8, 16], [4, 10], "dred");
  g.rect(0, 4, 4, 12, "dred");
  g.tri([72, 4], [64, 4], [68, 10], "dred");
  g.tri([72, 16], [64, 16], [68, 10], "dred");
  g.rect(68, 4, 4, 12, "dred");
  g.rect(6, 2, 60, 15, "red");
  g.rect(6, 2, 60, 1, "pink");
  g.rect(6, 16, 60, 1, "dred");
  const image = toImage(g.outlined());
  const text = "NEW BEST!";
  const width = textWidth(titleGlyphs(), text);
  return baked(image, text, Math.floor((72 - width) / 2), 4, "white");
}

// 32x32: a pack slot for sale, for the shop's slot rows on a tan box: a doghouse (a red roof shaded
// dred under its eaves, tan walls shaded brown on the right, a plum door under a cream bone plaque, a
// dbrown base) with a green plus badge at the top right. Every fill takes iconEdge's outline, so it
// holds 3:1 on cream and tan as the item-<gear> art does.
function dogSlot(): Grid {
  const g = edged(new Grid(32, 32), iconEdge);
  for (let y = 5; y < 15; y++) {
    const half = y - 5 + 3;
    for (let x = 16 - half; x < 16 + half; x++) {
      g.p(x, y, y >= 13 ? "dred" : x < 16 - half + 2 && y > 6 ? "pink" : "red");
    }
  }
  g.rect(14, 4, 4, 1, "red");
  g.rect(6, 15, 20, 13, "tan");
  g.rect(24, 15, 2, 13, "brown");
  g.rect(6, 15, 20, 1, "brown");
  g.rect(13, 17, 6, 2, "cream");
  g.rect(12, 20, 8, 8, "plum");
  g.p(12, 20, "tan");
  g.p(19, 20, "tan");
  g.rect(4, 28, 24, 2, "dbrown");
  // the plus badge, clear of the roof's outline
  g.rect(23, 2, 7, 7, "green");
  g.rect(24, 1, 5, 9, "green");
  g.rect(22, 3, 9, 5, "green");
  g.rect(28, 7, 2, 1, "forest");
  g.rect(29, 6, 1, 1, "forest");
  g.rect(26, 2, 1, 7, "white");
  g.rect(23, 5, 7, 1, "white");
  return g;
}

// ---------- plates: the fired plate (hits.ts draws the hit label with plate) ----------

// ui-fired-plate's 24x24 nine-slice, 8px corners: a plate in face with a white stamp line 2px inside
// the face, its corners cut so it reads as a stamp's rounded border. The game stretches it to 116x28
// over the dog's card.
export function firedPlate(face: string, lit: string, shade: string): Grid {
  const g = plate(face, lit, shade);
  g.rect(7, 6, 10, 1, "white");
  g.rect(7, 17, 10, 1, "white");
  g.rect(6, 7, 1, 10, "white");
  g.rect(17, 7, 1, 10, "white");
  return g;
}

// ---------- the dogs' colours and the debuff bars ----------

// Each dog's colour, from its accessory, behind its photo on ui-dog-card (the empty card's is dslate).
// No two dogs share one, and none is a zone colour. Sequoia's is his collar's blue, not its sky, which
// backs every owner's photo; Archie's is rust, for his brown coat; Pepe's is his show bow's mauve,
// which holds his black coat's ink line at 3.83:1. In ui-dog-card's tag order.
const DOG_COLOURS: ReadonlyMap<string, string> = new Map([
  ["ginger", "pink"],
  ["reggie", "red"],
  ["buddy", "dred"],
  ["pepe", "mauve"],
  ["lady", "green"],
  ["archie", "rust"],
  ["sequoia", "blue"],
  ["penny", "amber"],
  ["kilo", "orange"],
  ["empty", "dslate"],
]);

// True when every pixel within r of (x, y) is on the card.
function interior(
  solid: (x: number, y: number) => boolean,
  x: number,
  y: number,
  r: number,
): boolean {
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (!solid(x + dx, y + dy)) {
        return false;
      }
    }
  }
  return true;
}

// A debuff bar's face, the empty track, the track's fill and the name's colour.
type DebuffLook = readonly [face: string, shade: string, fill: string, name: string];

// Each debuff's bar under the walk bar: its face, the empty track, the track's fill and the name's
// colour, in ui-debuff-bar's tag order. The name holds 4.5:1 or more on the face: ink on brown 4.66:1,
// white on mauve 4.70:1, ink on green 8.41:1, white on blue 8.48:1. Zoomies is green so its bar never
// sits blue on a blue sky; the spotlight's is a dark stage blue under its yellow beam, darker than every
// sky band.
export const DEBUFF_LOOKS: ReadonlyMap<string, DebuffLook> = new Map([
  ["muddy", ["brown", "dbrown", "tan", "ink"]],
  ["stinky", ["mauve", "purple", "pink", "white"]],
  ["zoomies", ["green", "forest", "yellow", "ink"]],
  ["spotlight", ["blue", "navy", "yellow", "white"]],
]);
const DEBUFF_BAR: readonly [number, number] = [360, 16];
// The bar's track, in bar pixels: its ink frame, and the run the game fills inside it.
const DEBUFF_TRACK: readonly [number, number, number, number] = [68, 4, 288, 7];
const DEBUFF_FILL: readonly [number, number, number, number] = [69, 5, 286, 5];

// 360x16, ui-debuff-bar: one active debuff, drawn full width under the walk bar. The face in the
// debuff's colour (rows 0 to 13), its shade along row 14 and an ink line on row 15 against the sky; the
// track's ink frame at x 68 to 355, rows 4 to 10, round an empty track in the shade (x 69 to 354, rows
// 5 to 9). The game draws icon-<debuff> at (4, 0), the name at x 24 with its capitals on rows 5 to 9,
// and the fill across the track from x 69.
function debuffBar(debuff: string): Grid {
  const [face, shade] = DEBUFF_LOOKS.get(debuff)!;
  const [w, h] = DEBUFF_BAR;
  const g = new Grid(w, h);
  g.rect(0, 0, w, h - 2, face);
  g.rect(0, h - 2, w, 1, shade);
  g.rect(0, h - 1, w, 1, "ink");
  const [x, y, tw, th] = DEBUFF_TRACK;
  g.rect(x + 1, y, tw - 2, th, "ink");
  g.rect(x, y + 1, tw, th - 2, "ink");
  const [fx, fy, fw, fh] = DEBUFF_FILL;
  g.rect(fx, fy, fw, fh, shade);
  return g;
}

// ---------- wood ----------

// Plum wood across g from row top, h rows: h short dbrown grain lines at scattered rows and columns.
function wood(g: Drawable, top: number, h: number): void {
  g.rect(0, top, g.w, h, "plum");
  for (let i = 0; i < h; i++) {
    g.rect((i * 53) % (g.w - 8), top + 4 + ((i * 11) % (h - 9)), 4 + (i % 4) * 3, 1, "dbrown");
  }
}

// ---------- selection and feedback ----------

// Move a two-pixel cream edge accent around a fixed gold frame, never across its face.
function selectionGlints<G extends Drawable>(g: G, phase: number | boolean): G {
  const gold = new Set([K.amber, K.orange]);
  g.px.forEach((row, y) => {
    row.forEach((colour, x) => {
      const leading = x < 3 || y < 3;
      const trailing = x >= g.w - 3 || y >= g.h - 3;
      if (colour !== null && gold.has(colour) && (phase ? trailing : leading)) {
        g.p(x, y, "cream");
      }
    });
  });
  return g;
}

// 24x24 nine-slice (8px corners): the frame around a selected tile or active control. An ink edge on
// both sides of a 2px amber band, so it stands out on any background (ink on tan or cream is 9:1 or
// more); a cream accent alternates between the top/left and bottom/right gold edges.
function selectFrame(glow: boolean): Grid {
  const g = new Grid(24, 24);
  g.rect(1, 0, 22, 24, "ink");
  g.rect(0, 1, 24, 22, "ink");
  g.rect(1, 1, 22, 22, "amber");
  g.rect(3, 3, 18, 18, "ink");
  g.rect(4, 4, 16, 16, null);
  for (const [x, y] of [
    [1, 1],
    [22, 1],
    [1, 22],
    [22, 22],
  ] as const) {
    g.p(x, y, "ink");
  }
  return selectionGlints(g, glow);
}

// 32x32 nine-slice (13px corners), drawn 3px outside the active shop row. A 3px cyan band sits between
// 1px ink keylines; diagonal pairs of cream corner marks exchange 12px and 7px lengths without moving
// the row or changing its availability. Reduced motion holds the first phase. The 5px ring covers only
// the row's first two border pixels inside its edge.
function shopFocusFrame(short: boolean): Grid {
  const g = new Grid(32, 32);
  g.rect(0, 0, 32, 32, "ink");
  g.rect(1, 1, 30, 30, "cyan");
  g.rect(4, 4, 24, 24, "ink");
  g.rect(5, 5, 22, 22, null);
  for (const right of [false, true]) {
    for (const bottom of [false, true]) {
      const length = (right === bottom) !== short ? 12 : 7;
      g.rect(right ? 31 - length : 1, bottom ? 28 : 1, length, 3, "cream");
      g.rect(right ? 28 : 1, bottom ? 31 - length : 1, 3, length, "cream");
    }
  }
  for (const [x, y] of [
    [0, 0],
    [31, 0],
    [0, 31],
    [31, 31],
  ] as const) {
    g.p(x, y, null);
  }
  return g;
}

const CHECK_DIGITS: Readonly<Record<string, string>> = {
  "1": "010110010010111",
  "2": "110001010100111",
  "3": "110001010001110",
};

// The tick on ui-check and ui-switch's on state, each point the top-left of its stroke.
const TICK: readonly (readonly [number, number])[] = [
  [4, 8],
  [5, 9],
  [6, 10],
  [7, 9],
  [8, 8],
  [9, 7],
  [10, 6],
  [11, 5],
];

// 16x16: the green badge on a selected tile, numbered by pick order, or a tick.
function checkBadge(label: string): Grid {
  const g = new Grid(16, 16);
  g.ell(8, 8, 7, 7, "green", "dgreen");
  if (label === "tick") {
    for (const [x, y] of TICK) {
      g.rect(x, y, 2, 2, "white");
    }
  } else {
    const bits = CHECK_DIGITS[label]!;
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 3; k++) {
        if (bits[r * 3 + k] === "1") {
          g.rect(5 + k * 2, 3 + r * 2, 2, 2, "white");
        }
      }
    }
  }
  return g;
}

const TAP_INKS: readonly (readonly [string | null, string])[] = [
  ["yellow", "orange"],
  ["yellow", "orange"],
  ["amber", "rust"],
  [null, "rust"],
];

// 16x16, 4 frames: sparks flying out from where a tap lands, each a 2px streak with an orange or rust
// head and a lighter tail, cooling to lone rust specks in the last frame, so the burst shows on the
// cream panels and the light roads as well as on the dark ones.
function tapBurst(step: number): Grid {
  const g = new Grid(16, 16);
  const r = [1, 3, 5, 7][step]!;
  const [tailInk, head] = TAP_INKS[step]!;
  // the first frame is a plus on the tap's pixel: diagonals 1px out round unevenly
  const dirs: (readonly [number, number])[] = [...SIDES];
  if (step !== 0) {
    dirs.push([-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]);
  }
  for (const [dx, dy] of dirs) {
    if (tailInk !== null) {
      g.p(8 + dx * (r - 1), 8 + dy * (r - 1), tailInk);
    }
    g.p(8 + dx * r, 8 + dy * r, head);
  }
  return g;
}

// 16x16, 4 frames: a puff of dust when a dog joins the pack and hops onto the gate path, its last wisps
// light grey with no shade, so it thins out rather than flashing white.
function dust(step: number): Grid {
  const g = new Grid(16, 16);
  const spread = [2, 3.5, 5, 6][step]!;
  const size = [2.2, 3, 2.8, 1.8][step]!;
  for (const [cx, lift] of [
    [8 - spread, 0],
    [8, 1],
    [8 + spread, 0],
  ] as const) {
    g.ell(cx, 12 - step - lift, size, size, "lgrey", step === 3 ? null : "grey");
  }
  return g;
}

// ---------- start screen: afford outline, detail card, section frames ----------

// One coin stud, 7x7, lit from the top left: P plum rim, Y yellow, A amber, O orange.
const COIN: readonly string[] = [
  "..PPP..",
  ".PYYAP.",
  "PYYAAAP",
  "PYAAAOP",
  "PAAAOOP",
  ".PAOOP.",
  "..PPP..",
];

type Points = readonly (readonly [number, number])[];

// The glint's lit studs and its rays along the line, by glint frame.
const GLINTS: ReadonlyMap<number, readonly [studs: Points, rays: Points]> = new Map([
  [
    1,
    [
      [[0, 0]],
      [
        [7, 1],
        [1, 7],
      ],
    ],
  ],
  [
    2,
    [
      [
        [17, 0],
        [0, 17],
      ],
      [
        [16, 1],
        [1, 16],
      ],
    ],
  ],
]);

// 24x24 nine-slice (8px corners), drawn 2px outside the Pet shop building or a shop row the player can
// afford: a plum keyline outside a 1px amber line, with a gold coin stud on each corner. It differs
// from ui-select (ink, a 2px gold band with moving cream edges, ink, 1px out) by its thin line, its
// round studs and its deeper gold, and it does not pulse. Amber holds 4.57:1 on the dark wood, the plum
// keyline 6.37:1 on the yard's grass and the studs' plum rims 6.49:1 on tan tiles. glint runs a flash
// along the line over two frames: 1 lights the top-left stud with rays heading right and down the
// line, 2 lights the top-right and bottom-left studs as the rays arrive, all inside the corner slices
// so the stretched edges stay plain.
function affordFrame(glint: number): Grid {
  const g = new Grid(24, 24);
  g.rect(1, 0, 22, 24, "plum");
  g.rect(0, 1, 24, 22, "plum");
  g.rect(1, 1, 22, 22, "amber");
  g.rect(2, 2, 20, 20, null);
  for (const [ox, oy] of [
    [0, 0],
    [17, 0],
    [0, 17],
    [17, 17],
  ] as const) {
    bitmap(g, ox, oy, COIN, { A: "amber", O: "orange", P: "plum", Y: "yellow" });
  }
  // the coin's lit top-left, with the line's pixels either side of the stud
  const shine: Points = [
    [2, 2],
    [3, 1],
    [1, 3],
    [2, 1],
    [1, 2],
    [3, 2],
    [2, 3],
  ];
  const [studs, rays] = GLINTS.get(glint) ?? [[], []];
  for (const [ox, oy] of studs) {
    for (const [x, y] of shine) {
      g.p(ox + x, oy + y, "white");
    }
  }
  for (const [x, y] of rays) {
    g.p(x, y, "white");
  }
  return g;
}

// 24x24 nine-slice (8px corners): the hold-to-open detail card, the chrome box with corners cut 2px;
// the paper starts 2px in.
function detailCard(): Grid {
  return chrome(new Grid(24, 24), 0, 0, 24, 24, { r: 2 });
}

// 8x24 three-slice (3px caps; the middle rows tile): the shop list's scrollbar track, a navy groove in
// a 1px ink edge with its corners cut, as tall as the list. Navy holds 9.59:1 on the card's cream and
// the ink edge 12.44:1.
function scrollTrack(): Grid {
  const g = new Grid(8, 24);
  g.rect(1, 0, 6, 24, "ink");
  g.rect(0, 1, 8, 22, "ink");
  g.rect(1, 1, 6, 22, "navy");
  return g;
}

// 6x24 three-slice (3px caps; the middle rows tile): the scrollbar's thumb, drawn 1px inside
// ui-scroll-track so it fills the groove's width. The gold accent of a picked tab, yellow with amber on
// its right column and bottom row and its corners cut: yellow holds 11.13:1 on the track's navy and
// 14.43:1 on its ink edge.
function scrollThumb(): Grid {
  const g = new Grid(6, 24);
  g.rect(1, 0, 4, 24, "yellow");
  g.rect(0, 1, 6, 22, "yellow");
  g.rect(5, 1, 1, 22, "amber");
  g.rect(1, 23, 4, 1, "amber");
  g.p(1, 1, "white");
  return g;
}

// 68x68: the recessed window on the detail card for a 64x64 portrait (portrait-dog-<name>, an owner
// face or a 32x32 gear icon at 2x), drawn at 2,2. The chrome's ink and plum lines around sky, which
// every portrait reads on, with a blue shadow line under the top and left edges where the recess is in
// shadow.
function detailWell(): Grid {
  const g = new Grid(68, 68);
  g.rect(1, 0, 66, 68, "ink");
  g.rect(0, 1, 68, 66, "ink");
  g.rect(1, 1, 66, 66, "plum");
  g.rect(2, 2, 64, 64, "sky");
  g.rect(2, 2, 64, 1, "blue");
  g.rect(2, 2, 1, 64, "blue");
  return g;
}

const SECTION_W = 24;
const SECTION_H = 32;
// Each section state's heading face, in ui-section's tag order.
const SECTION_FACES: ReadonlyMap<string, string> = new Map([
  ["complete", "amber"],
  ["neutral", "violet"],
  ["neutral-walker", "pickerWalkerHeader"],
  ["neutral-dogs", "pickerDogsHeader"],
  ["neutral-pocket", "pickerPocketHeader"],
]);

// 24x32 nine-slice (3px left, right and bottom, 24px top): one start screen section (walker, dogs,
// Pocket) with a single plum rim and heading rows 1 to 22. The solid section fill sits 1px inside the
// rim below the 24px heading. Complete is amber; neutral is the dogs' violet, neutral-walker blue,
// neutral-dogs violet and neutral-pocket pink use picker header tokens. The game writes its title and
// note in rows 8 to 17: ink on complete amber, white on every neutral heading. Neutral hues share OKLCH
// lightness 0.55 and chroma 0.105 before byte rounding. Existing tag indices and nine-slice caps stay
// fixed.
function section(state: string): Grid {
  const g = new Grid(SECTION_W, SECTION_H);
  g.rect(0, 0, SECTION_W, SECTION_H, "plum");
  g.rect(1, 1, SECTION_W - 2, SECTION_H - 2, null);
  g.rect(1, 1, SECTION_W - 2, 22, SECTION_FACES.get(state)!);
  g.rect(1, 23, SECTION_W - 2, 1, "plum");
  return g;
}

// The fill tile size of ui-denim and ui-plaid.
const FABRIC = 16;

// 16x16 solid pickerPocketBody tile, half the pink header's linear RGB.
function denim(): Grid {
  const g = new Grid(FABRIC, FABRIC);
  g.rect(0, 0, FABRIC, FABRIC, "pickerPocketBody");
  return g;
}

// The retained ui-cork tile side.
const CORK = 32;

// 32x32 solid pickerWalkerBody tile, half the blue header's linear RGB.
function cork(): Grid {
  const g = new Grid(CORK, CORK);
  g.rect(0, 0, CORK, CORK, "pickerWalkerBody");
  return g;
}

// 16x16 solid pickerDogsBody tile, half the violet header's linear RGB.
function plaid(): Grid {
  const g = new Grid(FABRIC, FABRIC);
  g.rect(0, 0, FABRIC, FABRIC, "pickerDogsBody");
  return g;
}

// ---------- walk screen and card rows: the strip well, zone progress, quips, zone banner ----------

// A recessed ink slot in the wood: clipped corners and a dark brown lip below and to the right.
function well(g: Drawable, x: number, y: number, w: number, h: number): void {
  g.rect(x + 1, y, w - 2, h, "ink");
  g.rect(x, y + 1, w, h - 2, "ink");
  g.rect(x + 1, y + h - 1, w - 2, 1, "dbrown");
  g.rect(x + w - 1, y + 1, 1, h - 2, "dbrown");
}

// 24x24 nine-slice (8px corners): the band behind a card row's subtitle, plum wood in a 1px ink outline
// with rounded corners round an ink well, its rim 3 rows deep at top and bottom and 3 columns at the
// sides. Each corner steps 2 columns in over a row. Stretch it to the subtitle's width.
function stripWell(): Grid {
  const g = new Grid(24, 24);
  g.rect(0, 2, 24, 20, "plum");
  for (const y of [1, 22]) {
    g.rect(2, y, 20, 1, "plum");
    g.rect(0, y, 2, 1, "ink");
    g.rect(22, y, 2, 1, "ink");
  }
  g.rect(2, 0, 20, 1, "ink");
  g.rect(2, 23, 20, 1, "ink");
  g.rect(0, 2, 1, 20, "ink");
  g.rect(23, 2, 1, 20, "ink");
  well(g, 3, 4, 18, 16);
  return g;
}

// ---------- the walk HUD: the 40-row walk bar, the debuff bars and the dog cards ----------

// The top bar's size, from the layout's regions.topBar.
const WALK_BAR: readonly [number, number] = [
  LAYOUT.regions.topBar.width,
  LAYOUT.regions.topBar.height,
];
// Every top bar (the start screen's, the walk bar, Help's) is 40 rows of flat plum with this trim: a
// dbrown line on row 1, and the bottom rows brown, dbrown and ink, so the bar ends on a lit edge over
// the scene.
const TOP_BAR_LINE = 1;
const TOP_BAR_EDGE: readonly string[] = ["brown", "dbrown", "ink"];
// The walk bar's cash well, in screen pixels: the start screen's bank well at its narrowest, 3 rows
// clear of the trim above and below: x, y, width and height from the layout's walkBar.parts.cash.well.
const WALK_CASH_WELL: readonly [number, number, number, number] = [
  LAYOUT.walkBar.parts.cash.well.x,
  LAYOUT.walkBar.parts.cash.well.y,
  LAYOUT.walkBar.parts.cash.well.width,
  LAYOUT.walkBar.parts.cash.well.height,
];
// The effect wells the game draws on the bar: six 22x22 wells (the perk, Pocket, found item and three
// upgrades), 2 columns apart, set evenly between the cash well and Help's face at x 231, on rows 8 to
// 29, centred on the buttons' faces (rows 9 to 28). The buttons' hits, 34 wide, fill x 224 to 359 at a
// 34 pitch, each face centred in its hit (faces at 231 + 34i). The size is the layout's
// walkBar.parts.effects.size.
const EFFECT_WELL = LAYOUT.walkBar.parts.effects.size;

// 360x40, ui-walk-bar: flat plum with the top bars' trim (dbrown on row 1; brown, dbrown and ink on
// rows 37 to 39) and the ink cash well at 5,5 70x29, sized for "$888" at 3x with no coin. The game
// draws the effect wells, the Help, Sound, Settings and Pause buttons and every text and icon on it.
function walkBar(): Grid {
  const [w, h] = WALK_BAR;
  const g = new Grid(w, h);
  g.rect(0, 0, w, h, "plum");
  g.rect(0, TOP_BAR_LINE, w, 1, "dbrown");
  TOP_BAR_EDGE.forEach((c, i) => g.rect(0, h - TOP_BAR_EDGE.length + i, w, 1, c));
  well(g, ...WALK_CASH_WELL);
  return g;
}

// The start screen top bar's bank well, in screen pixels at its narrowest: the walk bar's cash well.
const HOME_CASH_WELL = WALK_CASH_WELL;

// The start screen top bar's bank well in three pieces, left to right, each one column of a well with
// the walk bar's clipped corners and dbrown lip: its first, any middle one and its last. The game
// stretches it to the bank's width and centres the bank in it. Every middle column is the same, so the
// middle repeats with no seam.
const HOME_CASH_WELL_PIECES: readonly string[] = ["left", "mid", "right"];

// 1x29, ui-home-cash-well-<piece>: one column of the bank well, so the game can draw the well as wide
// as the bank needs. left: the ink side, its top and bottom pixels clipped for the corners. mid: ink
// over the dbrown lip's row, repeated (TileSprite) between the caps. right: the dbrown lip's side,
// clipped top and bottom. left + mid x (w - 2) + right is the well w wide.
function homeCashWellPiece(piece: string): Grid {
  const h = HOME_CASH_WELL[3];
  const n = HOME_CASH_WELL_PIECES.length;
  const whole = new Grid(n, h);
  well(whole, 0, 0, n, h);
  const x = HOME_CASH_WELL_PIECES.indexOf(piece);
  if (x < 0) {
    throw new RangeError(`No cash well piece ${piece}`);
  }
  const g = new Grid(1, h);
  for (let y = 0; y < h; y++) {
    g.px[y]![0] = whole.px[y]![x]!;
  }
  return g;
}

// 22x22, ui-effect-well: an ink well for one active effect's 20x20 icon at (1, 1), with the walk bar's
// wells' clipped corners and dbrown lip.
function effectWell(): Grid {
  const g = new Grid(EFFECT_WELL, EFFECT_WELL);
  well(g, 0, 0, EFFECT_WELL, EFFECT_WELL);
  return g;
}

// The neighbourhood pill on the walk: 13 rows, its ends 4 columns each with two corner steps, so the
// game stretches it as a three-slice to the label's width.
const PILL: readonly [number, number] = [13, 13];

// 13x13 three-slice (4px ends), ui-zone-pill: the walk's neighbourhood label, centred just under the
// walk bar, where the message strip may cover it. A navy face with a lighter top row in a 1px ink line,
// its corners stepped two pixels, so it reads on every backdrop. The game sets the name in cream and
// "n of N" in lgrey, font-body at 1x, their capitals on row 4, 6 columns in from each end.
function zonePill(): Grid {
  const [w, h] = PILL;
  const g = new Grid(w, h);
  g.rect(2, 0, w - 4, h, "ink");
  g.rect(1, 1, w - 2, h - 2, "ink");
  g.rect(0, 2, w, h - 4, "ink");
  g.rect(2, 1, w - 4, h - 2, "navy");
  g.rect(1, 2, w - 2, h - 4, "navy");
  g.rect(2, 1, w - 4, 1, "dslate");
  return g;
}

// The dog card: 120x70 in its slot, the chrome on x 1 to 118 and rows 0 to 69, so a 1px gap runs down
// each side and the card's foot sits on the band's last row, over the neighbourhood progress line. The
// cards are navy, so the eye stays on the road and the dogs' photos and hearts carry the row.
const DOG_CARD: readonly [number, number] = [120, 70];
const DOG_CARD_FRAME: readonly [number, number, number, number] = [1, 0, 118, 70];
// The header's rows (2 to 15) and the ink rule under it.
const DOG_CARD_RULE = 16;
// The photo in the body (the navy on x 3 to 115 and rows 17 to 66): 3 columns of navy to its left, as
// the owner's column keeps to its right, 6 rows above it and 8 below.
const DOG_PHOTO: readonly [number, number] = [6, 23];
// The owner's photo, x, y and side: 3 columns right of the dog's and level with its top, an ink frame
// round a white mat round sky, as ui-owner-tab frames the owner, for the 20x20 face-owner-<dog>-20.
const DOG_CARD_OWNER: readonly [number, number, number] = [45, 23, 24];
// The hearts area the heart-loss flash fills, as x, y, w, h: one row of six hearts from (45,52), its
// foot level with the dog's photo, with a pixel round them. The only part of the card it touches, so
// the warn rim stays the card's only border.
const DOG_CARD_HEARTS: readonly [number, number, number, number] = [44, 51, 55, 9];
// The empty card's FIRED plate, x, y, w and h: a band across the empty photo, centred on it, the
// plate's sides on the photo's frame.
const DOG_CARD_FIRED: readonly [number, number, number, number] = [6, 32, 36, 17];
// Each heart-loss frame: the flash's colour and how many of the area's pixels it fills (1 every pixel,
// 2 a checkerboard, 4 one in four), so it bursts white and dithers away. White keeps the hearts drawn
// over it readable (red 4.19:1, the grey outlines 2.82:1), where a red or pink flash would swallow the
// red hearts (1.0:1 and 1.55:1).
const DOG_CARD_HEART_LOSS: readonly (readonly [string, number])[] = [
  ["white", 1],
  ["white", 1],
  ["white", 2],
  ["white", 4],
];

// 120x70, ui-dog-card: one of three cards in the walk's card row, in the neutral section look: a 2px
// ink frame (the chrome with an ink inner line and an ink lip) round a navy face, the header (rows 2 to
// 15) split from the body by an ink rule on row 16. The game writes the name on the header in cream
// (9.59:1), with no plate. The dog's photo is an ink frame (6,23 36x36) round a cream mat round its
// colour (8,25 32x32), in the body's middle. The owner's photo is an ink frame (45,23 24x24) round a
// white mat round sky (47,25 20x20) for the owner's small face; the game writes the owner's name (tan,
// 6.61:1) beside it and the hearts (ui-heart full-dark and empty-dark) under it, and pins the LEAD tag
// across the foot of the dog's photo. The empty card (a fired dog's) is dslate in the same frame, with
// a dslate photo crossed by a dred plate built as ui-fired-plate (6,32 36x17, its face 10,36 28x9) for
// FIRED, and the owner's photo.
function dogCard(dog: string): Grid {
  const empty = dog === "empty";
  const face = empty ? "dslate" : "navy";
  const [w, h] = DOG_CARD;
  const g = new Grid(w, h);
  chrome(g, ...DOG_CARD_FRAME, { face, line: "ink", lip: "ink", r: 1 });
  g.rect(3, DOG_CARD_RULE, 114, 1, "ink");
  const [x, y] = DOG_PHOTO;
  g.rect(x, y, 36, 36, "ink");
  g.rect(x + 1, y + 1, 34, 34, "cream");
  g.rect(x + 2, y + 2, 32, 32, DOG_COLOURS.get(dog)!);
  const [ox, oy, side] = DOG_CARD_OWNER;
  g.rect(ox, oy, side, side, "ink");
  g.rect(ox + 1, oy + 1, side - 2, side - 2, "white");
  g.rect(ox + 2, oy + 2, side - 4, side - 4, "sky");
  if (empty) {
    const [fx, fy, fw, fh] = DOG_CARD_FIRED;
    const fired = plate("dred", "red", "plum", fw, fh);
    fired.px.forEach((row, yy) => {
      row.forEach((c, xx) => {
        if (c) {
          g.px[fy + yy]![fx + xx] = c;
        }
      });
    });
  }
  return g;
}

// Whether (x, y) is on the empty dog card's drawn pixels.
function dogCardSolid(): (x: number, y: number) => boolean {
  const card = dogCard("empty").px;
  const [w, h] = DOG_CARD;
  return (x, y) => x >= 0 && x < w && y >= 0 && y < h && card[y]![x] !== null;
}

const WARN_INKS: readonly (readonly [string, string])[] = [
  ["orange", "red"],
  ["amber", "red"],
  ["amber", "orange"],
];

// 120x70, ui-dog-card-warn: a 2px rim inside the card's outline, for an owner at one heart; steps 0 to
// 2 run dim to bright. The outer pixel holds 7.35:1 on the wood and 7.49:1 on navy.
function dogCardWarn(step: number): Grid {
  const [outer, inner] = WARN_INKS[step]!;
  const solid = dogCardSolid();
  const [w, h] = DOG_CARD;
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) {
        continue;
      }
      if (!interior(solid, x, y, 1)) {
        g.p(x, y, outer);
      } else if (!interior(solid, x, y, 2)) {
        g.p(x, y, inner);
      }
    }
  }
  return g;
}

// 120x70, ui-dog-card's heart-loss frames, an overlay over the card and under the game's face, hearts
// and text that fills only the hearts area (44,51 55x9, its corners cut 1px), never the card's edge or
// header: frames 0 and 1 white (13.89:1 on navy), then white on a checkerboard and on one pixel in
// four, so the flash clears.
function dogCardHeartLoss(step: number): Grid {
  const [colour, every] = DOG_CARD_HEART_LOSS[step]!;
  const [x0, y0, w, h] = DOG_CARD_HEARTS;
  const inside = roundedInside(x0, y0, w, h, 1);
  const g = new Grid(...DOG_CARD);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!inside(x, y)) {
        continue;
      }
      if (
        every === 1 ||
        (every === 2 && (x + y) % 2 === 0) ||
        (every === 4 && x % 2 === 0 && y % 2 === 0)
      ) {
        g.p(x, y, colour);
      }
    }
  }
  return g;
}

const CARD_BAND: readonly [number, number] = [360, 76];
// The band's top rows, where the road ends: a dithered ink shadow cast onto the road (rows 0 and 1, a
// quarter then three quarters of their pixels), then the trim: ink, a lit tan line and ink (rows 2 to
// 4), then the wood.
const CARD_BAND_TRIM: readonly string[] = ["ink", "tan", "ink"];

// 360x76, ui-dog-card-band: drawn at (0, 480) under the cards. Rows 0 and 1 (screen 480 and 481) are a
// dithered ink shadow over the road's last rows, clear between its pixels; rows 2 to 4 (482 to 484) the
// trim, ink, tan and ink, so the road ends on a lit edge; then plum wood, which shows on row 5 (485)
// above the cards and between them.
function dogCardBand(): Grid {
  const [w, h] = CARD_BAND;
  const g = new Grid(w, h);
  wood(g, 2, h - 2);
  for (let x = 0; x < w; x++) {
    if (x % 4 === 0) {
      g.p(x, 0, "ink");
    }
    if (x % 4 !== 2) {
      g.p(x, 1, "ink");
    }
  }
  CARD_BAND_TRIM.forEach((c, i) => g.rect(0, 2 + i, w, 1, c));
  return g;
}

// 27x11, ui-lead-tag: the front dog's tag, LEAD in font-title, ink on a yellow face (14.43:1) with an
// amber foot, in an ink line with its corners cut 1px.
function leadTag(): RgbaImage {
  const w = 27;
  const h = 11;
  const g = new Grid(w, h);
  g.rect(1, 0, w - 2, h, "ink");
  g.rect(0, 1, w, h - 2, "ink");
  g.rect(1, 1, w - 2, h - 2, "yellow");
  g.rect(1, h - 2, w - 2, 1, "amber");
  return baked(toImage(g.px), "LEAD", 3, -1, "ink");
}

// 36x36, ui-owner-tab: the owner's photo that pops in on a dog card's top-right corner: an ink frame
// round a white mat round sky (2,2 32x32) for the owner's 32x32 face, with plum mounts on its bottom
// corners where it meets the card.
function ownerTab(): Grid {
  const g = new Grid(36, 36);
  g.rect(0, 0, 36, 36, "ink");
  g.rect(1, 1, 34, 34, "white");
  g.rect(2, 2, 32, 32, "sky");
  g.rect(0, 35, 3, 1, "plum");
  g.rect(33, 35, 3, 1, "plum");
  return g;
}

// The colour one ramp step darker than hex c.
function darker(c: string): string {
  const out = DARKER.get(c);
  if (out === undefined) {
    throw new RangeError(`No darker ramp step for ${c}`);
  }
  return out;
}

// A zone pip's rim: its well's colour stepped down its ramp, at least one step, until it holds 3:1 on
// the end screen's cream panel, so every pip shows its edge there, the cream Beaches pip too.
function pipRim(wellColour: string): string {
  let c = darker(hexOf(wellColour));
  while (contrast(c, "cream") < 3) {
    c = darker(c);
  }
  return c;
}

// 18x8, one per zone of the route on the end screen, 3px apart. todo (no zone) is a dashed dbrown rim
// around the bare well: not yet chosen. <zone> is chosen: a 16x6 well at 1,1 in the zone's road
// shadow, its road colour (ZONE_ROAD_COLOURS) one ramp step down. <zone>-done is the well in the
// zone's road colour with a tick (white, or plum where white falls under 3:1), so progress never
// relies on colour alone. A chosen or done pip's rim is pipRim of its well.
function zonePip(zone: string | null = null, done = false): Grid {
  const g = new Grid(18, 8);
  if (zone === null) {
    for (let x = 1; x < 17; x += 3) {
      g.rect(x, 0, 2, 1, "dbrown");
      g.rect(x, 7, 2, 1, "dbrown");
    }
    g.rect(0, 2, 1, 4, "dbrown");
    g.rect(17, 2, 1, 4, "dbrown");
    g.rect(1, 1, 16, 6, "ink");
    return g;
  }
  const fill = ZONE_ROAD_COLOURS.get(zone)!;
  const wellColour = done ? hexOf(fill) : darker(hexOf(fill));
  g.rect(1, 0, 16, 8, pipRim(wellColour));
  g.rect(0, 1, 18, 6, pipRim(wellColour));
  g.rect(1, 1, 16, 6, wellColour);
  if (done) {
    const tick = contrast(fill, "white") >= 3 ? "white" : "plum";
    for (const [x, y] of [
      [6, 4],
      [7, 5],
      [8, 4],
      [9, 3],
      [10, 2],
      [11, 1],
    ] as const) {
      g.p(x, y, tick);
    }
    g.p(7, 6, darker(hexOf(fill)));
  }
  return g;
}

// 8x6, ui-quip-tail turned to point down from a bubble above the owner's tab. Place its top row over
// the bubble's bottom rim so the cream runs through; the tip is at column 5, row 5.
function quipTailDown(): Grid {
  return downTail(5);
}

// 8x6, ui-quip-tail-down turned to point up from a bubble's top rim at the speaker above it. Place its
// bottom row over the bubble's top rim so the cream runs through; the tip is at column 3, row 0.
function quipTailUp(): Grid {
  return tail(
    8,
    ["...#....", "..###...", "..####..", ".######.", ".######.", "########"],
    (x, y) => y > 5 && x >= 1 && x < 7,
  );
}

const CELEBRATE_BURST: readonly [number, number] = [148, 132];

// 148x132: the starburst behind the cheering walker in the zone celebration, a round burst: a yellow
// body (an ellipse with 62x54 half axes) ringed by 18 amber spikes 10px long, in a 1px ink outline,
// with a white glint along the body's upper left. No text goes on it.
function celebrateBurst(): Grid {
  const [w, h] = CELEBRATE_BURST;
  const points = 18;
  const spike = 10;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 12;
  const ry = h / 2 - 12;
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const r = Math.hypot(dx, dy);
      if (r <= 1) {
        g.p(x, y, "yellow");
        continue;
      }
      const turn = (Math.atan2(dy, dx) / (2 * Math.PI)) * points + 0.5;
      const t = ((turn % 1) + 1) % 1;
      if ((r - 1) * Math.min(rx, ry) <= spike * (1 - Math.abs(2 * t - 1))) {
        g.p(x, y, "amber");
      }
    }
  }
  const shape = g.px.map((row) => [...row]);
  const filled = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && shape[y]![x] !== null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y) && SIDES.some(([dx, dy]) => filled(x + dx, y + dy))) {
        g.p(x, y, "ink");
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const r = Math.hypot(dx, dy);
      if (r >= 0.86 && r <= 0.92 && dx + dy < -0.6 && g.px[y]![x] === K.yellow) {
        g.p(x, y, "white");
      }
    }
  }
  return g;
}

// 24x24 nine-slice (8px corners): the owner's speech bubble, the chrome box with corners cut 3px,
// rounder than the hint. Text in font-body, plum (9.42:1).
function quip(): Grid {
  return chrome(new Grid(24, 24), 0, 0, 24, 24, { r: 3 });
}

// 6x8, pointing left at the speaker (flipped for a bubble on its left): cream in an ink line. Place its
// right column over the bubble's left rim so the cream meets the bubble's plum line.
function quipTail(): Grid {
  return tail(
    6,
    ["....##", "...###", "..####", ".#####", "######", ".#####", "...###", ".....#"],
    (x, y) => x > 5 && y >= 1 && y < 7,
  );
}

// 248x48: a cream board in the chrome on navy ribbon ends, shown over the road between zones. The game
// writes two lines in font-title, plum, centred on x=124: the world and zone number ("TORONTO,
// NEIGHBOURHOOD 2") with its caps in rows 11 to 15, and the zone name at x2 ("KENSINGTON MARKET", up to
// 192px wide) with its caps in rows 27 to 36, under the dotted divider.
function zoneBanner(): Grid {
  const g = new Grid(248, 48);
  const ribbon = new Grid(248, 48);
  for (const x0 of [0, 220]) {
    ribbon.rect(x0, 12, 28, 30, "ink");
    ribbon.rect(x0 + 1, 13, 26, 28, "navy");
    ribbon.rect(x0 + 1, 13, 26, 1, "dslate");
    ribbon.rect(x0 + 1, 40, 26, 1, "ink");
  }
  ribbon.tri([0, 12], [0, 42], [10, 27], null);
  ribbon.tri([248, 12], [248, 42], [238, 27], null);
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 248; x++) {
      const c = ribbon.px[y]![x]!;
      const edge = [-1, 1].some((dx) => !(x + dx >= 0 && x + dx < 248) || !ribbon.px[y]![x + dx]);
      g.px[y]![x] = c && edge ? K.ink! : c;
    }
  }
  chrome(g, 12, 0, 224, 48, { r: 3 });
  for (let x = 28; x < 220; x += 3) {
    g.p(x, 21, "tan");
  }
  return g;
}

// ui-touch-drag: the help screen's swipe, a white glove dragging one lane-width (64px) on a 104x40
// frame. The fingertip's contact row is TOUCH_Y; a swipe right runs from column TOUCH_FROM to TOUCH_TO
// and a swipe left back again, so the anchor (TOUCH_FROM, TOUCH_Y) stands on lane 1's centre.
const TOUCH_SIZE: readonly [number, number] = [104, 40];
const TOUCH_Y = 6;
const TOUCH_FROM = 20;
const TOUCH_TO = 84;
// The glove, a right hand from the back pointing up, outlined in ink: the fingertip's contact pixel is
// column TOUCH_TIP of row 0. W white, L lgrey shade, G grey creases and the line above the cuff, C and
// D the cuff and its shade.
const TOUCH_GLOVE: readonly string[] = [
  ".....WW.........",
  "....WWWW........",
  "....WWWL........",
  "....WWWL........",
  "....WWWL........",
  "....WWWL........",
  "....WWWLWWW.....",
  "....WWWLWWWLWW..",
  "....WWWGWWWGWWW.",
  "....WWWGWWWGWWWL",
  ".WW.WWWGWWWGWWWL",
  "WWWLWWWWWWWWWWWL",
  "WWWWLWWWWWWWWWWL",
  ".WWWWWWWWWWWWWWL",
  "..WWWWWWWWWWWWWL",
  "...WWWWWWWWWWWL.",
  "....WWWWWWWWWWL.",
  "....WWWWWWWWWLL.",
  "....LLLLLLLLLLL.",
  "....GGGGGGGGGGG.",
  "....CCCCCCCCCCD.",
  "....CCCCCCCCCCD.",
  "....CCCCCCCCCCD.",
];
const TOUCH_TIP = 5;
const TOUCH_GLOVE_COLS: Readonly<Record<string, string>> = {
  C: "white",
  D: "lgrey",
  G: "grey",
  L: "lgrey",
  W: "white",
};
// The drag's offsets from its start, eased in and out over 7 frames; the glove off the glass stands
// TOUCH_HOVER down and right of the contact.
const TOUCH_OFFSETS: readonly number[] = [4, 12, 24, 38, 51, 60, 64];
const TOUCH_HOVER: readonly [number, number] = [2, 3];
// Per-frame ms of one swipe: hover, press (2), drag (7), hold (2), lift (2) and the empty pause.
const TOUCH_MS: readonly number[] = [
  300,
  80,
  100,
  ...Array<number>(7).fill(70),
  80,
  80,
  90,
  90,
  350,
];
// The still for reduced motion: the swipe right's fifth drag frame, its whole trail kept.
const TOUCH_STILL = 4;

// One layer of a touch frame, outlined in ink on its own, so a later layer's line sits over an earlier
// layer's fill (the glove's line over the trail and the ring).
function touchLayer(draw: (g: Grid) => void): Frame {
  const g = new Grid(...TOUCH_SIZE);
  draw(g);
  g.edge = () => K.ink!;
  return g.outlined();
}

// The press ring (yellow) or the lift ring (lgrey) round the contact at column x, under the glove.
function touchRing(x: number, r: number, col: string): Frame {
  return touchLayer((g) => {
    g.ell(x + 0.5, TOUCH_Y + 0.5, r, r, col);
    g.ell(x + 0.5, TOUCH_Y + 0.5, r - 1.25, r - 1.25, null);
  });
}

function touchGlove(x: number, dx = 0, dy = 0): Frame {
  return touchLayer((g) =>
    bitmap(g, x - TOUCH_TIP + dx, TOUCH_Y + dy, TOUCH_GLOVE, TOUCH_GLOVE_COLS),
  );
}

// The dots the fingertip leaves from start to head: 2x2 every 4px in an ink rim, white within 20px of
// the finger, then lgrey, then grey, none past 48px. fade draws the tail in 12px per frame once the
// finger stops. whole keeps every dot back to the start, white then lgrey, for a still that shows the
// whole path (grey dots vanish on Cabbagetown's grey road).
function touchTrail(head: number, start: number, fade = 0, whole = false): Frame {
  const way = head >= start ? 1 : -1;
  return touchLayer((g) => {
    for (let x = start; (head - x) * way > 5; x += 4 * way) {
      const back = (head - x) * way + 12 * fade;
      if (whole || back <= 48) {
        g.rect(
          way > 0 ? x : x - 1,
          TOUCH_Y - 1,
          2,
          2,
          back < 20 ? "white" : whole || back < 36 ? "lgrey" : "grey",
        );
      }
    }
  });
}

// The layers drawn in order, each one's pixels over the ones before.
function touchFrame(...layers: readonly Frame[]): Frame {
  const [w, h] = TOUCH_SIZE;
  const out: Frame = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  for (const layer of layers) {
    layer.forEach((row, y) => {
      row.forEach((c, x) => {
        if (c) {
          out[y]![x] = c;
        }
      });
    });
  }
  return out;
}

// One swipe from column start, way 1 (right) or -1 (left), as TOUCH_MS times it: the glove hovers off
// the glass, presses (the yellow ring grows), drags with the ring round the fingertip and the dots
// behind, holds while the dots draw in, lifts (the lgrey ring grows as the glove leaves) and is gone.
function touchSwipe(start: number, way: number): Frame[] {
  const end = start + 64 * way;
  const [hx, hy] = TOUCH_HOVER;
  const frames = [
    touchFrame(touchGlove(start, hx, hy)),
    touchFrame(touchRing(start, 3.5, "yellow"), touchGlove(start)),
    touchFrame(touchRing(start, 5.5, "yellow"), touchGlove(start)),
  ];
  for (const o of TOUCH_OFFSETS) {
    const x = start + o * way;
    frames.push(touchFrame(touchTrail(x, start), touchRing(x, 3.5, "yellow"), touchGlove(x)));
  }
  for (const fade of [1, 2]) {
    frames.push(
      touchFrame(touchTrail(end, start, fade), touchRing(end, 3.5, "yellow"), touchGlove(end)),
    );
  }
  frames.push(touchFrame(touchRing(end, 4, "lgrey"), touchGlove(end, hx, hy)));
  frames.push(touchFrame(touchRing(end, 5.5, "lgrey"), touchGlove(end, hx + 1, hy + 2)));
  frames.push(touchFrame());
  return frames;
}

// The reduced-motion still: the swipe right's drag frame TOUCH_STILL, its whole trail kept.
function touchStill(): Frame {
  const x = TOUCH_FROM + TOUCH_OFFSETS[TOUCH_STILL]!;
  return touchFrame(touchTrail(x, TOUCH_FROM, 0, true), touchRing(x, 3.5, "yellow"), touchGlove(x));
}

function touchTags(): Tag[] {
  return [
    ["right", touchSwipe(TOUCH_FROM, 1), TOUCH_MS],
    ["left", touchSwipe(TOUCH_TO, -1), TOUCH_MS],
    ["still", [touchStill()], 1000],
  ];
}

// A grid's pixels as an image, unoutlined.
function flat(g: Drawable): RgbaImage {
  return toImage(g.outlined(false));
}

// A grid's pixels as an image, outlined by its edge rule.
function edgedImage(g: Drawable): RgbaImage {
  return toImage(g.outlined());
}

// Every image by key, in build order.
const IMAGES: ReadonlyMap<string, () => RgbaImage> = new Map([
  ["icon-pause", () => flat(pause())],
  ["icon-play", () => flat(play())],
  ["icon-home", () => flat(homeIcon())],
  ["icon-help", () => flat(helpIcon())],
  ["icon-close", () => flat(close())],
  ["icon-logbook", () => flat(logbookIcon())],
  ["icon-settings", () => flat(settingsIcon())],
  ["icon-exit", () => flat(exitIcon())],
  ["icon-share", () => flat(shareIcon())],
  ["icon-browser-menu", () => flat(browserMenuIcon())],
  ["icon-update", () => edgedImage(updateIcon())],
  ["icon-lock", () => edgedImage(lock())],
  ["icon-bill", () => edgedImage(bill())],
  ["icon-treat", () => edgedImage(treatIcon())],
  ["icon-stinky", () => toImage(stinky())],
  ["icon-dog-slot", () => edgedImage(dogSlot())],
  ["ui-panel", () => flat(panel())],
  ["ui-hint", () => flat(hint())],
  ["ui-hint-tail", () => flat(hintTail())],
  ["ui-new-best", newBest],
  ["ui-strip-well", () => flat(stripWell())],
  ["ui-quip", () => flat(quip())],
  ["ui-quip-tail", () => flat(quipTail())],
  ["ui-quip-tail-down", () => flat(quipTailDown())],
  ["ui-quip-tail-up", () => flat(quipTailUp())],
  ["ui-celebrate-burst", () => flat(celebrateBurst())],
  ["ui-zone-banner", () => flat(zoneBanner())],
  ["ui-walk-bar", () => flat(walkBar())],
  ["ui-effect-well", () => flat(effectWell())],
  ["ui-zone-pill", () => flat(zonePill())],
  ...HOME_CASH_WELL_PIECES.map(
    (p) => [`ui-home-cash-well-${p}`, () => flat(homeCashWellPiece(p))] as const,
  ),
  ["ui-dog-card-band", () => flat(dogCardBand())],
  ["ui-lead-tag", leadTag],
  ["ui-owner-tab", () => flat(ownerTab())],
  ["ui-detail-card", () => flat(detailCard())],
  ["ui-detail-well", () => flat(detailWell())],
  ["ui-scroll-thumb", () => flat(scrollThumb())],
  ["ui-scroll-track", () => flat(scrollTrack())],
  ["ui-cork", () => flat(cork())],
  ["ui-denim", () => flat(denim())],
  ["ui-plaid", () => flat(plaid())],
]);

// One tag of single-frame states, each at 1000ms.
function still(name: string, g: Drawable, outline = false): Tag {
  return [name, [g.outlined(outline)], 1000];
}

// Every sprite: [key, [[tag, frames, duration ms]]].
function* sprites(): Generator<Sprite> {
  yield [
    "ui-dog-card",
    [
      ...[...DOG_COLOURS.keys()].map((dog) => still(dog, dogCard(dog))),
      [
        "heart-loss",
        [0, 1, 2, 3].map((i) => dogCardHeartLoss(i).outlined(false)),
        [60, 60, 80, 80],
      ],
    ],
  ];
  const cardWarn = [0, 1, 2, 1].map((i) => dogCardWarn(i).outlined(false));
  yield [
    "ui-dog-card-warn",
    [
      ["pulse", cardWarn, 400],
      ["static", [cardWarn[1]!], 1000],
    ],
  ];
  yield ["ui-debuff-bar", [...DEBUFF_LOOKS.keys()].map((d) => still(d, debuffBar(d)))];
  yield [
    "ui-select",
    [["pulse", [selectFrame(false).outlined(false), selectFrame(true).outlined(false)], 180]],
  ];
  yield [
    "ui-shop-focus",
    [["pulse", [shopFocusFrame(false).outlined(false), shopFocusFrame(true).outlined(false)], 180]],
  ];
  yield ["ui-check", ["1", "2", "3", "tick"].map((lb) => still(lb, checkBadge(lb), true))];
  yield ["ui-afford", [["glint", [0, 0, 1, 2].map((i) => affordFrame(i).outlined(false)), 400]]];
  yield ["ui-section", [...SECTION_FACES.keys()].map((s) => still(s, section(s)))];
  yield ["fx-tap", [["play", [0, 1, 2, 3].map((i) => tapBurst(i).outlined(false)), 60]]];
  yield ["fx-dust", [["play", [0, 1, 2, 3].map((i) => dust(i).outlined(false)), 80]]];
  yield [
    "ui-heart",
    [
      still("full", heart(true)),
      still("empty", heart(false)),
      still("full-dark", heart(true, true)),
      still("empty-dark", heart(false, true)),
    ],
  ];
  // Keep the existing normal, static selected and disabled frame indices; append the animated tag.
  yield [
    "ui-tile",
    [
      still("normal", tile("normal")),
      still("selected-static", tile("selected")),
      still("disabled", tile("disabled")),
      ["selected", [0, 1].map((p) => tile("selected", p).outlined(false)), 180],
    ],
  ];
  yield [
    "ui-button",
    [
      "normal",
      "pressed",
      "disabled",
      "secondary",
      "secondary-pressed",
      "go",
      "go-pressed",
      "go-disabled",
    ].map((s) => still(s, button(s))),
  ];
  yield ["ui-icon-button", ["normal", "pressed"].map((s) => still(s, iconButton(s)))];
  yield ["ui-switch", [still("on", toggle(true)), still("off", toggle(false))]];
  yield [
    "ui-slider",
    ["filled", "empty", "filled-disabled", "empty-disabled"].map((t) =>
      still(t, sliderTrack(t.startsWith("filled"), !t.endsWith("disabled"))),
    ),
  ];
  yield ["ui-slider-knob", ["normal", "pressed", "disabled"].map((s) => still(s, sliderKnob(s)))];
  const onOff = (draw: (on: boolean) => Drawable): Tag[] =>
    ["on", "off"].map((t) => still(t, draw(t === "on")));
  for (const [suffix, ink] of [
    ["", NAVY_FACE],
    ["-panel", CREAM_PANEL],
  ] as const) {
    yield [`icon-sound${suffix}`, onOff((on) => speaker(ink, on))];
  }
  yield ["icon-music-panel", onOff((on) => speaker(CREAM_PANEL, on, true))];
  yield ["icon-effects-panel", onOff((on) => effects(CREAM_PANEL, on))];
  yield ["icon-motion-panel", onOff((on) => motion(CREAM_PANEL, on))];
  yield ["icon-install-panel", onOff((on) => install(CREAM_PANEL, on))];
  yield [
    "ui-zone-pips",
    [
      still("todo", zonePip()),
      ...[...ZONE_ROAD_COLOURS.keys()].flatMap((zone) =>
        ["", "-done"].map((suffix) => still(zone + suffix, zonePip(zone, Boolean(suffix)))),
      ),
    ],
  ];
  yield ["ui-touch-drag", touchTags()];
}

// ---------- preview and build ----------

// Every piece in rows that wrap at width, so the 360px walk bar gets a row of its own.
function preview(out: string, scale = 3, width = 380): void {
  const pieces = [...IMAGES.values()].map((draw) => draw());
  for (const [, tags] of sprites()) {
    pieces.push(...tags.flatMap(([, fs]) => fs.map(toImage)));
  }
  const rowsOf: RgbaImage[][] = [];
  let row: RgbaImage[] = [];
  for (const p of pieces) {
    if (row.length && row.reduce((sum, q) => sum + q.width + 6, 0) + p.width > width) {
      rowsOf.push(row);
      row = [];
    }
    row.push(p);
  }
  rowsOf.push(row);
  const rowHeight = (r: readonly RgbaImage[]): number => Math.max(...r.map((p) => p.height)) + 6;
  const height = rowsOf.reduce((sum, r) => sum + rowHeight(r), 0);
  const sheet = filledImage([115, 62, 57, 255], width, height);
  let y = 0;
  for (const r of rowsOf) {
    let x = 0;
    for (const p of r) {
      paste({ at: { x, y }, keepAlpha: true, mask: "alpha" }, p, sheet);
      x += p.width + 6;
    }
    y += rowHeight(r);
  }
  writeFileSync(out, rgbPng(resizeNearest(width * scale, height * scale, sheet)));
}

async function build(): Promise<void> {
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of IMAGES) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, savePng(draw()));
  }
  await buildSprites({}, sprites());
  console.log("built", [...IMAGES.keys()].join(", "));
}

if (import.meta.main) {
  await run({
    commands: { build: () => build(), "preview OUT.png": (out) => preview(out) },
    doc: USAGE,
  });
}
