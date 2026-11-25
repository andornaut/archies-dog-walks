import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import type { PauseSceneData } from "../PauseScene.ts";
import { endSceneFor } from "./endDestination.ts";
import { MenuFlow } from "./menuFlow.ts";

vi.mock("../soundboard.ts", () => ({ soundboardOf: () => ({ setPaused: vi.fn() }) }));

function fixture() {
  let current: PauseSceneData | undefined;
  const headHome = vi.fn();
  const shown = new Set<string>();
  const scene = {
    scene: {
      get: () => ({
        scene: {
          restart: (data: PauseSceneData) => {
            current = data;
          },
        },
      }),
      isActive: (key: string) => shown.has(key),
      isPaused: () => false,
      launch: (_key: string, data: PauseSceneData) => {
        current = data;
      },
      stop: vi.fn((key: string) => shown.delete(key)),
    },
    time: { paused: false },
    tweens: { pauseAll: vi.fn(), resumeAll: vi.fn() },
  } as unknown as Scene;
  const flow = new MenuFlow(scene, {
    dropPress: vi.fn(),
    headHome,
    homeNote: () => [],
    over: () => false,
    pauseNote: () => "",
  });
  return { current: () => current!, flow, headHome, scene, shown };
}

it("confirms navigation before requesting a title destination and retains fork settlement", () => {
  const { current, flow, headHome } = fixture();
  flow.openPause("menu");
  const menu = current();
  expect(menu.mode).toBe("menu");
  if (menu.mode !== "menu") {
    throw new Error("Expected menu");
  }
  menu.onTitle();
  expect(current().mode).toBe("homeQuestion");
  expect(headHome).not.toHaveBeenCalled();
  current().onHeadHome();
  expect(headHome).toHaveBeenLastCalledWith("title");
  flow.openPause("homeQuestion");
  current().onHeadHome();
  expect(headHome).toHaveBeenLastCalledWith("end");
});

it("a cancelled title confirmation does not alter subsequent fork or automatic results", () => {
  const { current, flow, headHome } = fixture();
  flow.openTitleQuestion();
  current().onResume();
  expect(headHome).not.toHaveBeenCalled();
  flow.openPause("homeQuestion");
  current().onHeadHome();
  expect(headHome).toHaveBeenCalledExactlyOnceWith("end");
  expect(endSceneFor("end", { kind: "ended", reason: "wentHome" })).toBe("end");
  expect(endSceneFor("title", { kind: "ended", reason: "finished" })).toBe("end");
  expect(endSceneFor("title", { kind: "ended", reason: "noDogs" })).toBe("end");
  expect(endSceneFor("title", { kind: "ended", reason: "wentHome" })).toBe("start");
});

it("counts the Cheats page as the menu's and stops it with Pause when the walk resumes", () => {
  const { flow, scene, shown } = fixture();
  flow.openPause("menu");
  shown.add("cheats");
  expect(flow.pause().menu).toBe("cheats");
  flow.closePause();
  expect(scene.scene.stop).toHaveBeenCalledWith("cheats");
  expect(scene.scene.stop).toHaveBeenCalledWith("pause");
  expect(flow.pause().menu).toBe("closed");
});
