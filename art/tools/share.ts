// Draw the site's link-preview image.
//
// share-card: a 300x157 picture in the house palette, fully opaque, scaled 4x with
// nearest-neighbour to 1200x628, then padded with 1px of ink (its border colour) above and below to
// the 1200x630 Open Graph size. Dark wood boards on the left carry the logo and the tagline in
// font-title at 2x; on the right, a window onto Cabbagetown: the backdrop's houses and cross street,
// the road widening below them, and Casey walking Kilo, Lady and Ginger up the middle in the game's
// pack formation, the leashes running behind Casey to her hands.
//
// Built from public/art/images/ (logo, backdrop-cabbagetown, road-cabbagetown), the walker and dog
// sprites in public/art/sprites/ and the font-title BMFont in public/art/fonts/, so build those
// first (screens.ts, backdrops.ts, roads.ts, road.ts, dogs.ts, fonts.ts). It is not a game asset,
// so it is written to public/, outside public/art/.
//
// Run from the repository root.
import { readFileSync, writeFileSync } from "node:fs";

import {
  drawBitmapText,
  measureBitmapText,
  readBitmapFont,
} from "@andornaut/art-kit/build/bitmapFont";
import { decodePng } from "@andornaut/art-kit/build/png";
import {
  channel,
  crop,
  fill,
  filledImage,
  opaque,
  paste,
  resizeNearest,
} from "@andornaut/art-kit/build/raster";
import { blankImage, opaqueRect, type RgbaImage } from "@andornaut/art-kit/build/rgbaImage";

import * as bd from "./backdrops.ts";
import { GAME, PALETTE64, rgbPng, run } from "./pixel.ts";
import * as sn from "./scene.ts";
import { planks } from "./screens.ts";

const USAGE = `Usage:
  node art/tools/share.ts preview OUT.png   the card at 1200x630
  node art/tools/share.ts build             write public/og-image.png`;

const W = 300;
const H = 157;
const SCALE = 4;
const OUT_W = 1200;
const OUT_H = 630;
const TAGLINE: readonly string[] = ["A COZY", "PIXEL-ART", "DOG-WALKING", "LANE RUNNER"];

// The window onto Cabbagetown: its left edge, and the backdrop rows it shows above the road.
const VIEW_X = 152;
const VIEW_W = W - 1 - VIEW_X;
// The first backdrop row shown, 46 rows over the far side's ground row.
const BAND_TOP = bd.BASE - 46;
const BAND_ROWS = bd.H - BAND_TOP;
// Cabbagetown's zone id.
const STREET = [...sn.ZONES].find(([, v]) => v.art === "cabbagetown")![0];

// The pack's formation, as src/layout/packFormation.ts: each dog's side (lead 0, left -1, right 1)
// and distance ahead of the feet, the dogs in formation order. One dog leads; two walk side by side;
// three walk in a triangle, the lead's row keyed by the three sizes and three large dogs' side dogs
// closer in.
const SIDES: Readonly<Record<string, number>> = { lead: 0, left: -1, right: 1 };
const SIZES: ReadonlyMap<string, string> = new Map(GAME.dogs.map((d) => [d.id, d.size]));

function formation(dogs: readonly string[]): [side: number, row: number][] {
  const feet = sn.PACK.feet;
  const sizes = dogs.map((d) => SIZES.get(d)!);
  let rows =
    sizes.length === 1
      ? [feet.lead[sizes[0]!]!]
      : sizes
          .slice(-2)
          .map((s) =>
            sizes.length === 3 && sizes.every((z) => z === "large")
              ? feet.sideOfThreeLarge
              : feet.side[s]!,
          );
  if (sizes.length === 3) {
    rows = [feet.trioLead[sizes.join(" ")]!, ...rows];
  }
  const slots = sn.PACK.slots[dogs.length - 1]!;
  return slots.slice(0, rows.length).map((slot, i) => [SIDES[slot]!, -rows[i]!]);
}

