// Draw the choice card frame and compose the card illustrations.
//
// - card-frame: a 112x153 sprite, one frame per card type (tags encounter for an obstacle's card,
//   route for a fork's path cards; the two frames are alike). The game draws the title centred over
//   the art window with the close X at the top right, the effect text in the body and the cost in
//   the badge. Layout, in card pixels: title rows 2..12, art window 17,15 to 93,72 (illustration at
//   18,16, 75x56), centred with cream face either side, body 6..105 x 76..130, badge spot 20,134,
//   71x13 (plain face; card-cost goes there on a paid option).
// - card-frame-large: a 166x280 sprite with the same tags, for the tap-to-enlarge view: the 83x140
//   layout (art window 3,15, body 6..76 x 76..117, badge spot 6,121) doubled with 1px detail. Title
//   rows 4..24, art window 6,30, 154x116 (illustration at 2x at 8,32), body 12..153 x 152..233,
//   badge spot 12,242, 142x26.
// - card-cost: a 71x13 image, the cost plaque laid over the badge (at 2x on the large frame); the
//   game writes the cost centred on its face.
// - card-<encounter>-<option>, card-<upgrade> and card-skip: 75x56 illustrations, one per option,
//   composed from the exported sprites. Build the sprites first.
// - card-zone-<zone>: 75x56, a fork's path card: the zone's road, sampled from its road strip,
//   running to a cross street, with the zone's backdrop scenery beyond it in miniature.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import type { Frame } from "@andornaut/art-kit/grid";
import { crop, fill, filledImage, paste, resizeNearest } from "@andornaut/art-kit/raster";
import { blankImage, opaqueRect, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as bd from "./backdrops.ts";
import * as glyphs from "./glyphs.ts";
import {
  bitmap,
  build as buildSprites,
  dk,
  type Drawable,
  edged,
  Grid,
  K,
  raster,
  rgbPng,
  savePng,
  type Sprite,
  type Tag,
  toImage,
} from "./pixel.ts";
import * as road from "./road.ts";
import * as roads from "./roads.ts";
import * as sn from "./scene.ts";
import { chrome } from "./ui.ts";

const USAGE = `Usage:
  node art/tools/cards.ts preview OUT.png   every illustration in a card, then the enlarged
                                            frames, scaled up
  node art/tools/cards.ts build             write art/cards/*.aseprite, the frames to
                                            public/art/sprites/ and the illustrations and cost
                                            plaque to public/art/images/`;

export const CW = 112;
export const CH = 153;
export const AW = 75;
export const AH = 56;
// The illustration's top left on card-frame, centred across the card, and the badge spot's (the
// cost plaque's), centred under the body.
export const ART_X = Math.floor((CW - AW) / 2);
export const ART_Y = 16;
export const BADGE_X = Math.floor((CW - 71) / 2);
export const BADGE_Y = 134;
// card-frame-large keeps the 83x140 layout doubled.
export const LBW = 83;
export const LBH = 140;
// The frame's tags: the game draws encounter for an obstacle and route for a fork.
export const KINDS: readonly string[] = ["encounter", "route"];
// A card's ground keeps only the road strip's colours that cover this share of its scrap: the paving
// and its joints.
export const GROUND_KEEP = 0.04;

// The bounding box of image's opaque pixels as [left, upper, right, lower], right and lower
// exclusive.
function bbox(image: RgbaImage): [number, number, number, number] {
  const r = opaqueRect({ height: image.height, width: image.width, x: 0, y: 0 }, image);
  if (!r) {
    throw new RangeError("The image has no opaque pixel");
  }
  return [r.x, r.y, r.x + r.width, r.y + r.height];
}

// The entry of counts with the highest count, the first seen on a tie: Counter.most_common(1).
function mostCommon<T>(counts: ReadonlyMap<T, number>): T {
  let best: T | undefined;
  let most = -1;
  for (const [c, n] of counts) {
    if (n > most) {
      best = c;
      most = n;
    }
  }
  return best!;
}

// How often each item occurs, in first-seen order.
function counted<T>(items: Iterable<T>): Map<T, number> {
  const counts = new Map<T, number>();
  for (const c of items) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return counts;
}

// ---------- the frame ----------

// ui.ts's chrome around the card: the ink and plum lines, the cream face with its tan lip, the
// title's rows plain face, and a recessed art window (an ink line over its top in shadow, plum on
// the other sides). The badge spot stays the cream face: the game lays card-cost there only on an
// option that costs cash. Every kind is alike.
export function cardFrame(kind: string): Grid {
  void kind;
  const g = chrome(new Grid(CW, CH), 0, 0, CW, CH);
  // recessed art window
  g.rect(ART_X - 1, ART_Y - 1, AW + 2, AH + 2, "plum");
  g.rect(ART_X - 1, ART_Y - 1, AW + 2, 1, "ink");
  g.rect(ART_X, ART_Y, AW, AH, "tan");
  return g;
}

export const LW = 2 * LBW;
export const LH = 2 * LBH;

// The tap-to-enlarge card: the 83x140 layout (LBW x LBH) at twice the size with 1px detail, so the
// illustration shows at 2x and the body has room for the modifiers behind the numbers. The chrome's
// lines and lip are 2px.
export function cardFrameLarge(kind: string): Grid {
  void kind;
  const g = new Grid(LW, LH);
  const small = chrome(new Grid(LBW, LBH), 0, 0, LBW, LBH).px;
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      g.px[y]![x] = small[Math.floor(y / 2)]![Math.floor(x / 2)]!;
    }
  }
  // recessed art window, the illustration at 2x
  g.rect(6, 30, 2 * AW + 4, 2 * AH + 4, "plum");
  g.rect(6, 30, 2 * AW + 4, 2, "ink");
  g.rect(8, 32, 2 * AW, 2 * AH, "tan");
  return g;
}

// 71x13: the cost plaque, laid over the frame's badge spot at 20,134 (12,242 at 2x on the large
// frame). ui.ts's chrome with its corners cut 1px: the cream face is x 2 to 67, rows 2 to 9, over
// the tan lip. The game writes the cost ($, $$$, the heart change, Free or Need $...) centred in
// font-title, plum (9.42:1), caps in rows 4 to 8. A disabled card's grey copy turns the face nlgrey,
// where ink holds 12.64:1.
export function cardCost(): Grid {
  return chrome(new Grid(71, 13), 0, 0, 71, 13);
}

// ---------- illustration helpers ----------

export interface PutOptions {
  flip?: boolean;
  i?: number;
  shadow?: boolean;
}

// A card illustration: a scene the size of the art window.
export class Art extends sn.Scene {
  // The ground is transparent and the image saves as RGBA.
  readonly clear: boolean;

  // clear leaves the ground transparent, for a pop-up that floats over the road.
  constructor({ clear = false }: { clear?: boolean } = {}) {
    super(AW, AH);
    this.clear = clear;
    if (clear) {
      this.img = blankImage(AW, AH);
    }
  }

  // A scrap of zone's road strip, quietened: its paving and joints only. Every colour under
  // GROUND_KEEP of the scrap (lane marks, flecks, weeds) turns to the paving, so nothing in the
  // ground competes with the subject at 1x.
  ground(zone: string, { x0 = 122 }: { x0?: number } = {}): void {
    const z = sn.ZONES.get(zone)!;
    this.shade = z.shadow;
    this.leashCol = z.leash;
    const tile = crop({ height: 64, width: AW, x: x0, y: 0 }, sn.TILES.get(zone)!);
    const d = tile.data;
    const colours: number[] = [];
    for (let i = 0; i < d.length; i += 4) {
      colours.push((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    }
    const counts = counted(colours);
    const paving = mostCommon(counts);
    const keep = new Set([...counts].filter(([, n]) => n >= GROUND_KEEP * AW * 64).map(([c]) => c));
    colours.forEach((c, k) => {
      if (!keep.has(c)) {
        d.set([(paving >> 16) & 255, (paving >> 8) & 255, paving & 255], k * 4);
      }
    });
    paste({ at: { x: 0, y: -4 } }, tile, this.img);
  }

  // A flat lawn, with no flecks to compete with the subject.
  grass(): void {
    this.fill(0, 0, AW, AH, "green");
    this.shade = "dgreen";
  }

  // Bathroom tiles, mid grey so the white tub and bubbles hold against them.
  tilesBg(col = "grey", line = "slate"): void {
    this.fill(0, 0, AW, AH, col);
    for (let x = 0; x < AW; x += 8) {
      this.fill(x, 0, 1, AH, line);
    }
    for (let y = 0; y < AH; y += 8) {
      this.fill(0, y, AW, 1, line);
    }
  }

  // key's frame standing on its shadow, its frame's bottom on row foot; returns the row of a dog's
  // collar, scene.ts's COLLAR over its feet (its last opaque row).
  put(
    key: string,
    tag: string,
    cx: number,
    foot: number,
    { flip = false, i = 0, shadow = true }: PutOptions = {},
  ): number {
    this.feet(key, tag, cx, foot, { flip, i, shadow });
    const f = sn.frame(key, tag, i);
    return foot - f.height + bbox(f)[3] - 1 - sn.COLLAR;
  }

  // A pack dog, dog-<name> or its depth variant at step (a percentage), put as put puts it; returns
  // the row of its collar, the dog's own collar height at the step's scale over its feet.
  dog(
    name: string,
    tag: string,
    cx: number,
    foot: number,
    { step = 100, ...q }: PutOptions & { step?: number } = {},
  ): number {
    const c = this.put(`dog-${name}${step === 100 ? "" : `@${step}`}`, tag, cx, foot, q);
    return c + sn.COLLAR - Math.round((sn.collar(name) * step) / 100);
  }

  // n wavy stink lines rising from x, y, every third pixel in sh.
  stink(x: number, y: number, n: number, col: string, sh: string): void {
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < 7; j++) {
        this.fill(x + k * 6 + (j % 4 < 2 ? 0 : 1), y + j, 1, 1, j % 3 ? col : sh);
      }
    }
  }

