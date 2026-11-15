import { EventEmitter } from "node:events";

import { isOutside } from "@andornaut/game-kit/input/outsideTap";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import { exitApp } from "@andornaut/game-kit/web/pwa/dom/exitApp";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout.ts";
import { exitShown } from "../pwa/index.ts";
import { listenHomeBar, routeHomeBar, sceneRegionOutside } from "./homeBarPress.ts";
import { openOverlay } from "./overlay.ts";
import { nativeTopSectionButtons } from "./topSection.ts";

vi.mock("../pwa/index.ts", () => ({ exitShown: vi.fn(() => false) }));
vi.mock("./topSection.ts", () => ({
  nativeTopSectionButtons: vi.fn(() => ["mute", "menu", "exit"]),
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/exitApp", () => ({
  browserExitPage: () => ({}),
  exitApp: vi.fn(),
}));
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

const MENU_HIT = homeBarButtons(true).find(([id]) => id === "menu")![1].hit;
const MENU = centre(MENU_HIT);
const BANK = { x: HOME_LAYOUT.topBar.well.x + 1, y: HOME_LAYOUT.topBar.mid };

describe("the shared menu entry under a home overlay", () => {
  beforeEach(() => {
    vi.mocked(openOverlay).mockClear();
  });

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

it("routes retained Home Exit only when both capability and the actual bar expose it", () => {
  const overlay = fakeOverlay();
  Object.assign(overlay.scene.sys, { isActive: () => true });
  overlay.scene.input.enabled = true;
  listenHomeBar(overlay.scene, vi.fn());
  const exit = vi.mocked(exitApp);
  exit.mockClear();
  vi.mocked(nativeTopSectionButtons).mockReturnValue(["mute", "menu", "exit"]);
  vi.mocked(exitShown).mockReturnValue(true);
  const target = centre(homeBarButtons(true).find(([id]) => id === "exit")![1].hit);
  overlay.down(target);
  expect(exit).not.toHaveBeenCalled();
  overlay.up(target);
  expect(exit).toHaveBeenCalledOnce();
  vi.mocked(exitShown).mockReturnValue(false);
  routeHomeBar(overlay.scene, "exit");
  expect(exit).toHaveBeenCalledOnce();
  vi.mocked(nativeTopSectionButtons).mockReturnValue(["mute", "menu"]);
  vi.mocked(exitShown).mockReturnValue(true);
  routeHomeBar(overlay.scene, "exit");
  expect(exit).toHaveBeenCalledOnce();
  expect(isOutside(sceneRegionOutside(overlay.scene, "home", 0, []), { x: 240, y: 20 })).toBe(true);
  vi.mocked(nativeTopSectionButtons).mockReturnValue(["mute", "menu", "exit"]);
  expect(isOutside(sceneRegionOutside(overlay.scene, "home", 0, []), { x: 240, y: 20 })).toBe(
    false,
  );
  overlay.scene.events.emit("shutdown");
  vi.mocked(exitShown).mockReturnValue(false);
});
