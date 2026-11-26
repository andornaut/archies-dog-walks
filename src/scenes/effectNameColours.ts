import type { EffectNameKind } from "../presentation/index.ts";
import { PALETTE } from "../ui/index.ts";

type PaletteName = keyof typeof PALETTE;

// Each effect's name pill: a pale pill behind a dark name, so the pair reads the same on cream,
// ink or the walk bar, the name at 4.5:1 or better on its pill. A change a debuff zeroed, as
// Stinky's "+$0" tip, is drawn in that debuff's pill.
export const EFFECT_PILLS: Readonly<
  Record<EffectNameKind, { readonly name: PaletteName; readonly pill: PaletteName }>
> = {
  buff: { name: "dlake", pill: "foam" },
  muddy: { name: "walnut", pill: "tan" },
  spotlight: { name: "navy", pill: "yellow" },
  stinky: { name: "plum", pill: "pink" },
  zoomies: { name: "forest", pill: "lime" },
};

export function pillColours(kind: EffectNameKind): { name: number; pill: number } {
  const { name, pill } = EFFECT_PILLS[kind];
  return { name: PALETTE[name], pill: PALETTE[pill] };
}
