import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { expect, it, vi } from "vitest";

import { createPressAdmission } from "../../pressAdmission.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
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
    { input: gate, press, scale: () => ({ dpr: 1, origin: { x: 0, y: 0 }, unit: 1 }) },
    { modal: true, reveal },
    root as unknown as HTMLElement,
  );
  expect(view.accepts()).toBe(false);
  expect(gate.accepts()).toBe(false);
  await reveal.revealed;
  expect(view.accepts()).toBe(false);
  paint?.();
  expect(view.accepts()).toBe(true);
  const held = pointer(1, root);
  root.fire("pointerdown", held);
  expect(press.canvasAllowed()).toBe(false);
  const overlay = gate.open();
  expect(press.canvasAllowed()).toBe(true);
  expect(root.inert).toBe(true);
  expect(root.getAttribute("aria-hidden")).toBe("true");
  overlay.close();
  expect(root.inert).toBe(false);
  expect(view.accepts()).toBe(true);
  expect(root.getAttribute("aria-hidden")).toBeNull();
  view.setEnabled(false);
  expect(view.accepts()).toBe(false);
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
    { input: gate, press, scale: () => ({ dpr: 1, origin: { x: 0, y: 0 }, unit: 1 }) },
    { gesture: { cancel }, modal: true, reveal },
    root as unknown as HTMLElement,
  );
  await reveal.revealed;
  root.fire("pointerdown", pointer(11, button));
  button.setAttribute("data-pressed", "");
  expect(press.canvasAllowed()).toBe(false);
  doc.defaultView.fire("blur");
  expect(press.canvasAllowed()).toBe(true);
  expect(button.getAttribute("data-pressed")).toBeNull();
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
  const nested = gate.open();
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
