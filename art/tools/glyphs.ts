// Draw the pull squirrel, the zone icons, a walker's perk icons, the debuff and effect icons, the walk
// bar's effect wells, the walk's message strip icons and a path card's difficulty paws.
//
// 16x16 images in the house palette with coloured outlines, on transparency:
// icon-trait-chaser           a black squirrel, in the pull bubble and on the message strip
// icon-perk-<perk>            a walker's perk, on walker tiles, the new walker celebration and
//                             the message strip: keen-eye (a magnifying glass over a treat),
//                             long-reach (an open hand over a green arrow pointing both ways),
//                             quick-recovery (an hourglass with its sand nearly run through),
//                             second-chance (a pink speech bubble with a red heart)
// icon-zone-<zone>            cabbagetown (a bay-and-gable house), high-park (a pine and a cherry
//                             in blossom), distillery-district (a brick warehouse),
//                             kensington-market (a painted house turned shop), the-beaches (the
//                             lifeguard station), yonge-street (the CN Tower); each inside a 1px
//                             ring for its outline, which holds 3:1 on cream and tan
// icon-muddy                  a blue water drop entering a broad brown mud splash
// icon-zoomies                a green paw rushing right with a yellow lightning tail
// icon-spotlight              a debuff's bar and message line: a stage spotlight at the top left
//                             throwing a yellow beam down onto its white-lit pool
// icon-upgrade-<upgrade>      the shop, the cards and the message strip: belly-rubs (a hand under a
//                             heart), big-tipper (coins and an up arrow), good-leash (a calm dog
//                             sitting politely), raincoats (a yellow raincoat), rush-hour (an alarm
//                             clock), sweet-talker (a speech bubble with $ and a down arrow)
// icon-gear-<gear>            the shop and the message strip: the shop's item art (icons.ts) at 16x16
// <key>-20                    each icon-perk-*, icon-upgrade-* and icon-gear-* drawn again at 20x20
//                             for the walk bar's 22x22 effect wells: the same subject and colours
// icon-badge, icon-bump,      the walk's message strip, beside its lines, on cream: badge (a red
// icon-fired, icon-hint,      ribbon rosette round a cream face with a gold centre, on two navy
// icon-lucky                  tails), bump (an amber impact burst), fired (a pink slip under a dred
//                             stamp), hint (a white i on a sky disc), lucky (a four-leaf clover with
//                             a twinkle)
// The upgrade and gear ids are the data ids in kebab case.
//
// Sprite: ui-difficulty (55x10; tags 1 to 5), a zone's difficulty under its name on a fork's path
// card: that many filled paws out of five, 11px apart. A filled paw is amber in a plum outline; a
// hollow one is a clay rim, 3.2:1 on the card's cream body, so all five slots show and the filled
// paws carry the count.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { burst, star4 } from "./fx.ts";
import {
  bitmap,
  build as buildSprites,
  type Colour,
  type Drawable,
  Grid,
  iconEdge,
  K,
  savePng,
  type Sprite,
  type Tag,
  toImage,
} from "./pixel.ts";
import { SQUIRREL_FUR } from "./road.ts";

const USAGE = `Usage:
  node art/tools/glyphs.ts preview OUT.png   every icon on the UI's paper, panel, wood and ink
                                             colours, then ui-difficulty's tags, scaled up
  node art/tools/glyphs.ts build             write art/glyphs/*.aseprite, export to
                                             public/art/images/ and public/art/sprites/`;

// ---------- traits ----------

// The pull squirrel, facing left: f fur, l lit fur (top and left edges, and the tail's edge along the
// gap that parts it from the back), b belly, s feet, w eye glint, n nose. The tail rises from the
// haunch as a separate plume and curls over at the top, so the shape reads as a squirrel and not a
// dark blob.
export const CHASER: readonly string[] = [
  "..........lll...",
  ".........lfffl..",
  "........lff.ffl.",
  "...l....lff..fl.",
  "..lfl...lff..fl.",
  ".lfff...lff.....",
  "nfwfff..lff.....",
  ".fbfff..lff.....",
  "..bfff..lff.....",
  "..bfff..lfff....",
  "..ffff..lfff....",
  "..fffffffffff...",
  "..ffffffffff....",
  ".ss..ss.........",
  "................",
  "................",
];

// Toronto's black squirrel in road.ts's SQUIRREL_FUR, side on facing left, sitting up, its tail a
// plume standing up behind it and curling over at the top, a white glint for its eye.
export function chaser(): Grid {
  const f = SQUIRREL_FUR;
  const g = new Grid(16, 16);
  bitmap(g, 0, 0, CHASER, {
    b: f.belly,
    f: f.fur,
    l: f.lit,
    n: f.nose,
    s: f.shade,
    w: "white",
  });
  return g;
}

// ---------- walkers: perks, on walker tiles, the new walker celebration and the message strip ----------
// Each holds its silhouette on cream and on the strip's ink.

// An hourglass in a brown frame, its sand nearly all run through, a white speed tick at each side: a
// debuff over in half the time. It keeps a clear ring round it for its outline.
export function quickRecovery(): Grid {
  const g = new Grid(16, 16);
  g.rect(3, 1, 10, 1, "brown");
  g.rect(3, 13, 10, 1, "brown");
  g.rect(3, 2, 10, 1, "dbrown");
  g.rect(3, 14, 10, 1, "dbrown");
  g.tri([4, 3], [12, 3], [8, 8], "foam");
  g.tri([4, 13], [12, 13], [8, 8], "foam");
  g.rect(7, 7, 2, 2, "foam");
  // a little sand left on top, its thread through the waist and the heap below
  g.rect(7, 6, 2, 1, "amber");
  g.rect(8, 7, 1, 3, "amber");
  g.tri([4.5, 13], [11.5, 13], [8, 9.5], "amber");
  g.rect(5, 12, 6, 1, "orange");
  for (const y of [5, 10]) {
    g.rect(1, y, 2, 1, "white");
    g.rect(13, y, 2, 1, "white");
  }
  return g;
}

// A pink speech bubble holding a red heart.
export function secondChance(): Grid {
  const g = new Grid(16, 16);
  g.rect(2, 1, 12, 10, "pink");
  g.rect(1, 2, 14, 8, "pink");
  g.rect(2, 10, 12, 1, "mauve");
  g.tri([10, 10], [13, 15], [13.5, 10], "pink");
  heart(g, 4, 2);
  return g;
}

