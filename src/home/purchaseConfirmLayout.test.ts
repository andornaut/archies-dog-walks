import { insetRect, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MIN_TAP_SIZE } from "../layout/screenLayout.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { closeControl } from "../ui/closeControl.ts";
import { MODAL, modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { TEXT_STYLE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { confirmLines } from "./purchaseConfirm.ts";
import { purchaseConfirmLayout } from "./purchaseConfirmLayout.ts";
import { dogRows, gearRows, slotRows } from "./shop.ts";

const owned = { ...newPlayerSave.owned, dogSlots: [], dogs: [], gear: [] };
const rows = [
  ...dogRows(gameData, owned),
  ...gearRows(gameData, owned),
  ...slotRows(gameData, owned),
].flatMap((row) => (row.price === null ? [] : [{ ...row, price: row.price }]));
const bankAfter = cents(rows.reduce((sum, row) => sum + row.price, 0));
const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
const cases = rows.map((row) => {
  const lines = confirmLines(gameData, { ...row, bankAfter });
  const ink = {
    buy: inkWidth("font-title", TEXT_STYLE, lines.buy),
    cancel: inkWidth("font-title", TEXT_STYLE, lines.cancel),
    left: inkWidth("font-body", TEXT_STYLE, lines.left),
    price: inkWidth("font-title", TEXT_STYLE, lines.price),
    title: inkWidth("font-title", TEXT_STYLE, lines.title),
  };
  const preview = purchaseConfirmLayout(fonts, ink);
  const heading = modalTitleLayout(
    {
      font: fonts.title,
      inkOf: (line) => modalTitleInk(gameFont("font-title"), line),
      widthOf: (line) => inkWidth("font-title", TEXT_STYLE, line.toUpperCase()),
    },
    preview.title.room,
    lines.title,
  );
  return {
    heading,
    ink,
    name: row.name,
    placed: purchaseConfirmLayout(fonts, { ...ink, titleExtraHeight: heading.extraHeight }),
  };
});

describe.each(cases)("purchase modal: $name", ({ heading, ink, placed }) => {
  it("keeps measured text and its illustration inside the content-sized card", () => {
    for (const line of heading.lines) {
      expect(inkWidth("font-title", { scale: 3 }, line.toUpperCase())).toBeLessThanOrEqual(
        placed.title.room,
      );
    }
    expect(Math.max(ink.price, ink.left)).toBeLessThanOrEqual(placed.card.width - 2 * MODAL.pad);
    expect(inside(placed.well, placed.card)).toBe(true);
    expect(inside(placed.card, insetRect(MODAL.margin, placed.dim))).toBe(true);
  });

  it("retains reachable separate actions below all actual text ink", () => {
    const close = closeControl(placed.card).hit;
    for (const button of Object.values(placed.buttons)) {
      expect(button.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(inside(button, placed.card)).toBe(true);
      expect(rectsOverlap(button, close)).toBe(false);
      expect(button.y).toBeGreaterThanOrEqual(
        placed.left.capTop + inkRowsFromCapTop(fonts.body) * 2 + MODAL.gap,
      );
    }
    expect(rectsOverlap(placed.buttons.buy, placed.buttons.cancel)).toBe(false);
    expect(placed.buttons.cancel.x).toBeLessThan(placed.buttons.buy.x);
  });
});
