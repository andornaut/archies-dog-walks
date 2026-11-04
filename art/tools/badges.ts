// Draw the 41 achievement badges and the celebration burst.
//
// badge-<achievement>: 32x32 medals, rimmed by category (firsts bronze, mastery silver, collection
// gold, legend purple with gold studs for the one hardest badge, silly pink), each with its own emblem
// for its goal: no two share a motif, so each reads apart from the rest at 1x on the badge wall. The
// ring's outline takes iconEdge, so it holds 3:1 on the wall's cream; the face is flat cream with a
// 1px tan crescent along its lower right. Tags: earned (in colour) and locked (in the neutral greys
// of locked UI: an ndslate ring, an ngrey face, the emblem as a two-tone ink and ndslate silhouette,
// a small padlock), dark enough that it never reads as silver. Where an emblem's edge holds under 3:1
// against the cream and tan face, the face beside it takes a 1px keyline: plum (9.42:1 on cream,
// 6.49:1 on tan), teal for green (eau-de-skunk).
// fx-confetti: 64x64, the burst behind a badge as it is earned (tag play, 10 frames at 80ms),
// plum-rimmed so it reads on the Logbook's and the end screen's cream panels.
// fx-confetti-bit: 6x6, one bit of the zone celebration's falling confetti, a tag per colour (amber,
// cyan, green, pink, white, yellow), each 4 frames at 100ms tumbling face on, edge on, turning and
// edge on the other way, in the same plum rim. The game drops them down the dimmed road view.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { type Random, randomInt, randomStream } from "@andornaut/game-kit/random";

import { fannyPack } from "./drops.ts";
import { Mini } from "./mini.ts";
import {
  bitmap,
  contrast,
  Grid,
  HEART,
  hexOf,
  iconEdge,
  K,
  main,
  type Point,
  type Sprite,
} from "./pixel.ts";
import { SQUIRREL_FUR } from "./road.ts";

const USAGE = `Usage:
  node art/tools/badges.ts preview OUT.png   every badge, earned and locked, and the burst, on
                                             dark wood, slate and cream
  node art/tools/badges.ts build             write art/badges/*.aseprite and export to
                                             public/art/sprites/`;

type Draw = (g: Grid) => void;
type Rows = readonly string[];

// Each category's rim: fill, shade and light.
const RIMS: Readonly<Record<string, readonly [string, string, string]>> = {
  collection: ["amber", "orange", "yellow"],
  firsts: ["ochre", "rust", "tan"],
  legend: ["purple", "plum", "mauve"],
  mastery: ["lgrey", "grey", "white"],
  silly: ["pink", "mauve", "white"],
};
// The rim's studs where they are not the rim's shade: gold on the legend's purple.
const STUDS: Readonly<Record<string, string>> = { legend: "yellow" };
// The icon keyline's colour where it is not plum, after the effects' rims.
const KEYLINES: Readonly<Record<string, string>> = { "eau-de-skunk": "teal" };

const radians = (degrees: number): number => degrees * (Math.PI / 180);

// Luma of a house colour name or hex, 0 to 255.
function lum(c: string): number {
  const hex = hexOf(c);
  return (
    0.299 * parseInt(hex.slice(0, 2), 16) +
    0.587 * parseInt(hex.slice(2, 4), 16) +
    0.114 * parseInt(hex.slice(4, 6), 16)
  );
}

// A muddy print: a pad under four toes, each toe apart from the others and the pad by a 1px gap, so
// the print reads as a paw and not as arcs. 9x9.
const PAW_PRINT: Rows = [
  "..xx.xx..",
  "..xx.xx..",
  ".........",
  "xx.....xx",
  "xx.xxx.xx",
  "..xxxxx..",
  ".xxxxxxx.",
  ".xxxxxxx.",
  "..xx.xx..",
];

// A w-pixel line from a to b.
function line(g: Grid, a: Point, b: Point, col: string, w = 1): void {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1) * 2);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const y = a[1] + ((b[1] - a[1]) * i) / n;
    g.rect(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, col);
  }
}

// A 1px circle of radius r, with a white glint at its upper left when hi is set.
function ring(g: Grid, cx: number, cy: number, r: number, col: string, hi?: string): void {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (r - 1 < d && d <= r) {
        g.p(x, y, col);
      }
    }
  }
  if (hi) {
    g.p(cx - r * 0.5, cy - r * 0.5, hi);
  }
}

// A 14x12 heart: HEART at 2x, its upper-left lobe lit.
function heart(g: Grid, x0: number, y0: number, col = "red", hi = "pink"): void {
  HEART.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === "1") {
        g.rect(x0 + x * 2, y0 + y * 2, 2, 2, col);
      }
    });
  });
  g.rect(x0 + 2, y0 + 2, 2, 2, hi);
}

// Stamp rows at (x0, y0), every ch pixel in col.
function stampRows(g: Grid, x0: number, y0: number, rows: Rows, ch: string, col: string): void {
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === ch) {
        g.p(x0 + x, y0 + y, col);
      }
    });
  });
}

// ---------- the emblems ----------

// Toronto's skyline round the CN Tower: a grey needle with its pod and a red light, and either side
// blocks in the neighbourhoods' colours (Kensington's lilac, Cabbagetown's brick, the Distillery's
// ochre, the Beaches' sky), amber-lit, on a strip of High Park green.
function wholeCity(g: Grid): void {
  const blocks = [
    [7, 17, 4, "lilac", "violet"],
    [11, 13, 4, "brick", "dbrick"],
    [19, 15, 4, "ochre", "rust"],
    [23, 18, 3, "sky", "blue"],
  ] as const;
  for (const [x, top, w, fill, shade] of blocks) {
    g.rect(x, top, w, 24 - top, fill);
    g.rect(x + w - 1, top, 1, 24 - top, shade);
    for (let wy = top + 2; wy < 23; wy += 3) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        g.p(wx, wy, "yellow");
      }
    }
  }
  g.rect(15, 8, 2, 16, "lgrey");
  g.rect(16, 8, 1, 16, "grey");
  g.rect(15, 6, 1, 2, "grey");
  g.p(15, 5, "red");
  g.rect(13, 11, 6, 2, "lgrey");
  g.rect(13, 12, 6, 1, "grey");
  g.rect(14, 10, 4, 1, "white");
  g.rect(6, 24, 20, 2, "green");
  g.rect(6, 25, 20, 1, "dgreen");
}

