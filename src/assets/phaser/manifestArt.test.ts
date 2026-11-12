import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import type { AtlasManifest } from "../atlasManifest.ts";
import { atlasManifest } from "./manifestArt.ts";

vi.mock("virtual:art-files", () => ({ default: new Map() }));

const manifest: AtlasManifest = {
  pages: [{ bytes: 120, file: "atlas/page.webp", group: "nearest", height: 16, width: 16 }],
  textures: [],
};

const KEY = "art-atlas-manifest";

function sceneWithManifest(value: unknown) {
  const stub = sceneStub(vi.fn);
  stub.cache.json.add(KEY, value);
  return { cache: stub.cache.json, scene: stub as unknown as Scene };
}

describe("runtime atlas manifest cache", () => {
  it("parses a loaded manifest once for its cache owner", () => {
    const { cache, scene } = sceneWithManifest(manifest);
    expect(atlasManifest(scene)).toEqual(manifest);
    expect(atlasManifest(scene)).toBe(atlasManifest(scene));
    expect(cache.get).toHaveBeenCalledOnce();
  });

  it("leaves a missing manifest available for a later load", () => {
    const { cache, scene } = sceneWithManifest(manifest);
    cache.remove(KEY);
    expect(atlasManifest(scene)).toBeUndefined();
    expect(cache.get).not.toHaveBeenCalled();
    cache.add(KEY, manifest);
    expect(atlasManifest(scene)).toEqual(manifest);
  });

  it("rejects and removes invalid JSON without caching the failed parse", () => {
    const { cache, scene } = sceneWithManifest({ pages: "invalid", textures: [] });
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(atlasManifest(scene)).toBeUndefined();
      expect(cache.remove).toHaveBeenCalledWith(KEY);
      expect(report).toHaveBeenCalledOnce();
      cache.add(KEY, manifest);
      expect(atlasManifest(scene)).toEqual(manifest);
      expect(cache.get).toHaveBeenCalledTimes(2);
    } finally {
      report.mockRestore();
    }
  });
});
