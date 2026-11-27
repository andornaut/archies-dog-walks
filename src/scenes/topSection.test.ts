import { describe, expect, it } from "vitest";

import { homeBarButtonAt } from "../home/homeBar.ts";
import { HOME_BAR_BUTTONS, homeBarButtons } from "../home/homeLayout.ts";
import { topBarButtonAt } from "../hud/topBar.ts";
import { WALK_BAR_BUTTONS, walkBarLayout } from "../hud/walkHud.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
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
    expect(hidden.controls.map(([id]) => id)).toEqual(["menu", "exit"]);
    expect(hidden.controls[0]?.[1]).toMatchObject({
      face: full.controls.find(([id]) => id === "menu")?.[1].face,
      hit: full.controls.find(([id]) => id === "menu")?.[1].hit,
    });
  });
  it("feeds home and walk input adapters from the same section geometry, including effect holds", () => {
    expect(homeBarButtons(true)).toEqual(topSectionLayout(HOME_BAR_BUTTONS).controls);
    const layout = walkBarLayout(SCREEN_LAYOUT.topBar);
    const shared = topSectionLayout(WALK_BAR_BUTTONS, {
      currency: true,
      effects: layout.effectWells.length,
    });
    expect(layout.buttons).toEqual(
      Object.fromEntries(shared.controls.map(([id, { face, hit }]) => [id, { face, hit }])),
    );
    expect(layout.effectWells).toEqual(shared.effectWells);
    expect(layout.effectHolds).toEqual(shared.effectHolds);
  });
  it("keeps currency and control backings fixed while centring effects within their reserved region", () => {
    const max = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: 6 });
    const few = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: 2 });
    expect(max.controls.map(([, control]) => control)).toEqual([
      {
        face: { x: 282, y: 8 },
        hit: { height: 48, width: 48, x: 268, y: 0 },
        owned: { height: 48, width: 46, x: 268, y: 0 },
      },
      {
        face: { x: 326, y: 8 },
        hit: { height: 48, width: 48, x: 312, y: 0 },
        owned: { height: 48, width: 46, x: 314, y: 0 },
      },
    ]);
    expect(max.currency).toEqual({ height: 29, width: 97, x: 5, y: 4 });
    expect(max.effectWells.map(({ x }) => x)).toEqual([105, 131, 157, 183, 209, 235]);
    expect(few.effectWells).toEqual([
      { height: 26, width: 26, x: 154, y: 5 },
      { height: 26, width: 26, x: 180, y: 5 },
    ]);
    expect(few.effectHolds).toEqual([
      { height: 40, width: 26, x: 154, y: 0 },
      { height: 40, width: 26, x: 180, y: 0 },
    ]);
    expect(max.controls.map(([, control]) => topSectionButtonBacking(control.face))).toEqual([
      { height: 29, width: 29, x: 277.5, y: 4 },
      { height: 29, width: 29, x: 321.5, y: 4 },
    ]);
    const cash = topSectionCurrency(max, 66);
    expect(cash).toMatchObject({ left: 20, room: 84, scale: 3 });
    const bank = topSectionCurrency(topSectionLayout(HOME_BAR_BUTTONS, { currency: true }), 84);
    expect(bank.well.width).toBe(97);
    expect(bank.left).toBe(11);
    expect(bank.room).toBe(84);
  });
});

// Faces the small-button gap apart, each press the full 48 square centred on its face, a press
// where two overlap going to the nearer face's centre and an exact midpoint to the earlier face.
describe("top bar presses", () => {
  const FACE = 20;
  it.each([
    {
      at: (x: number, y: number) => homeBarButtonAt(true, x, y),
      bar: "home with Exit",
      faces: [238, 282, 326],
      hits: [224, 268, 312],
      ids: ["mute", "menu", "exit"],
      shown: HOME_BAR_BUTTONS,
    },
    {
      at: (x: number, y: number) => homeBarButtonAt(false, x, y),
      bar: "home without Exit",
      faces: [282, 326],
      hits: [268, 312],
      ids: ["mute", "menu"],
      shown: ["mute", "menu"] as const,
    },
    {
      at: (x: number, y: number) => topBarButtonAt(0, x, y),
      bar: "walk",
      faces: [282, 326],
      hits: [268, 312],
      ids: ["mute", "pause"],
      shown: WALK_BAR_BUTTONS,
    },
  ])("routes the $bar bar's presses to the nearest face", ({ at, faces, hits, ids, shown }) => {
    const { controls } = topSectionLayout(shown);
    expect(controls.map(([id, { face, hit }]) => [id, face.x, hit.x])).toEqual(
      ids.map((id, i) => [id, faces[i], hits[i]]),
    );
    const y = 20;
    faces.forEach((x, i) => {
      for (const point of [x, x + FACE / 2, x + FACE - 1]) {
        expect(at(point, y), `${ids[i]} at ${point}`).toBe(ids[i]);
      }
      expect(at(hits[i]!, 0), `${ids[i]} hit's left`).toBe(i === 0 ? ids[0] : ids[i - 1]);
      expect(at(hits[i]! + 47, 47), `${ids[i]} hit's right`).toBe(
        i === faces.length - 1 ? ids[i] : ids[i + 1],
      );
    });
    expect(at(hits[0]! - 1, y)).toBeUndefined();
    expect(at(hits[0]!, 48)).toBeUndefined();
    for (let i = 1; i < faces.length; i += 1) {
      const mid = (faces[i - 1]! + faces[i]!) / 2 + FACE / 2;
      // The 4 overlapping columns, hits[i] to the earlier hit's right, split at the midpoint.
      expect(hits[i - 1]! + 48 - hits[i]!).toBe(4);
      expect([mid - 0.5, mid, mid + 0.5].map((x) => at(x, y))).toEqual([
        ids[i - 1],
        ids[i - 1],
        ids[i],
      ]);
      // The DOM buttons meet at the same column.
      const left = controls[i - 1]![1].owned;
      expect([left.x + left.width, controls[i]![1].owned.x]).toEqual([mid, mid]);
    }
  });
});
