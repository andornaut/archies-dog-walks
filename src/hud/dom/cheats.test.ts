import { expect, it, vi } from "vitest";

import { NEXT_WALK_OFF, startZones } from "../../cheats/cheats.ts";
import { cheatsView } from "../../cheats/cheatsView.ts";
import { gameData } from "../../data/index.ts";
import { SETTINGS_ROW, SETTINGS_SWITCH_GAP } from "../../home/settings.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, fontInk, gameFont, inkWidth } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { capRows, shownText, WEB_FONT_EM } from "../../ui/dom/pixelLine.ts";
import { REFUSAL_RED } from "../../ui/dom/refusal.ts";
import { artPixel, domScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { showCheats } from "./cheats.ts";

vi.mock("../../ui/dom/domCuts.ts", () => ({
  cutDomArt: vi.fn(() => Promise.resolve("blob:cut")),
  cutDomFrame: vi.fn(() => Promise.resolve("blob:frame")),
}));

async function cheatsScreen(
  inWalk = false,
  canResetSave = false,
  scale = domScale(1, { height: 560, width: 360, x: 0, y: 0 }),
  invincible = false,
) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, scale);
  const view = cheatsView(
    {
      body: fontFileMetrics("font-body"),
      inkWidth: (font, line) =>
        inkWidth(
          `font-${font}`,
          { scale: TEXT_SCALE },
          font === "title" ? line.toUpperCase() : line,
        ),
      title: fontFileMetrics("font-title"),
      titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
      wrapNote: (_width, text) => [text],
    },
    { data: gameData, words: gameData.menuText },
    {
      canResetSave,
      next: { ...NEXT_WALK_OFF, invincible },
      walk: inWalk ? { invincible, zone: startZones(gameData)[0]! } : undefined,
    },
  );
  const act = vi.fn();
  const seed = vi.fn();
  const shown = showCheats(layer, {
    act,
    artUrl: (path) => path,
    close: vi.fn(),
    closeLabel: gameData.menuText.common,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: async (path) => ownArtFrames(path),
    reducedMotion: () => true,
    seed,
    toGame: (point) => point,
    view,
  });
  await vi.waitFor(() => expect(shown.accepts()).toBe(true));
  const [dialog] = layerViews(element);
  const pointerClick = (control: FakeElement) => {
    const event = {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
      isPrimary: true,
      pointerId: 7,
      target: control,
      timeStamp: performance.now(),
    };
    dialog!.fire("pointerdown", { ...event, type: "pointerdown" });
    doc.fire("pointerup", { ...event, buttons: 0, type: "pointerup" });
    const click = { ...event, buttons: 0, detail: 1, stopImmediatePropagation: vi.fn() };
    dialog!.fire("click", click);
    if (click.stopImmediatePropagation.mock.calls.length === 0) {
      control.fire("click", click);
    }
  };
  return { act, doc, element, pointerClick, seed, shown, view };
}

it("keeps Cheats actions guarded and disposable and renders only the approved controls", async () => {
  const { act, element, pointerClick, seed, shown, view } = await cheatsScreen();
  const action = view.rows
    .flatMap((row) => row.buttons)
    .find((button) => button.available !== false)!;
  const button = element.all().find((node) => node.getAttribute("aria-label") === action.label)!;
  expect(button.classList.contains("adw-standard-button")).toBe(true);
  expect(button.classList.contains("adw-selectable-button")).toBe(true);
  expect(button.getAttribute("data-ui-selected")).toBe("");
  shown.setInert(true);
  button.fire("click");
  expect(act).not.toHaveBeenCalled();
  shown.setInert(false);
  button.fire("click");
  expect(act).toHaveBeenCalledExactlyOnceWith(action.action);
  const unavailable = view.rows
    .flatMap((row) => row.buttons)
    .find((button) => button.available === false)!;
  const refused = element
    .all()
    .find(
      (node) =>
        node.getAttribute("aria-label") === unavailable.label &&
        node.getAttribute("aria-disabled") === "true",
    )!;
  expect(refused.tabIndex).toBe(-1);
  expect(refused.getAttribute("aria-description")).toBeNull();
  refused.fire("click", { detail: 0 });
  expect(refused.classList.contains("adw-refusing-still")).toBe(false);
  shown.setInert(true);
  pointerClick(refused);
  expect(refused.classList.contains("adw-refusing-still")).toBe(false);
  shown.setInert(false);
  pointerClick(refused);
  expect(act).toHaveBeenCalledTimes(1);
  expect(refused.getAttribute("aria-disabled")).toBe("true");
  expect(refused.classList.contains("adw-refusing-still")).toBe(true);
  expect(element.all().some((node) => node.tagName === "input")).toBe(false);
  expect(seed).not.toHaveBeenCalled();
  shown.destroy();
  button.fire("click");
  expect(act).toHaveBeenCalledTimes(1);
});

it("accepts a single press on Invincible and the selected neighbourhood during a walk", async () => {
  const { act, element, pointerClick, shown, view } = await cheatsScreen(true);
  const row = view.rows.find(({ action }) => action?.kind === "invincible")!;
  const toggle = element.all().find((node) => node.getAttribute("role") === "switch")!;
  expect([toggle.tabIndex, toggle.getAttribute("aria-checked")]).toEqual([
    0,
    String(row.switch?.on),
  ]);
  expect(toggle.all().map(({ textContent }) => textContent)).toEqual(
    expect.arrayContaining([row.label, row.value]),
  );
  pointerClick(toggle);
  expect(act).toHaveBeenCalledExactlyOnceWith(row.action);

  const selected = view.rows.flatMap(({ buttons }) => buttons).find(({ selected }) => selected)!;
  const button = element.all().find((node) => node.getAttribute("aria-label") === selected.label)!;
  pointerClick(button);
  expect(act).toHaveBeenLastCalledWith(selected.action);
  expect(act).toHaveBeenCalledTimes(2);
  shown.destroy();
});

