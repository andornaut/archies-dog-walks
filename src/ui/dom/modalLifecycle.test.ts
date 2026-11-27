import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { describe, expect, it, vi } from "vitest";

import { createPressAdmission } from "../../pressAdmission.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { domScale } from "../domScale.ts";
import { guardNativeInput, mountModalLifecycle } from "./modalLifecycle.ts";

const pointer = (pointerId: number, target: FakeElement, type = "pointerdown") => ({
  detail: 1,
  pointerId,
  preventDefault: vi.fn(),
  stopImmediatePropagation: vi.fn(),
  target,
  timeStamp: 10,
  type,
});

// FakeTarget.fire intentionally does not model propagation. Document capture must stop at
// stopImmediatePropagation here, as a browser does before the newer root hears pointerup.
function documentCapture(doc: FakeDocument, event: ReturnType<typeof pointer>) {
  for (const listener of doc.listeners.get(event.type) ?? []) {
    listener(event);
    if (event.stopImmediatePropagation.mock.calls.length > 0) {
      break;
    }
  }
}

function freshDown(doc: FakeDocument, root: FakeElement): void {
  const event = pointer(1, root);
  documentCapture(doc, event);
  if (event.stopImmediatePropagation.mock.calls.length === 0) {
    root.fire("pointerdown", event);
  }
}

function crossRootFixture() {
  const doc = new FakeDocument();
  const background = doc.createElement("div");
  const dialog = doc.createElement("div");
  doc.body.append(background, dialog);
  const gate = createModalInputGate();
  const stopBackground = guardNativeInput(
    { gate, subscribe: gate.subscribe },
    background as unknown as HTMLElement,
  );
  freshDown(doc, background);
  const modal = gate.open();
  const up = vi.fn();
  const stopDialog = guardNativeInput(
    { gate: modal, subscribe: gate.subscribe, up },
    dialog as unknown as HTMLElement,
  );
  return {
    dialog,
    dispose: () => {
      stopDialog();
      stopBackground();
      modal.close();
      expect(doc.listeners.get("pointerdown") ?? []).toHaveLength(0);
    },
    doc,
    up,
  };
}

it("admits the first fresh same-ID dialog contact after an older root lost its cancelled release", () => {
  const f = crossRootFixture();
  const contact = () => {
    const before = f.up.mock.calls.length;
    freshDown(f.doc, f.dialog);
    const release = pointer(1, f.dialog, "pointerup");
    documentCapture(f.doc, release);
    const click = pointer(1, f.dialog, "click");
    f.dialog.fire("click", click);
    return {
      clickRejected: click.stopImmediatePropagation.mock.calls.length > 0,
      releaseRejected: release.stopImmediatePropagation.mock.calls.length > 0,
      upCalls: f.up.mock.calls.length - before,
    };
  };
  const first = contact();
  const second = contact();
  f.dispose();
  expect(second).toEqual({ clickRejected: false, releaseRejected: false, upCalls: 1 });
  expect(first).toEqual({ clickRejected: false, releaseRejected: false, upCalls: 1 });
});

