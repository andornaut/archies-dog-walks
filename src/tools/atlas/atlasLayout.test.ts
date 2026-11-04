import { type AtlasItem, type AtlasPolicy, packAtlas } from "@andornaut/art-kit/atlasLayout";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOADING_ART } from "../../assets/spriteKeys.ts";
import {
  ATLAS_MAX_SIZE,
  EXTRUDE,
  imageSource,
  layoutAtlases,
  type SourceTexture,
  spriteSource,
} from "./atlasLayout.ts";

vi.mock("@andornaut/art-kit/atlasLayout", () => ({
  packAtlas: vi.fn((policy: AtlasPolicy<unknown>, items: readonly AtlasItem<unknown>[]) => ({
    pages:
      items.length === 0
        ? []
        : [
            {
              height: 1024,
              placed: items.map((item, index) => ({
                at: item.rectangles.map((_, frame) => ({
                  x: 1 + index * 10 + frame,
                  y: 1 + frame,
                })),
                item,
              })),
              width: policy.maxSize,
            },
          ],
    width: policy.maxSize,
  })),
}));

beforeEach(() => {
  vi.mocked(packAtlas).mockClear();
});

function sprite(key: string, count: number, width: number, height: number): SourceTexture {
  const frames = Array.from({ length: count }, (_, i) => ({
    duration: 100,
    from: { height, width, x: i * width, y: 0 },
    name: `${key} ${i}`,
  }));
  return { frames, key, png: `sprites/${key}.png`, tags: [] };
}

describe("spriteSource", () => {
  const frame = (x: number, duration: number) => ({
    duration,
    frame: { h: 32, w: 32, x, y: 0 },
    rotated: false,
    trimmed: false,
  });
  const tags = [{ direction: "forward", from: 0, name: "walk", to: 1 }];

  it("reads each frame's rect and duration in export order, and the tags", () => {
    const json = {
      // Built from entries: a literal's keys would have to be sorted.
      frames: Object.fromEntries([
        ["b 1", frame(32, 120)],
        ["a 0", frame(0, 80)],
      ]),
      meta: { frameTags: tags },
    };
    expect(spriteSource("dog-kilo", "sprites/dog-kilo.png", json)).toEqual({
      frames: [
        { duration: 120, from: { height: 32, width: 32, x: 32, y: 0 }, name: "b 1" },
        { duration: 80, from: { height: 32, width: 32, x: 0, y: 0 }, name: "a 0" },
      ],
      key: "dog-kilo",
      png: "sprites/dog-kilo.png",
      tags,
    });
  });

  it("rejects a trimmed frame and the array export", () => {
    const cases = [
      {
        error: 'dog-kilo frame "a 0" is rotated or trimmed',
        json: { frames: { "a 0": { ...frame(0, 80), trimmed: true } }, meta: {} },
        name: "a frame the export trimmed, whose offset the packer does not read",
      },
      {
        error: 'dog-kilo sheet.frames must be an object: export with the "hash" JSON format',
        json: { frames: [], meta: {} },
        name: "the array export",
      },
    ];
    for (const { error, json, name } of cases) {
      expect(() => spriteSource("dog-kilo", "dog-kilo.png", json), name).toThrow(error);
    }
  });
});

