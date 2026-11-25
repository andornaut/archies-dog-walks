import { describe, expect, it } from "vitest";

import { DOM_ART_KEYS } from "../assets/domArt.ts";
import { gameData } from "../data/index.ts";
import { SETTINGS_CARD } from "../data/layout.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import { fontFileMetrics, fontInkRows, gameFont } from "../testing/fontInk.ts";
import { blockPlace, inkEnd, shownText } from "../ui/dom/pixelLine.ts";
import { deviceX, domScale, fontPixel } from "../ui/domScale.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { FEEDBACK } from "./feedback.ts";
import { installStepsLayout, settingsLayout } from "./settings.ts";
import {
  SETTINGS_ART_KEYS,
  type SettingsMeasure,
  settingsRows,
  type SettingsState,
  settingsView,
} from "./settingsView.ts";

const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
const MEASURE: SettingsMeasure = {
  body: fonts.body,
  fitBody: (_lines, _room, text) => [text],
  ink: (_font, scale, text) => ({ left: scale, right: text.length * 6 * scale }),
  inkWidth: (_font, line) => line.length * 12,
  title: fonts.title,
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (_width, text) => [text],
};
const rows = settingsRows(true);
const layout = settingsLayout(
  fonts,
  SCREEN_CONFIG,
  rows.map((row) =>
    row.kind === "slider"
      ? { kind: "slider" }
      : { kind: row.kind, noteLines: row.kind === "button" || row.note === undefined ? 0 : 1 },
  ),
);
const STATE: SettingsState = {
  dim: SCREEN_LAYOUT.screen,
  dragging: undefined,
  focus: null,
  pressed: undefined,
  settings: DEFAULT_SETTINGS,
  steps: undefined,
};
const view = (state: Partial<SettingsState>, footerLabel?: string) =>
  settingsView(
    MEASURE,
    {
      art: () => ({ height: 16, width: 16 }),
      ...(footerLabel === undefined ? {} : { footerLabel }),
      layout,
      rows,
      words: gameData.menuText.settings,
    },
    { ...STATE, ...state },
  );

