import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SETTINGS_CARD } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { SETTINGS_SWITCH_GAP, settingsLayout, switchRowHeight } from "../home/settings.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { MODAL, modalActionWidth } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../ui/modal/types.ts";
import { PAGE_LAYOUT } from "../ui/pageLayout.ts";
import { SEPARATOR } from "../ui/separator.ts";
import {
  ACTION_LABEL_SCALE,
  actionLabelWidth,
  MODAL_TITLE_SCALE,
  TEXT_SCALE,
} from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { BANK_GRANTS, NEXT_WALK_OFF, startZones } from "./cheats.ts";
import { balancedWords, type CheatsState, cheatsView } from "./cheatsView.ts";

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
const view = (state: CheatsState) => cheatsView(MEASURE, { data: gameData, words }, state);
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

  // Art's page geometry (art/layout.md#settings-and-cheats-pages): the body from 24 under the
  // title row to 8 over Back's face, the rows' column, and the two columns 16 apart.
  it("scrolls the rows in the page's body, Back fixed under it", () => {
    const { layout, page } = current;
    expect(page.back).toMatchObject({ label: words.pageBack, primary: true });
    expect(page.back.rect.x).toBe(Math.floor((SCREEN_CONFIG.width - page.back.rect.width) / 2));
    expect(layout.viewport).toEqual({ height: 389, width: 330, x: 8, y: 103 });
    expect(page.back.rect.y - (layout.viewport.y + layout.viewport.height)).toBe(8);
    expect(page.title.map(({ text }) => text)).toEqual([words.cheats.title]);
    expect(layout.contentHeight).toBeGreaterThan(layout.viewport.height);
    expect(view(WALK).layout).toEqual(layout);
  });

  it("sizes Reset save to its label, centred in its row as Settings' Install is", () => {
    const reset = buttons(HOME).at(-1)!;
    expect(reset.rect.width).toBe(
      modalActionWidth(MEASURE.inkWidth("title", words.cheats.resetSave)),
    );
    expect(reset.rect.x).toBe(8 + Math.floor((330 - reset.rect.width) / 2));
  });

  it("lays the invincible switch row out as Settings' switch rows, as tall as one", () => {
    const switches = current.rows.filter(({ kind }) => kind === "switch");
    expect(switches).toHaveLength(1);
    const [invincible] = switches;
    expect(invincible?.action?.kind).toBe("invincible");
    const { rect } = invincible!;
    expect(rect.height).toBe(switchRowHeight(MEASURE.title));
    const settings = settingsLayout(MEASURE, [{ kind: "switch", noteLines: 0 }]).rows[0]!;
    const sw = settings.control!;
    const dy = rect.y - settings.rect.y;
    expect(invincible!.switch).toEqual({ on: false });
    expect(invincible!.texts[0]).toMatchObject({
      capTop: settings.labelY + dy,
      centre: "left",
      centreX: rect.x + SETTINGS_CARD.row.icon.dx,
    });
    // The state word's ink is centred on the switch.
    expect(invincible!.texts[1]).toMatchObject({
      capTop: sw.y + dy + sw.height + SETTINGS_SWITCH_GAP,
      centre: "ink",
      centreX: sw.x + sw.width / 2,
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

  it("sets every divider as the one separator, the stacked gap clear of its neighbours", () => {
    const dividers = current.rows.flatMap((row, i) => (row.kind === "divider" ? [i] : []));
    expect(dividers).toHaveLength(3);
    for (const i of dividers) {
      const [before, line] = [current.rows[i - 1]!.rect, current.rows[i]!.rect];
      const after = current.rows.slice(i + 1).find(({ rect }) => rect.x === line.x)!.rect;
      expect([line.height, line.width]).toEqual([SEPARATOR.height, current.rows[0]!.rect.width]);
      const above = current.rows
        .slice(0, i)
        .reduce((bottom, { rect }) => Math.max(bottom, rect.y + rect.height), 0);
      expect(line.y - above).toBe(SEPARATOR.clear);
      expect(above).toBeGreaterThanOrEqual(before.y + before.height);
      expect(after.y - (line.y + line.height)).toBe(SEPARATOR.clear);
    }
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
        if (left!.rect.y !== right!.rect.y) {
          expect(right!.rect.y).toBe(left!.rect.y + left!.rect.height + BUTTON_SIZE.stackGap);
          expect([left!.rect.x, left!.rect.width]).toEqual([right!.rect.x, right!.rect.width]);
          expect(rectsOverlap(left!.rect, right!.rect)).toBe(false);
          continue;
        }
        expect(left!.rect.y).toBe(right!.rect.y);
        expect([left!.rect.x, left!.rect.width, right!.rect.x, right!.rect.width]).toEqual([
          8,
          157,
          8 + 157 + BUTTON_SIZE.gap,
          157,
        ]);
        expect(rectsOverlap(left!.rect, right!.rect)).toBe(false);
      }
    }
    expect(all.some(({ lines }) => lines.length > 1)).toBe(true);
    for (const { hit, label, lines, rect } of all) {
      expect(hit).toEqual(rect);
      expect(lines.map(({ text }) => text).join(" ")).toBe(label);
      expect(rect.x + rect.width).toBeLessThan(PAGE_LAYOUT.scrollbar.x);
      for (const line of lines) {
        expect(line.scale).toBe(ACTION_LABEL_SCALE);
        // A line of words wraps at the label room; a single word may take the button's rows room.
        expect(actionLabelWidth(MEASURE.inkWidth("title", line.text))).toBeLessThanOrEqual(
          rect.width - 2 * (line.text.includes(" ") ? MODAL.gap : MODAL.rowGap),
        );
        const ink = MEASURE.titleInk(line.text);
        expect(line.capTop + (ink.top * ACTION_LABEL_SCALE) / MODAL_TITLE_SCALE).toBeGreaterThan(
          rect.y,
        );
        expect(line.capTop + (ink.bottom * ACTION_LABEL_SCALE) / MODAL_TITLE_SCALE).toBeLessThan(
          rect.y + rect.height,
        );
      }
    }
  });

  it("keeps High Park and Cabbagetown together whenever their shared full-size column room fits", () => {
    const zones = buttons(HOME).filter(({ action }) => action.kind === "startAt");
    const pair = ["highPark", "cabbagetown"].map((id) =>
      zones.find(({ action }) => action.kind === "startAt" && action.zone === id)!,
    );
    const room = 157 - 2 * MODAL.rowGap;
    const fits = pair.every(({ label }) =>
      label
        .split(/\s+/u)
        .every((word) => actionLabelWidth(MEASURE.inkWidth("title", word)) <= room),
    );
    expect(pair[0]!.rect.y === pair[1]!.rect.y).toBe(fits);
    expect(pair.map(({ lines }) => lines.map(({ text }) => text).join(" "))).toEqual(
      pair.map(({ label }) => label),
    );
  });

  it.each([
    ["three words onto two lines", "Unlock Dog Slots", 10, ["Unlock", "Dog Slots"]],
    ["two words onto two lines", "Yonge Street", 8, ["Yonge", "Street"]],
    ["a label that fits", "Unlock Dogs", 11, ["Unlock Dogs"]],
  ])("wraps %s with the widest line narrowest", (_what, text, room, lines) => {
    expect(balancedWords((line) => line.length, room, text)).toEqual(lines);
  });

  // An unbreakable neighbourhood name gets the existing stacked action-group fallback.
  it.each([["Cabbagetown", gameData.world.zones.find(({ id }) => id === "cabbagetown")!.name]])(
    "keeps %s on one full-size line",
    (_, label) => {
      const button = buttons(HOME).find((candidate) => candidate.label === label)!;
      expect(button.lines.map(({ text }) => text)).toEqual([label]);
      expect(actionLabelWidth(MEASURE.inkWidth("title", label))).toBeLessThanOrEqual(
        button.rect.width - 2 * (label.includes(" ") ? MODAL.gap : MODAL.rowGap),
      );
    },
  );

  it("wraps Unlock Dog Slots balanced in its button", () => {
    const button = buttons(HOME).find(({ label }) => label === words.cheats.ownDogSlots)!;
    expect(button.lines.map(({ text }) => text)).toEqual(
      balancedWords(
        (line) => actionLabelWidth(MEASURE.inkWidth("title", line)),
        button.rect.width - 2 * MODAL.gap,
        words.cheats.ownDogSlots,
      ),
    );
    expect(button.lines).toHaveLength(2);
    expect(MEASURE.inkWidth("title", button.lines[0]!.text)).toBeLessThan(
      MEASURE.inkWidth("title", button.lines[1]!.text),
    );
  });
});
