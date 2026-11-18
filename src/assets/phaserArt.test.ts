import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { DOM_ART_KEYS } from "./domArt.ts";
import { parseManifest } from "./manifest.ts";
import { usesPhaserArt } from "./phaserArt.ts";

const manifest = parseManifest(JSON.parse(readFileSync("public/art/manifest.json", "utf8")));
const nativeOnly = [...manifest.fonts, ...manifest.images, ...manifest.sprites]
  .map(({ key }) => key)
  .filter((key) => !usesPhaserArt(key));

it("omits exactly the reviewed native chrome from the authored manifest, retaining all other renderer roles", () => {
  expect([...nativeOnly].sort()).toEqual([
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

it.each(nativeOnly)("keeps %s in the HTML interface's own-file art", (key) => {
  expect(DOM_ART_KEYS.has(key)).toBe(true);
});
