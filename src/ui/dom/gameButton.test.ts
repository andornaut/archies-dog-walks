import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { afterEach, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { bindGameAction, bindGameActionHolds } from "./actionBinding.ts";
import { createGameButton } from "./gameButton.ts";

const duration = gameData.tuning.seconds.holdSeconds * 1000;
afterEach(() => vi.useRealTimers());

function fixture(override = false, unavailable = false) {
  vi.useFakeTimers();
  const doc = new FakeDocument();
  Object.assign(doc.defaultView, {
    clearTimeout: globalThis.clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout: globalThis.setTimeout,
  });
  const root = doc.createElement("div");
  doc.body.append(root);
  const gate = createModalInputGate();
  const activate = vi.fn();
  const hold = vi.fn();
  const cancelPress = vi.fn();
  const refuse = vi.fn();
  const view = createGameButton(doc as unknown as Document, {
    content: { kind: "text", label: gameData.menuText.pause.resume },
    getAction: () => ({ activate, ...(override ? { hold } : {}) }),
    ...(unavailable
      ? {
          getState: () => ({ availability: { kind: "unavailable" as const, reason: "Not ready" } }),
          onUnavailable: refuse,
        }
      : {}),
  });
  const button = view.element as unknown as ReturnType<FakeDocument["createElement"]>;
  root.append(button);
  const bind = () =>
    bindGameActionHolds(
      { cancelPress, guard: { gate }, unit: () => 2 },
      root as unknown as HTMLElement,
    );
  const pointer = (type: string) => ({
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
    target: button,
    type,
  });
  const click = (detail = 0) => {
    const event = { ...pointer("click"), detail };
    root.fire("click", event);
    if (event.stopImmediatePropagation.mock.calls.length === 0) {
      button.fire("click", event);
    }
  };
  return {
    activate,
    bind,
    button,
    cancelPress,
    click,
    doc,
    gate,
    hold,
    pointer,
    refuse,
    root,
    view,
  };
}

it("fails closed without its input root and rechecks readiness for native activation", () => {
  const current = fixture();
  current.click();
  expect(current.activate).not.toHaveBeenCalled();
  const stop = current.bind();
  current.click();
  expect(current.activate).toHaveBeenCalledOnce();
  const modal = current.gate.open();
  current.click();
  expect(current.activate).toHaveBeenCalledOnce();
  modal.close();
  current.click();
  expect(current.activate).toHaveBeenCalledTimes(2);
  stop();
  current.click();
  expect(current.activate).toHaveBeenCalledTimes(2);
});

it("uses the existing hold dispatcher once and suppresses the matching release click", () => {
  const current = fixture();
  const stop = current.bind();
  current.root.fire("pointerdown", current.pointer("pointerdown"));
  vi.advanceTimersByTime(duration);
  expect(current.activate).toHaveBeenCalledOnce();
  expect(current.cancelPress).toHaveBeenCalledOnce();
  current.doc.fire("pointerup", current.pointer("pointerup"));
  current.click(1);
  expect(current.activate).toHaveBeenCalledOnce();
  stop();
});

it("keeps an explicit hold override and unregisters it when disposed", () => {
  const current = fixture(true);
  const stop = current.bind();
  current.root.fire("pointerdown", current.pointer("pointerdown"));
  vi.advanceTimersByTime(duration);
  expect(current.hold).toHaveBeenCalledOnce();
  expect(current.activate).not.toHaveBeenCalled();
  current.view.dispose();
  current.click();
  expect(current.activate).not.toHaveBeenCalled();
  stop();
});

it("rejects a parallel legacy click binding on a standard button", () => {
  const current = fixture();
  expect(() =>
    bindGameAction({ activate: vi.fn(), available: () => true }, current.view.element),
  ).toThrow("A control must have one action binding");
  current.view.dispose();
});

it("keeps refusal feedback behind the same readiness guard as successful actions", () => {
  const current = fixture(false, true);
  current.click();
  expect(current.refuse).not.toHaveBeenCalled();
  const stop = current.bind();
  current.click();
  expect(current.refuse).toHaveBeenCalledOnce();
  const modal = current.gate.open();
  current.click();
  expect(current.refuse).toHaveBeenCalledOnce();
  expect(current.activate).not.toHaveBeenCalled();
  modal.close();
  stop();
});
