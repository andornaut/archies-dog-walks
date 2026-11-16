import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../../data/screen.ts";
import { installStepsLayout, settingsLayout } from "../../home/settings.ts";
import { SETTING_ROWS, type SettingsMeasure, settingsView } from "../../home/settingsView.ts";
import { DEFAULT_SETTINGS } from "../../save/settings.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { type DomSettingsInput, showSettings } from "./settings.ts";

function fixture() {
  const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
  const measure: SettingsMeasure = {
    ...fonts,
    fitBody: (_lines, _room, text) => [text],
    ink: (_font, scale, text) => ({ left: scale, right: text.length * 6 * scale }),
    inkWidth: (_font, text) => text.length * 12,
    titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
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
  const press = {
    down: vi.fn<DomSettingsInput["press"]["down"]>(),
    up: vi.fn<DomSettingsInput["press"]["up"]>(),
  };
  const close = vi.fn();
  const shown = showSettings(layer, {
    artUrl: (path) => path,
    close,
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
    press,
    slide,
    toGame: (point) => point,
    view: view(),
  });
  return { close, doc, element, layer, press, shown, slide, view };
}

it("cancels a carried settings drag when install steps take ownership and restores guarded input", () => {
  const { doc, element, layer, shown, slide, view } = fixture();
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
  expect(element.children[0]?.hidden).toBe(false);
  expect(element.children[0]?.inert).toBe(true);
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

it("cancels a Settings touch across hiding and restores its switch, X and Close actions once", () => {
  const { close, doc, element, layer, press, shown } = fixture();
  const root = element.children[0]!;
  const row = element.all().find((part) => part.getAttribute("role") === "switch")!;
  Object.assign(row, { closest: (selector: string) => (selector === ".adw-row" ? row : null) });
  const action = vi.fn();
  press.up.mockImplementation((target, cancelled) => {
    if (!cancelled && target?.kind === "switch") {
      action();
    }
  });
  const event = (pointerId: number, type: string, target = row) => ({
    clientX: 10,
    clientY: 10,
    detail: 1,
    pointerId,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    target,
    timeStamp: 10,
    type,
  });
  const lost = event(31, "pointerdown");
  root.fire("pointerdown", lost);
  row.fire("pointerdown", lost);
  expect(press.down).toHaveBeenCalledOnce();
  expect(layer.press.canvasAllowed()).toBe(false);
  Object.assign(doc, { hidden: true });
  doc.fire("visibilitychange");
  expect(layer.press.canvasAllowed()).toBe(true);
  expect(press.up).toHaveBeenCalledExactlyOnceWith(undefined, true);
  expect(action).not.toHaveBeenCalled();

  Object.assign(doc, { hidden: false });
  doc.fire("visibilitychange");
  doc.defaultView.fire("focus");
  const fresh = event(32, "pointerdown");
  root.fire("pointerdown", fresh);
  row.fire("pointerdown", fresh);
  doc.fire("pointerup", event(31, "pointerup"));
  expect(action).not.toHaveBeenCalled();
  doc.fire("pointerup", event(32, "pointerup"));
  expect(action).toHaveBeenCalledOnce();
  expect(press.down).toHaveBeenCalledTimes(2);
  const controls = root
    .all()
    .filter(
      (part) =>
        part.tagName === "button" &&
        part.getAttribute("aria-label") === gameData.menuText.common.close,
    );
  expect(controls).toHaveLength(2);
  controls.forEach((control, index) => {
    root.fire("pointerdown", event(40 + index, "pointerdown", control));
    doc.fire("pointerup", event(40 + index, "pointerup", control));
    const click = event(40 + index, "click", control);
    root.fire("click", click);
    expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
    control.fire("click", click);
    expect(close).toHaveBeenCalledTimes(index + 1);
  });
  shown.destroy();
  expect(layer.press.canvasAllowed()).toBe(true);
});