// A loop arrow running clockwise round a house.
function roundTrip(g: Grid): void {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - 16;
      const dy = y + 0.5 - 16.5;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) * (180 / Math.PI);
      if (r >= 5.4 && r <= 8 && !(a >= -80 && a <= -20)) {
        g.p(x, y, r > 6.9 && dx + dy > 0 ? "blue" : "sky");
      }
    }
  }
  const a = radians(-80);
  const px = 16 + 6.7 * Math.cos(a);
  const py = 16.5 + 6.7 * Math.sin(a);
  const t = [-Math.sin(a), Math.cos(a)] as const;
  const n = [Math.cos(a), Math.sin(a)] as const;
  g.tri(
    [px + 4.5 * t[0], py + 4.5 * t[1]],
    [px + 3.8 * n[0], py + 3.8 * n[1]],
    [px - 3.8 * n[0], py - 3.8 * n[1]],
    "sky",
  );
  g.tri([12, 16.5], [20, 16.5], [16, 12.5], "red");
  g.rect(13, 16, 6, 4, "brown");
  g.rect(15, 17, 2, 3, "plum");
}

// A dog's head face on, floppy ears beside its muzzle: F fur, E ears, M muzzle, N nose, I eyes.
const DOG_FACE: Rows = [
  "..FFFFFF..",
  ".FFFFFFFF.",
  "EEFFFFFFEE",
  "EEFIFFIFEE",
  "EEFIFFIFEE",
  "EEFMMMMFEE",
  "EE.MNNM.EE",
  "E..MMMM..E",
  "....MM....",
];

// Two dogs' heads side by side, each in its collar.
function doubleLeash(g: Grid): void {
  for (const [x0, y0, fur, ears, muzzle, collar] of [
    [5, 9, "ochre", "dbrown", "white", "red"],
    [16, 12, "white", "ink", "lgrey", "sky"],
  ] as const) {
    bitmap(g, x0, y0, DOG_FACE, { E: ears, F: fur, I: "ink", M: muzzle, N: "ink" });
    g.rect(x0 + 3, y0 + 9, 4, 1, collar);
  }
}

// One red leash handle splitting into three leashes, each ending in an lgrey clip.
function packLeader(g: Grid): void {
  g.ell(16, 8.5, 4.5, 3, "red", "dred");
  g.ell(16, 8.5, 2.5, 1.2, null);
  g.rect(15, 11, 2, 4, "red");
  for (const x1 of [9, 16, 23]) {
    line(g, [x1 < 16 ? 15.5 : x1 > 16 ? 16.5 : 16, 14], [x1, 20], "red");
    g.ell(x1 + 0.5, 22.5, 2, 2.5, "lgrey", "grey");
    g.ell(x1 + 0.5, 22.5, 0.9, 1.3, null);
  }
}

// A bar of soap under three bubbles.
function cleanPaws(g: Grid): void {
  g.rect(8, 16, 15, 7, "pink");
  g.rect(9, 15, 13, 1, "pink");
  g.rect(9, 23, 13, 1, "mauve");
  g.rect(22, 17, 1, 6, "mauve");
  g.rect(10, 17, 6, 1, "white");
  g.p(10, 18, "white");
  ring(g, 20, 10, 3.5, "sky", "white");
  ring(g, 12, 10, 2.5, "sky", "white");
  ring(g, 25, 15, 2, "sky");
}

// A shield with a tick.
function notAScratch(g: Grid): void {
  for (let y = 0; y < 15; y++) {
    const w = y < 8 ? 6 : Math.round(6 - ((y - 7) * 6) / 7.5);
    g.rect(16 - w, 8 + y, w, 1, "sky");
    g.rect(16, 8 + y, w + (y < 8 ? 1 : 0), 1, "blue");
  }
  line(g, [12, 15], [14.5, 18], "white", 2);
  line(g, [14.5, 18], [20, 12], "white", 2);
}

const STAR: Rows = ["..xx..", "..xx..", "xxxxxx", ".xxxx.", ".xxxx.", "xx..xx"];

// Five stars, three over two.
function fiveStarService(g: Grid): void {
  for (const [x0, y0] of [
    [6, 9],
    [13, 8],
    [20, 9],
    [9, 17],
    [17, 17],
  ] as const) {
    bitmap(g, x0, y0, STAR, { x: "yellow" });
    g.rect(x0 + 2, y0 + 4, 3, 1, "amber");
  }
}

// A 3x7 $ for a coin too small for Big Payday's.
const DOLLAR_S: Rows = [".1.", "111", "1..", "111", "..1", "111", ".1."];

// A white pay envelope, its back flap open behind one gold coin tucked into it, the mouth a dbrown
// slit and the front's folds meeting below it: one coin to Big Payday's three.
function payday(g: Grid): void {
  g.tri([7, 15], [25, 15], [16, 6], "lgrey");
  g.tri([9, 15], [23, 15], [16, 8], "white");
  g.ell(16, 11, 5.5, 5.5, "orange", "rust");
  g.ell(16, 11, 3.5, 3.5, "amber", "orange", "yellow");
  bitmap(g, 14, 8, DOLLAR_S, { 1: "dbrown" });
  g.p(14.5, 9.5, "white");
  g.rect(7, 16, 18, 9, "white");
  g.rect(7, 15, 18, 1, "dbrown");
  g.rect(7, 24, 18, 1, "lgrey");
  g.rect(24, 16, 1, 9, "lgrey");
  line(g, [7, 16], [15, 21], "lgrey");
  line(g, [24, 16], [16, 21], "lgrey");
}

// Three gold coins, the middle one big with a dbrown $.
function bigPayday(g: Grid): void {
  for (const [cx, cy] of [
    [9, 21],
    [23, 21],
  ] as const) {
    g.ell(cx, cy, 3.5, 3.5, "amber", "orange", "yellow");
  }
  g.ell(16, 15, 8, 8, "orange", "rust");
  g.ell(16, 15, 6, 6, "amber", "orange", "yellow");
  stampRows(
    g,
    14,
    12,
    ["..1..", ".1111", "1.1..", ".111.", "..1.1", "1111.", "..1.."],
    "1",
    "dbrown",
  );
  g.p(12, 11, "white");
}

// A paw print for a street sign's blade and the front door: P pad, T toe.
const SIGN_PAW: Rows = [".T.T.T.", ".......", "..PPP..", ".PPPPP.", ".PPPPP."];

