import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { HOME_PAGE_OPENING_EVENT } from "./homeBarPress.ts";
import { MenuScene, type MenuSceneData } from "./MenuScene.ts";
import { closeOverlay, listenOutsideTap, openOverlay } from "./overlay.ts";
import type { QuestionPanel } from "./questionPanel.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

const fake = vi.hoisted(() => ({ question: vi.fn() }));
vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", RESUME: "resume", SHUTDOWN: "shutdown" } },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));
vi.mock("./boot/artReady.ts", () => ({
  whenArtReady: (_scene: unknown, ready: () => void) => ready(),
}));
vi.mock("./modalMeasure.ts", () => ({ canvasPanelMeasure: () => ({ inkWidth: () => 60 }) }));
vi.mock("./rampDim.ts", () => ({ addRampDim: vi.fn() }));
vi.mock("./questionPanel.ts", () => ({
  addHtmlQuestionPanel: (_scene: unknown, _area: unknown, panel: QuestionPanel) => {
    fake.question(panel);
    return [];
  },
}));
vi.mock("./overlay.ts", async (original) => ({
  ...(await original<typeof import("./overlay.ts")>()),
  closeOverlay: vi.fn(),
  listenOutsideTap: vi.fn(),
  onBackPressed: vi.fn(),
  openOverlay: vi.fn(() => true),
}));

beforeEach(() => vi.clearAllMocks());

function menu(data: MenuSceneData) {
  const keyboard = new EventEmitter();
  const events = new EventEmitter();
  const scene = Object.assign(Object.create(MenuScene.prototype) as object, {
    events,
    game: { events: new EventEmitter() },
    input: { enabled: true, keyboard },
    scene: { setVisible: vi.fn() },
    sys: { isActive: () => true },
  });
  const mount = (MenuScene.prototype as unknown as { mount(data: MenuSceneData): boolean }).mount;
  expect(mount.call(scene, data)).toBe(true);
  const panel = fake.question.mock.calls[0]![0] as QuestionPanel;
  const press = (label: string) => panel.entries.find((entry) => entry.label === label)!.press();
  return { keyboard, panel, press, scene };
}

it.each([
  ["cheats", gameData.menuText.cheats.open],
  ["help", gameData.menuText.pause.help],
  ["settings", gameData.menuText.pause.settings],
  ["stats", gameData.menuText.stats.title],
] as const)("opens %s over the invoking Menu without replacing it", (key, label) => {
  const { press, scene } = menu({ context: "home", resume: SCENE_KEYS.start });
  const opening = vi.fn();
  scene.game.events.on(HOME_PAGE_OPENING_EVENT, opening);
  press(label);
  expect(openOverlay).toHaveBeenCalledExactlyOnceWith(
    scene,
    key,
    expect.objectContaining({ resume: SCENE_KEYS.menu }),
  );
  expect(closeOverlay).not.toHaveBeenCalled();
  expect(opening).not.toHaveBeenCalled();
});

it("closes only the Menu over Help through its visible, corner, backdrop and Escape actions", () => {
  const { keyboard, panel, press, scene } = menu({
    context: "help",
    onHeadHome: vi.fn(),
    resume: SCENE_KEYS.help,
  });
  press(gameData.menuText.common.close);
  panel.close();
  panel.backgroundCancel?.();
  keyboard.emit("keydown", { code: "Escape", repeat: false });
  const outside = vi.mocked(listenOutsideTap).mock.calls[0]![2];
  outside();
  expect(closeOverlay).toHaveBeenCalledTimes(5);
  for (const [resume, caller] of vi.mocked(closeOverlay).mock.calls) {
    expect(resume).toBe(SCENE_KEYS.help);
    expect(caller).toBe(scene);
  }
});

it.each([
  ["cheats", gameData.menuText.cheats.open],
  ["help", gameData.menuText.pause.help],
  ["settings", gameData.menuText.pause.settings],
] as const)("leaves its own entry out of the %s page's Menu", (context, own) => {
  const { panel } = menu({ context, onHeadHome: vi.fn(), resume: SCENE_KEYS[context] });
  const labels = panel.entries.map((entry) => entry.label);
  expect(labels).not.toContain(own);
  expect(labels).toHaveLength(4);
});

it("returns to the existing Logbook rather than launching the same page over its Menu", () => {
  const { press, scene } = menu({
    context: "page",
    onHeadHome: vi.fn(),
    resume: SCENE_KEYS.stats,
  });
  press(gameData.menuText.stats.title);
  expect(closeOverlay).toHaveBeenCalledExactlyOnceWith(SCENE_KEYS.stats, scene);
  expect(openOverlay).not.toHaveBeenCalled();
});
