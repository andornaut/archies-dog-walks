import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { FPS_COUNTER_INTERVAL_MS, type FpsCounterSettings, mountFpsCounter } from "./fpsCounter.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// The device settings' FPS counter switch, telling each listener of a change.
function settingsOf(fpsCounter: boolean) {
  const listeners = new Set<() => void>();
  let on = fpsCounter;
  const settings: FpsCounterSettings & { set(next: boolean): void } = {
    get current() {
      return { fpsCounter: on };
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      on = next;
      listeners.forEach((listener) => listener());
    },
  };
  return settings;
}

function mounted(fpsCounter: boolean) {
  const doc = new FakeDocument();
  const settings = settingsOf(fpsCounter);
  let fps = 59.6;
  const dispose = mountFpsCounter(
    { rate: () => fps, settings },
    doc.body as unknown as HTMLElement,
  );
  return {
    dispose,
    doc,
    setRate: (rate: number) => {
      fps = rate;
    },
    settings,
    view: doc.body.children[0]!,
  };
}

it("stays hidden with no timer while the setting is off", () => {
  const { view } = mounted(false);
  expect(view.className).toBe("adw-fps-counter");
  expect(view.hidden).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("shows the rate as a whole number while on, refreshed on its interval", () => {
  const { setRate, view } = mounted(true);
  expect(view.hidden).toBe(false);
  expect(view.textContent).toBe("60 FPS");
  setRate(30.2);
  vi.advanceTimersByTime(FPS_COUNTER_INTERVAL_MS);
  expect(view.textContent).toBe("30 FPS");
});

it("applies a change to the setting at once", () => {
  const { settings, view } = mounted(false);
  settings.set(true);
  expect(view.hidden).toBe(false);
  expect(view.textContent).toBe("60 FPS");
  settings.set(false);
  expect(view.hidden).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("removes the counter, its timer and its listener on dispose", () => {
  const { dispose, doc, settings } = mounted(true);
  dispose();
  expect(doc.body.children).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  settings.set(false);
  settings.set(true);
  expect(vi.getTimerCount()).toBe(0);
});
