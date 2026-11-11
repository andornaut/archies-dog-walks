import { domArtPath } from "../assets/domArt.ts";
import { remapToGrey } from "../assets/greyRamp.ts";
import { NEUTRAL_RAMP } from "./palette.ts";
import { GREYED } from "./selection.ts";

// The pictures a disabled tile draws in grey (uiKit's tileTextureKey and addTileSprite): each
// dog's and walker's face, gear item and walker perk icon, and the dog slot's icon.
const TILE_ART_PREFIXES = ["face-dog-", "face-walker-", "icon-perk-", "item-"];
const TILE_ART_KEYS: ReadonlySet<string> = new Set(["icon-dog-slot"]);

// Whether a disabled tile can draw the key's art in grey. A build packs each such key's grey
// copy on the atlas page beside its art, under disabledArtKey.
export function greysOnTile(key: string): boolean {
  return TILE_ART_KEYS.has(key) || TILE_ART_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// The texture key of a key's grey copy for a disabled tile.
export function disabledArtKey(key: string): string {
  return `${key}-disabled`;
}

// The path under /art/ of a key's grey copy's PNG as a file of its own, an image's or a sprite
// sheet's, whose frames are its key's (domArtPath(kind, key, "json")), as the HTML interface draws
// it (DOM_DISABLED_ART_KEYS).
export function disabledArtPath(kind: "image" | "sheet", key: string): string {
  return domArtPath(kind, disabledArtKey(key), "png");
}

// RGBA pixels remapped in place to a disabled tile's grey: each colour moved to the colour of
// NEUTRAL_RAMP nearest its brightness, then GREYED.copyDarker steps down the ramp, alpha kept.
export function greyForDisabledTile(pixels: Uint8ClampedArray): void {
  remapToGrey(NEUTRAL_RAMP, GREYED.copyDarker, pixels);
}