// A broad open palm and wrist above the green two-way reach arrow.
export function longReach(): Grid {
  const g = new Grid(16, 16);
  g.rect(6, 3, 6, 5, "skin1");
  for (const [x, y] of [
    [6, 1],
    [8, 0],
    [10, 1],
    [12, 2],
  ] as const) {
    g.rect(x, y, 1, 5 - y, "skin1");
  }
  g.rect(3, 5, 2, 2, "skin1");
  g.rect(4, 6, 3, 2, "skin1");
  g.rect(7, 8, 4, 2, "skin1");
  g.rect(10, 7, 2, 2, "skin2");
  g.tri([1, 12.5], [4, 9.5], [4, 15.5], "green");
  g.tri([15, 12.5], [12, 9.5], [12, 15.5], "green");
  g.rect(4, 11, 8, 3, "green");
  g.rect(4, 13, 8, 1, "dgreen");
  return g;
}

// A magnifying glass, its cyan lens over the treat (a white bone with a red heart on its shaft), its
// brown handle down to the right.
export function keenEye(): Grid {
  const g = new Grid(16, 16);
  for (let i = 0; i < 4; i++) {
    g.rect(10 + i, 10 + i, 2, 2, "brown");
  }
  g.ell(6.5, 6.5, 5.7, 5.7, "lgrey", "grey");
  g.ell(6.5, 6.5, 4.2, 4.2, "cyan", null, "white");
  bitmap(g, 3, 5, ["ww1.1ww", ".w111w.", "ww.1.ww"], { "1": "red", w: "white" });
  return g;
}

// ---------- zones, after their backdrops ----------

// A 16x16 zone picture drawn only inside the 1px ring its outline takes, with iconEdge outlines, so a
// picture that fills its frame is outlined on every side.
export class Zone extends Grid {
  constructor() {
    super(16, 16);
    this.edge = iconEdge;
  }

  override p(x: number, y: number, c: Colour): void {
    if (Math.trunc(x) >= 1 && Math.trunc(x) <= 14 && Math.trunc(y) >= 1 && Math.trunc(y) <= 14) {
      super.p(x, y, c);
    }
  }
}

// A bay-and-gable house: a steep slate gable trimmed in white, a lit attic window in it, over brick, a
// bay of lit windows.
export function cabbagetown(): Grid {
  const g = new Zone();
  g.tri([1.5, 7.5], [8, 1], [14.5, 7.5], "dslate");
  for (let k = 0; k < 6; k++) {
    g.p(3 + k, 6 - k, "white");
    g.p(12 - k, 6 - k, "white");
  }
  g.rect(2, 7, 12, 8, "brick");
  g.rect(12, 7, 2, 8, "dbrick");
  g.rect(2, 7, 6, 8, "clay");
  for (const y of [8, 12]) {
    g.rect(3, y, 4, 2, "gold");
  }
  g.rect(10, 10, 2, 5, "forest");
  g.rect(7, 4, 2, 2, "gold");
  return g;
}

// A dark pine on the park's grass, a cherry in blossom behind it.
export function highPark(): Grid {
  const g = new Zone();
  g.ell(4, 6, 3.5, 3.5, "pink", "mauve");
  g.p(3, 5, "white");
  g.rect(9, 12, 2, 3, "bark");
  for (const [top, half] of [
    [1, 2],
    [4, 4],
    [7, 5],
  ] as const) {
    g.tri([10, top], [10 - half, top + 5], [10 + half, top + 5], "pine");
    g.tri([10, top], [10 - half, top + 5], [10, top + 5], "canopy");
  }
  g.rect(1, 13, 14, 2, "pine");
  g.rect(1, 13, 14, 1, "canopy");
  return g;
}

// A brick warehouse with an arched lit window, its chimney stack beside it.
export function distilleryDistrict(): Grid {
  const g = new Zone();
  g.rect(11, 1, 3, 6, "brick");
  g.rect(13, 1, 1, 6, "dbrick");
  g.rect(1, 6, 14, 9, "brick");
  g.rect(13, 6, 2, 9, "dbrick");
  g.rect(1, 6, 14, 1, "stone");
  for (const x of [3, 8]) {
    g.rect(x, 9, 3, 4, "gold");
    g.p(x + 1, 8, "gold");
  }
  return g;
}

// A painted house turned shop: a turquoise wall under a violet gable, a striped awning.
export function kensingtonMarket(): Grid {
  const g = new Zone();
  g.tri([1.5, 6.5], [8, 1], [14.5, 6.5], "violet");
  g.rect(2, 6, 12, 9, "turquoise");
  g.rect(12, 6, 2, 9, "dturq");
  for (let x = 2; x < 14; x += 4) {
    g.rect(x, 9, 2, 2, "ttc");
    g.rect(x + 2, 9, 2, 2, "white");
  }
  g.rect(3, 12, 5, 3, "cyan");
  g.rect(10, 12, 2, 3, "dbrown");
  g.rect(6, 7, 4, 1, "white");
  return g;
}

// The lifeguard station: a white tower under a red roof, over the lake.
export function theBeaches(): Grid {
  const g = new Zone();
  g.tri([3.5, 6.5], [8, 2], [12.5, 6.5], "ttc");
  g.rect(4, 6, 8, 5, "white");
  g.rect(10, 6, 2, 5, "lgrey");
  g.rect(6, 7, 3, 2, "dlake");
  g.rect(8, 0, 1, 2, "coal");
  g.rect(1, 11, 14, 4, "lake");
  g.rect(1, 11, 14, 1, "foam");
  g.rect(2, 13, 3, 1, "shallow");
  g.rect(9, 14, 4, 1, "shallow");
  return g;
}

// The CN Tower over downtown blocks.
export function yongeStreet(): Grid {
  const g = new Zone();
  g.rect(7, 1, 1, 3, "grey");
  g.rect(6, 4, 3, 2, "lgrey");
  g.rect(6, 5, 3, 1, "dlake");
  g.rect(7, 6, 2, 7, "lgrey");
  g.rect(8, 6, 1, 7, "grey");
  g.rect(1, 9, 5, 6, "ash");
  g.rect(10, 8, 5, 7, "lake");
  for (const y of [10, 12]) {
    g.rect(2, y, 3, 1, "haze");
    g.rect(11, y - 1, 3, 1, "foam");
  }
  g.rect(1, 14, 14, 1, "ttc");
  return g;
}

// ---------- debuffs: distinct material silhouettes with a shared plum keyline ----------