describe("settingsView", () => {
  it.each([
    ["navigation return", gameData.menuText.pageBack, gameData.menuText.pageBack],
    ["standalone dismissal", undefined, gameData.menuText.common.close],
  ])(
    "labels its primary footer for %s without changing the close icon",
    (_case, label, expected) => {
      const current = view({}, label);
      expect(current.card.footer).toMatchObject({ label: expected, primary: true });
      expect(current.card.close).toEqual(view({}).card.close);
    },
  );

  it("uses readable body text for the centred build label and retains footer clearance", () => {
    const current = view({});
    expect(current.rowsViewport).toEqual(layout.rowsViewport);
    expect(current.rowsContentHeight).toBe(layout.rowsContentHeight);
    expect(current.build.font).toBe("body");
    expect(current.build.scale).toBe(TEXT_SCALE);
    expect(current.build.centre).toBe("ink");
    expect(current.build.centreX).toBe(current.card.panel.x + current.card.panel.width / 2);
    const visibleInk = fontInkRows("font-body", { scale: current.build.scale }, current.build.text);
    expect(current.card.footer!.rect.y - current.build.capTop - visibleInk.bottom).toBe(MODAL.gap);
  });

  it.each([false, true])("shows current switch states with mute %s and stable help", (muted) => {
    for (const reducedMotion of [false, true]) {
      const fpsCounter = !reducedMotion;
      const current = view({ settings: { ...DEFAULT_SETTINGS, fpsCounter, muted, reducedMotion } });
      expect(current.rows.at(-1)).toMatchObject({
        description: "",
        icon: { key: "icon-fps-counter-panel", tag: "idle" },
        key: "fpsCounter",
        switch: { on: fpsCounter },
        texts: [
          { lines: [gameData.menuText.settings.fpsCounter] },
          {
            lines: [
              fpsCounter ? gameData.menuText.settings.shown : gameData.menuText.settings.hidden,
            ],
          },
        ],
      });
      for (const [index, on, label, description] of [
        [0, !muted, gameData.menuText.settings.sound, gameData.menuText.settings.soundNote],
        [
          3,
          reducedMotion,
          gameData.menuText.settings.motion,
          gameData.menuText.settings.motionNote,
        ],
      ] as const) {
        const row = current.rows[index];
        expect(row?.label).toBe(label);
        expect(row?.description).toBe(description);
        expect(row?.switch?.on).toBe(on);
        expect(row?.texts.at(-1)?.lines).toEqual([
          on ? gameData.menuText.settings.on : gameData.menuText.settings.off,
        ]);
      }
      for (const row of current.rows.filter(({ kind }) => kind === "switch")) {
        const art = row.switch!.art;
        const state = row.texts.at(-1)!;
        expect(state.capTop - art.y - SETTINGS_CARD.row.switch.height).toBeGreaterThan(0);
        expect(state).toMatchObject({
          anchor: "inkRight",
          x: art.x + SETTINGS_CARD.row.switch.width,
        });
      }
    }
  });

  // The Settings switch's last column is x = 319 on the 360-wide screen.
  it.each([1, 2, 3])("ends each state word's ink on its switch's last column at DPR %d", (dpr) => {
    const scale = domScale(dpr, { height: SCREEN_CONFIG.height, width: 360, x: 0, y: 0 });
    const font = gameFont("font-title");
    for (const row of view({}).rows.filter(({ kind }) => kind === "switch")) {
      const art = row.switch!.art;
      const state = row.texts.at(-1)!;
      const place = blockPlace(font, scale, state);
      const end =
        place.runs[0]!.left +
        inkEnd(font, shownText("title", state.lines[0]!)) * fontPixel(scale, state.scale);
      expect(art.x + SETTINGS_CARD.row.switch.width - 1).toBe(319);
      expect(end).toBe(deviceX(scale, art.x + SETTINGS_CARD.row.switch.width));
    }
  });

  it.each([false, true])(
    "keeps FPS last on the shared label axis with Install offered %s",
    (installable) => {
      const configured = settingsRows(installable);
      expect(configured.at(-1)?.key).toBe("fpsCounter");
      expect(configured.at(-2)?.key).toBe(installable ? "install" : "reducedMotion");
      const fps = view({}).rows.at(-1)!;
      const sound = view({}).rows[0]!;
      expect(fps.icon).toMatchObject({
        key: "icon-fps-counter-panel",
        x: sound.icon?.x,
        y: fps.texts[0]!.capTop - (SETTINGS_CARD.row.label.dy - SETTINGS_CARD.row.icon.dy),
      });
      expect(fps.texts[0]!.x - fps.rect.x).toBe(SETTINGS_CARD.row.label.dx);
      expect(fps.texts[0]!.x).toBe(sound.texts[0]!.x);
      expect(fps.switch!.art.x).toBe(sound.switch!.art.x);
    },
  );

  it("dips a pressed row's face, icon, text and switch together", () => {
    const up = view({}).rows.find(({ key }) => key === "muted");
    const down = view({ pressed: { key: "muted", kind: "switch" } }).rows.find(
      ({ key }) => key === "muted",
    );
    const tops = (row: typeof up) => [
      row?.face?.rect.y,
      row?.icon?.y,
      ...(row?.texts.map(({ capTop }) => capTop) ?? []),
      row?.switch?.art.y,
    ];
    expect(tops(down)).toEqual(tops(up).map((y) => (y ?? 0) + FEEDBACK.pressDipPx));
  });

  it.each([
    [false, "filled", "normal", "45%"],
    [true, "filled-disabled", "disabled", gameData.menuText.settings.muted],
  ])("draws a slider muted %s with its %s fill, %s knob and %s", (muted, fill, knob, value) => {
    const music = view({ settings: { ...DEFAULT_SETTINGS, musicVolume: 0.45, muted } }).rows[1];
    expect([music?.slider?.filled.tag, music?.slider?.knob.tag, music?.texts[1]?.lines]).toEqual([
      fill,
      knob,
      [value],
    ]);
  });

  it("draws the install steps' glyph over the card", () => {
    const steps = { ...installStepsLayout(SCREEN_CONFIG, 1), kind: "ios" } as const;
    expect(view({ focus: 2, steps }).steps?.icon?.key).toBe("icon-share");
  });

  it("draws only art the HTML interface ships", () => {
    expect(SETTINGS_ART_KEYS.filter((key) => !DOM_ART_KEYS.has(key))).toEqual([]);
  });
});

it("keeps Settings dismissal centred without a Cheats entry", () => {
  const card = view({}).card;
  expect(card.buttons).toEqual([]);
  const close = card.footer!;
  expect(close.primary).toBe(true);
  expect(close.rect.x + close.rect.width / 2).toBe(layout.panel.x + layout.panel.width / 2);
});
