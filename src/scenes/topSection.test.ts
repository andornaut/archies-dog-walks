import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { HOME_BAR_BUTTONS, homeBarButtons } from "../home/homeLayout.ts";
import { WALK_BAR_BUTTONS, walkBarLayout } from "../hud/walkHud.ts";
import { topSectionButtonBacking, topSectionCurrency, topSectionLayout } from "../ui/topSection.ts";

// These are the same owners under their overlays, not separate overlay layouts.
describe("the shared top section", () => {
  it.each([
    ["home/shop", HOME_BAR_BUTTONS],
    ["walk/pause", WALK_BAR_BUTTONS],
  ] as const)("keeps %s faces, pitch and targets invariant", (_, visible) => {
    const plain = topSectionLayout(visible);
    const overlay = topSectionLayout([...visible].reverse());
    expect(overlay).toEqual(plain);
    for (const [, control] of plain.controls) {
      expect(control.hit).toMatchObject({ height: 48, width: 48, y: 0 });
    }
    expect(plain.controls.map(([, control]) => control.face.y)).toEqual(
      visible.map(() => plain.controls[0]?.[1].face.y),
    );
    expect(plain.bar).toEqual({ height: 40, width: 360, x: 0, y: 0 });
  });
  it("removes hidden controls from flow and preserves canonical order regardless of caller order", () => {
    expect(topSectionLayout(["pause", "mute"]).controls.map(([id]) => id)).toEqual([
      "mute",
      "pause",
    ]);
    expect(() => topSectionLayout(["menu", "pause"])).toThrow("share one");
    const full = topSectionLayout(HOME_BAR_BUTTONS);
    const hidden = topSectionLayout(HOME_BAR_BUTTONS.filter((id) => id !== "mute"));
    expect(hidden.controls.map(([id]) => id)).toEqual(["menu"]);
    expect(hidden.controls[0]?.[1]).toEqual(full.controls.find(([id]) => id === "menu")?.[1]);
  });
  it("feeds home and walk input adapters from the same section geometry, including effect holds", () => {
    expect(homeBarButtons()).toEqual(topSectionLayout(HOME_BAR_BUTTONS).controls);
    const layout = walkBarLayout(SCREEN_LAYOUT.topBar);
    const shared = topSectionLayout(WALK_BAR_BUTTONS, {
      currency: true,
      effects: layout.effectWells.length,
    });
    expect(layout.buttons).toEqual(Object.fromEntries(shared.controls));
    expect(layout.effectWells).toEqual(shared.effectWells);
    expect(layout.effectHolds).toEqual(shared.effectHolds);
  });
  it("keeps currency and control backings fixed while centring effects within their reserved region", () => {
    const max = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: 6 });
    const few = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: 2 });
    expect(max.controls.map(([, control]) => control)).toEqual([
      { face: { x: 278, y: 9 }, hit: { height: 48, width: 48, x: 264, y: 0 } },
      { face: { x: 326, y: 9 }, hit: { height: 48, width: 48, x: 312, y: 0 } },
    ]);
    expect(max.currency).toEqual({ height: 29, width: 97, x: 5, y: 5 });
    expect(max.effectWells.map(({ x }) => x)).toEqual([105, 131, 157, 183, 209, 235]);
    expect(few.effectWells).toEqual([
      { height: 26, width: 26, x: 157, y: 6 },
      { height: 26, width: 26, x: 183, y: 6 },
    ]);
    expect(few.effectHolds).toEqual([
      { height: 40, width: 26, x: 157, y: 0 },
      { height: 40, width: 26, x: 183, y: 0 },
    ]);
    expect(max.controls.map(([, control]) => topSectionButtonBacking(control.face))).toEqual([
      { height: 29, width: 29, x: 273.5, y: 5 },
      { height: 29, width: 29, x: 321.5, y: 5 },
    ]);
    const cash = topSectionCurrency(max, 66);
    expect(cash).toMatchObject({ left: 20, room: 84, scale: 3 });
    const bank = topSectionCurrency(topSectionLayout(HOME_BAR_BUTTONS, { currency: true }), 84);
    expect(bank.well.width).toBe(97);
    expect(bank.left).toBe(11);
    expect(bank.room).toBe(84);
  });
});
