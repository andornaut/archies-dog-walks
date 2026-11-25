import { describe, expect, it } from "vitest";

import { DOM_ART_KEYS } from "../assets/domArt.ts";
import { gameData } from "../data/index.ts";
import { ICON_LABEL_GAP, LABEL_ICON, ROWS_PAGE, SETTINGS_CARD } from "../data/layout.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import { fontFileMetrics, fontInkRows, gameFont } from "../testing/fontInk.ts";
import { blockPlace, inkEnd, shownText } from "../ui/dom/pixelLine.ts";
import { deviceX, domScale, fontPixel } from "../ui/domScale.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { PAGE_LAYOUT, pageBack } from "../ui/pageLayout.ts";
import { PALETTE } from "../ui/palette.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { overlayRegion } from "./homeBar.ts";
import {
  installStepsLayout,
  SETTINGS_ROW,
  settingsInstallWidth,
  settingsLayout,
  SWITCH_ROWS,
} from "./settings.ts";
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
  rows.map((row) =>
    row.kind === "slider"
      ? { kind: "slider" }
      : row.kind === "button"
        ? {
            controlWidth: settingsInstallWidth(
              MEASURE.inkWidth("title", gameData.menuText.settings.install),
            ),
            kind: row.kind,
            noteLines: 0,
          }
        : { kind: row.kind, noteLines: row.note === undefined ? 0 : 1 },
  ),
);
const STATE: SettingsState = {
  dim: SCREEN_LAYOUT.screen,
  focus: null,
  pressed: undefined,
  settings: DEFAULT_SETTINGS,
  steps: undefined,
};
const view = (state: Partial<SettingsState>) =>
  settingsView(
    MEASURE,
    {
      art: () => ({ height: 16, width: 16 }),
      layout,
      rows,
      words: gameData.menuText.settings,
    },
    { ...STATE, ...state },
  );

// A switch row's switch as its kit list places it (SWITCH_ROWS): at the value column's end, its
// offset down.
const switchOf = (rect: { x: number; y: number; width: number }) => ({
  x: rect.x + rect.width - SWITCH_ROWS.padding!.right - SWITCH_ROWS.switch!.width,
  y: rect.y + SWITCH_ROWS.value!.offset!,
});

describe("settingsView", () => {
  it("leaves by the page's Back under its page title, on a cream page", () => {
    const { page } = view({});
    expect(page.back).toEqual(pageBack(MEASURE, gameData.menuText.pageBack));
    expect(page.fill).toEqual({ colour: PALETTE.cream, rect: PAGE_LAYOUT.rect });
    expect(page.title.map(({ text }) => text)).toEqual([gameData.menuText.settings.title]);
    expect(page.title[0]?.centreX).toBe(PAGE_LAYOUT.rect.width / 2);
  });

  it("uses readable body text for the centred build label, labelFoot over Back", () => {
    const current = view({});
    expect(current.rowsViewport).toEqual(layout.rowsViewport);
    expect(current.rowsContentHeight).toBe(layout.rowsContentHeight);
    expect(current.build.font).toBe("body");
    expect(current.build.scale).toBe(TEXT_SCALE);
    expect(current.build.centre).toBe("ink");
    expect(current.build.centreX).toBe(SCREEN_CONFIG.width / 2);
    const visibleInk = fontInkRows("font-body", { scale: current.build.scale }, current.build.text);
    expect(current.page.back.rect.y - current.build.capTop - visibleInk.bottom).toBe(
      ROWS_PAGE.labelFoot,
    );
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
        const art = switchOf(row.rect);
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
      const art = switchOf(row.rect);
      const state = row.texts.at(-1)!;
      const place = blockPlace(font, scale, state);
      const end =
        place.runs[0]!.left +
        inkEnd(font, shownText("title", state.lines[0]!)) * fontPixel(scale, state.scale);
      expect(art.x + SETTINGS_CARD.row.switch.width - 1).toBe(329);
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
      const caps = MEASURE.title.capHeight * TEXT_SCALE;
      expect(fps.icon).toMatchObject({
        key: "icon-fps-counter-panel",
        x: sound.icon?.x,
        y: fps.texts[0]!.capTop - Math.floor((LABEL_ICON - caps) / 2),
      });
      expect(fps.texts[0]!.x - fps.icon!.x).toBe(LABEL_ICON + ICON_LABEL_GAP);
      expect(fps.texts[0]!.x - fps.rect.x).toBe(SETTINGS_ROW.label.dx);
      expect(fps.texts[0]!.capTop - fps.rect.y).toBe(SETTINGS_ROW.label.dy);
      expect(sound.texts[0]!.capTop - sound.rect.y).toBe(SETTINGS_ROW.label.dy);
      expect(fps.texts[0]!.x).toBe(sound.texts[0]!.x);
      expect(fps.texts.at(-1)!.x).toBe(sound.texts.at(-1)!.x);
    },
  );

  it("centres the Install button in its row and its icon and label ink as one group on it", () => {
    const install = view({}).rows.find(({ key }) => key === "install")!;
    const { button, icon, rect } = install;
    const face = button!.rect;
    const ink = MEASURE.inkWidth("title", gameData.menuText.settings.install);
    expect(face.x - rect.x).toBe(rect.x + rect.width - face.x - face.width);
    expect(face.width).toBe(settingsInstallWidth(ink));
    const inkLeft = button!.text.centreX - ink / 2;
    expect(inkLeft - icon!.x).toBe(LABEL_ICON + ICON_LABEL_GAP);
    const start = icon!.x + SETTINGS_CARD.installIconInk;
    const [left, right] = [start - face.x, face.x + face.width - inkLeft - ink];
    expect(left - right).toBeGreaterThanOrEqual(0);
    expect(left - right).toBeLessThanOrEqual(1);
    const caps = MEASURE.title.capHeight * TEXT_SCALE;
    expect(icon!.y).toBe(button!.text.capTop - Math.floor((LABEL_ICON - caps) / 2));
  });

  it("holds a pressed row pressed, its parts in place for its kit row's dip", () => {
    const up = view({}).rows.find(({ key }) => key === "muted")!;
    const down = view({ pressed: { key: "muted", kind: "switch" } }).rows.find(
      ({ key }) => key === "muted",
    )!;
    expect([up.pressed, down.pressed]).toEqual([false, true]);
    expect([down.icon, down.texts]).toEqual([up.icon, up.texts]);
  });

  it.each([
    [false, "45%"],
    [true, gameData.menuText.settings.muted],
  ])("draws a slider muted %s at its step with %s", (muted, value) => {
    const music = view({ settings: { ...DEFAULT_SETTINGS, musicVolume: 0.45, muted } }).rows[1];
    expect([music?.slider?.step, music?.slider?.disabled, music?.texts[1]?.lines]).toEqual([
      9,
      muted,
      [value],
    ]);
  });

  it("draws the install steps' glyph over the card", () => {
    const steps = { ...installStepsLayout(overlayRegion("home"), 1), kind: "ios" } as const;
    expect(view({ focus: 2, steps }).steps?.icon?.key).toBe("icon-share");
  });

  it("draws only art the HTML interface ships", () => {
    expect(SETTINGS_ART_KEYS.filter((key) => !DOM_ART_KEYS.has(key))).toEqual([]);
  });
});
