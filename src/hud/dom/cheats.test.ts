import { expect, it, vi } from "vitest";

import { NEXT_WALK_OFF, startZones } from "../../cheats/cheats.ts";
import { cheatsView } from "../../cheats/cheatsView.ts";
import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { REFUSAL_RED } from "../../ui/dom/refusal.ts";
import { domScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
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
      next: NEXT_WALK_OFF,
      walk: inWalk ? { invincible: false, zone: startZones(gameData)[0]! } : undefined,
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
  const stacks = view.rows.some((row) => row.buttons.some((button) => button.rect.y > row.rect.y));
  expect(stacks).toBe(true);
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