it("still suppresses the old carried release when no fresh dialog pointerdown occurred", () => {
  const f = crossRootFixture();
  const moved = pointer(1, f.dialog, "pointermove");
  documentCapture(f.doc, moved);
  expect(moved.stopImmediatePropagation).toHaveBeenCalledOnce();
  const carried = pointer(1, f.dialog, "pointerup");
  documentCapture(f.doc, carried);
  expect(carried.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(f.up).not.toHaveBeenCalled();
  freshDown(f.doc, f.dialog);
  const fresh = pointer(1, f.dialog, "pointerup");
  documentCapture(f.doc, fresh);
  expect(fresh.stopImmediatePropagation).not.toHaveBeenCalled();
  expect(f.up).toHaveBeenCalledOnce();
  f.dispose();
});

it("admits one native pointer and cancels its hold across a modal even after that modal closes", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const gate = createModalInputGate();
  const down = vi.fn();
  const up = vi.fn();
  const cancel = vi.fn();
  const leaseRelease = vi.fn();
  const stop = guardNativeInput(
    { cancel, claim: () => ({ release: leaseRelease }), down, gate, subscribe: gate.subscribe, up },
    root as unknown as HTMLElement,
  );
  const first = pointer(1, root);
  root.fire("pointerdown", first);
  root.fire("pointerdown", pointer(2, root));
  expect(down).toHaveBeenCalledOnce();
  const modal = gate.open();
  modal.close();
  expect(cancel).toHaveBeenCalledOnce();
  expect(leaseRelease).toHaveBeenCalledOnce();
  const release = pointer(1, root, "pointerup");
  doc.fire("pointerup", release);
  expect(release.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(up).not.toHaveBeenCalled();
  root.fire("pointerdown", pointer(3, root));
  doc.fire("pointerup", pointer(3, root, "pointerup"));
  expect(down).toHaveBeenCalledTimes(2);
  expect(up).toHaveBeenCalledOnce();
  expect(leaseRelease).toHaveBeenCalledTimes(2);
  stop();
  expect(leaseRelease).toHaveBeenCalledTimes(2);
});

it("observes click origin only after native admission and retires observation with its root", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const gate = createModalInputGate();
  const observeClick = vi.fn();
  const stop = guardNativeInput(
    { gate, observeClick, subscribe: gate.subscribe, up: () => true },
    root as unknown as HTMLElement,
  );
  const unclaimed = pointer(1, root, "click");
  root.fire("click", unclaimed);
  expect(unclaimed.stopImmediatePropagation).toHaveBeenCalled();
  expect(observeClick).not.toHaveBeenCalled();
  root.fire("pointerdown", pointer(2, root));
  doc.fire("pointerup", pointer(2, root, "pointerup"));
  root.fire("click", pointer(2, root, "click"));
  expect(observeClick).not.toHaveBeenCalled();
  const keyboard = { ...pointer(3, root, "click"), detail: 0 };
  root.fire("click", keyboard);
  expect(observeClick).toHaveBeenCalledExactlyOnceWith(keyboard);
  expect(keyboard.preventDefault).not.toHaveBeenCalled();
  expect(keyboard.stopImmediatePropagation).not.toHaveBeenCalled();
  const modal = gate.open();
  root.fire("click", { ...pointer(4, root, "click"), detail: 0 });
  expect(observeClick).toHaveBeenCalledOnce();
  modal.close();
  stop();
  root.fire("click", { ...pointer(5, root, "click"), detail: 0 });
  expect(observeClick).toHaveBeenCalledOnce();
});

it("admits revealed and painted views, makes covered dialogs inert and restores them", async () => {
  const doc = new FakeDocument();
  let paint: (() => void) | undefined;
  Object.assign(doc.defaultView, {
    cancelAnimationFrame: vi.fn(),
    requestAnimationFrame: (callback: () => void) => {
      paint = callback;
      return 1;
    },
  });
  const gate = createModalInputGate();
  const press = createPressAdmission(() => false);
  const root = doc.createElement("div");
  const reveal = { cancel: vi.fn(), revealed: Promise.resolve(true) };
  const view = mountModalLifecycle(
    {
      ...fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 })).layer,
      input: gate,
      press,
      scale: () => ({ dpr: 1, origin: { x: 0, y: 0 }, unit: 1 }),
    },
    { modal: true, reveal },
    root as unknown as HTMLElement,
  );
  expect(view.accepts()).toBe(false);
  expect(gate.accepts()).toBe(false);
  expect(view.ownsKeyboard()).toBe(true);
  await reveal.revealed;
  expect(view.accepts()).toBe(false);
  paint?.();
  expect(view.accepts()).toBe(true);
  const held = pointer(1, root);
  root.fire("pointerdown", held);
  expect(press.canvasAllowed()).toBe(false);
  const overlay = gate.open();
  expect(view.ownsKeyboard()).toBe(false);
  expect(press.canvasAllowed()).toBe(true);
  expect(root.inert).toBe(true);
  expect(root.getAttribute("aria-hidden")).toBe("true");
  overlay.close();
  expect(root.inert).toBe(false);
  expect(view.accepts()).toBe(true);
  expect(root.getAttribute("aria-hidden")).toBeNull();
  view.setEnabled(false);
  expect(view.accepts()).toBe(false);
  expect(view.ownsKeyboard()).toBe(true);
  view.setEnabled(true);
  expect(view.accepts()).toBe(true);
  view.setShown(false);
  expect(root.hidden).toBe(true);
  expect(gate.accepts()).toBe(true);
  view.destroy();
  expect(reveal.cancel).toHaveBeenCalledOnce();
});

it("rejects native pointer admission while the shared game press is already held", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const gate = createModalInputGate();
  const down = vi.fn();
  const stop = guardNativeInput(
    { claim: () => undefined, down, gate, subscribe: gate.subscribe },
    root as unknown as HTMLElement,
  );
  const event = pointer(1, root);
  root.fire("pointerdown", event);
  expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(down).not.toHaveBeenCalled();
  doc.fire("pointerup", pointer(1, root, "pointerup"));
  const click = { detail: 1, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
  root.fire("click", click);
  expect(click.stopImmediatePropagation).toHaveBeenCalledOnce();
  stop();
});

