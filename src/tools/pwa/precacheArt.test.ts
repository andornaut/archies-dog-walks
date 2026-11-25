import { contentHash } from "@andornaut/game-kit/build/contentHash";
import { isHashedAssetUrl } from "@andornaut/game-kit/runtime/web/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { CACHE_POLICY } from "../../pwa/cachePolicy.ts";
import { hashedArtFileName } from "../atlas/hashedArt.ts";
import { bootFiles, hashedArtUrls } from "./precacheArt.ts";

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
  const soundPaths = ["sounds/sfx-tip.ogg", "sounds/sfx-tip.m4a"];
  const artFiles = new Map(
    [...others, ...soundPaths].map((path) => [
      path,
      hashedArtFileName(path, contentHash(new TextEncoder().encode(path))),
    ]),
  );
  const urlOf = (path: string) => `/${artFiles.get(path) ?? ""}`;
  const listed = hashedArtUrls(artFiles, manifest);

  it("names each sound's alternatives under its logical URL, and every other file by hashed name", () => {
    expect(listed.sounds).toEqual({ "/art/sounds/sfx-tip": soundPaths.map(urlOf) });
    expect(listed.urls).toEqual(others.map(urlOf));
  });

  it("lists only URLs the router serves as hashed", () => {
    const all = [...listed.urls, ...Object.values(listed.sounds).flat()];
    expect(all.filter((url) => !isHashedAssetUrl(CACHE_POLICY, url))).toEqual([]);
  });

  it("counts the art and one alternative per sound as boot's reads", () => {
    const page = ["/play/", "/assets/play-abc.js"];
    expect(bootFiles({ sounds: listed.sounds, urls: [...page, ...listed.urls] })).toEqual([
      ...listed.urls,
      urlOf("sounds/sfx-tip.ogg"),
    ]);
  });

  it("rejects a malformed manifest, as the game does", () => {
    expect(() => hashedArtUrls(artFiles, { fonts: [], images: [], sounds: [] })).toThrow(
      "manifest.sprites",
    );
  });
});
