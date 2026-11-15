import { insetRect, type Rect, ringRects } from "@andornaut/game-kit/rect";

import { PALETTE } from "../ui/palette.ts";
import { SELECT_OUTSET } from "../ui/selection.ts";

export interface ShopFocusFill {
  readonly colour: number;
  readonly rect: Rect;
}

// Shop focus uses cyan independently of the gold ownership selection.
export function shopFocusView(rect: Rect): { outer: Rect; fills: readonly ShopFocusFill[] } {
  const outer = insetRect(-SELECT_OUTSET, rect);
  const fills: ShopFocusFill[] = [];
  for (const y of [outer.y, outer.y + outer.height - 1]) {
    fills.push({
      colour: PALETTE.ink,
      rect: { height: 1, width: outer.width - 2, x: outer.x + 1, y },
    });
  }
  for (const x of [outer.x, outer.x + outer.width - 1]) {
    fills.push({
      colour: PALETTE.ink,
      rect: { height: outer.height - 2, width: 1, x, y: outer.y + 1 },
    });
  }
  fills.push(
    ...ringRects(3, insetRect(1, outer)).map((rect) => ({ colour: PALETTE.cyan, rect })),
    ...ringRects(1, insetRect(4, outer)).map((rect) => ({ colour: PALETTE.ink, rect })),
  );
  return { fills, outer };
}