describe("layoutAtlases", () => {
  const textures = [
    imageSource("images/screen-home.png", 360, 640, "screen-home"),
    imageSource("images/card-skip.png", 120, 90, "card-skip"),
    sprite("dog-kilo", 6, 32, 32),
    sprite("ui-loading", 4, 32, 32),
    sprite("fx-confetti", 10, 64, 64),
    sprite("newspaper-box", 2, 32, 32),
    sprite("newspaper-box@50", 2, 16, 16),
    sprite("fx-hit-skunk", 2, 32, 32),
  ];

  it("maps every frame of every texture, keeping names, sizes and durations, blitted from its source rect", () => {
    const { pages, textures: mapped } = layoutAtlases(textures);
    expect(mapped.map(({ key }) => key).sort()).toEqual(textures.map(({ key }) => key).sort());
    for (const source of textures) {
      const texture = mapped.find(({ key }) => key === source.key);
      expect(texture?.frames.map(({ duration, h, name, w }) => ({ duration, h, name, w }))).toEqual(
        source.frames.map(({ duration, from, name }) => ({
          duration,
          h: from.height,
          name,
          w: from.width,
        })),
      );
      expect(texture?.tags).toEqual(source.tags);
      texture?.frames.forEach(({ x, y }, i) => {
        const from = source.frames[i]?.from;
        expect(pages[texture.page]?.blits).toContainEqual({
          at: { x, y },
          bounds: from,
          from,
          png: source.png,
        });
      });
    }
  });

  it("orders pages boot, ui, home, run, road, each named for its group", () => {
    expect(layoutAtlases(textures).pages.map(({ group, name }) => [group, name])).toEqual([
      ["boot", "atlas/boot-0"],
      ["ui", "atlas/ui-0"],
      ["home", "atlas/home-0"],
      ["run", "atlas/run-0"],
      ["road", "atlas/road-0"],
    ]);
  });

  it("packs frames with the same from rect once, each keeping its own trim", () => {
    const from = { height: 20, width: 10, x: 4, y: 6 };
    const bounds = { height: 32, width: 32, x: 0, y: 0 };
    const frames = [
      { bounds, from, name: "a", trim: { h: 32, w: 32, x: 4, y: 6 } },
      { bounds, from, name: "b", trim: { h: 32, w: 32, x: 9, y: 2 } },
      { from: { height: 32, width: 32, x: 32, y: 0 }, name: "c" },
    ];
    const layout = layoutAtlases([{ frames, key: "dog-kilo", png: "sprites/dog-kilo.png" }]);
    const mapped = layout.textures[0]?.frames ?? [];
    expect(mapped.map(({ trim }) => trim)).toEqual(frames.map(({ trim }) => trim));
    expect([mapped[1]?.x, mapped[1]?.y]).toEqual([mapped[0]?.x, mapped[0]?.y]);
    expect(layout.pages[0]?.blits.map(({ bounds: read, from: copied }) => [read, copied])).toEqual([
      [bounds, from],
      [frames[2]?.from, frames[2]?.from],
    ]);
  });

  it("leaves out a texture with a frame larger than a page", () => {
    const huge = imageSource("images/huge.png", ATLAS_MAX_SIZE, 10, "huge");
    const layout = layoutAtlases([huge, ...textures]);
    expect(layout.skipped).toEqual(["huge"]);
    expect(layout.textures.map(({ key }) => key)).not.toContain("huge");
  });
  it("passes one atomic item per texture and the game's page-width and sorting policy", () => {
    const source = sprite("dog-test", 2, 20, 30);
    layoutAtlases([source], 128);
    const call = vi.mocked(packAtlas).mock.calls.find(([, items]) => items.length > 0)!;
    const [policy, items] = call;
    expect(policy).toMatchObject({ extrude: EXTRUDE, maxSize: 128, widths: [128] });
    expect(items).toHaveLength(1);
    expect(items[0]?.rectangles).toEqual(source.frames.map(({ from }) => from));
    const taller = { rectangles: [], value: { texture: sprite("z", 1, 20, 40) } };
    const shorter = { rectangles: [], value: { texture: source } };
    expect(policy.compare(taller, shorter)).toBeLessThan(0);
  });

  it("preserves the whole-group skip policy when the shared packer reports no fit", () => {
    vi.mocked(packAtlas).mockReturnValueOnce(undefined);
    const source = imageSource("images/loading.png", 20, 20, Object.values(LOADING_ART)[0]!);
    const layout = layoutAtlases([source]);
    expect(layout.skipped).toEqual([source.key]);
    expect(layout.pages).toEqual([]);
  });
});
