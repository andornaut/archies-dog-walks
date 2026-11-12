import { watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import type { ProgressSnapshot } from "@andornaut/game-kit/progressState";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { fakeLoaderScene } from "./fakeLoader.ts";
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
    const { add, complete, file, loader, scene, settle } = fakeLoaderScene();
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
    const { add, file, scene } = fakeLoaderScene();
    const { watch: loads } = watch(scene);
    const queued = file("a", "/a.png");
    add(queued);
    expect(queued.xhrSettings.timeout).toBe(30_000);
    loads.dispose();
  });

  it("shows no bar for a load nobody waits for", () => {
    const { add, complete, file, loader, scene, settle } = fakeLoaderScene();
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
});
