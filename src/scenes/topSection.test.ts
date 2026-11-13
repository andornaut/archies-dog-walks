import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { HOME_BAR_BUTTONS, homeBarButtons } from "../home/homeLayout.ts";
import { WALK_BAR_BUTTONS, walkBarLayout } from "../hud/walkHud.ts";
import { TOP_SECTION_ORDER, topSectionLayout } from "../ui/topSection.ts";

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
    const all = topSectionLayout([...TOP_SECTION_ORDER].reverse());
    expect(all.controls.map(([id]) => id)).toEqual(TOP_SECTION_ORDER);
    const full = topSectionLayout(HOME_BAR_BUTTONS);
    const hidden = topSectionLayout(HOME_BAR_BUTTONS.filter((id) => id !== "mute"));
    expect(hidden.controls.map(([id]) => id)).toEqual(["logbook", "help", "settings", "exit"]);
    expect(hidden.controls.find(([id]) => id === "help")?.[1].face.x).toBe(
      (full.controls.find(([id]) => id === "help")?.[1].face.x ?? 0) + 48,
    );
    expect(hidden.controls.find(([id]) => id === "settings")?.[1]).toEqual(
      full.controls.find(([id]) => id === "settings")?.[1],
    );
  });
  it("feeds home and walk input adapters from the same section geometry, including effect holds", () => {
    expect(homeBarButtons(true)).toEqual(topSectionLayout(HOME_BAR_BUTTONS).controls);
    const layout = walkBarLayout(SCREEN_LAYOUT.topBar);
    const shared = topSectionLayout(WALK_BAR_BUTTONS, {
      currency: true,
      effects: layout.effectWells.length,
    });
    expect(layout.buttons).toEqual(Object.fromEntries(shared.controls));
    expect(layout.effectWells).toEqual(shared.effectWells);
    expect(layout.effectHolds).toEqual(shared.effectHolds);
  });
});
