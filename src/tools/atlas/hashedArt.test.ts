import { beforeAll, describe, expect, it } from "vitest";

import { ATLAS_MANIFEST_PATH, type AtlasManifest } from "../../assets/atlasManifest";
import type { AssetManifest } from "../../assets/manifest";
import { contentHash } from "../../platform/build/contentHash.ts";
import { ART_MANIFEST } from "../artManifest";
import { type HashedArtFile, hashedArtFileName, hashGameArt } from "./hashedArt";

describe("hashedArtFileName", () => {
  it.each([
    ["sprites/dog-kilo@88.json", "assets/art/sprites/dog-kilo@88-Bq3x_9-Z.json"],
    ["manifest.json", "assets/art/manifest-Bq3x_9-Z.json"],
  ])("names %s %s", (path, fileName) => {
    expect(hashedArtFileName(path, "Bq3x_9-Z")).toBe(fileName);
  });
});

const manifest: AssetManifest = {
  fonts: [
    { fnt: "fonts/packed.fnt", key: "packed-font", png: "fonts/packed.png" },
    { fnt: "fonts/own.fnt", key: "own-font", png: "fonts/own.png" },
  ],
  images: [
    { key: "packed-image", png: "images/packed.png" },
    { key: "own-image", png: "images/own.png" },
    { key: "shared-image", png: "sprites/shared.png" },
  ],
  sounds: [{ key: "sound", m4a: "sounds/sound.m4a", ogg: "sounds/sound.ogg" }],
  sprites: [
    { json: "sprites/packed.json", key: "packed-sprite", png: "sprites/packed.png" },
    { json: "sprites/own.json", key: "own-sprite", png: "sprites/shared.png" },
  ],
};
const atlas: AtlasManifest = {
  pages: [{ bytes: 3, file: "atlas/ui-0.webp", group: "ui", height: 4, width: 4 }],
  textures: ["packed-font", "packed-image", "packed-sprite"].map((key) => ({
    frames: [{ h: 1, name: "0", w: 1, x: 1, y: 1 }],
    key,
    page: 0,
  })),
};
const page = new Uint8Array([7, 8, 9]);
const readArt = async (path: string) => new TextEncoder().encode(`source:${path}`);

// Packed and unpacked entries exercise each asset category; the shared PNG must emit once.
describe("hashed game art", () => {
  let files: HashedArtFile[];
  beforeAll(async () => {
    files = await hashGameArt(readArt, manifest, {
      files: new Map([["atlas/ui-0.webp", page]]),
      manifest: atlas,
    });
  });

  it("emits every required path once in sorted order without packed source files", () => {
    expect(files.map(({ path }) => path)).toEqual([
      "atlas-manifest.json",
      "atlas/ui-0.webp",
      "fonts/own.fnt",
      "fonts/own.png",
      "fonts/packed.fnt",
      "images/own.png",
      "manifest.json",
      "sounds/sound.m4a",
      "sounds/sound.ogg",
      "sprites/own.json",
      "sprites/shared.png",
    ]);
  });

  it("uses built atlas bytes and metadata, preserving each remaining source, named by its hash", async () => {
    await Promise.all(
      files.map(async (file) => {
        const expected =
          file.path === ATLAS_MANIFEST_PATH
            ? new TextEncoder().encode(JSON.stringify(atlas))
            : file.path === "atlas/ui-0.webp"
              ? page
              : await readArt(file.path);
        expect(file.source, file.path).toEqual(expected);
        expect(file.fileName, file.path).toBe(
          hashedArtFileName(file.path, contentHash(file.source)),
        );
      }),
    );
    expect(files.some(({ path }) => path === ART_MANIFEST)).toBe(true);
  });
});
