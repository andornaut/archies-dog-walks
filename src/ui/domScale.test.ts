import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { UI_STYLE } from "./dom/uiStyle.ts";
import {
  artPixel,
  deviceRect,
  deviceX,
  domScale,
  fontPixel,
  frameRect,
  gridTransform,
  gridX,
  gridY,
  scrollbarBoxes,
  sliceLengths,
} from "./domScale.ts";
import { scrollbarRects } from "./scrollbar.ts";

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
      "--adw-slice-8": "16px",
    });
    const slice = (n: number) => `var(--adw-slice-${n})`;
    const button = [3, 3, 5, 3].map(slice).join(" ");
    const panel = [4, 4, 4, 4].map(slice).join(" ");
    expect(UI_STYLE).toContain(`3 3 5 3 fill / ${button} stretch`);
    expect(UI_STYLE).toContain(`4 4 4 4 fill / ${panel} stretch`);
    const card = [8, 8, 8, 8].map(slice).join(" ");
    expect(UI_STYLE).toContain(`8 8 8 8 fill / ${card} stretch`);
    // The scrollbar's track and thumb: their end caps whole, no side slices.
    const caps = [3, 0, 3, 0].map((n) => (n === 0 ? "0" : slice(n))).join(" ");
    expect(UI_STYLE.split(`3 0 3 0 fill / ${caps} stretch`)).toHaveLength(3);
    expect(UI_STYLE.match(/border-image:[^}]*image-rendering:pixelated/g)).toHaveLength(5);
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

describe("frameRect", () => {
  const rect = { height: 285, width: 226, x: 67, y: 115 };

  it.each(CASES)(
    "makes a frame whole art pixels from its corner on the art grid at %o",
    (canvas) => {
      const scale = domScale(canvas.dpr, { ...canvas, height: 1 });
      const box = deviceRect(scale, rect);
      const frame = frameRect(scale, rect);
      const pixel = artPixel(scale);
      expect([frame.left, frame.top]).toEqual([gridX(scale, rect.x), gridY(scale, rect.y)]);
      expect([frame.left % pixel, frame.top % pixel]).toEqual([0, 0]);
      for (const [length, device] of [
        [frame.width, box.width],
        [frame.height, box.height],
      ] as const) {
        expect(length % pixel).toBe(0);
        expect(Math.abs(length - device)).toBeLessThanOrEqual(pixel / 2);
      }
    },
  );

  it.each([1, 2, 3])("leaves a frame as deviceRect gives it at a fit of 1, DPR %d", (dpr) => {
    const scale = domScale(dpr, { height: 560, width: 360, x: 0, y: 0 });
    expect(frameRect(scale, rect)).toEqual(deviceRect(scale, rect));
  });
});

describe("a scrollbar in HTML", () => {
  // The Logbook's: an 8px track with a 6px thumb a pixel in, beside a 440px view.
  const spec = { thumbInset: 1, thumbMin: 16, thumbWidth: 6, trackWidth: 8, x: 336 };
  const view = { height: 440, y: 100 };
  const max = 2890;
  const boxesAt = (scale: ReturnType<typeof domScale>, y: number) => {
    const bar = scrollbarRects(spec, view, max, y);
    if (bar === null) {
      throw new Error("the list fits");
    }
    return scrollbarBoxes(scale, { left: 0, top: 0 }, bar);
  };

  it.each([1, 2, 3].flatMap((dpr) => [360, 393].map((width) => [width, dpr])))(
    "keeps its track and thumb whole art pixels, the thumb centred and one length, %d px wide at DPR %d",
    (width, dpr) => {
      const scale = domScale(dpr, { height: (width * 560) / 360, width, x: 0, y: 0 });
      const pixel = artPixel(scale);
      const ys = Array.from({ length: 41 }, (_, i) => (i * max) / 40 + (i % 3) * 0.37);
      const all = ys.map((y) => boxesAt(scale, y));
      const lengths = new Set(all.map(({ thumb }) => thumb.height));
      expect(lengths.size).toBe(1);
      for (const { thumb, track } of all) {
        expect(track.width).toBe(spec.trackWidth * pixel);
        expect(thumb.left - track.left).toBe(track.left + track.width - thumb.left - thumb.width);
        expect([thumb.top, thumb.height, track.height].every((n) => n % pixel === 0)).toBe(true);
      }
      // At each end of its travel the thumb is as far in as from the sides.
      const [first, last] = [all[0], all.at(-1)];
      expect(first?.thumb.top).toBe(spec.thumbInset * pixel);
      expect((last?.track.height ?? 0) - (last?.thumb.top ?? 0) - (last?.thumb.height ?? 0)).toBe(
        spec.thumbInset * pixel,
      );
    },
  );
});
