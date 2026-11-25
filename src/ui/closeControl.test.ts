import { describe, expect, it } from "vitest";

import { MIN_PRESS } from "../data/layout.ts";
import { inside } from "../testing/rects.ts";
import { closeControl, closeFace } from "./closeControl.ts";

const card = { height: 120, width: 200, x: 24, y: 140 };

describe("closeControl", () => {
  it("places a modal face 6px inside its top-right corner and keeps its whole target inside", () => {
    const control = closeControl(card);
    expect(closeFace(control)).toEqual({
      height: 20,
      width: 20,
      x: card.x + card.width - 6 - 20,
      y: card.y + 6,
    });
    const side = MIN_PRESS;
    expect(control.hit).toEqual({
      height: side,
      width: side,
      x: card.x + card.width - side,
      y: card.y,
    });
    expect(inside(closeFace(control), control.hit)).toBe(true);
    expect(inside(control.hit, card)).toBe(true);
  });
});
