import { describe, expect, it } from "vitest";

import { type AtlasManifest, packAtlasManifest, unpackAtlasManifest } from "./atlasManifest.ts";

const atlas: AtlasManifest = {
  pages: [{ file: "atlas/page.webp", group: "linear", height: 32, width: 32 }],
  textures: [
    {
      frames: [
        { h: 8, name: "dog 0.aseprite", w: 8, x: 1, y: 1 },
        { duration: 0, h: 8, name: "dog 1.aseprite", w: 8, x: 10, y: 1 },
        {
          duration: 120,
          h: 5,
          name: 'custom "frame".aseprite',
          trim: { h: 8, w: 8, x: 1, y: 2 },
          w: 4,
          x: 1,
          y: 10,
        },
        { h: 8, name: "dog 03.aseprite", w: 8, x: 10, y: 10 },
      ],
      key: "dog",
      page: 0,
      tags: [{ direction: "pingpong", from: 0, name: "walk", to: 3 }],
    },
    { frames: [{ h: 1, name: "__BASE", w: 1, x: 0, y: 0 }], key: "image", page: 0 },
  ],
};

it("round-trips all frame metadata while inferring only exact generated names", () => {
  const packed = packAtlasManifest(atlas);
  expect(packed.textures[0]![2][0]).toEqual([1, 1, 8, 8]);
  expect(packed.textures[0]![2][1]).toEqual([10, 1, 8, 8, 0]);
  expect(unpackAtlasManifest(JSON.parse(JSON.stringify(packed)))).toEqual(atlas);
});

describe("packed metadata validation", () => {
  it.each([
    [0, [0, 0, 0, 1]],
    [0, [-1, 0, 1, 1]],
    [0, [0, 0, 1, 1, "100"]],
    [0, [0, 0, 1, 1, null, [1, 1, -1, 0]]],
    [-1, [0, 0, 1, 1]],
  ])("rejects invalid page %s or frame %j", (page, frame) => {
    expect(() =>
      unpackAtlasManifest({ pages: atlas.pages, textures: [["dog", page, [frame]]] }),
    ).toThrow();
  });
});
