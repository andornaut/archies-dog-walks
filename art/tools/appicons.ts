// Draw the site's icons: the home-screen app icons and the favicons.
//
// Archie's own art on flat sky, the blue behind his portrait on the detail card (ui-detail-well), in
// the house palette. The ink outline holds 5.6:1 on sky, so he separates from it in colour and in grey.
//
// The app icons scale the master, Archie's 64x64 portrait (public/art/images/portrait-dog-archie.png)
// on sky, by a whole number with nearest-neighbour, centred on CENTRE (33,37 in the portrait, the
// middle of his head and body, fixed so his tail does not move him) with the sky carried to the
// icon's edges, so every icon pixel is one master pixel. Archie fills most of each icon: under the
// maskable icon's central 80% safe circle, his head from below the ear tips (portrait rows 23 to 41)
// and his whole bandana stay inside it, and the ear tips, paws and tail may be cropped. The iOS
// rounded square crops less than that circle, so the 180 shows him whole.
//
//   apple-touch-icon.png    180x180  master x3
//   icon-192.png            192x192  master x3
//   icon-512.png            512x512  master x8
//   icon-maskable-512.png   512x512  the same image as icon-512
//
// The favicons are drawn at their own size, a tile with its corners cut:
//
//   favicon-32.png          32x32    Archie's happy face (archieFace in dogs.ts) drawn at
//                                    FAVICON_SIDE over 32 of its design and cropped to 32x32
//                                    from the ear tips down, centred across, so his head fills
//                                    the tile to the top of the bandana; its eyes, which that
//                                    scale draws unevenly, drawn again alike (FAVICON_EYE); on
//                                    sky, the corners cut by 2px
//   favicon-16.png          16x16    the face drawn again close at half size (ARCHIE_16), the
//                                    head filling the tile above the top of the bandana; on sky,
//                                    the corners cut by 1px
//
// Run from the repository root after portraits: the app icons read Archie's exported portrait. The
// icons are not in public/art/manifest.json: the pages and the web app manifest link them by path.
// A build overwrites the icons, so change this file or Archie's art, not the icons.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { rgb as hexRgb } from "@andornaut/art-kit/colour";
import { decodePng, encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import { filledImage, paste, resizeNearest, type Rgb } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as dogs from "./dogs.ts";
import { scaled, small } from "./mini.ts";
import { K, PALETTE64, PNG_OPTIONS, run } from "./pixel.ts";
import { scope as roadScope } from "./road.ts";

const USAGE = `Usage:
  node art/tools/appicons.ts preview OUT.png   every icon at its native size on ink, the maskable
                                               icon cropped to a circle with the safe zone marked,
                                               and the favicons at 1x and 8x
  node art/tools/appicons.ts build             write public/icons/<icon>.png, the favicons
                                               included`;

const FAVICON_32 = "public/icons/favicon-32.png";
const FAVICON_16 = "public/icons/favicon-16.png";

const PORTRAIT = "public/art/images/portrait-dog-archie.png";
const BACKGROUND = "sky"; // ui-detail-well's face, behind his portrait on the detail card
const SAFE = 0.4; // the maskable safe zone: a circle of radius 40% of the icon size
const CENTRE: readonly [number, number] = [33, 37]; // the portrait point the icons centre on
const KEEP_ROWS: readonly [number, number] = [23, 42]; // the head below the ear tips to the chin, end exclusive
const BANDANA = ["red", "dred"];

// name: [size, scale]
const ICONS: readonly (readonly [string, number, number])[] = [
  ["apple-touch-icon", 180, 3],
  ["icon-192", 192, 3],
  ["icon-512", 512, 8],
  ["icon-maskable-512", 512, 8],
];

// The 32 favicon: the face drawn at FAVICON_SIDE over 32, and each eye drawn again as the inside of the
// portrait's eye (k ink, w white, i the iris): the shine at the top left, the pupil at the right.
const FAVICON_SIDE = 36;
const FAVICON_EYE = ["wwi", "wkk", "ikk", "iii"];

// The happy face at half size and close, the head filling the tile above the top of the bandana: the
// ears' dbrown folds in the top corners, the blaze into the muzzle, the sky and amber eyes drawn alike
// (the iris down the left column, the pupil down the right), ochre cheeks, the plum nose and the tongue.
const ARCHIE_16 = [
  ".kk..........kk.",
  "kDDk........kDDk",
  "kDbbkkkkkkkkbbDk",
  ".kssbbbwwbbbbbk.",
  ".ksbbbbwwbbbbDk.",
  ".ksbSkbwwbakbDk.",
  ".ksbSkwwwwakbDk.",
  ".kobbwwwwwwbbok.",
  ".kbbwwwppwwwbDk.",
  "..kbwwwppwwlDk..",
  "..kbwwkPPkwlDk..",
  "...kDwlPmllDk...",
  "...kkDDllDDkk...",
  "..kRRRRRRRRRRk..",
  ".kwrrrrrRRRRRlk.",
  ".kwlrrrrRRRRllk.",
];
const INK: Readonly<Record<string, string>> = {
  D: "dbrown",
  P: "pink",
  R: "dred",
  S: "sky",
  a: "amber",
  b: "brown",
  k: "ink",
  l: "lgrey",
  m: "mauve",
  o: "ochre",
  p: "plum",
  r: "red",
  s: "skin2",
  w: "white",
};

// Opaque pixels keyed by "x,y".
type Pixels = Map<string, Rgb>;

// An icon and whether it is saved as RGB (the app icons) or RGBA (the favicons).
interface Icon {
  image: RgbaImage;
  opaque: boolean;
}

const key = (x: number, y: number): string => `${x},${y}`;

function rgb(c: string): Rgb {
  return hexRgb(c);
}

function colourOf(name: string): Rgb {
  return rgb(K[name]!);
}

function setPixel(image: RgbaImage, x: number, y: number, c: Rgb, a = 255): void {
  image.data.set([...c, a], (y * image.width + x) * 4);
}

function getRgb(image: RgbaImage, x: number, y: number): Rgb {
  const i = (y * image.width + x) * 4;
  return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!];
}

