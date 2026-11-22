import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import { HOME_PAGE_OPENING_EVENT } from "./homeBarPress.ts";
import { MenuScene, type MenuSceneData } from "./MenuScene.ts";
import { closeOverlay, listenOutsideTap, onBackPressed, openOverlay } from "./overlay.ts";
import type { QuestionPanel } from "./questionPanel.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

const fake = vi.hoisted(() => ({ openCheats: vi.fn(), question: vi.fn() }));
vi.mock("./cheatsModal.ts", () => ({ openCheatsModal: fake.openCheats }));
vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", RESUME: "resume", SHUTDOWN: "shutdown" } },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));
vi.mock("./artReady.ts", () => ({ whenArtReady: (_scene: unknown, ready: () => void) => ready() }));
vi.mock("./modalMeasure.ts", () => ({ canvasPanelMeasure: () => ({ inkWidth: () => 60 }) }));
vi.mock("../ui/phaser/rampDim.ts", () => ({ addRampDim: vi.fn() }));
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
  ["help", gameData.menuText.pause.help],
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

it("opens Cheats directly and returns one layer before closing Menu", () => {
  let closeCheats: () => void;
  const modal = { back: vi.fn(() => false), destroy: vi.fn(), panel: vi.fn() };
  fake.openCheats.mockImplementation((_scene, _walk, close) => {
    closeCheats = close;
    return modal;
  });
  const { keyboard, panel, press, scene } = menu({ context: "home", resume: SCENE_KEYS.start });
  expect(panel.entries.filter((entry) => entry.onInvoke)).toEqual([
    expect.objectContaining({
      label: gameData.menuText.cheats.open,
      onInvoke: expect.any(Function),
    }),
  ]);
  press(gameData.menuText.cheats.open);
  expect(fake.openCheats).toHaveBeenCalledWith(scene, false, expect.any(Function));
  expect(openOverlay).not.toHaveBeenCalled();
  keyboard.emit("keydown", { code: "Escape", repeat: false });
  expect(modal.destroy).toHaveBeenCalledOnce();
  expect(closeOverlay).not.toHaveBeenCalled();
  press(gameData.menuText.cheats.open);
  modal.back.mockReturnValueOnce(true);
  vi.mocked(onBackPressed).mock.calls[0]![1]();
  expect(modal.destroy).toHaveBeenCalledOnce();
  closeCheats!();
  expect(closeOverlay).not.toHaveBeenCalled();
  press(gameData.menuText.common.close);
  expect(closeOverlay).toHaveBeenCalledExactlyOnceWith(SCENE_KEYS.start, scene);
});

it.each(["Back", "X", "shutdown"] as const)(
  "restores the admitted Menu Cheats item after %s except shutdown",
  (route) => {
    const doc = new FakeDocument();
    const invoker = doc.createElement("button");
    invoker.setAttribute("aria-label", gameData.menuText.cheats.open);
    const fallback = doc.createElement("div");
    doc.body.append(invoker, fallback);
    let closeCheats: () => void;
    const modal = {
      back: vi.fn(() => false),
      destroy: vi.fn(() => fallback.focus()),
      panel: vi.fn(),
    };
    fake.openCheats.mockImplementation((_scene, _walk, close) => {
      closeCheats = close;
      return modal;
    });
    const { panel, scene } = menu({ context: "home", resume: SCENE_KEYS.start });
    const entry = panel.entries.find(({ label }) => label === gameData.menuText.cheats.open)!;
    doc.body.focus();
    entry.onInvoke!(invoker as unknown as HTMLElement);
    entry.press();
    if (route === "shutdown") {
      scene.events.emit("shutdown");
    } else {
      closeCheats!();
    }
    expect(modal.destroy).toHaveBeenCalledOnce();
    expect(doc.activeElement).toBe(route === "shutdown" ? fallback : invoker);
    expect(closeOverlay).not.toHaveBeenCalled();
  },
);
