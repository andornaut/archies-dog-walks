import { fillLine } from "@andornaut/game-kit/runtime/lines";

import { HOME_TEXT_FIELDS } from "../content/index.ts";
import type { GameData } from "../data/index.ts";
import { dollarText } from "../presentation/index.ts";
import type { SaveDocument } from "../save/index.ts";
import { type DetailCard, dogDetail, gearDetail } from "./details/detail.ts";
import type { HomeLoadout, Purchase } from "./home.ts";
import { type PendingPurchase, requestPurchase } from "./purchaseConfirm.ts";
import { slotRows } from "./shop.ts";

export interface ItemModal {
  readonly card: DetailCard;
  readonly pending?: PendingPurchase;
  readonly purchase?: { readonly buy: string; readonly cancel: string };
  readonly reason?: "cantAfford" | "notForSale";
  readonly statusLines: readonly { readonly kind: "price" | "status"; readonly text: string }[];
}

// Every item entry uses one live eligibility decision and the same information and actions.
export function itemModal(
  data: GameData,
  save: SaveDocument,
  loadout: Pick<HomeLoadout, "gear">,
  purchase: Purchase,
): ItemModal {
  const slot =
    purchase.kind === "dogSlot"
      ? slotRows(data, save.owned).find(
          (row) => row.purchase.kind === "dogSlot" && row.purchase.slot === purchase.slot,
        )
      : undefined;
  let card: DetailCard;
  if (purchase.kind === "dog") {
    card = dogDetail(data, save.owned, save.bankCents, purchase.dog);
  } else if (purchase.kind === "gear") {
    card = gearDetail(data, save.owned, save.bankCents, loadout, purchase.gear);
  } else {
    if (slot === undefined) {
      throw new RangeError("Unknown dog slot");
    }
    card = {
      lines: [slot.line],
      locked: false,
      status:
        slot.price === null
          ? data.homeText.shop.owned
          : fillLine(HOME_TEXT_FIELDS.detail, data.homeText.detail, "priceBuy", {
              price: dollarText(slot.price),
            }),
      subtitle: "",
      title: slot.name,
    };
  }
  const request = requestPurchase(data, save, card.title, purchase);
  if (request.kind === "confirm") {
    const { confirmBuy: buy, confirmCancel: cancel } = data.homeText.shop;
    return {
      card,
      pending: request.pending,
      purchase: { buy, cancel },
      statusLines: [{ kind: "price", text: card.status }],
    };
  }
  if (request.reason === "cantAfford") {
    return {
      card: { ...card, locked: true },
      reason: request.reason,
      statusLines: [
        { kind: "price", text: card.status },
        { kind: "status", text: data.homeText.detail.saveUp },
      ],
    };
  }
  return { card, reason: request.reason, statusLines: [{ kind: "status", text: card.status }] };
}
