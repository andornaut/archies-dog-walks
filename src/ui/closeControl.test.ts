import { describe, expect, it } from "vitest";

import { MIN_PRESS } from "../data/layout.ts";
import { inside } from "../testing/rects.ts";
import { closeControl, closeFace, pageCloseControl } from "./closeControl.ts";

const card = { height: 120, width: 200, x: 24, y: 140 };
const screen = { height: 640, width: 360, x: 0, y: 0 };

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

  it.each([
    ["a page", screen, pageCloseControl(screen)],
    ["a page with its face 9 down", screen, pageCloseControl(screen, 9)],
  ])(
    "sits its face and its MIN_PRESS square target in %s's top-right corner",
    (_, frame, control) => {
      expect(control.hit).toMatchObject({ height: MIN_PRESS, width: MIN_PRESS, y: frame.y });
      expect(control.hit.x + control.hit.width).toBe(frame.x + frame.width);
      expect(inside(closeFace(control), control.hit)).toBe(true);
      expect(inside(control.hit, frame)).toBe(true);
    },
  );
});
