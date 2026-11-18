import { isOutside } from "@andornaut/game-kit/runtime/input/outsideTap";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import {
  homeBackAction,
  homeBarAction,
  homeBarButtonAt,
  overlayRegion,
  regionOutside,
} from "./homeBar.ts";
import { HOME_LAYOUT, homeBarButtons } from "./homeLayout.ts";

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

it("places home overlays in the safe region under the shared top section", () => {
  const dim = overlayRegion("home");
  expect(containsPoint(dim, 0, HOME_LAYOUT.topBar.height - 1)).toBe(false);
  expect(containsPoint(dim, 0, HOME_LAYOUT.topBar.height)).toBe(true);
  expect(containsPoint(dim, SCREEN_LAYOUT.screen.width - 1, SCREEN_LAYOUT.screen.height - 1)).toBe(
    true,
  );
  expect(overlayRegion("walk")).toEqual(SCREEN_LAYOUT.walkView);
});

it("keeps a nonmodal page's live bar controls out of its outside dismissal", () => {
  for (const [id, { hit }] of homeBarButtons(true)) {
    const p = centre(hit);
    expect(homeBarButtonAt(true, p.x, p.y)).toBe(id);
    expect(isOutside(regionOutside(true, []), p)).toBe(false);
    expect(homeBarButtonAt(true, hit.x, hit.y + hit.height)).toBeUndefined();
  }
  const bank = { x: HOME_LAYOUT.topBar.well.x, y: HOME_LAYOUT.topBar.mid };
  expect(homeBarButtonAt(true, bank.x, bank.y)).toBeUndefined();
  expect(isOutside(regionOutside(true, []), bank)).toBe(true);
});

it.each([
  ["exit", "exit"],
  ["menu", "openMenu"],
  ["mute", "mute"],
] as const)("a live %s button does %s", (button, action) => {
  expect(homeBarAction(button)).toBe(action);
});

describe("homeBackAction", () => {
  it.each([
    [true, true, "closeDetail"],
    [false, true, "closeDetail"],
    [true, false, "askQuit"],
    [false, false, "none"],
  ] as const)(
    "with Exit %s and a detail card open %s, back does %s",
    (exit, detailOpen, action) => {
      expect(homeBackAction(exit, detailOpen)).toBe(action);
    },
  );
});

it("compacts an unavailable Exit and keeps shown controls outside overlay dismissal", () => {
  expect(
    homeBarButtons(true).map(([id, control]) => [
      id,
      control.hit.x,
      control.face.x,
      control.face.y,
    ]),
  ).toEqual([
    ["mute", 216, 230, 9],
    ["menu", 264, 278, 9],
    ["exit", 312, 326, 9],
  ]);
  expect(homeBarButtons(false).map(([id, control]) => [id, control.hit.x])).toEqual([
    ["mute", 264],
    ["menu", 312],
  ]);
  const removedColumn = { x: 240, y: 20 };
  expect(homeBarButtonAt(false, removedColumn.x, removedColumn.y)).toBeUndefined();
  expect(isOutside(regionOutside(false, []), removedColumn)).toBe(true);
  expect(isOutside(regionOutside(true, []), removedColumn)).toBe(false);
});
