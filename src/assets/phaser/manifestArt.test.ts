import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { type AtlasManifest, atlasPageKey } from "../atlasManifest.ts";
import { atlasPageBytes } from "./manifestArt.ts";

vi.mock("virtual:art-files", () => ({ default: new Map() }));

const manifest: AtlasManifest = {
  pages: [{ bytes: 120, file: "atlas/page.webp", group: "nearest", height: 16, width: 16 }],
  textures: [],
};

function sceneWithManifest(value: unknown) {
  const values = new Map([["art-atlas-manifest", value]]);
  const cache = {
    exists: (key: string) => values.has(key),
    get: vi.fn((key: string) => values.get(key)),
    remove: vi.fn((key: string) => values.delete(key)),
  };
  return { cache, scene: { cache: { json: cache } } as unknown as Scene, values };
}

describe("runtime atlas manifest cache", () => {
  it("parses a loaded manifest once for its cache owner", () => {
    const { cache, scene } = sceneWithManifest(manifest);
    const expected = new Map([[atlasPageKey(0), manifest.pages[0]?.bytes]]);
    expect(atlasPageBytes(scene)).toEqual(expected);
    expect(atlasPageBytes(scene)).toEqual(expected);
    expect(cache.get).toHaveBeenCalledOnce();
  });

  it("leaves a missing manifest available for a later load", () => {
    const { cache, scene, values } = sceneWithManifest(manifest);
    values.clear();
    expect(atlasPageBytes(scene)).toEqual(new Map());
    expect(cache.get).not.toHaveBeenCalled();
    values.set("art-atlas-manifest", manifest);
    expect(atlasPageBytes(scene).size).toBe(1);
  });

  it("rejects and removes invalid JSON without caching the failed parse", () => {
    const { cache, scene, values } = sceneWithManifest({ pages: "invalid", textures: [] });
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(atlasPageBytes(scene)).toEqual(new Map());
      expect(cache.remove).toHaveBeenCalledWith("art-atlas-manifest");
      expect(report).toHaveBeenCalledOnce();
      values.set("art-atlas-manifest", manifest);
      expect(atlasPageBytes(scene)).toEqual(new Map([[atlasPageKey(0), manifest.pages[0]?.bytes]]));
      expect(cache.get).toHaveBeenCalledTimes(2);
    } finally {
      report.mockRestore();
    }
  });
});
