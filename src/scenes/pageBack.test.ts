import { readFileSync } from "node:fs";

import { isOutside } from "@andornaut/game-kit/runtime/input/outsideTap";
import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { helpActionForKey } from "../help/helpInput.ts";
import { HELP_LAYOUT } from "../help/helpLayout.ts";
import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout.ts";
import { SHOP_LAYOUT } from "../home/shopLayout.ts";
import { STATS_LAYOUT } from "../home/statsLayout.ts";
import { WALK_BAR_BUTTONS } from "../hud/walkHud.ts";
import { topSectionLayout } from "../ui/topSection.ts";
import { helpOutside, HelpScene } from "./HelpScene.ts";
import { sceneRegionOutside } from "./homeBarPress.ts";
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

// The Help, Logbook and Pet shop pages: Back (close), Escape, the system back and a tap outside
// the page (the live bar's empty area, or beside the game) leave each one to the screen it opened
// over. The page itself has no outside.
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

it.each(PAGES)("%s closes on the system back and an outside tap", (_name, _type, path) => {
  expect(readFileSync(path, "utf8")).toMatch(/listenDismiss\(\s*this,/);
});

it.each([
  ["Logbook", StatsScene],
  ["Pet shop", ShopScene],
] as const)("%s leaves its parent open when dismissing a detail", (_name, type) => {
  const { scene, stage } = page(type, SCENE_KEYS.menu);
  const render = vi.fn();
  Object.assign(scene, { detail: 0, render });
  scene.back();
  expect(stage.resume).not.toHaveBeenCalled();
  expect(stage.stop).not.toHaveBeenCalled();
  expect(render).toHaveBeenCalledOnce();
  expect(scene).toHaveProperty("detail", undefined);
});

it("cancels only the Pet shop confirmation without leaving its invoking page", () => {
  const { scene, stage } = page(ShopScene, SCENE_KEYS.start);
  const answer = vi.fn();
  Object.assign(scene, { answer, confirm: {} });
  scene.back();
  expect(answer).toHaveBeenCalledExactlyOnceWith("cancel");
  expect(stage.resume).not.toHaveBeenCalled();
  expect(stage.stop).not.toHaveBeenCalled();
});

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const SCENE = {} as Scene;
const HOME_BAR = homeBarButtons(false).map(([, { hit }]) => centre(hit));
const WALK_BAR = topSectionLayout(WALK_BAR_BUTTONS).controls.map(([, { hit }]) => centre(hit));
const BANK = { x: HOME_LAYOUT.topBar.well.x, y: HOME_LAYOUT.topBar.mid };
const PAGE_POINTS = (page: Rect) => [
  centre(page),
  { x: page.x, y: page.y },
  { x: page.x + page.width - 1, y: page.y + page.height - 1 },
];

it.each([
  ["Help over a home page", helpOutside(SCENE, "home"), HELP_LAYOUT.page, HOME_BAR],
  ["Help over a walk", helpOutside(SCENE, "walk"), HELP_LAYOUT.page, WALK_BAR],
  ["Logbook", sceneRegionOutside(SCENE, [STATS_LAYOUT.panel]), STATS_LAYOUT.panel, HOME_BAR],
  ["Pet shop", sceneRegionOutside(SCENE, [SHOP_LAYOUT.panel]), SHOP_LAYOUT.panel, HOME_BAR],
])(
  "%s: a tap on the bar's empty area is outside; the page and the bar's buttons are not",
  (_name, area, page, buttons) => {
    expect(isOutside(area, BANK)).toBe(true);
    expect(PAGE_POINTS(page).some((point) => isOutside(area, point))).toBe(false);
    expect(buttons.some((point) => isOutside(area, point))).toBe(false);
  },
);