// A water drop: a point at (cx, top) over a round base of radius r.
export function drop(
  g: Drawable,
  cx: number,
  top: number,
  r: number,
  fill: string,
  sh: Colour = null,
  li: Colour = null,
): void {
  const base = top + 2.2 * r;
  g.tri([cx, top], [cx - r * 0.93, base - r * 0.4], [cx + r * 0.93, base - r * 0.4], fill);
  g.ell(cx, base, r, r, fill, sh, li);
}

const plumEdge = (): string => K.plum!;

// A sky-blue drop entering a broad brown mud splash, with a tan front lip.
export function muddy(): Grid {
  const g = new Grid(16, 16);
  g.edge = plumEdge;
  g.tri([7, 1], [3, 7], [10, 7], "sky");
  g.ell(6.5, 6.5, 3.5, 3.5, "sky", "blue", "cyan");
  g.ell(8, 12, 6.5, 2.5, "brown", "dbrown", "tan");
  g.rect(3, 8, 2, 4, "brown");
  g.rect(11, 8, 2, 4, "brown");
  g.p(1, 9, "tan");
  g.p(14, 9, "brown");
  g.rect(5, 10, 4, 2, "tan");
  g.p(10, 12, "dbrown");
  return g;
}

// A green paw rushing right with a broad yellow lightning tail.
export function zoomies(): Grid {
  const g = new Grid(16, 16);
  g.edge = plumEdge;
  g.rect(9, 3, 2, 3, "green");
  g.rect(12, 5, 2, 3, "green");
  g.ell(10, 10, 3.5, 3.5, "green", "forest", "yellow");
  g.rect(6, 5, 2, 2, "green");
  bitmap(g, 1, 2, ["...yy", "..yyy", ".yyy.", "yyyy.", "..yy.", ".yy..", "yy..."], {
    y: "yellow",
  });
  g.p(10, 9, "yellow");
  g.p(11, 9, "yellow");
  return g;
}

// A blue stage lamp throwing a broad yellow beam onto a white-lit pool.
export function spotlight(): Grid {
  const g = new Grid(16, 16);
  g.edge = plumEdge;
  g.tri([5, 5], [7, 5], [14, 13], "yellow");
  g.tri([5, 5], [14, 13], [5, 13], "yellow");
  g.ell(9.5, 13, 5, 1.5, "yellow");
  bitmap(g, 1, 1, [".bbb...", "bbbbbb.", ".bbbbsw", "..bbsww", "...sww."], {
    b: "blue",
    s: "sky",
    w: "white",
  });
  g.rect(2, 6, 2, 3, "blue");
  g.rect(3, 8, 3, 1, "blue");
  g.rect(7, 11, 3, 1, "white");
  return g;
}

// ---------- upgrades: the shop, the cards and the message strip ----------
// Every fill that carries a shape also holds 3:1 or more on ink, where the 20x20 copies sit in the
// walk bar's wells and their darker outlines sink, so the silhouette is the fill. Dark ramp colours
// (dbrown, dred, forest, blue) appear only inside a lighter fill.

export const BIG_HEART: readonly string[] = [
  ".111.111.",
  "11111111p",
  "1111111pp",
  "111111ppp",
  ".11111pp.",
  "..111pp..",
  "...1pp...",
  "....p....",
];

export function heart(g: Drawable, x: number, y: number): void {
  bitmap(g, x, y, BIG_HEART, { "1": "red", p: "hot" });
  g.p(x + 1, y + 1, "pink");
}

// A hand rubbing below a heart.
export function bellyRubs(): Grid {
  const g = new Grid(16, 16);
  heart(g, 6, 1);
  bitmap(
    g,
    1,
    9,
    [
      "....ssssss..",
      "ssssssssssss",
      "sssssddddd..",
      "sssssssssss.",
      "ssssdddd....",
      "ssssssssss..",
    ],
    { d: "skin2", s: "skin1" },
  );
  return g;
}

// A stack of coins with an arrow up.
export function bigTipper(): Grid {
  const g = new Grid(16, 16);
  for (const [x, y] of [
    [1, 12],
    [2, 10],
    [1, 8],
    [2, 6],
  ] as const) {
    g.rect(x, y, 7, 2, "amber");
    g.rect(x, y + 1, 7, 1, "orange");
    g.p(x + 1, y, "yellow");
  }
  g.ell(5.5, 4.5, 3.5, 2, "yellow", "amber");
  g.rect(4, 4, 3, 1, "amber");
  g.tri([12, 0.8], [9, 4.8], [15, 4.8], "green");
  g.rect(11, 4, 2, 10, "green");
  return g;
}

// Good leash, as a calm dog: a brown dog sitting politely side on, facing left, head up, a yellow
// twinkle of good manners at its shoulder. o fur (brown), h shade (dbrown), e ear (dbrown), m chest
// and muzzle (tan), k eye and nose (ink), c collar (red).
export const CALM_DOG_COLS: Readonly<Record<string, string>> = {
  c: "red",
  e: "dbrown",
  h: "dbrown",
  k: "ink",
  m: "tan",
  o: "brown",
};
export const CALM_DOG: readonly string[] = [
  "................",
  "..oooo..........",
  ".ooooee.........",
  ".okooee.........",
  "kmmoooe.........",
  ".mmmooe.........",
  "...ccc..........",
  "...moooo........",
  "...mooooo.......",
  "...moooooo...h..",
  "...mooooooo..h..",
  "...moohhoooohh..",
  "...moohhooooh...",
  "..hhh.hhhhhh....",
  "................",
  "................",
];
export const CALM_DOG_20: readonly string[] = [
  "....................",
  "...ooooo............",
  "..oooooee...........",
  "..ookooee...........",
  "..oooooee...........",
  ".kmmmoooe...........",
  "..mmmmooe...........",
  "....cccc............",
  "....mooooo..........",
  "....moooooo.........",
  "....mooooooo........",
  "....moooooooo....h..",
  "....mooooooooo...h..",
  "....mooooooooo..hh..",
  "....mooohhoooohhhh..",
  "....mooohhoooohh....",
  "....mooohhoooo......",
  "...hhhh.hhhhhhh.....",
  "....................",
  "....................",
];

// A calm dog, sitting politely with its head up and a twinkle of good manners: no squirrel pulls it.
export function goodLeash(): Grid {
  const g = new Grid(16, 16);
  bitmap(g, 0, 0, CALM_DOG, CALM_DOG_COLS);
  star4(g, 12, 3, 1, "yellow");
  return g;
}

