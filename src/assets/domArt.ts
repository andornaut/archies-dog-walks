import { keysOf } from "@andornaut/game-kit/records";

import { gameData } from "../data/index.ts";
import type { GameData } from "../data/types.ts";
import { debuffIconKey, gearSmallIconKey, perkIconKey, upgradeIconKey } from "./iconKeys.ts";
import {
  badgeKey,
  DETAIL_WELL_KEY,
  dogFaceKey,
  dogPortraitKey,
  gearIconKey,
  ownerCardFaceKey,
  ownerFaceKey,
  walkerPortraitKey,
  WARNING_KEY,
  ZONE_CELEBRATION_ART,
  ZONE_PIPS_KEY,
} from "./spriteKeys.ts";

// The dog slot's icon, as the shop's rows and the purchase confirm draw it (SHOP_ART in
// src/scenes/itemArt.ts).
const DOG_SLOT_ICON_KEY = "icon-dog-slot";

// The art the HTML interface draws (src/ui/dom/, src/hud/dom/), by key. CSS loads whole files, so
// a build writes each key's own files beside the atlas that packs it for the canvas, and the
// service worker precaches them with the rest of the hashed art. Only a key's own files ship,
// never its depth steps.

// Every picture a detail card or the purchase confirm can show: each dog's portrait and its
// owner's face sheet, each walker's portrait and the face that stands in for it, each gear item's
// icon, the dog slot's icon, each upgrade's and debuff's icon (src/hud/explain.ts), and the well
// they sit in.
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
    DOG_SLOT_ICON_KEY,
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

// The zone celebration's frames and the icons on a new walker's info lines: the greeting's
// ui-quip and its tail, and each perk's icon.
function celebrationArtKeys(data: Pick<GameData, "walkerPerks">): string[] {
  return ["ui-quip", ZONE_CELEBRATION_ART.tailUp, ...keysOf(data.walkerPerks).map(perkIconKey)];
}

// The art the HTML interface's stylesheet names (src/ui/dom/uiStyle.ts), each a custom property
// --adw-<key> on the layer: fx-tap's sheet, and the frames and faces it draws as images.
export const DOM_STYLE_ART: readonly (readonly ["image" | "sheet", string])[] = [
  ["sheet", "fx-tap"],
  ...[
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
    "ui-quip",
    "ui-scroll-thumb",
    "ui-scroll-track",
  ].map((key) => ["image", key] as const),
];

// The Logbook's art (src/home/logbookView.ts) and every badge's card (src/home/badgeCardView.ts):
// each badge's sheet, each dog's face sheet, the earned tick, the scrollbar, and the confetti.
function logbookArtKeys(data: Pick<GameData, "achievements" | "dogs">): string[] {
  return [
    "fx-confetti",
    "ui-check",
    "ui-scroll-thumb",
    "ui-scroll-track",
    ...data.achievements.map(({ id }) => badgeKey(id)),
    ...keysOf(data.dogs).map((dog) => dogFaceKey(data, dog)),
  ];
}

// The End screen's art (src/home/endScreenView.ts): the zone pips' sheet and each owner's
// bubble's tail, besides the ui-quip its greeting shares with the celebrations.
const END_ART_KEYS = [ZONE_PIPS_KEY, "ui-quip-tail"];

// The shop's page and rows (src/scenes/ShopScene.ts, drawn by the display mirror) beyond the
// Logbook's and the detail cards': the tiles' faces, the close control's face sheet, the bill and
// lock badges and the message plate.
const SHOP_ART_KEYS = ["icon-bill", "icon-lock", "ui-hint", "ui-icon-button", "ui-tile"];

// The start screen's art (src/scenes/StartScene.ts, drawn by the display mirror) beyond the
// shop's: the top bar's icons and the bank's well, the gear badge's icons, the sections' frames
// and fills, the pack bonus's heart, the bubble's tail, the slot sign and its gold outline, and
// Start walk's faces.
const START_ART_KEYS = [
  ...keysOf(gameData.shopGear).map(gearSmallIconKey),
  "icon-exit",
  "icon-help",
  "icon-logbook",
  "icon-settings",
  "icon-sound",
  "ui-afford",
  "ui-button",
  "ui-cork",
  "ui-denim",
  "ui-heart",
  "ui-home-cash-well-left",
  "ui-home-cash-well-mid",
  "ui-home-cash-well-right",
  "ui-plaid",
  "ui-quip-tail-down",
  "ui-section",
  "ui-slot-sign",
];

