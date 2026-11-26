import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { closeControl } from "../ui/closeControl.ts";
import { MODAL, modalActionWidth, modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { updateModalLayout } from "./homeLayout.ts";

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
        { font, inkOf: (line: string) => modalTitleInk(gameFont("font-title"), line), widthOf },
        barTitleRoom(cardTitleRow(initial.panel), closeControl(initial.panel)),
        title,
      );
      const { button, cancel, panel } = updateModalLayout(area, {
        ...ink,
        titleExtraHeight: wrapped.extraHeight,
      });
      const titleBottom = Math.max(
        ...wrapped.lines.map(
          (line, index) =>
            cardTitleRow(panel).y +
            wrapped.capOffset +
            index * wrapped.linePitch +
            modalTitleInk(gameFont("font-title"), line).bottom,
        ),
      );
      expect(titleBottom + MODAL.titleTop).toBe(cancel.y);
      const innerWidth = panel.width - 2 * MODAL.pad;
      expect(cancel.width).toBeLessThanOrEqual(innerWidth);
      expect(button.width).toBeLessThanOrEqual(innerWidth);
      expect(cancel.width).toBeGreaterThanOrEqual(ink.cancel + 2 * MODAL.pad);
      expect(button.width).toBeGreaterThanOrEqual(ink.action + 2 * MODAL.pad);
      const stacked =
        modalActionWidth(ink.action) + modalActionWidth(ink.cancel) + BUTTON_SIZE.gap > innerWidth;
      if (stacked) {
        expect(cancel.y + cancel.height + BUTTON_SIZE.stackGap).toBe(button.y);
        expect(cancel.x).toBe(button.x);
        expect(cancel.width).toBe(button.width);
      } else {
        expect(cancel.y).toBe(button.y);
        expect(cancel.x + cancel.width + BUTTON_SIZE.gap).toBe(button.x);
      }
      expect(button.y + button.height + MODAL.pad).toBe(panel.y + panel.height);
      expect(rectsOverlap(cancel, button)).toBe(false);
      expect(panel.y).toBeGreaterThanOrEqual(MODAL.margin);
      expect(panel.y + panel.height).toBeLessThanOrEqual(area.height - MODAL.margin);
    },
  );
});
