import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { UI_STYLE } from "./dom/uiStyle.ts";
import {
  artPixel,
  deviceRect,
  deviceX,
  domScale,
  fontPixel,
  gridTransform,
  sliceLengths,
} from "./domScale.ts";

// Canvas boxes as phones, desktop windows and a dev link's shrunk canvas fit the 360x560 game, at
// their device pixel ratios: fractional fits and offsets, as Phaser's Scale.FIT gives them.
const CASES = [
  { dpr: 1, width: 360, x: 0, y: 0 },
  { dpr: 1, width: 535.7, x: 412.5, y: 0 },
  { dpr: 2, width: 375, x: 7.25, y: 0 },
  { dpr: 2, width: 331.703125, x: 14.140625, y: 0 },
  { dpr: 2.625, width: 412, x: 0, y: 0 },
  { dpr: 3, width: 393, x: 0, y: 0 },
  { dpr: 3, width: 331.703125, x: 14.140625, y: 0 },
] as const;

const parseShift = (transform: string) => {
  const [, x = "", y = ""] = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(transform) ?? [];
  return { x: Number(x), y: Number(y) };
};

describe("domScale", () => {
  it.each(CASES)("puts every box on whole device pixels of the page's grid at %o", (canvas) => {
    const scale = domScale(canvas.dpr, { ...canvas, height: 1 });
    // The root's corner lands on a device pixel, and every box in it is whole device pixels.
    const shift = parseShift(gridTransform(scale));
    const corner = (canvas.x + shift.x) * canvas.dpr;
    expect(Math.abs(corner - Math.round(corner))).toBeLessThan(1e-9);
    const panel = deviceRect(scale, { height: 285, width: 226, x: 67, y: 115 });
    for (const value of Object.values(panel)) {
      expect(Number.isInteger(value)).toBe(true);
    }
    // Boxes sharing an edge in game pixels share it on the grid: no gap and no overlap.
    const left = deviceRect(scale, { height: 44, width: 131, x: 17, y: 52 });
    const right = deviceRect(scale, { height: 44, width: 60, x: 148, y: 52 });
    expect(left.left + left.width).toBe(right.left);
    // The root spans the canvas to within a device pixel.
    expect(Math.abs(deviceX(scale, SCREEN_CONFIG.width) - canvas.width * canvas.dpr)).toBeLessThan(
      1,
    );
  });

  it.each(CASES)("draws font and art pixels in whole device pixels at %o", (canvas) => {
    const scale = domScale(canvas.dpr, { ...canvas, height: 1 });
    const unit = canvas.width / SCREEN_CONFIG.width;
    expect(fontPixel(scale, 2)).toBe(Math.max(1, Math.floor(2 * unit * canvas.dpr)));
    expect(artPixel(scale)).toBe(Math.max(1, Math.floor(unit * canvas.dpr)));
  });

  it("cuts every frame in whole art pixels: each slice inset times the art pixel, drawn pixelated", () => {
    const scale = domScale(3, { height: 1, width: 331.703125, x: 14.140625, y: 0 });
    expect(Object.fromEntries(sliceLengths(scale))).toEqual({
      "--adw-slice-1": "2px",
      "--adw-slice-2": "4px",
      "--adw-slice-3": "6px",
      "--adw-slice-4": "8px",
      "--adw-slice-5": "10px",
    });
    const slice = (n: number) => `var(--adw-slice-${n})`;
    const button = [3, 3, 5, 3].map(slice).join(" ");
    const panel = [4, 4, 4, 4].map(slice).join(" ");
    expect(UI_STYLE).toContain(`3 3 5 3 fill / ${button} stretch`);
    expect(UI_STYLE).toContain(`4 4 4 4 fill / ${panel} stretch`);
    expect(UI_STYLE.match(/border-image:[^}]*image-rendering:pixelated/g)).toHaveLength(2);
  });

  it("keeps an exact fit's pixels exact", () => {
    const scale = domScale(3, { height: 560, width: 360, x: 0, y: 0 });
    expect(fontPixel(scale, 2)).toBe(6);
    expect(artPixel(scale)).toBe(3);
    expect(deviceRect(scale, { height: 44, width: 296, x: 32, y: 52 })).toEqual({
      height: 132,
      left: 96,
      top: 156,
      width: 888,
    });
  });
});