// ---------- font-title, read from its BMFont export ----------

const TITLE_ATLAS = decodePng(readFileSync("public/art/fonts/font-title.png"));
// The share card uses unkerned lettering, with the final glyph's trailing gap removed.
const TITLE = {
  ...readBitmapFont(readFileSync("public/art/fonts/font-title.fnt", "utf8")),
  kernings: [],
};
const TITLE_LAYOUT = { font: TITLE, lineSpacing: 0, missing: "reject" } as const;

// s in font-title at sc, centred on mid with its cap tops on row y, in col with a 1px rim all round.
function label(
  cv: sn.Canvas,
  s: string,
  mid: number,
  y: number,
  col: string,
  rim: string,
  sc = 2,
): void {
  const bounds = measureBitmapText(TITLE_LAYOUT, s).glyphBounds!;
  const ink = blankImage(bounds.width, bounds.height);
  drawBitmapText(
    {
      ...TITLE_LAYOUT,
      at: { x: -bounds.x, y: -bounds.y },
      atlas: TITLE_ATLAS,
      tint: [255, 255, 255],
    },
    s,
    ink,
  );
  const mask = channel(3, resizeNearest(ink.width * sc, ink.height * sc, ink));
  const x = Math.round(mid - ((bounds.x + bounds.width) * sc) / 2) + bounds.x * sc;
  const rect = { height: mask.height, width: mask.width, x, y };
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [1, 1],
  ] as const) {
    fill({ mask, rect: { ...rect, x: x + dx, y: y + dy } }, [...sn.rgb(rim), 255], cv.img);
  }
  fill({ mask, rect }, [...sn.rgb(col), 255], cv.img);
}

// ---------- the window onto Cabbagetown ----------

// VIEW_W x (H - 2): the backdrop's street around its vanishing point, then the road strip sampled as
// the street keeps widening toward the viewer, with the pack walking up it.
function streetView(): RgbaImage {
  const cx = Math.floor(VIEW_W / 2);
  const zone = sn.ZONES.get(STREET)!;
  const view = new sn.Scene(VIEW_W, H - 2);
  view.shade = zone.shadow;
  view.leashCol = zone.leash;
  const band = opaque(sn.image(`backdrop-${zone.art}`));
  const left = bd.CX - cx;
  paste(
    { at: { x: 0, y: 0 } },
    crop({ height: bd.H - BAND_TOP, width: VIEW_W, x: left, y: BAND_TOP }, band),
    view.img,
  );
  // Below the band the street keeps receding: the ground scale climbs from the band's bottom row
  // (about 0.5) to 1 at the walker's feet, and each row samples the road strip at that scale.
  const road = sn.TILES.get(STREET)!;
  const rows = view.img.height - BAND_ROWS;
  let z = 0;
  for (let r = 0; r < rows; r++) {
    const s = 0.5 + 0.5 * Math.min(1, (r + 1) / (rows - 6));
    const sy = ((Math.trunc(z) % road.height) + road.height) % road.height;
    for (let x = 0; x < VIEW_W; x++) {
      const sx = Math.trunc(road.width / 2 + (x + 0.5 - cx) / s);
      const from = (sy * road.width + Math.min(Math.max(sx, 0), road.width - 1)) * 4;
      view.img.data.set(
        road.data.subarray(from, from + 4),
        ((BAND_ROWS + r) * view.img.width + x) * 4,
      );
    }
    z -= 1 / s;
  }
  pack(view, cx, view.img.height - 6);
  return view.img;
}

