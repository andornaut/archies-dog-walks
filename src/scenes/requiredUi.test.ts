import { createProgressState } from "@andornaut/game-kit/progressState";
import { expect, it, vi } from "vitest";

import { createRequiredUi } from "./requiredUi.ts";

function fixture(font: "failed" | "loading" | "ready", asset: typeof font) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const state = { asset, font };
  const resources = {
    assetStatus: () => state.asset,
    fontStatus: () => state.font,
    onReady(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retryAssets: vi.fn(() => {
      state.asset = "loading";
      notify();
    }),
    retryFonts: vi.fn(() => {
      state.font = "loading";
      notify();
    }),
  };
  const view = { dispose: vi.fn(), hide: vi.fn(), show: vi.fn() };
  let retry!: () => void;
  const progress = createProgressState();
  const waiting = createRequiredUi({ layer: resources, progress }, (run) => {
    retry = run;
    return view;
  });
  return { listeners, notify, progress, resources, retry: () => retry(), state, view, waiting };
}

it.each(["asset", "font"] as const)(
  "blocks on required %s failure and retries only failed resources",
  (kind) => {
    const f = fixture(kind === "font" ? "failed" : "ready", kind === "asset" ? "failed" : "ready");
    const ready = vi.fn();
    f.waiting.wait(ready);
    expect(f.view.show).toHaveBeenLastCalledWith(false);
    expect(ready).not.toHaveBeenCalled();
    f.retry();
    expect(f.resources.retryFonts).toHaveBeenCalledTimes(kind === "font" ? 1 : 0);
    expect(f.resources.retryAssets).toHaveBeenCalledTimes(kind === "asset" ? 1 : 0);
    expect(f.view.show).toHaveBeenLastCalledWith(true);
    let active = false;
    const stopProgress = f.progress.subscribe((snapshot) => {
      active = snapshot.active;
    });
    expect(active).toBe(true);
    f.retry();
    expect(
      f.resources.retryAssets.mock.calls.length + f.resources.retryFonts.mock.calls.length,
    ).toBe(1);
    f.state[kind] = "ready";
    f.notify();
    f.notify();
    expect(f.view.hide).toHaveBeenCalled();
    expect(ready).toHaveBeenCalledOnce();
    expect(active).toBe(false);
    stopProgress();
  },
);

it("keeps a failed retry explicit without admitting native UI, then recovers", () => {
  const f = fixture("ready", "failed");
  const ready = vi.fn();
  f.waiting.wait(ready);
  f.retry();
  f.state.asset = "failed";
  f.notify();
  expect(f.view.show).toHaveBeenLastCalledWith(false);
  expect(ready).not.toHaveBeenCalled();
  f.retry();
  f.state.asset = "ready";
  f.notify();
  expect(f.resources.retryAssets).toHaveBeenCalledTimes(2);
  expect(ready).toHaveBeenCalledOnce();
});

it("rechecks readiness between startup phases and drops all late work after disposal", () => {
  const f = fixture("ready", "loading");
  const second = vi.fn();
  f.waiting.wait(() => {
    f.state.asset = "loading";
  });
  f.waiting.wait(second);
  f.state.asset = "ready";
  f.notify();
  expect(second).not.toHaveBeenCalled();
  f.waiting.dispose();
  f.waiting.dispose();
  expect(f.listeners.size).toBe(0);
  f.state.asset = "ready";
  f.notify();
  expect(second).not.toHaveBeenCalled();
});

it("keeps observing required view failures after the initial startup wait completed", () => {
  const f = fixture("ready", "ready");
  const ready = vi.fn();
  f.waiting.wait(ready);
  expect(ready).toHaveBeenCalledOnce();
  f.state.asset = "failed";
  f.notify();
  expect(f.view.show).toHaveBeenLastCalledWith(false);
  f.retry();
  f.state.asset = "ready";
  f.notify();
  expect(f.view.hide).toHaveBeenCalled();
  expect(ready).toHaveBeenCalledOnce();
});

it("holds bootstrap font metrics without retrying successful native fonts or images", () => {
  const f = fixture("ready", "ready");
  let metrics: "failed" | "loading" | "ready" = "loading";
  const retry = vi.fn(() => {
    metrics = "loading";
  });
  const stop = f.waiting.observe({ retry, status: () => metrics });
  const ready = vi.fn();
  f.waiting.wait(ready);
  expect(ready).not.toHaveBeenCalled();
  metrics = "failed";
  f.waiting.invalidate();
  f.retry();
  expect(retry).toHaveBeenCalledOnce();
  expect(f.resources.retryFonts).not.toHaveBeenCalled();
  expect(f.resources.retryAssets).not.toHaveBeenCalled();
  metrics = "ready";
  f.waiting.invalidate();
  expect(ready).toHaveBeenCalledOnce();
  stop();
  stop();
  f.waiting.dispose();
});