// The front door in its dbrown frame, its transom lit gold, a white paw on its blue panel and an
// amber knob.
function everybodyHome(g: Grid): void {
  g.rect(10, 6, 12, 20, "dbrown");
  g.rect(11, 7, 10, 3, "gold");
  g.rect(11, 10, 10, 1, "dbrown");
  g.rect(11, 11, 10, 15, "blue");
  g.rect(11, 11, 1, 15, "sky");
  bitmap(g, 12, 14, SIGN_PAW, { P: "white", T: "white" });
  g.rect(18, 19, 2, 2, "amber");
}

// A cracked heart breaking a sweat.
function closeShave(g: Grid): void {
  heart(g, 7, 10);
  for (const [a, b] of [
    [
      [15, 10],
      [14, 13],
    ],
    [
      [14, 13],
      [17, 16],
    ],
    [
      [17, 16],
      [15, 19],
    ],
    [
      [15, 19],
      [16, 21],
    ],
  ] as const) {
    line(g, a, b, "plum");
  }
  bitmap(g, 22, 5, ["..c..", ".ccc.", "cwccc", "ccccs", ".css."], {
    c: "cyan",
    s: "sky",
    w: "white",
  });
}

// A dog side on, stretched mid-leap, forelegs reaching and hind legs pushing off: B body, L legs, E
// ear, N nose, I eye, T tail.
const LEAPER: Rows = [
  "............EE....",
  "T..........EBBBB..",
  "TT.........BIBBBN.",
  ".TBBBBBBBBBBBB....",
  "..BBBBBBBBBBB.....",
  "..LBBBBBBBBLL.....",
  ".LL........LLL....",
  "LL...........LL...",
];

// A dog mid-leap over a traffic cone, its jump's arc dotted behind it.
function dodgeBall(g: Grid): void {
  g.tri([16, 15], [11.5, 24.5], [20.5, 24.5], "orange");
  g.rect(13, 19, 6, 2, "white");
  g.rect(10, 24, 12, 2, "rust");
  bitmap(g, 7, 6, LEAPER, { B: "white", E: "ink", I: "ink", L: "lgrey", N: "ink", T: "white" });
  for (const [x, y] of [
    [6, 21],
    [6, 18],
    [7, 15],
  ] as const) {
    g.p(x, y, "sky");
  }
}

// A red-roofed kennel with a plum doorway.
function fullKennel(g: Grid): void {
  g.tri([8, 15], [24, 15], [16, 7], "red");
  g.rect(10, 15, 12, 9, "tan");
  g.rect(13, 17, 6, 7, "plum");
  g.rect(13, 16, 6, 1, "plum");
}

// The fanny pack alone, drops.ts's fannyPack at 1.4x: a pocket for everything.
function kittedOut(g: Grid): void {
  const m = new Mini(1.4, 16, 16);
  fannyPack(m);
  m.px.forEach((row, y) => {
    row.forEach((c, x) => {
      if (c) {
        g.px[y + 9]![x + 5] = c;
      }
    });
  });
}

// A smiling yellow face with pink cheeks.
function localFavourite(g: Grid): void {
  g.ell(16, 16, 7, 7, "yellow", "amber");
  g.rect(13, 13, 1, 2, "plum");
  g.rect(18, 13, 1, 2, "plum");
  g.p(12, 18, "plum");
  g.p(19, 18, "plum");
  g.rect(13, 19, 6, 1, "plum");
  g.p(11, 16, "pink");
  g.p(20, 16, "pink");
}

// A flame, yellow at its heart.
function youreFired(g: Grid): void {
  g.ell(16, 19, 6, 6, "orange", "rust");
  g.tri([10, 19], [14, 6], [17, 15], "orange");
  g.tri([22, 19], [19, 8], [15, 15], "orange");
  g.ell(16, 20, 3.5, 4, "yellow", "amber");
  g.tri([13, 20], [16, 11], [19, 20], "yellow");
}

// A green cloud under three forest wavy stink lines.
function eauDeSkunk(g: Grid): void {
  for (const [cx, cy, r] of [
    [12, 19, 4],
    [18, 18, 5],
    [15, 15, 4],
  ] as const) {
    g.ell(cx, cy, r, r * 0.85, "green", "dgreen");
  }
  for (const x of [10, 16, 22]) {
    for (let k = 0; k < 5; k++) {
      g.p(x + (k % 2), 6 + k, "forest");
    }
  }
}

// Muddy paw prints walking out of a puddle.
function mudSeason(g: Grid): void {
  g.ell(13, 22, 7, 3, "brown", "dbrown");
  for (const [cx, cy] of [
    [12, 15],
    [21, 11],
  ] as const) {
    stampRows(g, cx - 4, cy - 4, PAW_PRINT, "x", "dbrown");
  }
}

// A dog side on at full stretch, ears streaming back: B body, S belly and legs, E ear, N nose, I eye,
// T tail.
const RUNNER: Rows = [
  "...........EEB...",
  "..........EBBIB..",
  "T.........BBBBBBN",
  "TBBBBBBBBBBBBBB..",
  ".BBBBBBBBBBBB....",
  "..SSSSSSSSSS.....",
  ".SS........SS....",
  "SS..........SS...",
];

// A dog at full stretch, speed lines and a dust puff behind it.
function zoomies(g: Grid): void {
  bitmap(g, 9, 10, RUNNER, {
    B: "brown",
    E: "dbrown",
    I: "ink",
    N: "ink",
    S: "dbrown",
    T: "brown",
  });
  for (const [y, x0] of [
    [11, 5],
    [14, 4],
    [17, 5],
  ] as const) {
    g.rect(x0, y, 4, 1, "sky");
  }
  g.ell(9, 21.5, 2.5, 2, "white", "lgrey");
  g.ell(6, 20.5, 1.5, 1.5, "white", "lgrey");
}

// Toronto's black squirrel in road.ts's SQUIRREL_FUR, its tail up behind it, a white glint for its
// eye.
function squirrel(g: Grid): void {
  const f = SQUIRREL_FUR;
  g.ell(20, 13, 4.5, 6, f.fur, f.shade, f.lit);
  g.ell(13, 18, 4, 4.5, f.fur, f.shade);
  g.ell(13, 13, 3, 2.5, f.fur, f.shade);
  g.p(11, 10, f.fur);
  g.p(12, 13, "white");
  g.p(14, 10, f.fur);
  g.ell(13, 20, 2, 2, f.belly);
}

// An open hand reaching down out of a striped sleeve: N and W the sleeve's stripes, H skin, h the
// gaps between the fingers.
const GRAB: Rows = [
  "..NWNWNW..",
  "..NWNWNW..",
  "..NWNWNW..",
  "..HHHHHH..",
  ".HHHHHHHH.",
  "HHHHHHHHHH",
  "HH.HhHhHhH",
  "H..HhHhHhH",
  "...HhHhHhH",
  "...H.H.H.H",
];

