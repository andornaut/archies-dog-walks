import { EventEmitter } from "node:events";

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { exitApp } from "@andornaut/game-kit/runtime/web/pwa/dom/exitApp";
import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout.ts";
import { exitShown } from "../pwa/index.ts";
import {
  HOME_PAGE_OPENING_EVENT,
  listenHomeBar,
  openHomePage,
  routeHomeBar,
} from "./homeBarPress.ts";
import { openOverlay } from "./overlay.ts";
import { nativeTopSectionButtons } from "./topSection.ts";

vi.mock("../pwa/index.ts", () => ({ exitShown: vi.fn(() => false) }));
vi.mock("./topSection.ts", () => ({
  nativeTopSectionButtons: vi.fn(() => ["mute", "menu", "exit"]),
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/exitApp", () => ({
  browserExitPage: () => ({}),
  exitApp: vi.fn(),
}));
vi.mock("phaser", () => ({ Scenes: { Events: {} } }));
vi.mock("./overlay.ts", async (original) => ({
  ...(await original<typeof import("./overlay.ts")>()),
  openOverlay: vi.fn(),
}));

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

function fakeOverlay(key = "settings") {
  const input = Object.assign(new EventEmitter(), { manager: { pointers: [] } });
  const game = { events: new EventEmitter() };
  const scene = sceneStub(vi.fn, {
    game,
    input,
    scene: { get: () => scene, isActive: () => false, isPaused: () => false },
    time: { now: 0 },
  }) as unknown as Scene;
  Object.assign(scene.sys, { settings: { key } });
  const pointer = (point: Point, isDown: boolean) => ({
    ...point,
    button: 0,
    buttons: isDown ? 1 : 0,
    id: 1,
    isDown,
    wasCanceled: false,
  });
  return {
    down: (point: Point) => input.emit("pointerdown", pointer(point, true)),
    scene,
    up: (point: Point) => input.emit("pointerup", pointer(point, false)),
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
      // The Menu opens over the page the bar was pressed on.
      expect(openOverlay).toHaveBeenCalledWith(overlay.scene, "menu", {
        context: "page",
        onHeadHome: expect.any(Function),
        resume: "settings",
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
  vi.mocked(nativeTopSectionButtons).mockReturnValue(["mute", "menu", "exit"]);
  overlay.scene.events.emit("shutdown");
  vi.mocked(exitShown).mockReturnValue(false);
});

it("omits title navigation only when the originating screen is the actual title", () => {
  vi.mocked(openOverlay).mockClear();
  const { scene } = fakeOverlay("start");
  openHomePage(scene, "menu");
  expect(openOverlay).toHaveBeenCalledExactlyOnceWith(scene, "menu", {
    context: "home",
    resume: "start",
  });
});

describe("pages opened over the open Logbook, as over the Pet shop", () => {
  const over = (shown: string) => {
    const { scene } = fakeOverlay(shown);
    Object.assign(scene.scene, { isActive: (key: string) => key === shown });
    return scene;
  };

  it.each(["shop", "stats"])("opens the Menu as a page menu over %s", (shown) => {
    vi.mocked(openOverlay).mockClear();
    const scene = over(shown);
    openHomePage(scene, "menu");
    expect(openOverlay).toHaveBeenCalledExactlyOnceWith(
      scene,
      "menu",
      expect.objectContaining({ context: "page", resume: shown }),
    );
  });

  it.each([
    ["shop", 1],
    ["stats", 0],
  ] as const)("asked for the Logbook over %s, opens it %i times", (shown, times) => {
    vi.mocked(openOverlay).mockClear();
    openHomePage(over(shown), "logbook");
    expect(openOverlay).toHaveBeenCalledTimes(times);
  });

  it("opens Help's own Menu over open Help, and asked for Help there, opens none", () => {
    vi.mocked(openOverlay).mockClear();
    const scene = over("help");
    const menu = {
      context: "help",
      onHeadHome: vi.fn(),
      resume: "help",
    } as const;
    listenHomeBar(
      scene,
      () => undefined,
      () => menu,
    );
    openHomePage(scene, "menu");
    expect(openOverlay).toHaveBeenCalledExactlyOnceWith(scene, "menu", menu);
    vi.mocked(openOverlay).mockClear();
    openHomePage(over("help"), "help");
    expect(openOverlay).not.toHaveBeenCalled();
    scene.events.emit("shutdown");
  });

  it.each(["help", "stats"])("returns %s to its invoking Menu without reopening it", (shown) => {
    vi.mocked(openOverlay).mockClear();
    const scene = over(shown);
    const back = vi.fn();
    const opening = vi.fn();
    scene.game.events.on(HOME_PAGE_OPENING_EVENT, opening);
    listenHomeBar(scene, vi.fn(), undefined, back);
    openHomePage(scene, "menu");
    expect(back).toHaveBeenCalledOnce();
    expect(openOverlay).not.toHaveBeenCalled();
    expect(opening).not.toHaveBeenCalled();
    scene.events.emit("shutdown");
  });
});
