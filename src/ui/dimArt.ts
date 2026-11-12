import { remapRgb } from "@andornaut/game-kit/rgba";
import { modalDimmer } from "@andornaut/game-kit/view/modalDim";

import { domArtPath } from "../assets/domArt.ts";
import { ONE_STEP_DARKER } from "../assets/housePalette.ts";

// The modal dim's palette remap, as the canvas dims the frozen view under an overlay
// (addRampDim in src/ui/phaser/rampDim.ts): each colour down its ramp, never blended with black.
export const dimColour: (colour: number) => number = modalDimmer(ONE_STEP_DARKER);

// The key of a key's dimmed copy, which the HTML interface draws under the pause menu
// (DOM_DIM_ART_KEYS).
export function dimArtKey(key: string): string {
  return `${key}-dim`;
}

// The path under /art/ of a key's dimmed copy's PNG as a file of its own, an image's or a sprite
// sheet's, whose frames are its key's (domArtPath(kind, key, "json")).
export function dimArtPath(kind: "image" | "sheet", key: string): string {
  return domArtPath(kind, dimArtKey(key), "png");
}

// RGBA pixels remapped in place as the modal dim remaps the canvas, alpha kept.
export function dimForModal(pixels: Uint8ClampedArray): void {
  remapRgb(dimColour, pixels);
}