  // Stink lines in the skunk's colours (road.ts's CLOUD_INK), as skunk-cloud.
  skunkStink(x: number, y: number, n = 3): void {
    this.stink(x, y, n, road.CLOUD_INK.inner, road.CLOUD_INK.outer);
  }

  drops(pts: readonly (readonly [number, number])[], col = "cyan"): void {
    for (const [x, y] of pts) {
      this.fill(x, y, 1, 2, col);
    }
  }

  sparkle(x: number, y: number, col = "white"): void {
    for (const [dx, dy] of [
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
      [0, 0],
    ] as const) {
      this.fill(x + dx, y + dy, 1, 1, col);
    }
  }

  hearts(pts: readonly (readonly [number, number])[]): void {
    for (const [x, y] of pts) {
      this.heart(x, y, "red", "pink");
    }
  }

  face(key: string, mood: string, x: number, y: number): void {
    this.fill(x - 1, y - 1, 34, 34, "plum");
    this.fill(x, y, 32, 32, "tan");
    this.paste(sn.frame(key, mood), x, y);
  }

  // A leash from the collar at x,y off the bottom edge at x1. Cards show no walker, since the player
  // picks one of four: the leash running out of frame stands for them.
  lead(x: number, y: number, x1: number, n = 1): void {
    for (let d = 0; d < n; d++) {
      this.line(x + d, y, x1 + d, AH, this.leashCol);
    }
  }

  // A 9x9 arrow, up (d=-1) or down (d=1): upgrade art shows a change by direction, not a number, so
  // it never goes stale against the tuning.
  arrow(x: number, y: number, d: number, col = "green"): void {
    this.paste(pixmap(d < 0 ? ARROW : [...ARROW].reverse(), { a: col }), x, y);
  }
}

// A small drawn sprite from a character map, with the coloured outline (pixel.ts's Grid).
export function pixmap(
  rows: readonly string[],
  colours: Readonly<Record<string, string>>,
): RgbaImage {
  const g = new Grid(Math.max(...rows.map((r) => r.length)) + 2, rows.length + 2);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (Object.hasOwn(colours, ch)) {
        g.p(x + 1, y + 1, colours[ch]!);
      }
    });
  });
  return toImage(g.outlined());
}

export const ARROW: readonly string[] = [
  "...a...",
  "..aaa..",
  ".aaaaa.",
  "aaaaaaa",
  "..aaa..",
  "..aaa..",
  "..aaa..",
];

// ---------- encounters ----------

// 49x22: a clawfoot tub from the front, its lip wider than its body, shaded on the right and
// underneath, on two grey feet, outlined in dslate so it holds on the grey tiles.
export function tub(): RgbaImage {
  const g = new Grid(49, 22);
  g.rect(0, 0, 49, 3, "white");
  g.rect(0, 2, 49, 1, "lgrey");
  g.rect(2, 3, 45, 12, "white");
  g.rect(3, 15, 43, 1, "white");
  g.rect(43, 3, 4, 12, "lgrey");
  g.rect(42, 15, 4, 1, "lgrey");
  g.rect(5, 16, 39, 1, "lgrey");
  for (const x of [7, 37]) {
    g.rect(x, 17, 5, 2, "grey");
    g.rect(x + 1, 19, 1, 1, "grey");
    g.rect(x + 3, 19, 1, 1, "grey");
  }
  g.edge = () => K.dslate!;
  return toImage(g.outlined());
}

// 51x9: white puffs shaded lgrey along the tub's lip, over the dog's legs.
export function foam(): RgbaImage {
  const g = new Grid(51, 9);
  for (const [cx, cy, r] of [
    [5, 5, 3.2],
    [11, 4, 4],
    [18, 5, 3.5],
    [33, 5, 3.5],
    [40, 4, 4],
    [46, 5, 3.2],
    [25, 6, 3],
  ] as const) {
    g.ell(cx, cy, r, r, "white", "lgrey");
  }
  g.edge = () => K.grey!;
  return toImage(g.outlined());
}

// A 5x5 white ring with a glint, slate-lined, floating over the tiles.
export function bathBubble(): RgbaImage {
  const g = new Grid(5, 5);
  g.ell(2.5, 2.5, 2.5, 2.5, "white");
  g.ell(2.5, 2.5, 1.5, 1.5, null);
  g.p(1, 1, "white");
  g.edge = () => K.slate!;
  return toImage(g.outlined());
}

export function skunkGrooming(): Art {
  const a = new Art();
  a.tilesBg();
  a.put("dog-archie", "walk", 37, 44, { shadow: false });
  a.paste(tub(), 13, 33);
  a.paste(foam(), 12, 28);
  for (const [x, y] of [
    [15, 14],
    [54, 10],
    [58, 22],
  ] as const) {
    a.paste(bathBubble(), x, y);
  }
  return a;
}

// A 2x2 cyan drop lit white at its top left, in a sky rim.
export function sprayDrop(): RgbaImage {
  const g = new Grid(2, 2);
  g.rect(0, 0, 2, 2, "cyan");
  g.p(0, 0, "white");
  g.edge = () => K.sky!;
  return toImage(g.outlined());
}

// 24x16: the hose lying on the lawn from the left edge, a grey spray nozzle at its end pointing up
// and right.
export function hose(): RgbaImage {
  const g = new Grid(24, 16);
  for (let x = 0; x < 14; x++) {
    g.rect(x, 12 + (x >= 4 && x < 10 ? 1 : 0), 1, 2, "forest");
  }
  g.rect(14, 11, 2, 3, "forest");
  g.rect(15, 9, 3, 3, "lgrey");
  g.rect(17, 7, 3, 3, "lgrey");
  g.rect(17, 11, 1, 1, "grey");
  g.rect(19, 9, 1, 1, "grey");
  return toImage(g.outlined());
}

// The hose on the lawn sprays an arc of drops onto Archie's back; the stink lines stay, as he is
// still Stinky.
export function skunkRinse(): Art {
  const a = new Art();
  a.grass();
  a.put("dog-archie", "walk", 44, 50, { i: 1 });
  a.paste(hose(), 0, 30);
  for (let t = 0; t < 9; t++) {
    const u = t / 8;
    a.paste(sprayDrop(), Math.round(20 + 20 * u), Math.round(34 - 30 * u + 26 * u * u));
  }
  for (const [x, y] of [
    [33, 18],
    [52, 16],
  ] as const) {
    a.paste(sprayDrop(), x, y);
  }
  a.skunkStink(58, 6);
  return a;
}

export function skunkIgnore(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  a.put("skunk", "idle", 18, 44);
  a.skunkStink(30, 6, 2);
  a.put("dog-archie", "walk", 56, 50, { i: 2 });
  a.skunkStink(52, 0, 2);
  return a;
}

// Cards show a 32x16 puddle; the road's is two lanes wide.
export function smallPuddle(f = 0): RgbaImage {
  return toImage(road.puddle(f, 32, 16).outlined(false));
}

export function otherDogSniff(): Art {
  const a = new Art();
  a.ground("highPark");
  a.put("other-dog", "walk", 46, 42);
  a.put("dog-archie", "walk", 30, 58);
  a.hearts([
    [6, 12],
    [14, 4],
    [25, 9],
  ]);
  return a;
}

export function otherDogPullAway(): Art {
  const a = new Art();
  a.ground("highPark");
  a.put("other-dog", "walk", 52, 44);
  const c = a.put("dog-archie", "pull", 22, 56, { flip: true });
  a.lead(22, c, 6);
  a.fill(70, 3, 2, 5, "red");
  a.fill(70, 9, 2, 2, "red");
  return a;
}

const BROKEN_HEART: readonly string[] = [
  ".rrr....rrr.",
  "rrrrr..rrrrr",
  "rrrrr..rrrrr",
  "rrrr...rrrrr",
  ".rrrr...rrr.",
  "..rrrr..rr..",
  "...rr..rr...",
  "....r..r....",
];

export function brokenHeart(a: Art, x: number, y: number): void {
  const g = new Grid(14, 10);
  BROKEN_HEART.forEach((row, yy) => {
    [...row].forEach((c, xx) => {
      if (c === "r") {
        g.p(xx + 1, yy + 1, "red");
      }
    });
  });
  g.rect(2, 2, 2, 2, "pink");
  a.paste(toImage(g.outlined()), x, y);
}

// Archie continues on his leash past the waiting corgi under a broken heart.
export function otherDogKeepMoving(): Art {
  const a = new Art();
  a.ground("highPark");
  a.fill(0, 0, AW, AH, "tan");
  a.put("other-dog", "idle", 55, 42);
  const c = a.dog("archie", "walk", 23, 59, { i: 2 });
  a.lead(23, c, 11);
  brokenHeart(a, 6, 3);
  return a;
}

