// Draw the dog and walker portraits for the start screen's detail card and the shop.
//
// portrait-dog-<name> and portrait-walker-<name>: 64x64 images in Endesga 32 with an ink outer line
// closed along the bottom edge, cel shaded, on transparency, in a three-quarter front view turned
// toward the viewer's left (into the top-left light). Each dog sits, head and shoulders with its
// front paws at the bottom edge; its coat, markings and accessories match its road sprite and face in
// dogs.ts. Each walker is a head-and-shoulders bust to the bottom edge; their skin, hair, cap, clothes
// and Trista's tote match their road sprite in road.ts and face in owners.ts.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { filledImage, paste, resizeNearest, type Rgb } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as dogs from "./dogs.ts";
import { Mini } from "./mini.ts";
import { FULL, WALKERS as WALKER_FACES } from "./owners.ts";
import {
  type Colour,
  dk,
  type Drawable,
  edged,
  type Frame,
  Grid,
  hexOf,
  K,
  PREVIEW_BACKGROUND,
  raster,
  rgbPng,
  savePng,
  scaleOf,
  toImage,
} from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/portraits.ts preview OUT.png   every portrait beside its face (at 2x), on the
                                                start screen's tile colours, scaled up
  node art/tools/portraits.ts build             write art/portraits/*.aseprite and
                                                public/art/images/*.png`;

const S = 64;

type Draw = (g: Drawable) => void;

// The colour two ramp steps darker than c, a K name or hex: a portrait's inner line.
function dk2(c: string): string {
  return dk(dk(c));
}

// An ellipse ringed in its colour two ramp steps darker, for a shape drawn over one of the same coat.
function lined(
  g: Drawable,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: string,
  sh: Colour = null,
  li: Colour = null,
): void {
  g.ell(cx, cy, rx + 1, ry + 1, dk2(c));
  g.cel(cx, cy, rx, ry, c, sh, li);
}

// ---------- shared features ----------
// The head turns toward the viewer's left: the muzzle sits left of the skull's centre, the far (left)
// eye is narrower and the near (right) eye full width.

// A big round eye 6 tall, with a two-pixel shine top-left and a glint bottom-right.
function eye(g: Drawable, x: number, y: number, w = 5, iris: string | null = null): void {
  g.rect(x + 1, y, w - 2, 6, "ink");
  g.rect(x, y + 1, w, 4, "ink");
  if (iris) {
    g.rect(x + 1, y + 1, w - 2, 4, iris);
    g.rect(x + 1, y + 2, w - 2, 2, "ink");
  }
  g.rect(x + 1, y + 1, w > 4 ? 2 : 1, 2, "white");
  g.p(x + w - 2, y + 4, iris ? "blue" : "white");
}

function eyes(g: Drawable, fx: number, nx: number, y: number, iris: string | null = null): void {
  eye(g, fx, y, 4, iris);
  eye(g, nx, y, 5, iris);
}

// A rounded nose 6 wide with a shine, then the happy open mouth under it.
function nose(g: Drawable, x: number, y: number): void {
  g.rect(x + 1, y, 4, 4, "ink");
  g.rect(x, y + 1, 6, 2, "ink");
  g.rect(x + 1, y + 1, 2, 1, "slate");
  // philtrum, then a w-shaped smile around a pink tongue
  g.rect(x + 2, y + 4, 2, 1, "ink");
  g.ell(x + 3, y + 7, 3.5, 2.5, "dred");
  g.cel(x + 3, y + 8.5, 2, 2, "pink", "mauve");
  g.p(x + 3, y + 8, "mauve");
  for (const [dx, dy] of [
    [-2, 5],
    [-1, 5],
    [0, 5],
    [1, 5],
    [4, 5],
    [5, 5],
    [6, 5],
    [7, 5],
    [-3, 4],
    [8, 4],
  ] as const) {
    g.p(x + dx, y + dy, "ink");
  }
}

// Front legs from top to the bottom edge, each shaded down its right side, with toes on the paws.
function legs(g: Drawable, xs: readonly number[], top: number, c: string, sh: string, w = 6): void {
  for (const x of xs) {
    g.rect(x, top, w, S - top - 2, c);
    g.rect(x + w - 1, top, 1, S - top - 3, sh);
    g.cel(x + w / 2, S - 2.5, w / 2 + 1, 2.5, c, sh);
    for (let t = 1; t < w; t += 2) {
      g.p(x + t, S - 2, sh);
    }
  }
}

// A clipped pom-pom: an ellipse ringed by n lumps, so the silhouette scallops like curls. The pom
// takes the shadow; each lump only a highlight, which keeps the curls from turning blotchy.
function pom(
  g: Drawable,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 8,
  c = "skin1",
  sh: Colour = "brown",
  li: Colour = "cream",
): void {
  const r = Math.min(rx, ry) * 0.45;
  const lumps = Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * (k + 0.5)) / n;
    return [cx + (rx - r * 0.5) * Math.cos(a), cy + (ry - r * 0.5) * Math.sin(a)] as const;
  });
  g.ell(cx, cy, rx, ry, dk2(c));
  for (const [x, y] of lumps) {
    g.ell(x, y, r + 1, r + 1, dk2(c));
  }
  g.cel(cx, cy, rx - 1, ry - 1, c, sh, li);
  for (const [x, y] of lumps) {
    g.cel(x, y, r, r, c, y > cy + ry * 0.5 ? sh : null, li);
  }
  g.ell(cx, cy, rx - r, ry - r, c);
}

// ---------- Ginger: Maltese, small, white, pink bow ----------

function ginger(g: Drawable): void {
  // long silky coat falling to the ground, the haunch behind on the right
  g.cel(44, 54, 12, 9, "white", "lgrey");
  g.cel(31, 52, 13, 12, "white", "lgrey", "white");
  for (let x = 20; x < 46; x += 4) {
    g.tri([x, 58], [x + 4, 58], [x + 2, 63], "white");
    g.p(x + 3, 61, "lgrey");
  }
  legs(g, [24, 33], 54, "white", "lgrey", 5);
  // long ears drape to the chest
  g.cel(16, 34, 6, 11, "white", "lgrey");
  lined(g, 30, 25, 15, 13, "white", "lgrey");
  g.cel(43, 35, 6, 12, "white", "lgrey");
  g.cel(43, 35, 4.5, 10, "white", "lgrey");
  g.rect(41, 26, 1, 16, "lgrey");
  g.cel(25, 32, 8, 5.5, "white", "lgrey");
  g.rect(27, 12, 6, 2, "lgrey");
  bow(g, 30, 9);
  eyes(g, 17, 31, 22);
  nose(g, 21, 29);
}

// Ginger's pink bow, or Pepe's mauve show ribbon tied in purple: the knot and folds take the second
// colour.
function bow(
  g: Drawable,
  cx: number,
  y: number,
  [c, knot]: readonly [string, string] = ["pink", "mauve"],
): void {
  g.tri([cx - 1, y + 2], [cx - 9, y - 2], [cx - 8, y + 7], c);
  g.tri([cx + 1, y + 2], [cx + 9, y - 2], [cx + 8, y + 7], c);
  g.tri([cx - 1, y + 2], [cx - 8, y + 7], [cx - 6, y + 6], knot);
  g.tri([cx + 1, y + 2], [cx + 8, y + 7], [cx + 6, y + 6], knot);
  g.p(cx - 7, y, "white");
  g.rect(cx - 2, y, 4, 4, knot);
  g.rect(cx - 1, y + 1, 2, 1, c);
}

// ---------- Reggie: pug, small, fawn, black mask, red bandana ----------

function reggie(g: Drawable): void {
  g.cel(45, 55, 11, 8, "skin1", "skin2", "cream");
  // curled tail over the hip
  g.cel(53, 46, 3.5, 3, "skin1", "skin2", "cream");
  g.p(53, 46, "skin2");
  g.cel(31, 53, 13, 11, "skin1", "skin2", "cream");
  legs(g, [23, 33], 54, "skin1", "skin2");
  // bandana knotted at the throat, white polka dots
  g.tri([17, 41], [45, 41], [30, 56], "red");
  g.tri([32, 47], [45, 41], [30, 56], "dred");
  for (const [x, y] of [
    [23, 43],
    [31, 45],
    [38, 43],
    [28, 49],
    [34, 50],
  ] as const) {
    g.p(x, y, "white");
  }
  g.cel(30, 26, 17, 15, "skin1", "skin2", "cream");
  // folded black ears
  g.tri([13, 21], [17, 11], [23, 15], "navy");
  g.tri([47, 20], [44, 10], [37, 14], "navy");
  g.tri([44, 20], [44, 12], [39, 15], "ink");
  // forehead wrinkles
  g.rect(24, 16, 9, 1, "skin2");
  g.rect(26, 18, 6, 1, "skin2");
  // black mask over a short flat muzzle
  g.cel(26, 32, 9, 7, "navy", "ink", "dslate");
  g.ell(21, 26, 4, 4, "navy");
  g.ell(35, 26, 4.5, 4, "navy");
  eyes(g, 18, 33, 23);
  nose(g, 23, 29);
}

// ---------- Buddy: Jack Russell, small, white with tan patches, red collar ----------

function buddy(g: Drawable): void {
  g.cel(44, 54, 11, 9, "white", "lgrey");
  g.cel(47, 51, 5, 4, "ochre", "rust");
  g.cel(31, 52, 12, 11, "white", "lgrey");
  legs(g, [24, 33], 52, "white", "lgrey", 5);
  g.rect(19, 40, 24, 3, "red");
  g.rect(19, 42, 24, 1, "dred");
  g.cel(30, 44, 2.5, 2.5, "amber", "orange", "yellow");
  g.cel(30, 26, 16, 14, "white", "lgrey");
  // tan patches over both eyes and ears; a white blaze between
  g.cel(20, 21, 6.5, 6.5, "ochre", "rust", "tan");
  g.cel(37, 20, 7.5, 7, "ochre", "rust", "tan");
  g.rect(27, 12, 3, 12, "white");
  // button ears folded forward
  g.tri([11, 20], [14, 9], [22, 13], "ochre");
  g.tri([13, 18], [14, 12], [19, 14], "rust");
  g.tri([49, 19], [45, 8], [37, 12], "ochre");
  g.tri([47, 17], [45, 11], [40, 13], "rust");
  g.cel(25, 32, 8, 5.5, "white", "lgrey");
  eyes(g, 17, 32, 21);
  nose(g, 21, 28);
}

// ---------- Pepe: miniature poodle, medium, black with a white stripe, show-clip pom-poms ----------

// Pepe's coat is dogs.CURL and dogs.SHAVED.

function pepe(g: Drawable): void {
  // shaved legs with pom-pom bracelets, a curly mane over the chest
  g.cel(48, 56, 9, 7, ...dogs.CURL);
  for (const x of [24, 35]) {
    g.rect(x, 50, 4, 10, dogs.SHAVED[0]);
    g.rect(x + 3, 50, 1, 10, dogs.SHAVED[1]);
    pom(g, x + 2, 60.5, 4.5, 3, 5, ...dogs.CURL);
  }
  pom(g, 31, 48, 14, 9, 10, ...dogs.CURL);
  // the white stripe running on from the topknot along the top of the back to the rump, shaded under it
  for (let x = 41; x < 57; x++) {
    const y = Math.round(56 - 7 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 48) / 9) ** 2))) + 1;
    g.rect(x, y, 1, 2, "white");
    g.p(x, y + 2, "lgrey");
  }
  // long fluffy ears hanging from under the topknot
  pom(g, 16, 35, 6, 11, 6, ...dogs.CURL);
  pom(g, 45, 35, 6, 11, 6, ...dogs.CURL);
  // the smooth shaved face, ringed a step darker than the curls and set off from them by the shadow it
  // casts down and right, under a smaller topknot whose scalloped edge overlaps the brow
  g.ell(31.5, 31.5, 11, 10.5, "ink");
  g.ell(29.5, 27, 11.5, 10.5, "navy");
  g.cel(29.5, 27, 10.5, 9.5, ...dogs.SHAVED);
  pom(g, 30, 15.5, 12, 6, 9, ...dogs.CURL);
  // the white stripe from the brow up over the topknot, shaded down its right side, under the show bow
  g.rect(28, 10, 4, 10, "white");
  g.rect(31, 11, 1, 9, "lgrey");
  g.rect(29, 20, 2, 2, "white");
  bow(g, 30, 10, ["mauve", "purple"]);
  // shaved muzzle, long and narrow
  lined(g, 23, 32, 7, 4.5, "grey", "slate");
  eyes(g, 20, 32, 22);
  nose(g, 15, 29);
}

// ---------- Lady: beagle, medium, tricolour, long ears, green collar ----------

function lady(g: Drawable): void {
  // black saddle and white-tipped tail behind, white chest in front
  g.rect(52, 33, 3, 12, "navy");
  g.rect(52, 30, 3, 4, "white");
  g.cel(45, 53, 12, 9, "navy", "ink", "dslate");
  g.cel(46, 58, 10, 6, "ochre", "rust");
  g.cel(31, 52, 13, 11, "white", "lgrey");
  legs(g, [23, 33], 52, "white", "lgrey");
  g.rect(18, 40, 26, 3, "green");
  g.rect(18, 42, 26, 1, "dgreen");
  g.cel(30, 44, 2.5, 2.5, "amber", "orange", "yellow");
  g.cel(30, 26, 16, 14, "ochre", "rust", "tan");
  // white blaze down the forehead into a white muzzle
  g.tri([27, 12], [31, 12], [29, 26], "white");
  g.rect(27, 12, 4, 6, "white");
  g.cel(25, 33, 9, 6.5, "white", "lgrey");
  // long ears hang past the cheeks
  g.cel(13, 33, 5, 12, "rust", "dbrown");
  g.cel(47, 33, 5.5, 12, "rust", "dbrown");
  g.rect(45, 23, 1, 18, "dbrown");
  eyes(g, 18, 33, 22);
  nose(g, 20, 29);
}

// ---------- Archie: Australian Shepherd, medium, brown and white, one blue eye, red bandana ----------

// Archie's eye, 5x6 as drawn: the shine at the top left, the pupil at the right, the iris round its
// lower left and top right (k ink, w white, i the iris, . left as drawn). Both eyes take it, so they
// match and look the same way; it is laid pixel for pixel, as scaled ellipses would round the two eyes
// differently.
const ARCHIE_EYE: readonly string[] = [".kkk.", "kwwik", "kwkkk", "kikkk", "kiiik", ".kkk."];

// rows laid pixel for pixel at g's drawn size, their top left at design (x, y); ink maps each letter
// to a colour, and a dot leaves what is drawn.
function stamp(
  g: Drawable,
  x: number,
  y: number,
  rows: readonly string[],
  ink: Readonly<Record<string, string>>,
): void {
  const { px } = raster(g);
  const k = scaleOf(g);
  const x0 = Math.floor(x * k + 0.5);
  const y0 = Math.floor(y * k + 0.5);
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== ".") {
        px[y0 + dy]![x0 + dx] = K[ink[ch]!]!;
      }
    });
  });
}

// dogs.inlay on a blank grid at g's own scale, so a portrait drawn smaller than its design (a Mini
// built outside mini.ts's small) lines up with it.
function inlay(g: Drawable, line: string, draw: Draw): void {
  const t = g instanceof Mini ? new Mini(g.s, g.w, g.h, g.sy) : new Grid(g.w, g.h);
  draw(t);
  const gp = raster(g).px;
  const tp = raster(t).px;
  const h = gp.length;
  const w = gp[0]!.length;
  const inShape = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && Boolean(tp[y]![x]);
  const colour = hexOf(line);
  // the ring: every drawn pixel of g beside the shape
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const beside =
        inShape(x, y - 1) || inShape(x, y + 1) || inShape(x - 1, y) || inShape(x + 1, y);
      if (!inShape(x, y) && gp[y]![x] && beside) {
        gp[y]![x] = colour;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inShape(x, y)) {
        gp[y]![x] = tp[y]![x]!;
      }
    }
  }
}

// Sat with his hindquarters to the right: a round rump and thigh tucked beside the white chest, lit
// from the top left, a white hind paw on the ground in front of it, and a fluffy bobtail tuft at the
// back of the rump, each set off from the coat by a line two ramp steps darker.
function archie(g: Drawable): void {
  const coat = dogs.COAT;
  const [ear, tip] = dogs.EAR;
  const line = dk2(coat[0]);
  const shade = coat.slice(1) as [Colour, Colour];
  // the bobtail: a tuft in three locks, white at the tip
  inlay(g, line, (t) => {
    for (const [x, y, r, c, sh] of [
      [55, 48, 3.2, coat[0], shade],
      [58, 45.8, 2.7, coat[0], shade],
      [55.5, 44.2, 2.4, coat[0], shade],
      [58.6, 42.6, 2, "white", ["lgrey"]],
    ] as const) {
      t.cel(x, y, r, r, c, ...sh);
    }
  });
  // the rump and thigh, one round mass highest at the back, then the hind paw with two toe lines
  inlay(g, line, (t) => t.cel(46.5, 54, 10.5, 10, ...coat));
  inlay(g, dk2("white"), (t) => t.cel(47.5, 60.5, 4.5, 2.6, "white", "lgrey"));
  for (const x of [45.5, 48.5]) {
    g.rect(x, 61.5, 1, 2, "lgrey");
  }
  // the white chest and front legs, copper where they meet the coat
  g.cel(31, 52, 13, 11, "white", "lgrey");
  legs(g, [23, 33], 53, "white", "lgrey");
  for (const x of [23, 33]) {
    g.rect(x, 53, 5, 2, "ochre");
  }
  // the red bandana knotted at the throat, plain, with its fold in dred
  g.tri([17, 40], [45, 40], [30, 57], "red");
  g.tri([32, 46], [45, 40], [30, 57], "dred");
  g.rect(17, 40, 28, 1, "dred");
  // rose ears set high, the tips folding forward
  g.tri([12, 21], [15, 7], [24, 13], ear);
  g.tri([15, 7], [9, 13], [16, 13], tip);
  g.tri([47, 20], [45, 6], [36, 12], ear);
  g.tri([45, 6], [51, 12], [44, 12], tip);
  g.cel(30, 26, 16, 14, ...coat);
  // a white blaze widening down into a white muzzle, copper brows and cheek
  g.tri([26, 12], [32, 12], [29, 28], "white");
  g.tri([24, 28], [34, 28], [29, 20], "white");
  g.rect(27, 12, 4, 5, "white");
  g.rect(34, 19, 3, 1, "ochre");
  g.cel(38, 32, 3, 2.5, "ochre", "rust");
  g.cel(25, 33, 9, 6.5, "white", "lgrey");
  // odd eyes, the far one sky and the near one amber
  for (const [x, iris] of [
    [17.5, "sky"],
    [32.5, "amber"],
  ] as const) {
    stamp(g, x, 21.5, ARCHIE_EYE, { i: iris, k: "ink", w: "white" });
  }
  nose(g, 20, 29);
  // a liver nose
  g.rect(21, 29, 4, 4, "plum");
  g.rect(20, 30, 6, 2, "plum");
  g.rect(21, 30, 2, 1, "dbrown");
}

// ---------- Sequoia: Great Pyrenees, large, giant white fluff, collar with a bell ----------

function sequoia(g: Drawable): void {
  g.cel(47, 52, 14, 11, "white", "lgrey");
  g.cel(31, 50, 18, 14, "white", "lgrey");
  legs(g, [21, 34], 52, "white", "lgrey", 7);
  // a thick ruff under the jaw, wider than the skull
  g.cel(31, 36, 23, 8, "white", "lgrey");
  g.rect(17, 43, 28, 2, "sky");
  g.rect(17, 44, 28, 1, "blue");
  g.cel(31, 47.5, 3.5, 3.5, "amber", "orange", "yellow");
  g.rect(30, 48, 3, 1, "orange");
  // a Great Pyrenees' broad flat skull, small V drop ears set at its sides and marked badger tan, and a
  // long wedge muzzle set off by its line, so he reads as a grown giant rather than a pup
  g.cel(30, 24, 17, 14, "white", "lgrey");
  dogs.inlay(g, "skin2", (t) => {
    t.tri([13, 15], [22, 12], [16, 28], "tan");
    t.tri([15, 15], [21, 13.5], [16.5, 24], "cream");
  });
  dogs.inlay(g, "skin2", (t) => {
    t.tri([38, 12], [47, 15], [44, 28], "tan");
    t.tri([39.5, 13.5], [45, 15.5], [43.5, 24], "cream");
  });
  lined(g, 25, 32, 9, 6, "white", "lgrey");
  eyes(g, 18, 31, 20);
  nose(g, 20, 28);
}

// ---------- Penny: golden retriever with a Labrador build, large, golden coat, otter tail, blue collar ----------

function penny(g: Drawable): void {
  const [base, shade, light] = dogs.GOLD;
  // the haunch, and a thick otter tail curled forward round it along the ground, tapering to a blunt tip
  g.cel(46, 53, 13, 10, base, shade, light);
  dogs.inlay(g, dk2(base), (t) => {
    t.cel(52, 59.5, 10, 3.5, base, shade, light);
    t.tri([42, 58], [42, 63], [34, 62], base);
  });
  // a deep chest on solid legs
  g.cel(31, 51, 15.5, 13, base, shade, light, 2.4);
  legs(g, [21, 33], 53, base, shade, 7);
  // blue collar and a silver tag
  g.rect(16, 42, 30, 3, "blue");
  g.rect(16, 42, 30, 1, "sky");
  g.cel(30, 47.5, 2.5, 2.5, "lgrey", "grey", "white");
  // a broad, blocky head
  g.cel(30, 25, 17, 14, base, shade, light, 2.6);
  // short flat drop ears set at the top of the skull's sides, hanging no lower than the jaw
  dogs.inlay(g, dk2(shade), (t) => {
    t.tri([11, 16], [21, 13], [15, 37], shade);
    t.tri([11, 16], [10, 33], [15, 37], shade);
  });
  dogs.inlay(g, dk2(shade), (t) => {
    t.tri([39, 13], [49, 16], [47, 38], shade);
    t.tri([49, 16], [51, 34], [47, 38], shade);
  });
  // a square muzzle, a shade lighter than the coat, set off from the brow by a clear stop
  dogs.inlay(g, dk2(light!), (t) => t.cel(25, 34, 9, 6.5, light, base, null, 3.2));
  eyes(g, 18, 33, 21);
  nose(g, 21, 29);
}

// ---------- Kilo: Alaskan Malamute, large, grey and white, blue eyes, orange harness ----------

function kilo(g: Drawable): void {
  g.cel(46, 52, 13, 11, "slate", "dslate", "grey");
  g.cel(31, 51, 15, 13, "lgrey", "grey", "white");
  legs(g, [22, 33], 53, "lgrey", "grey", 6);
  // a Y-front harness: a strap down from each shoulder to a ring on the chest, one down from it
  for (let i = 0; i < 9; i++) {
    g.rect(18 + i * 1.3, 40 + i, 3, 2, "orange");
    g.rect(42 - i * 1.3, 40 + i, 3, 2, "orange");
    g.p(18 + i * 1.3, 41 + i, "rust");
    g.p(44 - i * 1.3, 41 + i, "rust");
  }
  g.rect(28, 49, 4, 7, "orange");
  g.rect(31, 49, 1, 7, "rust");
  g.cel(30, 49, 2.5, 2.5, "grey", "slate", "lgrey");
  // a Malamute's ears: small, set wide on the broad skull, their tips rounded, pink inside
  g.tri([10, 21], [13, 6], [24, 13], "slate");
  g.tri([13.5, 17], [14, 10], [21, 13], "pink");
  g.tri([48, 20], [46, 5], [36, 12], "slate");
  g.tri([45, 16], [44.5, 9], [39, 12], "pink");
  g.cel(30, 26, 19, 15, "slate", "dslate", "grey");
  // white mask: brows, cheeks and muzzle
  g.cel(27, 33, 13, 8, "lgrey", "grey", "white");
  g.rect(27, 13, 3, 12, "lgrey");
  g.rect(17, 19, 5, 2, "white");
  g.rect(33, 19, 6, 2, "white");
  eyes(g, 17, 33, 21, "sky");
  nose(g, 21, 29);
}

// ---------- the walkers: head-and-shoulders busts ----------
// The face turns toward the viewer's left like the dogs': the features sit left of the head's centre,
// the far (left) eye is narrower, and only the near (right) ear shows. Faces stay clean: flat skin with
// a blush, a shadow only under the hair or cap and down the near edge beside the eyes, never across
// the jaw or mouth.

// An eye h tall and w wide, rounded at the corners, with a shine top-left and a glint bottom-right;
// sclera sets a white left of the pupil, so the eye reads on dark skin.
function humanEye(g: Drawable, x: number, y: number, w: number, h = 5, sclera = false): void {
  g.rect(x, y + 1, w, h - 2, "ink");
  g.rect(x + 1, y, w - 2, h, "ink");
  const s = w > 4 ? 2 : 1;
  g.rect(x + 1, y + 1, s, h > 5 ? s : 1, "white");
  g.p(x + w - 2, y + h - 2, "white");
  if (sclera) {
    g.rect(x - 1, y + 2, 1, 2, "white");
  }
}

// A small open smile 7 wide, centred on x, its corners turned up.
function smile(g: Drawable, x: number, y: number, lips = "ink", teeth = "white"): void {
  g.rect(x - 3, y, 7, 1, lips);
  g.rect(x - 2, y + 1, 5, 1, lips);
  g.p(x - 4, y - 1, lips);
  g.p(x + 4, y - 1, lips);
  g.rect(x - 2, y, 5, 1, teeth);
}

// A 1px shadow on the face just under whatever hair or cap sits over it, between columns x0 and x1.
function shadeUnder(
  g: Drawable,
  skinName: string,
  shName: string,
  x0: number,
  x1: number,
  top: number,
): void {
  const { px } = raster(g);
  const k = scaleOf(g);
  const skin = K[skinName];
  const sh = K[shName]!;
  for (let x = Math.floor(x0 * k); x < Math.floor((x1 + 1) * k); x++) {
    for (let y = Math.floor(top * k); y < px.length; y++) {
      if (px[y]![x] === skin) {
        if (y > top * k && ![skin, null].includes(px[y - 1]![x]!)) {
          px[y]![x] = sh;
        }
        break;
      }
    }
  }
}

// A 1px shadow down the near (right) edge of the face from row y0 to y1, beside the eyes.
function shadeNear(g: Drawable, skinName: string, sh: string, y0: number, y1: number): void {
  const { px } = raster(g);
  const k = scaleOf(g);
  const skin = K[skinName];
  for (let y = Math.floor(y0 * k); y < Math.floor((y1 + 1) * k); y++) {
    const row = px[y]!;
    const last = row.lastIndexOf(skin!);
    if (last >= 0) {
      row[last] = hexOf(sh);
    }
  }
}

// A 1px oval outline.
function ring(g: Drawable, cx: number, cy: number, rx: number, ry: number, c: string): void {
  const { px } = raster(g);
  const k = scaleOf(g);
  for (let y = 0; y < px.length; y++) {
    for (let x = 0; x < px[0]!.length; x++) {
      const d = Math.hypot((x + 0.5 - cx * k) / (rx * k), (y + 0.5 - cy * k) / (ry * k));
      if (Math.abs(d - 1) * Math.min(rx, ry) * k < 0.5) {
        px[y]![x] = hexOf(c);
      }
    }
  }
}

interface BustOptions {
  cx?: number;
  cy?: number;
  neck?: string;
  nw?: number;
  nx?: number;
  rx?: number;
  ry?: number;
}

// Shoulders cut by the bottom edge, and the neck.
function bust(
  g: Drawable,
  c: string,
  sh: string,
  li: Colour = null,
  { cx = 32, cy = 62, neck = "skin2", nw = 9, nx = 25, rx = 27, ry = 16 }: BustOptions = {},
): void {
  g.cel(cx, cy, rx, ry, c, sh, li);
  g.rect(nx, 38, nw, 10, neck);
}

// Eyes under short brows, a dot of nose shadow, a blush on each cheek and a small smile.
function adultFace(g: Drawable, brow: string, blush: string | null = "pink", browY = 23): void {
  for (const [x, w] of [
    [20, 3],
    [32, 4],
  ] as const) {
    humanEye(g, x, 26, w);
    g.rect(x, browY, w, 1, brow);
  }
  g.p(26, 33, "skin2");
  if (blush) {
    g.rect(17, 33, 3, 1, blush);
    g.rect(34, 33, 3, 1, blush);
  }
  smile(g, 26, 36);
}

// The amber cap with its orange brim over brown hair, the sky hoodie with its blue hood, white
// drawstrings and kangaroo pocket.
function casey(g: Drawable): void {
  bust(g, "sky", "blue", "cyan");
  g.rect(18, 58, 26, 6, "blue");
  g.rect(20, 59, 22, 5, "sky");
  g.cel(30, 47, 13, 4.5, "blue", "navy");
  g.rect(25, 44, 9, 3, "skin2");
  for (const x of [25, 33]) {
    g.rect(x, 49, 1, 7, "white");
    g.p(x, 56, "lgrey");
  }
  // brown hair under the cap at the sides, the near ear, then the face
  g.cel(31, 24, 15, 12, "dbrown", "plum", "brown");
  g.cel(44, 29, 2.5, 4, "skin1", "skin2");
  g.p(44, 29, "skin2");
  g.cel(29, 28, 13, 13, "skin1");
  // the cap's crown, its button, and the brim towards the camera, rust underneath
  g.cel(31, 15, 15, 10, "amber", "orange", "yellow");
  g.rect(30, 5, 3, 2, "orange");
  g.ell(25, 20.5, 17, 3.5, "orange");
  g.rect(15, 18, 14, 1, "amber");
  g.rect(13, 22, 26, 1, "rust");
  shadeUnder(g, "skin1", "skin2", 16, 42, 22);
  shadeNear(g, "skin1", "skin2", 24, 31);
  adultFace(g, "dbrown");
}

// 11 and round-faced: a big head on small shoulders, long black curls in a few simple rounded locks
// with a pink clip, caramel skin, big eyes set low, a small smile, yellow tee.
function ada(g: Drawable): void {
  // the curls behind her, falling past her shoulders in a few rounded locks
  g.cel(30, 29, 20, 19, "navy", "ink", "dslate");
  g.rect(10, 29, 41, 23, "navy");
  g.rect(45, 29, 6, 23, "ink");
  for (const [x, y, c] of [
    [10, 36, "navy"],
    [10, 47, "navy"],
    [51, 40, "ink"],
    [51, 50, "ink"],
  ] as const) {
    g.ell(x, y, 2.5, 4, c);
  }
  bust(g, "yellow", "amber", null, {
    cx: 31,
    cy: 65,
    neck: "brown",
    nw: 7,
    nx: 26,
    rx: 21,
    ry: 14,
  });
  g.rect(26, 51, 9, 1, "amber");
  g.p(25, 50, "amber");
  g.p(35, 50, "amber");
  // the round face, then the fringe in three rounded bumps along the brow
  g.cel(30, 31, 14, 13.5, "brown");
  g.cel(30, 18, 16, 8.5, "navy", "ink", "dslate");
  for (const [x, y, c] of [
    [20, 23, "navy"],
    [28, 24, "navy"],
    [37, 23, "navy"],
    [43, 22, "ink"],
  ] as const) {
    g.ell(x, y, 4.5, 3, c);
  }
  g.cel(41, 14, 3.5, 2.5, "pink", "mauve");
  shadeUnder(g, "brown", "dbrown", 16, 44, 20);
  shadeNear(g, "brown", "dbrown", 27, 35);
  // big eyes with two shines each, a blush, and a small smile
  for (const [x, w] of [
    [20, 5],
    [32, 6],
  ] as const) {
    humanEye(g, x, 30, w, 7);
  }
  g.rect(18, 38, 3, 1, "pink");
  g.rect(35, 38, 4, 1, "pink");
  g.p(25, 40, "dbrown");
  g.rect(26, 41, 3, 1, "dbrown");
  g.p(29, 40, "dbrown");
}

// Bald, a shine on the crown, the chin-strap beard along his jaw and under his chin with no
// moustache, the lilac tee with its violet collar.
function mrB(g: Drawable): void {
  bust(g, "lilac", "violet", null, { neck: "plum" });
  g.rect(22, 46, 15, 1, "violet");
  g.p(21, 45, "violet");
  g.p(37, 45, "violet");
  g.cel(44, 29, 2.5, 4, "dbrown", "plum");
  g.rect(44, 28, 1, 3, "plum");
  g.cel(30, 26, 13.5, 15.5, "dbrown", null, null, 2.3);
  g.rect(22, 14, 4, 1, "brown");
  g.rect(21, 15, 2, 1, "brown");
  shadeNear(g, "dbrown", "plum", 14, 30);
  // the beard: down both jaws and round under the chin, the upper lip bare
  g.rect(17, 30, 2, 6, "ink");
  g.rect(41, 30, 2, 8, "ink");
  g.ell(29, 39, 12, 4, "ink");
  g.rect(20, 34, 18, 3, "dbrown");
  for (const [x, w] of [
    [20, 3],
    [32, 4],
  ] as const) {
    humanEye(g, x, 26, w, 5, true);
    g.rect(x, 23, w, 1, "ink");
  }
  g.p(26, 32, "plum");
  smile(g, 26, 36, "ink", "cream");
}

// A clean dirty blonde bob to the shoulders with a side-swept fringe and a few amber streaks, round
// glasses, the green cardigan open over a white blouse, and the apple tote over her right shoulder.
function trista(g: Drawable): void {
  // the bob behind her face, curling under at the shoulders
  g.cel(30, 26, 17, 16, "brown", "dbrown", "tan");
  g.rect(13, 26, 34, 15, "brown");
  g.rect(43, 26, 4, 15, "dbrown");
  g.ell(17, 41, 5, 2.5, "brown");
  g.ell(43, 41, 5, 2.5, "dbrown");
  bust(g, "dgreen", "forest", "green");
  g.rect(25, 46, 9, 18, "white");
  g.rect(33, 47, 1, 17, "lgrey");
  g.tri([21, 45], [30, 46], [25, 52], "white");
  g.tri([29, 46], [38, 45], [34, 52], "lgrey");
  for (const y of [53, 59]) {
    g.p(23, y, "amber");
  }
  g.cel(29, 28, 12.5, 12.5, "skin1");
  // the fringe sweeping down to the left over the brow, with a few amber streaks
  g.cel(31, 16, 15, 7.5, "brown", "dbrown", "tan");
  g.tri([15, 15], [38, 18], [16, 24], "brown");
  for (const [x, y, h] of [
    [21, 11, 3],
    [27, 9, 4],
    [34, 10, 3],
  ] as const) {
    g.rect(x, y, 1, h, "amber");
  }
  shadeUnder(g, "skin1", "skin2", 16, 42, 18);
  shadeNear(g, "skin1", "skin2", 25, 31);
  adultFace(g, "dbrown", "pink", 22);
  // round glasses: thin frames round each eye, a bridge and the near arm back to the hair
  ring(g, 21.5, 28.5, 3.6, 4.4, "dbrown");
  ring(g, 34, 28.5, 4.4, 4.4, "dbrown");
  g.rect(26, 27, 3, 1, "dbrown");
  g.rect(39, 28, 3, 1, "dbrown");
  // the canvas tote hangs off her right shoulder by a brown strap, the apple facing out
  g.rect(15, 45, 1, 6, "brown");
  g.rect(3, 50, 15, 14, "cream");
  g.rect(14, 50, 4, 14, "tan");
  g.cel(9, 57.5, 3, 3, "red", "dred");
  g.p(8, 56, "white");
  g.rect(9, 53, 2, 1, "dgreen");
  g.p(9, 54, "dbrown");
}

// Every dog's portrait, by name, in build order.
const PORTRAITS: ReadonlyMap<string, Draw> = new Map([
  ["ginger", ginger],
  ["reggie", reggie],
  ["buddy", buddy],
  ["pepe", pepe],
  ["lady", lady],
  ["archie", archie],
  ["sequoia", sequoia],
  ["penny", penny],
  ["kilo", kilo],
]);

// Every walker's portrait, by name, in build order.
const WALKERS: ReadonlyMap<string, Draw> = new Map([
  ["ada", ada],
  ["casey", casey],
  ["mr-b", mrB],
  ["trista", trista],
]);

// How big each dog's portrait is drawn in the 64px well, sat on the bottom edge: the side that brings
// its inked area nearest its size class's target, so the classes step evenly (the square root of the
// area about 35, 40 and 46px). The large dogs fill the well.
const PORTRAIT_SIDE: Readonly<Record<string, number>> = {
  archie: 59,
  buddy: 53,
  ginger: 51,
  kilo: 64,
  lady: 57,
  penny: 64,
  pepe: 56,
  reggie: 53,
  sequoia: 63,
};
// How big each walker's bust is drawn in the 64px well: the adults' heads about 37px from crown to
// chin, topping out 2 or 3px under the well's top edge, and Ada smaller as the youngest.
const WALKER_SIDE: Readonly<Record<string, number>> = {
  ada: 64,
  casey: 66,
  "mr-b": 72,
  trista: 69,
};

// draw's portrait, drawn at side over S of its design, sat on the bottom edge of an S x S image; a
// side over S zooms in, cropping the shoulders.
function image(draw: Draw, side = S): RgbaImage {
  if (side === S) {
    const g = edged(new Grid(S, S), "ink", true);
    draw(g);
    return toImage(g.outlined());
  }
  const g = edged(new Mini(side / S, S, S), "ink", true);
  draw(g);
  return toImage(dogs.framed(g.outlined(), S));
}

// [key, draw, side] for every dog's portrait, then every walker's.
function portraits(): (readonly [key: string, draw: Draw, side: number])[] {
  return [
    ...[...PORTRAITS].map(([n, d]) => [`portrait-dog-${n}`, d, PORTRAIT_SIDE[n]!] as const),
    ...[...WALKERS].map(([n, d]) => [`portrait-walker-${n}`, d, WALKER_SIDE[n]!] as const),
  ];
}

// The outlined happy face of every dog, as its face-dog sprite shows it, then every walker, in
// portraits() order.
function faces(): Frame[] {
  return [
    ...[...PORTRAITS.keys()].map((name) =>
      dogs.faceFrame(dogs.DOGS[name]![1], "happy", dogs.FACE_SIDE[name]!),
    ),
    ...[...WALKERS.keys()].map((name) =>
      WALKER_FACES.get(`walker-${name}`)!(FULL, "happy").outlined(),
    ),
  ];
}

// One row per dog, then per walker: its happy face at 2x, then the portrait on the dog pick's tile
// colours and the detail card well's sky.
export function preview(out: string, scale = 4): void {
  const grounds: readonly Rgb[] = [
    [228, 166, 114],
    [234, 212, 170],
    [254, 231, 97],
    [58, 68, 102],
    [0, 153, 219],
  ];
  const cell = S + 4;
  const keys = portraits();
  const sheet = filledImage(
    [...PREVIEW_BACKGROUND, 255],
    cell * (1 + grounds.length) * scale,
    cell * keys.length * scale,
  );
  const faceFrames = faces();
  if (faceFrames.length !== keys.length) {
    throw new Error("faces and portraits differ in length");
  }
  keys.forEach(([, draw, side], i) => {
    const face = resizeNearest(S, S, toImage(faceFrames[i]!));
    const im = image(draw, side);
    [face, ...Array<RgbaImage>(grounds.length).fill(im)].forEach((tileIm, j) => {
      const tile = filledImage([...grounds[Math.max(0, j - 1)]!, 255], S, S);
      paste({ at: { x: 0, y: 0 }, keepAlpha: true, mask: "alpha" }, tileIm, tile);
      paste(
        { at: { x: j * cell * scale, y: i * cell * scale } },
        resizeNearest(S * scale, S * scale, tile),
        sheet,
      );
    });
  });
  writeFileSync(out, rgbPng(sheet));
}

export function build(): void {
  mkdirSync("art/portraits", { recursive: true });
  mkdirSync("public/art/images", { recursive: true });
  const keys = portraits();
  for (const [key, draw, side] of keys) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, savePng(image(draw, side)));
    execFileSync("aseprite", ["-b", png, "--save-as", `art/portraits/${key}.aseprite`], {
      stdio: "inherit",
    });
  }
  console.log("built", keys.map(([key]) => key).join(", "));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 2 && argv[0] === "preview") {
    preview(argv[1]!);
  } else if (argv.length === 1 && argv[0] === "build") {
    build();
  } else {
    console.error(USAGE);
    process.exit(1);
  }
}
