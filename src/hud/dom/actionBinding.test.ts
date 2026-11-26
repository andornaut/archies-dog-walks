import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { afterEach, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { MENU_TEXT } from "../../data/menuText.ts";
import { read } from "../../rules/units.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { bindGameAction, bindGameActionHolds } from "../../ui/dom/actionBinding.ts";
import { createPanelButton } from "../../ui/dom/index.ts";
import { guardNativeInput } from "../../ui/dom/modalLifecycle.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { panelButton } from "../../ui/modal/view.ts";

const duration = read(gameData.tuning, "seconds", "holdSeconds") * 1000;
afterEach(() => vi.useRealTimers());

function fixture() {
  vi.useFakeTimers();
  const doc = new FakeDocument();
  Object.assign(doc.defaultView, {
    clearTimeout: globalThis.clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout: globalThis.setTimeout,
  });
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const gate = createModalInputGate();
  const cancel = vi.fn();
  const activate = vi.fn();
  const part = createPanelButton(
    doc as unknown as Document,
    {
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      press: { accepts: gate.accepts, burst: vi.fn(), press: activate },
    },
    panelButton(
      {
        title: fontMetrics(gameFont("font-title")),
        titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
      },
      { height: 48, width: 128, x: 0, y: 0 },
      true,
      MENU_TEXT.pause.resume,
    ),
  );
  const button = part.element as unknown as FakeElement;
  element.append(button);
  const stop = guardNativeInput(
    { cancel, claim: layer.press.claim, gate, subscribe: gate.subscribe },
    element as unknown as HTMLElement,
  );
  const pointer = (type: string, target = button) => ({
    button: 0,
    buttons: type === "pointerdown" ? 1 : 0,
    clientX: 10,
    clientY: 10,
    detail: 1,
    isPrimary: true,
    pointerId: 7,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
    target,
    timeStamp: Date.now(),
    type,
  });
  const down = () => element.fire("pointerdown", pointer("pointerdown"));
  const release = () => {
    doc.fire("pointerup", pointer("pointerup"));
    const event = pointer("click");
    element.fire("click", event);
    if (!event.stopImmediatePropagation.mock.calls.length) {
      button.fire("click", event);
    }
  };
  return { activate, button, cancel, doc, down, element, gate, layer, pointer, release, stop };
}

it("the actual panel button inherits its action for hold and cancels the tracked release", () => {
  const view = fixture();
  view.activate.mockImplementation(() => expect(view.cancel).toHaveBeenCalledOnce());
  view.down();
  vi.advanceTimersByTime(duration);
  expect(view.activate).toHaveBeenCalledExactlyOnceWith();
  expect(view.layer.press.canvasAllowed()).toBe(false);
  vi.advanceTimersByTime(duration);
  view.release();
  expect(view.layer.press.canvasAllowed()).toBe(true);
  expect(view.activate).toHaveBeenCalledOnce();
  view.stop();
});

// One millisecond short of the data's hold time is a tap; exactly the hold time is a hold.
it.each([
  ["taps", duration - 1, 0],
  ["holds", duration, 1],
] as const)("%s a panel button pressed for %i ms, acting once", (_, ms, held) => {
  const view = fixture();
  view.down();
  vi.advanceTimersByTime(ms);
  expect(view.activate).toHaveBeenCalledTimes(held);
  view.release();
  expect(view.activate).toHaveBeenCalledOnce();
  view.stop();
});

it("reads the live hold time when a press begins", () => {
  const { tuning } = gameData;
  const seconds = { ...tuning.seconds, holdSeconds: 2 * tuning.seconds.holdSeconds };
  Object.assign(gameData, { tuning: { ...tuning, seconds } });
  try {
    const view = fixture();
    view.down();
    vi.advanceTimersByTime(duration);
    expect(view.activate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(duration);
    expect(view.activate).toHaveBeenCalledOnce();
    view.release();
    view.stop();
  } finally {
    Object.assign(gameData, { tuning });
  }
});

it("does not dispatch an old panel action after modal ownership or foreground is lost", () => {
  const view = fixture();
  view.down();
  const covering = view.gate.open();
  covering.close();
  vi.advanceTimersByTime(duration);
  expect(view.activate).not.toHaveBeenCalled();
  view.release();
  view.down();
  view.doc.hidden = true;
  view.doc.fire("visibilitychange");
  view.doc.hidden = false;
  view.doc.fire("visibilitychange");
  vi.advanceTimersByTime(duration);
  expect(view.activate).not.toHaveBeenCalled();
  view.stop();
});

it("uses only the nearest input root when a native row is inside a modal", () => {
  const view = fixture();
  const stop = bindGameActionHolds(
    { cancelPress: vi.fn(), guard: { gate: view.gate }, unit: () => 1 },
    view.button as unknown as HTMLElement,
  );
  view.down();
  view.button.fire("pointerdown", view.pointer("pointerdown"));
  vi.advanceTimersByTime(duration);
  expect(view.activate).toHaveBeenCalledOnce();
  stop();
  view.stop();
});

it("requires one registration and preserves an explicitly owned different hold", () => {
  const view = fixture();
  expect(() =>
    bindGameAction(
      { activate: vi.fn(), available: () => true },
      view.button as unknown as HTMLElement,
    ),
  ).toThrow("one action binding");
  const explicit = view.doc.createElement("button");
  view.element.append(explicit);
  const action = vi.fn();
  bindGameAction(
    {
      activate: action,
      available: () => true,
      hold: { external: "home-selection-detail" },
      pointer: "release",
    },
    explicit as unknown as HTMLElement,
  );
  view.element.fire("pointerdown", view.pointer("pointerdown", explicit));
  vi.advanceTimersByTime(duration);
  expect(action).not.toHaveBeenCalled();
  explicit.fire("click", { detail: 0 });
  expect(action).toHaveBeenCalledOnce();
  view.stop();
});

it("keeps an explicitly different native hold separate from its tap action", () => {
  const view = fixture();
  const control = view.doc.createElement("button");
  view.element.append(control);
  const tap = vi.fn();
  const detail = vi.fn();
  bindGameAction(
    { activate: tap, available: () => true, hold: detail },
    control as unknown as HTMLElement,
  );
  view.element.fire("pointerdown", view.pointer("pointerdown", control));
  vi.advanceTimersByTime(duration);
  expect(detail).toHaveBeenCalledOnce();
  expect(tap).not.toHaveBeenCalled();
  view.doc.fire("pointerup", view.pointer("pointerup", control));
  const event = view.pointer("click", control);
  view.element.fire("click", event);
  if (!event.stopImmediatePropagation.mock.calls.length) {
    control.fire("click", event);
  }
  expect(tap).not.toHaveBeenCalled();
  control.fire("click", { detail: 0 });
  expect(tap).toHaveBeenCalledOnce();
  view.stop();
});

it("does not arm a panel hold when another input already owns the contact lease", () => {
  const view = fixture();
  const release = view.layer.press.claim()!;
  view.down();
  vi.advanceTimersByTime(duration);
  expect(view.activate).not.toHaveBeenCalled();
  expect(view.layer.press.canvasAllowed()).toBe(false);
  release.release();
  view.stop();
});

it("rechecks actual control visibility before a held action or its release can run", () => {
  const view = fixture();
  view.down();
  vi.advanceTimersByTime(duration / 2);
  view.button.hidden = true;
  vi.advanceTimersByTime(duration);
  view.release();
  expect(view.activate).not.toHaveBeenCalled();
  view.stop();
});
