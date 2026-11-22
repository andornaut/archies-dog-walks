import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import { MODAL_TITLE_SCALE, TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { BANK_GRANTS, NEXT_WALK_OFF, startZones, WALK_GRANT } from "./cheats.ts";
import { type CheatsState, cheatsView } from "./cheatsView.ts";

const MEASURE: PanelMeasure = {
  body: fontFileMetrics("font-body"),
  inkWidth: (font, label) =>
    inkWidth(`font-${font}`, { scale: TEXT_SCALE }, font === "title" ? label.toUpperCase() : label),
  title: fontFileMetrics("font-title"),
  titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
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
const view = (state: CheatsState, screen: { height: number; width: number } = SCREEN_CONFIG) =>
  cheatsView(MEASURE, { data: gameData, screen, words }, state);
const buttons = (state: CheatsState) => view(state).rows.flatMap((row) => row.buttons);

describe("Cheats actions", () => {
  it("keeps the approved groups and gives every neighbourhood its direct action in game order", () => {
    const { groups, startAt } = words.cheats;
    expect(view(HOME).rows.flatMap((row) => (row.kind === "heading" ? [row.label] : []))).toEqual([
      groups.nextWalk,
      startAt,
      groups.startScreen,
      groups.unlocks,
      groups.money,
      groups.thisWalk,
      groups.other,
    ]);
    const chosen = startZones(gameData)[2]!;
    const zoneButtons = buttons({ ...HOME, next: { ...HOME.next, start: chosen } }).filter(
      ({ action }) => action.kind === "startAt",
    );
    expect(zoneButtons.map(({ action, label }) => ({ action, label }))).toEqual(
      gameData.world.zones.map(({ id, name }) => ({
        action: { kind: "startAt", zone: id },
        label: name,
      })),
    );
    expect(zoneButtons.filter(({ selected }) => selected).map(({ action }) => action)).toEqual([
      { kind: "startAt", zone: chosen },
    ]);
    expect(view(HOME).rows.at(-1)?.buttons[0]?.action.kind).toBe("resetSave");
    const visible = view(HOME).rows.flatMap((row) => [
      ...(row.action === undefined ? [] : [row.action.kind]),
      ...row.buttons.map(({ action }) => action.kind),
    ]);
    expect(visible).not.toContain("copyRunLink");
    expect(visible).not.toContain("pocket");
    expect(visible).not.toContain("speed");
    expect(visible.filter((kind) => kind === "fpsCounter")).toHaveLength(1);
  });

  it("offers five unlocks and the three bank amounts only at Start and retains the walk grant", () => {
    expect(BANK_GRANTS).toEqual([cents(10_000), cents(100_000), cents(1_000_000)]);
    for (const [state, isHome] of [
      [HOME, true],
      [WALK, false],
    ] as const) {
      const current = buttons(state);
      const adds = current.filter(({ action }) => action.kind === "addBank");
      expect(adds.map(({ action, available }) => ({ action, available }))).toEqual(
        BANK_GRANTS.map((amount) => ({ action: { amount, kind: "addBank" }, available: isHome })),
      );
      const unlocks = current.filter(({ action }) => action.kind === "own");
      expect(unlocks.map(({ action, available }) => ({ action, available }))).toEqual(
        ["walkers", "dogs", "dogSlots", "gear", "all"].map((grant) => ({
          action: { grant, kind: "own" },
          available: isHome,
        })),
      );
      expect(current.find(({ action }) => action.kind === "addMoney")).toMatchObject({
        available: !isHome,
        label: `Add $${WALK_GRANT / 100}`,
      });
      expect(
        current
          .filter(({ action }) => action.kind === "startAt")
          .every(({ available }) => available === isHome),
      ).toBe(true);
      expect(view(state).rows.find(({ action }) => action?.kind === "fpsCounter")?.enabled).toBe(
        true,
      );
      expect(view(state).rows.find(({ action }) => action?.kind === "invincible")?.enabled).toBe(
        isHome,
      );
    }
  });

  it("lists each upgrade in draw order, refusing a used upgrade or a finish that cannot happen", () => {
    const [picked, ...left] = gameData.upgradeDrawOrder;
    const state = { ...WALK, walk: { canFinish: false, upgradesLeft: left } };
    const current = buttons(state);
    expect(
      current.flatMap(({ action }) => (action.kind === "upgrade" ? [action.upgrade] : [])),
    ).toEqual(gameData.upgradeDrawOrder);
    expect(
      current.find(({ action }) => action.kind === "upgrade" && action.upgrade === picked)
        ?.available,
    ).toBe(false);
    expect(current.find(({ action }) => action.kind === "finishZone")?.available).toBe(false);
    const none = { ...WALK, walk: { canFinish: true, upgradesLeft: [] } };
    expect(buttons(none).find(({ action }) => action.kind === "upgrades")?.available).toBe(false);
  });
});

describe("Cheats layout", () => {
  const current = view(HOME);

  it("keeps the 344px width, clamps to safe sides, and caps measured height only for overflow", () => {
    const { layout } = current;
    expect(layout.panel).toMatchObject({
      height: SCREEN_CONFIG.height - 2 * MODAL.margin,
      width: 344,
      x: 8,
    });
    expect(layout.contentHeight).toBeGreaterThan(layout.viewport.height);
    const footer = current.card.footer!;
    expect(footer).toMatchObject({ label: words.pageBack, primary: true });
    expect(footer.rect.x + footer.rect.width / 2).toBe(SCREEN_CONFIG.width / 2);
    expect(layout.viewport.y + layout.viewport.height).toBeLessThanOrEqual(footer.rect.y);
    expect(layout.viewport.y).toBe(layout.panel.y + MODAL.header);
    expect(current.card.close?.hit.x).toBeGreaterThan(footer.rect.x);
    expect(view(HOME, { ...SCREEN_CONFIG, width: 352 }).layout.panel).toMatchObject({
      width: 336,
      x: 8,
    });
    const tall = view(HOME, { height: 3000, width: SCREEN_CONFIG.width }).layout;
    expect(tall.contentHeight).toBe(tall.viewport.height);
    expect(tall.panel.height).toBeLessThan(3000 - 2 * MODAL.margin);
    expect(tall.panel.y + tall.panel.height / 2).toBeCloseTo(1500, 0);
  });

  it("gives the adjacent toggles two disjoint 48px hits with a 36px visible pitch", () => {
    const [fps, invincible] = current.rows.filter(({ kind }) => kind === "switch");
    expect(fps?.action?.kind).toBe("fpsCounter");
    expect(invincible?.action?.kind).toBe("invincible");
    expect(fps!.rect.height).toBe(48);
    expect(invincible!.rect.height).toBe(48);
    expect(invincible!.rect.y - fps!.rect.y).toBe(48);
    expect(invincible!.switch!.y - fps!.switch!.y).toBe(36);
    expect(invincible!.texts[0]!.capTop - fps!.texts[0]!.capTop).toBe(36);
    expect(invincible!.texts[1]!.capTop - fps!.texts[1]!.capTop).toBe(36);
    expect(invincible!.switch!.x).toBe(fps!.switch!.x);
  });

  it("sets the Next Walk divider 16px from the last button and Start Screen heading", () => {
    const index = current.rows.findIndex((row) => row.kind === "divider");
    const [before, divider, after] = current.rows
      .slice(index - 1, index + 2)
      .map(({ rect }) => rect);
    const line = divider!.y + Math.floor(divider!.height / 2);
    expect(line - (before!.y + before!.height)).toBe(16);
    expect(after!.y - (line + 1)).toBe(16);
  });

  it("lays out the neighbourhood pairs and Unlocks/Money columns with equal safe gaps and full ink", () => {
    const all = current.rows.flatMap((row) => row.buttons);
    const zones = all.filter(({ action }) => action.kind === "startAt");
    const unlocks = all.filter(({ action }) => action.kind === "own");
    const adds = all.filter(({ action }) => action.kind === "addBank");
    for (const pairs of [
      zones.filter((_, i) => i % 2 === 0).map((z, i) => [z, zones[2 * i + 1]!]),
      adds.map((add, i) => [unlocks[i]!, add]),
    ]) {
      for (const [left, right] of pairs) {
        expect(left!.rect.y).toBe(right!.rect.y);
        expect(right!.rect.x - (left!.rect.x + left!.rect.width)).toBe(16);
        expect(rectsOverlap(left!.rect, right!.rect)).toBe(false);
      }
    }
    expect(all.some(({ lines }) => lines.length > 1)).toBe(true);
    for (const { hit, label, lines, rect } of all) {
      expect(hit).toEqual(rect);
      expect(lines.map(({ text }) => text).join(" ")).toBe(label);
      expect(rect.x + rect.width).toBeLessThan(current.layout.scrollbar.x);
      for (const line of lines) {
        expect(line.scale).toBe(TEXT_SCALE);
        expect(MEASURE.inkWidth("title", line.text)).toBeLessThanOrEqual(
          rect.width - 2 * MODAL.gap,
        );
        const ink = MEASURE.titleInk(line.text);
        expect(line.capTop + (ink.top * TEXT_SCALE) / MODAL_TITLE_SCALE).toBeGreaterThan(rect.y);
        expect(line.capTop + (ink.bottom * TEXT_SCALE) / MODAL_TITLE_SCALE).toBeLessThan(
          rect.y + rect.height,
        );
      }
    }
  });
});
