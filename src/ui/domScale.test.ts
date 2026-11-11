import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { domScale, fontPixel, snapLength, snapRect, snapX } from "./domScale.ts";

// Canvas boxes as phones, a desktop window and a turned phone fit the 360x560 game, at their
// device pixel ratios: fractional fits and offsets, as Phaser's Scale.FIT gives them.
const CASES = [
  { dpr: 1, width: 360, x: 0, y: 0 },
  { dpr: 1, width: 535.7, x: 412.5, y: 0 },
  { dpr: 2, width: 375, x: 7.25, y: 0 },
  { dpr: 2.625, width: 412, x: 0, y: 0 },
  { dpr: 3, width: 393, x: 0, y: 0 },
  { dpr: 3, width: 251.9, x: 61.4, y: 0 },
] as const;

const onDeviceGrid = (dpr: number, css: number) =>
  Math.abs(css * dpr - Math.round(css * dpr)) < 1e-6;

describe("domScale", () => {
  it.each(CASES)("puts every edge on the device grid at %o", ({ dpr, width, x, y }) => {
    const height = (width * SCREEN_CONFIG.height) / SCREEN_CONFIG.width;
    const scale = domScale(dpr, { height, width, x, y });
    for (let col = 0; col <= SCREEN_CONFIG.width; col += 7) {
      expect(onDeviceGrid(dpr, x + snapX(scale, col)), `column ${col}`).toBe(true);
    }
    // Rects sharing an edge in game pixels share it snapped: no gap and no overlap.
    const left = snapRect(scale, { height: 44, width: 131, x: 17, y: 52 });
    const right = snapRect(scale, { height: 44, width: 60, x: 148, y: 52 });
    expect(left.left + left.width).toBeCloseTo(right.left, 9);
    // The layer spans the canvas to within half a device pixel.
    expect(Math.abs(snapX(scale, SCREEN_CONFIG.width) - width)).toBeLessThanOrEqual(
      0.5 / dpr + 1e-9,
    );
  });

  it.each(CASES)(
    "draws a font pixel in whole device pixels, never wider than the fit, at %o",
    ({ dpr, width, x, y }) => {
      const scale = domScale(dpr, { height: 1, width, x, y });
      for (const textScale of [1, 2, 3]) {
        const pixel = fontPixel(scale, textScale);
        expect(onDeviceGrid(dpr, pixel)).toBe(true);
        expect(pixel * dpr).toBeGreaterThanOrEqual(1);
        if (textScale * scale.unit * dpr >= 1) {
          expect(pixel).toBeLessThanOrEqual(textScale * scale.unit + 1e-9);
        }
      }
      expect(snapLength(scale, 0.01) * dpr).toBe(1);
    },
  );

  it("keeps an exact fit's font pixels exact", () => {
    const scale = domScale(3, { height: 560, width: 360, x: 0, y: 0 });
    expect(fontPixel(scale, 2)).toBe(2);
    expect(snapLength(scale, 4)).toBe(4);
  });
});
