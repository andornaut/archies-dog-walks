import { buildAtlasPages } from "@andornaut/art-kit/atlasBuild";
import { blankImage } from "@andornaut/art-kit/rgbaImage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetManifest } from "../../assets/manifest";
import { sheetFromRows } from "../../testing/sheetImage";
import { buildAtlases, compactFrames } from "./atlasBuild";
import { layoutAtlases } from "./atlasLayout";

vi.mock("@andornaut/art-kit/atlasBuild", () => ({ buildAtlasPages: vi.fn() }));
vi.mock("./atlasLayout", async (original) => ({
  ...(await original<typeof import("./atlasLayout")>()),
  layoutAtlases: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(buildAtlasPages).mockReset();
  vi.mocked(layoutAtlases).mockReset();
});

it("maps Archie source policy, blits, output names and metadata through the shared builder", async () => {
  const image = blankImage(2, 2);
  image.data.set([255, 80, 20, 255]);
  const manifest: AssetManifest = {
    fonts: [],
    images: [{ key: "face-dog-test", png: "images/face-dog-test.png" }],
    sounds: [],
    sprites: [],
  };
  const from = { height: 2, width: 2, x: 0, y: 0 };
  const layout = {
    pages: [
      {
        blits: [{ at: { x: 1, y: 1 }, bounds: from, from, png: manifest.images[0]!.png }],
        group: "ui" as const,
        height: 4,
        name: "atlas/ui-0",
        width: 256,
      },
    ],
    skipped: [],
    textures: [{ frames: [], key: "face-dog-test", page: 0 }],
  };
  vi.mocked(layoutAtlases).mockReturnValue(layout);
  vi.mocked(buildAtlasPages).mockImplementation(async (_, pages) =>
    pages.map(({ metadata }) => ({
      bytes: new Uint8Array([7, 8, 9]),
      image: blankImage(1, 1),
      metadata,
    })),
  );
  const read = vi.fn();
  const encode = vi.fn();
  const build = await buildAtlases(read, {
    decoded: new Map([[manifest.images[0]!.png, image]]),
    manifest,
    pages: { encode, extension: "webp" },
  });
  expect(read).not.toHaveBeenCalled();
  expect(vi.mocked(layoutAtlases).mock.calls[0]?.[0].map(({ key }) => key)).toEqual([
    "face-dog-test",
    "face-dog-test-disabled",
  ]);
  const [dependencies, pages] = vi.mocked(buildAtlasPages).mock.calls[0]!;
  expect(dependencies.extrude).toBe(1);
  expect(dependencies.encode).toBe(encode);
  expect(dependencies.read).toBe(read);
  expect(dependencies.decoded?.has("images/face-dog-test.png#disabled")).toBe(true);
  expect(pages[0]?.blits).toEqual([
    {
      at: { x: 1, y: 1 },
      bounds: from,
      from,
      source: manifest.images[0]!.png,
    },
  ]);
  expect(build.files.get("atlas/ui-0.webp")).toEqual(new Uint8Array([7, 8, 9]));
  expect(build.manifest).toEqual({
    pages: [{ bytes: 3, file: "atlas/ui-0.webp", group: "ui", height: 4, width: 256 }],
    textures: layout.textures,
  });
});

it("keeps source-read and oversized-asset warnings as game policy", async () => {
  vi.mocked(layoutAtlases).mockReturnValue({ pages: [], skipped: ["too-big"], textures: [] });
  vi.mocked(buildAtlasPages).mockResolvedValue([]);
  const manifest: AssetManifest = {
    fonts: [],
    images: [{ key: "missing", png: "missing.png" }],
    sounds: [],
    sprites: [],
  };
  const build = await buildAtlases(
    async () => {
      throw new Error("unreadable");
    },
    { manifest },
  );
  expect(build.warnings).toEqual([
    "missing is left out of the atlas: Error: unreadable",
    "too-big has a frame too large for an atlas page",
  ]);
});

describe("compactFrames", () => {
  // 6x5 frames: two pixels in the middle, the same two a column to the right, the same two at
  // the right edge, where the extruded border repeats them, and a clear frame.
  const middle = ["......", "..ab..", "..cd..", "......", "......"];
  const shifted = ["......", "...ab.", "...cd.", "......", "......"];
  const edge = ["......", "....ab", "....cd", "......", "......"];
  const clear = ["......", "......", "......", "......", "......"];
  type Rect4 = [x: number, y: number, width: number, height: number];
  const rect = ([x, y, width, height]: Rect4) => ({ height, width, x, y });
  const whole = (frame: number): Rect4 => [frame * 6, 0, 6, 5];

  // Each frame's packed from rect, the bounds its border is read in, and its trim as
  // [x, y, whole width, whole height].
  it("keeps, trims and shares frames, each with its own bounds and offset", () => {
    const cases: {
      expected: { bounds?: Rect4; from: Rect4; trim?: Rect4 }[];
      frames: string[][];
      name: string;
      trim: boolean;
    }[] = [
      {
        expected: [{ from: whole(0) }],
        frames: [middle],
        name: "keeps a frame whole without trim",
        trim: false,
      },
      {
        expected: [{ bounds: whole(0), from: [2, 1, 2, 2], trim: [2, 1, 6, 5] }],
        frames: [middle],
        name: "trims a frame to its opaque pixels, recording where they sit",
        trim: true,
      },
      {
        expected: [{ bounds: whole(0), from: [0, 0, 1, 1], trim: [0, 0, 6, 5] }],
        frames: [clear],
        name: "trims a clear frame to its top-left pixel",
        trim: true,
      },
      {
        expected: [
          { bounds: whole(0), from: [2, 1, 2, 2], trim: [2, 1, 6, 5] },
          { bounds: whole(0), from: [2, 1, 2, 2], trim: [3, 1, 6, 5] },
        ],
        frames: [middle, shifted],
        name: "shares one rect between trimmed frames with the same pixels, each at its own offset",
        trim: true,
      },
      {
        expected: [
          { bounds: whole(0), from: [2, 1, 2, 2], trim: [2, 1, 6, 5] },
          { bounds: whole(1), from: [10, 1, 2, 2], trim: [4, 1, 6, 5] },
        ],
        frames: [middle, edge],
        name: "keeps apart frames whose extruded borders differ",
        trim: true,
      },
      {
        expected: [{ from: whole(0) }, { from: whole(0) }],
        frames: [middle, middle],
        name: "shares one rect between whole frames with the same pixels",
        trim: false,
      },
    ];
    for (const { expected, frames, trim } of cases) {
      const { image, texture } = sheetFromRows("dog-kilo", frames);
      const compacted = compactFrames(image, trim, texture).frames.map(
        ({ bounds, from, trim: offset }) => ({ bounds, from, trim: offset }),
      );
      expect(compacted).toEqual(
        expected.map(({ bounds, from, trim: offset }) => ({
          bounds: bounds === undefined ? undefined : rect(bounds),
          from: rect(from),
          trim:
            offset === undefined
              ? undefined
              : { h: offset[3], w: offset[2], x: offset[0], y: offset[1] },
        })),
      );
    }
  });
});
