import { expect, it } from "vitest";

import { riderCuePosition } from "./riderCuePosition";

it("keeps a pre-entry or clipped rider cue visibly anchored in its actual lane", () => {
  const lane = { x: 43.4, y: 70 };
  expect(riderCuePosition(80, lane, undefined)).toEqual({ x: 43, y: 80 });
  expect(riderCuePosition(80, lane, { x: -1000, y: 79 })).toEqual({ x: 43, y: 80 });
  expect(riderCuePosition(80, lane, { x: 55.7, y: 83.6 })).toEqual({ x: 56, y: 84 });
});
