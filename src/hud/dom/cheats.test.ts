import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { NEXT_WALK_OFF } from "../../dev/cheats.ts";
import { cheatsView } from "../../dev/cheatsView.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { showCheats } from "./cheats.ts";

async function cheatsScreen(inWalk = false) {
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
      canResetSave: false,
      linkCopied: false,
      next: NEXT_WALK_OFF,
      walk: inWalk ? { canFinish: false, upgradesLeft: [] } : undefined,
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
  return { act, element, pointerClick, seed, shown, view };
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

it("keeps the disabled Invincible switch pointer-only during a walk", async () => {
  const { act, element, pointerClick, shown, view } = await cheatsScreen(true);
  const row = view.rows.find((row) => row.action !== undefined && !row.enabled)!;
  const control = element
    .all()
    .find((node) => node.getAttribute("aria-label") === `${row.label}: ${row.value}`)!;
  const refusing = () =>
    control.all().some((node) => node.classList.contains("adw-refusing-still"));
  expect(control.disabled).toBe(false);
  expect(control.tabIndex).toBe(-1);
  expect(control.getAttribute("aria-disabled")).toBe("true");
  expect(control.getAttribute("aria-description")).toBeNull();
  control.fire("click", { detail: 0 });
  expect(refusing()).toBe(false);
  shown.setInert(true);
  pointerClick(control);
  expect(refusing()).toBe(false);
  shown.setInert(false);
  pointerClick(control);
  expect(refusing()).toBe(true);
  expect(act).not.toHaveBeenCalled();
  shown.destroy();
  for (const node of control.all()) {
    node.classList.remove("adw-refusing-still");
  }
  pointerClick(control);
  expect(refusing()).toBe(false);
});
