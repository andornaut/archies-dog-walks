import { insetRect, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MIN_PRESS } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { closeControl } from "../ui/closeControl.ts";
import { MODAL, modalPanelWidth, modalRect, modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { modalCardView } from "../ui/modal/view.ts";
import { TEXT_STYLE } from "../ui/textFit.ts";
import { overlayRegion } from "./homeBar.ts";
import { updateModalLayout } from "./homeLayout.ts";

it("uses the full logical viewport for narrow content and still respects a smaller safe area", () => {
  expect(modalPanelWidth(328, 80)).toBe(180);
  expect(modalPanelWidth(160, 80)).toBe(160);
});

it("rejects a word wider than the fixed-font title room", () => {
  expect(() =>
    modalTitleLayout(
      {
        font: fontFileMetrics("font-title"),
        inkOf: (line: string) => modalTitleInk(gameFont("font-title"), line),
        widthOf: (text) => inkWidth("font-title", TEXT_STYLE, text.toUpperCase()),
      },
      20,
      "Settings",
    ),
  ).toThrow(RangeError);
});

const area = overlayRegion("home");
const body = { height: 80, width: 180 };

// Centred in the full viewport rather than its dim region, whether or not a protected
// character overlaps.
it.each([
  ["home", area, { height: 100, width: 100, x: 130, y: 180 }],
  ["home", area, { height: 100, width: 100, x: 130, y: 300 }],
  ["home", area, { height: 150, width: 60, x: 120, y: 190 }],
  ["home", area, undefined],
  ["walk", SCREEN_LAYOUT.walkView, undefined],
] as const)("centres a modal on the screen over the %s region, avoiding %j", (_, region, avoid) => {
  const placed = modalRect(region, avoid, body);
  expect(inside(placed, insetRect(MODAL.margin, region))).toBe(true);
  expect(placed.y + placed.height / 2).toBe(SCREEN_CONFIG.height / 2);
  expect(placed).toMatchObject(body);
});

// The protected top is the top bar's press rows plus the stacked gap in every caller.
it.each([
  ["home", 544],
  ["walk", 466],
] as const)("protects y 56 to %s's bottom at %i", (region, bottom) => {
  const bounds = insetRect(MODAL.margin, overlayRegion(region));
  expect(bounds.y).toBe(MIN_PRESS + BUTTON_SIZE.stackGap);
  expect(bounds.y + bounds.height).toBe(bottom);
});

it("clamps a tall full-size panel inside the protected walk region", () => {
  const bounds = insetRect(MODAL.margin, SCREEN_LAYOUT.walkView);
  const placed = modalRect(SCREEN_LAYOUT.walkView, undefined, { height: 400, width: 180 });
  expect(placed.height).toBe(400);
  expect(inside(placed, bounds)).toBe(true);
  expect(placed.y + placed.height).toBe(bounds.y + bounds.height);
});

describe("update notice", () => {
  it("fits the wrapped heading and two actions without a reserved Close row", () => {
    const { button, title } = gameData.homeText.update;
    const measure = {
      body: fontFileMetrics("font-body"),
      inkWidth: (font: "body" | "title", text: string) =>
        inkWidth(`font-${font}`, TEXT_STYLE, font === "title" ? text.toUpperCase() : text),
      title: fontFileMetrics("font-title"),
      titleInk: (text: string) => modalTitleInk(gameFont("font-title"), text),
      wrapNote: () => [],
    };
    const sizes = {
      action: measure.inkWidth("title", button),
      cancel: measure.inkWidth("title", gameData.homeText.shop.confirmCancel),
      title: measure.inkWidth("title", title),
    };
    const preview = updateModalLayout(area, sizes);
    const heading = modalTitleLayout(
      {
        font: measure.title,
        inkOf: measure.titleInk,
        widthOf: (text) => measure.inkWidth("title", text),
      },
      barTitleRoom(cardTitleRow(preview.panel), closeControl(preview.panel)),
      title,
    );
    const placed = updateModalLayout(area, { ...sizes, titleExtraHeight: heading.extraHeight });
    const view = modalCardView(measure, placed.panel, title, []);
    expect(placed.panel.width).toBe(264);
    expect(inside(placed.panel, insetRect(MODAL.margin, area))).toBe(true);
    for (const line of view.title) {
      const ink = measure.titleInk(line.text);
      const width = inkWidth("font-title", { scale: line.scale }, line.text.toUpperCase());
      const rect = {
        height: ink.bottom - ink.top,
        width,
        x: line.centreX - width / 2,
        y: line.capTop + ink.top,
      };
      expect(inside(rect, placed.panel)).toBe(true);
      expect(rectsOverlap(rect, closeControl(placed.panel).hit)).toBe(false);
    }
    expect(
      Math.abs(placed.panel.y + placed.panel.height / 2 - SCREEN_CONFIG.height / 2),
    ).toBeLessThanOrEqual(0.5);
    for (const rect of [placed.cancel, placed.button]) {
      expect(inside(rect, placed.panel)).toBe(true);
      expect(rectsOverlap(rect, closeControl(placed.panel).hit)).toBe(false);
    }
    expect(placed.panel.y + placed.panel.height - placed.button.y - placed.button.height).toBe(
      MODAL.pad,
    );
  });
});

it("places update cancellation beside its primary action and stacks the whole group when necessary", () => {
  const paired = updateModalLayout(area, { action: 80, cancel: 40, title: 160 });
  expect(paired.cancel.x + paired.cancel.width + BUTTON_SIZE.gap).toBe(paired.button.x);
  expect(paired.cancel.y).toBe(paired.button.y);
  const stacked = updateModalLayout(area, { action: 160, cancel: 120, title: 160 });
  expect(stacked.cancel.x).toBe(stacked.button.x);
  expect(stacked.cancel.width).toBe(stacked.button.width);
  expect(stacked.cancel.y + stacked.cancel.height + BUTTON_SIZE.stackGap).toBe(stacked.button.y);
  expect(inside(stacked.button, stacked.panel)).toBe(true);
});
