import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";

import { CHARM } from "../data/index.ts";
import { PALETTE } from "../ui/index.ts";

// A lit charm's ring: CHARM.ring amber pixels just outside its well on the walk bar, or its plate
// under a card option, drawn inside the returned rect.
export function charmRing(well: Rect): { colour: number; rect: Rect; width: number } {
  return { colour: PALETTE.amber, rect: insetRect(-CHARM.ring, well), width: CHARM.ring };
}
