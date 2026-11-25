import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { type CheatsData, CheatsScene } from "./CheatsScene.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { BAR_MUTED_EVENT, closeOverlay, onBackPressed } from "./overlay.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

const fake = vi.hoisted(() => ({
  page: { back: vi.fn(() => false), destroy: vi.fn() },
  uncover: vi.fn(),
}));
vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { SHUTDOWN: "shutdown" } } }));
vi.mock("./cheatsPage.ts", () => ({ openCheatsPage: () => fake.page }));
vi.mock("../hud/dom/helpUnderlay.ts", () => ({ coverHelpUnderlay: () => fake.uncover }));
vi.mock("./homeBarPress.ts", () => ({ listenHomeBar: vi.fn() }));
vi.mock("./nativeOverlayReady.ts", () => ({
  mountNativeOverlay: (_scene: unknown, mount: () => boolean) => mount(),
}));
vi.mock("./overlay.ts", () => ({
  BAR_MUTED_EVENT: "bar-muted",
  closeOverlay: vi.fn(),
  nativeSceneAccepts: () => true,
  onBackPressed: vi.fn(),
}));
vi.mock("./profileStore.ts", () => ({ toggleMuted: () => true }));
vi.mock("./questionPanel.ts", () => ({ htmlPanelPlace: () => ({ layer: { element: {} } }) }));
vi.mock("./titleNavigation.ts", () => ({ requestTitleReturn: vi.fn() }));
vi.mock("./topSection.ts", () => ({ shownTopSectionRoots: () => [] }));

beforeEach(() => vi.clearAllMocks());

function open(data: CheatsData) {
  const keyboard = new EventEmitter();
  const events = new EventEmitter();
  const game = new EventEmitter();
  const scene = Object.assign(Object.create(CheatsScene.prototype) as object, {
    events,
    game: { events: game },
    input: { keyboard },
  }) as unknown as CheatsScene;
  scene.create(data);
  return { events, game, keyboard, scene };
}

it.each([
  ["Escape", (keyboard: EventEmitter) => keyboard.emit("keydown", { code: "Escape" })],
  ["the system back", () => vi.mocked(onBackPressed).mock.calls[0]![1]()],
])("closes Reset save's question, then the page, on %s", (_how, back) => {
  const { keyboard, scene } = open({ region: "walk", resume: SCENE_KEYS.pause });
  fake.page.back.mockReturnValueOnce(true);
  back(keyboard);
  expect(closeOverlay).not.toHaveBeenCalled();
  back(keyboard);
  expect(closeOverlay).toHaveBeenCalledExactlyOnceWith(SCENE_KEYS.pause, scene);
});

it("mutes on M, as Help does, and restores what it covered before disposing the page", () => {
  const { events, game, keyboard } = open({ region: "walk", resume: SCENE_KEYS.pause });
  const muted = vi.fn();
  game.on(BAR_MUTED_EVENT, muted);
  keyboard.emit("keydown", { code: "KeyM" });
  expect(muted).toHaveBeenCalledExactlyOnceWith(true);
  fake.uncover.mockImplementation(() => expect(fake.page.destroy).not.toHaveBeenCalled());
  events.emit("shutdown");
  expect(fake.uncover).toHaveBeenCalled();
  expect(fake.page.destroy).toHaveBeenCalledOnce();
});

it.each([
  ["the Menu", SCENE_KEYS.menu, true],
  ["the start screen", SCENE_KEYS.start, false],
] as const)("routes the home bar over a page opened from %s", (_from, resume, returns) => {
  const { scene } = open({ region: "home", resume });
  const [, , menu, returnToMenu] = vi.mocked(listenHomeBar).mock.calls[0]!;
  expect(menu?.()).toMatchObject({
    context: "cheats",
    resume: SCENE_KEYS.cheats,
  } satisfies Partial<MenuSceneData>);
  expect(returnToMenu !== undefined).toBe(returns);
  returnToMenu?.();
  expect(vi.mocked(closeOverlay).mock.calls).toEqual(returns ? [[resume, scene]] : []);
});

it("leaves the walk bar to the HUD over a walk", () => {
  open({ region: "walk", resume: SCENE_KEYS.pause });
  expect(listenHomeBar).not.toHaveBeenCalled();
});
