import { describe, expect, it } from "vitest";

import { domScale } from "../../ui/domScale.ts";
import { scrolledBy } from "./logbook.ts";

// 393 CSS px wide over the 360-wide game at DPR 3: a game pixel is 3.275 device pixels and an
// art pixel 3.
const SCALE = domScale(3, { height: 611, width: 393, x: 0, y: 0 });

describe("the HTML Logbook's scroll", () => {
  it.each([
    ["moving: the canvas's whole game pixels", false, 9.6, 33],
    ["settled: whole art pixels", true, 9.6, 30],
    ["settled on a whole game pixel", true, 10, 33],
  ])("moves the content up whole device pixels, %s", (_case, settled, y, by) => {
    expect(scrolledBy(SCALE, { settled, y })).toBe(by);
  });
});
