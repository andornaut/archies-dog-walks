import { browserExitPage, exitApp } from "@andornaut/game-kit/runtime/web/pwa/dom/exitApp";
import type { Scene } from "phaser";

import { homeBarAction, type HomeBarButton, homeBarButtonAt } from "../home/index.ts";
import { openGuard } from "../input/index.ts";
import { exitShown } from "../pwa/index.ts";
import { whenArtReady } from "./boot/artReady.ts";
import { openHelp } from "./helpScreen.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { BAR_MUTED_EVENT, onSceneEvent, openOverlay } from "./overlay.ts";
import { toggleMuted } from "./profileStore.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import type { SettingsData } from "./SettingsScene.ts";
import { listenTargetPress } from "./targetPress.ts";
import { requestTitleReturn } from "./titleNavigation.ts";
import { nativeTopSectionButtons } from "./topSection.ts";

// Emitted on game.events as the top bar opens help, the Logbook, the settings or the Menu: the
// badge celebration closes, and the start screen, the Pet shop, the Logbook, the settings and
// Cheats close any detail card, badge card, install steps' card or Reset save question, so the
// page opens alone over the page beneath, dimmed once. A page under them stays open: what the bar
// opens over it opens over the page.
export const HOME_PAGE_OPENING_EVENT = "home-page-opening";

type HomePage = "help" | "logbook" | "menu" | "settings";

const homePageGuard = openGuard();
const barRoutes = new WeakMap<object, Set<Scene>>();
// The Menu a page opens over itself in place of the page Menu, by page (Help's).
const pageMenus = new WeakMap<Scene, () => MenuSceneData>();
// Pages launched by Menu return to its retained instance instead of opening it over itself.
const parentMenus = new WeakMap<Scene, () => void>();

// Opens page from the top bar, tapped on from, at once: over the topmost open page (from, when it
// is one, else Help, the Logbook or the Pet shop), else over the start screen, in place of every
// other overlay and card. The Logbook, Help or the settings asked of while it is the page under
// stays as it is. The overlays it closes and the one it opens change at Phaser's next step, so a
// second page asked of from before then is dropped (openGuard).
export function openHomePage(from: Scene, page: HomePage): void {
  homePageGuard(from.game.events, from, () => {
    const title = from.sys.settings.key === SCENE_KEYS.start;
    const { cheats, help, settings, shop, start, stats } = SCENE_KEYS;
    const pages: readonly SceneKey[] = [cheats, settings, help, stats, shop];
    const own = from.sys.settings.key as SceneKey;
    const resume = pages.includes(own)
      ? own
      : (pages.find((key) => from.scene.isActive(key) || from.scene.isPaused(key)) ?? start);
    const under = from.scene.get(resume);
    const returnToMenu = page === "menu" ? parentMenus.get(under) : undefined;
    if (returnToMenu !== undefined) {
      returnToMenu();
      return;
    }
    from.game.events.emit(HOME_PAGE_OPENING_EVENT);
    switch (page) {
      case "menu": {
        const pageMenu = pageMenus.get(under);
        const data: MenuSceneData =
          pageMenu?.() ??
          (title
            ? { context: "home", resume }
            : { context: "page", onHeadHome: () => requestTitleReturn(under), resume });
        openOverlay(under, SCENE_KEYS.menu, data);
        return;
      }
      case "help":
        if (resume !== help) {
          // Help shows art boot may still be loading.
          whenArtReady(under, () => openHelp(under, { region: "home", resume }));
        }
        return;
      case "logbook":
        if (resume !== stats) {
          openOverlay(under, SCENE_KEYS.stats, { resume });
        }
        return;
      case "settings": {
        if (resume !== settings) {
          const data: SettingsData = { region: "home", resume };
          openOverlay(under, SCENE_KEYS.settings, data);
        }
        return;
      }
      default:
        page satisfies never;
    }
  });
}

// Leaves the game from the top bar's Exit or Quit?'s Quit (the kit's exitApp), which closes the
// installed app's window. Both are offered only where that window can close (exitShown), so
// leaving never navigates elsewhere.
export function exitGame(): void {
  exitApp(browserExitPage());
}

// A page the top bar or the Menu opens (HOME_PAGE_OPENING_EVENT) clears scene first, so the page
// opens alone over the page beneath.
export function clearOnHomePageOpening(scene: Scene, clear: () => void): void {
  onSceneEvent(scene, scene.game.events, HOME_PAGE_OPENING_EVENT, clear);
}

// A nonmodal page over the start screen (the Pet shop, the Logbook, Help) routes the shared
// controls while the screen under it is paused. Under a modal the bar is dimmed and inactive, so
// no modal routes it. menu, where given, is the Menu the bar's Menu opens over the page.
export function listenHomeBar(
  scene: Scene,
  clear: () => void,
  menu?: () => MenuSceneData,
  returnToMenu?: () => void,
): void {
  const routes = barRoutes.get(scene.game) ?? new Set<Scene>();
  routes.add(scene);
  barRoutes.set(scene.game, routes);
  if (menu !== undefined) {
    pageMenus.set(scene, menu);
  }
  if (returnToMenu !== undefined) {
    parentMenus.set(scene, returnToMenu);
  }
  scene.events.once("shutdown", () => {
    routes.delete(scene);
    pageMenus.delete(scene);
    parentMenus.delete(scene);
    if (routes.size === 0) {
      barRoutes.delete(scene.game);
    }
  });
  clearOnHomePageOpening(scene, clear);
  listenTargetPress<HomeBarButton>(scene, {
    onPressed: () => undefined,
    onTap: (button) => pressHomeBar(scene, button),
    targetAt: (x, y) => homeBarButtonAt(nativeTopSectionButtons(scene).includes("exit"), x, y),
  });
}

// Native controls route through the active overlay, even when their originating screen is paused.
export function routeHomeBar(source: Scene, button: HomeBarButton): boolean {
  const route = [...(barRoutes.get(source.game) ?? [])]
    .reverse()
    .find((scene) => scene.sys.isActive());
  if (route === undefined) {
    return false;
  }
  if (route.input.enabled) {
    pressHomeBar(route, button);
  }
  return true;
}

function pressHomeBar(scene: Scene, button: HomeBarButton): void {
  const action = homeBarAction(button);
  switch (action) {
    case "exit":
      if (exitShown() && nativeTopSectionButtons(scene).includes("exit")) {
        exitGame();
      }
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