it("refuses a disabled switch row's press with the cue on the whole row", async () => {
  const { act, element, pointerClick, shown, view } = await cheatsScreen();
  shown.update({
    ...view,
    rows: view.rows.map((row) => (row.kind === "switch" ? { ...row, enabled: false } : row)),
  });
  const toggle = element.all().find((node) => node.getAttribute("role") === "switch")!;
  pointerClick(toggle);
  expect(act).not.toHaveBeenCalled();
  expect([
    toggle.hasAttribute(REFUSAL_RED),
    toggle.classList.contains("adw-refusing-still"),
  ]).toEqual([true, true]);
  expect(toggle.all().some((node) => node.classList.contains("adw-refusing-still"))).toBe(false);
  shown.destroy();
});

it("restores focus to the Reset save button when its confirmation closes", async () => {
  const { doc, element, shown } = await cheatsScreen(false, true);
  const reset = element
    .all()
    .find((node) => node.getAttribute("aria-label") === gameData.menuText.cheats.resetSave);
  expect(reset?.tabIndex).toBe(0);
  shown.setInert(true);
  shown.setInert(false);
  shown.focusReset();
  expect(doc.activeElement).toBe(reset);
  shown.destroy();
});

it.each([
  [360, 608, 2],
  [412, 915, 2.625],
  [390, 844, 3],
])("places every Cheats button on its face's grid box at %ix%i and DPR %f", async (w, h, dpr) => {
  const scale = domScale(dpr, { height: h, width: w, x: 0, y: 0 });
  const { element, shown, view } = await cheatsScreen(false, true, scale);
  const { viewport } = view.layout;
  const px = (value: string | undefined) => Number.parseFloat(value ?? "");
  for (const button of view.rows.flatMap((row) => row.buttons)) {
    const control = element.all().find((node) => node.getAttribute("aria-label") === button.label)!;
    const group = control.parent!;
    const at = (name: string) => px(control.style.getPropertyValue(`--ui-action-${name}`));
    expect(Number.isInteger(button.rect.height)).toBe(true);
    expect(button.lines.map(({ text }) => text).join(" ")).toBe(button.label);
    const box = gridRect(scale, button.rect);
    expect({
      height: at("height"),
      left: px(group.style.left) + at("x"),
      top: px(group.style.top) + at("y"),
      width: at("width"),
    }).toEqual({
      ...box,
      left: box.left - gridX(scale, viewport.x),
      top: box.top - gridY(scale, viewport.y),
    });
  }
  shown.destroy();
});

it.each([
  [360, 1, false],
  [360, 1, true],
  [575, 1, false],
  [575, 1, true],
  [390, 2.625, false],
  [390, 2.625, true],
  [393, 3, false],
  [393, 3, true],
] as const)(
  "anchors Cheats' %s/DPR%s switch state %s on Settings' painted grid",
  async (width, dpr, on) => {
    const scale = domScale(dpr, { height: (width * 560) / 360, width, x: 0, y: 0 });
    const { element, shown, view } = await cheatsScreen(false, true, scale, on);
    const row = element.all().find((node) => node.getAttribute("role") === "switch")!;
    const current = view.rows.find(({ kind }) => kind === "switch")!;
    const word = shownText("title", current.value);
    const span = row
      .all()
      .find((node) => node.classList.contains("adw-text") && node.textContent === word)!;
    const toggle = row.all().find((node) => node.classList.contains("ui-switch"))!;
    const pixel = (name: string) => Number.parseFloat(row.style.getPropertyValue(name));
    const right =
      gridX(scale, current.rect.x + current.rect.width - SETTINGS_ROW.pad) -
      gridX(scale, current.rect.x);
    const switchRight =
      right - pixel("--ui-form-switch-end") + Number.parseFloat(toggle.style.left!);
    const switchCentre = switchRight - pixel("--ui-switch-width") / 2;
    const switchBottom = pixel("--ui-form-value-offset") + pixel("--ui-switch-height");
    const fontPixel = Number.parseFloat(span.style.fontSize!) / WEB_FONT_EM;
    const ink = fontInk("font-title", { scale: 1 }, word);
    const inkCentre =
      Number.parseFloat(span.style.left!) + ((ink.left + ink.right) * fontPixel) / 2;
    const inkRight = Number.parseFloat(span.style.left!) + ink.right * fontPixel;
    const capTop =
      Number.parseFloat(span.style.top!) + capRows(gameFont("font-title"), "title") * fontPixel;
    expect(Math.abs(inkCentre - switchCentre)).toBeLessThanOrEqual(0.5);
    expect(Math.max(inkRight, switchRight)).toBe(right);
    expect(capTop - switchBottom).toBe(SETTINGS_SWITCH_GAP * artPixel(scale));
    expect(row.getAttribute("aria-checked")).toBe(String(on));
    expect(row.hasAttribute("data-ui-form-press-dip")).toBe(false);
    shown.destroy();
  },
);
