import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { BODY_PITCH } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import {
  GREETING_FIT,
  newWalkerRows,
  ordinaryBadgeModalLayout,
  ZONE_EARNINGS_FIT,
  zoneDoneRows,
} from "../hud/celebrationLayout.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { withNamePills } from "../presentation/effectNames.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { newPlayerSave, veteranSave } from "../testing/saves.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { closeControl } from "../ui/closeControl.ts";
import { MODAL, modalFamilyWidth } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { navigationMenuWidth } from "../ui/navigationMenu.ts";
import { stackRows } from "../ui/pageLayout.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { cents } from "../units.ts";
import { CELEBRATION_PANEL } from "./badgesView.ts";
import { dogDetail, gearDetail, walkerDetail } from "./details/detail.ts";
import { detailCardView, type DetailMeasure } from "./details/detailCardView.ts";
import { overlayRegion } from "./homeBar.ts";
import { updateModalLayout } from "./homeLayout.ts";
import { logbookView } from "./logbookView.ts";
import { installStepsLayout } from "./settings.ts";
import {
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopMessageLayout,
  shopNextHeading,
  shopRowsBottom,
  shopRowTextLayout,
} from "./shopLayout.ts";
import { STATS_LAYOUT } from "./statsLayout.ts";

const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
const wrap = (room: number, text: string) =>
  wrapWords((line) => inkWidth("font-body", { scale: 2 }, plainMarks(line)), room, text);
const measure: DetailMeasure = {
  ...fonts,
  art: () => undefined,
  bodyWidth: (lines) =>
    Math.max(0, ...lines.map((line) => inkWidth("font-body", { scale: 2 }, plainMarks(line)))),
  hasTag: () => false,
  inkWidth: (font, text) => inkWidth(`font-${font}`, { scale: 2 }, plainMarks(text)),
  titleInk: (text) => modalTitleInk(gameFont("font-title"), text),
  wrapBody: wrap,
  wrapNote: wrap,
};

it("uses the selected client family without changing title exclusion or safe area limits", () => {
  for (const [family, width, titleRoom] of [
    ["large", 328, 216],
    ["medium", 264, 152],
  ] as const) {
    const panel = {
      height: 200,
      width: modalFamilyWidth(328, family),
      x: (360 - width) / 2,
      y: 100,
    };
    expect(panel.width).toBe(width);
    expect(barTitleRoom(cardTitleRow(panel), closeControl(panel))).toBe(titleRoom);
    expect(closeControl(panel).hit.width).toBe(48);
    expect(closeControl(panel).x).toBe(panel.x + width - 6 - 20);
  }
  expect(modalFamilyWidth(240, "large")).toBe(240);
});

it("selects Medium navigation and confirmations, and Large install steps", () => {
  expect(navigationMenuWidth(gameData, measure, 328)).toBe(264);
  expect(installStepsLayout(overlayRegion("home"), 3).card.width).toBe(328);
});

it("stacks full-size paired actions against the selected Medium inner width", () => {
  const { button, cancel, panel } = updateModalLayout(SCREEN_LAYOUT.screen, {
    action: 120,
    cancel: 80,
    title: 60,
  });
  expect(panel.width).toBe(264);
  expect(cancel.x).toBe(button.x);
  expect(cancel.width).toBe(button.width);
  expect(cancel.width).toBeLessThanOrEqual(panel.width - 2 * MODAL.pad);
  expect(cancel.height).toBe(48);
  expect(button.y).toBeGreaterThanOrEqual(cancel.y + cancel.height);
});

it("chooses every detail family using reflowed full-size content", () => {
  const gear = "runningShoes";
  const card = gearDetail(gameData, newPlayerSave.owned, cents(0), newPlayerSave.lastLoadout, gear);
  const item = (lines: string[], area = SCREEN_LAYOUT.screen) =>
    detailCardView(gameData, measure, area, {
      card: { ...card, lines },
      kind: "gear",
      picture: { key: "missing-test-icon", scale: 1 },
    });
  const short = item([]);
  expect(short.card.panel.width).toBe(264);
  const sentence = gameData.homeText.detail.gearSubtitle;
  const long = item([Array.from({ length: 100 }, () => sentence).join(" ")]);
  expect(long.card.panel.width).toBe(328);
  const dog = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: dogDetail(gameData, newPlayerSave.owned, cents(0), newPlayerSave.lastLoadout.dogs[0]!),
    kind: "dog",
    picture: { key: "missing-test-portrait", scale: 1 },
  });
  expect(dog.card.panel.width).toBe(264);
});

