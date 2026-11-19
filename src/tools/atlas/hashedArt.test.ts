import { blankImage } from "@andornaut/art-kit/build/rgbaImage";
import { contentHash } from "@andornaut/game-kit/build/contentHash";
import { beforeAll, describe, expect, it } from "vitest";

import { ATLAS_MANIFEST_PATH, type AtlasManifest } from "../../assets/atlasManifest.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { ART_MANIFEST } from "../artManifest.ts";
import { encodePng } from "./atlasBuild.ts";
import {
  artFilesJson,
  type DomArtKeys,
  type HashedArtFile,
  hashedArtFileName,
  hashGameArt,
} from "./hashedArt.ts";

describe("hashedArtFileName", () => {
  it.each([
    ["sprites/dog-kilo@88.json", "assets/art/sprites/dog-kilo@88-Bq3x_9-Z.json"],
    ["manifest.json", "assets/art/manifest-Bq3x_9-Z.json"],
  ])("names %s %s", (path, fileName) => {
    expect(hashedArtFileName(path, "Bq3x_9-Z")).toBe(fileName);
  });
});

it("maps each art path, sorted, to its hashed file's URL for the art gallery", () => {
  const artFiles = new Map([
    ["sprites/dog.png", "assets/art/sprites/dog-Bq3x_9-Z.png"],
    ["manifest.json", "assets/art/manifest-Cx2.json"],
  ]);
  expect(artFilesJson("/", artFiles)).toBe(
    '{"manifest.json":"/assets/art/manifest-Cx2.json",' +
      '"sprites/dog.png":"/assets/art/sprites/dog-Bq3x_9-Z.png"}',
  );
});

const manifest: AssetManifest = {
  fonts: [
    { fnt: "fonts/packed.fnt", key: "packed-font", png: "fonts/packed.png" },
    { fnt: "fonts/own.fnt", key: "own-font", png: "fonts/own.png", woff: "fonts/own.woff" },
  ],
  images: [
    { key: "packed-image", png: "images/packed.png" },
    { key: "own-image", png: "images/own.png" },
    { key: "shared-image", png: "sprites/shared.png" },
    { key: "ui-panel", png: "images/ui-panel.png" },
  ],
  sounds: [{ key: "sound", m4a: "sounds/sound.m4a", ogg: "sounds/sound.ogg" }],
  sprites: [
    { json: "sprites/packed.json", key: "packed-sprite", png: "sprites/packed.png" },
    { json: "sprites/own.json", key: "own-sprite", png: "sprites/shared.png" },
  ],
};
const atlas: AtlasManifest = {
  pages: [{ file: "atlas/ui-0.webp", group: "ui", height: 4, width: 4 }],
  textures: ["packed-font", "packed-image", "packed-sprite", "ui-panel"].map((key) => ({
    frames: [{ h: 1, name: "0", w: 1, x: 1, y: 1 }],
    key,
    page: 0,
  })),
};
const page = new Uint8Array([7, 8, 9]);
const panel = encodePng(blankImage(2, 2));
const readArt = async (path: string) =>
  path === "images/ui-panel.png"
    ? panel
    : new TextEncoder().encode(
        path.endsWith(".json") ? JSON.stringify({ source: path }, null, 2) : `source:${path}`,
      );
const none = new Set<string>();
const dom: DomArtKeys = {
  disabled: none,
  grey: none,
  sheets: new Map([["ui-panel", "dom-chrome"]]),
};

// Packed and unpacked entries exercise each asset category; the shared PNG must emit once, the
// HTML interface's art emits as its DOM sheet, and the web fonts emit as files of their own.
describe("hashed game art", () => {
  let files: HashedArtFile[];
  beforeAll(async () => {
    files = await hashGameArt(readArt, dom, manifest, {
      files: new Map([["atlas/ui-0.webp", page]]),
      manifest: atlas,
    });
  });

  it("emits every required path once in sorted order without packed own files", () => {
    expect(files.map(({ path }) => path)).toEqual([
      "atlas-manifest.json",
      "atlas/ui-0.webp",
      "dom/dom-chrome.json",
      "dom/dom-chrome.webp",
      "fonts/own.fnt",
      "fonts/own.png",
      "fonts/own.woff",
      "fonts/packed.fnt",
      "images/own.png",
      "manifest.json",
      "sounds/sound.m4a",
      "sounds/sound.ogg",
      "sprites/own.json",
      "sprites/shared.png",
    ]);
  });

  it("hashes compact metadata and preserves every non-JSON asset byte", async () => {
    await Promise.all(
      files
        .filter(({ path }) => !path.startsWith("dom/"))
        .map(async (file) => {
          const expected =
            file.path === ATLAS_MANIFEST_PATH
              ? new TextEncoder().encode(JSON.stringify(atlas))
              : file.path === "atlas/ui-0.webp"
                ? page
                : file.path.endsWith(".json")
                  ? new TextEncoder().encode(JSON.stringify({ source: file.path }))
                  : await readArt(file.path);
          expect(file.source, file.path).toEqual(expected);
          expect(file.fileName, file.path).toBe(
            hashedArtFileName(file.path, contentHash(file.source)),
          );
        }),
    );
    expect(files.some(({ path }) => path === ART_MANIFEST)).toBe(true);
  });

  it("preserves string escapes, negative zero and numeric spellings while compacting metadata", async () => {
    const text = String.raw`{
      "unknown": "  spaced \\ \t \"Quoted\"  ",
      "negativeZero": -0,
      "exponent": 1e+20
    }`;
    const expected = String.raw`{"unknown":"  spaced \\ \t \"Quoted\"  ","negativeZero":-0,"exponent":1e+20}`;
    const compacted = await hashGameArt(
      async (path) => (path === ART_MANIFEST ? new TextEncoder().encode(text) : readArt(path)),
      dom,
      manifest,
      { files: new Map([["atlas/ui-0.webp", page]]), manifest: atlas },
    );
    const file = compacted.find(({ path }) => path === ART_MANIFEST)!;
    expect(new TextDecoder().decode(file.source)).toBe(expected);
    expect(JSON.parse(expected)).toEqual(JSON.parse(text));
    expect(Object.is(JSON.parse(new TextDecoder().decode(file.source)).negativeZero, -0)).toBe(
      true,
    );
    expect(file.fileName).toBe(hashedArtFileName(ART_MANIFEST, contentHash(file.source)));
    expect(compacted.map(({ path }) => path)).toEqual(files.map(({ path }) => path));
  });

  it("rejects malformed emitted metadata before assigning it a content-hashed URL", async () => {
    await expect(
      hashGameArt(
        async (path) =>
          path === ART_MANIFEST ? new TextEncoder().encode("{ broken }") : readArt(path),
        { ...dom, sheets: new Map() },
        manifest,
        { files: new Map([["atlas/ui-0.webp", page]]), manifest: atlas },
      ),
    ).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    ["a key with no image or sprite", { sheets: new Map([["missing", "dom-chrome" as const]]) }],
    ["a grey copy of a key it does not draw", { disabled: new Set(["missing"]) }],
    ["a neutral card copy of a key it does not draw", { grey: new Set(["missing"]) }],
  ] as const)("fails the build for %s the HTML interface draws", async (_case, keys) => {
    await expect(
      hashGameArt(readArt, { ...dom, ...keys }, manifest, { files: new Map(), manifest: atlas }),
    ).rejects.toThrow(/missing/);
  });
});
