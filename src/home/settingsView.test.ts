import { insetRect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { DOM_ART_KEYS } from "../assets/domArt.ts";
import { gameData } from "../data/index.ts";
import { SETTINGS_CARD } from "../data/layout.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import { fontFileMetrics } from "../testing/fontInk.ts";
import { FEEDBACK } from "./feedback.ts";
import { installStepsLayout, settingsLayout } from "./settings.ts";
import {
  INSTALL_ROW,
  SETTING_ROWS,
  SETTINGS_ART_KEYS,
  type SettingsMeasure,
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
  wrapNote: (_width, text) => [text],
};
const rows = [...SETTING_ROWS, INSTALL_ROW];
const layout = settingsLayout(
  fonts,
  SCREEN_CONFIG,
  rows.map((row) =>
    row.kind === "slider" ? { kind: "slider" } : { kind: row.kind, noteLines: 1 },
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

describe("settingsView", () => {
  it("dips a pressed row's face, icon, text and switch together", () => {
    const [up] = view({}).rows;
    const [down] = view({ pressed: { key: "muted", kind: "switch" } }).rows;
    const tops = (row: typeof up) => [
      row?.face?.rect.y,
      row?.icon.y,
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

  it("rings the focused row outside its edge, and nothing under the install steps", () => {
    const focused = view({ focus: 2 });
    expect(focused.ring).toEqual(
      insetRect(-SETTINGS_CARD.focusOutset, layout.rows[2]?.rect ?? layout.panel),
    );
    const steps = { ...installStepsLayout(SCREEN_CONFIG, 1), kind: "ios" } as const;
    const covered = view({ focus: 2, steps });
    expect([covered.ring, covered.steps?.icon?.key]).toEqual([undefined, "icon-share"]);
  });

  it("draws only art the HTML interface ships", () => {
    expect(SETTINGS_ART_KEYS.filter((key) => !DOM_ART_KEYS.has(key))).toEqual([]);
  });
});
