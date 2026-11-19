import { keysOf } from "@andornaut/game-kit/runtime/records";

import { gameData } from "../data/index.ts";
import type { GameData } from "../data/types.ts";
import { choiceCardAssets } from "./cardArt.ts";
import {
  debuffIconKey,
  gearSmallIconKey,
  hudGearIconKey,
  hudPerkIconKey,
  hudUpgradeIconKey,
  perkIconKey,
  upgradeIconKey,
} from "./iconKeys.ts";
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

// The shared skin cuts these existing sheets; tags retain the game's native button states.
export const DOM_BUTTON_SKIN = {
  sheets: ["ui-button", "ui-icon-button"],
  tags: [
    "normal",
    "pressed",
    "disabled",
    "secondary",
    "secondary-pressed",
    "go",
    "go-pressed",
    "go-disabled",
  ],
} as const;

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
  "icon-menu",
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
    ...keysOf(data.shopGear).map(hudGearIconKey),
    ...keysOf(data.walkerPerks).map(hudPerkIconKey),
    ...keysOf(data.upgrades).map(hudUpgradeIconKey),
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
    "ui-hud-effect-well",
    "ui-hit-label",
    "ui-lead-tag",
    "ui-owner-tab",
    "ui-quip-tail-down",
    "ui-walk-bar",
    "ui-zone-banner",
    "ui-zone-pill",
  ];
}

export const DOM_CHOICE_CARD_ART = choiceCardAssets(gameData);

