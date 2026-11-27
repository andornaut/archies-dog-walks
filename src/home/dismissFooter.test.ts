import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { BUILD_LABEL } from "../buildLabel.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { MODAL, modalActionWidth } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelButton } from "../ui/modal/types.ts";
import { PAGE_LAYOUT } from "../ui/pageLayout.ts";
import { badgeCardView } from "./badgeCardView.ts";
import { badgeWall } from "./badgesView.ts";
import { detailCardView, type DetailMeasure } from "./details/detailCardView.ts";
import { overlayRegion } from "./homeBar.ts";
import { installStepsLayout, settingsLayout } from "./settings.ts";
import { SETTING_ROWS, type SettingsMeasure, settingsView } from "./settingsView.ts";
import { SHOP_LAYOUT } from "./shopLayout.ts";
import { shopPageView } from "./shopPageView.ts";
import { STATS_LAYOUT } from "./statsLayout.ts";

const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
const wrap = (room: number, text: string) =>
  wrapWords((line) => inkWidth("font-body", { scale: 2 }, line), room, text);
const measure: DetailMeasure & SettingsMeasure = {
  ...fonts,
  art: () => undefined,
  bodyWidth: (lines) =>
    Math.max(0, ...lines.map((line) => inkWidth("font-body", { scale: 2 }, line))),
  fitBody: (_lines, room, text) => wrap(room, text),
  hasTag: () => false,
  ink: (font, scale, text) => ({ left: 0, right: inkWidth(`font-${font}`, { scale }, text) }),
  inkWidth: (font, text) => inkWidth(`font-${font}`, { scale: 2 }, text),
  titleInk: (text) => modalTitleInk(gameFont("font-title"), text),
  wrapBody: wrap,
  wrapNote: wrap,
};

function footer(panel: Rect, action: PanelButton | undefined, primary: boolean): PanelButton {
  expect(action?.label).toBe(gameData.menuText.common.close);
  expect(action?.primary).toBe(primary);
  expect(action?.rect.height).toBe(48);
  expect(action!.rect.x + action!.rect.width / 2).toBe(panel.x + panel.width / 2);
  expect(action!.rect.y + action!.rect.height).toBe(panel.y + panel.height - MODAL.pad);
  return action!;
}

it("keeps the install steps above their centred dismiss control", () => {
  const layout = settingsLayout(
    fonts,
    SETTING_ROWS.map((row) =>
      row.kind === "slider" ? { kind: "slider" } : { kind: row.kind, noteLines: 1 },
    ),
  );
  const steps = installStepsLayout(overlayRegion("home"), 3);
  const view = settingsView(
    measure,
    {
      art: () => undefined,
      buildLabel: BUILD_LABEL,
      layout,
      rows: SETTING_ROWS,
      words: gameData.menuText.settings,
    },
    {
      dim: SCREEN_LAYOUT.screen,
      focus: null,
      pressed: undefined,
      settings: DEFAULT_SETTINGS,
      steps: { ...steps, kind: "ios" },
    },
  );
  const step = view.steps!;
  const close = footer(step.card.panel, step.card.footer, true);
  expect(
    step.steps.capTop + inkRowsOfLines(fonts.body, step.steps.lines.length) * 2,
  ).toBeLessThanOrEqual(close.rect.y - MODAL.gap);
});

it("grows and recentres detail and badge cards rather than covering the final body lines", () => {
  const card = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: {
      lines: [gameData.homeText.detail.gearSubtitle],
      locked: false,
      status: gameData.homeText.shop.owned,
      subtitle: gameData.homeText.detail.gearSubtitle,
      title: gameData.shopGear.runningShoes.name,
    },
    kind: "gear",
    picture: { key: "missing-test-art", scale: 1 },
  });
  const action = footer(card.card.panel, card.card.footer, true);
  for (const text of card.texts) {
    expect(
      text.capTop +
        inkRowsOfLines(fonts[text.font ?? "body"], text.lines.length) * (text.scale ?? 2),
    ).toBeLessThanOrEqual(action.rect.y - MODAL.gap);
  }
  const badge = badgeWall(gameData, [gameData.achievements[0]!.id])[0]!;
  const view = badgeCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    badge,
    burst: false,
    reduced: true,
  });
  const close = footer(view.panel, view.footer, true);
  for (const text of view.texts) {
    expect(
      text.capTop +
        inkRowsOfLines(fonts[text.font ?? "body"], text.lines.length) * (text.scale ?? 2),
    ).toBeLessThanOrEqual(close.rect.y - MODAL.gap);
  }
});

it("keeps the Shop and Logbook scroll viewport clear of their fixed Back", () => {
  const { back } = shopPageView(measure, { tabs: [], title: gameData.menuText.stats.title });
  expect(back).toMatchObject({ label: gameData.menuText.pageBack, primary: true });
  expect(back.rect.width).toBe(modalActionWidth(measure.inkWidth("title", back.label)));
  expect(back.rect.x + back.rect.width / 2).toBe(PAGE_LAYOUT.back.x + PAGE_LAYOUT.back.width / 2);
  expect(back.rect).toMatchObject({ height: PAGE_LAYOUT.back.height, y: PAGE_LAYOUT.back.y });
  expect(back.hit).toEqual(back.rect);
  for (const rect of [SHOP_LAYOUT.list.rect, STATS_LAYOUT.view]) {
    expect(rect.y + rect.height).toBe(back.rect.y - MODAL.gap);
  }
});
