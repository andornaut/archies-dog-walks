import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { homeBackAction, homeBarAction, homeBarButtonAt, overlayRegion } from "./homeBar.ts";
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

it("finds each live bar control at its own press area only", () => {
  for (const [id, { hit }] of homeBarButtons(true)) {
    const p = centre(hit);
    expect(homeBarButtonAt(true, p.x, p.y)).toBe(id);
    expect(homeBarButtonAt(true, hit.x, hit.y + hit.height)).toBeUndefined();
  }
  const bank = { x: HOME_LAYOUT.topBar.well.x, y: HOME_LAYOUT.topBar.mid };
  expect(homeBarButtonAt(true, bank.x, bank.y)).toBeUndefined();
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

it("compacts an unavailable Exit", () => {
  expect(
    homeBarButtons(true).map(([id, control]) => [
      id,
      control.hit.x,
      control.face.x,
      control.face.y,
    ]),
  ).toEqual([
    ["mute", 216, 230, 8],
    ["menu", 264, 278, 8],
    ["exit", 312, 326, 8],
  ]);
  expect(homeBarButtons(false).map(([id, control]) => [id, control.hit.x])).toEqual([
    ["mute", 264],
    ["menu", 312],
  ]);
  const removedColumn = { x: 240, y: 20 };
  expect(homeBarButtonAt(false, removedColumn.x, removedColumn.y)).toBeUndefined();
  expect(homeBarButtonAt(true, removedColumn.x, removedColumn.y)).toBe("mute");
});
