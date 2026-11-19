import { remapRgb } from "@andornaut/game-kit/runtime/rgba";
import { MODAL_DIM } from "@andornaut/game-kit/runtime/view/modalDim";

export const MODAL_DARKNESS = MODAL_DIM.fallbackAlpha;
export const MODAL_BRIGHTNESS = 1 - MODAL_DARKNESS;

// Retained build copies darken each original channel uniformly and keep alpha unchanged.
export function dimColour(colour: number): number {
  const channel = (shift: number) => Math.round(((colour >>> shift) & 0xff) * MODAL_BRIGHTNESS);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Retained build-copy pixels use the same neutral-black darkness, with alpha kept.
export function dimForModal(pixels: Uint8ClampedArray): void {
  remapRgb(dimColour, pixels);
}
