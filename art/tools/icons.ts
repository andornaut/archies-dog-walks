// Draw the shop's gear icons.
//
// item-<id>: 32x32 images in Endesga 32 with coloured outlines (iconEdge, so they hold 3:1 on the
// tiles' tan and cream), on transparency. The ids are the shop's data ids in kebab case:
// item-hall-pass is the Hall pass, a cream pass card on a lanyard.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { filledImage, paste, resizeNearest, type Rgb } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { fannyPack as dropsFannyPack } from "./drops.ts";
import { Mini } from "./mini.ts";
import { bitmap, Grid, iconEdge, rgbPng, run, savePng, toImage } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/icons.ts preview OUT.png   every icon on the shop's slot colours, scaled up
  node art/tools/icons.ts build             write art/icons/*.aseprite and public/art/images/*.png`;

// ---------- gear ----------

// drops.ts's forest-green waist pack, drawn at 2x.
function fannyPack(g: Grid): void {
  const m = new Mini(2, 16, 16);
  dropsFannyPack(m);
  g.px = m.px;
}

// The Hall pass: a cream pass card on a sky lanyard, its clip through a slot punched in the red
// header band, a dred paw stamp on the left and brown lines of print on the right.
function hallPass(g: Grid): void {
  for (let i = 0; i < 9; i++) {
    g.p(7 + i, i, "sky");
    g.p(8 + i, i, "blue");
    g.p(24 - i, i, "sky");
    g.p(23 - i, i, "blue");
  }
  g.rect(3, 12, 26, 17, "cream");
  g.rect(3, 12, 26, 5, "red");
  g.rect(3, 12, 26, 1, "pink");
  g.rect(28, 12, 1, 17, "tan");
  g.rect(3, 28, 26, 1, "tan");
  g.rect(28, 12, 1, 5, "dred");
  g.rect(13, 13, 6, 2, null);
  g.rect(14, 8, 4, 2, "lgrey");
  g.rect(15, 10, 2, 5, "lgrey");
  g.p(17, 9, "grey");
  for (const [x, y] of [
    [6, 20],
    [9, 18],
    [13, 18],
    [16, 20],
  ] as const) {
    g.rect(x, y, 2, 2, "dred");
  }
  g.ell(11.5, 24.5, 4, 2.6, "dred");
  for (const [y, w] of [
    [20, 7],
    [23, 7],
    [26, 5],
  ] as const) {
    g.rect(20, y, w, 1, "brown");
  }
}

// A low running shoe side on, the toe to the left: a sky upper lit cyan along its top, three white
// laces, a navy collar, an orange stripe and heel tab, and a white sole with a toe spring on an lgrey
// outsole.
function runningShoes(g: Grid): void {
  bitmap(
    g,
    2,
    10,
    [
      "......................oo...",
      "...............ccccccccoo..",
      "..............cwwnnnnnnsoo.",
      ".............cssbnnnnnnsss.",
      "...........ccwwssssssssssb.",
      ".........ccsssbsssssoooossb",
      ".......ccswwsssssoooosssssb",
      ".....ccssssssooooossssssssb",
      "...ccsssssooooosssssssssssb",
      ".cccsssssssssssssssssssssbb",
      ".sbbbbbbbbbbbbbbbbbbbbbbbbb",
      ".wwwwwwwwwwwwwwwwwwwwwwwwww",
      "..wwwwwwwwwwwwwwwwwwwwwwwww",
      "...lllllllllllllllllllllll.",
    ],
    { b: "blue", c: "cyan", l: "lgrey", n: "navy", o: "orange", s: "sky", w: "white" },
  );
}

// The lucky collar: a red collar ring with an amber tag carrying a green clover.
function luckyCollar(g: Grid): void {
  g.ell(16, 13, 11, 7, "red", "dred", "pink");
  g.ell(16, 13, 8, 4.5, null);
  g.ell(16, 23, 4, 4, "amber", "orange", "yellow");
  for (const [cx, cy] of [
    [14.5, 22.5],
    [17.5, 22.5],
    [16, 24.8],
  ] as const) {
    g.ell(cx, cy, 1.6, 1.6, "green");
  }
}

// The whistle: a silver sports whistle side on, lit white along its top, its mouthpiece running right
// with an ink slot on top, a dred paw stamped on the barrel, and three cyan sound lines fanning up
// from the slot.
function whistle(g: Grid): void {
  g.ell(13, 20, 9, 8, "lgrey", "grey", "white");
  g.rect(13, 12, 17, 7, "lgrey");
  g.rect(13, 12, 17, 1, "white");
  g.rect(13, 18, 17, 1, "grey");
  g.rect(29, 12, 1, 7, "grey");
  g.rect(15, 12, 5, 3, null);
  g.rect(15, 14, 5, 1, "dslate");
  for (const [x, y] of [
    [10, 17],
    [12, 17],
    [9, 18],
    [13, 18],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(10, 19, 3, 3, "dred");
  for (const [x, y] of [
    [16, 9],
    [16, 8],
    [16, 7],
    [20, 9],
    [21, 8],
    [22, 7],
    [12, 9],
    [11, 8],
    [10, 7],
  ] as const) {
    g.p(x, y, "cyan");
  }
}

// The icons by shop id, in build order.
export const ICONS: ReadonlyMap<string, (g: Grid) => void> = new Map([
  ["whistle", whistle],
  ["fanny-pack", fannyPack],
  ["hall-pass", hallPass],
  ["running-shoes", runningShoes],
  ["lucky-collar", luckyCollar],
]);

// One icon on a 32x32 grid, outlined with iconEdge, as an RGBA image.
export function image(draw: (g: Grid) => void): RgbaImage {
  const g = new Grid(32, 32);
  g.edge = iconEdge;
  draw(g);
  return toImage(g.outlined());
}

// ---------- preview ----------

// Every icon on the shop's slot colours, scaled up.
export function preview(out: string, scale = 4): void {
  const grounds: readonly Rgb[] = [
    [234, 212, 170],
    [228, 166, 114],
  ];
  const sheet = filledImage(
    [24, 20, 37, 255],
    36 * ICONS.size * scale,
    36 * grounds.length * scale,
  );
  [...ICONS.values()].forEach((draw, i) => {
    const im = image(draw);
    grounds.forEach((ground, j) => {
      const tile = filledImage([...ground, 255], 32, 32);
      paste({ at: { x: 0, y: 0 }, mask: "alpha" }, im, tile);
      paste(
        { at: { x: i * 36 * scale, y: j * 36 * scale } },
        resizeNearest(32 * scale, 32 * scale, tile),
        sheet,
      );
    });
  });
  writeFileSync(out, rgbPng(sheet));
}

// ---------- building ----------

export function build(): void {
  mkdirSync("art/icons", { recursive: true });
  mkdirSync("public/art/images", { recursive: true });
  const built: string[] = [];
  for (const [name, draw] of ICONS) {
    const key = `item-${name}`;
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, savePng(image(draw)));
    execFileSync("aseprite", ["-b", png, "--save-as", `art/icons/${key}.aseprite`], {
      stdio: "inherit",
    });
    built.push(key);
  }
  console.log("built", built.join(", "));
}

if (import.meta.main) {
  await run({
    commands: { build: () => build(), "preview OUT.png": (out) => preview(out) },
    doc: USAGE,
  });
}