// road.ts's tip pouch, outlined: road.TIP_POUCH held close, road.FAR_POUCH in a distant hand.
export function tipPouch({ far = false }: { far?: boolean } = {}): RgbaImage {
  return pixmap(far ? road.FAR_POUCH : road.TIP_POUCH, road.POUCH_INK);
}

// road.drawn(s, draw, ...args) as an outlined image, leaned k layout pixels as road.lean leans a
// person: the thief at scale s (road.SCALE is his road size).
export function thief<A extends unknown[]>(
  { k = 0 }: { k?: number },
  s: number,
  draw: (...args: A) => Drawable,
  ...args: A
): RgbaImage {
  const g = raster(road.drawn(s, draw, ...args));
  return toImage((k ? road.lean(g, k) : g).outlined());
}

// thiefTop without the pouch, his free arm (screen left) out level from the shoulder to grab: a
// lgrey sleeve banded ink as his shirt is, the hand at its end.
export function thiefReaching(g: Drawable, b: number): void {
  road.thiefTop(g, b, 0, false);
  g.rect(5, 22 + b, 4, 12, null);
  g.rect(2, 22 + b, 8, 4, "lgrey");
  for (const x of [3.5, 7]) {
    g.rect(x, 22 + b, 1.5, 4, "ink");
  }
  g.rect(0, 22 + b, 2.5, 4, "skin2");
}

// img standing on its shadow with its bottom row on foot; returns its top left.
export function stand(
  a: Art,
  img: RgbaImage,
  cx: number,
  foot: number,
  { shadow = true }: { shadow?: boolean } = {},
): [number, number] {
  const x = Math.round(cx - img.width / 2);
  const y = foot - img.height;
  if (shadow) {
    a.shadow(cx, foot - Math.floor((3 * img.height) / 48), img.width * 0.6);
  }
  a.paste(img, x, y);
  return [x, y];
}

// A 5x3 puff of dust kicked up at a paw, lgrey lit white.
export function dust(a: Art, x: number, y: number): void {
  a.fill(x + 1, y, 3, 1, "white");
  a.fill(x, y + 1, 5, 2, "lgrey");
}

// White motion ticks beside the ears of key's frame put at cx, foot: the ears flapping as it bounds.
export function earsFlying(
  a: Art,
  key: string,
  tag: string,
  cx: number,
  foot: number,
  i = 0,
): void {
  const f = sn.frame(key, tag, i);
  const [x0, y0, x1] = bbox(f);
  const left = Math.round(cx - f.width / 2);
  const top = foot - f.height;
  for (const [x, d] of [
    [left + x0 - 2, 1],
    [left + x1 + 1, -1],
  ] as const) {
    a.fill(x, top + y0 + 1, 1, 2, "white");
    a.fill(x + d, top + y0 + 3, 1, 1, "white");
  }
}

// Let the tips go: Archie stands watching the thief run off up the street with the walker's green
// tip pouch swinging from his hand, dust puffing at his heels.
export function thiefLetGo(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  const s = 0.8;
  const t = thief({}, s, road.thiefFleeing, 1, false);
  const [x, y] = stand(a, t, 50, 40);
  // the pouch hangs from his back-swung hand (screen right), layout 23..27 x 31..33
  a.paste(tipPouch(), x + Math.round(23 * s), y + Math.round(30 * s));
  dust(a, x + 4, y + t.height - 4);
  dust(a, x + 18, y + t.height - 2);
  for (const [lx, ly, h] of [
    [40, 6, 5],
    [64, 4, 6],
    [66, 16, 5],
  ] as const) {
    a.fill(lx, ly, 1, h, "lgrey");
  }
  const c = a.put("dog-archie", "idle", 20, 58);
  a.lead(20, c, 12);
  return a;
}

// Grab it back: a tug-of-war over the tip pouch. The thief leans back on the right, his arm out to
// the pouch's drawstring pulled taut to his fist; Archie, dug in on the left, has the pouch's other
// end in his mouth, out of sight behind his head, and his leash runs off the bottom edge. Strain
// ticks either side of the pouch and a red ! over Archie.
export function thiefGrabBack(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  const s = 1.2;
  const t = thief({ k: 3 }, s, road.dressed, thiefReaching);
  const [x, y] = stand(a, t, 56, 56);
  const handX = x + 1;
  const handY = y + Math.round(24 * s);
  const px = 24;
  const py = handY - 4;
  a.paste(tipPouch(), px, py);
  a.line(px + 5, py + 1, handX, handY, "cream");
  const c = a.put("dog-archie", "pull", 22, 58, { flip: true });
  a.lead(22, c, 8, 2);
  for (const [tx, ty] of [
    [px + 3, py - 4],
    [px + 8, py - 3],
    [px + 4, py + 12],
    [px + 9, py + 11],
  ] as const) {
    a.fill(tx, ty, 1, 2, "white");
  }
  a.fill(8, 3, 2, 5, "red");
  a.fill(8, 9, 2, 2, "red");
  return a;
}

// Dogs give chase: Archie in full zoomies up the street after the thief, who runs off at the right
// clutching the tip pouch. Archie bounds off the ground over his shadow, ears flapping, his leash
// streaming back off the bottom edge, two lgrey speed lines under him and dust kicked up at his paws.
export function thiefGiveChase(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  const s = 0.65;
  const t = thief({}, s, road.thiefFleeing, -1, false);
  const [x, y] = stand(a, t, 54, 34);
  a.paste(tipPouch({ far: true }), x + Math.round(4 * s) - 3, y + Math.round(31 * s));
  dust(a, x + 8, y + t.height - 3);
  const cx = 26;
  const foot = 54;
  a.shadow(cx, foot, 20);
  const c = a.dog("archie", "react", cx, foot - 6, { i: 2, shadow: false });
  earsFlying(a, "dog-archie", "react", cx, foot - 6, 2);
  a.lead(cx, c, cx - 6);
  for (const [lx, ly, h] of [
    [cx - 15, 38, 10],
    [cx + 15, 36, 10],
  ] as const) {
    a.fill(lx, ly, 1, h, "lgrey");
  }
  dust(a, cx - 10, foot - 2);
  dust(a, cx + 6, foot - 1);
  return a;
}

// ---------- lucky encounters ----------

// The found wallet's $: 5x9, bold enough to read at 1x on the front bill.
export const BILL_DOLLAR: readonly string[] = [
  "..x..",
  ".xxxx",
  "x.x..",
  "x.x..",
  ".xxx.",
  "..x.x",
  "..x.x",
  "xxxx.",
  "..x..",
];

// 44x34, the found wallet close up: a brown leather wallet, lit tan along its top and stitched, its
// flap tab on the right with an amber snap, two green bills standing up out of it, the front one lit
// along its top with a white $.
export function foundWallet(): Grid {
  const g = edged(new Grid(44, 34));
  // the bills, the back one a shade darker and set left, standing up out of the wallet
  g.rect(7, 2, 22, 16, "dgreen");
  g.rect(7, 2, 22, 1, "green");
  g.rect(13, 5, 22, 16, "green");
  g.rect(13, 5, 22, 1, "lgrey");
  g.rect(15, 7, 18, 1, "dgreen");
  bitmap(g, 22, 8, BILL_DOLLAR, { x: "white" });
  // the wallet, its top edge lit and a stitched seam under it, shaded down the right and along the
  // bottom
  g.rect(3, 16, 38, 17, "brown");
  g.rect(3, 16, 38, 1, "tan");
  g.rect(3, 32, 38, 1, "dbrown");
  g.rect(40, 16, 1, 17, "dbrown");
  for (let x = 5; x < 38; x += 3) {
    g.rect(x, 18, 2, 1, "dbrown");
  }
  // the flap tab with its snap
  g.rect(28, 22, 13, 7, "dbrown");
  g.rect(28, 22, 13, 1, "brown");
  g.rect(33, 24, 3, 3, "amber");
  g.p(33, 24, "yellow");
  return g;
}

// The found wallet, big and alone with a glint, cut out to float over the road: a lucky find shows
// the thing found. Its two sparkles are solid yellow plus signs, 5px across, so they read as glints
// and not as scattered dots.
export function walletKeep(): Art {
  const a = new Art({ clear: true });
  const img = toImage(foundWallet().outlined());
  const x = Math.floor((AW - img.width) / 2);
  const y = AH - img.height - 6;
  a.paste(img, x, y);
  for (const [sx, sy] of [
    [x + img.width - 2, y + 3],
    [x + 2, y + 8],
  ] as const) {
    a.fill(sx - 2, sy, 5, 1, "yellow");
    a.fill(sx, sy - 2, 1, 5, "yellow");
  }
  return a;
}

