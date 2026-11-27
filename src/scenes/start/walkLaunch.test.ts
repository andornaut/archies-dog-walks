import { EventEmitter } from "node:events";

import { Core, type Scene, type Time } from "phaser";
import { beforeEach, expect, it, vi } from "vitest";

import { DOG_IDS } from "../../data/ids.ts";
import { gameData } from "../../data/index.ts";
import { markArtReady } from "../boot/artReady.ts";
import { HELP_CLOSED_EVENT } from "../HelpScene.ts";
import type { RunPick } from "../run/runStart.ts";
import { SCENE_KEYS } from "../sceneKeys.ts";
import { createWalkLaunch } from "./walkLaunch.ts";

const fakes = vi.hoisted(() => ({
  begin: vi.fn(),
  finish: vi.fn(),
  openHelp: vi.fn(),
  progress: vi.fn(),
  runData: {},
}));

vi.mock("phaser", () => ({
  Core: { Events: { POST_RENDER: "postrender" } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
vi.mock("../../loadingProgress.ts", () => ({ waitedLoad: { begin: fakes.begin } }));
vi.mock("../../pwa/index.ts", async (original) => ({
  ...(await original<typeof import("../../pwa/index.ts")>()),
  startWakeLock: () => undefined,
}));
vi.mock("../HelpScene.ts", () => ({ HELP_CLOSED_EVENT: "help-closed" }));
vi.mock("../helpScreen.ts", () => ({ openHelp: fakes.openHelp }));
vi.mock("../cheatChoices.ts", () => ({ nextWalk: () => undefined }));
vi.mock("../run/runRecorder.ts", () => ({ nextRunStart: () => undefined }));
vi.mock("../run/runStart.ts", () => ({ runSceneData: () => fakes.runData }));

const pick: RunPick = {
  dogSlots: 1,
  loadout: { dogs: [DOG_IDS[0]], gear: null, walker: gameData.defaultWalker },
};

function setup() {
  const events = new EventEmitter();
  const redraw = vi.fn();
  const start = vi.fn();
  const pending = new Set<Time.TimerEvent>();
  const callbacks: (() => void)[] = [];
  const scene = {
    events: new EventEmitter(),
    game: { events },
    registry: new Map(),
    scene: { start },
    time: {
      delayedCall: vi.fn((delay: number, action: () => void) => {
        expect(delay).toBe(0);
        callbacks.push(action);
        return { remove: vi.fn() };
      }),
    },
  } as unknown as Scene;
  return {
    callbacks,
    events,
    launch: createWalkLaunch(scene, { pending, redraw }),
    pending,
    redraw,
    scene,
    start,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fakes.begin.mockReturnValue({ finish: fakes.finish, progress: fakes.progress });
});

it("runs only the latest queued art action and drops a cancelled one", () => {
  const { launch, redraw, scene } = setup();
  const openHelp = vi.fn();
  const start = vi.fn();
  launch.afterArt("help", openHelp);
  launch.afterArt("start", start);
  expect(launch.waiting()).toBe("start");
  markArtReady(scene);
  expect(openHelp).not.toHaveBeenCalled();
  expect(start).toHaveBeenCalledOnce();
  expect(redraw).toHaveBeenCalledTimes(3);

  const cancelled = setup();
  launch.afterArt("help", openHelp);
  expect(openHelp).toHaveBeenCalledOnce();
  cancelled.launch.afterArt("help", openHelp);
  cancelled.launch.cancel();
  markArtReady(cancelled.scene);
  expect(openHelp).toHaveBeenCalledOnce();
});

it("paints planning before scheduling a walk and ignores stale work after pause", () => {
  const { callbacks, events, launch, pending, redraw, start } = setup();
  launch.begin(false, pick);
  launch.begin(false, pick);
  expect(fakes.progress).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(redraw).toHaveBeenCalledOnce();
  expect(launch.waiting()).toBe("start");
  expect(callbacks).toHaveLength(0);

  events.emit(Core.Events.POST_RENDER);
  const [timer] = pending;
  timer!.remove();
  pending.clear();
  launch.cancel();
  callbacks[0]!();
  expect(start).not.toHaveBeenCalled();
  expect(fakes.finish).toHaveBeenCalledOnce();
  expect(launch.waiting()).toBeUndefined();

  launch.begin(false, pick);
  events.emit(Core.Events.POST_RENDER);
  callbacks[1]!();
  expect(start).toHaveBeenCalledExactlyOnceWith(SCENE_KEYS.run, fakes.runData);
  expect(pending.size).toBe(0);
});

it("waits for the first help page only if it opened", () => {
  const { events, launch } = setup();
  fakes.openHelp.mockReturnValueOnce(false).mockReturnValueOnce(true);
  launch.begin(true, pick);
  expect(events.listenerCount(HELP_CLOSED_EVENT)).toBe(0);
  launch.begin(true, pick);
  expect(fakes.begin).not.toHaveBeenCalled();
  events.emit(HELP_CLOSED_EVENT);
  expect(fakes.begin).toHaveBeenCalledOnce();
});
