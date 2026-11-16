import { remapRgb } from "@andornaut/game-kit/runtime/rgba";
import { MODAL_DIM } from "@andornaut/game-kit/runtime/view/modalDim";

import { domArtPath } from "../assets/domArt.ts";

export const MODAL_DARKNESS = MODAL_DIM.fallbackAlpha;
export const MODAL_BRIGHTNESS = 1 - MODAL_DARKNESS;

// Retained build copies darken each original channel uniformly and keep alpha unchanged.
export function dimColour(colour: number): number {
  const channel = (shift: number) => Math.round(((colour >>> shift) & 0xff) * MODAL_BRIGHTNESS);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Retained generated copies keep their declared asset keys until their build contract retires.
// CLEANUP (added 2026-11-15): Remove dim-copy transforms after Art retires their manifest/build keys.
export function dimArtKey(key: string): string {
  return `${key}-dim`;
}

// The path under /art/ of a key's dimmed copy's PNG as a file of its own, an image's or a sprite
// sheet's, whose frames are its key's (domArtPath(kind, key, "json")).
export function dimArtPath(kind: "image" | "sheet", key: string): string {
  return domArtPath(kind, dimArtKey(key), "png");
}

// Retained build-copy pixels use the same neutral-black darkness, with alpha kept.
export function dimForModal(pixels: Uint8ClampedArray): void {
  remapRgb(dimColour, pixels);
}
