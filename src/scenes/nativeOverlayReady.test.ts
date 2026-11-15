import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { beforeEach, expect, it, vi } from "vitest";

import { mountNativeOverlay } from "./nativeOverlayReady.ts";

const fake = vi.hoisted(() => ({
  layer: { onReady: vi.fn(), ready: vi.fn() },
  stopInput: vi.fn(),
  track: vi.fn(),
}));
vi.mock("../ui/dom/uiLayer.ts", () => ({ uiLayer: () => fake.layer }));
vi.mock("./overlay.ts", () => ({
  trackNativeSceneInput: (...args: unknown[]) => fake.track(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  fake.track.mockReturnValue(fake.stopInput);
});

it("waits for the shared readiness signal, mounts once and releases its pending input ownership", () => {
  const events = new EventEmitter();
  const scene = { events } as unknown as Scene;
  let changed = () => {};
  const unsubscribe = vi.fn();
  fake.layer.ready.mockReturnValue(false);
  fake.layer.onReady.mockImplementation((listener: () => void) => {
    changed = listener;
    return unsubscribe;
  });
  const mount = vi.fn(() => true);
  mountNativeOverlay(scene, mount);
  const pending = fake.track.mock.calls[0]?.[1] as { accepts(): boolean; capture(): () => boolean };
  expect(pending.accepts()).toBe(false);
  expect(pending.capture()()).toBe(false);
  expect(mount).not.toHaveBeenCalled();
  fake.layer.ready.mockReturnValue(true);
  changed();
  changed();
  expect(mount).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(fake.stopInput).toHaveBeenCalledOnce();
});

it("disposes a pending mount on scene shutdown and ignores a late readiness callback", () => {
  const events = new EventEmitter();
  let changed = () => {};
  const unsubscribe = vi.fn();
  fake.layer.ready.mockReturnValue(true);
  fake.layer.onReady.mockImplementation((listener: () => void) => {
    changed = listener;
    return unsubscribe;
  });
  const mount = vi.fn(() => false);
  mountNativeOverlay({ events } as unknown as Scene, mount);
  expect(mount).toHaveBeenCalledOnce();
  events.emit("shutdown");
  changed();
  expect(mount).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(fake.stopInput).toHaveBeenCalledOnce();
});
