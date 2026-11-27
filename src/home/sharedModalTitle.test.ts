import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { expect, it } from "vitest";

import { gearSmallIconKey } from "../assets/iconKeys.ts";
import { gameData } from "../data/index.ts";
import { questionPanelView } from "../hud/questionPanelView.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { closeControl } from "../ui/closeControl.ts";
import { MODAL, modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import type { PanelMeasure, PanelText } from "../ui/modal/types.ts";
import { modalCardView, panelTitle } from "../ui/modal/view.ts";
import { navigationMenuWidth } from "../ui/navigationMenu.ts";
import { MODAL_TITLE_SCALE } from "../ui/textFit.ts";
import { BADGE_STRIP, celebrationTitle, stripUnderClose } from "./badgesView.ts";
import { detailCardView, type DetailMeasure } from "./details/detailCardView.ts";
import { overlayRegion } from "./homeBar.ts";
import { updateModalLayout } from "./homeLayout.ts";
import { installStepsLayout } from "./settings.ts";
import { shopPageView } from "./shopPageView.ts";

const measure: PanelMeasure = {
  body: fontFileMetrics("font-body"),
  inkWidth: (font, line) =>
    inkWidth(`font-${font}`, { scale: 2 }, font === "title" ? line.toUpperCase() : line),
  title: fontFileMetrics("font-title"),
  titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (room, line) =>
    wrapWords((text) => inkWidth("font-body", { scale: 2 }, text), room, line),
};
function balanced(panelTop: number, title: readonly PanelText[], firstVisibleBody: number) {
  const ink = title.map((line) => {
    const rows = measure.titleInk(line.text);
    return { bottom: line.capTop + rows.bottom, top: line.capTop + rows.top };
  });
  expect(title.every((line) => line.scale === MODAL_TITLE_SCALE)).toBe(true);
  expect(Math.min(...ink.map((line) => line.top)) - panelTop).toBe(24);
  expect(firstVisibleBody - Math.max(...ink.map((line) => line.bottom))).toBe(24);
}
it.each([
  gameData.menuText.menu.title,
  gameData.menuText.pause.title,
  gameData.homeText.quit.title,
])("keeps actual %s title ink equally clear of panel top and first action", (title) => {
  const view = questionPanelView(measure, SCREEN_LAYOUT.screen, {
    labels: [gameData.menuText.common.close],
    note: [],
    panelWidth: navigationMenuWidth(gameData, measure, 328),
    sentenceLines: false,
    showKeyNumbers: false,
    title,
  });
  balanced(view.panel.y, view.title, view.buttons[0]!.rect.y);
});
it.each([gameData.homeText.shop.title, gameData.menuText.stats.title])(
  "uses the same role and visible selected-tab clearance for %s",
  (title) => {
    const page = shopPageView(measure, {
      tabs: [
        { label: gameData.homeText.shop.tabs.dogs, open: true, pressed: false },
        { label: gameData.homeText.shop.tabs.gear, open: false, pressed: false },
      ],
      title,
    });
    balanced(page.panel.y, page.title, Math.min(...page.tabs.map((tab) => tab.face.y + tab.dy)));
  },
);
it.each([gameData.homeText.update.title, gameData.homeText.update.failure])(
  "grows Update content below the actual wrapped heading: %s",
  (title) => {
    const sizes = {
      action: measure.inkWidth("title", gameData.homeText.update.button),
      cancel: measure.inkWidth("title", gameData.homeText.shop.confirmCancel),
      title: measure.inkWidth("title", title),
    };
    const preview = updateModalLayout(SCREEN_LAYOUT.screen, sizes);
    const heading = modalTitleLayout(
      {
        font: measure.title,
        inkOf: measure.titleInk,
        widthOf: (text) => measure.inkWidth("title", text),
      },
      barTitleRoom(cardTitleRow(preview.panel), closeControl(preview.panel)),
      title,
    );
    const layout = updateModalLayout(SCREEN_LAYOUT.screen, {
      ...sizes,
      titleExtraHeight: heading.extraHeight,
    });
    const view = modalCardView(measure, layout.panel, title, []);
    expect(view.title.length).toBeGreaterThan(1);
    balanced(layout.panel.y, view.title, Math.min(layout.cancel.y, layout.button.y));
    expect(MODAL.header).toBe(63);
  },
);

const detailMeasure: DetailMeasure = {
  ...measure,
  art: () => ({ height: 32, width: 32 }),
  bodyWidth: (lines) => Math.max(0, ...lines.map((line) => measure.inkWidth("body", line))),
  hasTag: () => false,
  wrapBody: measure.wrapNote,
};
it("moves the detail well below its wrapped full-size heading", () => {
  const gear = "runningShoes" as const;
  const item = gameData.shopGear[gear];
  const picture = { key: gearSmallIconKey(gear), scale: 1 };
  const detail = detailCardView(gameData, detailMeasure, SCREEN_LAYOUT.screen, {
    card: {
      lines: [],
      locked: false,
      status: gameData.homeText.shop.owned,
      subtitle: gameData.homeText.detail.gearSubtitle,
      title: item.name,
    },
    kind: "gear",
    picture,
  });
  expect(detail.card.title.length).toBeGreaterThan(1);
  balanced(detail.card.panel.y, detail.card.title, detail.art[0]!.y);
});
it("reserves the same visible gap before modal badge rows after a wrapped award title", () => {
  const panel = { height: 300, width: 328, x: 16, y: 100 };
  const text = celebrationTitle(gameData, 2);
  const heading = modalTitleLayout(
    {
      font: measure.title,
      inkOf: measure.titleInk,
      widthOf: (line) => measure.inkWidth("title", line),
    },
    barTitleRoom(cardTitleRow(panel), closeControl(panel)),
    text,
  );
  const title = panelTitle(measure, panel, panel.y + MODAL.titleTop, text);
  const strip = stripUnderClose(panel, heading.extraHeight);
  expect(title.length).toBeGreaterThan(1);
  balanced(panel.y, title, strip.y + BADGE_STRIP.badgeTop);
});

it.each([
  gameData.menuText.settings.installSteps.firefoxAndroid,
  gameData.menuText.settings.installSteps.firefoxDesktop,
])("keeps long install headings clear of the first instruction icon: $title", ({ title }) => {
  const sizes = { steps: 180, title: measure.inkWidth("title", title) };
  const preview = installStepsLayout(overlayRegion("home"), 3, sizes);
  const heading = modalTitleLayout(
    {
      font: measure.title,
      inkOf: measure.titleInk,
      widthOf: (line) => measure.inkWidth("title", line),
    },
    barTitleRoom(cardTitleRow(preview.card), preview.close),
    title,
  );
  const layout = installStepsLayout(overlayRegion("home"), 3, {
    ...sizes,
    titleExtraHeight: heading.extraHeight,
  });
  const view = modalCardView(measure, layout.card, title, []);
  expect(view.title.length).toBeGreaterThan(1);
  balanced(layout.card.y, view.title, layout.icon.y);
});
