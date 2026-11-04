import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ONE_STEP_DARKER, PALETTE_COLOURS, paletteColour } from "./housePalette.ts";

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

describe("shared/palette.json", () => {
  it("is what art's tool prints", () => {
    const tool = spawnSync(process.execPath, ["art/tools/pixel.ts", "palette"], {
      encoding: "utf8",
    });
    expect(tool.status, tool.stderr).toBe(0);
    expect(tool.stdout).toBe(readFileSync("shared/palette.json", "utf8"));
  });
});