it("keeps Fanny pack on one full-size title line and uses shared content and footer gaps", () => {
  const gear = "fannyPack";
  const card = gearDetail(
    gameData,
    { ...newPlayerSave.owned, gear: [gear] },
    cents(0),
    { gear },
    gear,
  );
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card,
    kind: "gear",
    picture: { key: "missing-test-icon", scale: 1 },
  });
  expect(view.card.title.map(({ text }) => text)).toEqual([card.title]);
  expect(view.card.title[0]?.scale).toBe(3);
  const well = view.framed[0]!.rect;
  const [effect, status] = view.texts;
  const bottom = (text: NonNullable<typeof effect>) =>
    text.capTop + inkRowsOfLines(fonts.body, text.lines.length) * 2;
  expect(status!.lines.join(" ")).toBe(card.status);
  expect(status!.capTop - Math.max(well.y + well.height, bottom(effect!))).toBe(MODAL.pad);
  expect(view.card.footer!.rect.y - bottom(status!)).toBe(MODAL.gap);
});

it("keeps full dog details and the separate owner row, and omits walker type text", () => {
  const dog = dogDetail(gameData, newPlayerSave.owned, cents(0), "sequoia");
  const name = "Aunt Judy and the entire tennis club";
  const role = "Tennis coach for the neighbourhood junior championship team";
  const dogView = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: { ...dog, owner: { ...dog.owner!, name, role } },
    kind: "dog",
    picture: { key: "missing-test-portrait", scale: 1 },
  });
  for (const text of [dog.subtitle, ...dog.lines, name, role]) {
    const row = dogView.texts.find((row) => row.lines.join(" ") === text);
    expect(row, text).toBeDefined();
    const well = dogView.framed[0]!.rect;
    expect(row!.x).toBeGreaterThan(well.x + well.width);
  }
  expect(dogView.framed).toHaveLength(2);
  for (const row of dogView.texts) {
    expect(
      row.align === "inkCentre"
        ? row.x + measure.bodyWidth(row.lines) / 2
        : row.align === "inkRight"
          ? row.x
          : row.x + measure.bodyWidth(row.lines),
    ).toBeLessThanOrEqual(dogView.card.panel.x + dogView.card.panel.width - MODAL.pad);
  }
  const card = walkerDetail(gameData, newPlayerSave.owned, "casey");
  const walker = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card,
    kind: "walker",
    picture: { key: "missing-test-portrait", scale: 1 },
  });
  expect(walker.texts.map((row) => row.lines.join(" "))).toEqual([
    ...card.lines.map((line) => withNamePills(gameData, line)),
    card.status,
  ]);
  expect(walker.card.footer?.label).toBe(gameData.menuText.common.close);
});

it("fits all authored item details at their selected widths without shrinking text", () => {
  for (const gear of Object.keys(gameData.shopGear) as (keyof typeof gameData.shopGear)[]) {
    const card = gearDetail(
      gameData,
      newPlayerSave.owned,
      cents(0),
      newPlayerSave.lastLoadout,
      gear,
    );
    const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
      card,
      kind: "gear",
      picture: { key: "missing-test-icon", scale: 1 },
    });
    expect([264, 328]).toContain(view.card.panel.width);
    expect(view.card.panel.height).toBeLessThanOrEqual(SCREEN_CONFIG.height - 2 * MODAL.margin);
    expect(view.card.title.every((line) => line.scale === 3)).toBe(true);
    for (const text of view.texts) {
      expect(text.scale ?? 2).toBe(2);
      expect(
        text.align === "inkCentre"
          ? text.x + measure.bodyWidth(text.lines) / 2
          : text.align === "inkRight"
            ? text.x
            : text.x + measure.bodyWidth(text.lines),
      ).toBeLessThanOrEqual(view.card.panel.x + view.card.panel.width - MODAL.pad);
    }
  }
});

