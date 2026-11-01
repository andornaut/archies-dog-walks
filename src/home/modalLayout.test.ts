import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import { insetRect, rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { barTitleLeft } from "../ui/barTitle";
import { closeControl } from "../ui/closeControl";
import { TEXT_STYLE } from "../ui/textFit";
import { overlayRegion } from "./homeBar";
import { cardTitleRow, HOME_LAYOUT, updateModalLayout } from "./homeLayout";
import {
  MODAL,
  modalPanelWidth,
  modalRect,
  modalTitleLayout,
  modalTitleWidth,
} from "./modalLayout";

it("uses the full logical viewport for narrow content and still respects a smaller safe area", () => {
  expect(modalPanelWidth(328, 80)).toBe(180);
  expect(modalPanelWidth(160, 80)).toBe(160);
});

it("omits absent title reserves and rejects a word wider than the fixed-font title room", () => {
  expect(modalTitleWidth(0)).toBe(0);
  expect(modalTitleWidth(40, false)).toBe(40 + 2 * MODAL.pad);
  expect(() =>
    modalTitleLayout(
      {
        font: fontFileMetrics("font-title"),
        widthOf: (text) => inkWidth("font-title", TEXT_STYLE, text.toUpperCase()),
      },
      20,
      "Settings",
    ),
  ).toThrow(RangeError);
});

const area = overlayRegion("home");
const body = { height: 80, width: 180 };

it.each([
  { height: 100, width: 100, x: 130, y: 180 },
  { height: 100, width: 100, x: 130, y: 300 },
  { height: 150, width: 60, x: 120, y: 190 },
])("keeps vertical centring when a protected character overlaps at $x,$y", (avoid) => {
  const placed = modalRect(area, avoid, body);
  expect(inside(placed, insetRect(MODAL.margin, area))).toBe(true);
  expect(placed.y + placed.height / 2).toBe(SCREEN_CONFIG.height / 2);
});

it.each([overlayRegion("home"), SCREEN_LAYOUT.walkView])(
  "centres in the full viewport rather than its dim region",
  (region) => {
    const placed = modalRect(region, undefined, body);
    expect(placed.y + placed.height / 2).toBe(SCREEN_CONFIG.height / 2);
    expect(placed).toMatchObject(body);
  },
);

it("clamps a tall full-size panel inside the protected walk region", () => {
  const bounds = insetRect(MODAL.margin, SCREEN_LAYOUT.walkView);
  const placed = modalRect(SCREEN_LAYOUT.walkView, undefined, { height: 400, width: 180 });
  expect(placed.height).toBe(400);
  expect(inside(placed, bounds)).toBe(true);
  expect(placed.y + placed.height).toBe(bounds.y + bounds.height);
});

describe.each(["newerSave", "update"] as const)("%s notice", (mode) => {
  it("sizes its title and action without an empty body or obscuring the gate character", () => {
    const title = gameData.homeText[mode].title;
    const ink = inkWidth("font-title", TEXT_STYLE, title.toUpperCase());
    const placed = updateModalLayout(area, {
      action: inkWidth("font-title", TEXT_STYLE, gameData.homeText[mode].button),
      ...(mode === "update"
        ? { cancel: inkWidth("font-title", TEXT_STYLE, gameData.homeText.shop.confirmCancel) }
        : {}),
      title: ink,
    });
    expect(inside(placed.panel, insetRect(MODAL.margin, area))).toBe(true);
    expect(placed.panel.width).toBeGreaterThanOrEqual(
      MODAL_CONTENT.minWidthFraction * SCREEN_CONFIG.width,
    );
    const close = closeControl(placed.panel);
    const row = cardTitleRow(placed.panel);
    const titleInk = {
      height: fontFileMetrics("font-title").capHeight * 2,
      width: ink,
      x: barTitleLeft(row, close, ink),
      y: row.y,
    };
    expect(rectsOverlap(titleInk, close.hit)).toBe(false);
    expect(
      Math.abs(2 * titleInk.x + titleInk.width - (2 * placed.panel.x + placed.panel.width)),
    ).toBeLessThanOrEqual(1);
    expect(inside(titleInk, placed.panel)).toBe(true);
    expect(rectsOverlap(placed.panel, { ...HOME_LAYOUT.gate, width: area.width, x: area.x })).toBe(
      false,
    );
    expect(inside(placed.button, placed.panel)).toBe(true);
    expect(rectsOverlap(placed.button, closeControl(placed.panel).hit)).toBe(false);
    expect(placed.panel.y + placed.panel.height - placed.button.y - placed.button.height).toBe(
      MODAL.pad,
    );
    expect(placed.button.y).toBeGreaterThanOrEqual(
      placed.panel.y + fontFileMetrics("font-title").capHeight * 2,
    );
  });
});

it("places update cancellation beside its primary action and stacks the whole group when necessary", () => {
  const paired = updateModalLayout(area, { action: 100, cancel: 60, title: 160 });
  expect(paired.cancel).toBeDefined();
  expect(paired.cancel!.x + paired.cancel!.width + MODAL.gap).toBe(paired.button.x);
  expect(paired.cancel!.y).toBe(paired.button.y);
  const stacked = updateModalLayout(area, { action: 180, cancel: 120, title: 160 });
  expect(stacked.cancel!.x).toBe(stacked.button.x);
  expect(stacked.cancel!.width).toBe(stacked.button.width);
  expect(stacked.cancel!.y + stacked.cancel!.height + MODAL.rowGap).toBe(stacked.button.y);
  expect(inside(stacked.button, stacked.panel)).toBe(true);
  expect(updateModalLayout(area, { action: 100, title: 160 }).cancel).toBeUndefined();
});
