import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { afterEach, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { bindGameAction, bindGameActionHolds } from "./actionBinding.ts";
import { createGameButton } from "./gameButton.ts";
import { guardNativeInput } from "./modalLifecycle.ts";

const duration = gameData.tuning.seconds.holdSeconds * 1000;
afterEach(() => vi.useRealTimers());

function fixture(override = false, unavailable: boolean | "pointer" = false) {
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
    ...(unavailable === "pointer"
      ? {
          getState: () => ({ availability: { kind: "pointer-refusal" as const } }),
          onPointerRefusal: refuse,
        }
      : unavailable
        ? {
            getState: () => ({
              availability: { kind: "unavailable" as const, reason: "Not ready" },
            }),
            onUnavailable: refuse,
          }
        : {}),
  });
  const button = view.element as unknown as ReturnType<FakeDocument["createElement"]>;
  root.append(button);
  const bind = (contactGuard = false) =>
    contactGuard
      ? guardNativeInput(
          { cancel: cancelPress, gate, subscribe: gate.subscribe },
          root as unknown as HTMLElement,
        )
      : bindGameActionHolds(
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
    timeStamp: Date.now(),
    type,
  });
  const click = (detail = 0) => {
    const event = { ...pointer("click"), detail };
    root.fire("click", event);
    if (event.stopImmediatePropagation.mock.calls.length === 0) {
      button.fire("click", event);
    }
  };
  Object.assign(button, { click });
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

it("uses the focused button's action once for a foreground key without intercepting native Enter", () => {
  const current = fixture();
  const stop = current.bind();
  const preventDefault = vi.fn();
  const send = (code: string, repeat = false) =>
    current.button.fire("keydown", { code, preventDefault, repeat, target: current.button });
  send("KeyE");
  expect(current.activate).not.toHaveBeenCalled();
  current.button.focus();
  send("Enter");
  expect(preventDefault).not.toHaveBeenCalled();
  send("KeyE");
  send("KeyE", true);
  expect(current.activate).toHaveBeenCalledOnce();
  const modal = current.gate.open();
  send("KeyF");
  expect(current.activate).toHaveBeenCalledOnce();
  modal.close();
  send("KeyF");
  expect(current.activate).toHaveBeenCalledTimes(2);
  stop();
  current.view.dispose();
});

it("suppresses secondary context only when it invokes an available foreground action", () => {
  const active = fixture();
  const denied = fixture(false, true);
  const stopActive = active.bind();
  const stopDenied = denied.bind();
  const right = (current: ReturnType<typeof fixture>) => {
    const event = { ...current.pointer("contextmenu"), button: 2 };
    current.button.fire("contextmenu", event);
    return event.preventDefault;
  };
  expect(right(active)).toHaveBeenCalledOnce();
  expect(active.activate).toHaveBeenCalledOnce();
  expect(right(denied)).not.toHaveBeenCalled();
  expect(denied.activate).not.toHaveBeenCalled();
  expect(denied.refuse).not.toHaveBeenCalled();
  const modal = active.gate.open();
  expect(right(active)).not.toHaveBeenCalled();
  expect(active.activate).toHaveBeenCalledOnce();
  modal.close();
  stopActive();
  stopDenied();
  active.view.dispose();
  denied.view.dispose();
});

it("supplies the actual button to action and state resolvers through native admission", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  doc.body.append(root);
  const activate = vi.fn();
  const getAction = vi.fn((element: HTMLButtonElement) =>
    element.getAttribute("aria-pressed") === "true" ? { activate } : null,
  );
  const getState = vi.fn((element: HTMLButtonElement) => ({
    toggled: element.getAttribute("data-ready") === "true",
  }));
  const view = createGameButton(doc as unknown as Document, {
    content: { kind: "text", label: gameData.menuText.pause.resume },
    getAction,
    getState,
  });
  const button = view.element as unknown as ReturnType<FakeDocument["createElement"]>;
  root.append(button);
  expect(getState).toHaveBeenCalledWith(view.element);
  button.fire("click", { detail: 0 });
  expect(getAction).not.toHaveBeenCalled();
  const stop = bindGameActionHolds(
    { cancelPress: vi.fn(), guard: { gate: createModalInputGate() }, unit: () => 1 },
    root as unknown as HTMLElement,
  );
  button.fire("click", { detail: 0 });
  expect(getAction).toHaveBeenCalledWith(view.element);
  expect(activate).not.toHaveBeenCalled();
  button.setAttribute("data-ready", "true");
  button.fire("click", { detail: 0 });
  expect(activate).toHaveBeenCalledOnce();
  expect(button.getAttribute("aria-pressed")).toBe("true");
  stop();
  view.dispose();
});

