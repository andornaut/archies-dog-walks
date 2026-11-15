import type { Rect } from "@andornaut/game-kit/rect";
import { browserExitPage, exitApp } from "@andornaut/game-kit/web/pwa/dom/exitApp";
import type { Scene } from "phaser";

import {
  homeBarAction,
  homeBarButtonAt,
  type OverlayRegion,
  regionOutside,
} from "../home/homeBar.ts";
import type { HomeBarButton } from "../home/homeLayout.ts";
import { openGuard } from "../input/openGuard.ts";
import { exitShown } from "../pwa/index.ts";
import { whenArtReady } from "./artReady.ts";
import { openHelp } from "./helpScreen.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { BAR_MUTED_EVENT, onSceneEvent, openOverlay } from "./overlay.ts";
import { toggleMuted } from "./profileStore.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import type { SettingsData } from "./SettingsScene.ts";
import { listenTargetPress } from "./targetPress.ts";
import { nativeTopSectionButtons } from "./topSection.ts";

// Emitted on game.events as the top bar opens help, the Logbook or the settings: the Logbook,
// the settings and the badge celebration close, and the start screen and the Pet shop close any
// detail card or purchase confirm, so the page opens alone over the page beneath, dimmed once.
export const HOME_PAGE_OPENING_EVENT = "home-page-opening";

type HomePage = "help" | "logbook" | "menu" | "settings";

const homePageGuard = openGuard();
const barRoutes = new WeakMap<object, Map<Scene, () => void>>();

// Opens page from the top bar, tapped on from, at once: over the Pet shop while it is open, else
// over the start screen, in place of every other overlay and card. The overlays it closes and
// the one it opens change at Phaser's next step, so a second page asked of from before then is
// dropped (openGuard).
export function openHomePage(from: Scene, page: HomePage): void {
  homePageGuard(from.game.events, from, () => {
    from.game.events.emit(HOME_PAGE_OPENING_EVENT);
    const { shop, start } = SCENE_KEYS;
    const resume = from.scene.isActive(shop) || from.scene.isPaused(shop) ? shop : start;
    const under = from.scene.get(resume);
    switch (page) {
      case "menu": {
        const data: MenuSceneData = { context: "home", resume };
        openOverlay(under, SCENE_KEYS.menu, data);
        return;
      }
      case "help":
        // Help shows art boot may still be loading.
        whenArtReady(under, () => openHelp(under, resume));
        return;
      case "logbook":
        openOverlay(under, SCENE_KEYS.stats, { resume });
        return;
      case "settings": {
        const data: SettingsData = { debuffs: 0, region: "home", resume };
        openOverlay(under, SCENE_KEYS.settings, data);
        return;
      }
      default:
        page satisfies never;
    }
  });
}

// Leaves the game from the top bar's Exit or Quit?'s Quit (the kit's exitApp): an installed app's
// window closes, and a browser tab goes to the site's home page. Neither is offered in an
// installed app that cannot close (exitShown).
export function exitGame(): void {
  exitApp(browserExitPage());
}

// Dismissal excludes the actual retained bar, including capability-dependent Exit.
export function sceneRegionOutside(
  scene: Scene,
  region: OverlayRegion,
  debuffs: number,
  covered: readonly Rect[],
) {
  return regionOutside(region, nativeTopSectionButtons(scene).includes("exit"), debuffs, covered);
}

// The topmost home overlay routes the shared controls while its underlying scene is paused.
// Opening navigation clears replaceable overlays through HOME_PAGE_OPENING_EVENT.
export function listenHomeBar(scene: Scene, close: () => void, clear: () => void = close): void {
  const routes = barRoutes.get(scene.game) ?? new Map<Scene, () => void>();
  routes.set(scene, close);
  barRoutes.set(scene.game, routes);
  scene.events.once("shutdown", () => {
    routes.delete(scene);
    if (routes.size === 0) {
      barRoutes.delete(scene.game);
    }
  });
  onSceneEvent(scene, scene.game.events, HOME_PAGE_OPENING_EVENT, clear);
  listenTargetPress<HomeBarButton>(scene, {
    onPressed: () => undefined,
    onTap: (button) => pressHomeBar(scene, close, button),
    targetAt: (x, y) => homeBarButtonAt(nativeTopSectionButtons(scene).includes("exit"), x, y),
  });
}

// Native controls route through the active overlay, even when their originating screen is paused.
export function routeHomeBar(source: Scene, button: HomeBarButton): boolean {
  const route = [...(barRoutes.get(source.game) ?? [])]
    .reverse()
    .find(([scene]) => scene.sys.isActive());
  if (route === undefined) {
    return false;
  }
  const [scene, close] = route;
  if (scene.input.enabled) {
    pressHomeBar(scene, close, button);
  }
  return true;
}

function pressHomeBar(scene: Scene, close: () => void, button: HomeBarButton): void {
  const shown = (key: SceneKey) => scene.scene.isActive(key) || scene.scene.isPaused(key);
  const open = { menu: shown(SCENE_KEYS.menu) };
  const action = homeBarAction(open, button);
  switch (action) {
    case "exit":
      if (exitShown() && nativeTopSectionButtons(scene).includes("exit")) {
        exitGame();
      }
      return;
    case "close":
      close();
      return;
    case "mute":
      scene.game.events.emit(BAR_MUTED_EVENT, toggleMuted(scene));
      return;
    case "openMenu":
      openHomePage(scene, "menu");
      return;
    default:
      action satisfies never;
  }
}
