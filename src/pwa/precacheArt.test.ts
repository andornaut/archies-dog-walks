import { contentHash } from "@andornaut/game-kit/web/build/vite/contentHash";
import { isHashedAssetUrl } from "@andornaut/game-kit/web/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { hashedArtFileName } from "../tools/atlas/hashedArt";
import { CACHE_POLICY } from "./cachePolicy";
import { hashedArtUrls } from "./precacheArt";

describe("hashedArtUrls", () => {
  const manifest = {
    fonts: [{ fnt: "fonts/font-body.fnt", key: "font-body", png: "fonts/font-body.png" }],
    images: [],
    sounds: [{ key: "sfx-tip", m4a: "sounds/sfx-tip.m4a", ogg: "sounds/sfx-tip.ogg" }],
    sprites: [],
  };
  const others = [
    "manifest.json",
    "atlas/boot-0.png",
    "fonts/font-body.fnt",
    "fonts/font-body.png",
  ];
  const sounds = { m4a: ["sounds/sfx-tip.m4a"], ogg: ["sounds/sfx-tip.ogg"] };
  const artFiles = new Map(
    [...others, ...sounds.m4a, ...sounds.ogg].map((path) => [
      path,
      hashedArtFileName(path, contentHash(new TextEncoder().encode(path))),
    ]),
  );
  const urlOf = (path: string) => `/${artFiles.get(path) ?? ""}`;
  const listed = hashedArtUrls(artFiles, manifest);

  it("lists each format's sound files apart, and every other file in the map, by hashed name", () => {
    expect(listed.sounds).toEqual({ m4a: sounds.m4a.map(urlOf), ogg: sounds.ogg.map(urlOf) });
    expect(listed.urls).toEqual(others.map(urlOf));
  });

  it("lists only URLs the worker serves as hashed", () => {
    const all = [...listed.urls, ...listed.sounds.m4a, ...listed.sounds.ogg];
    expect(all.filter((url) => !isHashedAssetUrl(CACHE_POLICY, url))).toEqual([]);
  });

  it("rejects a malformed manifest, as the game does", () => {
    expect(() => hashedArtUrls(artFiles, { fonts: [], images: [], sounds: [] })).toThrow(
      "manifest.sprites",
    );
  });
});