it("consumes a handled native swipe click while preserving keyboard activation and a fresh press", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const gate = createModalInputGate();
  let handled = true;
  const stop = guardNativeInput(
    { gate, subscribe: gate.subscribe, up: () => handled },
    root as unknown as HTMLElement,
  );
  root.fire("pointerdown", pointer(1, root));
  doc.fire("pointerup", pointer(1, root, "pointerup"));
  const click = { detail: 1, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
  root.fire("click", click);
  expect(click.stopImmediatePropagation).toHaveBeenCalledOnce();
  const key = { detail: 0, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
  root.fire("click", key);
  expect(key.stopImmediatePropagation).not.toHaveBeenCalled();
  handled = false;
  root.fire("pointerdown", pointer(2, root));
  doc.fire("pointerup", pointer(2, root, "pointerup"));
  const next = { detail: 1, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
  root.fire("click", next);
  expect(next.stopImmediatePropagation).not.toHaveBeenCalled();
  stop();
});

it("releases an unfinished modal contact on window blur and accepts one fresh action after return", async () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const button = doc.createElement("button");
  root.append(button);
  const gate = createModalInputGate();
  const press = createPressAdmission(() => false);
  const cancel = vi.fn();
  const action = vi.fn();
  button.addEventListener("click", action);
  const reveal = { cancel: vi.fn(), revealed: Promise.resolve(true) };
  const view = mountModalLifecycle(
    {
      ...fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 })).layer,
      input: gate,
      press,
      scale: () => ({ dpr: 1, origin: { x: 0, y: 0 }, unit: 1 }),
    },
    { gesture: { cancel }, modal: true, reveal },
    root as unknown as HTMLElement,
  );
  await reveal.revealed;
  root.fire("pointerdown", pointer(11, button));
  button.setAttribute("data-ui-pressed", "");
  expect(press.canvasAllowed()).toBe(false);
  doc.defaultView.fire("blur");
  expect(press.canvasAllowed()).toBe(true);
  expect(button.getAttribute("data-ui-pressed")).toBeNull();
  expect(cancel).toHaveBeenCalledOnce();
  expect(view.accepts()).toBe(true);

  doc.defaultView.fire("focus");
  root.fire("pointerdown", pointer(12, button));
  doc.fire("pointerup", pointer(11, button, "pointerup"));
  const stale = pointer(11, button, "click");
  root.fire("click", stale);
  expect(stale.stopImmediatePropagation).toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();

  doc.fire("pointerup", pointer(12, button, "pointerup"));
  const fresh = pointer(12, button, "click");
  root.fire("click", fresh);
  expect(fresh.stopImmediatePropagation).not.toHaveBeenCalled();
  button.fire("click", fresh);
  expect(action).toHaveBeenCalledOnce();
  expect(press.canvasAllowed()).toBe(true);
  root.fire("pointerdown", pointer(13, button));
  button.setAttribute("data-ui-pressed", "");
  const nested = gate.open();
  expect(button.getAttribute("data-ui-pressed")).toBeNull();
  expect(view.accepts()).toBe(false);
  nested.close();
  expect(view.accepts()).toBe(true);
  view.destroy();
  expect(doc.defaultView.listeners.get("blur") ?? []).toHaveLength(0);
});

it("drops a completed contact's delayed click on hiding and accepts fresh mouse and keyboard actions", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const button = doc.createElement("button");
  root.append(button);
  const gate = createModalInputGate();
  const up = vi.fn();
  const action = vi.fn();
  button.addEventListener("click", action);
  let disposeOnCancel = false;
  const stop = guardNativeInput(
    {
      cancel: () => {
        if (disposeOnCancel) {
          stop();
        }
      },
      gate,
      subscribe: gate.subscribe,
      up,
    },
    root as unknown as HTMLElement,
  );
  root.fire("pointerdown", pointer(21, button));
  doc.fire("pointerup", pointer(21, button, "pointerup"));
  Object.assign(doc, { hidden: true });
  doc.fire("visibilitychange");
  const late = pointer(21, button, "click");
  root.fire("click", late);
  expect(late.stopImmediatePropagation).toHaveBeenCalled();
  const hiddenKey = { ...pointer(21, button, "click"), detail: 0 };
  root.fire("click", hiddenKey);
  expect(hiddenKey.stopImmediatePropagation).toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();

  Object.assign(doc, { hidden: false });
  doc.fire("visibilitychange");
  doc.defaultView.fire("focus");
  root.fire("pointerdown", pointer(22, button));
  doc.fire("pointerup", pointer(22, button, "pointerup"));
  const mouse = pointer(22, button, "click");
  root.fire("click", mouse);
  expect(mouse.stopImmediatePropagation).not.toHaveBeenCalled();
  button.fire("click", mouse);
  const key = { ...pointer(22, button, "click"), detail: 0 };
  root.fire("click", key);
  expect(key.stopImmediatePropagation).not.toHaveBeenCalled();
  button.fire("click", key);
  expect(action).toHaveBeenCalledTimes(2);
  expect(up).toHaveBeenCalledTimes(2);
  disposeOnCancel = true;
  root.fire("pointerdown", pointer(23, button));
  doc.defaultView.fire("blur");
  expect(root.listeners.get("pointerdown") ?? []).toHaveLength(0);
  expect(doc.listeners.get("pointerup") ?? []).toHaveLength(0);
  stop();
  expect(doc.listeners.get("visibilitychange") ?? []).toHaveLength(0);
  expect(doc.defaultView.listeners.get("blur") ?? []).toHaveLength(0);
});

