import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion, regionOutside } from "../home/homeBar.ts";
import { pauseMenuLayout } from "../hud/pauseMenu.ts";
import { isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
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
import { exitGame, listenHomeBar, openHomePage } from "./homeBarPress.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { closeOverlay, listenDismiss, openOverlay, type OverlayData } from "./overlay.ts";
import { addHtmlQuestionPanel, addQuestionPanel, type QuestionPanel } from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import type { SettingsData } from "./SettingsScene.ts";

export type MenuSceneData = OverlayData & { readonly resume: SceneKey } & (
    | { readonly context: "home"; readonly closePage?: never }
    | { readonly context: Exclude<MenuContext, "home">; readonly closePage: () => void }
  );

// Non-play navigation uses the pause menu's layout, controls and dismissal lifecycle.
export class MenuScene extends Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create({ closePage, context, resume }: MenuSceneData): void {
    const area = overlayRegion("home");
    const close = () => closeOverlay(resume, this);
    addRampDim(this, area);
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
      headHome: closeScreen,
      help: () => openHomePage(this, "help"),
      logbook: () => openHomePage(this, "logbook"),
      quit: () => {
        close();
        exitGame();
      },
      settings,
    };
    const panel: QuestionPanel = {
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
    const covered = addHtmlQuestionPanel(this, area, panel) ?? addQuestionPanel(this, area, panel);
    this.events.on(Scenes.Events.PAUSE, () => this.scene.setVisible(false));
    this.events.on(Scenes.Events.RESUME, () => this.scene.setVisible(true));
    listenDismiss(this, regionOutside("home", 0, covered), close);
    listenHomeBar(this, close);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.code) && isPauseKey(event.code)) {
        close();
      }
    });
  }
}