// A thief's hand swooping on a tip coin.
function yoink(g: Grid): void {
  bitmap(g, 11, 6, GRAB, { H: "skin1", N: "navy", W: "white", h: "skin2" });
  g.ell(16, 21.5, 4.5, 4.5, "amber", "orange", "yellow");
  g.rect(16, 19, 1, 5, "dbrown");
  g.p(14, 19, "white");
}

// A dog's head side on, its nose to the right: F fur, E ear, M muzzle, N nose, I eye.
const SNIFFER: Rows = [
  "..FFFF.....",
  ".FFFFFF....",
  "EEFFFIFF...",
  "EEFFFFFFFNN",
  "EEEFFFFFFNN",
  "EEEFFFFFFF.",
  ".EEFFFFMM..",
  "..FFFF.....",
  "..FFFF.....",
];

// Two dogs' noses meeting, sniff marks above them.
function sniffTest(g: Grid): void {
  bitmap(g, 5, 11, SNIFFER, { E: "dbrown", F: "ochre", I: "ink", M: "white", N: "ink" });
  bitmap(g, 16, 11, SNIFFER, { E: "ink", F: "white", I: "ink", M: "lgrey", N: "ink" }, true);
  for (const [x, y] of [
    [13, 8],
    [16, 6],
    [19, 8],
  ] as const) {
    g.rect(x, y, 1, 2, "sky");
    g.p(x + 1, y - 1, "sky");
  }
}

const BONE: Rows = [
  "xx......xx",
  "xxx....xxx",
  ".xxxxxxxx.",
  ".xxxxxxxx.",
  "xxx....xxx",
  "xx......xx",
];
// The red heart on each bone's shaft, as the treat pickup carries it, its tip below the shaft: r red,
// d dred.
const BONE_HEART: Rows = ["r.r", "rrd", ".d."];

// A pile of the treat pickup's white bones, each with its red heart.
function snackAttack(g: Grid): void {
  for (const [x0, y0] of [
    [6, 18],
    [16, 18],
    [11, 11],
  ] as const) {
    bitmap(g, x0, y0, BONE, { x: "white" });
    BONE.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "x" && (y === BONE.length - 1 || BONE[y + 1]![x] !== "x")) {
          g.p(x0 + x, y0 + y, "lgrey");
        }
      });
    });
    bitmap(g, x0 + 4, y0 + 2, BONE_HEART, { d: "dred", r: "red" });
  }
}

// ---------- the second set of badges ----------

// Three-row-tall digits for a number on a badge: 3x5 each, 4 apart.
const DIGITS: Readonly<Record<string, Rows>> = {
  0: ["111", "1.1", "1.1", "1.1", "111"],
  1: [".1.", "11.", ".1.", ".1.", "111"],
};

// text in DIGITS from (x, y), col.
function digits(g: Grid, x: number, y: number, text: string, col: string): void {
  let at = x;
  for (const ch of text) {
    bitmap(g, at, y, DIGITS[ch]!, { 1: col });
    at += 4;
  }
}

// A 3x3 plus-shaped dizzy star with an amber centre.
function dizzyStar(g: Grid, cx: number, cy: number, col = "yellow"): void {
  g.rect(cx - 1, cy, 3, 1, col);
  g.rect(cx, cy - 1, 1, 3, col);
  g.p(cx, cy, "amber");
}

