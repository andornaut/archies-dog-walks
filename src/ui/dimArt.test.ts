import { expect, it } from "vitest";

import { dimColour, dimForModal, MODAL_BRIGHTNESS, MODAL_DARKNESS } from "./dimArt.ts";

it("uses the approved black darkness without palette substitution", () => {
  expect(MODAL_DARKNESS).toBe(0.72);
  expect(MODAL_BRIGHTNESS).toBe(0.28);
  expect(dimColour(0xffffff)).toBe(0x474747);
  expect(dimColour(0xff8000)).toBe(0x472400);
});

it("preserves alpha and distinct original colour channels in retained generated copies", () => {
  const pixels = new Uint8ClampedArray([255, 128, 0, 0, 20, 100, 200, 123]);
  dimForModal(pixels);
  expect([...pixels]).toEqual([71, 36, 0, 0, 6, 28, 56, 123]);
});