// The walk's HUD (src/scenes/HudScene.ts, drawn by the display mirror) beyond the other screens':
// the walk bar, its pause and play icons and the card band; each dog's card and its warning, the
// LEAD tag and each owner's card face; the effect wells and each effect's 20x20 icon (its icon
// key's -20 copy); the neighbourhood pill and the debuff bars; the message strip's icons and the
// fired lines' tail; the owners' tabs; and the moments' plates, pops, coins, sparkles, hearts,
// treats and warning sign.
function hudArtKeys(
  data: Pick<GameData, "dogs" | "shopGear" | "upgrades" | "walkerPerks">,
): string[] {
  return [
    ...[
      ...keysOf(data.shopGear).map(gearSmallIconKey),
      ...keysOf(data.walkerPerks).map(perkIconKey),
      ...keysOf(data.upgrades).map(upgradeIconKey),
    ].map((key) => `${key}-20`),
    ...keysOf(data.dogs).map((dog) => ownerCardFaceKey(data, dog)),
    WARNING_KEY,
    "fx-coin-fly",
    "fx-fired-pop",
    "fx-heart-gain",
    "fx-heart-loss",
    "fx-sparkle",
    "fx-treat-pop",
    "icon-badge",
    "icon-bump",
    "icon-fired",
    "icon-hint",
    "icon-lucky",
    "icon-muddy",
    "icon-pause",
    "icon-play",
    "icon-spotlight",
    "icon-stinky",
    "icon-trait-chaser",
    "icon-treat",
    "icon-zoomies",
    "treat@50",
    "ui-debuff-bar",
    "ui-dog-card",
    "ui-dog-card-band",
    "ui-dog-card-warn",
    "ui-effect-well",
    "ui-fired-plate",
    "ui-hint-tail",
    "ui-hit-label",
    "ui-lead-tag",
    "ui-owner-tab",
    "ui-quip-tail-down",
    "ui-walk-bar",
    "ui-zone-pill",
  ];
}

export const DOM_ART_KEYS: ReadonlySet<string> = new Set([
  ...DOM_STYLE_ART.map(([, key]) => key),
  ...detailArtKeys(gameData),
  ...SETTINGS_ART_KEYS,
  ...celebrationArtKeys(gameData),
  ...logbookArtKeys(gameData),
  ...END_ART_KEYS,
  ...SHOP_ART_KEYS,
  ...START_ART_KEYS,
  ...hudArtKeys(gameData),
]);

// A DOM art file's path under /art/: an image's PNG, or a sprite sheet's PNG or JSON.
export function domArtPath(kind: "image" | "sheet", key: string, ext: "json" | "png"): string {
  return `${kind === "image" ? "images" : "sprites"}/${key}.${ext}`;
}

// The tile pictures whose disabled tile's grey copy (disabledArtPath in src/ui/disabledArt.ts) the
// HTML interface draws: each dog's face, each walker's face and perk icon, each gear item's icon
// and the dog slot's icon. A build writes each copy as a file of its own from the remap the atlas
// packs it with, beside its key's files; a sheet's copy keeps its key's JSON frames.
function disabledTileArtKeys(
  data: Pick<GameData, "dogs" | "shopGear" | "walkerPerks" | "walkers">,
): string[] {
  return [
    ...keysOf(data.dogs).map((dog) => dogFaceKey(data, dog)),
    ...keysOf(data.walkers).map((walker) => data.walkers[walker].portraitKey),
    ...keysOf(data.walkerPerks).map(perkIconKey),
    ...keysOf(data.shopGear).map(gearIconKey),
    DOG_SLOT_ICON_KEY,
  ];
}

export const DOM_DISABLED_ART_KEYS: ReadonlySet<string> = new Set(disabledTileArtKeys(gameData));

// The art the zone celebration's HTML draws dimmed under the pause menu, as the canvas dims the
// frozen view under it (dimArtPath in src/ui/dimArt.ts): its frames (the earnings plate's
// ui-panel, the greeting's ui-quip and its tail), each perk's icon and its button's face. A build
// writes each copy as a file of its own from the canvas's ramp remap, beside its key's files; a
// sheet's copy keeps its key's JSON frames.
export const DOM_DIM_ART_KEYS: ReadonlySet<string> = new Set([
  "ui-button-go",
  "ui-panel",
  ...celebrationArtKeys(gameData),
]);
