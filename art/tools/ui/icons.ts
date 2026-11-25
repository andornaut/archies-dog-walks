import {
  bitmap,
  type Drawable,
  edged,
  type Frame,
  Grid,
  HEART,
  iconEdge,
  K,
  raster,
} from "../pixel.ts";
import { treat } from "../road.ts";
import { rows, SIDES } from "./chrome.ts";

// ---------- icons ----------
// icon-pause, icon-play, icon-home, icon-help, icon-close, icon-menu, icon-logbook, icon-settings, icon-exit and
// icon-sound sit on ui-icon-button's navy face, so they have no outline: cream holds 9.6:1 there, tan
// 6.6:1, amber 7.5:1, orange 5.0:1 and pink 5.1:1. The -panel icons sit on the Settings panel's cream,
// and icon-share and icon-browser-menu on the install steps card's: dbrown holds 5.85:1 there and
// plum 9.42:1. The -panel icons have one frame each: the Settings row's switch, state word and
// slider show its state.

// An icon's inks: face, and shade on the lower-right edges.
type Ink = readonly [face: string, shade: string];

export const NAVY_FACE: Ink = ["cream", "tan"];

export const CREAM_PANEL: Ink = ["dbrown", "plum"];

// The X on the top bar's muted icon-sound.
const NAVY_MUTE = "pink";

// Three equally spaced flat bars, centred on the chrome face.
export function menuIcon(): Grid {
  const g = new Grid(16, 16);
  for (const y of [3, 7, 11]) {
    g.rect(3, y, 10, 1, "cream");
    g.rect(3, y + 1, 10, 1, "tan");
  }
  return g;
}

// Amber bars, like the Home glyph, so the walk controls stand apart from the cream help and sound
// glyphs.
export function pause(): Grid {
  const g = new Grid(16, 16);
  g.rect(4, 3, 3, 10, "amber");
  g.rect(9, 3, 3, 10, "amber");
  g.rect(6, 3, 1, 10, "orange");
  g.rect(11, 3, 1, 10, "orange");
  return g;
}

// The pause button's face while paused: an amber triangle as tall as the pause bars, its lower edge
// orange, 1px right of centre so it looks centred.
export function play(): Grid {
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
export function homeIcon(): Grid {
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
export function helpIcon(): Grid {
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

export function close(): Grid {
  const g = new Grid(16, 16);
  for (let i = 0; i < 9; i++) {
    g.rect(3 + i, 3 + i, 2, 2, "cream");
    g.rect(11 - i, 3 + i, 2, 2, "cream");
  }
  return g;
}

export function lock(): Grid {
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
export function bill(): Grid {
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
export function treatIcon(): Drawable {
  const g = treat({ lift: 0 });
  raster(g).edge = iconEdge;
  return g;
}

// Three broad pink wisps above a mauve gas cloud, with a shared plum keyline.
export function stinky(): Frame {
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

// A speaker with two sound waves. Muted, the top bar's icon-sound has an X in the waves' place.
// It has no outline, which would fill the gaps between the waves.
export function speaker(ink: Ink, on: boolean): Grid {
  const [face, shade] = ink;
  const g = new Grid(16, 16);
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
    muteX(g, 10, 5, NAVY_MUTE);
  }
  return g;
}

// The Settings Music row: an eighth note, its flag curling right, with no outline.
export function note(ink: Ink): Grid {
  const [face, shade] = ink;
  const g = new Grid(16, 16);
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
  return g;
}

// The Settings Effects row: a four-point sparkle with two small ones to its right.
export function effects(ink: Ink): Grid {
  const [face, shade] = ink;
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
  g.rect(12, 2, 1, 5, face);
  g.rect(10, 4, 5, 1, face);
  g.p(13, 4, shade);
  g.rect(13, 9, 1, 3, face);
  g.rect(12, 10, 3, 1, face);
  g.p(10, 13, face);
  return g;
}

// The Settings Reduced motion row: a large ball resting on a line.
export function motion(ink: Ink): Grid {
  const [face, shade] = ink;
  const g = new Grid(16, 16);
  g.ell(11.5, 7, 4.2, 4.2, face, shade);
  g.rect(1, 11, 15, 1, face);
  g.rect(1, 12, 15, 1, shade);
  return g;
}

// The Settings FPS Counter row: a rounded frame with three bars rising left to right, in the
// -panel icons' face with the shade on the lower-right edges. Its top is on frame row 3, the
// label's cap line, as the sparkle's is.
export function fpsCounter(ink: Ink): Grid {
  const [face, shade] = ink;
  const g = new Grid(16, 16);
  rows(
    g,
    0,
    3,
    [
      "..fffffffffff...",
      ".f...........fs.",
      ".f........fs.fs.",
      ".f........fs.fs.",
      ".f.....fs.fs.fs.",
      ".f.....fs.fs.fs.",
      ".f..fs.fs.fs.fs.",
      ".f..fs.fs.fs.fs.",
      ".f...........fs.",
      "..fffffffffffs..",
      "...ssssssssss...",
    ],
    (ch) => (ch === "f" ? face : shade),
  );
  return g;
}

// The Settings Install app row: a phone, its screen a gap the panel shows through, with a down arrow
// into the screen.
export function install(ink: Ink): Grid {
  const [face, shade] = ink;
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
  return g;
}

// Safari's Share button, for the iOS install steps card: a box open at the top with an arrow rising
// out of it, its chevron head and box in 2px strokes, in the -panel icons' inks.
export function shareIcon(): Grid {
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

// The browser menu button, for the Chrome for Android and Firefox for Android install steps cards:
// three round 4x4 dots stacked on the centre line with 2px gaps, lit like icon-share.
export function browserMenuIcon(): Grid {
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
export function updateIcon(): Grid {
  const g = edged(new Grid(16, 16), "forest");
  bitmap(g, 0, 0, UPDATE_ROWS, { D: "dgreen", G: "green", L: "lime" });
  return g;
}

// An open ledger, its two pages bowed up from the spine with three ruled lines each; the spine is a
// navy gap, so the face shows through.
export function logbookIcon(): Grid {
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
export function settingsIcon(): Grid {
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
export function exitIcon(): Grid {
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
export function heart(full: boolean, dark = false): Grid {
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
