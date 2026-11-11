import { keysOf } from "@andornaut/game-kit/records";

import { gameData } from "../data/index.ts";
import type { GameData } from "../data/types.ts";
import { debuffIconKey, upgradeIconKey } from "./iconKeys.ts";
import {
  DETAIL_WELL_KEY,
  dogPortraitKey,
  gearIconKey,
  ownerFaceKey,
  walkerPortraitKey,
} from "./spriteKeys.ts";

// The art the HTML interface draws (src/ui/dom/, src/hud/dom/), by key. CSS loads whole files, so
// a build writes each key's own files beside the atlas that packs it for the canvas, and the
// service worker precaches them with the rest of the hashed art. Only a key's own files ship,
// never its depth steps.

// Every picture a detail card can show: each dog's portrait and its owner's face sheet, each
// walker's portrait and the face that stands in for it, each gear item's icon, each upgrade's
// and debuff's icon (src/hud/explain.ts), and the well they sit in.
function detailArtKeys(
  data: Pick<GameData, "debuffs" | "dogs" | "shopGear" | "upgrades" | "walkers">,
): string[] {
  return [
    DETAIL_WELL_KEY,
    ...keysOf(data.dogs).flatMap((dog) => [dogPortraitKey(data, dog), ownerFaceKey(data, dog)]),
    ...keysOf(data.walkers).flatMap((walker) => [
      walkerPortraitKey(walker),
      data.walkers[walker].portraitKey,
    ]),
    ...keysOf(data.shopGear).map(gearIconKey),
    ...keysOf(data.upgrades).map(upgradeIconKey),
    ...keysOf(data.debuffs).map(debuffIconKey),
  ];
}

// The settings card's art (src/home/settingsView.ts): each row's icon sheet, the switch, the
// slider and its knob, and the install steps' button glyphs.
const SETTINGS_ART_KEYS = [
  "icon-browser-menu",
  "icon-effects-panel",
  "icon-install-panel",
  "icon-motion-panel",
  "icon-music-panel",
  "icon-share",
  "icon-sound-panel",
  "ui-slider",
  "ui-slider-knob",
  "ui-switch",
];

export const DOM_ART_KEYS: ReadonlySet<string> = new Set([
  "fx-tap",
  "icon-close",
  "ui-button-disabled",
  "ui-button-go",
  "ui-button-go-disabled",
  "ui-button-go-pressed",
  "ui-button-normal",
  "ui-button-pressed",
  "ui-button-secondary",
  "ui-button-secondary-pressed",
  "ui-detail-card",
  "ui-icon-button-normal",
  "ui-icon-button-pressed",
  "ui-panel",
  ...detailArtKeys(gameData),
  ...SETTINGS_ART_KEYS,
]);

// A DOM art file's path under /art/: an image's PNG, or a sprite sheet's PNG or JSON.
export function domArtPath(kind: "image" | "sheet", key: string, ext: "json" | "png"): string {
  return `${kind === "image" ? "images" : "sprites"}/${key}.${ext}`;
}
