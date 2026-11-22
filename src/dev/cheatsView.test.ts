import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { fontFileMetrics, gameFont, inkWidth as fontInkWidth } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { MODAL, modalActionWidth } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import { BANK_GRANTS, NEXT_WALK_OFF } from "./cheats.ts";
import { type CheatRow, cheatRows, type CheatsState, cheatsView } from "./cheatsView.ts";

const MEASURE: PanelMeasure = {
  body: fontFileMetrics("font-body"),
  inkWidth: (_font, line) => line.length * 12,
  title: fontFileMetrics("font-title"),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (_width, text) => [text],
};
const words = gameData.menuText;
const HOME: CheatsState = {
  fpsCounter: false,
  linkCopied: false,
  next: NEXT_WALK_OFF,
  walk: undefined,
};
const WALK: CheatsState = {
  ...HOME,
  walk: { canFinish: true, upgradesLeft: gameData.upgradeDrawOrder },
};
const view = (state: CheatsState) =>
  cheatsView(MEASURE, { data: gameData, screen: SCREEN_CONFIG, words }, state);

// Each row's label, or its buttons' labels, and whether it is enabled.
function enabledByLabel(rows: readonly CheatRow[]): Map<string, boolean> {
  return new Map(
    rows.flatMap((row): [string, boolean][] => {
      switch (row.kind) {
        case "buttons":
          return row.buttons.map(({ enabled, label }) => [label, enabled]);
        case "divider":
        case "heading":
          return [];
        default:
          return [[row.label, row.enabled]];
      }
    }),
  );
}

describe("cheatRows", () => {
  const text = words.cheats;
  const headings = (rows: readonly CheatRow[]) =>
    rows.flatMap((row) =>
      row.kind === "heading" ? [row.text] : row.kind === "divider" ? ["|"] : [],
    );

  it("lists the cheats, This walk, Next walk and Start screen, then the other actions", () => {
    const rows = cheatRows(gameData, words, HOME);
    const { groups } = text;
    expect(headings(rows)).toEqual([
      groups.thisWalk,
      groups.nextWalk,
      groups.startScreen,
      "|",
      groups.other,
    ]);
    expect([...enabledByLabel(rows).keys()].at(-1)).toBe(text.resetSave);
  });

  it.each<[string, CheatsState, readonly string[], readonly string[]]>([
    [
      "on the Start screen",
      HOME,
      [text.startAt, text.unlockAll, text.fpsCounter, text.resetSave, "Add $500"],
      [text.refillHearts, text.finishZone, "Add $100"],
    ],
    [
      "during a walk",
      WALK,
      [text.refillHearts, text.finishZone, "Add $100", text.fpsCounter, text.showTips],
      [text.startAt, text.seed, text.unlockAll, "Add $500"],
    ],
  ])("keeps every row %s, disabling those that do not apply", (_, state, on, off) => {
    const enabled = enabledByLabel(cheatRows(gameData, words, state));
    expect([...enabledByLabel(cheatRows(gameData, words, HOME)).keys()]).toEqual([
      ...enabled.keys(),
    ]);
    expect(on.map((label) => enabled.get(label))).toEqual(on.map(() => true));
    expect(off.map((label) => enabled.get(label))).toEqual(off.map(() => false));
  });

  it("disables the upgrades the walk has, and Finish while it cannot finish", () => {
    const [picked, ...left] = gameData.upgradeDrawOrder;
    const state = { ...WALK, walk: { canFinish: false, upgradesLeft: left } };
    const enabled = enabledByLabel(cheatRows(gameData, words, state));
    expect(enabled.get(`Grant ${gameData.upgrades[picked!].name}`)).toBe(false);
    expect(enabled.get(text.finishZone)).toBe(false);
    const none = { ...WALK, walk: { canFinish: true, upgradesLeft: [] } };
    expect(enabledByLabel(cheatRows(gameData, words, none)).get(text.grantAllUpgrades)).toBe(false);
  });
});

describe("cheatsView", () => {
  const current = view(HOME);
  const { layout } = current;

  it("is the Large card as tall as the screen less its margins, its body between title and Close", () => {
    expect(layout.panel.height).toBe(SCREEN_CONFIG.height - 2 * MODAL.margin);
    expect(layout.panel.width).toBe(328);
    const footer = current.card.footer!;
    expect(footer.primary).toBe(true);
    expect(layout.viewport.y + layout.viewport.height).toBeLessThanOrEqual(footer.rect.y);
    expect(layout.viewport.y).toBeGreaterThanOrEqual(layout.panel.y + MODAL.header);
    expect(layout.contentHeight).toBeGreaterThan(layout.viewport.height);
  });

  it("stacks the rows a list's gap apart, inside the body beside its scrollbar", () => {
    const rects = current.rows.map(({ rect }) => rect);
    rects.slice(1).forEach((rect, i) => {
      expect(rect.y - (rects[i]!.y + rects[i]!.height)).toBe(BUTTON_SIZE.stackGap);
    });
    for (const rect of rects) {
      expect(rect.x + rect.width).toBeLessThan(layout.scrollbar.x);
    }
  });

  it("sizes horizontal Add actions to their labels and keeps the vertical actions full width", () => {
    const pairs = current.rows.filter(({ buttons }) => buttons.length === 2);
    expect(pairs.length).toBeGreaterThan(0);
    for (const { buttons } of pairs) {
      const [a, b] = buttons;
      for (const button of buttons) {
        expect(button.rect.width).toBe(modalActionWidth(MEASURE.inkWidth("title", button.label)));
        expect(button.rect.height).toBe(BUTTON_SIZE.compact.height);
      }
      expect(rectsOverlap(a!.rect, b!.rect)).toBe(false);
      if (a!.rect.y === b!.rect.y) {
        expect(b!.rect.x - (a!.rect.x + a!.rect.width)).toBe(BUTTON_SIZE.gap);
      } else {
        expect(b!.rect.y - (a!.rect.y + a!.rect.height)).toBe(BUTTON_SIZE.stackGap);
      }
    }
    const reset = current.rows.find(({ label }) => label === words.cheats.resetSave);
    expect(reset?.buttons[0]?.rect.width).toBe(reset?.rect.width);
  });
});

