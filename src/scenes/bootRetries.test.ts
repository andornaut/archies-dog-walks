import { RETRY_ROUNDS_MS } from "@andornaut/game-kit/load/loaderConfig";
import { watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import { createProgressState } from "@andornaut/game-kit/progressState";
import { describe, expect, it, vi } from "vitest";

import { stopOnceRetried } from "./bootRetries.ts";
import { fakeLoaderScene } from "./fakeLoader.ts";

// The loader and scene events watchLoader listens for, as Phaser names them.
vi.mock("phaser", () => ({
  Loader: {
    Events: {
      ADD: "addfile",
      COMPLETE: "complete",
      FILE_LOAD: "load",
      FILE_LOAD_ERROR: "loaderror",
      START: "start",
    },
  },
  Scenes: { Events: { DESTROY: "destroy", SHUTDOWN: "shutdown" } },
}));

// Boot's watch over a load whose one file fails its first run, with a fake timer for the rounds.
function failedOnce() {
  const fake = fakeLoaderScene();
  const rounds: { ms: number; run: () => void }[] = [];
  const timer = {
    clearTimeout: () => undefined,
    setTimeout: (run: () => void, ms: number) => rounds.push({ ms, run }),
  };
  const warn = vi.fn();
  const watch = watchLoader(
    { console: { warn }, progress: createProgressState(), timer },
    fake.scene,
  );
  const image = vi.spyOn(fake.loader, "image");
  const first = fake.file("art", "/assets/art.webp");
  fake.add(first);
  fake.loader.start();
  fake.settle(first, false);
  fake.complete();
  const done = { recovered: vi.fn(), stop: vi.fn() };
  stopOnceRetried(fake.loader, watch, done);
  // Runs the next round and settles the file it queued again.
  const retry = (ok: boolean) => {
    rounds.at(-1)?.run();
    const queued = [...fake.loader.list].at(-1);
    if (queued !== undefined) {
      fake.settle(queued, ok);
    }
    fake.complete();
  };
  return { done, image, retry, rounds, warn };
}

describe("BootScene once its loads are done", () => {
  it("stops at once when no file failed", () => {
    const fake = fakeLoaderScene();
    const watch = watchLoader(
      { console: { warn: vi.fn() }, progress: createProgressState(), timer: globalThis },
      fake.scene,
    );
    const done = { recovered: vi.fn(), stop: vi.fn() };
    stopOnceRetried(fake.loader, watch, done);
    expect(done.stop).toHaveBeenCalledOnce();
  });

  it("keeps running for a failed file, queues it again and stops once it loads", () => {
    const { done, image, retry, rounds } = failedOnce();
    expect(done.stop).not.toHaveBeenCalled();
    expect(rounds.map(({ ms }) => ms)).toEqual([RETRY_ROUNDS_MS[0]]);
    retry(true);
    expect(image).toHaveBeenCalledExactlyOnceWith("art", "/assets/art.webp");
    expect(done.recovered).toHaveBeenCalledOnce();
    expect(done.stop).toHaveBeenCalledOnce();
  });

  it("stops after the last round gives up, leaving the file for the next launch", () => {
    const { done, retry, rounds, warn } = failedOnce();
    RETRY_ROUNDS_MS.forEach(() => {
      expect(done.stop).not.toHaveBeenCalled();
      retry(false);
    });
    expect(rounds.map(({ ms }) => ms)).toEqual([...RETRY_ROUNDS_MS]);
    expect(warn).toHaveBeenLastCalledWith(
      `Loading /assets/art.webp failed after 3 attempts in retry round ${RETRY_ROUNDS_MS.length}; giving up`,
    );
    expect(done.stop).toHaveBeenCalledOnce();
  });
});
