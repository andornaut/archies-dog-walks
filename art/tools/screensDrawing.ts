import { crop, type Rgba } from "@andornaut/art-kit/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { type DrawingScope, Grid, LAYOUT } from "./pixel.ts";
import { Canvas, rgb } from "./scene.ts";

// The screen's size, from the layout's screen.
export const W = LAYOUT.screen.width;

export const H = LAYOUT.screen.height;

export const LOGO_W = 145;

export const LOGO_H = 41;

export const SIGN_W = 128;

export const SIGN_H = 38;

export const SIGN_AT: readonly [number, number] = [6, 106];

// A pixel rectangle, as art-kit's raster ops take it.
type Rect = Parameters<typeof crop>[0];

// The grid every drawing here makes, which small() swaps for a Mini while it draws ui-loading.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

// A small deterministic generator, so a rebuild draws the same specks.
export function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A canvas with a transparent background, for the logo and the pasted strips. A build saves it as
// an RGBA PNG; a Canvas as an RGB one.
export class Clear extends Canvas {
  constructor(w: number, h: number) {
    super(w, h);
    this.img = blankImage(w, h);
  }
}

export function clear(w: number, h: number): Clear {
  return new Clear(w, h);
}

export const key = (x: number, y: number): string => `${x},${y}`;

export function xy(k: string): [number, number] {
  const [x = 0, y = 0] = k.split(",").map(Number);
  return [x, y];
}

export function rgba(c: string): Rgba {
  return [...rgb(c), 255];
}

// The hex colour of image's pixel x, y, ignoring alpha.
export function hexAt(img: RgbaImage, x: number, y: number): string {
  const i = (y * img.width + x) * 4;
  return [0, 1, 2].map((k) => img.data[i + k]!.toString(16).padStart(2, "0")).join("");
}

export function alphaAt(img: RgbaImage, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3]!;
}

export function setPixel(img: RgbaImage, x: number, y: number, c: Rgba): void {
  img.data.set(c, (y * img.width + x) * 4);
}

export function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { height: y1 - y0, width: x1 - x0, x: x0, y: y0 };
}

export const PAW: readonly string[] = [".#.#.", "#...#", ".###.", ".###."];
