import { EventEmitter } from "node:events";

import { RETRY_ROUNDS_MS } from "@andornaut/game-kit/load/loaderConfig";
import { watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import type { ProgressSnapshot } from "@andornaut/game-kit/progressState";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { loadingProgress, waitedLoad } from "./loadingProgress.ts";

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

interface FakeFile {
  key: string;
  retryAttempts: number;
  type: string;
  url: string;
  xhrSettings: { timeout: number };
}

// A scene's loader as watchLoader drives it: Phaser's loader events, its queue and its counters.
function fakeScene() {
  const file = (key: string, url: string): FakeFile => ({
    key,
    retryAttempts: 0,
    type: "image",
    url,
    xhrSettings: { timeout: 0 },
  });
  const add = (queued: FakeFile) => {
    loader.list.add(queued);
    loader.emit("addfile", queued.key, queued.type, loader, queued);
  };
  const loader = Object.assign(new EventEmitter(), {
    image: vi.fn((key: string, url: string) => add(file(key, url))),
    isLoading: () => loader.loading,
    list: new Set<FakeFile>(),
    loading: false,
    maxRetries: 2,
    path: "",
    prefix: "",
    start: vi.fn(() => {
      loader.loading = true;
      loader.emit("start", loader);
    }),
    totalComplete: 0,
    totalFailed: 0,
    totalToLoad: 0,
    xhr: { timeout: 30_000 },
  });
  const settle = (queued: FakeFile, ok: boolean) => {
    loader.list.delete(queued);
    loader.emit(ok ? "load" : "loaderror", queued);
  };
  const complete = () => {
    loader.loading = false;
    loader.emit("complete", loader, 0, 0);
  };
  const scene = { events: new EventEmitter(), load: loader } as unknown as Scene;
  return { add, complete, file, loader, scene, settle };
}

function shown(): ProgressSnapshot {
  let snapshot: ProgressSnapshot = { active: false, value: undefined };
  loadingProgress.subscribe((next) => {
    snapshot = next;
  })();
  return snapshot;
}

function watch(scene: Scene) {
  const timer = { clearTimeout: vi.fn(), setTimeout: vi.fn(() => 1) };
  const warn = vi.fn();
  return {
    timer,
    warn,
    watch: watchLoader({ console: { warn }, progress: waitedLoad, timer }, scene),
  };
}

describe("the loading bar's loads", () => {
  it("shows a load the player waits for, by settled files, never moving back", () => {
    const { add, complete, file, loader, scene, settle } = fakeScene();
    const { watch: loads } = watch(scene);
    const [a, b, c, d] = ["a", "b", "c", "d"].map((key) => file(key, `/${key}.png`));
    add(a!);
    add(b!);
    loads.waitFor("boot");
    loader.start();
    expect(shown()).toEqual({ active: true, value: 0 });
    settle(a!, true);
    expect(shown().value).toBe(0.5);
    // Two more files join the run: the share keeps what it showed and fills the rest.
    add(c!);
    add(d!);
    expect(shown().value).toBe(0.5);
    settle(b!, true);
    const after = shown().value ?? 0;
    expect(after).toBeGreaterThan(0.5);
    settle(c!, false);
    expect(shown().value ?? 0).toBeGreaterThanOrEqual(after);
    settle(d!, true);
    expect(shown().value).toBe(1);
    complete();
    loads.dispose();
  });

  it("gives every queued file the loader's timeout", () => {
    const { add, file, scene } = fakeScene();
    const { watch: loads } = watch(scene);
    const queued = file("a", "/a.png");
    add(queued);
    expect(queued.xhrSettings.timeout).toBe(30_000);
    loads.dispose();
  });

  it("shows no bar for a load nobody waits for", () => {
    const { add, complete, file, loader, scene, settle } = fakeScene();
    const { watch: loads } = watch(scene);
    const queued = file("a", "/a.png");
    add(queued);
    loader.start();
    expect(shown().active).toBe(false);
    settle(queued, true);
    complete();
    expect(shown().active).toBe(false);
    loads.dispose();
  });

  it("logs a failed file and queues it again on the timer after the run", () => {
    const { add, complete, file, loader, scene, settle } = fakeScene();
    const { timer, warn, watch: loads } = watch(scene);
    const queued = file("art", "/assets/art.png");
    add(queued);
    loader.start();
    settle(queued, false);
    complete();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Loading /assets/art.png failed after 3 attempts; retrying later",
    );
    expect(loads.failures()).toEqual([
      expect.objectContaining({ key: "art", rounds: 0, url: "/assets/art.png" }),
    ]);
    expect(timer.setTimeout).toHaveBeenCalledExactlyOnceWith(
      expect.any(Function),
      RETRY_ROUNDS_MS[0],
    );
    const [[round]] = timer.setTimeout.mock.calls as unknown as [[() => void]];
    round();
    expect(loader.image).toHaveBeenCalledExactlyOnceWith("art", "/assets/art.png");
    expect(loader.start).toHaveBeenCalledTimes(2);
    expect(loads.failures()).toEqual([]);
    loads.dispose();
  });
});