export const DOM_ART_KEYS: ReadonlySet<string> = new Set([
  ...DOM_CHOICE_CARD_ART.images,
  ...DOM_CHOICE_CARD_ART.sheets,
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

// A DOM art file's logical path: an image's or a sprite sheet's PNG or frames, as its own files
// under /art/ name them. domArtUrl (src/assets/artFiles.ts) resolves it to the key's DOM sheet.
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

// Art inside covered native Home, shop, detail, settings, results and celebration roots.
// Top-bar and paused-walk dog-card roots stay outside dim registration. A build
// writes each copy as a file of its own from the canvas's ramp remap, beside its key's files; a
// sheet's copy keeps its key's JSON frames.
export const DOM_DIM_ART_KEYS: ReadonlySet<string> = new Set([
  ...DOM_CHOICE_CARD_ART.images,
  ...DOM_CHOICE_CARD_ART.sheets,
  ...DOM_STYLE_ART.filter(([, key]) => key !== "fx-tap").map(([, key]) => key),
  ...DOM_DISABLED_ART_KEYS,
  ...detailArtKeys(gameData),
  ...SETTINGS_ART_KEYS,
  ...logbookArtKeys(gameData),
  ...END_ART_KEYS,
  ...keysOf(gameData.shopGear).map(gearSmallIconKey),
  "icon-bill",
  "icon-lock",
  "ui-afford",
  "ui-cork",
  "ui-denim",
  "ui-heart",
  "ui-hint",
  "ui-plaid",
  "ui-quip-tail-down",
  "ui-section",
  "ui-slot-sign",
  "ui-tile",
  "ui-zone-banner",
  ...celebrationArtKeys(gameData),
]);

// The sheets the HTML interface loads its art from, one per set of screens that first shows it,
// so a screen waits for few files and a first install downloads few. A build packs each sheet
// from its keys' own files (src/tools/atlas/domSheets.ts), each key's PNG whole at a rect of
// its own, and lists each key's frames in the sheet's JSON.
export const DOM_SHEETS = [
  "dom-cards",
  "dom-chrome",
  "dom-detail",
  "dom-home",
  "dom-menus",
  "dom-walk",
] as const;
export type DomSheet = (typeof DOM_SHEETS)[number];

// The folder under /art/ the sheets are in.
export const DOM_SHEET_DIR = "dom";

// Art every screen can show: the stylesheet's, the button skin's, the top bar's controls and
// bank well, the speech tails and the earned tick.
const CHROME_ART_KEYS = [
  ...DOM_STYLE_ART.map(([, key]) => key),
  ...DOM_BUTTON_SKIN.sheets,
  "icon-exit",
  "icon-help",
  "icon-menu",
  "icon-pause",
  "icon-sound",
  "ui-check",
  "ui-heart",
  "ui-hint-tail",
  "ui-home-cash-well-left",
  "ui-home-cash-well-mid",
  "ui-home-cash-well-right",
  "ui-quip-tail",
  "ui-quip-tail-down",
  ZONE_CELEBRATION_ART.tailUp,
];

// Each sheet's keys, by the first rule that takes a key, in this order: dom-chrome the art every
// screen can show; dom-cards the choice cards' art and the zone banner, the walk's art with a
// dimmed copy, so dom-walk needs none; dom-home the start screen's and the shop's, with every
// tile picture; dom-detail the detail cards' and the purchase confirm's; dom-menus the
// settings', the Logbook's, the badge cards' and the End screen's; and dom-walk the rest, the
// walk's HUD and moments.
function domSheetKeys(): ReadonlyMap<string, DomSheet> {
  const rules: readonly (readonly [DomSheet, readonly string[]])[] = [
    ["dom-chrome", CHROME_ART_KEYS],
    ["dom-cards", [...DOM_CHOICE_CARD_ART.images, ...DOM_CHOICE_CARD_ART.sheets, "ui-zone-banner"]],
    ["dom-home", [...DOM_DISABLED_ART_KEYS, ...SHOP_ART_KEYS, ...START_ART_KEYS]],
    ["dom-detail", detailArtKeys(gameData)],
    ["dom-menus", [...SETTINGS_ART_KEYS, ...logbookArtKeys(gameData), ...END_ART_KEYS]],
    ["dom-walk", [...DOM_ART_KEYS]],
  ];
  const sheets = new Map<string, DomSheet>();
  for (const [sheet, keys] of rules) {
    for (const key of keys) {
      if (DOM_ART_KEYS.has(key) && !sheets.has(key)) {
        sheets.set(key, sheet);
      }
    }
  }
  return sheets;
}

export const DOM_SHEET_KEYS: ReadonlyMap<string, DomSheet> = domSheetKeys();

// The copies of a sheet's art the HTML interface can draw in place of its own, each a sheet of
// its own with the same rects, by the suffix a copy's key adds to its key's: a disabled tile's
// grey, a disabled choice card's neutral grey, and the retained dimmed copies of each. Longest
// first, so a key's suffix is read whole.
export const DOM_COPY_SUFFIXES = [
  "-disabled-dim",
  "-grey-dim",
  "-disabled",
  "-grey",
  "-dim",
] as const;
export type DomCopySuffix = (typeof DOM_COPY_SUFFIXES)[number];

// The sheet and copy a key's art is drawn from: its own key's sheet, or, for a copy's key, its
// key's sheet's copy. Throws on a key the HTML interface does not draw.
export function domSheetOf(key: string): {
  copy: DomCopySuffix | "";
  key: string;
  sheet: DomSheet;
} {
  const own = DOM_SHEET_KEYS.get(key);
  if (own !== undefined) {
    return { copy: "", key, sheet: own };
  }
  for (const copy of DOM_COPY_SUFFIXES) {
    const base = key.endsWith(copy) ? key.slice(0, -copy.length) : undefined;
    const sheet = base === undefined ? undefined : DOM_SHEET_KEYS.get(base);
    if (base !== undefined && sheet !== undefined) {
      return { copy, key: base, sheet };
    }
  }
  throw new Error(`${key} is no art the HTML interface draws`);
}

// A sheet's image under /art/, or a copy's, as a lossless WebP.
export function domSheetImagePath(sheet: DomSheet, copy: DomCopySuffix | "" = ""): string {
  return `${DOM_SHEET_DIR}/${sheet}${copy}.webp`;
}

// A sheet's frames under /art/.
export function domSheetJsonPath(sheet: DomSheet): string {
  return `${DOM_SHEET_DIR}/${sheet}.json`;
}

// The URL a DOM art file's logical path (domArtPath) loads from, through artUrl: a key's PNG, or
// its copy's, its sheet's image or that copy's; a key's frames its sheet's JSON with the key as
// the fragment, which loadSheet (src/ui/dom/sheetFrames.ts) reads the key's frames by.
export function domArtFileUrl(artUrl: (path: string) => string, path: string): string {
  const match = /^(?:images|sprites)\/(.+)\.(json|png)$/.exec(path);
  if (match === null) {
    throw new Error(`${path} is no DOM art file`);
  }
  const [, name, ext] = match as unknown as [string, string, "json" | "png"];
  const { copy, key, sheet } = domSheetOf(name);
  if (ext === "png") {
    return artUrl(domSheetImagePath(sheet, copy));
  }
  if (copy !== "") {
    throw new Error(`${path}: a copy keeps its key's frames`);
  }
  return `${artUrl(domSheetJsonPath(sheet))}#${encodeURIComponent(key)}`;
}
