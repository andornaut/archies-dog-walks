import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { NEXT_WALK_OFF, startZones } from "../../dev/cheats.ts";
import { cheatsView } from "../../dev/cheatsView.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { showCheats } from "./cheats.ts";

async function cheatsScreen(inWalk = false, canResetSave = false) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
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
    { data: gameData, screen: SCREEN_CONFIG, words: gameData.menuText },
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
    closeLabel: gameData.menuText.common.close,
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
  const toggle = element
    .all()
    .find((node) => node.getAttribute("aria-label") === `${row.label}: ${row.value}`)!;
  expect(toggle.tabIndex).toBe(0);
  pointerClick(toggle);
  expect(act).toHaveBeenCalledExactlyOnceWith(row.action);

  const selected = view.rows.flatMap(({ buttons }) => buttons).find(({ selected }) => selected)!;
  const button = element.all().find((node) => node.getAttribute("aria-label") === selected.label)!;
  pointerClick(button);
  expect(act).toHaveBeenLastCalledWith(selected.action);
  expect(act).toHaveBeenCalledTimes(2);
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