// The friendly neighbour crouched beside a pack dog, reaching up to pat it on the head between its
// ears, hearts rising from the dog. Her road sprite's lowered forearm is cut away and her arm drawn
// raised instead: a mauve sleeve shaded purple in a plum outline, her hand on the dog's crown. Her
// floating heart sits above the art window, so it is left out here. Cut out to float over the road.
export function neighbourTake(): Art {
  const a = new Art({ clear: true });
  a.put("dog-archie", "idle", 47, 57, { shadow: false });
  const her = sn.frame("friendly-neighbour", "wave", 1);
  const clear = [0, 0, 0, 0] as const;
  fill({ rect: { height: 14, width: her.width - 34, x: 34, y: 0 } }, clear, her);
  const top = 66 - her.height;
  fill(
    { rect: { height: her.height - (30 - top), width: her.width - 35, x: 35, y: 30 - top } },
    clear,
    her,
  );
  a.paste(her, -2, top);
  // the sleeve: the upper arm out from her shoulder to the elbow, the forearm up to the dog's crown
  const joints = [
    [31, 31],
    [37, 29],
    [44, 21],
  ] as const;
  const arm: [number, number][] = [];
  for (let j = 0; j + 1 < joints.length; j++) {
    const [x0, y0] = joints[j]!;
    const [x1, y1] = joints[j + 1]!;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k < n + 1; k++) {
      arm.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)]);
    }
  }
  for (const [x, y] of arm) {
    a.fill(x - 1, y - 1, 5, 5, "plum");
  }
  for (const [x, y] of arm) {
    a.fill(x, y, 3, 3, "mauve");
  }
  for (const [x, y] of arm) {
    a.fill(x + 2, y + 2, 1, 1, "purple");
  }
  // the hand, palm down on the crown between the ears: the back of it, a thumb out to the left and
  // three fingers curled over the dog's brow, in a plum outline
  const hand = new Set<string>();
  for (let x = 45; x < 51; x++) {
    for (let y = 17; y < 20; y++) {
      hand.add(`${x},${y}`);
    }
  }
  for (const p of ["44,19", "45,20", "47,20", "49,20", "45,21", "47,21", "49,21"]) {
    hand.add(p);
  }
  const cells = [...hand].map((p) => p.split(",").map(Number) as [number, number]);
  for (const [x, y] of cells) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      if (!hand.has(`${x + dx},${y + dy}`)) {
        a.fill(x + dx, y + dy, 1, 1, "plum");
      }
    }
  }
  for (const [x, y] of cells) {
    a.fill(x, y, 1, 1, y === 21 || x === 50 ? "skin2" : "skin1");
  }
  // three hearts rising over the pair, clear of her face, so she and the dog stay the focal point
  a.hearts([
    [44, 3],
    [57, 9],
    [66, 2],
  ]);
  return a;
}

// ---------- upgrades and the Skip option ----------

// A leg w pixels thick along the joints pts.
export function limb(
  g: Drawable,
  pts: readonly (readonly [number, number])[],
  col: string,
  w = 2,
): void {
  for (let j = 0; j + 1 < pts.length; j++) {
    const [x0, y0] = pts[j]!;
    const [x1, y1] = pts[j + 1]!;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k < n + 1; k++) {
      g.rect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), w, w, col);
    }
  }
}

// A paw seen from below, 5x5: three toe beans over the main pad, all pink on the white sock.
export const PAW: readonly string[] = ["pwpwp", "wwwww", "wpppw", "wpppw", ".www."];

export function paw(g: Drawable, x: number, y: number, col = "white"): void {
  PAW.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        g.p(x + i, y + j, ch === "p" ? "pink" : col);
      }
    });
  });
}

// Archie's bobtail on card-belly-rubs, laid at 2,20 of rolledOver's grid (b brown, d dbrown, p plum,
// w white, . left as drawn): three locks fanned out to the left, the middle one tipped white, a plum
// line where they meet the rump.
export const BOBTAIL: readonly string[] = [
  "..bb...",
  "..bbbbp",
  "...ddbp",
  "wwbbbbp",
  "wwbddbp",
  "...bbbp",
  "..bbbdp",
  "..bd...",
];
export const BOBTAIL_INK: Readonly<Record<string, string>> = {
  b: "brown",
  d: "dbrown",
  p: "plum",
  w: "white",
};

// Archie rolled onto his back: the brown body lies along the grass, its back down in dbrown, and the
// white belly up, pink at its middle. The legs fold: the hind pair splay out at the knee with the
// soles up, the front pair flop at the wrist, copper at the top and white below, each white paw
// showing its pink pads; the far leg of each pair is shaded. The bobtail (BOBTAIL), a tuft of three
// locks tipped white, wags on the grass at the left, the head at the right faces the viewer with the
// white blaze and muzzle and copper brows and cheeks, eyes shut in happy arcs and mouth open in a
// grin with the tongue out, the rose ears flopped on the grass. The red bandana rings the neck, its
// point lying on the white chest. 50x36 with its outline; the collar's lower end is at 32,28.
export function rolledOver(): RgbaImage {
  const g = new Grid(50, 36);
  // far legs first, shaded: a hind leg splayed at the knee and a front leg flopped at the wrist
  limb(
    g,
    [
      [16, 17],
      [14, 11],
    ],
    "rust",
  );
  limb(
    g,
    [
      [14, 11],
      [16, 7],
    ],
    "lgrey",
  );
  paw(g, 15, 2, "lgrey");
  limb(
    g,
    [
      [25, 16],
      [23, 11],
    ],
    "rust",
  );
  limb(
    g,
    [
      [23, 11],
      [26, 10],
    ],
    "lgrey",
  );
  paw(g, 25, 6, "lgrey");
  // the body, back down
  g.ell(21, 22, 13, 6.5, "brown", "dbrown");
  g.ell(21, 27.5, 11, 2, "dbrown");
  g.ell(21.5, 18.5, 9, 3.2, "white", "lgrey");
  g.rect(19, 18, 4, 2, "pink");
  g.rect(20, 17, 2, 1, "pink");
  // the bobtail on the grass at the rump, a tuft of three locks fanned out to the left, the middle
  // one tipped white, set off from the coat by a plum line
  BOBTAIL.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        g.p(i + 2, j + 20, BOBTAIL_INK[ch]!);
      }
    });
  });
  // near legs: the hind thigh out to the left, the shin back up to the sole; the front leg up from
  // the chest, the forearm flopped toward the head
  limb(
    g,
    [
      [11, 19],
      [7, 13],
    ],
    "ochre",
  );
  limb(
    g,
    [
      [7, 13],
      [8, 8],
    ],
    "white",
  );
  paw(g, 6, 3);
  limb(
    g,
    [
      [29, 16],
      [29, 12],
    ],
    "ochre",
  );
  limb(
    g,
    [
      [29, 12],
      [29, 11],
      [32, 11],
    ],
    "white",
  );
  paw(g, 32, 8);
  // rose ears flopped on the grass either side of the head
  g.ell(33.5, 26, 2.5, 4, "dbrown", "plum");
  g.ell(44.5, 26, 2.5, 4, "dbrown", "plum");
  // the head, facing the viewer: the white blaze up the forehead into the white muzzle, copper brows
  // and cheeks
  g.ell(39, 20, 7, 6.5, "brown", "dbrown", "skin2");
  g.rect(38, 14, 2, 6, "white");
  g.p(35, 17, "ochre");
  g.p(42, 17, "ochre");
  g.rect(33, 22, 2, 2, "ochre");
  g.rect(44, 22, 2, 2, "ochre");
  g.ell(39, 23.5, 3.6, 2.6, "white", "lgrey");
  g.rect(38, 21, 3, 1, "plum");
  // eyes shut in happy arcs, curving up
  for (const x of [34, 41]) {
    g.p(x, 20, "ink");
    g.rect(x + 1, 19, 2, 1, "ink");
    g.p(x + 3, 20, "ink");
  }
  // a wide open grin under the nose, the tongue hanging from it
  g.p(36, 23, "ink");
  g.rect(37, 24, 5, 1, "ink");
  g.p(42, 23, "ink");
  g.rect(38, 25, 3, 3, "pink");
  g.p(39, 25, "red");
  // the red bandana between the head and the chest, its point on the chest, the leash ring at its
  // end
  g.tri([31, 17], [31, 24], [27, 20.5], "red");
  g.tri([31, 20.5], [31, 24], [27, 20.5], "dred");
  g.rect(31, 15, 2, 12, "red");
  g.rect(32, 15, 1, 12, "dred");
  g.p(32, 26, "amber");
  return toImage(g.outlined());
}

// A 1px motion arc beside a kicking paw, bowed away from it (d=1 right, -1 left).
export function kick(a: Art, x: number, y: number, d: number): void {
  for (const [dy, dx] of [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 0],
  ] as const) {
    a.fill(x + dx * d, y + dy, 1, 1, "white");
  }
}

export function bellyRubs(): Art {
  const a = new Art();
  a.grass();
  a.paste(rolledOver(), 12, 10);
  // kicking paws and a wriggling back, drawn as motion arcs
  kick(a, 15, 13, -1);
  kick(a, 51, 18, 1);
  kick(a, 11, 32, -1);
  // the leash runs from the collar off the bottom edge
  a.lead(44, 38, 52);
  a.hearts([
    [4, 4],
    [60, 6],
  ]);
  return a;
}

export function goodLeash(): Art {
  const a = new Art();
  a.ground("highPark");
  a.put("squirrel", "idle", 58, 37);
  const c = a.put("dog-archie", "walk", 30, 56, { i: 1 });
  a.lead(30, c, 24, 2);
  a.fill(29, c - 1, 3, 3, "amber");
  // tick: the chaser ignores the squirrel
  const tick = [
    [52, 44],
    [53, 45],
    [54, 46],
    [55, 45],
    [56, 44],
    [57, 43],
    [58, 42],
    [59, 41],
  ] as const;
  tick.forEach(([x, y], i) => {
    a.fill(x, y, 2, 2, i % 2 ? "green" : "dgreen");
  });
  return a;
}

