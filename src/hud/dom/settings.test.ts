import type { InstallStepsKind } from "@andornaut/game-kit/runtime/web/pwa/installState";
import { expect, it, vi } from "vitest";

import { BUILD_LABEL } from "../../buildLabel.ts";
import { gameData, LABEL_ICON, SETTINGS_CARD } from "../../data/index.ts";
import { overlayRegion } from "../../home/homeBar.ts";
import {
  installStepsLayout,
  SETTINGS_ROW,
  SETTINGS_SWITCH_GAP,
  settingsInstallWidth,
  settingsLayout,
} from "../../home/settings.ts";
import { type SettingsMeasure, settingsRows, settingsView } from "../../home/settingsView.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { DEFAULT_SETTINGS } from "../../save/settings.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, fontInk, gameFont } from "../../testing/fontInk.ts";
import { capRows, shownText, WEB_FONT_EM } from "../../ui/dom/pixelLine.ts";
import { REFUSAL_RED } from "../../ui/dom/refusal.ts";
import { artPixel, deviceY, domScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
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
        : row.kind === "button"
          ? {
              controlWidth: settingsInstallWidth(
                measure.inkWidth("title", gameData.menuText.settings.install),
              ),
              kind: row.kind,
              noteLines: 0,
            }
          : { kind: row.kind, noteLines: row.note === undefined ? 0 : 1 },
    ),
  );
  const view = (steps = false, kind: InstallStepsKind = "ios") =>
    settingsView(
      measure,
      {
        art: () => ({ height: 16, width: 16 }),
        buildLabel: BUILD_LABEL,
        layout,
        rows: configuredRows,
        words: gameData.menuText.settings,
      },
      {
        dim: SCREEN_LAYOUT.screen,
        focus: null,
        pressed: undefined,
        settings: DEFAULT_SETTINGS,
        steps: steps ? { ...installStepsLayout(overlayRegion("home"), 1), kind } : undefined,
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
    closeLabel: gameData.menuText.common,
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

// The words a screen reader reads in node: its text and its children's, in order, but none
// under aria-hidden.
const spokenWords = (node: FakeElement): string =>
  node.getAttribute("aria-hidden") === "true"
    ? ""
    : node.children.length === 0
      ? node.textContent
      : node.children.map(spokenWords).join("");

it.each(
  Object.entries(gameData.menuText.settings.installSteps) as [
    InstallStepsKind,
    { steps: string; title: string },
  ][],
)("names the %s install steps' dialog by its title and reads its steps in order", (kind, text) => {
  const { element, shown, view } = fixture(true);
  const current = view(true, kind);
  // The steps wrapped onto two lines, which a screen reader reads as the one sentence.
  const words = text.steps.split(" ");
  const half = Math.ceil(words.length / 2);
  const lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")];
  const steps = { ...current.steps!, steps: { ...current.steps!.steps, lines } };
  shown.update({ ...current, steps }, null);
  // The card's dialog, over the page's.
  const dialog = element
    .all()
    .filter((node) => node.getAttribute("role") === "dialog")
    .at(-1)!;
  const nodes = dialog.all();
  const title = nodes.find((node) => node.id === dialog.getAttribute("aria-labelledby"));
  expect(title?.getAttribute("aria-label")).toBe(text.title);
  const described = nodes.find((node) => node.id === dialog.getAttribute("aria-describedby"));
  expect(described?.tagName).toBe("p");
  expect(spokenWords(described!).trim()).toBe(text.steps);
  shown.destroy();
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
])("anchors switch states and volume art at width %i and DPR %f", (width, dpr) => {
  const { element, scale, shown, view } = fixture(false, width, dpr);
  const switches = element.all().filter((part) => part.getAttribute("role") === "switch");
  const views = view().rows.filter(({ kind }) => kind === "switch");
  const pixels = (part: FakeElement, name: string) =>
    Number.parseFloat(part.style.getPropertyValue(name));
  expect(switches).toHaveLength(views.length);
  switches.forEach((row, i) => {
    // These are the dimensions, end margin and stack top consumed by the projected switch CSS.
    const { rect, switch: toggle } = views[i]!;
    const word = shownText("title", toggle!.word);
    const block = row.children.find(
      (part) => part.classList.contains("adw-lines") && part.children[0]?.textContent === word,
    )!;
    const span = block.children[0]!;
    const switchNode = row.children
      .flatMap((child) => child.all())
      .find((part) => part.classList.contains("ui-switch"))!;
    const right = gridX(scale, rect.x + rect.width - SETTINGS_ROW.pad) - gridX(scale, rect.x);
    const switchRight =
      gridX(scale, rect.x + rect.width - SETTINGS_ROW.pad) -
      gridX(scale, rect.x) -
      pixels(row, "--ui-form-switch-end") +
      Number.parseFloat(switchNode.style.left!);
    const switchCentre = switchRight - pixels(row, "--ui-switch-width") / 2;
    const switchBottom = pixels(row, "--ui-form-value-offset") + pixels(row, "--ui-switch-height");
    const fontPixel = Number.parseFloat(span.style.fontSize!) / WEB_FONT_EM;
    const ink = fontInk("font-title", { scale: 1 }, word);
    const inkCentre =
      Number.parseFloat(span.style.left!) + ((ink.left + ink.right) * fontPixel) / 2;
    const capTop =
      Number.parseFloat(span.style.top!) + capRows(gameFont("font-title"), "title") * fontPixel;
    expect(Math.abs(inkCentre - switchCentre)).toBeLessThanOrEqual(0.5);
    const inkRight = Number.parseFloat(span.style.left!) + ink.right * fontPixel;
    expect(Math.max(inkRight, switchRight)).toBe(right);
    expect(capTop - switchBottom).toBe(SETTINGS_SWITCH_GAP * artPixel(scale));
  });
  const sliders = element.all().filter((part) => part.getAttribute("role") === "slider");
  const sliderViews = view().rows.filter(({ kind }) => kind === "slider");
  sliders.forEach((row, i) => {
    const { rect } = sliderViews[i]!;
    const icon = row.all().find((part) => part.style.backgroundImage === "var(--adw-art-image)")!;
    const track = row.all().find((part) => part.classList.contains("ui-slider-track"))!;
    const iconInkTop =
      pixels(row, "--ui-form-icon-offset") +
      Number.parseFloat(icon.style.top!) +
      (Number.parseFloat(icon.style.height!) * SETTINGS_ROW.slider.inkTop) / LABEL_ICON;
    const knobInkBottom =
      pixels(row, "--ui-slider-line") +
      pixels(row, "--ui-slider-gap") +
      pixels(row, "--ui-slider-track-top") +
      pixels(row, "--ui-slider-thumb-top") +
      pixels(row, "--ui-slider-thumb-height") +
      Number.parseFloat(track.style.translate!.split(" ")[1]!);
    expect(iconInkTop).toBeCloseTo(
      deviceY(scale, rect.y + SETTINGS_ROW.slider.clearance) - gridY(scale, rect.y),
    );
    expect(knobInkBottom).toBe(
      deviceY(scale, rect.y + rect.height - SETTINGS_ROW.slider.clearance) - gridY(scale, rect.y),
    );
  });
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
  "places every row through one kit list at its view's place at width %i and DPR %f",
  (width, dpr) => {
    const { element, scale, shown, view } = fixture(true, width, dpr);
    const { rows, rowsViewport } = view();
    const lists = element.all().filter((part) => part.classList.contains("adw-form-rows"));
    const rowElements = element.all().filter((part) => part.classList.contains("adw-row"));
    expect(lists).toHaveLength(1);
    const [list] = lists;
    // Install, centred across its whole row, shares the list with rows of every height.
    expect(list!.children.map((row) => rows[rowElements.indexOf(row)]!.key)).toEqual(
      rows.map(({ key }) => key),
    );
    expect(rows.map(({ key }) => key)).toContain("install");
    expect([list!.style.left, list!.style.top]).toEqual([
      `${gridX(scale, rows[0]!.rect.x) - gridX(scale, rowsViewport.x)}px`,
      `${gridY(scale, rows[0]!.rect.y) - gridY(scale, rowsViewport.y)}px`,
    ]);
    // Each row's track is its pitch to the next on the grid, the last its own height.
    expect(list!.style.getPropertyValue("--ui-form-rows")).toBe(
      rows
        .map(({ rect }, i) => {
          const next = rows[i + 1]?.rect.y ?? rect.y + rect.height;
          return `${gridY(scale, next) - gridY(scale, rect.y)}px`;
        })
        .join(" "),
    );
    shown.destroy();
  },
);

it.each([
  [575, 1],
  [390, 2.625],
])(
  "matches and centres the projected Install icon and word at width %i and DPR %f",
  async (width, dpr) => {
    const { element, scale, shown, view } = fixture(true, width, dpr);
    await Promise.resolve();
    const { label: word } = view().rows.at(-1)!;
    const label = element
      .all()
      .find(
        (part) =>
          part.textContent === shownText("title", word) && part.classList.contains("adw-text"),
      )!;
    const face = element.all().find((part) => part.classList.contains("adw-standard-button-face"))!;
    const icon = face.all().find((part) => part.classList.contains("adw-art"))!;
    const font = gameFont("font-title");
    const px = (part: FakeElement, key: string) => Number.parseFloat(part.style[key]!);
    const pixel = px(label, "fontSize") / WEB_FONT_EM;
    const ink = fontInk("font-title", { scale: 1 }, shownText("title", word));
    const start = px(label, "left") + ink.left * pixel;
    const end = px(label, "left") + ink.right * pixel;
    const button = element.all().find((part) => part.children.includes(face))!;
    const faceWidth = Number.parseFloat(button.style.getPropertyValue("--ui-form-action-width"));
    expect(start - px(icon, "left") - px(icon, "width")).toBeCloseTo(
      SETTINGS_CARD.installGap * scale.unit * dpr,
    );
    expect((px(icon, "left") + end) / 2).toBeCloseTo(faceWidth / 2);
    expect(px(icon, "height")).toBeCloseTo(fontFileMetrics("font-title").capHeight * pixel);
    expect(px(icon, "top")).toBeCloseTo(px(label, "top") + capRows(font, "title") * pixel);
    shown.destroy();
  },
);
