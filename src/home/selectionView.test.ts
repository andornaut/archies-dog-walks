import { describe, expect, it } from "vitest";

import { dogFaceKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { PLATE_PAD } from "../data/layout.ts";
import { fontFileMetrics } from "../testing/fontInk.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { cents } from "../units.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";
import { type HomeSelectionSnapshot, homeSelectionViews } from "./selectionView.ts";
const BODY = fontFileMetrics("font-body");
const RECT = { height: 64, width: 92, x: 12, y: 240 };
const snapshot = (save = newPlayerSave): HomeSelectionSnapshot => ({
  dogs: [{ feedbackId: "dog:kilo", hit: RECT, id: "kilo", rect: RECT }],
  gear: [],
  loadout: { dogs: [], gear: null },
  save,
  walkers: [],
});
describe("native home selections", () => {
  it("keeps a locked dog's art grey and its authored price visible while the bank is short", () => {
    const [tile] = homeSelectionViews(gameData, BODY, false, snapshot());
    expect(tile?.tile.kind).toBe("locked");
    expect(tile?.art).toBe("grey");
    expect(tile?.badge?.kind).toBe("lock");
    expect(tile?.name?.text).toBe(gameData.dogs.kilo.name);
    // The plate's bottom edge on the portrait box's bottom row.
    const { face } = HOME_LAYOUT.dogTile;
    expect(tile?.plate).toMatchObject({
      capTop: RECT.y + face.dy + face.size + 1 - PLATE_PAD - BODY.capHeight * 2,
    });
    expect(tile?.pictures[0]).toMatchObject({
      key: dogFaceKey(gameData, "kilo"),
      moving: false,
      tag: "neutral",
    });
  });
  it("shows a purchased dog without a price, keeping its selected state and owned name baseline", () => {
    const save = {
      ...newPlayerSave,
      owned: { ...newPlayerSave.owned, dogs: [...newPlayerSave.owned.dogs, "kilo" as const] },
    };
    const [tile] = homeSelectionViews(gameData, BODY, false, {
      ...snapshot(save),
      loadout: { dogs: ["kilo"], gear: null },
    });
    expect(tile?.tile.kind).toBe("picked");
    expect(tile?.art).toBe("colour");
    expect(tile?.plate).toBeUndefined();
    expect(tile?.badge).toBeUndefined();
    expect(tile?.name).toMatchObject({ centreIn: { y: RECT.y + HOME_LAYOUT.dogTile.face.dy - 1 } });
    expect(tile?.pictures[0]).toMatchObject({ moving: true, tag: "happy" });
    expect(homeSelectionViews(gameData, BODY, true, snapshot(save))[0]?.pictures[0]?.moving).toBe(
      false,
    );
  });
  it("keeps affordable unowned art in colour without treating the dog as purchased", () => {
    const [tile] = homeSelectionViews(
      gameData,
      BODY,
      false,
      snapshot({ ...newPlayerSave, bankCents: cents(999999) }),
    );
    expect(tile?.tile.kind).toBe("locked");
    expect(tile?.art).toBe("colour");
    expect(tile?.badge?.kind).toBe("bill");
    expect(tile?.plate?.kind).toBe("buy");
    expect(tile?.fill.rect).toEqual({
      height: HOME_LAYOUT.dogTile.face.size + 2,
      width: HOME_LAYOUT.dogTile.face.size + 2,
      x: RECT.x + HOME_LAYOUT.dogTile.face.dx - 1,
      y: RECT.y + HOME_LAYOUT.dogTile.face.dy - 1,
    });
  });
});
