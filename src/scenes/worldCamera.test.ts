import { EventEmitter } from "node:events";

import type { Game, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { deviceFitOwned } from "../ui/worldFit.ts";
import { followWorldCameras, setWorldViewport } from "./worldCamera.ts";

vi.mock("phaser", () => ({
  Core: { Events: { DESTROY: "destroy", READY: "ready" } },
  Scale: { Events: { RESIZE: "resize" } },
  Scenes: { Events: { CREATE: "create" } },
}));

it("fits default and picture cameras through one resize owner and releases its lifecycle", () => {
  const camera = {
    setOrigin: vi.fn().mockReturnThis(),
    setViewport: vi.fn().mockReturnThis(),
    setZoom: vi.fn().mockReturnThis(),
  };
  const scale = Object.assign(new EventEmitter(), {
    gameSize: { height: 1120, width: 1920 },
    zoom: 0.5,
  });
  const scene = {
    cameras: { cameras: [camera] },
    events: new EventEmitter(),
    scale,
  } as unknown as Scene;
  const game = { events: new EventEmitter(), scale, scene: { scenes: [scene] } } as unknown as Game;
  const dispose = followWorldCameras(game);
  game.events.emit("ready");
  expect(camera.setViewport).toHaveBeenLastCalledWith(600, 0, 720, 1120);
  expect(camera.setZoom).toHaveBeenLastCalledWith(2);
  expect(camera.setOrigin).toHaveBeenLastCalledWith(0, 0);
  setWorldViewport(scene, camera as never, { height: 100, width: 200, x: 20, y: 60 });
  expect(camera.setViewport).toHaveBeenLastCalledWith(640, 120, 400, 200);
  scale.gameSize.width = 720;
  scale.emit("resize");
  expect(camera.setViewport).toHaveBeenLastCalledWith(40, 120, 400, 200);
  expect(deviceFitOwned(scale)).toBe(true);
  dispose();
  dispose();
  const calls = camera.setViewport.mock.calls.length;
  scene.events.emit("create");
  scale.emit("resize");
  expect(camera.setViewport).toHaveBeenCalledTimes(calls);
  expect(deviceFitOwned(scale)).toBe(false);
});
