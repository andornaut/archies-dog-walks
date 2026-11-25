import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { overlayRegion } from "../../home/homeBar.ts";
import { installStepsLayout, settingsLayout } from "../../home/settings.ts";
import { type SettingsMeasure, settingsRows, settingsView } from "../../home/settingsView.ts";
import { DEFAULT_SETTINGS } from "../../save/settings.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, fontInk, gameFont } from "../../testing/fontInk.ts";
import { REFUSAL_RED } from "../../ui/dom/refusal.ts";
import { artPixel, domScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { type DomSettingsInput, showSettings } from "./settings.ts";

vi.mock("../../ui/dom/domCuts.ts", () => ({
  cutDomArt: vi.fn(() => Promise.resolve("blob:cut")),
  cutDomFrame: vi.fn(() => Promise.resolve("blob:frame")),
}));

function fixture(install = false, width = 360, dpr = 1) {
  const configuredRows = settingsRows(install);
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
    configuredRows.map((row) =>
      row.kind === "slider"
        ? { kind: "slider" }
        : { kind: row.kind, noteLines: row.kind === "button" || row.note === undefined ? 0 : 1 },
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
        focus: null,
        pressed: undefined,
        settings: DEFAULT_SETTINGS,
        steps: steps ? { ...installStepsLayout(overlayRegion("home"), 1), kind: "ios" } : undefined,
      },
    );
  const doc = new FakeDocument();
  const scale = domScale(dpr, { ...SCREEN_LAYOUT.screen, height: (width * 560) / 360, width });
  const { element, layer } = fakeLayer(doc, scale);
  const slide = {
    change: vi.fn<DomSettingsInput["slide"]["change"]>(),
    commit: vi.fn<DomSettingsInput["slide"]["commit"]>(),
  };
  const press = {
    activate: vi.fn<DomSettingsInput["press"]["activate"]>(),
    hold: vi.fn<DomSettingsInput["press"]["hold"]>(),
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
          frameTags: ["normal", "disabled", "idle", "off", "on"].map((name) => ({ from: 0, name })),
          size: { h: 16, w: 16 },
        },
      }),
    onFocus: vi.fn(),
    press,
    reducedMotion: () => true,
    slide,
    toGame: (point) => point,
    view: view(),
  });
  return { close, doc, element, layer, press, scale, shown, slide, view };
}

const pointer = (target: unknown, pointerId: number, x: number, y: number, type: string) => ({
  button: 0,
  clientX: x,
  clientY: y,
  detail: 1,
  pointerId,
  pointerType: "mouse",
  preventDefault: vi.fn(),
  stopImmediatePropagation: vi.fn(),
  target,
  timeStamp: 10,
  type,
});

it("sets a volume through the kit slider's keys and drags, and drops a drag that install steps take over", () => {
  const { doc, element, layer, shown, slide, view } = fixture();
  const row = element.all().find((part) => part.getAttribute("role") === "slider")!;
  expect(row.getAttribute("aria-valuenow")).toBe("9");
  row.fire("keydown", { key: "ArrowRight" });
  expect(slide.change).toHaveBeenCalledExactlyOnceWith("musicVolume", 10);
  slide.change.mockClear();
  row.fire("pointerdown", pointer(row, 1, 10, 10, "pointerdown"));
  expect(slide.change).toHaveBeenCalledExactlyOnceWith("musicVolume", 0);
  shown.update(view(true), null);
  expect(layerViews(element)[0]?.inert).toBe(true);
  doc.fire("pointermove", pointer(row, 1, 300, 10, "pointermove"));
  doc.fire("pointerup", pointer(row, 1, 300, 10, "pointerup"));
  expect(slide.change).toHaveBeenCalledOnce();
  expect(slide.commit).not.toHaveBeenCalled();
  shown.setEnabled(false);
  expect(shown.accepts()).toBe(false);
  shown.update(view(), null);
  expect(shown.accepts()).toBe(false);
  shown.setEnabled(true);
  expect(shown.accepts()).toBe(true);
  shown.destroy();
  expect(layer.input.accepts()).toBe(true);
});

