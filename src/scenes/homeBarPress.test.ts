import { EventEmitter } from "node:events";

import type { Point, Rect } from "@andornaut/game-kit/rect";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout.ts";
import { listenHomeBar, routeHomeBar } from "./homeBarPress.ts";
import { openOverlay } from "./overlay.ts";

vi.mock("phaser", () => ({ Scenes: { Events: {} } }));
vi.mock("./overlay.ts", async (original) => ({
  ...(await original<typeof import("./overlay.ts")>()),
  openOverlay: vi.fn(),
}));

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

function fakeOverlay() {
  const input = Object.assign(new EventEmitter(), { manager: { pointers: [] } });
  const game = { events: new EventEmitter() };
  const scene = sceneStub(vi.fn, {
    game,
    input,
    scene: { get: () => scene, isActive: () => false, isPaused: () => false },
    time: { now: 0 },
  }) as unknown as Scene;
  const pointer = (point: Point) => ({ ...point, id: 1, isDown: false, wasCanceled: false });
  return {
    down: (point: Point) => input.emit("pointerdown", pointer(point)),
    scene,
    up: (point: Point) => input.emit("pointerup", pointer(point)),
  };
}

const MENU_HIT = homeBarButtons().find(([id]) => id === "menu")![1].hit;
const MENU = centre(MENU_HIT);
const BANK = { x: HOME_LAYOUT.topBar.well.x + 1, y: HOME_LAYOUT.topBar.mid };

describe("the shared menu entry under a home overlay", () => {
  beforeEach(() => vi.mocked(openOverlay).mockClear());

  it.each([
    ["opens on a matching release", MENU, MENU, 1],
    ["ignores a release off the entry", MENU, BANK, 0],
    ["ignores a press begun elsewhere", BANK, MENU, 0],
  ] as const)("%s", (_, down, up, calls) => {
    const overlay = fakeOverlay();
    listenHomeBar(overlay.scene, () => undefined);
    overlay.down(down);
    expect(openOverlay).not.toHaveBeenCalled();
    overlay.up(up);
    expect(openOverlay).toHaveBeenCalledTimes(calls);
    if (calls > 0) {
      expect(openOverlay).toHaveBeenCalledWith(overlay.scene, "menu", {
        context: "home",
        resume: "start",
      });
    }
  });
});

it("routes a paused screen's native bar through the active overlay and preserves its input guard", () => {
  const overlay = fakeOverlay();
  const close = vi.fn();
  Object.assign(overlay.scene.sys, { isActive: () => true });
  overlay.scene.scene.isActive = () => true;
  overlay.scene.input.enabled = true;
  const source = { game: overlay.scene.game, sys: { isActive: () => false } } as Scene;
  listenHomeBar(overlay.scene, close);
  expect(routeHomeBar(source, "menu")).toBe(true);
  expect(close).toHaveBeenCalledOnce();
  overlay.scene.input.enabled = false;
  expect(routeHomeBar(source, "menu")).toBe(true);
  expect(close).toHaveBeenCalledOnce();
  overlay.scene.events.emit("shutdown");
  expect(routeHomeBar(source, "menu")).toBe(false);
});
