import { isOutside } from "@andornaut/game-kit/input/outsideTap";
import { containsPoint, type Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { TOP_BAR_BUTTONS } from "../hud/topBar.ts";
import {
  homeBackAction,
  homeBarAction,
  homeBarButtonAt,
  overlayRegion,
  regionOutside,
} from "./homeBar.ts";
import { HOME_LAYOUT, homeBarButtons } from "./homeLayout.ts";

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

it("leaves only the shared top section outside the home overlay dim", () => {
  const dim = overlayRegion("home");
  expect(containsPoint(dim, 0, HOME_LAYOUT.topBar.height - 1)).toBe(false);
  expect(containsPoint(dim, 0, HOME_LAYOUT.topBar.height)).toBe(true);
  expect(containsPoint(dim, SCREEN_LAYOUT.screen.width - 1, SCREEN_LAYOUT.screen.height - 1)).toBe(
    true,
  );
  expect(overlayRegion("walk")).toEqual(SCREEN_LAYOUT.walkView);
});

it("preserves each bar control's hit area while outside dismissal keeps the surrounding screen", () => {
  for (const [id, { hit }] of homeBarButtons()) {
    const p = centre(hit);
    expect(homeBarButtonAt(p.x, p.y)).toBe(id);
    expect(isOutside(regionOutside("home", 0, []), p)).toBe(false);
    expect(homeBarButtonAt(hit.x, hit.y + hit.height)).toBeUndefined();
  }
  const bank = { x: HOME_LAYOUT.topBar.well.x, y: HOME_LAYOUT.topBar.mid };
  expect(homeBarButtonAt(bank.x, bank.y)).toBeUndefined();
  expect(isOutside(regionOutside("home", 0, []), bank)).toBe(true);
  const belowPause = { x: centre(TOP_BAR_BUTTONS.pause.hit).x, y: SCREEN_LAYOUT.topBar.height };
  expect(isOutside(regionOutside("walk", 0, []), belowPause)).toBe(false);
  expect(isOutside(regionOutside("walk", 1, []), belowPause)).toBe(true);
});

it("keeps mute independent while the menu entry opens or closes its existing menu", () => {
  expect(homeBarAction({ menu: false }, "menu")).toBe("openMenu");
  expect(homeBarAction({ menu: true }, "menu")).toBe("close");
  for (const menu of [false, true]) {
    expect(homeBarAction({ menu }, "mute")).toBe("mute");
  }
});

describe("homeBackAction", () => {
  it.each([
    [true, "closeDetail"],
    [false, "askQuit"],
  ] as const)("with a detail card open %s, back does %s", (detailOpen, action) => {
    expect(homeBackAction(detailOpen)).toBe(action);
  });
});
