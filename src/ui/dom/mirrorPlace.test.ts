import { describe, expect, it } from "vitest";

import { artPixel, domScale, gridRect, gridX } from "../domScale.ts";
import {
  artBox,
  graphicsFills,
  motionShift,
  scaledArtBox,
  scrollShift,
  sliceParts,
  tileBackground,
} from "./mirrorPlace.ts";
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

  it.each(SCALES)(
    "keeps an evenly scaled picture's art pixels whole and stretches a lone axis on the grid (%s)",
    (_, scale) => {
      const pixel = artPixel(scale);
      const at = { x: 20, y: 30 };
      expect(scaledArtBox(scale, at, { height: 9, width: 10 }, { x: 2, y: 2 })).toMatchObject({
        height: 18 * pixel,
        width: 20 * pixel,
      });
      expect(scaledArtBox(scale, at, { height: 32, width: 32 }, { x: 0.5, y: 0.5 })).toMatchObject({
        height: 16 * pixel,
        width: 16 * pixel,
      });
      // A well's middle column stretched 40 across meets its right column, 53 across.
      const middle = scaledArtBox(
        scale,
        { x: 13, y: 4 },
        { height: 14, width: 1 },
        { x: 40, y: 1 },
      );
      expect(middle.left + middle.width).toBe(gridX(scale, 53));
      expect(middle.height).toBe(14 * pixel);
    },
  );

  it.each(SCALES)("tiles a texture in whole art pixels from its corner (%s)", (_, scale) => {
    const pixel = artPixel(scale);
    expect(tileBackground(scale, { height: 16, width: 24 }, { x: 0, y: 0 })).toEqual({
      position: "0px 0px",
      size: `${24 * pixel}px ${16 * pixel}px`,
    });
    expect(tileBackground(scale, { height: 16, width: 24 }, { x: 26, y: -3 }).position).toBe(
      `${-2 * pixel}px ${-13 * pixel}px`,
    );
  });

  // Phaser's commands: 6 a line style, 7 a fill style (colour, alpha), 3 a rect, 10 a triangle.
  it.each([
    ["a fill at full alpha", [6, 1, 0, 1, 7, 0xff0000, 1, 3, 1, 2, 3, 4], [{ alpha: 1 }]],
    ["a fill at partial alpha", [7, 0x00ff00, 0.6, 3, 1, 2, 3, 4], [{ alpha: 0.6 }]],
    ["no fill at alpha 0", [7, 0x00ff00, 0, 3, 1, 2, 3, 4], []],
    ["no fills for a triangle", [7, 0x00ff00, 1, 10, 0, 0, 1, 1, 0, 1], undefined],
  ] as const)("reads a graphics' commands: %s", (_, commands, fills) => {
    const read = graphicsFills(commands, { x: 10, y: 20 });
    if (fills === undefined) {
      expect(read).toBeUndefined();
      return;
    }
    expect(read).toEqual(
      fills.map(({ alpha }) => ({
        alpha,
        colour: commands[commands.indexOf(7) + 1],
        rect: { height: 4, width: 3, x: 11, y: 22 },
      })),
    );
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
