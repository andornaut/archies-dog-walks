import { describe, expect, it } from "vitest";

import { dogFaceKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { gameFont } from "../testing/fontInk.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { lineInk } from "../ui/lineInk.ts";
import { cents } from "../units.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";
import { type HomeSelectionSnapshot, homeSelectionViews } from "./selectionView.ts";
import { START_PICKER_MARK } from "./startPickerArt.ts";
const BODY = gameFont("font-body");
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
    const { name, priceGap } = HOME_LAYOUT.dogTile;
    const titleInk = lineInk(BODY, gameData.dogs.kilo.name);
    const priceInk = lineInk(BODY, tile!.plate!.text);
    expect(tile?.plate?.rect).toEqual({
      height: priceInk.bottom - priceInk.top + 2,
      width: priceInk.right - priceInk.left + 4,
      x: RECT.x + name.x,
      y: RECT.y + name.y + 1 + titleInk.bottom - titleInk.top + priceGap,
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
    expect(tile?.name).toMatchObject({
      align: "centre",
      rect: { y: RECT.y + HOME_LAYOUT.dogTile.name.y },
    });
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
    expect(tile?.badge).toEqual({
      kind: "bill",
      x: RECT.x + START_PICKER_MARK.x,
      y: RECT.y + START_PICKER_MARK.y,
    });
  });
});
