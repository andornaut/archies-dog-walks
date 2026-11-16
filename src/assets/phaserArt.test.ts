import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { parseManifest } from "./manifest.ts";
import { usesPhaserArt } from "./phaserArt.ts";

it("omits exactly the reviewed native chrome from the authored manifest, retaining all other renderer roles", () => {
  const manifest = parseManifest(JSON.parse(readFileSync("public/art/manifest.json", "utf8")));
  const keys = [...manifest.fonts, ...manifest.images, ...manifest.sprites].map(({ key }) => key);
  expect(keys.filter((key) => !usesPhaserArt(key)).sort()).toEqual([
    "icon-close",
    "icon-exit",
    "icon-menu",
    "icon-pause",
    "icon-sound",
    "ui-button",
    "ui-icon-button",
    "ui-icon-button-normal",
    "ui-icon-button-pressed",
    "ui-scroll-thumb",
    "ui-scroll-track",
  ]);
  expect(
    ["ui-button-disabled", "ui-panel", "ui-pet-shop", "font-body", "icon-future"].every(
      usesPhaserArt,
    ),
  ).toBe(true);
});
