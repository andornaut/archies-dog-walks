import { describe, expect, it } from "vitest";

import { type Box, type LanedBox, type PackBoxes, sweptHitDog } from "./collision.ts";

const box = (left: number, top: number): LanedBox => ({
  bottom: top + 4,
  lanes: { left: -100, right: 100 },
  left,
  right: left + 4,
  scale: 1,
  top,
});
const pack = (left = 8): PackBoxes<"dog"> => {
  const body: Box = { bottom: 12, left, right: left + 4, top: 8 };
  return {
    centreX: 0,
    dogs: [{ ...body, dog: "dog", scale: 1 }],
    outline: body,
    walker: { bottom: 24, left, right: left + 4, scale: 1, top: 20 },
  };
};

describe("swept component contact", () => {
  const clipped = { ...box(8, 8), lanes: { left: 20, right: 24 } };
  it.each([
    {
      from: box(0, 8),
      hit: "dog",
      name: "crossing the pack entirely between steps",
      to: box(20, 8),
    },
    {
      from: box(0, -12),
      hit: null,
      name: "on a diagonal whose bounding rectangle, not its path, meets the pack",
      to: box(20, 8),
    },
    { from: box(0, 8), hit: null, name: "staying in the gap before the pack", to: box(0, 8) },
    { from: box(20, 8), hit: null, name: "staying in the gap past the pack", to: box(20, 8) },
    {
      from: box(0, 8),
      hit: null,
      moved: 28,
      name: "moving with the pack, by relative movement",
      to: box(20, 8),
    },
    { from: box(4, 8), hit: null, name: "meeting the pack only at an edge", to: box(4, 8) },
    { from: clipped, hit: null, name: "clipped out of the pack's lane", to: clipped },
  ])("hits $hit for a component $name", ({ from, hit, moved, to }) => {
    expect(sweptHitDog(pack(), pack(moved), from, to)).toBe(hit);
  });
});
