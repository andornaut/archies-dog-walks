import { remapRgb } from "@andornaut/game-kit/rgba";
import { describe, expect, it, vi } from "vitest";

import { greyFor, remapToGrey } from "./greyRamp.ts";

vi.mock("@andornaut/game-kit/rgba", () => ({ remapRgb: vi.fn() }));

const RAMP = [0xffffff, 0xd8d8d8, 0xa4a4a4, 0x727272, 0x4a4a4a, 0x181425];

describe("greyFor", () => {
  // A grey of the ramp stays, or steps down it and stops at its darkest; light colours go to
  // light greys and dark ones to dark greys.
  it("keeps or steps a ramp grey down to its darkest, and maps other colours by lightness", () => {
    const cases: [number, number, number | undefined][] = [
      [0, 0xa4a4a4, 0xa4a4a4],
      [1, 0xa4a4a4, 0x727272],
      [1, 0x181425, 0x181425],
      [0, 0xead4aa, 0xd8d8d8],
      [0, 0x733e39, 0x4a4a4a],
      [1, 0xead4aa, 0xa4a4a4],
    ];
    const wrong = cases.filter(([steps, colour, grey]) => greyFor(RAMP, steps, colour) !== grey);
    expect(wrong).toEqual([]);
  });
});

describe("remapToGrey", () => {
  it("supplies the game grey mapping and original pixel buffer to the kit", () => {
    const pixels = new Uint8ClampedArray([0xea, 0xd4, 0xaa, 0x80]);
    remapToGrey(RAMP, 1, pixels);
    const [mapping, supplied] = vi.mocked(remapRgb).mock.calls[0] ?? [];
    expect(supplied).toBe(pixels);
    expect(mapping?.(0xead4aa)).toBe(greyFor(RAMP, 1, 0xead4aa));
  });
});
