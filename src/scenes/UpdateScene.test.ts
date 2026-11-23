import { EventEmitter } from "node:events";

import type { Game } from "phaser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PHONE_EVENTS } from "../pwa/events.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import type { CardEntry } from "./questionPanel.ts";
import { SCENE_KEYS, TAP_BURST_SCENE_KEY } from "./sceneKeys.ts";

const state = vi.hoisted(() => ({ accepting: false, booted: false, offered: false }));
const native = vi.hoisted(() => ({
  destroy: vi.fn(),
  entries: [] as readonly CardEntry[],
  mount: vi.fn(),
  reload: vi.fn(),
}));

vi.mock("phaser", () => ({
  Core: { Events: { POST_RENDER: "postrender", POST_STEP: "poststep" } },
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
vi.mock("../pwa/index.ts", async (original) => ({
  ...(await original<typeof import("../pwa/index.ts")>()),
  acceptUpdate: vi.fn((save: () => Promise<void>) => {
    void save();
    state.accepting = true;
    window.dispatchEvent(new Event(PHONE_EVENTS.updateReady));
  }),
  dismissUpdate: vi.fn(() => {
    state.offered = false;
    window.dispatchEvent(new Event(PHONE_EVENTS.updateReady));
  }),
  updateAcceptanceFailed: () => false,
  updateAccepting: () => state.accepting,
  updateOffered: () => state.offered,
}));
vi.mock("../pwa/launch.ts", async (original) => ({
  ...(await original<typeof import("../pwa/launch.ts")>()),
  bootFinished: () => state.booted,
}));

vi.mock("../ui/phaser/rampDim.ts", () => ({ addRampDim: vi.fn() }));
vi.mock("./nativeOverlayReady.ts", () => ({
  mountNativeOverlay: (_scene: unknown, mount: () => boolean) => mount(),
}));
vi.mock("./modalMeasure.ts", () => ({
  measureModalTitle: () => ({ extraHeight: 0 }),
  modalTextWidth: () => 80,
}));
vi.mock("./overlay.ts", async (original) => ({
  ...(await original<typeof import("./overlay.ts")>()),
  listenOutsideTap: vi.fn(),
}));
vi.mock("./profileStore.ts", () => ({ profileWritesSettled: () => Promise.resolve() }));
vi.mock("./questionPanel.ts", () => ({
  addHtmlModalCard: (
    _scene: unknown,
    _rect: unknown,
    _title: string,
    entries: readonly CardEntry[],
  ) => {
    native.entries = entries;
    native.mount();
    return { destroy: native.destroy };
  },
}));
afterEach(() => vi.unstubAllGlobals());

const { UpdateScene, holdPlay, watchUpdateOffer } = await import("./UpdateScene.ts");

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

it.each([false, true])(
  "restores the legitimate underlying target only after the obsolete or successor prompt releases (successor:%s)",
  (successor) => {
    vi.clearAllMocks();
    state.offered = true;
    state.accepting = false;
    const doc = new FakeDocument();
    const underlying = doc.createElement("div");
    const invoker = doc.createElement("button");
    const fallback = doc.createElement("div");
    underlying.append(invoker);
    doc.body.append(underlying, fallback);
    invoker.focus();
    const page = new EventTarget();
    vi.stubGlobal("window", page);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("location", { reload: native.reload });
    const events = new EventEmitter();
    const render = new EventEmitter();
    const paused = new Set<string>();
    let stopPending = false;
    const resume = vi.fn((key: string) => {
      paused.delete(key);
    });
    const manager = {
      getScenes: () => [{ sys: { settings: { key: SCENE_KEYS.start } } }],
      isActive: (key: string) => key === SCENE_KEYS.start && !paused.has(key),
      isPaused: (key: string) => paused.has(key),
      pause: (key: string) => {
        paused.add(key);
        underlying.inert = true;
        fallback.focus();
      },
      resume,
    };
    const stop = vi.fn(() => {
      stopPending = true;
    });
    const update = Object.assign(new UpdateScene(), {
      events,
      game: { events: render, scene: manager },
      input: { enabled: true, keyboard: new EventEmitter() },
      scene: { isActive: manager.isActive, isPaused: manager.isPaused, resume, stop },
      sys: { isActive: () => !stopPending },
    });
    native.destroy.mockImplementation(() => fallback.focus());
    const settle = () => {
      if (stopPending) {
        events.emit("shutdown");
        stopPending = false;
      }
      underlying.inert = paused.size > 0;
      render.emit("postrender");
    };
    update.create();
    expect(paused.has(SCENE_KEYS.start)).toBe(true);
    expect(native.mount).toHaveBeenCalledOnce();
    native.entries[1]!.press();
    expect(native.destroy).toHaveBeenCalledOnce();
    state.accepting = false;
    state.offered = successor;
    page.dispatchEvent(new Event(PHONE_EVENTS.updateReady));
    if (successor) {
      expect(stop).not.toHaveBeenCalled();
      expect(native.mount).toHaveBeenCalledTimes(2);
      settle();
      expect(paused.has(SCENE_KEYS.start)).toBe(true);
      expect(doc.activeElement).not.toBe(invoker);
      native.entries[0]!.press();
    }
    expect(stop).toHaveBeenCalledOnce();
    expect(doc.activeElement).not.toBe(invoker);
    settle();
    expect(resume).toHaveBeenCalledExactlyOnceWith(SCENE_KEYS.start);
    expect(paused.size).toBe(0);
    expect(doc.activeElement).toBe(invoker);
    expect(native.reload).not.toHaveBeenCalled();
  },
);
