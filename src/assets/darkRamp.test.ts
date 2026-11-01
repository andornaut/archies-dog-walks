import { rampDown } from "@andornaut/game-kit/rgba";
import { describe, expect, it, vi } from "vitest";

import { darkerRamp } from "./darkRamp";
import { ONE_STEP_DARKER, PALETTE_COLOURS, paletteColour } from "./housePalette";

vi.mock("@andornaut/game-kit/rgba", () => ({ rampDown: vi.fn() }));

describe("darkerRamp", () => {
  it("passes the house ramp and requested step count to the kit", () => {
    const mapping = () => 0;
    vi.mocked(rampDown).mockReturnValueOnce(mapping);
    expect(darkerRamp(2)).toBe(mapping);
    expect(rampDown).toHaveBeenCalledWith(ONE_STEP_DARKER, 2);
  });
});

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
