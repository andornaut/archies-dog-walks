import { createModalInputGate } from "@andornaut/game-kit/input/modalInput";
import { expect, it, vi } from "vitest";

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
  const root = doc.createElement("div");
  const reveal = { cancel: vi.fn(), revealed: Promise.resolve(true) };
  const view = mountModalLifecycle(
    { input: gate },
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
  const overlay = gate.open();
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
  stop();
});
