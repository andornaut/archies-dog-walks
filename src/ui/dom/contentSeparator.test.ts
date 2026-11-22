import { expect, it } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { artPixel, domScale, frameRect, gridRect, gridX, gridY } from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { createContentSeparator, placeContentSeparator } from "./contentSeparator.ts";

it("keeps content rules one art pixel thick without changing their snapped anchors or widths", () => {
  const doc = new FakeDocument();
  const element = createContentSeparator(doc as unknown as Document);
  const origin = { x: 24, y: 80 };
  const rect = { height: 1, width: 264, x: 40, y: 137 };
  for (const [dpr, width] of [
    [1, 360],
    [3, 393],
    [2, 331.703125],
  ] as const) {
    const scale = domScale(dpr, { height: 560, width, x: 14.140625, y: 7.25 });
    for (const projection of ["art", "grid"] as const) {
      const box = (projection === "art" ? frameRect : gridRect)(scale, rect);
      placeContentSeparator(scale, { origin, projection }, element, rect);
      expect(element.style).toMatchObject({
        backgroundColor: `#${PALETTE.tan.toString(16).padStart(6, "0")}`,
        height: `${artPixel(scale)}px`,
        left: `${box.left - gridX(scale, origin.x)}px`,
        pointerEvents: "none",
        top: `${box.top - gridY(scale, origin.y)}px`,
        width: `${box.width}px`,
      });
    }
  }
});