export function bigTipper(): Art {
  const a = new Art();
  a.ground("kensingtonMarket");
  // three coins face on, stacked two and one, under an up arrow
  for (const [x, y] of [
    [8, 34],
    [26, 34],
    [17, 18],
  ] as const) {
    a.paste(sn.frame("tip", "idle"), x, y);
  }
  a.arrow(50, 10, -1);
  return a;
}

export function rushHour(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  a.put("skunk", "idle", 52, 55);
  for (const [x, y] of [
    [4, 10],
    [20, 18],
    [6, 28],
  ] as const) {
    a.paste(sn.frame("tip", "idle"), x, y);
  }
  a.arrow(62, 2, -1);
  return a;
}

// 24x17, a yellow raincoat seen from behind, as a dog wears it: a coat over the back with its top
// corners rounded and a straight hem, lit along its top and shaded down its right side and along the
// hem, and the hood folded down at the nape over it, casting an orange line on the coat. In an
// outline.
export function raincoat(): RgbaImage {
  const g = new Grid(24, 17);
  const coat: (readonly [number, number])[] = [
    [3, 20],
    [2, 21],
    ...Array<[number, number]>(11).fill([1, 22]),
  ];
  coat.forEach(([x0, x1], j) => {
    g.rect(x0, j + 3, x1 - x0 + 1, 1, "amber");
  });
  g.rect(3, 3, 18, 1, "yellow");
  g.rect(2, 4, 1, 1, "yellow");
  g.rect(21, 4, 2, 11, "orange");
  g.rect(1, 15, 22, 1, "orange");
  // the hood, folded down
  for (const [j, [x0, x1]] of (
    [
      [8, 15],
      [7, 16],
      [7, 16],
      [7, 16],
    ] as const
  ).entries()) {
    g.rect(x0, j + 1, x1 - x0 + 1, 1, "amber");
  }
  g.rect(8, 1, 8, 1, "yellow");
  g.rect(16, 2, 1, 3, "orange");
  g.rect(7, 5, 10, 1, "orange");
  return toImage(g.outlined());
}

// Archie in a yellow raincoat, standing in a puddle in the rain.
export function raincoats(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  a.paste(smallPuddle(1), 22, 38);
  a.put("dog-archie", "walk", 37, 50, { shadow: false });
  a.paste(raincoat(), 25, 27);
  for (const [x, y] of [
    [6, 4],
    [16, 12],
    [26, 2],
    [54, 8],
    [64, 16],
    [12, 28],
    [60, 30],
    [48, 2],
  ] as const) {
    a.fill(x, y, 1, 3, "cyan");
  }
  return a;
}

export function sweetTalker(): Art {
  const a = new Art();
  a.grass();
  a.face("face-owner-pepe", "happy", 6, 14);
  // cheaper per dog: the cost in the bubble, and a down arrow beside it
  a.bubble(40, 8, 32, [""]);
  sn.text(a, "$$", 45, 12, "forest");
  a.arrow(57, 11, 1);
  a.heart(50, 38, "red", "pink");
  a.heart(60, 44, "red", "pink");
  return a;
}

// Walk on by: the skunk waits at the left while Archie trots on past it up the street, and the Hall
// pass held up over them (glyphs.ts's 20x20 icon).
export function skip(): Art {
  const a = new Art();
  a.ground("distilleryDistrict");
  a.put("skunk", "idle", 16, 49);
  const c = a.put("dog-archie", "walk", 56, 58, { i: 2 });
  a.lead(56, c, 62);
  a.paste(glyphs.image(glyphs.gearHallPass20), 26, 1);
  return a;
}

// ---------- forks ----------
// A fork's path card looks down the zone's road to a cross street, the zone's far side beyond it as
// its backdrop draws it, in miniature. Rows: the far side stands on row FAR_Y, then the far sidewalk
// from WALK_Y, the far curb from CURB_Y, the cross street from CROSS_Y with its centre line on
// LINE_Y, and from STUB_Y the zone's road in projection, sampled from its road strip: SPREAD * (row
// centre - HORIZON) pixels either side of the centre, the curb, sidewalk and lawn beside it.
export const FAR_Y = 21;
export const WALK_Y = 22;
export const CURB_Y = 25;
export const CROSS_Y = 26;
export const LINE_Y = 29;
export const STUB_Y = 33;
export const HORIZON = 12.0;
export const SPREAD = 0.75;
// A stub row samples strip row FOCAL / scale: about 2 rows apart near, 7 far.
export const FOCAL = 16;
// A stub divider's dashes repeat every 1 / DASH of log(row centre - HORIZON).
export const DASH = 5.0;
// A far house's windows and door, as backdrops.ts's house parts.
export const MINI: bd.HouseParts = [2, 6, 5, 7];

export function tufted(lawn = "green", rate = 0.05): bd.Paint {
  return (px, py) => (bd.noise(px, py) < rate || bd.noise(px, py - 1) < rate ? dk(lawn) : lawn);
}

// A ground of base with about one fleck in n, and a sparser second fleck.
export function flecked(
  base: string,
  fleck: string,
  n = 23,
  second: string | null = null,
): bd.Paint {
  return (px, py) => {
    if (bd.hashed(px, py, n)) {
      return fleck;
    }
    return second && bd.hashed(px, py + 3, n + 8) ? second : base;
  };
}

// The promenade's boards across the cross street, a seam every 5 columns.
export function boards(px: number, py: number): string {
  return px % 5 === 0 ? "tan" : flecked("cream", "tan", 27)(px, py);
}

export const DEFAULT_LAWN = tufted();

export interface ZoneViewOptions {
  curb?: string | null;
  edge?: string | null;
  lawn?: bd.Paint;
  walk?: string | null;
  walkFleck?: string;
}

// A zone's path card illustration. roadPx(px, py) paints the cross street, yard(px, py) the far
// side's ground and lawn(px, py) the near corners past the sidewalk; mark is the cross street's
// centre line, dashed [on, period] or solid with null, over an edge row where given, or null for a
// lane with no line. walk and curb are the sidewalks' and curbs' colours, null where the zone has
// none, and walkFleck the sidewalks' flecks.
export class ZoneView extends Art {
  readonly curb: string | null;
  readonly dash: readonly [number, number] | null;
  readonly duty: number;
  readonly edge: string | null;
  readonly lane: (string | null)[];
  readonly lawn: bd.Paint;
  readonly mark: string | null;
  readonly roadPx: bd.Paint;
  readonly seams: number[];
  readonly strip: Frame;
  readonly walk: string | null;
  readonly walkFleck: string;
  readonly yard: bd.Paint;

  constructor(
    zone: string,
    roadPx: bd.Paint,
    yard: bd.Paint,
    mark: string | null,
    dash: readonly [number, number] | null,
    {
      curb = "grey",
      edge = null,
      lawn = DEFAULT_LAWN,
      walk = "lgrey",
      walkFleck = "grey",
    }: ZoneViewOptions = {},
  ) {
    super();
    this.roadPx = roadPx;
    this.yard = yard;
    this.lawn = lawn;
    this.mark = mark;
    this.dash = dash;
    this.edge = edge;
    this.curb = curb;
    this.walk = walk;
    this.walkFleck = walkFleck;
    const [ground, lines] = roads.ZONES.get(zone)!;
    const g = new Grid(roads.W, roads.H);
    ground(g);
    this.strip = g.px.map((row) => [...row]);
    lines(g);
    // each of the stub's dividers takes its strip line's colour, solid or dashed as the strip's are;
    // a strip with no lines (High Park's path) leaves the stub without them
    const marked = roads.DIVIDERS.map((x) => {
      const m: string[] = [];
      for (let y = 0; y < roads.H; y++) {
        if (g.px[y]![x] !== this.strip[y]![x]) {
          m.push(g.px[y]![x]!);
        }
      }
      return m;
    });
    this.lane = marked.map((m) => (m.length ? mostCommon(counted(m)) : null));
    const first = marked[0]!.length;
    this.duty = first === roads.H ? 1 : Math.max(0.5, first / roads.H);
    // lines along the road (board seams): columns off the base colour in 3 rows of 4
    const base = mostCommon(counted(this.strip.flat()));
    const lanes = new Set(roads.DIVIDERS.flatMap((x) => [x, x + 1]));
    this.seams = [];
    for (let x = 8; x < roads.W - 8; x++) {
      let off = 0;
      for (let y = 0; y < roads.H; y++) {
        off += this.strip[y]![x] !== base ? 1 : 0;
      }
      if (!lanes.has(x) && off >= 0.75 * roads.H) {
        this.seams.push(x);
      }
    }
  }

  sky(top: string, low: string): void {
    this.fill(0, 0, AW, FAR_Y, low);
    this.fill(0, 0, AW, 4, top);
    for (let i = 0; i < AW; i += 5) {
      this.fill(i, 4 + (Math.floor(i / 5) % 2), 5, 1, top);
    }
  }

  // Treetops along row, rising lo to hi rows, over a lawn down to the far side's ground.
  treeline(
    row: number,
    cols: readonly [string, string],
    phase: number,
    lo: number,
    hi: number,
  ): void {
    for (let x = 0; x < AW; x++) {
      const h =
        lo + Math.round((hi - lo) * (0.5 + 0.5 * Math.sin(x * 0.45 + phase) * Math.cos(x * 0.21)));
      this.fill(x, row - h, 1, h, cols[0]);
      this.fill(x, row - h, 1, 1, cols[1]);
    }
    this.fill(0, row, AW, FAR_Y - row, "green");
  }