// img's opaque pixels.
function opaque(img: RgbaImage): Pixels {
  const out: Pixels = new Map();
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]) {
        out.set(key(x, y), getRgb(img, x, y));
      }
    }
  }
  return out;
}

// The background colour at any pixel: flat sky, defined past any edge.
function ground(): Rgb {
  return colourOf(BACKGROUND);
}

function portrait(): Pixels {
  return opaque(decodePng(readFileSync(PORTRAIT)));
}

// subject on sky at a whole scale, centred on CENTRE, the sky carried to the edges.
function render(subject: Pixels, size: number, scale: number): RgbaImage {
  const [cx, cy] = CENTRE;
  const ox = size / 2 - cx * scale;
  const oy = size / 2 - cy * scale;
  if (!Number.isInteger(ox) || !Number.isInteger(oy)) {
    throw new Error(`${size} does not centre the portrait at x${scale}`);
  }
  const img = filledImage([0, 0, 0, 255], size, size);
  for (let y = 0; y < size; y++) {
    const my = Math.floor((y - oy) / scale);
    for (let x = 0; x < size; x++) {
      const mx = Math.floor((x - ox) / scale);
      setPixel(img, x, y, subject.get(key(mx, my)) ?? ground());
    }
  }
  return img;
}

// Whether every corner of every pixel of his head below the ear tips (KEEP_ROWS) and of his bandana
// lies inside the safe circle.
function inSafeZone(subject: Pixels, size: number, scale: number): boolean {
  const [cx, cy] = CENTRE;
  const r = SAFE * size;
  const bandana = new Set(BANDANA.map((c) => K[c]!.toLowerCase()));
  for (const [at, c] of subject) {
    const [x, y] = at.split(",").map(Number) as [number, number];
    const hex = c.map((v) => v.toString(16).padStart(2, "0")).join("");
    if ((y < KEEP_ROWS[0] || y >= KEEP_ROWS[1]) && !bandana.has(hex)) {
      continue;
    }
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      if (Math.hypot((x + dx - cx) * scale, (y + dy - cy) * scale) > r + 1e-9) {
        return false;
      }
    }
  }
  return true;
}

// A favicon: px over bg(x, y) on an n x n tile, the corners cut by a cut-pixel bevel.
function tile(n: number, px: Pixels, bg: (x: number, y: number) => Rgb, cut: number): RgbaImage {
  const img = filledImage([0, 0, 0, 0], n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (Math.min(x, n - 1 - x) + Math.min(y, n - 1 - y) >= cut) {
        setPixel(img, x, y, px.get(key(x, y)) ?? bg(x, y));
      }
    }
  }
  return img;
}

// The happy face at FAVICON_SIDE over 32, its eyes drawn again alike, cropped to 32x32 from its top
// row and centred across.
function favicon32(): RgbaImage {
  const s = FAVICON_SIDE / 32;
  const px = small(roadScope, dogs.scope, s, dogs.archieFace, "happy").outlined();
  const top = scaled(dogs.ARCHIE_EYE_Y, s);
  dogs.ARCHIE_EYES.forEach(([x, iris], i) => {
    // the scaled 3x3 eye back to coat, then FAVICON_EYE set against the blaze: the far eye at the
    // right of its box, the near one at the left
    const x0 = scaled(x, s);
    const x1 = scaled(x + 3, s);
    for (let y = top; y < scaled(dogs.ARCHIE_EYE_Y + 3, s); y++) {
      px[y]!.fill(K[dogs.COAT[0]]!, x0, x1);
    }
    const ex = i === 0 ? x1 - FAVICON_EYE[0]!.length : x0;
    const inks: Readonly<Record<string, string>> = { i: iris, k: "ink", w: "white" };
    FAVICON_EYE.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        px[top + dy]![ex + dx] = K[inks[ch]!]!;
      });
    });
  });
  const face: [number, number, Rgb][] = [];
  px.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c) {
        face.push([x, y, rgb(c)]);
      }
    }),
  );
  const xs = face.map(([x]) => x);
  const dx = 16 - Math.floor((Math.min(...xs) + Math.max(...xs) + 1) / 2);
  const dy = -Math.min(...face.map(([, y]) => y));
  const shifted: Pixels = new Map();
  for (const [x, y, c] of face) {
    if (y + dy >= 0 && y + dy < 32) {
      shifted.set(key(x + dx, y + dy), c);
    }
  }
  return tile(32, shifted, ground, 2);
}

