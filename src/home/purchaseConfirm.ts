import type { GameData } from "../data/types.ts";
import type { SaveDocument } from "../save/schema.ts";
import { type Cents, cents } from "../units.ts";
import { buy, type BuyResult, isAffordable, type Purchase, purchasePrice } from "./home.ts";

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "tuning">;

// Every purchase asks first: a tap on something the bank covers opens a confirm, and only its
// Buy answer takes the money. requestPurchase opens it, answerPurchase closes it, and
// answerPurchase is the one caller of buy.

// A purchase asked for and not yet answered: what it is, its price, and the bank it would
// leave.
export interface PendingPurchase {
  readonly bankAfter: Cents;
  readonly name: string;
  readonly price: Cents;
  readonly purchase: Purchase;
}

export type ConfirmChoice = "buy" | "cancel";

type PurchaseRequest =
  | { readonly kind: "confirm"; readonly pending: PendingPurchase }
  | { readonly kind: "refused"; readonly reason: "cantAfford" | "notForSale" };

// A tap on something for sale: a confirm while the bank covers it, else refused with why. A
// refused request never opens a confirm.
export function requestPurchase(
  data: ShopData,
  save: SaveDocument,
  name: string,
  purchase: Purchase,
): PurchaseRequest {
  const cost = purchasePrice(data, save.owned, purchase);
  if (cost === null) {
    return { kind: "refused", reason: "notForSale" };
  }
  if (!isAffordable(data, save.owned, save.bankCents, purchase)) {
    return { kind: "refused", reason: "cantAfford" };
  }
  return {
    kind: "confirm",
    pending: { bankAfter: cents(save.bankCents - cost), name, price: cost, purchase },
  };
}

// The confirm answered. Buy buys from the save as it is now, so a bank or ownership that
// changed while the confirm was open refuses it; cancel buys nothing.
export function answerPurchase(
  data: ShopData,
  save: SaveDocument,
  pending: PendingPurchase,
  choice: ConfirmChoice,
): BuyResult | { readonly kind: "cancelled" } {
  return choice === "buy" ? buy(data, pending.purchase, save) : { kind: "cancelled" };
}