// Hearts by width, 9, 7 and 5 wide.
const H9: Rows = [
  ".xxx.xxx.",
  "xxxxxxxxx",
  "xxxxxxxxx",
  "xxxxxxxxx",
  ".xxxxxxx.",
  "..xxxxx..",
  "...xxx...",
  "....x....",
];
const H7: Rows = [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."];
const H5: Rows = ["xx.xx", "xxxxx", "xxxxx", ".xxx.", "..x.."];
// An open palm, fingers up, thumb out to the right.
const PALM: Rows = [
  "1.1.1..",
  "1.1.1..",
  "1.1.1.1",
  "11111.1",
  "1111111",
  "111111.",
  ".1111..",
  ".111...",
];

// A thick wad of green banknotes bound by a red paper band, a white $ on the top note.
function twentyGrand(g: Grid): void {
  for (let i = 0; i < 4; i++) {
    g.rect(7, 16 + i * 2, 18, 2, i % 2 ? "dgreen" : "green");
  }
  g.rect(7, 10, 18, 6, "green");
  g.rect(7, 10, 18, 1, "lgrey");
  g.rect(15, 10, 4, 14, "red");
  g.rect(15, 10, 1, 14, "pink");
  bitmap(g, 9, 10, [".1.", "111", "1..", "111", "..1", "111", ".1."], { 1: "white" });
}

// A glass jar with a slot in its dslate lid, loose gold coins piled inside.
function tipJar(g: Grid): void {
  g.rect(10, 9, 12, 3, "dslate");
  g.rect(13, 9, 6, 1, "ink");
  g.rect(9, 12, 14, 13, "lgrey");
  g.rect(10, 13, 12, 11, "white");
  for (const [cx, cy] of [
    [12.5, 22.5],
    [16, 22.5],
    [19.5, 22.5],
    [14, 20],
    [18, 20],
    [16, 17.5],
  ] as const) {
    g.ell(cx, cy, 2.2, 1.6, "amber", "orange", "yellow");
  }
  g.rect(11, 14, 1, 3, "lgrey");
}

// A Toronto street sign named for you: a blue blade with a white rule and a white paw, under its
// ornamental cap, on a slate pole.
function legendOfTheLeash(g: Grid): void {
  g.rect(15, 17, 2, 10, "slate");
  g.rect(16, 17, 1, 10, "dslate");
  g.rect(12, 26, 8, 1, "dslate");
  g.rect(5, 9, 22, 9, "navy");
  g.rect(6, 10, 20, 7, "blue");
  g.rect(6, 16, 20, 1, "white");
  bitmap(g, 13, 10, SIGN_PAW, { P: "white", T: "white" });
  // the cap: a stepped crest over the blade's middle, as Toronto's signs have
  g.rect(11, 7, 10, 2, "navy");
  g.rect(14, 6, 4, 1, "navy");
  g.rect(15, 7, 2, 1, "sky");
}

// A white race bib pinned at its corners, a red 100 on it.
function marathon(g: Grid): void {
  g.rect(7, 9, 18, 14, "white");
  g.rect(7, 22, 18, 1, "lgrey");
  for (const [x, y] of [
    [8, 10],
    [23, 10],
    [8, 21],
    [23, 21],
  ] as const) {
    g.p(x, y, "grey");
  }
  digits(g, 10, 13, "100", "red");
}

// A high five: two open palms meeting, one skin1 and one skin2, a yellow flash where they slap.
function tagTeam(g: Grid): void {
  bitmap(g, 9, 10, PALM, { 1: "skin1" });
  bitmap(
    g,
    16,
    10,
    PALM.map((r) => [...r].reverse().join("")),
    { 1: "skin2" },
  );
  g.rect(9, 18, 4, 4, "sky");
  g.rect(19, 18, 4, 4, "green");
  for (const [x, y] of [
    [16, 4],
    [16, 5],
    [13, 6],
    [19, 6],
    [16, 8],
    [12, 8],
    [20, 8],
  ] as const) {
    g.p(x, y, "yellow");
  }
}

// A grey pigeon side on, facing left, with three yellow dizzy stars circling its head.
function birdBrain(g: Grid): void {
  g.ell(18, 19, 7, 4.6, "grey", "slate", "lgrey");
  g.rect(23, 17, 4, 3, "slate");
  g.rect(13, 15, 4, 4, "teal");
  g.ell(12, 13, 3.4, 3.2, "grey", null, "lgrey");
  g.p(11, 12, "ink");
  g.tri([8.6, 13.4], [9.6, 12], [9.6, 14.6], "orange");
  g.rect(16, 18, 6, 1, "slate");
  g.rect(17, 20, 5, 1, "slate");
  for (const x of [16, 19]) {
    g.rect(x, 23, 1, 3, "pink");
  }
  for (const [x, y] of [
    [7, 8],
    [12, 6],
    [17, 8],
  ] as const) {
    dizzyStar(g, x, y);
  }
}

// A small red car side on, facing left, its front bumper crumpled in a zigzag, an amber impact mark
// beside it.
function fenderBender(g: Grid): void {
  g.rect(11, 11, 9, 5, "red");
  g.rect(12, 12, 3, 3, "sky");
  g.rect(16, 12, 3, 3, "sky");
  g.rect(9, 15, 17, 6, "red");
  g.rect(9, 20, 17, 1, "dred");
  g.rect(24, 16, 2, 2, "amber");
  for (const [y, x] of [
    [15, 9],
    [16, 8],
    [17, 9],
    [18, 8],
    [19, 9],
    [20, 8],
  ] as const) {
    g.p(x, y, "lgrey");
  }
  g.ell(13, 21.5, 2.4, 2.4, "ink");
  g.ell(22, 21.5, 2.4, 2.4, "ink");
  g.p(13, 21, "grey");
  g.p(22, 21, "grey");
  for (const [a, b] of [
    [
      [6, 13],
      [4, 11],
    ],
    [
      [6, 17],
      [4, 17],
    ],
    [
      [6, 21],
      [4, 23],
    ],
  ] as const) {
    line(g, a, b, "amber");
  }
}

// A raccoon's face front on: grey head, round dark ears, a black eye mask with white brows and eyes,
// a white muzzle and an ink nose.
function trashPanda(g: Grid): void {
  g.ell(9.5, 9.5, 3, 3, "slate");
  g.ell(22.5, 9.5, 3, 3, "slate");
  g.ell(9.5, 9.5, 1.4, 1.4, "pink");
  g.ell(22.5, 9.5, 1.4, 1.4, "pink");
  g.ell(16, 16, 9, 7.5, "grey", "slate", "lgrey");
  g.rect(9, 12, 14, 1, "white");
  g.ell(11.5, 15.5, 3.4, 2.4, "ink");
  g.ell(20.5, 15.5, 3.4, 2.4, "ink");
  g.rect(12, 14, 8, 3, "ink");
  g.p(11, 15, "white");
  g.p(20, 15, "white");
  g.ell(16, 20.5, 4.5, 3, "white");
  g.ell(16, 18.8, 1.6, 1.1, "ink");
}

// A thick wooden arch bridge, lit tan along its top, a small flame burning on its crown.
function burnedBridges(g: Grid): void {
  for (let x = 6; x < 27; x++) {
    const u = (x + 0.5 - 16) / 10.5;
    const top = Math.round(23 - 7 * Math.sqrt(Math.max(0, 1 - u * u)));
    g.rect(x, top, 1, 5, "brown");
    g.p(x, top, "tan");
    g.p(x, top + 4, "dbrown");
  }
  for (const x of [6, 7, 25, 26]) {
    g.rect(x, 23, 1, 3, "dbrown");
  }
  g.ell(16, 13.5, 3.2, 3, "orange");
  g.tri([16, 7], [13, 13], [19, 13], "orange");
  g.ell(16, 14, 1.8, 1.8, "yellow");
  g.tri([16, 10], [14.5, 14], [17.5, 14], "yellow");
}

// The lost wallet as the road draws it: a green bill with a white $ standing up out of a brown wallet
// whose flap tab carries an amber snap.
function findersKeepers(g: Grid): void {
  g.rect(10, 6, 12, 10, "green");
  g.rect(10, 6, 12, 1, "lgrey");
  bitmap(g, 15, 7, [".x.", "xxx", "x..", "xxx", "..x", "xxx", ".x."], { x: "white" });
  g.rect(6, 14, 20, 11, "brown");
  g.rect(6, 14, 20, 1, "tan");
  g.rect(6, 24, 20, 1, "dbrown");
  g.rect(25, 14, 1, 11, "dbrown");
  g.rect(17, 17, 9, 5, "dbrown");
  g.rect(21, 19, 3, 1, "amber");
}

// Three whole hearts floating up from big to small, the way the friendly neighbour's hearts rise:
// red, red and pink, each with a white glint.
function popularPack(g: Grid): void {
  for (const [x0, y0, rows] of [
    [6, 14, H9],
    [17, 10, H7],
    [11, 6, H5],
  ] as const) {
    bitmap(g, x0, y0, rows, { x: rows === H5 ? "pink" : "red" });
    g.p(x0 + 1, y0 + 1, "white");
  }
}

// ---------- the card choices and the Spotlight ----------

// The stage lamp at the Spotlight's upper left, aimed down and right: d its dslate can, s slate light
// on it, g its grey rim and yoke, w the white lens.
const LAMP: Rows = [
  "...g.......",
  "..gsdd.....",
  ".gssddd....",
  "gssdddddd..",
  ".sddddddd..",
  "..dddddgw..",
  "...ddddgww.",
  "....dgwww..",
  ".....gww...",
];
// A camera flash, 5x5.
const SPARK: Rows = ["..w..", ".wyw.", "wyyyw", ".wyw.", "..w.."];

// The Spotlight debuff's stage lamp at the upper left, throwing one wide yellow beam down and right,
// gold along its middle.
function paparazzi(g: Grid): void {
  g.tri([12, 15], [15, 12], [27, 18], "yellow");
  g.tri([12, 15], [27, 18], [18, 27], "yellow");
  g.tri([13, 15], [15, 13], [24, 22], "gold");
  bitmap(g, 6, 6, LAMP, { d: "dslate", g: "grey", s: "slate", w: "white" });
}

// The escaped capybara side on, facing right, its blunt snout and small ear under its keeper's khaki
// safari hat.
function zookeeper(g: Grid): void {
  g.ell(13, 19, 7.5, 5, "brown", "dbrown", "tan");
  g.rect(18, 13, 6, 8, "brown");
  g.rect(23, 14, 3, 6, "brown");
  g.rect(18, 20, 8, 1, "dbrown");
  g.rect(25, 15, 1, 2, "dbrown");
  g.p(24, 18, "plum");
  g.p(21, 15, "ink");
  g.rect(17, 12, 2, 2, "dbrown");
  for (const x of [8, 11, 15, 18]) {
    g.rect(x, 22, 2, 3, "dbrown");
  }
  g.rect(16, 11, 10, 1, "ochre");
  g.rect(18, 8, 6, 3, "ochre");
  g.rect(18, 8, 6, 1, "tan");
  g.rect(18, 10, 6, 1, "dbrown");
}

// The wedding photographer's camera face on, its flash popping, the bride's red and pink bouquet in
// its white ribbon before it.
function sayCheese(g: Grid): void {
  g.rect(15, 10, 5, 2, "slate");
  g.rect(10, 12, 16, 10, "dslate");
  g.rect(10, 12, 16, 1, "slate");
  g.rect(10, 21, 16, 1, "navy");
  g.rect(21, 10, 3, 2, "lgrey");
  g.ell(18, 16.5, 4.5, 4.5, "lgrey", "grey", "white");
  g.ell(18, 16.5, 3, 3, "ink");
  g.ell(18, 16.5, 1.6, 1.6, "blue");
  g.p(17, 15, "white");
  bitmap(g, 20, 5, SPARK, { w: "white", y: "yellow" });
  for (const [x, y] of [
    [9, 23],
    [11, 23],
    [10, 24],
  ] as const) {
    g.rect(x, y, 1, 2, "dgreen");
  }
  g.rect(9, 22, 3, 1, "white");
  for (const [cx, cy, col] of [
    [8.5, 19.5, "red"],
    [12.5, 19.5, "pink"],
    [10.5, 18, "pink"],
    [10.5, 21, "red"],
  ] as const) {
    g.ell(cx, cy, 1.8, 1.8, col);
  }
}

// An upright ice cream cone, its waffle an ochre cone crossed by rust lines 4px apart, its pink scoop
// lit white with one drip down the waffle.
function sugarRush(g: Grid): void {
  const cone = new Grid(32, 32);
  cone.tri([11, 15], [21, 15], [16, 27], "ochre");
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (cone.px[y]![x]) {
        g.p(x, y, (x + y) % 4 === 0 || (x - y) % 4 === 0 ? "rust" : "ochre");
      }
    }
  }
  g.ell(16, 11.5, 6, 5, "pink", "mauve", "white");
  g.rect(11, 15, 10, 1, "pink");
  g.rect(13, 16, 2, 3, "pink");
}