const ACTUAL_MEASURE: PanelMeasure = {
  ...MEASURE,
  inkWidth: (font, label) =>
    fontInkWidth(`font-${font}`, { scale: 2 }, font === "title" ? label.toUpperCase() : label),
};

it("centres each real-money action row, including the lone final grant, without changing actions", () => {
  const current = cheatsView(
    ACTUAL_MEASURE,
    { data: gameData, screen: SCREEN_CONFIG, words },
    HOME,
  );
  const horizontal = new Set(
    cheatRows(gameData, words, HOME).flatMap((row) =>
      row.kind === "buttons" && row.compact ? row.buttons.map(({ label }) => label) : [],
    ),
  );
  const rows = current.rows.filter((row) => row.buttons.some(({ label }) => horizontal.has(label)));
  expect(rows.some((row) => row.buttons.length === 1)).toBe(true);
  expect(
    rows.flatMap((row) =>
      row.buttons.flatMap(({ action }) => (action.kind === "addBank" ? [action.amount] : [])),
    ),
  ).toEqual(BANK_GRANTS);
  for (const row of rows) {
    const left = Math.min(...row.buttons.map(({ rect }) => rect.x));
    const right = Math.max(...row.buttons.map(({ rect }) => rect.x + rect.width));
    expect((left + right) / 2).toBe(row.rect.x + row.rect.width / 2);
    for (const button of row.buttons) {
      expect(button.rect.width).toBe(
        modalActionWidth(ACTUAL_MEASURE.inkWidth("title", button.label)),
      );
      expect(button.hit).toEqual(button.rect);
    }
  }
});

it("fits the exact available width and wraps one pixel beyond it into centred intrinsic rows", () => {
  const baseline = cheatsView(
    ACTUAL_MEASURE,
    { data: gameData, screen: SCREEN_CONFIG, words },
    HOME,
  );
  const index = baseline.rows.findIndex((row) => row.buttons.length === 2);
  const source = baseline.rows[index]!;
  const [first, second] = source.buttons;
  const firstWidth = Math.floor((source.rect.width - BUTTON_SIZE.gap) / 2);
  const secondWidth = source.rect.width - BUTTON_SIZE.gap - firstWidth;
  const measured = (extra: number): PanelMeasure => ({
    ...ACTUAL_MEASURE,
    inkWidth: (font, label) =>
      label === first!.label
        ? firstWidth - 2 * MODAL.pad
        : label === second!.label
          ? secondWidth - 2 * MODAL.pad + extra
          : ACTUAL_MEASURE.inkWidth(font, label),
  });
  const exact = cheatsView(measured(0), { data: gameData, screen: SCREEN_CONFIG, words }, HOME);
  const wrapped = cheatsView(measured(1), { data: gameData, screen: SCREEN_CONFIG, words }, HOME);
  const before = exact.rows[index]!;
  const after = wrapped.rows[index]!;
  expect(before.buttons.map(({ rect }) => rect.y)).toEqual([before.rect.y, before.rect.y]);
  expect(before.buttons[0]!.rect.x).toBe(before.rect.x);
  expect(before.buttons[1]!.rect.x + before.buttons[1]!.rect.width).toBe(
    before.rect.x + before.rect.width,
  );
  expect(after.buttons[1]!.rect.y - after.buttons[0]!.rect.y).toBe(
    BUTTON_SIZE.compact.height + BUTTON_SIZE.stackGap,
  );
  for (const { rect } of after.buttons) {
    expect(rect.x + rect.width / 2).toBe(after.rect.x + after.rect.width / 2);
  }
  expect(
    after.buttons.map(({ action, available, label }) => ({ action, available, label })),
  ).toEqual(before.buttons.map(({ action, available, label }) => ({ action, available, label })));
  expect(after.rect.width).toBe(before.rect.width);
  expect(wrapped.layout.contentHeight - exact.layout.contentHeight).toBe(
    BUTTON_SIZE.compact.height + BUTTON_SIZE.stackGap,
  );
  expect(wrapped.rows[index + 1]!.rect.y - exact.rows[index + 1]!.rect.y).toBe(
    BUTTON_SIZE.compact.height + BUTTON_SIZE.stackGap,
  );
});

describe("the Grant rows", () => {
  it("are one per upgrade, in draw order, every upgrade included", () => {
    const grants = cheatRows(gameData, words, WALK).flatMap((row) =>
      row.kind === "buttons"
        ? row.buttons.flatMap(({ action }) => (action.kind === "upgrade" ? [action.upgrade] : []))
        : [],
    );
    expect(grants).toEqual(gameData.upgradeDrawOrder);
    expect([...grants].sort()).toEqual(Object.keys(gameData.upgrades).sort());
  });
});