// A yellow hooded coat with one dark hood opening, two sleeves and a clear hem.
export function raincoats(): Grid {
  const g = new Grid(16, 16);
  bitmap(g, 5, 1, ["..yyy..", ".yyyyy.", "yyddday", "yyddday", ".yyyyy."], {
    a: "amber",
    d: "dbrown",
    y: "yellow",
  });
  g.rect(5, 6, 8, 8, "yellow");
  g.tri([5, 5], [2, 9], [5, 11], "yellow");
  g.tri([12, 5], [15, 9], [13, 11], "amber");
  g.rect(12, 7, 1, 7, "amber");
  g.rect(8, 7, 1, 6, "orange");
  for (const y of [8, 11]) {
    g.p(9, y, "ochre");
  }
  g.rect(5, 14, 8, 1, "amber");
  drop(g, 2, 1, 1.3, "cyan", "sky");
  return g;
}

// A speech bubble saying money goes down.
export function sweetTalker(): Grid {
  const g = new Grid(16, 16);
  g.rect(2, 2, 12, 9, "white");
  g.rect(1, 3, 14, 7, "white");
  g.rect(2, 10, 12, 1, "lgrey");
  g.tri([3, 10], [3, 15], [7, 10], "white");
  bitmap(g, 3, 3, [".s.", "sss", "s..", "sss", "..s", "sss", ".s."], { s: "forest" });
  bitmap(g, 8, 3, ["..d..", "..d..", "..d..", "ddddd", ".ddd.", "..d.."], { d: "dred" });
  return g;
}

// An alarm clock ringing.
export function rushHour(): Grid {
  const g = new Grid(16, 16);
  g.ell(3.5, 3.5, 2.5, 2.5, "amber", "orange", "yellow");
  g.ell(12.5, 3.5, 2.5, 2.5, "amber", "orange", "yellow");
  g.rect(3, 13, 2, 2, "lgrey");
  g.rect(11, 13, 2, 2, "lgrey");
  g.ell(8, 9, 6, 6, "red", null, "pink");
  g.ell(8, 9, 4, 4, "white", "lgrey");
  g.rect(8, 6, 1, 4, "ink");
  g.rect(9, 9, 2, 1, "ink");
  return g;
}

// The gear, after its 32x32 item art in icons.ts.

