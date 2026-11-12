import { describe, expect, it } from "vitest";

import { artPixel, domScale, gridRect } from "../domScale.ts";
import { artBox, motionShift, scrollShift, sliceParts } from "./mirrorPlace.ts";
import { sheetFrameNamed } from "./sheetFrames.ts";

// The canvas at 1x and at 393 px across (a fractional fit), each at DPR 1, 2 and 3.
const SCALES = [1, 2, 3].flatMap((dpr) =>
  [360, 393].map(
    (width) =>
      [`${width} px at DPR ${dpr}`, domScale(dpr, { height: 0, width, x: 0.3, y: 0 })] as const,
  ),
);

describe("the display mirror's placement", () => {
  it.each(SCALES)(
    "puts every edge on the art-pixel grid, neighbours sharing theirs (%s)",
    (_, scale) => {
      const pixel = artPixel(scale);
      const left = gridRect(scale, { height: 9, width: 37, x: 12, y: 101 });
      const right = gridRect(scale, { height: 9, width: 1, x: 49, y: 101 });
      for (const value of [left.left, left.top, left.width, left.height, right.width]) {
        expect(value % pixel).toBe(0);
      }
      expect(left.left + left.width).toBe(right.left);
      expect(right.width).toBeGreaterThanOrEqual(pixel);
    },
  );

  it.each(SCALES)("sizes art in art pixels and moves it by whole art pixels (%s)", (_, scale) => {
    const pixel = artPixel(scale);
    expect(artBox(scale, { x: 20, y: 30 }, { height: 16, width: 32 })).toMatchObject({
      height: 16 * pixel,
      width: 32 * pixel,
    });
    expect(motionShift(scale, { x: -3, y: 2 })).toEqual({ x: -3 * pixel, y: 2 * pixel });
  });

  it.each(SCALES)("scrolls by whole device px, settling on whole art px (%s)", (_, scale) => {
    const moving = scrollShift(scale, -77.37, false);
    expect(Number.isInteger(moving)).toBe(true);
    expect(Math.abs(scrollShift(scale, -77.37, true) % artPixel(scale))).toBe(0);
  });

  it("cuts a nine-slice into whole-art-pixel corners and edges round a stretched middle", () => {
    const scale = domScale(2, { height: 0, width: 360, x: 0, y: 0 });
    const parts = sliceParts(
      scale,
      { height: 40, width: 100 },
      { height: 12, width: 12 },
      { bottom: 4, left: 4, right: 4, top: 4 },
    );
    expect(parts).toHaveLength(9);
    expect(parts[0]).toEqual({
      box: { height: 8, left: 0, top: 0, width: 8 },
      from: { height: 4, width: 4, x: 0, y: 0 },
    });
    expect(parts[4]).toEqual({
      box: { height: 24, left: 8, top: 8, width: 84 },
      from: { height: 4, width: 4, x: 4, y: 4 },
    });
    // A three-slice has no columns at its sides.
    expect(
      sliceParts(
        scale,
        { height: 40, width: 8 },
        { height: 9, width: 8 },
        { bottom: 3, left: 0, right: 0, top: 3 },
      ),
    ).toHaveLength(3);
  });

  it.each([
    ["by its name", "tile 2.aseprite", 40],
    ["by its index", 1, 20],
    ["by its index's digits", "1", 20],
    ["first, where the sheet has no such frame", "__BASE", 0],
  ] as const)("finds a sheet's frame %s", (_, name, x) => {
    const json = {
      frames: Object.fromEntries(
        [0, 1, 2].map((i) => [`tile ${i}.aseprite`, { frame: { h: 20, w: 20, x: i * 20, y: 0 } }]),
      ),
      meta: { size: { h: 20, w: 60 } },
    };
    expect(sheetFrameNamed(json, name)).toMatchObject({ sheet: { height: 20, width: 60 }, x });
  });
});