it("reflows narrow Logbook stat labels and grows content before the following section", () => {
  const save = veteranSave();
  const view = logbookView({ ...measure, bodyInk: () => ({ bottom: 0, top: 0 }) }, gameData, {
    badges: [],
    save: {
      ...save,
      stats: {
        ...save.stats,
        bestWalk: { dogs: [...save.owned.dogs, ...save.owned.dogs], zonesFinished: 4 },
        bestZoneFinished: 99999999,
      },
    },
    tab: "runs",
  });
  const texts = view.content.rows.flatMap((row) => row.texts);
  const values = texts.filter((text) => text.align === "inkRight");
  for (const value of values) {
    const left = value.x - measure.inkWidth("body", value.lines[0]!);
    for (const label of texts.filter(
      (text) => text.capTop === value.capTop && text.align !== "inkRight" && text.font !== "title",
    )) {
      expect(
        label.x + measure.inkWidth("body", label.lines[0]!) + STATS_LAYOUT.rows.gap,
      ).toBeLessThanOrEqual(left);
    }
  }
  const labelWords = gameData.menuText.stats.overall.bestZone;
  const lines = measure.wrapNote(
    view.frame.right -
      STATS_LAYOUT.rows.left -
      measure.inkWidth("body", "99999999") -
      STATS_LAYOUT.rows.gap,
    labelWords,
  );
  expect(lines.length).toBeGreaterThan(1);
  const first = texts.find((text) => text.lines[0] === lines[0]);
  expect(first).toBeDefined();
  lines.forEach((line, index) =>
    expect(
      texts.some(
        (text) =>
          text.lines[0] === line && text.capTop === first!.capTop + index * STATS_LAYOUT.rows.pitch,
      ),
    ).toBe(true),
  );
  const heading = texts.find(
    (text) => text.font === "title" && text.lines[0] === gameData.menuText.stats.sections.runs,
  )!;
  expect(heading.capTop).toBeGreaterThan(first!.capTop + lines.length * STATS_LAYOUT.rows.pitch);
  expect(view.content.bottom).toBeGreaterThan(heading.capTop);
});

it("reserves reflowed Shop descriptions and messages before following content", () => {
  const spec = SHOP_LAYOUT.gear.rows;
  const body = gameFont("font-body");
  const layout = (count: number) =>
    shopRowTextLayout(body, spec.height, {
      descriptions: Array.from({ length: count }, () => gameData.homeText.shop.slotLine),
      name: gameData.shopGear.fannyPack.name,
    });
  const heights = [1, 3, 1].map((count) => layout(count).height);
  const rows = stackRows({ ...spec, width: SHOP_LAYOUT.row.width, x: SHOP_LAYOUT.row.x }, heights);
  const pitch = fonts.body.lineHeight * 2;
  expect(rows[0]!.height).toBe(spec.height);
  expect(rows[1]!.height).toBeGreaterThan(spec.height);
  expect(rows[2]!.y).toBe(rows[1]!.y + rows[1]!.height + spec.pitch - spec.height);
  expect(shopRowsBottom(spec, rows)).toBe(rows[2]!.y + rows[2]!.height);
  expect(shopNextHeading(spec, rows)).toBeGreaterThan(shopRowsBottom(spec, rows));
  const slots = SHOP_LAYOUT.dogs.slotRows;
  const slotRects = stackRows(
    { ...slots, width: SHOP_LAYOUT.row.width, x: SHOP_LAYOUT.row.x },
    gameData.dogSlots.map(() => slots.height),
  );
  expect(shopNextHeading(slots, slotRects)).toBe(SHOP_LAYOUT.dogs.dogHeadingY);
  const descriptions = layout(3).descriptions;
  expect(descriptions[1]! - descriptions[0]!).toBe(BODY_PITCH);
  expect(descriptions[2]! - descriptions[1]!).toBe(BODY_PITCH);
  const message = shopMessageLayout(fonts.body, 2);
  expect(message.plate.height).toBe(SHOP_LAYOUT.message.plate.height + pitch);
  expect(message.extraHeight).toBe(pitch);
  expect(message.capTops[1]! - message.capTops[0]!).toBe(pitch);
  expect(SHOP_MESSAGE_FIT.room).toBe(message.plate.width - 2 * SHOP_LAYOUT.message.textDx);
});

it("selects Large new badges and a Medium new walker's bubble and earnings plate", () => {
  const badges = ordinaryBadgeModalLayout(SCREEN_LAYOUT.screen, {
    buttonWidth: 116,
    height: CELEBRATION_PANEL.badgesHeight,
    width: CELEBRATION_PANEL.width,
  }).panel;
  expect(badges.width).toBe(328);
  expect(badges.x).toBe(CELEBRATION_PANEL.x);
  expect(badges.x).toBe(MODAL.margin);
  const greeting = { lines: ["", ""], style: GREETING_FIT.style };
  for (const panel of [
    newWalkerRows(fonts.body, 2, greeting, 100).bubble,
    zoneDoneRows(fonts.body, 100).plate,
  ]) {
    expect(panel.width).toBe(264);
    expect(panel.x).toBe((SCREEN_CONFIG.width - 264) / 2);
  }
  expect(GREETING_FIT.room).toBe(264 - 2 * MODAL.pad);
  expect(ZONE_EARNINGS_FIT.room).toBe(264 - 2 * MODAL.pad);
});
