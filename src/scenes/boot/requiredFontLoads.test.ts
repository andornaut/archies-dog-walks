import type { LoadFailure } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import { expect, it, vi } from "vitest";

import type { AtlasManifest } from "../../assets/atlasManifest.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { fontXmlKey, MANIFEST_CACHE_KEY } from "../../assets/phaser/manifestArt.ts";
import {
  blockedFontAtlas,
  requiredFontFailure,
  retryRequiredFontLoads,
  unqueuedFonts,
} from "./requiredFontLoads.ts";

const manifest: Pick<AssetManifest, "fonts"> = {
  fonts: [{ fnt: "fonts/font-body.fnt", key: "font-body", png: "fonts/font-body.png" }],
};
const atlas: AtlasManifest = {
  pages: [{ file: "atlas/fonts.webp", group: "ui", height: 16, width: 16 }],
  textures: [{ frames: [{ h: 1, name: "0", w: 1, x: 0, y: 0 }], key: "font-body", page: 0 }],
};

it("classifies only the game manifest and actual required font load dependencies as manual", () => {
  for (const [type, key] of [
    ["json", MANIFEST_CACHE_KEY],
    ["bitmapFont", "font-body"],
    ["xml", fontXmlKey("font-body")],
    ["image", "atlas:0"],
  ]) {
    expect(requiredFontFailure(manifest, atlas, { key: key!, type: type! })).toBe(true);
  }
  for (const [type, key] of [
    ["bitmapFont", "font-world-label"],
    ["xml", "font-world-label:fnt"],
    ["image", "atlas:1"],
    ["image", "walker"],
  ]) {
    expect(requiredFontFailure(manifest, atlas, { key: key!, type: type! })).toBe(false);
  }
  expect(requiredFontFailure(manifest, undefined, { key: "atlas:0", type: "image" })).toBe(false);
});

const failure = (key: string, type: LoadFailure["type"]): LoadFailure => ({
  config: undefined,
  key,
  rounds: 0,
  type,
  url: `/${key}`,
});

it("explicitly retries recorded required members only and keeps a failed settlement failed", async () => {
  const required = failure(fontXmlKey("font-body"), "xml");
  const optional = failure("walker", "image");
  let records = [required, optional];
  const queued: string[] = [];
  const watch = {
    failures: () => records,
    retryFailures: vi.fn(async (select: (entry: LoadFailure) => boolean) => {
      queued.push(...records.filter(select).map(({ key }) => key));
    }),
    waitFor: vi.fn(),
  };
  const recoverManifest = vi.fn();
  const context = {
    isCurrent: () => true,
    recoverManifest,
    required: (entry: LoadFailure) => requiredFontFailure(manifest, atlas, entry),
  };
  await retryRequiredFontLoads(context, watch);
  expect(queued).toEqual([fontXmlKey("font-body")]);
  expect(records).toEqual([required, optional]);
  expect(recoverManifest).not.toHaveBeenCalled();
  records = [optional];
  watch.retryFailures.mockClear();
  await retryRequiredFontLoads(context, watch);
  expect(watch.retryFailures).not.toHaveBeenCalled();
});

it("recovers font discovery only after the recorded manifest succeeds and ignores disposed completions", async () => {
  let records = [failure(MANIFEST_CACHE_KEY, "json")];
  let finish: () => void = () => undefined;
  const watch = {
    failures: () => records,
    retryFailures: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    waitFor: vi.fn(),
  };
  let current = true;
  const recoverManifest = vi.fn(async () => undefined);
  const context = {
    isCurrent: () => current,
    recoverManifest,
    required: (entry: LoadFailure) => requiredFontFailure(manifest, atlas, entry),
  };
  const failed = retryRequiredFontLoads(context, watch);
  finish();
  await failed;
  expect(recoverManifest).not.toHaveBeenCalled();
  const success = retryRequiredFontLoads(context, watch);
  records = [];
  finish();
  await success;
  expect(recoverManifest).toHaveBeenCalledOnce();
  records = [failure(MANIFEST_CACHE_KEY, "json")];
  const disposed = retryRequiredFontLoads(context, watch);
  current = false;
  records = [];
  finish();
  await disposed;
  expect(recoverManifest).toHaveBeenCalledOnce();
});

it("defers first font and shared-page admissions instead of bypassing a recorded required failure", () => {
  const failure = { key: "atlas:0", type: "image" };
  const withWorldTexture = {
    ...atlas,
    textures: [...atlas.textures, { ...atlas.textures[0]!, key: "loading-walker" }],
  };
  const context = { atlas: withWorldTexture, failures: [failure], manifest };
  expect(blockedFontAtlas(context, "loading-walker")).toBe(true);
  expect(blockedFontAtlas(context, "unrelated-world-key")).toBe(false);
  expect(unqueuedFonts({ ...context, queued: new Set() }, manifest)).toEqual([]);
  expect(unqueuedFonts({ atlas, failures: [], queued: new Set() }, manifest)).toEqual(
    manifest.fonts,
  );
  expect(unqueuedFonts({ atlas, failures: [], queued: new Set(["font-body"]) }, manifest)).toEqual(
    [],
  );
});

it("does not turn a successful manifest transfer into usable metrics when its data is invalid", async () => {
  let records = [failure(MANIFEST_CACHE_KEY, "json")];
  const watch = {
    failures: () => records,
    retryFailures: async () => {
      records = [];
    },
    waitFor: vi.fn(),
  };
  const context = {
    isCurrent: () => true,
    recoverManifest: async () => {
      throw new Error("invalid required manifest");
    },
    required: (entry: LoadFailure) => requiredFontFailure(manifest, atlas, entry),
  };
  await expect(retryRequiredFontLoads(context, watch)).rejects.toThrow("invalid required manifest");
});