  // The far yard, sidewalk and curb, the cross street and the stub with its corners.
  street(): void {
    for (let py = FAR_Y; py < AH; py++) {
      for (let px = 0; px < AW; px++) {
        this.fill(px, py, 1, 1, this.groundPx(px, py));
      }
    }
    this.despeckle(FAR_Y);
    const mark = this.mark;
    if (mark) {
      for (let px = 0; px < AW; px++) {
        if (!this.dash || (px + 2) % this.dash[1] < this.dash[0]) {
          this.fill(px, LINE_Y, 1, 1, mark);
          if (this.edge) {
            this.fill(px, LINE_Y + 1, 1, 1, this.edge);
          }
        }
      }
    }
    this.lanes();
  }

  // Turn every lone pixel from row top down, one whose four neighbours share another colour, to that
  // colour: the strip's and the ground painters' flecks turn to noise at 1x. Seams and dashes 2px or
  // longer keep a neighbour of their own colour and stay.
  despeckle(top: number): void {
    const d = this.img.data;
    const src = d.slice();
    const at = (x: number, y: number): number => {
      const i = (y * AW + x) * 4;
      return (src[i]! | (src[i + 1]! << 8) | (src[i + 2]! << 16) | (src[i + 3]! << 24)) >>> 0;
    };
    for (let y = Math.max(1, top); y < AH - 1; y++) {
      for (let x = 1; x < AW - 1; x++) {
        const around = new Set([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]);
        if (around.size === 1 && !around.has(at(x, y))) {
          const i = ((y - 1) * AW + x) * 4;
          d.set(src.subarray(i, i + 4), (y * AW + x) * 4);
        }
      }
    }
  }

  walkPx(px: number, py: number): string {
    return bd.hashed(px, py, 29) ? this.walkFleck : this.walk!;
  }

  groundPx(px: number, py: number): string {
    if (py < WALK_Y) {
      return this.yard(px, py);
    }
    if (py < CURB_Y) {
      return this.walk ? this.walkPx(px, py) : this.lawn(px, py);
    }
    if (py < CROSS_Y) {
      return this.curb || this.roadPx(px, py);
    }
    if (py < STUB_Y) {
      return this.roadPx(px, py);
    }
    const hw = SPREAD * (py + 0.5 - HORIZON);
    const a = Math.abs(px + 0.5 - AW / 2);
    if (a < hw) {
      return this.stubPx(px, py, hw / bd.ROAD);
    }
    if (this.curb && a < hw + 1) {
      return this.curb;
    }
    if (this.walk && (py < STUB_Y + 3 || a < (hw * bd.WALK) / bd.ROAD)) {
      return this.walkPx(px, py);
    }
    return this.lawn(px, py);
  }

  // The strip at scale s: the pixel under this one's centre, or a seam in its span, so the 1px seams
  // along the road never drop out.
  stubPx(px: number, _py: number, s: number): string {
    const row = this.strip[Math.trunc(FOCAL / s) % roads.H]!;
    const u0 = roads.W / 2 + (px - AW / 2) / s;
    const u1 = roads.W / 2 + (px + 1 - AW / 2) / s;
    const seam = this.seams.find((x) => u0 <= x && x < u1);
    return row[seam ?? Math.min(roads.W - 1, Math.trunc((u0 + u1) / 2))]!;
  }

  // The stub's four dividers, 1px wide, the dashes at least half on and shortening with distance.
  lanes(): void {
    for (let py = STUB_Y; py < AH; py++) {
      if (this.duty < 1 && (DASH * Math.log(py + 0.5 - HORIZON)) % 1 >= this.duty) {
        continue;
      }
      const s = (SPREAD * (py + 0.5 - HORIZON)) / bd.ROAD;
      roads.DIVIDERS.forEach((x, k) => {
        const c = this.lane[k];
        if (c) {
          this.fill(Math.floor(AW / 2 + (x + 1 - roads.W / 2) * s), py, 1, 1, c);
        }
      });
    }
  }
}

// ---------- the Toronto neighbourhoods' path cards, after their backdrops ----------

export function cabbagetownView(): ZoneView {
  const a = new ZoneView(
    "cabbagetown",
    flecked("grey", "slate", 53),
    tufted("olive"),
    "white",
    [2, 6],
    {
      curb: "dstone",
      lawn: tufted("olive"),
      walk: "stone",
      walkFleck: "dstone",
    },
  );
  bd.bands(a, 0, FAR_Y, ["lilac", "pink", "peach", "gold"], { w: AW });
  for (let dy = -4; dy < 5; dy++) {
    for (let dx = -4; dx < 5; dx++) {
      if (dx * dx + dy * dy <= 16 && (dx + 2) ** 2 + (dy - 1) ** 2 > 10) {
        a.fill(10 + dx, 5 + dy, 1, 1, "cream");
      }
    }
  }
  for (const [x, y] of [
    [24, 2],
    [40, 4],
    [56, 1],
    [70, 6],
  ] as const) {
    a.fill(x, y, 1, 1, "white");
  }
  for (const x of [14, 61]) {
    bd.tree(a, x, 10, { base: FAR_Y, girth: 2, leaf: "canopy", r: 5, shade: "pine" });
  }
  for (const [x, w, wallC, roof, curtain, top] of [
    [-21, 28, "brick", "shale", undefined, 3],
    [23, 30, "cream", "slate", "gold", 2],
    [69, 28, "brick", "dslate", "gold", 3],
  ] as const) {
    bd.house(a, x, w, wallC, roof, {
      base: FAR_Y,
      curtains: curtain,
      door: "forest",
      parts: MINI,
      roofH: 9,
      top,
    });
    const half = w / 2 + 3;
    for (let i = 1; i < 9; i++) {
      const inset = Math.round((i * half) / 9);
      const left = x - 3 + (Math.floor(w / 2) + 3) - inset;
      a.fill(left, top + i, 1, 1, "white");
      a.fill(left + 2 * inset - 1, top + i, 1, 1, "white");
    }
  }
  a.street();
  bd.ironFence(a, FAR_Y - 3, 0, 32, { h: 5 });
  bd.ironFence(a, FAR_Y - 3, 46, AW, { h: 5 });
  return a;
}

// The zoo's llama at the card's scale, as backdrops.ts's LLAMA: facing left, its far side driftwood.
export const MINI_LLAMA: readonly string[] = [
  ".c....",
  "cc....",
  ".c....",
  ".ccccc",
  ".ccccs",
  ".c..c.",
  ".s..s.",
];

export function highParkView(): ZoneView {
  const trail = flecked("tan", "brown", 23, "skin2");
  const dark = tufted("pine");
  // the cross path's middle worn skin1 in broken runs, as the backdrop's, with no line painted on it
  const a = new ZoneView("high-park", trail, dark, "skin1", [9, 13], {
    curb: null,
    lawn: dark,
    walk: null,
  });
  a.sky("azure", "sky");
  // the far ridge in dturq, then the canopy, a tall oak over it on the right
  for (let x = 0; x < AW; x++) {
    const top = 6 + Math.round(2 * (0.5 + 0.5 * Math.sin(x * 0.6) * Math.cos(x * 0.23)));
    a.fill(x, top, 1, 15 - top, "dturq");
  }
  a.treeline(15, ["fir", "pine"], 0, 2, 6);
  a.fill(0, 15, AW, FAR_Y - 15, "pine");
  // the oak: a broad flat-bottomed crown, olive on its lit upper left, pine underneath
  a.fill(68, 8, 2, 10, "bark");
  for (let py = 1; py < 10; py++) {
    for (let px = 61; px < AW; px++) {
      const u = (px + 0.5 - 69) / 7.5;
      const v = (py + 0.5 - 6) / 4.5;
      if (u * u + v * v <= 1 && py < 9) {
        a.fill(px, py, 1, 1, v > 0.3 ? "pine" : u + v < -0.6 ? "olive" : "canopy");
      }
    }
  }
  bd.tree(a, 4, 9, { base: 18, girth: 2, leaf: "pink", r: 6, shade: "mauve" });
  // the High Park Zoo's log arch at the trail's end, as the backdrop's: olive paddocks behind a rail
  // fence, a llama in the right one, a closed plank gate between log posts under a log beam, and a
  // plank sign hung from it reading ZOO (the card's label names the park)
  a.fill(0, 12, AW, FAR_Y - 12, "olive");
  bd.figure(a, 58, 16, MINI_LLAMA, bd.LLAMA_COLOURS);
  for (const [x0, x1] of [
    [0, 25],
    [50, AW],
  ] as const) {
    a.fill(x0, 16, x1 - x0, 1, "tan");
    a.fill(x0, 17, x1 - x0, 1, "brown");
    for (let x = x0 + 4; x < x1 - 1; x += 8) {
      a.fill(x, 15, 2, FAR_Y - 15, "bark");
    }
  }
  a.fill(27, 14, 21, 7, "tan");
  for (let x = 29; x < 48; x += 3) {
    a.fill(x, 14, 1, 7, "brown");
  }
  a.fill(27, 15, 21, 1, "brown");
  a.fill(27, 19, 21, 1, "brown");
  a.fill(37, 14, 1, 7, "walnut");
  for (const x of [24, 48]) {
    a.fill(x, 3, 3, FAR_Y - 3, "bark");
    a.fill(x + 2, 3, 1, FAR_Y - 3, "walnut");
  }
  a.fill(20, 0, 35, 3, "bark");
  a.fill(20, 2, 35, 1, "walnut");
  for (const x of [20, 53]) {
    a.fill(x, 0, 2, 3, "tan");
  }
  a.fill(23, 3, 29, 11, "walnut");
  a.fill(24, 4, 27, 9, "brown");
  a.fill(24, 4, 27, 1, "tan");
  bd.word(a, "ZOO", AW / 2, 5, "cream");
  a.street();
  for (let py = FAR_Y; py < CROSS_Y; py++) {
    const half = 7 + Math.floor((py - 13) / 2);
    for (let px = Math.round(AW / 2) - half; px < Math.round(AW / 2) + half; px++) {
      a.fill(px, py, 1, 1, trail(px, py));
    }
  }
  return a;
}

