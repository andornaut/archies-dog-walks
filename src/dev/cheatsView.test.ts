import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { fontFileMetrics, gameFont } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import { NEXT_WALK_OFF } from "./cheats.ts";
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

  it("draws the Add buttons compact, two to a row and apart, and every other action full width", () => {
    const pairs = current.rows.filter(({ buttons }) => buttons.length === 2);
    expect(pairs.length).toBeGreaterThan(0);
    for (const { buttons } of pairs) {
      const [a, b] = buttons;
      expect(a!.rect).toMatchObject(BUTTON_SIZE.compact);
      expect(rectsOverlap(a!.rect, b!.rect)).toBe(false);
      expect(b!.rect.x - (a!.rect.x + a!.rect.width)).toBe(BUTTON_SIZE.gap);
    }
    const reset = current.rows.find(({ label }) => label === words.cheats.resetSave);
    expect(reset?.buttons[0]?.rect.width).toBe(reset?.rect.width);
  });
});