// The porch cat's fish treat: b brown, d its dbrown eye and tail edge.
const TREAT: Rows = [".bbbb.d", "bdbbbbd", ".bbbb.d"];

// The porch cat's calico face front on, an orange patch and an ink patch over its white, a little
// heart above it and a brown fish treat under its chin.
function catWhisperer(g: Grid): void {
  g.tri([7, 16], [8, 8], [13, 12], "orange");
  g.tri([16, 12], [21, 8], [22, 16], "ink");
  g.tri([8.5, 14], [9, 10.5], [11.5, 12.5], "pink");
  g.ell(14.5, 17.5, 8, 6, "white", "lgrey");
  g.ell(10, 14.5, 3.5, 2.5, "orange");
  g.ell(19.5, 14.5, 3, 2.2, "ink");
  g.rect(10, 16, 2, 2, "green");
  g.rect(17, 16, 2, 2, "green");
  g.p(11, 16, "ink");
  g.p(18, 16, "ink");
  g.p(14, 19, "pink");
  g.p(13, 20, "plum");
  g.p(15, 20, "plum");
  bitmap(g, 12, 6, H5, { x: "red" });
  g.p(13, 7, "white");
  bitmap(g, 12, 23, TREAT, { b: "brown", d: "dbrown" });
}

// A dog's paw raised to wave: F fur, P a pink pad.
const WAVE_PAW: Rows = [
  ".P.P.P.",
  "PFPFPFP",
  "FFFFFFF",
  "FFPPPFF",
  "FPPPPPF",
  ".FPPPF.",
  "..FFF..",
  "..FFF..",
  "..FFF..",
];

// The promo's big screen on its post, bulbs along the top, a dog's paw on it waving between yellow
// wave marks.
function bigScreen(g: Grid): void {
  g.rect(15, 21, 3, 4, "slate");
  g.rect(12, 25, 9, 1, "dslate");
  g.rect(8, 8, 17, 14, "ink");
  g.rect(9, 10, 15, 11, "blue");
  g.rect(9, 10, 15, 4, "sky");
  for (let x = 9; x < 24; x += 2) {
    g.p(x, 8, "yellow");
  }
  bitmap(g, 13, 11, WAVE_PAW, { F: "ochre", P: "pink" });
  for (const [x, y] of [
    [11, 12],
    [10, 13],
    [10, 14],
    [11, 15],
    [21, 12],
    [22, 13],
    [22, 14],
    [21, 15],
  ] as const) {
    g.p(x, y, "yellow");
  }
}