describe("a modal view's host", () => {
  const mount = async (doc: FakeDocument, backgroundCancel?: () => void) => {
    const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
    const view = doc.createElement("div");
    const companion = doc.createElement("div");
    const reveal = { cancel: vi.fn(), revealed: Promise.resolve(true) };
    const lifecycle = mountModalLifecycle(
      layer,
      {
        ...(backgroundCancel === undefined ? {} : { backgroundCancel }),
        companions: [companion as unknown as HTMLElement],
        modal: true,
        reveal,
      },
      view as unknown as HTMLElement,
    );
    await reveal.revealed;
    const [backdrop, scope] = element.children.at(-1)!.children;
    return { backdrop: backdrop!, companion, element, lifecycle, scope: scope!, view };
  };

  it.each([
    ["calls a closeable modal's background cancel once", true],
    ["consumes the tap for a required choice", false],
  ] as const)("on a backdrop tap, %s", async (_name, closeable) => {
    const doc = new FakeDocument();
    const backgroundCancel = vi.fn();
    const { backdrop, companion, element, lifecycle, scope, view } = await mount(
      doc,
      closeable ? backgroundCancel : undefined,
    );
    expect(lifecycle.accepts()).toBe(true);
    expect(scope.children).toEqual([view, companion]);
    expect(backdrop.style.position).toBe("fixed");
    expect(backdrop.style.inset).toBe("0");
    backdrop.fire("pointerdown", pointer(1, backdrop));
    doc.fire("pointerup", pointer(1, backdrop, "pointerup"));
    backdrop.fire("click", pointer(1, backdrop, "click"));
    expect(backgroundCancel).toHaveBeenCalledTimes(closeable ? 1 : 0);
    lifecycle.destroy();
    expect(element.children).toEqual([companion]);
  });

  it("hands keys the dialog's controls leave unhandled to the window's scene listeners", async () => {
    const doc = new FakeDocument();
    Object.assign(doc.defaultView, {
      KeyboardEvent: class {
        defaultPrevented = false;
        readonly key: string;
        readonly type: string;
        constructor(type: string, init: { key: string }) {
          this.key = init.key;
          this.type = type;
        }
        preventDefault() {
          this.defaultPrevented = true;
        }
      },
      dispatchEvent: (event: { type: string }) => {
        doc.defaultView.fire(event.type, event);
        return true;
      },
    });
    const heard = vi.fn((event: { key?: string; preventDefault?: () => void }) =>
      event.preventDefault?.(),
    );
    doc.defaultView.addEventListener("keydown", heard);
    const { lifecycle, scope } = await mount(doc);
    const key = (name: string, cancelBubble = false) => ({
      cancelBubble,
      key: name,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      type: "keydown",
    });
    const escape = key("Escape");
    scope.fire("keydown", escape);
    expect(heard).toHaveBeenCalledOnce();
    expect(heard.mock.calls[0]![0].key).toBe("Escape");
    expect(escape.stopPropagation).toHaveBeenCalledOnce();
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    for (const extra of [
      { defaultPrevented: true },
      { isComposing: true },
      { keyCode: 229 },
      { ctrlKey: true },
      { target: { tagName: "TEXTAREA" } },
      { code: "Enter", target: { tagName: "BUTTON" } },
    ]) {
      scope.fire("keydown", Object.assign(key("Enter"), extra));
    }
    scope.fire("keydown", key("Enter", true));
    scope.fire("keydown", key("1"));
    expect(heard).toHaveBeenCalledOnce();
    lifecycle.destroy();
    scope.fire("keydown", key("Escape"));
    expect(heard).toHaveBeenCalledOnce();
  });
});

it("leaves secondary contacts for the guarded context-menu action without disturbing primary gestures", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  const gate = createModalInputGate();
  const down = vi.fn();
  const up = vi.fn();
  const stop = guardNativeInput(
    { down, gate, subscribe: gate.subscribe, up },
    root as unknown as HTMLElement,
  );
  const secondary = { ...pointer(2, root), button: 2 };
  root.fire("pointerdown", secondary);
  const release = { ...pointer(2, root, "pointerup"), button: 2 };
  doc.fire("pointerup", release);
  expect(down).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();
  expect(release.preventDefault).not.toHaveBeenCalled();
  freshDown(doc, root);
  doc.fire("pointerup", pointer(1, root, "pointerup"));
  expect(down).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledOnce();
  stop();
});
