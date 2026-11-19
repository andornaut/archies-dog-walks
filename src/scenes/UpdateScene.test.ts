import type { Game } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SCENE_KEYS, TAP_BURST_SCENE_KEY } from "./sceneKeys.ts";

const state = vi.hoisted(() => ({ booted: false, offered: false }));

vi.mock("phaser", () => ({
  Core: { Events: { POST_STEP: "poststep" } },
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
vi.mock("../pwa/index.ts", async (original) => ({
  ...(await original<typeof import("../pwa/index.ts")>()),
  updateOffered: () => state.offered,
}));
vi.mock("../pwa/launch.ts", async (original) => ({
  ...(await original<typeof import("../pwa/launch.ts")>()),
  bootFinished: () => state.booted,
}));

const { holdPlay, watchUpdateOffer } = await import("./UpdateScene.ts");

// A scene manager with the given scenes running, and the walk's hold if a walk is one of them.
function fakeGame(running: readonly string[]) {
  const paused = new Set<string>();
  const releaseWalk = vi.fn();
  const holdForUpdate = vi.fn(() => ({ opened: true, release: releaseWalk }));
  const steps: (() => void)[] = [];
  const scene = {
    getScene: () => ({ holdForUpdate }),
    getScenes: () =>
      running.filter((key) => !paused.has(key)).map((key) => ({ sys: { settings: { key } } })),
    isActive: (key: string) => running.includes(key) && !paused.has(key),
    isPaused: (key: string) => paused.has(key),
    pause: vi.fn((key: string) => paused.add(key)),
    resume: vi.fn((key: string) => paused.delete(key)),
    run: vi.fn(),
  };
  const game = {
    events: { on: (_event: string, step: () => void) => steps.push(step) },
    scene,
  } as unknown as Game;
  return { game, holdForUpdate, paused, releaseWalk, scene, step: () => steps.forEach((s) => s()) };
}

describe("holdPlay", () => {
  it.each([
    {
      held: [SCENE_KEYS.start],
      name: "the home screen",
      running: [SCENE_KEYS.boot, SCENE_KEYS.start, TAP_BURST_SCENE_KEY],
      walk: false,
    },
    {
      held: [SCENE_KEYS.hud, SCENE_KEYS.pause],
      name: "a walk",
      running: [SCENE_KEYS.run, SCENE_KEYS.hud, SCENE_KEYS.pause, TAP_BURST_SCENE_KEY],
      walk: true,
    },
  ])("holds $name still and lets it go again", ({ held, running, walk }) => {
    const f = fakeGame(running);
    const hold = holdPlay(f.game);
    expect([...f.paused]).toEqual(held);
    expect(f.holdForUpdate).toHaveBeenCalledTimes(walk ? 1 : 0);
    expect(hold.pauseOpening).toBe(walk);
    hold.release();
    expect(f.paused.size).toBe(0);
    expect(f.releaseWalk).toHaveBeenCalledTimes(walk ? 1 : 0);
  });
});

describe("watchUpdateOffer", () => {
  beforeEach(() => {
    state.booted = false;
    state.offered = false;
  });

  it("opens once per offer, never over the loading screen", () => {
    const f = fakeGame([SCENE_KEYS.start]);
    watchUpdateOffer(f.game);
    state.offered = true;
    f.step();
    expect(f.scene.run).not.toHaveBeenCalled();
    state.booted = true;
    f.step();
    f.step();
    expect(f.scene.run).toHaveBeenCalledExactlyOnceWith(SCENE_KEYS.update);
    state.offered = false;
    f.step();
    state.offered = true;
    f.step();
    expect(f.scene.run).toHaveBeenCalledTimes(2);
  });
});
