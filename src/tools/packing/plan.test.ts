import { expect, it } from "vitest";

import { planPackedAssets } from "./plan.ts";

it("groups final asset URLs by UI lifecycle and sound codec, independent of emission order", () => {
  const urls = [
    "/assets/art/sounds/sfx-hit-puddle-hash.m4a",
    "/assets/art/sounds/sfx-tip-hash.ogg",
    "/assets/art/sounds/sfx-debuff-muddy-hash.ogg",
    "/assets/art/dom/dom-chrome-hash.json",
    "/assets/art/dom/dom-walk-hash.webp",
    "/assets/art/dom/dom-home-disabled-hash.webp",
    "/assets/art/dom/dom-cards-grey-hash.webp",
    "/assets/art/fonts/font-display-hash.fnt",
    "/assets/art/fonts/font-display-hash.woff",
    "/assets/art/manifest-hash.json",
    "/art/images/backdrop-yonge-street.png",
    "/art/site/home-road.png",
    "/assets/icons/icon-512-hash.png",
    "/icons/icon-512.png",
  ];
  const plan = planPackedAssets(urls);
  expect(planPackedAssets([...urls, ...urls].reverse())).toEqual(plan);
  expect(Object.fromEntries(plan.groups.map(({ members, name }) => [name, members]))).toEqual({
    "art-registry": [urls[9]],
    "bitmap-font-metrics": [urls[7]],
    "cards-and-details": [urls[6]],
    "contact-m4a": [urls[0]],
    "contact-ogg": [urls[2]],
    "other-ogg": [urls[1]],
    "site-gallery-illustrations": [urls[10]],
    "site-home-screenshots": [urls[11]],
    "start-and-menus": [urls[3], urls[5]],
    "walk-hud": [urls[4]],
    "web-fonts": [urls[8]],
  });
  expect(plan.iconUrls).toEqual([urls[12], urls[13]]);
});

it("leaves independent code, music, road atlases and discovery metadata out of the pack plan", () => {
  expect(
    planPackedAssets([
      "/.game-kit/build.json",
      "/.game-kit/manifest-example.json",
      "/_headers",
      "/art/art-files.json",
      "/assets/art/atlas/road-1-hash.webp",
      "/assets/art/sounds/music-high-park-hash.m4a",
      "/assets/phaser-hash.js",
      "/manifest.webmanifest",
      "/play/index.html",
      "/sw.js",
    ]),
  ).toEqual({ groups: [], iconUrls: [] });
});
