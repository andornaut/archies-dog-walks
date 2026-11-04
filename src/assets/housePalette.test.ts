import { describe, expect, it } from "vitest";

import { ONE_STEP_DARKER, PALETTE_COLOURS, paletteColour } from "./housePalette";

describe("the house ramp", () => {
  it("defines a path from every palette colour to ink without another cycle", () => {
    const ink = paletteColour("ink");
    const palette = new Set(PALETTE_COLOURS.values());
    for (const start of palette) {
      const visited = new Set<number>();
      let colour: number | undefined = start;
      while (colour !== ink && colour !== undefined && !visited.has(colour)) {
        expect(palette.has(colour)).toBe(true);
        visited.add(colour);
        colour = ONE_STEP_DARKER.get(colour);
      }
      expect(colour).toBe(ink);
    }
    expect(ONE_STEP_DARKER.get(ink)).toBe(ink);
  });
});
