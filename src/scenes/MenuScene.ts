import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { pauseMenuLayout } from "../hud/pauseMenu.ts";
import { isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import { screenArea } from "../input/outsideTap.ts";
import { exitShown } from "../pwa/index.ts";
import { MODAL } from "../ui/modal/layout.ts";
import {
  type MenuContext,
  type MenuItem,
  menuItemLabel,
  menuItems,
  navigationMenuWidth,
} from "../ui/navigationMenu.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { clearOnHomePageOpening, exitGame, openHomePage } from "./homeBarPress.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import {
  closeOverlay,
  listenDismiss,
  nativeSceneAccepts,
  openOverlay,
  type OverlayData,
} from "./overlay.ts";
import { addHtmlQuestionPanel, type QuestionPanel } from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import type { SettingsData } from "./SettingsScene.ts";

export type MenuSceneData = OverlayData & { readonly resume: SceneKey } & (
    | { readonly context: "home"; readonly closePage?: never; readonly onHeadHome?: never }
    | {
        readonly context: Exclude<MenuContext, "home" | "page">;
        readonly closePage: () => void;
        readonly onHeadHome: () => void;
      }
    | { readonly context: "page"; readonly closePage?: never; readonly onHeadHome: () => void }
  );

// Non-play navigation uses the pause menu's layout, controls and dismissal lifecycle.
export class MenuScene extends Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(data: MenuSceneData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount({ closePage, context, onHeadHome, resume }: MenuSceneData): boolean {
    const area = overlayRegion("home");
    const close = () => closeOverlay(resume, this);
    const closeScreen = () => {
      close();
      closePage?.();
    };
    const settings = () => {
      const data: SettingsData = { debuffs: 0, region: "home", resume: SCENE_KEYS.menu };
      openOverlay(this, SCENE_KEYS.settings, data);
    };
    const actions: Readonly<Record<MenuItem, () => void>> = {
      close: context === "help" ? closeScreen : close,
      headHome: () => {
        close();
        onHeadHome?.();
      },
      help: () => openHomePage(this, "help"),
      logbook: () => openHomePage(this, "logbook"),
      quit: () => {
        close();
        exitGame();
      },
      settings,
    };
    const panel: QuestionPanel = {
      backgroundCancel: close,
      close,
      entries: menuItems(context, exitShown()).map((item) => ({
        label: menuItemLabel(gameData, item),
        press: actions[item],
      })),
      layout: pauseMenuLayout,
      note: [],
      panelWidth: navigationMenuWidth(
        gameData,
        canvasPanelMeasure(this),
        area.width - 2 * MODAL.margin,
      ),
      primary: "last",
      sentenceLines: false,
      showKeyNumbers: false,
      title: gameData.menuText.menu.title,
    };
    const covered = addHtmlQuestionPanel(this, area, panel);
    if (covered === undefined) {
      return false;
    }
    addRampDim(this);
    this.events.on(Scenes.Events.PAUSE, () => this.scene.setVisible(false));
    this.events.on(Scenes.Events.RESUME, () => this.scene.setVisible(true));
    listenDismiss(this, screenArea(covered), close);
    clearOnHomePageOpening(this, close);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!nativeSceneAccepts(this)) {
        return;
      }
      if (!menuKeyActs(event.repeat, event.code)) {
        return;
      }
      if (isPauseKey(event.code)) {
        close();
      }
    });
    return true;
  }
}