export function distilleryView(): ZoneView {
  const paving = flecked("brown", "brick", 19);
  const a = new ZoneView("distillery-district", flecked("dslate", "navy", 61), paving, null, null, {
    curb: null,
    lawn: paving,
    walk: "brown",
    walkFleck: "brick",
  });
  bd.bands(a, 0, 13, bd.DISTILLERY_SKY, { w: AW });
  bd.sun(a, 38, 9, 5, "yellow", 12);
  // the condo towers behind the old brick either side of the sun, dim in the haze
  for (const [x, w, top] of [
    [23, 7, 3],
    [47, 8, 0],
  ] as const) {
    a.fill(x, top, w, FAR_Y - top, "skin2");
    a.fill(x + w - 2, top, 2, FAR_Y - top, "brown");
    for (let y = top + 2; y < FAR_Y; y += 3) {
      a.fill(x + 1, y, w - 4, 1, "tan");
    }
  }
  a.fill(2, 0, 5, FAR_Y, "brick");
  a.fill(5, 0, 2, FAR_Y, "dbrick");
  // the gallery, the low warehouse across the square under its sign, the theatre's lit lobby and
  // marquee
  bd.warehouse(a, -6, 26, 2, FAR_Y, "brick", "stone", "skin1", { rows: 1 });
  bd.warehouse(a, 20, 36, 13, FAR_Y, "brick", "stone", undefined, { rows: 0 });
  a.fill(25, 14, 26, 4, "dbrick");
  a.fill(25, 14, 26, 1, "coal");
  bd.warehouse(a, 56, 26, 1, FAR_Y, "dbrick", "stone", undefined, { rows: 1 });
  a.fill(57, 17, 22, 4, "gold");
  a.fill(57, 15, 22, 2, "coal");
  for (let x = 57; x < 79; x += 3) {
    a.fill(x, 15, 1, 1, "yellow");
  }
  // Still Dancing's mast and loops, and café umbrellas in the square
  a.fill(16, 2, 1, FAR_Y - 2, "coal");
  for (const [y, col] of [
    [4, "red"],
    [8, "turquoise"],
    [12, "lilac"],
  ] as const) {
    a.fill(13, y, 7, 1, col);
    a.fill(14, y + 1, 5, 1, col);
  }
  for (const [cx, col] of [
    [30, "cream"],
    [44, "forest"],
  ] as const) {
    a.fill(cx - 3, 16, 7, 1, col);
    a.fill(cx - 4, 17, 9, 1, col);
    a.fill(cx, 18, 1, 3, "cream");
  }
  a.street();
  return a;
}

export function kensingtonView(): ZoneView {
  const verge = bd.VERGES["kensington-market"]!;
  const paving = bd.vergePaving("kensington-market");
  const a = new ZoneView("kensington-market", () => bd.KENSINGTON_ROAD, paving, "plum", [3, 6], {
    curb: verge.curbColour,
    edge: bd.KENSINGTON_GUTTER,
    lawn: paving,
    walk: verge.walkColour,
    walkFleck: verge.seamColour,
  });
  bd.sunburst(a, AW / 2, FAR_Y + 2, 5, "purple", "violet", FAR_Y, { w: AW });
  // the worn Victorian row in its backdrop's paint: a sash upstairs either side, a faded awning, the
  // shop window
  for (const [x, w, wall, roof, awn] of [
    [-14, 28, "dturq", "navy", "dred"],
    [14, 26, "violet", "plum", "ochre"],
    [40, 26, "ochre", "dbrick", "dturq"],
    [66, 26, "olive", "dolive", "red"],
  ] as const) {
    const wallC = bd.WORN_WALL[wall]!;
    const roofC = bd.WORN_ROOF[roof]!;
    for (let k = 0; k < Math.floor(w / 2) + 2; k++) {
      a.fill(x - 1 + k, 7 - Math.floor(k / 2), w + 2 - 2 * k, 1, roofC);
    }
    a.fill(x, 7, w, FAR_Y - 7, wallC);
    a.fill(x + w - 2, 7, 2, FAR_Y - 7, dk(wallC));
    a.fill(x + 3, 8, 4, 4, "ochre");
    a.fill(x + w - 8, 8, 4, 4, "dlake");
    for (let i = 0; i < w - 2; i += 4) {
      a.fill(x + 1 + i, 14, 2, 2, bd.FADED.get(awn) ?? awn);
      a.fill(x + 3 + i, 14, 2, 2, "stone");
    }
    a.fill(x + 3, 17, w - 10, 4, "dlake");
  }
  for (const x0 of [0, AW - 5]) {
    for (let py = 0; py < FAR_Y; py++) {
      a.fill(x0, py, 5, 1, dk(bd.MURAL[Math.floor(py / 4) % bd.MURAL.length]!));
    }
  }
  // a hydro wire sagging across in place of the bunting
  bd.wire(a, [0, 3], [AW, 3], 2);
  a.street();
  return a;
}

export function beachesView(): ZoneView {
  const sand = flecked("driftwood", "stone", 43);
  const a = new ZoneView("the-beaches", boards, sand, "dbrown", [4, 9], {
    curb: null,
    lawn: sand,
    walk: "driftwood",
    walkFleck: "stone",
  });
  a.sky("gold", "yellow");
  bd.cloud(a, 26, 5, 16, 2, 4);
  for (let py = 8; py < 17; py++) {
    for (let px = 0; px < AW; px++) {
      let c = py < 10 ? "dlake" : py < 14 ? "lake" : "shallow";
      if (bd.hashed(Math.floor(px / 3), py, 9) && py % 2 === 0) {
        c = "foam";
      }
      a.fill(px, py, 1, 1, c);
    }
  }
  a.fill(0, 17, AW, FAR_Y - 17, "driftwood");
  a.fill(0, 17, AW, 1, "foam");
  a.fill(40, 10, 1, 4, "white");
  a.fill(41, 11, 2, 3, "white");
  a.fill(38, 14, 7, 1, "white");
  // the lifeguard station, small at this distance: a white box under a red roof on stilts
  a.fill(55, 15, 1, 5, "driftwood");
  a.fill(63, 15, 1, 5, "driftwood");
  a.fill(54, 9, 11, 6, "white");
  a.fill(62, 9, 3, 6, "lgrey");
  a.fill(57, 11, 4, 2, "dlake");
  for (let k = 0; k < 3; k++) {
    a.fill(53 + k, 8 - k, 13 - 2 * k, 1, "ttc");
  }
  a.fill(59, 3, 1, 3, "coal");
  bd.umbrella(a, 16, FAR_Y, "ttc", "white");
  // a shade tree in the park at the east end, cut by the card's edge
  bd.shadeTree(a, 73, 10, 4, FAR_Y - 2, "canopy", "pine", "green", { girth: 2 });
  a.street();
  return a;
}