// A Toronto green bin standing upright with its lid shut: a dgreen cart lit green down its left and
// shaded forest on its right, tapering to two dslate wheels, its lid overhanging the top with a grip
// at the front and an lgrey latch below it.
function cleanStreets(g: Grid): void {
  g.rect(9, 8, 14, 3, "green");
  g.rect(9, 10, 14, 1, "dgreen");
  g.rect(10, 7, 12, 1, "green");
  g.rect(14, 11, 4, 1, "forest");
  for (let y = 11; y < 24; y++) {
    const inset = Math.floor((y - 11) / 6);
    g.rect(10 + inset, y, 12 - 2 * inset, 1, "dgreen");
    g.p(10 + inset, y, "green");
    g.rect(20 - inset, y, 2, 1, "forest");
  }
  g.rect(15, 12, 2, 3, "lgrey");
  g.rect(11, 23, 3, 3, "dslate");
  g.rect(18, 23, 3, 3, "dslate");
}

// Each badge's emblem, by achievement.
const ICONS: ReadonlyMap<string, Draw> = new Map([
  ["big-payday", bigPayday],
  ["big-screen", bigScreen],
  ["bird-brain", birdBrain],
  ["burned-bridges", burnedBridges],
  ["cat-whisperer", catWhisperer],
  ["clean-paws", cleanPaws],
  ["clean-streets", cleanStreets],
  ["close-shave", closeShave],
  ["dodge-ball", dodgeBall],
  ["double-leash", doubleLeash],
  ["eau-de-skunk", eauDeSkunk],
  ["everybody-home", everybodyHome],
  ["fender-bender", fenderBender],
  ["finders-keepers", findersKeepers],
  ["five-star-service", fiveStarService],
  ["full-kennel", fullKennel],
  ["kitted-out", kittedOut],
  ["legend-of-the-leash", legendOfTheLeash],
  ["local-favourite", localFavourite],
  ["marathon", marathon],
  ["mud-season", mudSeason],
  ["not-a-scratch", notAScratch],
  ["pack-leader", packLeader],
  ["paparazzi", paparazzi],
  ["payday", payday],
  ["popular-pack", popularPack],
  ["round-trip", roundTrip],
  ["say-cheese", sayCheese],
  ["snack-attack", snackAttack],
  ["sniff-test", sniffTest],
  ["squirrel", squirrel],
  ["sugar-rush", sugarRush],
  ["tag-team", tagTeam],
  ["tip-jar", tipJar],
  ["trash-panda", trashPanda],
  ["twenty-grand", twentyGrand],
  ["whole-city", wholeCity],
  ["yoink", yoink],
  ["youre-fired", youreFired],
  ["zookeeper", zookeeper],
  ["zoomies", zoomies],
]);

// Each badge's category, in build order.
export const BADGES: ReadonlyMap<string, string> = new Map([
  ["double-leash", "firsts"],
  ["pack-leader", "firsts"],
  ["round-trip", "firsts"],
  ["legend-of-the-leash", "legend"],
  ["big-payday", "mastery"],
  ["clean-paws", "mastery"],
  ["dodge-ball", "mastery"],
  ["everybody-home", "mastery"],
  ["five-star-service", "mastery"],
  ["marathon", "mastery"],
  ["not-a-scratch", "mastery"],
  ["payday", "mastery"],
  ["tip-jar", "mastery"],
  ["twenty-grand", "mastery"],
  ["full-kennel", "collection"],
  ["kitted-out", "collection"],
  ["local-favourite", "collection"],
  ["tag-team", "collection"],
  ["whole-city", "collection"],
  ["big-screen", "silly"],
  ["bird-brain", "silly"],
  ["burned-bridges", "silly"],
  ["cat-whisperer", "silly"],
  ["clean-streets", "silly"],
  ["close-shave", "silly"],
  ["eau-de-skunk", "silly"],
  ["fender-bender", "silly"],
  ["finders-keepers", "silly"],
  ["mud-season", "silly"],
  ["paparazzi", "silly"],
  ["popular-pack", "silly"],
  ["say-cheese", "silly"],
  ["snack-attack", "silly"],
  ["sniff-test", "silly"],
  ["squirrel", "silly"],
  ["sugar-rush", "silly"],
  ["trash-panda", "silly"],
  ["yoink", "silly"],
  ["youre-fired", "silly"],
  ["zookeeper", "silly"],
  ["zoomies", "silly"],
]);

// ---------- the medal ----------

// The medal's flat cream face, r 11, with a 1px tan crescent along its lower-right rim where the
// ring's lip shades it, so the emblem stands on one quiet colour.
function face(g: Grid): void {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (Math.hypot(x + 0.5 - 16, y + 0.5 - 16) <= 11) {
        g.p(x, y, Math.hypot(x + 1.5 - 16, y + 1.5 - 16) > 11 ? "tan" : "cream");
      }
    }
  }
}

const NEIGHBOURS: readonly Point[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

export function badge(name: string, locked = false): Grid {
  const category = BADGES.get(name)!;
  const [rim, rimSh, rimLi] = RIMS[category]!;
  const stud = STUDS[category] ?? rimSh;
  const g = new Grid(32, 32);
  // the ring's outline holds 3:1 on the badge wall's cream panel, its white and yellow lights included
  g.edge = iconEdge;
  g.ell(16, 16, 14.5, 14.5, rim, rimSh, rimLi);
  // twelve studs round the ring, the right and bottom ones held 1px inside its outer edge (column and
  // row 29) as the left and top ones are, so none breaks the rim
  for (let a = 0; a < 360; a += 30) {
    const [x, y] = [Math.cos, Math.sin].map((f) =>
      Math.min(Math.trunc(16 + f(radians(a)) * 13), 28),
    ) as [number, number];
    g.p(x, y, stud);
  }
  face(g);
  const disc = new Grid(32, 32);
  disc.ell(16, 16, 11, 11, "cream");
  const art = new Grid(32, 32);
  ICONS.get(name)!(art);
  const cell = (x: number, y: number): number => y * 32 + x;
  const iconPx = new Set<number>();
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (art.px[y]![x]) {
        iconPx.add(cell(x, y));
      }
    }
  }
  // the keyline: every face pixel beside an icon pixel that holds under 3:1 against it
  const keyline = new Set<number>();
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (
        disc.px[y]![x] &&
        !iconPx.has(cell(x, y)) &&
        NEIGHBOURS.some(
          ([dx, dy]) =>
            iconPx.has(cell(x + dx, y + dy)) &&
            contrast(art.px[y + dy]![x + dx]!, g.px[y]![x]!) < 3,
        )
      ) {
        keyline.add(cell(x, y));
      }
    }
  }
  for (const c of iconPx) {
    g.px[Math.floor(c / 32)]![c % 32] = art.px[Math.floor(c / 32)]![c % 32]!;
  }
  for (const c of keyline) {
    g.p(c % 32, Math.floor(c / 32), KEYLINES[name] ?? "plum");
  }
  if (locked) {
    // In the neutral greys, as locked UI is: the ring darkens to ndslate and the face to ngrey, so a
    // locked badge never reads as silver; the icon becomes a two-tone silhouette (dark lines in ink,
    // the rest ndslate, 3.56:1 on ngrey) so its goal still reads on the grey face. The padlock keeps
    // its colours.
    const ringTo = new Map([
      [K[rim]!, K.ndslate!],
      [K[rimSh]!, K.ink!],
      [K[rimLi]!, K.nslate!],
      [K[stud]!, K.ink!],
    ]);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const c = g.px[y]![x];
        if (!c) {
          continue;
        }
        if (iconPx.has(cell(x, y)) || keyline.has(cell(x, y))) {
          g.px[y]![x] = lum(c) < 90 ? K.ink! : K.ndslate!;
        } else if (disc.px[y]![x]) {
          g.px[y]![x] = K.ngrey!;
        } else {
          const to = ringTo.get(c);
          if (to === undefined) {
            throw new RangeError(`badge-${name}: no locked colour for ring pixel ${c}`);
          }
          g.px[y]![x] = to;
        }
      }
    }
    g.rect(20, 22, 8, 7, "amber");
    g.rect(20, 22, 8, 1, "yellow");
    g.rect(21, 18, 1, 4, "lgrey");
    g.rect(26, 18, 1, 4, "lgrey");
    g.rect(22, 17, 4, 1, "lgrey");
    g.rect(23, 24, 2, 3, "dbrown");
  }
  return g;
}