it.each([false, true])(
  "uses one hold dispatcher and suppresses release (contact guard: %s)",
  (contactGuard) => {
    const current = fixture();
    const stop = current.bind(contactGuard);
    current.root.fire("pointerdown", current.pointer("pointerdown"));
    vi.advanceTimersByTime(duration);
    expect(current.activate).toHaveBeenCalledOnce();
    expect(current.cancelPress).toHaveBeenCalledOnce();
    current.doc.fire("pointerup", current.pointer("pointerup"));
    current.click(1);
    expect(current.activate).toHaveBeenCalledOnce();
    stop();
  },
);

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

it("keeps the Kit action host and caller classes on an authored face", () => {
  const doc = new FakeDocument();
  const view = createGameButton(doc as unknown as Document, {
    appearance: { className: "board", face: { className: "paint" } },
    content: { kind: "icon", name: gameData.homeText.slotSign },
    getAction: () => ({ activate: vi.fn() }),
    skin: "authored",
  });
  expect(view.element.classList.contains("board")).toBe(true);
  expect(view.element.classList.contains("ui-standard-button")).toBe(true);
  expect(view.element.classList.contains("adw-standard-button")).toBe(false);
  expect(view.face.classList.contains("paint")).toBe(true);
  expect(view.face.classList.contains("ui-button-face")).toBe(true);
  expect(view.face.classList.contains("adw-standard-button-face")).toBe(false);
  view.dispose();
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

it("keeps pointer-only refusal out of keyboard activation and covered input", () => {
  const current = fixture(false, "pointer");
  current.click(1);
  expect(current.refuse).not.toHaveBeenCalled();
  const stop = current.bind(true);
  expect(current.button.tabIndex).toBe(-1);
  expect(current.button.getAttribute("aria-describedby")).toBeNull();
  expect(current.button.getAttribute("aria-description")).toBeNull();
  current.click();
  expect(current.refuse).not.toHaveBeenCalled();
  current.root.fire("pointerdown", current.pointer("pointerdown"));
  vi.advanceTimersByTime(duration - 1);
  current.doc.fire("pointerup", current.pointer("pointerup"));
  current.click(1);
  expect(current.refuse).toHaveBeenCalledOnce();
  const modal = current.gate.open();
  current.click(1);
  expect(current.refuse).toHaveBeenCalledOnce();
  expect(current.activate).not.toHaveBeenCalled();
  modal.close();
  stop();
});

it("accepts a completed short tap and keyboard click outside the hold contact", () => {
  const current = fixture();
  const stop = current.bind(true);
  current.root.fire("pointerdown", current.pointer("pointerdown"));
  vi.advanceTimersByTime(duration - 1);
  current.doc.fire("pointerup", current.pointer("pointerup"));
  current.click(1);
  expect(current.activate).toHaveBeenCalledOnce();
  current.click();
  expect(current.activate).toHaveBeenCalledTimes(2);
  stop();
});

it("rejects a release invalidated by modal coverage before accepting a fresh keyboard action", () => {
  const current = fixture();
  const stop = current.bind(true);
  current.root.fire("pointerdown", current.pointer("pointerdown"));
  const covering = current.gate.open();
  covering.close();
  current.doc.fire("pointerup", current.pointer("pointerup"));
  current.click(1);
  expect(current.activate).not.toHaveBeenCalled();
  current.click();
  expect(current.activate).toHaveBeenCalledOnce();
  stop();
});
