import { inkRowsFromCapTop } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { fontFileMetrics, inkWidth } from "../testing/fontInk.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { closeControl } from "../ui/closeControl.ts";
import { MODAL, modalTitleLayout } from "../ui/modal/layout.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { HOME_LAYOUT, updateModalLayout } from "./homeLayout.ts";

describe("update offer and failed retry titles", () => {
  it.each([gameData.homeText.update.title, gameData.homeText.update.failure])(
    "keeps full-size wrapped %s clear of the actions and inside the viewport",
    (title) => {
      const area = { ...SCREEN_CONFIG, x: 0, y: 0 };
      const widthOf = (text: string) => inkWidth("font-title", { scale: TEXT_SCALE }, text);
      const ink = {
        action: widthOf(gameData.homeText.update.button),
        cancel: widthOf(gameData.homeText.shop.confirmCancel),
        title: widthOf(title),
      };
      const initial = updateModalLayout(area, ink);
      const font = fontFileMetrics("font-title");
      const wrapped = modalTitleLayout(
        { font, widthOf },
        barTitleRoom(cardTitleRow(initial.panel), closeControl(initial.panel)),
        title,
      );
      const { button, cancel, panel } = updateModalLayout(area, {
        ...ink,
        titleExtraHeight: wrapped.extraHeight,
      });
      const lastCap =
        cardTitleRow(panel).y +
        HOME_LAYOUT.card.titleRow.titleY +
        (wrapped.lines.length - 1) * wrapped.linePitch;
      expect(lastCap + inkRowsFromCapTop(font) * TEXT_SCALE + MODAL.gap).toBeLessThanOrEqual(
        cancel.y,
      );
      expect(panel.y).toBeGreaterThanOrEqual(MODAL.margin);
      expect(panel.y + panel.height).toBeLessThanOrEqual(area.height - MODAL.margin);
      expect(button.y + button.height + MODAL.pad).toBe(panel.y + panel.height);
    },
  );
});
