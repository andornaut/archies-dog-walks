import { clampIndex } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";

import { gameData } from "../data/index.ts";
import type { SaveDocument } from "../save/index.ts";
import { SHOP_TABS, type ShopRow, shopRowLook, type ShopTab } from "./shop.ts";
import { shopTabRects } from "./shopLayout.ts";
import type { ShopPlacedRow } from "./shopTextLayout.ts";

export type ShopTarget = { id: string; kind: "row" } | { kind: "tab"; tab: ShopTab };

const TAB_RECTS: readonly Rect[] = shopTabRects(SHOP_TABS.length);

// Hit the tabs before the list, and keep the message plate above every row.
export function shopTargetAt(
  layout: {
    readonly clip: Rect;
    readonly messagePlate: Rect | null;
    readonly rows: readonly ShopPlacedRow[];
    readonly scrollY: number;
  },
  { x, y }: Point,
): ShopTarget | undefined {
  const tab = TAB_RECTS.findIndex((rect) => containsPoint(rect, x, y));
  const tabId = SHOP_TABS[tab];
  if (tabId !== undefined) {
    return { kind: "tab", tab: tabId };
  }
  // The message's plate lies over the rows; only the list area's part of a row is pressed.
  if (layout.messagePlate !== null && containsPoint(layout.messagePlate, x, y)) {
    return undefined;
  }
  if (!containsPoint(layout.clip, x, y)) {
    return undefined;
  }
  const listY = y + layout.scrollY;
  const hit = layout.rows.find(({ rect }) => containsPoint(rect, x, listY));
  return hit === undefined ? undefined : { id: hit.row.id, kind: "row" };
}

export function shopTabForArrow(tab: ShopTab, direction: "left" | "right"): ShopTab | undefined {
  const index = SHOP_TABS.indexOf(tab) + (direction === "left" ? -1 : 1);
  return SHOP_TABS[clampIndex(SHOP_TABS.length, index)];
}

export function shopFocusForArrow(
  save: SaveDocument,
  rows: readonly ShopRow[],
  focusId: string | null,
  direction: "up" | "down",
): string | null {
  const ids = rows
    .filter((row) => shopRowLook(gameData, save.owned, save.bankCents, row) !== "short")
    .map(({ id }) => id);
  const at = focusId === null ? -1 : ids.indexOf(focusId);
  const next = clampIndex(ids.length, at + (direction === "up" ? -1 : 1));
  return ids[next] ?? focusId;
}