function favicon16(): RgbaImage {
  const px: Pixels = new Map();
  ARCHIE_16.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".") {
        px.set(key(x, y), colourOf(INK[ch]!));
      }
    }),
  );
  return tile(16, px, ground, 1);
}

// Exact size, every opaque pixel a house palette colour; the app icons fully opaque.
function check(name: string, icon: Icon, size: number): void {
  const { image } = icon;
  if (image.width !== size || image.height !== size) {
    throw new Error(`${name}: ${image.width}x${image.height}`);
  }
  if (icon.opaque === name.startsWith("favicon")) {
    throw new Error(`${name}: ${icon.opaque ? "RGB" : "RGBA"}`);
  }
  const palette = new Set(PALETTE64.map((c) => c.toLowerCase()));
  const stray = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3]!;
    if (icon.opaque && alpha !== 255) {
      throw new Error(`${name}: alpha ${alpha}`);
    }
    if (alpha) {
      const hex = [...image.data.subarray(i, i + 3)]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      if (!palette.has(hex)) {
        stray.add(hex);
      }
    }
  }
  if (stray.size > 0) {
    throw new Error(`${name}: off-palette ${[...stray].join(", ")}`);
  }
}

// path: icon for every icon the site serves.
function icons(): Map<string, Icon> {
  const subject = portrait();
  const out = new Map<string, Icon>();
  for (const [name, size, scale] of ICONS) {
    if (name.includes("maskable") && !inSafeZone(subject, size, scale)) {
      throw new Error(`${name}: Archie's face leaves the safe zone at x${scale}`);
    }
    out.set(`public/icons/${name}.png`, { image: render(subject, size, scale), opaque: true });
  }
  out.set(FAVICON_32, { image: favicon32(), opaque: false });
  out.set(FAVICON_16, { image: favicon16(), opaque: false });
  for (const [path, icon] of out) {
    check(basename(path, ".png"), icon, icon.image.width);
  }
  return out;
}

// An icon as an RGB PNG if opaque, else RGBA; optimize compresses the shipped icons harder.
function iconPng(icon: Icon, optimize = false): Uint8Array {
  const options = optimize ? { ...PNG_OPTIONS, deflateLevel: 9 } : PNG_OPTIONS;
  return icon.opaque ? encodeRgbPng(options, icon.image) : encodeRgbaPng(options, icon.image);
}

function preview(out: string, gap = 16, zoom = 8): void {
  const imgs = icons();
  const big = imgs.get("public/icons/icon-maskable-512.png")!.image;
  const size = big.width;
  // The maskable icon under the most aggressive mask, a circle the full width, with the safe circle
  // in hot pink.
  const masked = filledImage([...colourOf("ink"), 255], size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d <= c) {
        setPixel(masked, x, y, getRgb(big, x, y));
      }
      if (Math.abs(d - SAFE * size) < 1) {
        setPixel(masked, x, y, colourOf("hot"));
      }
    }
  }
  const row = [
    ...[...imgs]
      .filter(([path]) => path !== FAVICON_32 && path !== FAVICON_16)
      .map(([, icon]) => icon.image),
    masked,
  ];
  const ones = [imgs.get(FAVICON_32)!.image, imgs.get(FAVICON_16)!.image];
  const favs = [...ones, ...ones.map((im) => resizeNearest(im.width * zoom, im.height * zoom, im))];
  const sum = (ims: readonly RgbaImage[]): number => ims.reduce((n, im) => n + im.width, 0);
  const width = Math.max(sum(row), sum(favs)) + gap * (row.length + 1);
  const sheet = filledImage([...colourOf("ink"), 255], width, gap * 3 + 512 + 32 * zoom);
  let x = gap;
  for (const im of row) {
    paste({ at: { x, y: gap } }, im, sheet);
    x += im.width + gap;
  }
  x = gap;
  for (const im of favs) {
    paste({ at: { x, y: gap * 2 + 512 }, keepAlpha: true, mask: "alpha" }, im, sheet);
    x += im.width + gap;
  }
  writeFileSync(out, iconPng({ image: sheet, opaque: true }));
}

function build(): void {
  mkdirSync("public/icons", { recursive: true });
  const imgs = icons();
  for (const [path, icon] of imgs) {
    writeFileSync(path, iconPng(icon, true));
  }
  console.log("built", [...imgs.keys()].join(", "));
}

if (import.meta.main) {
  await run({
    commands: { build: () => build(), "preview OUT.png": (out) => preview(out) },
    doc: USAGE,
  });
}