// The pack at full size with the walker's feet on row base: the dogs in the game's formation, far
// ones first, then a leash from her hand to each collar, then Casey over them, so the leashes pass
// behind her and show only from her hands to the collars.
function pack(view: sn.Scene, cx: number, base: number): void {
  const stand = (key: string, x: number, feet: number, shadow = true): void => {
    const f = sn.frame(key, "walk");
    if (shadow) {
      view.shadow(x, feet + 1, f.width);
    }
    const r = opaqueRect({ height: f.height, width: f.width, x: 0, y: 0 }, f)!;
    view.paste(f, x - Math.floor(f.width / 2), feet - (r.y + r.height) + 1);
  };

  // Large, medium, small: formation order.
  const ids = ["kilo", "lady", "ginger"];
  const dogs = formation(ids).map(
    ([side, row], i) => [`dog-${ids[i]!}`, sn.sideDx(`dog-${ids[i]!}`, side), base - row] as const,
  );
  for (const [k, dx, feet] of [...dogs].sort((a, b) => a[2] - b[2])) {
    stand(k, cx + dx, feet);
  }
  const walker = sn.frame("walker-casey", "walk");
  view.shadow(cx, base + 1, walker.width);
  for (const [key, dx, feet] of dogs) {
    const hand = dx < 0 ? sn.HANDS[0] : sn.HANDS[1];
    view.line(cx + hand, base - sn.HANDS[2], cx + dx, feet - sn.collar(key), view.leashCol);
  }
  stand("walker-casey", cx, base, false);
}

// ---------- the card ----------

function card(): RgbaImage {
  const cv = new sn.Canvas(W, H);
  // dark wood boards, then a post between them and the window
  planks(cv, 0, 0, VIEW_X, H, 11, { seed: 21 });
  paste({ at: { x: VIEW_X, y: 1 } }, streetView(), cv.img);
  cv.fill(VIEW_X - 4, 0, 4, H, "tan");
  cv.fill(VIEW_X - 4, 0, 1, H, "cream");
  cv.fill(VIEW_X - 1, 0, 1, H, "brown");
  cv.fill(VIEW_X - 5, 0, 1, H, "plum");
  // the ink border, which the padding continues
  cv.fill(0, 0, W, 1, "ink");
  cv.fill(0, H - 1, W, 1, "ink");
  cv.fill(0, 0, 1, H, "ink");
  cv.fill(W - 1, 0, 1, H, "ink");
  // the logo and the tagline, centred on the boards
  const mid = Math.floor((VIEW_X - 5) / 2);
  const logo = sn.image("logo");
  const block = logo.height + 14 + TAGLINE.length * 16 - 4;
  let y = Math.floor((H - block) / 2);
  cv.paste(logo, mid - Math.floor(logo.width / 2), y);
  y += logo.height + 14;
  for (const line of TAGLINE) {
    label(cv, line, mid, y, "cream", "plum");
    y += 16;
  }
  return cv.img;
}

function check(img: RgbaImage): void {
  const pal = new Set(PALETTE64.map((c) => sn.rgb(c).join(",")));
  const bad = new Set<string>();
  for (let i = 0; i < img.data.length; i += 4) {
    const c = [...img.data.subarray(i, i + 3)].join(",");
    if (!pal.has(c)) {
      bad.add(c);
    }
  }
  if (bad.size) {
    console.error(`off-palette colours: ${[...bad].sort().slice(0, 8).join(" ")}`);
    process.exit(1);
  }
}

// The card at SCALE, padded with the ink border to OUT_W x OUT_H.
function final(img: RgbaImage): RgbaImage {
  const big = resizeNearest(W * SCALE, H * SCALE, img);
  const out = filledImage([...sn.rgb("ink"), 255], OUT_W, OUT_H);
  paste(
    {
      at: { x: Math.floor((OUT_W - big.width) / 2), y: Math.floor((OUT_H - big.height) / 2) },
    },
    big,
    out,
  );
  return out;
}

function build(): void {
  const img = card();
  check(img);
  writeFileSync("public/og-image.png", rgbPng(final(img)));
  console.log("built share-card");
}

if (import.meta.main) {
  await run({
    commands: {
      build: () => build(),
      "preview OUT.png": (out) => {
        const img = card();
        check(img);
        writeFileSync(out, rgbPng(final(img)));
      },
    },
    doc: USAGE,
  });
}
