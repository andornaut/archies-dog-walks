import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MODAL_WIDTHS, SETTINGS_CARD } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { SWITCH_STATE_GAP } from "../home/settings.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import { MODAL_TITLE_SCALE, TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { BANK_GRANTS, NEXT_WALK_OFF, startZones } from "./cheats.ts";
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
  canResetSave: false,
  next: NEXT_WALK_OFF,
  walk: undefined,
};
const WALK: CheatsState = {
  ...HOME,
  walk: { invincible: false, zone: startZones(gameData)[0]! },
};
const view = (state: CheatsState, screen: { height: number; width: number } = SCREEN_CONFIG) =>
  cheatsView(MEASURE, { data: gameData, screen, words }, state);
const buttons = (state: CheatsState) => view(state).rows.flatMap((row) => row.buttons);

describe("Cheats actions", () => {
  it("keeps the approved groups and gives every neighbourhood its direct action in game order", () => {
    const { groups, startAt } = words.cheats;
    expect(view(HOME).rows.flatMap((row) => (row.kind === "heading" ? [row.label] : []))).toEqual([
      startAt,
      groups.unlocks,
      groups.money,
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
    expect(view(HOME).rows.at(-1)?.buttons[0]).toMatchObject({
      action: { kind: "resetSave" },
      available: false,
    });
    expect(view({ ...HOME, canResetSave: true }).rows.at(-1)?.buttons[0]?.available).toBe(true);
    const visible = view(HOME).rows.flatMap((row) => [
      ...(row.action === undefined ? [] : [row.action.kind]),
      ...row.buttons.map(({ action }) => action.kind),
    ]);
    expect(visible).not.toContain("copyRunLink");
    expect(visible).not.toContain("pocket");
    expect(visible).not.toContain("speed");
    expect(visible).not.toContain("fpsCounter");
  });

  it("offers every retained cheat at Start and during a walk", () => {
    expect(BANK_GRANTS).toEqual([cents(10_000), cents(100_000), cents(1_000_000)]);
    for (const state of [HOME, WALK]) {
      const current = buttons(state);
      const adds = current.filter(({ action }) => action.kind === "addBank");
      expect(adds.map(({ action, available }) => ({ action, available }))).toEqual(
        BANK_GRANTS.map((amount) => ({ action: { amount, kind: "addBank" }, available: true })),
      );
      const unlocks = current.filter(({ action }) => action.kind === "own");
      expect(unlocks.map(({ action, available }) => ({ action, available }))).toEqual(
        ["walkers", "dogSlots", "dogs", "gear"].map((grant) => ({
          action: { grant, kind: "own" },
          available: true,
        })),
      );
      expect(
        current
          .filter(({ action }) => action.kind === "startAt")
          .every(({ available }) => available === true),
      ).toBe(true);
      expect(view(state).rows.find(({ action }) => action?.kind === "invincible")?.enabled).toBe(
        true,
      );
    }
  });

  it("shows the live invincibility and neighbourhood instead of staged Start choices", () => {
    const zone = startZones(gameData)[2]!;
    const state: CheatsState = {
      ...HOME,
      next: { ...HOME.next, start: startZones(gameData)[1]! },
      walk: { invincible: true, zone },
    };
    expect(view(state).rows.find(({ kind }) => kind === "switch")?.texts[1]?.text).toBe(
      words.settings.on,
    );
    expect(
      buttons(state)
        .filter(({ selected }) => selected)
        .map(({ action }) => action),
    ).toEqual([{ kind: "startAt", zone }]);
  });

  it.each([HOME, WALK])("keeps only the retained visible actions in either context", (state) => {
    const visible = view(state).rows.flatMap((row) => [
      ...(row.action === undefined ? [] : [row.action.kind]),
      ...row.buttons.map(({ action }) => action.kind),
    ]);
    expect(new Set(visible)).toEqual(
      new Set(["invincible", "startAt", "own", "addBank", "resetSave"]),
    );
    expect(buttons(state).at(-1)?.action.kind).toBe("resetSave");
  });
});

describe("Cheats layout", () => {
  const current = view(HOME);

  it("takes the Large width, clamps to safe sides, and caps measured height only for overflow", () => {
    const { layout } = current;
    expect(layout.panel).toMatchObject({
      height: SCREEN_CONFIG.height - 2 * MODAL.margin,
      width: MODAL_WIDTHS.large,
      x: MODAL.margin,
    });
    expect(layout.contentHeight).toBeGreaterThan(layout.viewport.height);
    const footer = current.card.footer!;
    expect(footer).toMatchObject({ label: words.pageBack, primary: true });
    expect(footer.rect.x + footer.rect.width / 2).toBe(SCREEN_CONFIG.width / 2);
    expect(layout.viewport.y + layout.viewport.height).toBeLessThanOrEqual(footer.rect.y);
    expect(layout.viewport.y).toBe(layout.panel.y + MODAL.header);
    expect(current.card.close?.hit.x).toBeGreaterThan(footer.rect.x);
    expect(view(HOME, { ...SCREEN_CONFIG, width: 352 }).layout.panel).toMatchObject({
      width: 352 - 2 * MODAL.margin,
      x: MODAL.margin,
    });
    const tall = view(HOME, { height: 3000, width: SCREEN_CONFIG.width }).layout;
    expect(tall.contentHeight).toBe(tall.viewport.height);
    expect(tall.panel.height).toBeLessThan(3000 - 2 * MODAL.margin);
    expect(tall.panel.y + tall.panel.height / 2).toBeCloseTo(1500, 0);
  });

  it("gives the invincible switch a 48px target around its visible control", () => {
    const switches = current.rows.filter(({ kind }) => kind === "switch");
    expect(switches).toHaveLength(1);
    const [invincible] = switches;
    expect(invincible?.action?.kind).toBe("invincible");
    expect(invincible?.rect.height).toBe(48);
    expect(invincible?.switch?.y).toBeGreaterThan(invincible!.rect.y);
    const sw = invincible!.switch!;
    const { height, width } = SETTINGS_CARD.row.switch;
    expect(sw.x + width).toBe(invincible!.rect.x + invincible!.rect.width);
    expect(invincible!.texts[0]?.centreX).toBe(invincible!.rect.x);
    expect(invincible!.texts[1]).toMatchObject({
      capTop: sw.y + height + SWITCH_STATE_GAP,
      centre: "ink",
      centreX: sw.x + width / 2,
      text: words.settings.off,
    });
    const on = view({ ...HOME, next: { ...HOME.next, invincible: true } }).rows.find(
      ({ kind }) => kind === "switch",
    );
    expect(on?.texts[1]?.text).toBe(words.settings.on);
    const index = current.rows.indexOf(invincible!);
    expect(current.rows.slice(index + 1, index + 3)).toMatchObject([
      { kind: "divider" },
      { kind: "heading", label: words.cheats.startAt },
    ]);
  });

  it("sets the neighbourhood divider 16px from the last button and Unlocks/Money headings", () => {
    const unlocks = current.rows.findIndex((row) => row.label === words.cheats.groups.unlocks);
    const index = unlocks - 1;
    expect(current.rows[index]?.kind).toBe("divider");
    const [before, divider, after] = current.rows
      .slice(index - 1, index + 2)
      .map(({ rect }) => rect);
    const line = divider!.y + Math.floor(divider!.height / 2);
    expect(line - (before!.y + before!.height)).toBe(16);
    expect(after!.y - (line + 1)).toBe(16);
  });

  it("lays out the neighbourhood pairs and Unlocks/Money columns in the body room with full ink", () => {
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
        expect([left!.rect.x, left!.rect.width, right!.rect.x, right!.rect.width]).toEqual([
          current.layout.panel.x + MODAL.pad,
          144,
          current.layout.panel.x + MODAL.pad + 144 + MODAL.gap,
          144,
        ]);
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