it.each([
  [
    "a muted slider's press",
    "slider",
    (row: FakeElement) => row.fire("pointerdown", pointer(row, 2, 10, 10, "pointerdown")),
  ],
  [
    "a muted slider's step key",
    "slider",
    (row: FakeElement) => row.fire("keydown", { key: "ArrowRight" }),
  ],
  ["a switch row the scene refuses", "switch", undefined],
] as const)(
  "refuses %s with the game's cue on the whole row, leaving its volume",
  (_what, role, act) => {
    const { element, shown, slide, view } = fixture();
    const muted = view();
    shown.update(
      {
        ...muted,
        rows: muted.rows.map((row) =>
          row.slider === undefined ? row : { ...row, slider: { ...row.slider, disabled: true } },
        ),
      },
      null,
    );
    const row = element.all().find((part) => part.getAttribute("role") === role)!;
    if (act === undefined) {
      shown.refuse(
        muted.rows.findIndex(({ kind }) => kind === role),
        true,
      );
    } else {
      expect(row.getAttribute("aria-disabled")).toBe("true");
      act(row);
    }
    expect(slide.change).not.toHaveBeenCalled();
    expect(row.hasAttribute(REFUSAL_RED)).toBe(true);
    expect(row.classList.contains("adw-refusing-still")).toBe(true);
    expect(row.hasAttribute("data-ui-refusal-red")).toBe(false);
    expect(row.children[0]?.className).toBe("adw-framed adw-row-face");
    shown.destroy();
  },
);

it("holds a Settings switch through a touch lost to hiding and flips it once by the kit's click", () => {
  const { close, doc, element, layer, press, shown } = fixture();
  const root = layerViews(element)[0]!;
  const row = element.all().find((part) => part.getAttribute("role") === "switch")!;
  expect([row.tagName, row.getAttribute("aria-checked")]).toEqual(["button", "true"]);
  const target = { key: "muted", kind: "switch" };
  const lost = pointer(row, 31, 10, 10, "pointerdown");
  root.fire("pointerdown", lost);
  row.fire("pointerdown", lost);
  expect(press.hold).toHaveBeenLastCalledWith(target);
  expect(layer.press.canvasAllowed()).toBe(false);
  Object.assign(doc, { hidden: true });
  doc.fire("visibilitychange");
  expect(layer.press.canvasAllowed()).toBe(true);
  expect(press.hold).toHaveBeenLastCalledWith(undefined);
  expect(press.activate).not.toHaveBeenCalled();

  Object.assign(doc, { hidden: false });
  doc.fire("visibilitychange");
  doc.defaultView.fire("focus");
  const fresh = pointer(row, 32, 10, 10, "pointerdown");
  root.fire("pointerdown", fresh);
  row.fire("pointerdown", fresh);
  doc.fire("pointerup", pointer(row, 32, 10, 10, "pointerup"));
  expect(press.hold).toHaveBeenLastCalledWith(undefined);
  row.fire("click", pointer(row, 32, 10, 10, "click"));
  expect(press.activate).toHaveBeenCalledExactlyOnceWith(target);
  const controls = root
    .all()
    .filter(
      (part) =>
        part.tagName === "button" && part.getAttribute("aria-label") === gameData.menuText.pageBack,
    );
  // Back is the page's one leave: no X.
  expect(controls).toHaveLength(1);
  controls.forEach((control, index) => {
    root.fire("pointerdown", pointer(control, 40 + index, 10, 10, "pointerdown"));
    doc.fire("pointerup", pointer(control, 40 + index, 10, 10, "pointerup"));
    const click = pointer(control, 40 + index, 10, 10, "click");
    root.fire("click", click);
    expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
    control.fire("click", click);
    expect(close).toHaveBeenCalledTimes(index + 1);
  });
  shown.destroy();
  expect(layer.press.canvasAllowed()).toBe(true);
});

