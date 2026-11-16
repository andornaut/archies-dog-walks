import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../../data/screen.ts";
import { installStepsLayout, settingsLayout } from "../../home/settings.ts";
import {
  INSTALL_ROW,
  SETTING_ROWS,
  type SettingsMeasure,
  settingsView,
} from "../../home/settingsView.ts";
import { DEFAULT_SETTINGS } from "../../save/settings.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, fontInk, gameFont } from "../../testing/fontInk.ts";
import { artPixel, domScale, gridRect } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { type DomSettingsInput, showSettings } from "./settings.ts";

function fixture(install = false, width = 360, dpr = 1) {
  const configuredRows = [...SETTING_ROWS, ...(install ? [INSTALL_ROW] : [])];
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
    configuredRows.map((row) =>
      row.kind === "slider" ? { kind: "slider" } : { kind: row.kind, noteLines: 1 },
    ),
  );
  const view = (steps = false) =>
    settingsView(
      measure,
      {
        art: () => ({ height: 16, width: 16 }),
        layout,
        rows: configuredRows,
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
  const scale = domScale(dpr, { ...SCREEN_LAYOUT.screen, height: (width * 560) / 360, width });
  const { element, layer } = fakeLayer(doc, scale);
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
  return { close, doc, element, layer, press, scale, shown, slide, view };
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

it("scrolls touch slider rows without changing volume until horizontal intent or a tap release", () => {
  const { doc, element, shown, slide } = fixture();
  const row = element.all().find((part) => part.getAttribute("role") === "slider")!;
  const event = (pointerId: number, x: number, y: number) => ({
    clientX: x,
    clientY: y,
    pointerId,
    pointerType: "touch",
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    target: row,
    type: "pointerdown",
  });
  row.fire("pointerdown", event(41, 100, 150));
  expect(slide.start).not.toHaveBeenCalled();
  doc.fire("pointermove", event(41, 102, 180));
  doc.fire("pointerup", event(41, 102, 180));
  expect(slide.start).not.toHaveBeenCalled();
  expect(slide.move).not.toHaveBeenCalled();
  expect(slide.end).not.toHaveBeenCalled();
  row.fire("pointerdown", event(42, 100, 150));
  doc.fire("pointermove", event(42, 130, 152));
  expect(slide.start).toHaveBeenCalledExactlyOnceWith("musicVolume", 130);
  doc.fire("pointerup", event(42, 140, 152));
  expect(slide.end).toHaveBeenCalledExactlyOnceWith(false);
  slide.start.mockClear();
  slide.end.mockClear();
  row.fire("pointerdown", event(43, 100, 150));
  doc.fire("pointerup", event(43, 103, 151));
  expect(slide.start).toHaveBeenCalledExactlyOnceWith("musicVolume", 103);
  expect(slide.end).toHaveBeenCalledExactlyOnceWith(false);
  shown.destroy();
});

it("keeps the card chrome fixed while revealing whole focused rows inside its native viewport", () => {
  const { element, shown, view } = fixture(true);
  const current = view();
  const viewport = element.all().find((part) => part.className.includes("adw-settings-rows"))!;
  const rows = element.all().filter((part) => part.className === "adw-row");
  const last = current.rows.length - 1;
  const rect = { ...current.rowsViewport, height: current.rows[last]!.rect.height };
  const small = { ...current, rowsViewport: rect };
  const footer = element
    .all()
    .find(
      (part) =>
        part.className.includes("adw-button") &&
        part.getAttribute("aria-label") === gameData.menuText.common.close,
    )!;
  const footerTop = footer.style.top;
  shown.update(small, last);
  const scroll = (viewport as unknown as HTMLElement).scrollTop;
  expect(scroll).toBe(
    current.rows[last]!.rect.y + current.rows[last]!.rect.height - rect.y - rect.height,
  );
  expect(viewport.style.height).toBe(`${rect.height}px`);
  expect(rows[0]!.style.top).toBe("0px");
  expect(footer.style.top).toBe(footerTop);
  shown.update(small, 0);
  expect((viewport as unknown as HTMLElement).scrollTop).toBe(0);
  shown.destroy();
});

it.each([
  [575, 1],
  [390, 2.625],
  [360, 1],
])(
  "centres the version's projected visible ink over Close at width %i and DPR %f",
  (width, dpr) => {
    const { element, scale, shown, view } = fixture(false, width, dpr);
    const current = view();
    const label = element.all().find((node) => node.textContent === current.build.text)!;
    const ink = fontInk("font-body", { scale: 1 }, current.build.text);
    const pixel = Number.parseFloat(label.style.fontSize!) / 8;
    const centre = Number.parseFloat(label.style.left!) + ((ink.left + ink.right) * pixel) / 2;
    const footer = gridRect(scale, current.card.footer!.rect);
    expect(Math.abs(centre - footer.left - footer.width / 2)).toBeLessThanOrEqual(
      artPixel(scale) / 2 + 0.5,
    );
    shown.destroy();
  },
);
