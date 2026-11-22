import { afterEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { itemModal } from "../home/itemModal.ts";
import type { PendingPurchase } from "../home/purchaseConfirm.ts";
import { dogRows } from "../home/shop.ts";
import type { SaveDocument } from "../save/schema.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { cents } from "../units.ts";
import * as profile from "./profileStore.ts";
import { ShopScene } from "./ShopScene.ts";
import { StartScene } from "./StartScene.ts";

vi.mock("phaser", () => ({ Core: { Events: {} }, Scene: class {}, Scenes: { Events: {} } }));
afterEach(() => vi.restoreAllMocks());

const start = StartScene.prototype as unknown as { buyDetail(pending: PendingPurchase): void };
const shop = ShopScene.prototype as unknown as {
  answer(choice: "buy"): void;
  bought(pending: PendingPurchase, save: SaveDocument): void;
};

function fixture(origin: "start" | "shop") {
  const row = dogRows(gameData, newPlayerSave.owned).find(
    (row) => row.price !== null && row.price > 0,
  )!;
  const document = { ...newPlayerSave, bankCents: cents(row.price! + 123) };
  const pending = itemModal(gameData, document, document.lastLoadout, row.purchase).pending!;
  const state = {
    bought: (pending: PendingPurchase, save: SaveDocument) =>
      shop.bought.call(state, pending, save),
    celebrate: vi.fn(),
    detail: row.purchase,
    document,
    game: { events: { emit: vi.fn() } },
    overlay: {},
    render: vi.fn(),
    save: () => state.document,
    shopClosed: vi.fn(),
  };
  const purchase = vi.spyOn(profile, "purchaseInProfile").mockImplementation((scene, change) => {
    const owner = scene as unknown as { document: SaveDocument };
    owner.document = change(owner.document);
    return Promise.resolve();
  });
  const buy = () =>
    origin === "start" ? start.buyDetail.call(state, pending) : shop.answer.call(state, "buy");
  return { buy, document, purchase, state };
}

it.each(["start", "shop"] as const)(
  "%s item Buy uses the profile purchase path once and preserves the loadout",
  (origin) => {
    const { buy, document, purchase, state } = fixture(origin);
    buy();
    expect(purchase).toHaveBeenCalledOnce();
    expect(state.document.bankCents).toBe(cents(123));
    expect(state.document.lastLoadout).toEqual(document.lastLoadout);
    expect(state.celebrate).toHaveBeenCalledOnce();
    buy();
    expect(purchase).toHaveBeenCalledOnce();
    expect(state.document.bankCents).toBe(cents(123));
  },
);

it.each(["start", "shop"] as const)(
  "%s item Buy refuses a bank change after the modal was shown",
  (origin) => {
    const { buy, purchase, state } = fixture(origin);
    state.document = { ...state.document, bankCents: cents(0) };
    const before = state.document;
    buy();
    expect(purchase).not.toHaveBeenCalled();
    expect(state.document).toBe(before);
    expect(state.celebrate).not.toHaveBeenCalled();
  },
);