it("keeps the page's chrome fixed while revealing whole focused rows in its native body", () => {
  const { element, shown, view } = fixture(true);
  const current = view();
  const viewport = element.all().find((part) => part.className.includes("adw-settings-rows"))!;
  const lists = element.all().filter((part) => part.classList.contains("adw-form-rows"));
  const last = current.rows.length - 1;
  const rect = { ...current.rowsViewport, height: current.rows[last]!.rect.height };
  const small = { ...current, rowsViewport: rect };
  const footer = element
    .all()
    .find(
      (part) =>
        part.className.includes("adw-button") &&
        part.getAttribute("aria-label") === gameData.menuText.pageBack,
    )!;
  const footerTop = footer.style.top;
  shown.update(small, last);
  const scroll = (viewport as unknown as HTMLElement).scrollTop;
  expect(scroll).toBe(
    current.rows[last]!.rect.y + current.rows[last]!.rect.height - rect.y - rect.height,
  );
  expect(viewport.style.height).toBe(`${rect.height}px`);
  // The overflowing rows show the pages' scrollbar beside the body, in the scrollbar's room.
  const track = element.all().find((part) => part.className === "adw-scroll-track")!;
  const bar = element.all().find((part) => part.children.includes(track))!;
  expect(bar.hidden).toBe(false);
  expect(parseFloat(track.style.left ?? "")).toBeGreaterThan(
    parseFloat(viewport.style.left ?? "") + parseFloat(viewport.style.width ?? ""),
  );
  expect(lists[0]!.style.top).toBe("0px");
  expect(footer.style.top).toBe(footerTop);
  shown.update(small, 0);
  expect((viewport as unknown as HTMLElement).scrollTop).toBe(0);
  shown.destroy();
});

it.each([
  [575, 1],
  [390, 2.625],
  [360, 1],
])("centres the version's projected visible ink over Back at width %i and DPR %f", (width, dpr) => {
  const { element, scale, shown, view } = fixture(false, width, dpr);
  const current = view();
  const label = element.all().find((node) => node.textContent === current.build.text)!;
  const ink = fontInk("font-body", { scale: 1 }, current.build.text);
  const pixel = Number.parseFloat(label.style.fontSize!) / 8;
  const centre = Number.parseFloat(label.style.left!) + ((ink.left + ink.right) * pixel) / 2;
  const footer = gridRect(scale, current.page.back.rect);
  expect(Math.abs(centre - footer.left - footer.width / 2)).toBeLessThanOrEqual(
    artPixel(scale) / 2 + 0.5,
  );
  shown.destroy();
});

it.each([
  [360, 2],
  [412, 2.625],
  [390, 3],
])(
  "places each row through its kit list at its view's place at width %i and DPR %f",
  (width, dpr) => {
    const { element, scale, shown, view } = fixture(true, width, dpr);
    const { rows, rowsViewport } = view();
    const lists = element.all().filter((part) => part.classList.contains("adw-form-rows"));
    const rowElements = element.all().filter((part) => part.classList.contains("adw-row"));
    const rowsOf = (list: FakeElement) =>
      list.children.map((row) => rows[rowElements.indexOf(row)]!);
    // Install, centred across its whole row, is a list of its own; the rest share a list per height.
    expect(lists.map((list) => rowsOf(list).map(({ key }) => key))).toEqual([
      ["muted", "musicVolume", "sfxVolume", "reducedMotion"],
      ["install"],
      ["fpsCounter"],
    ]);
    for (const list of lists) {
      const placed = rowsOf(list);
      const top = gridY(scale, placed[0]!.rect.y);
      expect([list.style.left, list.style.top]).toEqual([
        `${gridX(scale, placed[0]!.rect.x) - gridX(scale, rowsViewport.x)}px`,
        `${top - gridY(scale, rowsViewport.y)}px`,
      ]);
      // Each row's track is its pitch to the next on the grid, the last its own height.
      expect(list.style.getPropertyValue("--ui-form-rows")).toBe(
        placed
          .map(({ rect }, i) => {
            const next = placed[i + 1]?.rect.y ?? rect.y + rect.height;
            return `${gridY(scale, next) - gridY(scale, rect.y)}px`;
          })
          .join(" "),
      );
    }
    shown.destroy();
  },
);
