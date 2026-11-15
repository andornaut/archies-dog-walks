import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../../data/screen.ts";
import { installStepsLayout, settingsLayout } from "../../home/settings.ts";
import { SETTING_ROWS, type SettingsMeasure, settingsView } from "../../home/settingsView.ts";
import { DEFAULT_SETTINGS } from "../../save/settings.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { showSettings } from "./settings.ts";

it("cancels a carried settings drag when install steps take ownership and restores guarded input", () => {
  const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
  const measure: SettingsMeasure = {
    ...fonts,
    fitBody: (_lines, _room, text) => [text],
    ink: (_font, scale, text) => ({ left: scale, right: text.length * 6 * scale }),
    inkWidth: (_font, text) => text.length * 12,
    wrapNote: (_width, text) => [text],
  };
  const layout = settingsLayout(
    fonts,
    SCREEN_CONFIG,
    SETTING_ROWS.map((row) =>
      row.kind === "slider" ? { kind: "slider" } : { kind: row.kind, noteLines: 1 },
    ),
  );
  const view = (steps = false) =>
    settingsView(
      measure,
      {
        art: () => ({ height: 16, width: 16 }),
        layout,
        rows: SETTING_ROWS,
        words: gameData.menuText.settings,
      },
      {
        dim: SCREEN_LAYOUT.screen,
        dragging: undefined,
        focus: null,
        pressed: undefined,
        settings: DEFAULT_SETTINGS,
        steps: steps ? { ...installStepsLayout(SCREEN_CONFIG, 1), kind: "ios" } : undefined,
      },
    );
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, SCREEN_LAYOUT.screen));
  const slide = { end: vi.fn(), move: vi.fn(), start: vi.fn() };
  const shown = showSettings(layer, {
    artUrl: (path) => path,
    close: vi.fn(),
    closeLabel: gameData.menuText.common.close,
    closeSteps: vi.fn(),
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: () =>
      Promise.resolve({
        frames: { first: { frame: { h: 16, w: 16, x: 0, y: 0 } } },
        meta: {
          frameTags: ["normal", "disabled", "off", "on"].map((name) => ({ from: 0, name })),
          size: { h: 16, w: 16 },
        },
      }),
    onFocus: vi.fn(),
    press: { down: vi.fn(), up: vi.fn() },
    slide,
    toGame: (point) => point,
    view: view(),
  });
  const row = element.all().find((part) => part.getAttribute("role") === "slider")!;
  const event = {
    clientX: 10,
    clientY: 10,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    target: row,
    type: "pointerdown",
  };
  row.fire("pointerdown", event);
  expect(slide.start).toHaveBeenCalledOnce();
  shown.update(view(true), null);
  expect(slide.end).toHaveBeenCalledExactlyOnceWith(true);
  doc.fire("pointermove", { ...event, clientX: 30, type: "pointermove" } as typeof event);
  doc.fire("pointerup", { ...event, type: "pointerup" } as typeof event);
  expect(slide.move).not.toHaveBeenCalled();
  expect(slide.end).toHaveBeenCalledOnce();
  shown.setEnabled(false);
  expect(shown.accepts()).toBe(false);
  shown.update(view(), null);
  expect(shown.accepts()).toBe(false);
  shown.setEnabled(true);
  expect(shown.accepts()).toBe(true);
  shown.destroy();
  expect(layer.input.accepts()).toBe(true);
});
