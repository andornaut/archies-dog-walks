import { describe, expect, it } from "vitest";

import { deviceY, domScale } from "../../ui/domScale.ts";
import { scrollPlace } from "./logbook.ts";

// 393 CSS px wide over the 360-wide game at DPR 3: a game pixel is 3.275 device pixels and an
// art pixel 3.
const SCALE = domScale(3, { height: 611, width: 393, x: 0, y: 0 });

describe("the HTML Logbook's scroll", () => {
  it.each([
    ["moving: the canvas's whole game pixels", false, 9.6, 33],
    ["settled: whole art pixels", true, 9.6, 30],
    ["settled on a whole game pixel", true, 10, 33],
  ])("moves the content up whole device pixels, %s", (_case, settled, y, by) => {
    expect(scrollPlace(SCALE, { settled, y }).by).toBe(by);
  });

  // At 393 CSS px wide, the layer 44.3 CSS px down the page so its corner is off the device grid.
  it.each([1, 2, 3])(
    "keeps every part within half a device pixel of the canvas's place mid-scroll at DPR %d",
    (dpr) => {
      const scale = domScale(dpr, { height: 611, width: 393, x: 0, y: 44.3 });
      let worst = 0;
      for (let tenths = 0; tenths <= 3000; tenths += 7) {
        const scroll = { settled: false, y: tenths / 10 };
        const at = scrollPlace(scale, scroll);
        for (let row = 0; row <= 600; row += 3) {
          const canvasRow =
            (scale.origin.y + (row - Math.round(scroll.y)) * scale.unit) * scale.dpr;
          const htmlRow = Math.round(scale.origin.y * scale.dpr) - at.by + deviceY(at.scale, row);
          worst = Math.max(worst, Math.abs(htmlRow - canvasRow));
        }
      }
      // Half a device pixel, give or take floating point's error.
      expect(worst).toBeLessThanOrEqual(0.5 + 1e-9);
    },
  );
});
