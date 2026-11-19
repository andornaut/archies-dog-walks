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
vi.mock("./profileStore.ts", async (original) => ({
  ...(await original<typeof import("./profileStore.ts")>()),
  updateProfile: vi.fn(() => Promise.resolve()),
}));

// The Help, Logbook and Pet shop pages: Back (close), Escape and the system back leave each one
// to the screen it opened over, and none has an outside that a tap closes it from.
interface PageScene {
  act(action: unknown): void;
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
    confirm: undefined,
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
    [SCENE_KEYS.start, ...(name === "Help" ? [SCENE_KEYS.pause] : [])].flatMap((resume) => [
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

it.each(PAGES)("%s hears the system back and takes no outside taps", (_name, _type, path) => {
  const source = readFileSync(path, "utf8");
  expect(source).toMatch(/onBackPressed\(this, /);
  expect(source).not.toMatch(/listenDismiss\(|listenOutsideTap\(/);
});
