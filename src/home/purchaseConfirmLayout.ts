import { type FontMetrics, inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { closeControl } from "../ui/closeControl.ts";
import { helpCapDy } from "../ui/labelHelpGap.ts";
import { DISMISS_FOOTER_SPACE } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalActionWidth, modalFamilyWidth, modalRect } from "../ui/modal/layout.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { overlayRegion } from "./homeBar.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";

const CARD = HOME_LAYOUT.card;
const BUTTON_HEIGHT = BUTTON_SIZE.compact.height;
const MAX_WIDTH = modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "medium");
const LIMITS = { height: 0, width: MAX_WIDTH, x: 0, y: 0 };

// Fixed-font text budgets at the viewport width limit; runtime uses each purchase's actual ink.
export const PURCHASE_CONFIRM_ROOMS = {
  left: { font: "body", room: MAX_WIDTH - 2 * MODAL.pad },
  price: { font: "title", room: MAX_WIDTH - 2 * MODAL.pad },
  title: { font: "title", room: barTitleRoom(cardTitleRow(LIMITS), closeControl(LIMITS)) },
} as const;

export function confirmLeftCapTop(title: FontMetrics, priceTop: number): number {
  return priceTop + helpCapDy(title, 2);
}

// Runtime geometry follows the actual fixed-size ink and the paired controls.
export function purchaseConfirmLayout(
  fonts: { body: FontMetrics; title: FontMetrics },
  ink: {
    buy: number;
    cancel: number;
    left: number;
    price: number;
    title: number;
    titleExtraHeight?: number;
  },
) {
  const actions = { buy: modalActionWidth(ink.buy), cancel: modalActionWidth(ink.cancel) };
  const actionsWidth = actions.buy + actions.cancel + BUTTON_SIZE.gap;
  const width = modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "medium");
  const stacked = actionsWidth > width - 2 * MODAL.pad;
  const actionGroupWidth = stacked ? Math.max(actions.buy, actions.cancel) : actionsWidth;
  const header = MODAL.header + (ink.titleExtraHeight ?? 0);
  const priceTop = header + CARD.well.size + MODAL.gap;
  const leftTop = confirmLeftCapTop(fonts.title, priceTop);
  const buttonsTop = leftTop + inkRowsFromCapTop(fonts.body) * 2 + MODAL.gap;
  const height =
    buttonsTop +
    BUTTON_HEIGHT +
    (stacked ? BUTTON_HEIGHT + BUTTON_SIZE.stackGap : 0) +
    MODAL.pad +
    DISMISS_FOOTER_SPACE;
  const placed = modalRect(overlayRegion("home"), undefined, { height, width });
  const middle = placed.x + width / 2;
  const row = cardTitleRow(placed);
  const placedWell = {
    height: CARD.well.size,
    width: CARD.well.size,
    x: middle - CARD.well.size / 2,
    y: placed.y + header,
  };
  const action = (choice: "buy" | "cancel") => ({
    height: BUTTON_HEIGHT,
    width: stacked ? actionGroupWidth : actions[choice],
    x:
      middle -
      actionGroupWidth / 2 +
      (!stacked && choice === "buy" ? actions.cancel + BUTTON_SIZE.gap : 0),
    y:
      placed.y +
      buttonsTop +
      (stacked && choice === "buy" ? BUTTON_HEIGHT + BUTTON_SIZE.stackGap : 0),
  });
  return {
    buttons: { buy: action("buy"), cancel: action("cancel") },
    card: placed,
    dim: overlayRegion("home"),
    left: {
      ...PURCHASE_CONFIRM_ROOMS.left,
      capTop: placed.y + leftTop,
      centreX: middle,
      room: width - 2 * MODAL.pad,
    },
    picture: { x: placedWell.x + CARD.well.picture, y: placedWell.y + CARD.well.picture },
    price: {
      ...PURCHASE_CONFIRM_ROOMS.price,
      capTop: placed.y + priceTop,
      centreX: middle,
      room: width - 2 * MODAL.pad,
    },
    title: {
      ...PURCHASE_CONFIRM_ROOMS.title,
      capTop: row.y + CARD.titleRow.titleY,
      room: barTitleRoom(row, closeControl(placed)),
    },
    titleRow: row,
    well: placedWell,
  };
}
