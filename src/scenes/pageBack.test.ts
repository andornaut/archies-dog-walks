import { readFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import { helpActionForKey } from "../help/helpInput.ts";
import { HelpScene } from "./HelpScene.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { ShopScene } from "./ShopScene.ts";
import { StatsScene } from "./StatsScene.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", RESUME: "resume", SHUTDOWN: "shutdown" } },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));
vi.mock("./topSection.ts", async (original) => ({
  ...(await original<typeof import("./topSection.ts")>()),
  nativeTopSectionButtons: vi.fn(() => ["mute", "menu"]),
}));
vi.mock("./profileStore.ts", async (original) => ({
  ...(await original<typeof import("./profileStore.ts")>()),
  updateProfile: vi.fn(() => Promise.resolve()),
}));

// The Help, Logbook and Pet shop pages: Back (close), Escape and the system back leave each one to
// the screen it opened over.
interface PageScene {
  act(action: unknown): void;
  back(): void;
  close(): void;
  onKey(code: string, repeat?: boolean): unknown;
}

const PAGES = [
  ["Help", HelpScene, "src/scenes/HelpScene.ts"],
  ["Logbook", StatsScene, "src/scenes/StatsScene.ts"],
  ["Pet shop", ShopScene, "src/scenes/ShopScene.ts"],
] as const;

function page(type: (typeof PAGES)[number][1], resume: SceneKey) {
  const scene = Object.create(type.prototype as object) as PageScene;
  const stage = { resume: vi.fn(), stop: vi.fn() };
  Object.assign(scene, {
    action: { kind: "none" },
    detail: undefined,
    game: { events: { emit: vi.fn() } },
    page: 0,
    resumeKey: resume,
    scene: stage,
  });
  return { scene, stage };
}

const escape = (name: string, scene: PageScene) => {
  if (name === "Help") {
    scene.act(helpActionForKey(false, "Escape"));
  } else {
    scene.onKey("Escape", false);
  }
};

it.each(
  PAGES.flatMap(([name, type]) =>
    [
      SCENE_KEYS.start,
      ...(name === "Pet shop" ? [] : [SCENE_KEYS.menu]),
      ...(name === "Help" ? [SCENE_KEYS.pause] : []),
    ].flatMap((resume) => [
      [name, type, resume, "Back", (scene: PageScene) => scene.close()] as const,
      [name, type, resume, "Escape", (scene: PageScene) => escape(name, scene)] as const,
    ]),
  ),
)("%s opened over %s leaves to it by %s", (_name, type, resume, _way, leave) => {
  const { scene, stage } = page(type, resume);
  leave(scene);
  expect(stage.resume).toHaveBeenCalledExactlyOnceWith(resume);
  expect(stage.stop).toHaveBeenCalledOnce();
});

// A page sits level with the top bar and the rest of the screen, so none has an outside: a tap on
// the bar's empty area, the walk bar's wells or beside the game does nothing over any of the five,
// from home or from Pause, while the system back leaves it and the home bar's Sound and Menu act
// over it (listenHomeBar; the walk bar's are topBarAction's). Only a modal over a page, Reset
// save?, the install steps' card or the Menu, closes on a tap outside it.
const OUTSIDE_TAP = /\b(?:catchOutsideTaps|listenDismiss|listenOutsideTap)\(/;

it.each([
  ["Cheats", "src/scenes/CheatsScene.ts"],
  ["Help", "src/scenes/HelpScene.ts"],
  ["Logbook", "src/scenes/StatsScene.ts"],
  ["Pet shop", "src/scenes/ShopScene.ts"],
  ["Settings", "src/scenes/SettingsScene.ts"],
])("%s takes no outside tap but leaves on the system back under a live bar", (_name, path) => {
  const source = readFileSync(path, "utf8");
  expect(source).not.toMatch(OUTSIDE_TAP);
  expect(source).toMatch(/onBackPressed\(\s*this,/);
  expect(source).toMatch(/listenHomeBar\(\s*this,/);
});

it.each([
  ["the Menu", "src/scenes/MenuScene.ts", OUTSIDE_TAP],
  ["Reset save?", "src/scenes/cheatsPage.ts", /backgroundCancel: closeQuestion\b/],
  [
    "the install steps' card",
    "src/hud/dom/settingsInstall.ts",
    /backgroundCancel: input\.closeSteps\b/,
  ],
])("%s over a page closes on a tap outside it", (_name, path, outside) => {
  expect(readFileSync(path, "utf8")).toMatch(outside);
});

it.each([
  ["Logbook", StatsScene],
  ["Pet shop", ShopScene],
] as const)("%s leaves its parent open when dismissing a detail", (_name, type) => {
  const { scene, stage } = page(type, SCENE_KEYS.menu);
  const focusBadge = vi.fn();
  const render = vi.fn();
  Object.assign(scene, {
    detail: 0,
    ...(type === StatsScene ? { page: { focusBadge } } : {}),
    render,
  });
  scene.back();
  expect(stage.resume).not.toHaveBeenCalled();
  expect(stage.stop).not.toHaveBeenCalled();
  expect(render).toHaveBeenCalledOnce();
  expect(scene).toHaveProperty("detail", undefined);
  if (type === StatsScene) {
    expect(focusBadge).toHaveBeenCalledExactlyOnceWith(0);
    expect(render.mock.invocationCallOrder[0]).toBeLessThan(
      focusBadge.mock.invocationCallOrder[0]!,
    );
  }
});

it("Escape dismisses the Pet shop item without buying or leaving its invoking page", () => {
  const { scene, stage } = page(ShopScene, SCENE_KEYS.start);
  const answer = vi.fn();
  const render = vi.fn();
  Object.assign(scene, { answer, detail: { dog: "lady", kind: "dog" }, render });
  scene.onKey("Escape");
  expect(answer).not.toHaveBeenCalled();
  expect(scene).toHaveProperty("detail", undefined);
  expect(render).toHaveBeenCalledOnce();
  expect(stage.resume).not.toHaveBeenCalled();
  expect(stage.stop).not.toHaveBeenCalled();
});
