import { describe, expect, it } from "vitest";

import { gameOnlyFiles, updateGroup } from "./assetGroups.ts";

describe("updateGroup", () => {
  it.each([
    ["/play/", "page"],
    ["/manifest.webmanifest", "page"],
    ["/controls.css", "page"],
    ["/assets/icons/icon-192-xJLL7Tmk.png", "icons"],
    ["/assets/phaser-KjESfy1l.js", "phaser"],
    ["/assets/main-Dn9Nti8m.js", "code"],
    ["/assets/zonePlanWorker-DXZOak5K.js", "code"],
    ["/assets/play-BOXL4Gg8.css", "code"],
    ["/assets/Tiny5-tOhxMkJP.woff2", "page-fonts"],
    ["/assets/art/manifest-TDTroJr3.json", "art-manifest"],
    ["/assets/art/atlas/road-3-A-c0smNs.webp", "atlas-road"],
    ["/assets/art/atlas/boot-0-7-ArbpKe.webp", "atlas-boot"],
    ["/assets/art/dom/dom-cards-grey-nRvxS44v.webp", "dom-sheets"],
    ["/assets/art/fonts/font-body-Jf-VBskV.fnt", "art-fonts"],
    ["/assets/art/sounds/sfx-hit-thief-eTyYnGCT.ogg", "sound-effects"],
    ["/assets/art/sounds/music-the-beaches-SpFl5h4N.ogg", "music-the-beaches"],
    ["/assets/art/sounds/music-the-beaches-VWjwb1fr.m4a", "music-the-beaches"],
  ])("puts %s in %s", (url, group) => {
    expect(updateGroup(url)).toBe(group);
  });

  it("fails for a file no rule names", () => {
    expect(() => updateGroup("/assets/art/images/logo-abcdefgh.png")).toThrow(
      "no update group for /assets/art/images/logo-abcdefgh.png",
    );
  });
});

describe("gameOnlyFiles", () => {
  const chunk = (imports: string[], extra: object = {}) => ({
    code: "",
    imports,
    isEntry: false,
    type: "chunk" as const,
    ...extra,
  });
  const asset = (source = "") => ({ source, type: "asset" as const });
  const bundle = {
    "assets/art/dom/dom-chrome-a.webp": asset(),
    "assets/art/manifest-a.json": asset(),
    "assets/game-a.js": chunk(["assets/shared-a.js"], {
      viteMetadata: { importedAssets: new Set(["assets/worker-a.js"]), importedCss: new Set() },
    }),
    "assets/play-a.js": chunk(["assets/shared-a.js"], {
      dynamicImports: ["assets/game-a.js"],
      isEntry: true,
    }),
    "assets/shared-a.js": chunk([]),
    "assets/worker-a.js": asset(),
    "nav.css": asset("nav { background: url(/assets/art/dom/dom-chrome-a.webp); }"),
    "play/index.html": asset(`<script type="module" src="/assets/play-a.js"></script>`),
  };

  it("keeps each page, its static imports and the art a stylesheet names out of the archives", () => {
    expect([...gameOnlyFiles(bundle)].sort()).toEqual([
      "/assets/art/manifest-a.json",
      "/assets/game-a.js",
      "/assets/worker-a.js",
    ]);
  });
});
