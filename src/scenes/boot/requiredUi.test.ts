import { createProgressState } from "@andornaut/game-kit/runtime/progressState";
import { expect, it, vi } from "vitest";

import { pauseLoadingError } from "./loadingErrorPause.ts";
import { createRequiredUi } from "./requiredUi.ts";

function fixture(
  font: "failed" | "loading" | "ready",
  asset: typeof font,
  game?: Parameters<typeof pauseLoadingError>[0],
) {
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
  let retry!: () => Promise<void>;
  const progress = createProgressState();
  const waiting = createRequiredUi({ layer: resources, progress }, (run) => {
    retry = run;
    return game === undefined ? view : pauseLoadingError(game, view);
  });
  return {
    listeners,
    notify,
    progress,
    resources,
    retry: () => retry(),
    state,
    view,
    waiting,
  };
}

it.each(["asset", "font"] as const)(
  "blocks on required %s failure and retries only failed resources",
  (kind) => {
    const f = fixture(kind === "font" ? "failed" : "ready", kind === "asset" ? "failed" : "ready");
    const ready = vi.fn();
    f.waiting.wait(ready);
    expect(f.view.show).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "failed" }));
    expect(ready).not.toHaveBeenCalled();
    f.retry();
    expect(f.resources.retryFonts).toHaveBeenCalledTimes(kind === "font" ? 1 : 0);
    expect(f.resources.retryAssets).toHaveBeenCalledTimes(kind === "asset" ? 1 : 0);
    expect(f.view.show).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "loading" }));
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

it.each([false, true])(
  "holds late failure and retry without advancing a previously paused=%s walk",
  (paused) => {
    const run = { elapsed: 100, money: 250 };
    const game = {
      isPaused: paused,
      pause: vi.fn(() => {
        game.isPaused = true;
      }),
      resume: vi.fn(() => {
        game.isPaused = false;
      }),
    };
    const tick = () => {
      if (!game.isPaused) {
        run.elapsed++;
        run.money--;
      }
    };
    const f = fixture("ready", "ready", game);
    // Ordinary loading before any failure does not interrupt play.
    f.state.asset = "loading";
    f.notify();
    expect(game.isPaused).toBe(paused);
    f.state.asset = "failed";
    f.notify();
    expect(game.isPaused).toBe(true);
    tick();
    f.retry();
    tick();
    expect(run).toEqual({ elapsed: 100, money: 250 });
    f.state.asset = "ready";
    f.notify();
    expect(game.isPaused).toBe(paused);
    expect(game.resume).toHaveBeenCalledTimes(paused ? 0 : 1);
    f.state.asset = "failed";
    f.notify();
    f.waiting.dispose();
    expect(game.isPaused).toBe(true);
    expect(game.resume).toHaveBeenCalledTimes(paused ? 0 : 1);
  },
);
