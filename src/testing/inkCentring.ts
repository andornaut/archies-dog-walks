import { expect } from "vitest";

// A backed label's ink centre (centredInkOffsets): across, within half an art pixel of the
// backing's middle; down, on it or above it by less than an art pixel, any odd row under the ink.
export function expectInkCentredAcross(centre: number, middle: number, artPixel: number): void {
  expect(Math.abs(centre - middle)).toBeLessThanOrEqual(artPixel / 2 + 1e-6);
}

export function expectInkCentredDown(centre: number, middle: number, artPixel: number): void {
  expect(centre - middle).toBeLessThanOrEqual(1e-6);
  expect(middle - centre).toBeLessThan(artPixel);
}