// ---------- the confetti ----------

// The confetti stream, by its name, so every build draws the same burst.
const CONFETTI_STREAM = "7";

// A number in lo..hi.
function uniform(rnd: Random, lo: number, hi: number): number {
  return lo + (hi - lo) * rnd();
}

const PIECE_COLOURS: readonly string[] = [
  "red",
  "amber",
  "green",
  "sky",
  "pink",
  "yellow",
  "white",
  "cyan",
  "orange",
  "mauve",
];

// A confetti piece's angle, reach, fall, drift, phase, last frame and colour.
type Piece = readonly [
  angle: number,
  reach: number,
  fall: number,
  drift: number,
  phase: number,
  last: number,
  colour: string,
];

// The confetti pieces. Angles are jittered off an even spread and reaches vary, so the burst fills
// the square unevenly.
const PIECES: readonly Piece[] = (() => {
  const rnd = randomStream(0, CONFETTI_STREAM);
  return Array.from({ length: 36 }, (_, i): Piece => {
    const angle = radians((i * 360) / 36 + uniform(rnd, -14, 14));
    const reach = uniform(rnd, 16, 38);
    const fall = uniform(rnd, 0.35, 0.7);
    const drift = uniform(rnd, -3, 3);
    const phase = randomInt(rnd, 0, 3);
    const last = randomInt(rnd, 6, 11);
    return [angle, reach, fall, drift, phase, last, PIECE_COLOURS[i % 10]!];
  });
})();
// A piece tumbles through these shapes, one per frame.
const TUMBLE: readonly Point[] = [
  [1, 2],
  [2, 1],
  [2, 2],
];

// 64x64: confetti thrown out from behind the badge, slowing, then falling and drifting, 10 frames.
// Each piece carries a 1px plum rim so the light colours hold on the cream end panel as well as the
// dark wood; a piece drawn later covers an earlier one, rim and all, so overlaps stay apart.
export function confetti(step: number): Grid {
  const g = new Grid(64, 64);
  for (const [a, reach, fall, drift, phase, last, col] of PIECES) {
    if (step > last) {
      continue;
    }
    // thrown fast and slowing, with a kick upward, then gravity takes over
    const r = reach * (1 - 0.55 ** (step + 1.2));
    const fx = 32 + Math.cos(a) * r + drift * Math.sin(step * 0.8 + phase) * Math.min(step / 3, 1);
    const fy = 32 + Math.sin(a) * r - 7 * (1 - 0.5 ** step) + fall * Math.max(step - 1, 0) ** 2;
    const [w, h] = TUMBLE[(step + phase) % 3]!;
    const x = Math.round(fx - w / 2);
    const y = Math.round(fy - h / 2);
    g.rect(x - 1, y, w + 2, h, "plum");
    g.rect(x, y - 1, w, h + 2, "plum");
    g.rect(x, y, w, h, col);
  }
  return g;
}

// One falling confetti bit's tumble, one shape per frame as cells of its 6x6 frame: face on (3x2),
// edge on (4x1), turning (a 3-step diagonal), edge on the other way (1x4).
const BIT_TUMBLE: readonly (readonly Point[])[] = [
  [
    [1, 2],
    [2, 2],
    [3, 2],
    [1, 3],
    [2, 3],
    [3, 3],
  ],
  [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
  ],
  [
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 2],
    [3, 3],
  ],
  [
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
  ],
];
const BIT_COLOURS: readonly string[] = ["amber", "cyan", "green", "pink", "white", "yellow"];

// 6x6: one bit of the zone celebration's falling confetti in col, frame step of its tumble, in the
// effects' 1px plum rim.
export function confettiBit(col: string, step: number): Grid {
  const g = new Grid(6, 6);
  const cells = BIT_TUMBLE[step]!;
  for (const [x, y] of cells) {
    g.p(x, y, col);
  }
  for (const [x, y] of cells) {
    for (const [dx, dy] of NEIGHBOURS) {
      if (!g.px[y + dy]![x + dx]) {
        g.p(x + dx, y + dy, "plum");
      }
    }
  }
  return g;
}

// ---------- build ----------

// Every sprite: [key, [[tag, frames, ms]]].
export function* sprites(): Generator<Sprite> {
  for (const name of BADGES.keys()) {
    yield [
      `badge-${name}`,
      [
        ["earned", [badge(name).outlined()], 1000],
        ["locked", [badge(name, true).outlined()], 1000],
      ],
    ];
  }
  yield [
    "fx-confetti",
    [["play", Array.from({ length: 10 }, (_, i) => confetti(i).outlined(false)), 80]],
  ];
  yield [
    "fx-confetti-bit",
    BIT_COLOURS.map((col) => [
      col,
      [0, 1, 2, 3].map((i) => confettiBit(col, i).outlined(false)),
      100,
    ]),
  ];
}

if (import.meta.main) {
  await main({
    doc: USAGE,
    grounds: ["733e39", "3a4466", "ead4aa"],
    sprites,
    srcDir: "art/badges",
  });
}
