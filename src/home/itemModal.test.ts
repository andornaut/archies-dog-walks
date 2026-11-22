import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { cents } from "../units.ts";
import { itemModal } from "./itemModal.ts";
import { answerPurchase, confirmLines } from "./purchaseConfirm.ts";
import { dogRows, gearRows, slotRows } from "./shop.ts";

const items = [dogRows, gearRows, slotRows].map((rows) =>
  rows(gameData, newPlayerSave.owned).find((row) => row.price !== null && row.price > 0)!,
);

it.each(items)(
  "offers an explicit purchase for an affordable $purchase.kind without equipping it",
  (row) => {
    const save = { ...newPlayerSave, bankCents: cents(row.price! + 123) };
    const shown = itemModal(gameData, save, save.lastLoadout, row.purchase);
    const pending = shown.pending!;
    const labels = confirmLines(gameData, pending);
    expect(shown.purchase).toEqual({ buy: labels.buy, cancel: labels.cancel, left: labels.left });
    expect(shown.card.title).toBe(row.name);
    if (row.purchase.kind === "dog") {
      expect(shown.card.owner?.dog).toBe(row.purchase.dog);
    }
    if (row.purchase.kind === "dogSlot") {
      expect(shown.card.owner).toBeUndefined();
    }
    const result = answerPurchase(gameData, save, pending, "buy");
    expect(result.kind).toBe("bought");
    if (result.kind !== "bought") {
      throw new Error("Expected the affordable item to be bought");
    }
    expect(result.save.bankCents).toBe(cents(123));
    expect(result.save.lastLoadout).toEqual(save.lastLoadout);
    expect(
      itemModal(gameData, result.save, result.save.lastLoadout, row.purchase).purchase,
    ).toBeUndefined();
    expect(answerPurchase(gameData, result.save, pending, "buy").kind).not.toBe("bought");
  },
);

it.each(items)(
  "keeps unaffordable $purchase.kind information with separate price and encouragement",
  (row) => {
    const save = { ...newPlayerSave, bankCents: cents(0) };
    const shown = itemModal(gameData, save, save.lastLoadout, row.purchase);
    expect(shown.purchase).toBeUndefined();
    expect(shown.pending).toBeUndefined();
    expect(shown.card.locked).toBe(true);
    expect(shown.statusLines.map((line) => line.kind)).toEqual(["price", "status"]);
    expect(shown.statusLines.map((line) => line.text)).toEqual([
      shown.card.status,
      gameData.homeText.detail.saveUp,
    ]);
  },
);

it("rechecks the current bank before executing an already displayed Buy action", () => {
  const row = items[0]!;
  const save = { ...newPlayerSave, bankCents: cents(row.price!) };
  const shown = itemModal(gameData, save, save.lastLoadout, row.purchase);
  expect(
    answerPurchase(gameData, { ...save, bankCents: cents(0) }, shown.pending!, "buy").kind,
  ).not.toBe("bought");
  expect(answerPurchase(gameData, save, shown.pending!, "cancel").kind).toBe("cancelled");
});