// A silver whistle with a dark mouthpiece and one separated cyan sound stroke.
export function gearWhistle(): Grid {
  const g = new Grid(16, 16);
  g.ell(6.5, 10, 5.5, 4.8, "lgrey", "grey", "white");
  g.rect(6, 6, 9, 4, "lgrey");
  g.rect(6, 6, 9, 1, "white");
  g.rect(6, 9, 9, 1, "grey");
  g.rect(14, 6, 1, 4, "grey");
  g.rect(7, 6, 3, 1, null);
  g.rect(7, 7, 3, 1, "dslate");
  for (const [x, y] of [
    [4, 9],
    [6, 9],
    [3, 10],
    [7, 10],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(4, 11, 3, 2, "dred");
  g.rect(9, 0, 1, 3, "cyan");
  return g;
}

// A deep forest-green pouch with a visible belt, zipper and pale logo.
export function gearFannyPack(): Grid {
  return fannyPackIcon(16);
}

export function gearHallPass(): Grid {
  const g = new Grid(16, 16);
  g.p(3, 0, "sky");
  g.p(4, 1, "sky");
  g.p(5, 2, "sky");
  g.p(12, 0, "sky");
  g.p(11, 1, "sky");
  g.p(10, 2, "sky");
  g.rect(1, 5, 14, 10, "cream");
  g.rect(1, 5, 14, 3, "red");
  g.rect(14, 5, 1, 10, "tan");
  g.rect(1, 14, 14, 1, "tan");
  g.rect(14, 5, 1, 3, "dred");
  g.rect(6, 3, 4, 2, "lgrey");
  g.rect(7, 5, 2, 2, "lgrey");
  for (const [x, y] of [
    [2, 10],
    [4, 9],
    [6, 10],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(3, 11, 3, 2, "dred");
  g.rect(9, 10, 4, 1, "brown");
  g.rect(9, 12, 4, 1, "brown");
  return g;
}

export const SHOE_COLS: Readonly<Record<string, string>> = {
  b: "blue",
  c: "cyan",
  g: "grey",
  l: "lgrey",
  n: "navy",
  o: "orange",
  s: "sky",
  w: "white",
};
export const SHOE_16: readonly string[] = [
  "..........oo..",
  "......cccnnno.",
  ".....cwwnnnss.",
  "...ccwwssssssb",
  "..csssssoooosb",
  ".csooooossssbb",
  "sbbbbbbbbbbbbb",
  "wwwwwwwwwwwwww",
  ".llllllllllll.",
];

// A low running shoe side on, the toe to the left: a sky upper lit cyan along its top, white laces, a
// navy collar, an orange stripe and heel tab, and a white sole on an lgrey outsole.
export function gearRunningShoes(): Grid {
  const g = new Grid(16, 16);
  bitmap(g, 1, 4, SHOE_16, SHOE_COLS);
  return g;
}

export function gearLuckyCollar(): Grid {
  const g = new Grid(16, 16);
  g.ell(8, 6, 6.5, 4.5, "red", null, "pink");
  g.ell(8, 6, 4.5, 2.5, null);
  g.ell(8, 12, 3, 3, "amber", "orange", "yellow");
  for (const [x, y] of [
    [7, 11],
    [8, 11],
    [7, 12],
    [9, 12],
    [8, 13],
  ] as const) {
    g.p(x, y, "green");
  }
  return g;
}

// ---------- the walk bar's effect wells: each perk, gear and upgrade icon drawn again at 20x20 ----------
// The same subject, colours and silhouette as its 16x16 icon, redrawn with the room spent on detail.
// Like the 16x16 icons', every fill that carries a shape holds 3:1 or more on the well's ink.

export const BIG_HEART_20: readonly string[] = [
  ".111...111.",
  "11111.11111",
  "11111111111",
  "1111111111p",
  ".11111111p.",
  "..111111p..",
  "...1111p...",
  "....11p....",
  ".....p.....",
];

// An 11x9 heart, red with a hot right side, lit white at the top of its left lobe.
export function heart20(g: Drawable, x: number, y: number): void {
  bitmap(g, x, y, BIG_HEART_20, { "1": "red", p: "hot" });
  g.p(x + 1, y + 1, "white");
  g.p(x + 2, y + 1, "pink");
}

// A pink speech bubble holding a red heart, its tail down to the right.
export function secondChance20(): Grid {
  const g = new Grid(20, 20);
  g.rect(2, 1, 16, 13, "pink");
  g.rect(1, 2, 18, 11, "pink");
  g.rect(2, 13, 16, 1, "mauve");
  g.rect(18, 3, 1, 9, "mauve");
  g.tri([11, 13], [15.5, 19], [16, 13], "pink");
  g.p(15, 14, "mauve");
  g.p(15, 15, "mauve");
  heart20(g, 4, 3);
  return g;
}

// A stack of five coins under a sixth seen from above, and a green arrow up beside it, filling the
// well as the other effect icons do.
export function bigTipper20(): Grid {
  const g = new Grid(20, 20);
  for (const [x, y] of [
    [2, 16],
    [3, 14],
    [2, 12],
    [3, 10],
    [2, 8],
  ] as const) {
    g.rect(x, y, 9, 2, "amber");
    g.rect(x, y + 1, 9, 1, "orange");
    g.p(x + 1, y, "yellow");
  }
  g.ell(6.5, 6.5, 4.5, 2.2, "yellow", "amber");
  g.rect(4, 6, 5, 1, "amber");
  g.tri([15, 1], [11.5, 5.5], [18.5, 5.5], "green");
  g.rect(14, 5, 2, 13, "green");
  return g;
}

// The running shoe of gearRunningShoes with room for a second lace, a toe spring and a lugged
// outsole.
export function gearRunningShoes20(): Grid {
  const g = new Grid(20, 20);
  bitmap(
    g,
    1,
    4,
    [
      "............oo....",
      "........cccccoo...",
      ".......cwwnnnnso..",
      "......cssbnnnnsss.",
      "....ccwwssssssssb.",
      "...csssssssooossb.",
      "..csssssoooosssssb",
      ".csssooosssssssssb",
      "cssssssssssssssbbb",
      "sbbbbbbbbbbbbbbbbb",
      "wwwwwwwwwwwwwwwwww",
      ".wwwwwwwwwwwwwwwww",
      "..lglglglglglglgl.",
    ],
    SHOE_COLS,
  );
  return g;
}

// An 18x12 speech bubble with clipped corners, shaded along its foot and right side, its tail down to
// the left.
export function bubble20(
  g: Drawable,
  fill: string,
  shade: string,
  lit: string | null = null,
): void {
  g.rect(2, 1, 16, 12, fill);
  g.rect(1, 2, 18, 10, fill);
  g.rect(2, 12, 16, 1, shade);
  g.rect(18, 3, 1, 9, shade);
  g.tri([4, 12], [4, 18.5], [9, 12], fill);
  g.p(5, 13, shade);
  if (lit) {
    g.rect(2, 1, 16, 1, lit);
    g.rect(1, 2, 1, 5, lit);
  }
}

// An hourglass in a brown frame, its sand nearly all run through, a white speed tick at each side.
export function quickRecovery20(): Grid {
  const g = new Grid(20, 20);
  g.rect(4, 1, 12, 1, "brown");
  g.rect(4, 17, 12, 1, "brown");
  g.rect(4, 2, 12, 1, "dbrown");
  g.rect(4, 18, 12, 1, "dbrown");
  g.tri([5, 3], [15, 3], [10, 10], "foam");
  g.tri([5, 17], [15, 17], [10, 10], "foam");
  g.rect(9, 9, 2, 2, "foam");
  g.rect(7, 3, 1, 2, "white");
  g.tri([8, 7.5], [12, 7.5], [10, 10], "amber");
  g.rect(10, 9, 1, 4, "amber");
  g.tri([5.5, 17], [14.5, 17], [10, 12.5], "amber");
  g.rect(6, 16, 8, 1, "orange");
  g.p(9, 15, "yellow");
  for (const y of [6, 13]) {
    g.rect(1, y, 3, 1, "white");
    g.rect(16, y, 3, 1, "white");
  }
  return g;
}

// A native twenty-pixel palm with separated fingers, a thumb and a green reach arrow.
export function longReach20(): Grid {
  const g = new Grid(20, 20);
  g.rect(6, 4, 9, 6, "skin1");
  for (const [x, y] of [
    [6, 2],
    [9, 0],
    [12, 1],
    [15, 3],
  ] as const) {
    g.rect(x, y, 2, 6 - y, "skin1");
  }
  g.rect(2, 6, 3, 3, "skin1");
  g.rect(4, 8, 4, 3, "skin1");
  g.rect(8, 10, 5, 2, "skin1");
  g.rect(13, 7, 2, 3, "skin2");
  g.tri([1, 15.5], [5, 12], [5, 19], "green");
  g.tri([19, 15.5], [15, 12], [15, 19], "green");
  g.rect(5, 14, 10, 3, "green");
  g.rect(5, 16, 10, 1, "dgreen");
  return g;
}

// A magnifying glass, its cyan lens over the treat (a white bone with a red heart on its shaft), its
// brown handle down to the right.
export function keenEye20(): Grid {
  const g = new Grid(20, 20);
  for (let i = 0; i < 5; i++) {
    g.rect(13 + i, 13 + i, 2, 2, "brown");
  }
  g.ell(8, 8, 7, 7, "lgrey", "grey");
  g.ell(8, 8, 5.2, 5.2, "cyan", null, "white");
  bitmap(g, 4, 6, ["..11.11..", "ww11111ww", ".ww111ww.", "ww..1..ww"], {
    "1": "red",
    w: "white",
  });
  return g;
}

// A hand, palm up, rubbing below a heart.
export function bellyRubs20(): Grid {
  const g = new Grid(20, 20);
  heart20(g, 6, 1);
  bitmap(
    g,
    1,
    11,
    [
      "......sssss.....",
      "ssssssssssssss..",
      "sssssssdddddd...",
      "sssssssssssssss.",
      "ssssssdddddd....",
      "ssssssssssssss..",
      "sssssddddd......",
      "ssssssssssss....",
    ],
    { d: "skin2", s: "skin1" },
  );
  return g;
}

// The calm dog of goodLeash, sitting politely with its twinkle.
export function goodLeash20(): Grid {
  const g = new Grid(20, 20);
  bitmap(g, 0, 0, CALM_DOG_20, CALM_DOG_COLS);
  star4(g, 15, 4, 2, "yellow");
  return g;
}

// A native twenty-pixel raincoat with a single hood opening and broad yellow panels.
export function raincoats20(): Grid {
  const g = new Grid(20, 20);
  bitmap(g, 7, 1, ["..yyyy..", ".yyyyyy.", "yydddday", "yydddday", "yydddday", ".yyyyyy."], {
    a: "amber",
    d: "dbrown",
    y: "yellow",
  });
  g.rect(6, 7, 10, 10, "yellow");
  g.tri([6, 6], [2, 11], [5, 14], "yellow");
  g.tri([15, 6], [19, 11], [16, 14], "amber");
  g.rect(15, 8, 1, 9, "amber");
  g.rect(10, 8, 1, 8, "orange");
  for (const y of [10, 14]) {
    g.rect(11, y, 1, 2, "ochre");
  }
  g.rect(6, 17, 10, 1, "amber");
  drop(g, 2.5, 1, 1.6, "cyan", "sky");
  return g;
}

// An alarm clock ringing: two amber bells, a red case on lgrey feet and a white face.
export function rushHour20(): Grid {
  const g = new Grid(20, 20);
  g.ell(4.5, 4.5, 3, 3, "amber", "orange", "yellow");
  g.ell(15.5, 4.5, 3, 3, "amber", "orange", "yellow");
  g.rect(4, 15, 2, 4, "lgrey");
  g.rect(14, 15, 2, 4, "lgrey");
  g.ell(10, 10.5, 7, 7, "red", null, "pink");
  g.ell(10, 10.5, 5, 5, "white", "lgrey");
  g.rect(9, 3, 2, 1, "lgrey");
  g.rect(10, 7, 1, 4, "ink");
  g.rect(11, 10, 3, 1, "ink");
  return g;
}

// A speech bubble saying money goes down: a forest $ and a dred arrow down.
export function sweetTalker20(): Grid {
  const g = new Grid(20, 20);
  bubble20(g, "white", "lgrey");
  bitmap(
    g,
    3,
    2,
    ["..s..", ".ssss", "s.s..", "s.s..", ".sss.", "..s.s", "..s.s", "ssss.", "..s.."],
    { s: "forest" },
  );
  bitmap(
    g,
    10,
    3,
    ["..ddd..", "..ddd..", "..ddd..", "..ddd..", "ddddddd", ".ddddd.", "..ddd..", "...d..."],
    { d: "dred" },
  );
  return g;
}

// The whistle: a silver sports whistle side on with an ink slot, a dred paw on the barrel and three
// cyan sound lines fanning up from the slot.
export function gearWhistle20(): Grid {
  const g = new Grid(20, 20);
  g.ell(8, 13.5, 7, 6, "lgrey", "grey", "white");
  g.rect(8, 8, 12, 5, "lgrey");
  g.rect(8, 8, 12, 1, "white");
  g.rect(8, 12, 12, 1, "grey");
  g.rect(19, 8, 1, 5, "grey");
  g.rect(9, 8, 4, 1, null);
  g.rect(9, 9, 4, 1, "dslate");
  for (const [x, y] of [
    [5, 12],
    [7, 12],
    [4, 13],
    [8, 13],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(5, 14, 3, 3, "dred");
  for (const [x, y] of [
    [10, 3],
    [10, 4],
    [10, 5],
    [5, 4],
    [6, 5],
    [14, 5],
    [15, 4],
  ] as const) {
    g.p(x, y, "cyan");
  }
  return g;
}

// A native twenty-pixel waist pack with a broad pouch and a separate buckle.
export function gearFannyPack20(): Grid {
  return fannyPackIcon(20);
}

// Redraw each small glyph on its native grid without changing the shared pickup design.
export function fannyPackIcon(size: number): Grid {
  const g = new Grid(size, size);
  if (size === 16) {
    g.rect(0, 4, 16, 2, "dslate");
    g.blob(8, 9, 6, 5, "dgreen", "forest", "green", 3);
    g.rect(3, 4, 10, 4, "dgreen");
    g.rect(3, 4, 10, 1, "green");
    g.rect(3, 6, 10, 1, "ink");
    g.rect(12, 6, 1, 2, "lgrey");
    g.rect(0, 4, 2, 4, "slate");
    g.rect(0, 5, 1, 2, "lgrey");
    g.rect(5, 10, 3, 1, "cream");
  } else {
    g.rect(0, 5, 20, 2, "dslate");
    g.blob(10, 11, 8, 6, "dgreen", "forest", "green", 3);
    g.rect(3, 5, 14, 4, "dgreen");
    g.rect(3, 5, 14, 1, "green");
    g.rect(3, 7, 14, 1, "ink");
    g.rect(16, 7, 1, 3, "lgrey");
    g.rect(0, 4, 3, 5, "slate");
    g.rect(1, 5, 1, 3, "lgrey");
    g.rect(6, 12, 4, 2, "cream");
  }
  return g;
}

// The Hall pass: a cream pass card on a sky lanyard, clipped through its red header band, a dred paw
// stamp on the left and brown lines of print on the right.
export function gearHallPass20(): Grid {
  const g = new Grid(20, 20);
  for (let i = 0; i < 5; i++) {
    g.p(4 + i, i, "sky");
    g.p(15 - i, i, "sky");
  }
  g.rect(2, 7, 16, 11, "cream");
  g.rect(2, 7, 16, 3, "red");
  g.rect(2, 7, 16, 1, "pink");
  g.rect(17, 7, 1, 11, "tan");
  g.rect(2, 17, 16, 1, "tan");
  g.rect(17, 7, 1, 3, "dred");
  g.rect(8, 4, 4, 2, "lgrey");
  g.rect(9, 6, 2, 3, "lgrey");
  for (const [x, y] of [
    [3, 12],
    [5, 11],
    [7, 11],
    [9, 12],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(4, 13, 5, 3, "dred");
  g.rect(4, 15, 1, 1, "cream");
  g.rect(8, 15, 1, 1, "cream");
  g.rect(11, 12, 5, 1, "brown");
  g.rect(11, 14, 5, 1, "brown");
  return g;
}

// The lucky collar: a red collar lit pink with an amber tag stamped with a green clover.
export function gearLuckyCollar20(): Grid {
  const g = new Grid(20, 20);
  g.ell(10, 7, 8, 5.5, "red", null, "pink");
  g.ell(10, 7, 5.5, 3, null);
  g.ell(10, 14.5, 3.8, 3.8, "amber", "orange", "yellow");
  for (const [x, y] of [
    [10, 13],
    [9, 14],
    [11, 14],
    [10, 15],
    [11, 16],
  ] as const) {
    g.p(x, y, "green");
  }
  return g;
}

// ---------- the message strip, on its cream panel beside each line ----------
// Each differs from the status and trait icons it shares the strip with by shape and colour family.

// The ribbon rosette, as a badge's medal: r red pleats lit l pink along the upper left and shaded d
// dred along the lower right, scalloped into eight bumps by the outline's notches; c the cream face of
// a badge with t its tan crescent and g a gold centre; b blue tails shaded n navy, splayed and notched
// at their ends. The red mass, the scallops and the dark tails keep it from reading as a coin, the
// hint's disc or a heart.
export const BADGE: readonly string[] = [
  "................",
  ".....ll..rr.....",
  "....lrrllrrd....",
  "...lrrrccrrrd...",
  "..lrrrccccrrrd..",
  "...lrccggccrd...",
  "...rrccggctrd...",
  "..rrrrccctrrrd..",
  "...rrrrttrrrd...",
  "....rrrddrrd....",
  "...bbrd..ddbn...",
  "...bbn....bbn...",
  "..bbn......bbn..",
  "..bbn......bbn..",
  "..b.n......b.n..",
  "................",
];

// A red ribbon rosette with a cream badge face and a gold centre, on two navy tails, for a badge
// earned.
export function badge(): Grid {
  const g = new Grid(16, 16);
  bitmap(g, 0, 0, BADGE, {
    b: "blue",
    c: "cream",
    d: "dred",
    g: "amber",
    l: "pink",
    n: "navy",
    r: "red",
    t: "tan",
  });
  return g;
}

// An impact burst, as fx-bump: an amber eight-point star round a yellow one and a white core.
export function bump(): Grid {
  const g = new Grid(16, 16);
  burst(g, 8, 8, 7.4, 3.6, 8, "amber", 22.5);
  burst(g, 8, 8, 4.4, 2.2, 8, "yellow", 22.5);
  g.rect(7, 7, 2, 2, "white");
  return g;
}

// The pink slip: p pink page, m mauve down its shaded side, w the folded corner's white underside with
// f its mauve crease, t plum lines of text, s the dred stamp across the page's lower half, l its white
// lettering. The page shows its fold, its text and its foot around the stamp, so it reads as a letter
// and not a box.
export const FIRED: readonly string[] = [
  "................",
  "...pppppppf.....",
  "...pppppppwf....",
  "...ppppppwwwf...",
  "...pppppppppm...",
  "...pttttttppm...",
  "...pppppppppm...",
  "...ptttttttpm...",
  "...pppppppppm...",
  "..ssssssssssss..",
  "..slllllllllls..",
  "..ssssssssssss..",
  "...pppppppppm...",
  "...pttttppppm...",
  "...pppppppppm...",
  "................",
];

// A pink slip: a page with lines of plum text and its top corner folded down, a dred stamp across it
// lettered in a white line, as the empty ui-dog-card's FIRED plate.
export function fired(): Grid {
  const g = new Grid(16, 16);
  bitmap(g, 0, 0, FIRED, {
    f: "mauve",
    l: "white",
    m: "mauve",
    p: "pink",
    s: "dred",
    t: "plum",
    w: "white",
  });
  return g;
}

// A white i on a sky disc, lit cyan at its top left and shaded blue at its lower right.
export function hint(): Grid {
  const g = new Grid(16, 16);
  g.cel(8, 8, 6.6, 6.6, "sky", "blue", "cyan");
  g.rect(7, 3, 2, 2, "white");
  g.rect(7, 6, 2, 6, "white");
  g.rect(6, 6, 1, 1, "white");
  g.rect(6, 11, 4, 1, "white");
  return g;
}

// A four-leaf clover on its stem, green shaded dgreen, each leaf notched at its tip and veined dgreen
// to the centre, with a yellow twinkle at the top right.
export function lucky(): Grid {
  const g = new Grid(16, 16);
  for (let i = 0; i < 5; i++) {
    g.p(9 + i, 10 + i, "dgreen");
  }
  for (const [cx, cy] of [
    [4.5, 5.5],
    [9.5, 5.5],
    [4.5, 10.5],
    [9.5, 10.5],
  ] as const) {
    g.cel(cx, cy, 2.6, 2.6, "green", "dgreen");
  }
  for (const [x, y] of [
    [7, 2],
    [7, 13],
    [1, 8],
    [12, 8],
  ] as const) {
    g.p(x, y, null);
  }
  for (const [x, y] of [
    [7, 4],
    [7, 5],
    [7, 6],
    [7, 7],
    [7, 9],
    [7, 10],
    [7, 11],
    [3, 8],
    [4, 8],
    [5, 8],
    [6, 8],
    [8, 8],
    [9, 8],
    [10, 8],
  ] as const) {
    g.p(x, y, "dgreen");
  }
  g.p(7, 8, "yellow");
  star4(g, 13, 3, 1, "yellow");
  return g;
}

// Every image by key, in build order.
export const IMAGES: ReadonlyMap<string, () => Grid> = new Map([
  ["icon-trait-chaser", chaser],
  ["icon-perk-keen-eye", keenEye],
  ["icon-perk-long-reach", longReach],
  ["icon-perk-quick-recovery", quickRecovery],
  ["icon-perk-second-chance", secondChance],
  ["icon-zone-cabbagetown", cabbagetown],
  ["icon-zone-high-park", highPark],
  ["icon-zone-distillery-district", distilleryDistrict],
  ["icon-zone-kensington-market", kensingtonMarket],
  ["icon-zone-the-beaches", theBeaches],
  ["icon-zone-yonge-street", yongeStreet],
  ["icon-muddy", muddy],
  ["icon-zoomies", zoomies],
  ["icon-spotlight", spotlight],
  ["icon-upgrade-belly-rubs", bellyRubs],
  ["icon-upgrade-big-tipper", bigTipper],
  ["icon-upgrade-good-leash", goodLeash],
  ["icon-upgrade-raincoats", raincoats],
  ["icon-upgrade-rush-hour", rushHour],
  ["icon-upgrade-sweet-talker", sweetTalker],
  ["icon-gear-whistle", gearWhistle],
  ["icon-gear-fanny-pack", gearFannyPack],
  ["icon-gear-lucky-collar", gearLuckyCollar],
  ["icon-gear-hall-pass", gearHallPass],
  ["icon-gear-running-shoes", gearRunningShoes],
  ["icon-perk-keen-eye-20", keenEye20],
  ["icon-perk-long-reach-20", longReach20],
  ["icon-perk-quick-recovery-20", quickRecovery20],
  ["icon-perk-second-chance-20", secondChance20],
  ["icon-upgrade-belly-rubs-20", bellyRubs20],
  ["icon-upgrade-big-tipper-20", bigTipper20],
  ["icon-upgrade-good-leash-20", goodLeash20],
  ["icon-upgrade-raincoats-20", raincoats20],
  ["icon-upgrade-rush-hour-20", rushHour20],
  ["icon-upgrade-sweet-talker-20", sweetTalker20],
  ["icon-gear-whistle-20", gearWhistle20],
  ["icon-gear-fanny-pack-20", gearFannyPack20],
  ["icon-gear-lucky-collar-20", gearLuckyCollar20],
  ["icon-gear-hall-pass-20", gearHallPass20],
  ["icon-gear-running-shoes-20", gearRunningShoes20],
  ["icon-badge", badge],
  ["icon-bump", bump],
  ["icon-fired", fired],
  ["icon-hint", hint],
  ["icon-lucky", lucky],
]);

// ---------- the difficulty marker on a fork's path card ----------

export const PAW_PRINT: readonly string[] = [
  "..ff.ff..",
  "..ff.ff..",
  "ff.....ff",
  "ff.....ff",
  "...fff...",
  "..fffff..",
  ".fffffff.",
  "..fffff..",
];

const SIDES: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// One 11x10 paw at x0: filled is amber, shaded orange along the pad's foot, outlined in plum by hand;
// hollow is a clay rim with no outline, 3.2:1 on cream, so every empty slot shows but stays lighter
// than a filled paw.
export function paw(g: Drawable, x0: number, filled: boolean): void {
  const cells: [number, number][] = PAW_PRINT.flatMap((row, y) =>
    [...row].flatMap((ch, x): [number, number][] => (ch === "f" ? [[x, y]] : [])),
  );
  const inCells = new Set(cells.map(([x, y]) => `${x},${y}`));
  const has = (x: number, y: number): boolean => inCells.has(`${x},${y}`);
  for (const [x, y] of cells) {
    for (const [dx, dy] of SIDES) {
      if (filled && !has(x + dx, y + dy)) {
        g.p(x0 + 1 + x + dx, 1 + y + dy, "plum");
      }
    }
  }
  for (const [x, y] of cells) {
    const rim = SIDES.some(([dx, dy]) => !has(x + dx, y + dy));
    if (filled) {
      g.p(x0 + 1 + x, 1 + y, y === 7 ? "orange" : "amber");
    } else if (rim) {
      g.p(x0 + 1 + x, 1 + y, "clay");
    }
  }
}

// 55x10: n filled paws, then hollow ones, out of five. The filled paw's plum outline holds 9.4:1 on
// cream; the hollow clay rim holds 3.2:1.
export function difficulty(n: number): Grid {
  const g = new Grid(55, 10);
  for (let i = 0; i < 5; i++) {
    paw(g, i * 11, i < n);
  }
  return g;
}

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  yield [
    "ui-difficulty",
    [1, 2, 3, 4, 5].map((n): Tag => [String(n), [difficulty(n).outlined(false)], 1000]),
  ];
}

// Every content icon takes iconEdge unless its drawing set its own outline rule.
export function image(draw: () => Grid): RgbaImage {
  const g = draw();
  if (g.edge === null) {
    g.edge = iconEdge;
  }
  return toImage(g.outlined());
}

// ---------- preview ----------

type Rgb = readonly [number, number, number];

// A w x h image filled opaque with colour.
function filledImage(w: number, h: number, colour: Rgb): RgbaImage {
  const image = blankImage(w, h);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data.set([...colour, 255], i);
  }
  return image;
}

// Draw source onto target at (x, y), each pixel a scale x scale block, through source's alpha, which
// must be 0 or 255 at every pixel: an opaque pixel replaces the block under it, a clear one leaves it.
// The block must lie inside target.
function stamp(target: RgbaImage, x: number, y: number, scale: number, source: RgbaImage): void {
  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const from = (sy * source.width + sx) * 4;
      const alpha = source.data[from + 3]!;
      if (alpha !== 0 && alpha !== 255) {
        throw new RangeError("A masked paste needs an alpha of 0 or 255 at every pixel");
      }
      if (alpha) {
        const px = source.data.subarray(from, from + 4);
        for (let j = 0; j < scale; j++) {
          for (let i = 0; i < scale; i++) {
            target.data.set(px, ((y + sy * scale + j) * target.width + x + sx * scale + i) * 4);
          }
        }
      }
    }
  }
}

// Every icon on the UI's paper, panel, wood and ink colours, then ui-difficulty's tags, scaled up.
export function preview(out: string, scale = 6): void {
  const grounds: readonly Rgb[] = [
    [234, 212, 170],
    [228, 166, 114],
    [115, 62, 57],
    [58, 68, 102],
    [24, 20, 37],
  ];
  const marks = [...sprites()].flatMap(([, tags]) => tags.flatMap(([, fs]) => fs.map(toImage)));
  const width = Math.max(20 * IMAGES.size, 60 * marks.length);
  const sheet = filledImage(width * scale, (20 + 14) * grounds.length * scale, [62, 39, 49]);
  [...IMAGES.values()].forEach((draw, i) => {
    const im = image(draw);
    grounds.forEach((ground, j) => {
      const tile = filledImage(im.width, im.height, ground);
      stamp(tile, 0, 0, 1, im);
      stamp(sheet, i * 20 * scale, j * 20 * scale, scale, tile);
    });
  });
  // ui-difficulty, one row per ground
  marks.forEach((im, i) => {
    grounds.forEach((ground, j) => {
      const tile = filledImage(im.width + 2, im.height + 2, ground);
      stamp(tile, 1, 1, 1, im);
      const y = 20 * grounds.length + j * 14;
      stamp(sheet, i * 60 * scale, y * scale, scale, tile);
    });
  });
  writeFileSync(out, savePng(sheet));
}

// ---------- building ----------

export async function build(): Promise<void> {
  mkdirSync("art/glyphs", { recursive: true });
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of IMAGES) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, savePng(image(draw)));
    execFileSync("aseprite", ["-b", png, "--save-as", `art/glyphs/${key}.aseprite`], {
      stdio: "inherit",
    });
  }
  await buildSprites({}, "art/glyphs", sprites());
  console.log("built", [...IMAGES.keys()].join(", "));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 2 && argv[0] === "preview") {
    preview(argv[1]!);
  } else if (argv.length === 1 && argv[0] === "build") {
    await build();
  } else {
    console.error(USAGE);
    process.exit(1);
  }
}
