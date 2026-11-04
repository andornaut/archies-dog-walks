import { describe, expect, it } from "vitest";

import { gridRects, rectIndexAt } from "./grid.ts";

const spec = { cellHeight: 50, cellWidth: 112, columns: 3, gapX: 4, gapY: 4 };

describe("gridRects", () => {
  it("fills rows left to right, then the next row down, every cell the same size", () => {
    const rects = gridRects(spec, 4, { x: 8, y: 212 });
    expect(rects.map(({ height, width, x, y }) => [x, y, width, height])).toEqual([
      [8, 212, 112, 50],
      [124, 212, 112, 50],
      [240, 212, 112, 50],
      [8, 266, 112, 50],
    ]);
  });
});

describe("rectIndexAt", () => {
  const rects = gridRects(spec, 9, { x: 8, y: 212 });

  it("finds the cell under a point, and none in a gap or outside the grid", () => {
    for (const [, x, y, expected] of [
      ["a cell", 130, 270, 4],
      ["the gap between cells", 121, 220, undefined],
      ["outside the grid", 4, 220, undefined],
    ] as const) {
      expect(rectIndexAt(rects, x, y)).toBe(expected);
    }
  });
});
