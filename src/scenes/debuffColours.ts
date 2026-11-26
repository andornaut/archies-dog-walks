import type { DebuffId } from "../data/ids.ts";
import { PALETTE } from "../ui/index.ts";

// Each native debuff bar uses the authored face, shade, fill and name colours.
// The name holds 4.5:1 on the face.
export const DEBUFF_COLOURS: Readonly<
  Record<DebuffId, { face: number; fill: number; name: number; shade: number }>
> = {
  muddy: { face: PALETTE.brown, fill: PALETTE.tan, name: PALETTE.ink, shade: PALETTE.darkBrown },
  spotlight: { face: PALETTE.blue, fill: PALETTE.yellow, name: PALETTE.white, shade: PALETTE.navy },
  stinky: { face: PALETTE.mauve, fill: PALETTE.pink, name: PALETTE.white, shade: PALETTE.purple },
  zoomies: { face: PALETTE.green, fill: PALETTE.yellow, name: PALETTE.ink, shade: PALETTE.forest },
};