export function yongeView(): ZoneView {
  const paving = flecked("dslate", "slate", 67);
  const a = new ZoneView("yonge-street", flecked("shale", "ash", 41), paving, "amber", [4, 8], {
    curb: "grey",
    edge: "coal",
    lawn: paving,
    walk: "dslate",
    walkFleck: "slate",
  });
  bd.bands(a, 0, FAR_Y, bd.YONGE_SKY, { w: AW });
  for (const [x, y] of [
    [30, 1],
    [50, 3],
    [70, 2],
  ] as const) {
    a.fill(x, y, 1, 1, "white");
  }
  a.fill(61, 2, 3, 3, "haze");
  a.fill(61, 2, 1, 1, "white");
  // far off in haze, the CN Tower over everything, rising from behind the SkyDome past a low dark
  // block, the dome lined in ink along its top; then the nearer towers: glass where the tower is not,
  // two in front of the dome, the Royal Bank Plaza's gold, glass, First Canadian Place in white under
  // its red band and the TD Centre in black, lit windows on each
  const cx = 18;
  a.fill(cx, 0, 1, 3, "lgrey");
  a.fill(cx, 0, 1, 1, "red");
  a.fill(cx - 1, 3, 3, 2, "haze");
  a.fill(cx - 4, 5, 9, 2, "haze");
  a.fill(cx - 4, 6, 9, 1, "gold");
  a.fill(cx + 3, 5, 2, 2, "lgrey");
  a.fill(cx - 1, 7, 3, FAR_Y - 7, "haze");
  a.fill(cx + 1, 7, 1, FAR_Y - 7, "lgrey");
  a.fill(14, 11, 8, FAR_Y - 11, "coal");
  a.fill(14, 11, 8, 1, "ink");

  const dome = (px: number, py: number): boolean => {
    const dx = (px + 0.5 - 28) / 13;
    const dy = (py + 0.5 - (FAR_Y - 3)) / 9;
    return dx * dx + dy * dy <= 1;
  };

  for (let py = FAR_Y - 12; py < FAR_Y; py++) {
    for (let px = 14; px < 43; px++) {
      if (dome(px, py)) {
        const lit = px < 26 && !dome(px - 1, py - 1);
        a.fill(px, py, 1, 1, px === 31 || px === 35 ? "lgrey" : lit ? "white" : "haze");
      } else if (dome(px, py + 1) || dome(px - 1, py) || dome(px + 1, py)) {
        a.fill(px, py, 1, 1, "ink");
      }
    }
  }
  for (const [x, w, top, wallC, litC] of [
    [0, 10, 4, "dlake", "gold"],
    [11, 7, 17, "coal", "gold"],
    [27, 9, 17, "dlake", "amber"],
    [36, 8, 6, "gold", "ochre"],
    [44, 12, 7, "dlake", "gold"],
    [56, 7, 5, "lgrey", "grey"],
    [63, 12, 8, "coal", "gold"],
  ] as const) {
    a.fill(x, top, w, FAR_Y - top, wallC);
    a.fill(x + w - 1, top, 1, FAR_Y - top, dk(wallC));
    for (let y = top + 2; y < FAR_Y - 2; y += 2) {
      for (let c = x + 1; c < x + w - 2; c += 2) {
        if (wallC === "gold" || wallC === "lgrey" || bd.hashed(c, y, 3)) {
          a.fill(c, y, 1, 1, litC);
        }
      }
    }
  }
  a.fill(57, 5, 5, 1, "ttc");
  a.fill(64, 9, 1, 1, "green");
  // the Eaton Centre in front of the dome's right flank: its galleria's glass roof catching the light
  // over blue glass with lit panes, under the ink sign lettered in turquoise
  a.fill(27, 11, 14, 1, "ink");
  a.fill(27, 12, 14, FAR_Y - 12, "dlake");
  a.fill(27, 12, 14, 1, "foam");
  a.fill(40, 12, 1, FAR_Y - 12, "navy");
  for (const y of [14, 16]) {
    for (let x = 28; x < 40; x += 2) {
      a.fill(x, y, 1, 1, bd.hashed(x, y, 2) ? "gold" : "foam");
    }
  }
  a.fill(26, 8, 16, 3, "ink");
  for (let x = 28; x < 40; x += 2) {
    a.fill(x, 9, 1, 1, "turquoise");
  }
  // the street level: neon over shop windows, lit gold or amber, a few dark, with coal between them
  a.fill(0, FAR_Y - 4, AW, 4, "coal");
  for (const [x, w, c] of [
    [10, 8, "pink"],
    [23, 8, "gold"],
    [44, 10, "turquoise"],
    [64, 9, "lilac"],
  ] as const) {
    a.fill(x, FAR_Y - 4, w, 1, c);
  }
  const windows = ["gold", "amber", "dlake", "gold", "cream", "amber", "gold"];
  for (let k = 0, x = 1; x < AW; k++, x += 4) {
    a.fill(x, FAR_Y - 2, 3, 2, windows[k % 7]!);
  }
  a.street();
  // crosswalks over the cross street from the stub's two sidewalks, the centre line stopping at them
  for (const x of [17, 55]) {
    a.fill(x, CROSS_Y + 1, 4, STUB_Y - CROSS_Y - 1, "shale");
    for (let y = CROSS_Y + 1; y < STUB_Y; y += 2) {
      a.fill(x, y, 4, 1, "white");
    }
  }
  return a;
}

// Every card illustration, by key. The hood_* tools add their own while they preview.
export const ILLUSTRATIONS = new Map<string, () => Art>([
  ["card-skunk-grooming", skunkGrooming],
  ["card-skunk-rinse", skunkRinse],
  ["card-skunk-ignore", skunkIgnore],
  ["card-other-dog-sniff", otherDogSniff],
  ["card-other-dog-pull-away", otherDogPullAway],
  ["card-other-dog-keep-moving", otherDogKeepMoving],
  ["card-thief-let-go", thiefLetGo],
  ["card-thief-grab-back", thiefGrabBack],
  ["card-thief-give-chase", thiefGiveChase],
  ["card-lost-wallet-keep", walletKeep],
  ["card-friendly-neighbour-take", neighbourTake],
  ["card-belly-rubs", bellyRubs],
  ["card-good-leash", goodLeash],
  ["card-big-tipper", bigTipper],
  ["card-rush-hour", rushHour],
  ["card-raincoats", raincoats],
  ["card-sweet-talker", sweetTalker],
  ["card-skip", skip],
  ["card-zone-cabbagetown", cabbagetownView],
  ["card-zone-high-park", highParkView],
  ["card-zone-distillery-district", distilleryView],
  ["card-zone-kensington-market", kensingtonView],
  ["card-zone-the-beaches", beachesView],
  ["card-zone-yonge-street", yongeView],
]);

// {illustration key: the card-frame tag the game shows it in}, from the game's export: each card
// face's frame; any other art shows in encounter.
export function cardFrameTags(): Map<string, string> {
  const { cards } = sn.GAME as unknown as { cards: { art: string; frame: string }[] };
  return new Map(cards.map((card) => [card.art, card.frame]));
}

export const FRAME_TAGS = cardFrameTags();

// The frame an illustration shows in, as the game picks it.
export function cardKind(key: string): string {
  return FRAME_TAGS.get(key) ?? "encounter";
}

export function* frameSprite(): Generator<Sprite> {
  yield ["card-frame", KINDS.map((kind): Tag => [kind, [cardFrame(kind).outlined(false)], 1000])];
  yield [
    "card-frame-large",
    KINDS.map((kind): Tag => [kind, [cardFrameLarge(kind).outlined(false)], 1000]),
  ];
}

// A whole card as the game will show it, cost plaque included, for previews: an opaque image.
export function mockCard(
  kind: string,
  key: string,
  { large = false }: { large?: boolean } = {},
): RgbaImage {
  const scale = large ? 2 : 1;
  const im = toImage((large ? cardFrameLarge : cardFrame)(kind).px);
  const cost = toImage(cardCost().px);
  const [badge, at] = large
    ? [
        [6, 121],
        [4, 16],
      ]
    : [
        [BADGE_X, BADGE_Y],
        [ART_X, ART_Y],
      ];
  paste(
    { at: { x: badge[0]! * scale, y: badge[1]! * scale } },
    resizeNearest(cost.width * scale, cost.height * scale, cost),
    im,
  );
  const art = ILLUSTRATIONS.get(key)!().img;
  paste(
    { at: { x: at[0]! * scale, y: at[1]! * scale } },
    resizeNearest(AW * scale, AH * scale, art),
    im,
  );
  const bg = filledImage([...sn.rgb("dbrown"), 255], im.width, im.height);
  paste({ at: { x: 0, y: 0 }, keepAlpha: true, mask: "alpha" }, im, bg);
  return bg;
}

// Every illustration in a normal card, then one enlarged card per card type.
export function preview(out: string, scale = 3): void {
  const keys = [...ILLUSTRATIONS.keys()];
  const cols = 10;
  const rows = Math.floor((keys.length + cols - 1) / cols);
  const big = [
    ["encounter", "card-skunk-rinse"],
    ["route", "card-zone-cabbagetown"],
  ] as const;
  const width = Math.max((CW + 6) * cols, (LW + 6) * big.length);
  const sheet = filledImage(
    [...sn.rgb("ink"), 255],
    width * scale,
    ((CH + 6) * rows + LH + 6) * scale,
  );
  keys.forEach((key, i) => {
    const card = resizeNearest(CW * scale, CH * scale, mockCard(cardKind(key), key));
    paste(
      { at: { x: (i % cols) * (CW + 6) * scale, y: Math.floor(i / cols) * (CH + 6) * scale } },
      card,
      sheet,
    );
  });
  big.forEach(([kind, key], i) => {
    const card = resizeNearest(LW * scale, LH * scale, mockCard(kind, key, { large: true }));
    paste({ at: { x: i * (LW + 6) * scale, y: (CH + 6) * rows * scale } }, card, sheet);
  });
  writeFileSync(out, rgbPng(sheet));
}

function saveAs(png: string, source: string): void {
  execFileSync("aseprite", ["-b", png, "--save-as", source], { stdio: "inherit" });
}

export async function build(): Promise<void> {
  await buildSprites({}, "art/cards", frameSprite());
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of ILLUSTRATIONS) {
    const png = `public/art/images/${key}.png`;
    const art = draw();
    writeFileSync(png, art.clear ? savePng(art.img) : rgbPng(art.img));
    saveAs(png, `art/cards/${key}.aseprite`);
  }
  writeFileSync("public/art/images/card-cost.png", savePng(toImage(cardCost().outlined(false))));
  saveAs("public/art/images/card-cost.png", "art/cards/card-cost.aseprite");
  console.log("built", [...ILLUSTRATIONS.keys(), "card-cost"].join(", "));
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
