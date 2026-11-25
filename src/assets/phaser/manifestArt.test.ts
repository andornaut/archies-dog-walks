import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { type AtlasManifest, atlasPageKey, packAtlasManifest } from "../atlasManifest.ts";
import type { AssetManifest } from "../manifest.ts";
import {
  addAtlasTextures,
  atlasManifest,
  loadManifest,
  MANIFEST_CACHE_KEY,
  queueManifestArt,
} from "./manifestArt.ts";

vi.mock("virtual:art-files", () => ({ default: new Map() }));

const manifest: AtlasManifest = {
  pages: [{ file: "atlas/page.webp", group: "nearest", height: 16, width: 16 }],
  textures: [],
};

const KEY = "art-manifest";

function sceneWithManifest(value: unknown) {
  const stub = sceneStub(vi.fn);
  stub.cache.json.add(KEY, { atlas: value, fonts: [], images: [], sounds: [], sprites: [] });
  return { cache: stub.cache.json, scene: stub as unknown as Scene };
}

describe("runtime atlas manifest cache", () => {
  it("parses a loaded manifest once for its cache owner", () => {
    const { cache, scene } = sceneWithManifest(packAtlasManifest(manifest));
    expect(atlasManifest(scene)).toEqual(manifest);
    expect(atlasManifest(scene)).toBe(atlasManifest(scene));
    expect(cache.get).toHaveBeenCalledTimes(3);
  });

  it("leaves a missing manifest available for a later load", () => {
    const { cache, scene } = sceneWithManifest(packAtlasManifest(manifest));
    cache.remove(KEY);
    expect(atlasManifest(scene)).toBeUndefined();
    expect(cache.get).toHaveBeenCalledOnce();
    cache.add(KEY, { atlas: packAtlasManifest(manifest) });
    expect(atlasManifest(scene)).toEqual(manifest);
  });

  it("retains valid asset metadata and refreshes a replaced invalid atlas", () => {
    const { cache, scene } = sceneWithManifest({ pages: "invalid", textures: [] });
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(atlasManifest(scene)).toBeUndefined();
      expect(cache.remove).not.toHaveBeenCalled();
      expect(report).toHaveBeenCalledOnce();
      cache.add(KEY, { atlas: packAtlasManifest(manifest) });
      expect(atlasManifest(scene)).toEqual(manifest);
      expect(cache.get).toHaveBeenCalledTimes(2);
    } finally {
      report.mockRestore();
    }
  });
});

it("never queues native-only chrome through the missing-atlas own-file fallback", () => {
  const aseprite = vi.fn();
  const stub = sceneStub(vi.fn, { load: { aseprite } });
  const scene = stub as unknown as Scene;
  const assets: AssetManifest = {
    fonts: [],
    images: [
      { key: "icon-exit", png: "images/icon-exit.png" },
      { key: "screen-home", png: "images/screen-home.png" },
    ],
    sounds: [],
    sprites: [
      { json: "sprites/icon-sound.json", key: "icon-sound", png: "sprites/icon-sound.png" },
      { json: "sprites/world.json", key: "world", png: "sprites/world.png" },
    ],
  };
  queueManifestArt(scene, assets);
  expect(stub.load.image).toHaveBeenCalledExactlyOnceWith(
    "screen-home",
    expect.stringContaining("images/screen-home.png"),
  );
  expect(aseprite).toHaveBeenCalledExactlyOnceWith(
    "world",
    expect.stringContaining("sprites/world.png"),
    expect.stringContaining("sprites/world.json"),
  );
});

it("does not register native textures from an old or externally supplied atlas page", () => {
  const create = vi.fn(() => ({ add: vi.fn(), source: [] as unknown[] }));
  const stub = sceneStub(vi.fn, {
    textures: {
      create,
      exists: (key: string) => key === atlasPageKey(0),
      get: () => ({ source: [{}] }),
    },
  });
  const keys = ["icon-exit", "icon-sound", "screen-home"];
  stub.cache.json.add(KEY, {
    atlas: packAtlasManifest({
      pages: manifest.pages,
      textures: keys.map((key) => ({
        frames: [{ h: 1, name: "0", w: 1, x: 0, y: 0 }],
        key,
        page: 0,
      })),
    }),
  });
  addAtlasTextures(stub as unknown as Scene);
  expect(create).toHaveBeenCalledExactlyOnceWith("screen-home", []);
});

it("queues one required manifest and admits its assets after it completes", () => {
  const once = vi.fn();
  const json = vi.fn();
  const stub = sceneStub(vi.fn, { load: { json, once } });
  const queue = vi.fn();
  loadManifest(stub as unknown as Scene, queue);
  expect(json).toHaveBeenCalledExactlyOnceWith(
    MANIFEST_CACHE_KEY,
    expect.stringContaining("manifest.json"),
  );
  const assets = { fonts: [], images: [], sounds: [], sprites: [] };
  stub.cache.json.add(MANIFEST_CACHE_KEY, { ...assets, atlas: packAtlasManifest(manifest) });
  once.mock.calls[0]![1]();
  expect(queue).toHaveBeenCalledExactlyOnceWith(assets);
  expect(atlasManifest(stub as unknown as Scene)).toEqual(manifest);
});
