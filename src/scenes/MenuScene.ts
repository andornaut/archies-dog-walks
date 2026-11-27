import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/index.ts";
import { isPauseKey, menuKeyActs, screenArea } from "../input/index.ts";
import {
  type MenuContext,
  type MenuItem,
  menuItemLabel,
  menuItems,
  MODAL,
  navigationMenuWidth,
} from "../ui/index.ts";
import { whenArtReady } from "./boot/artReady.ts";
import type { CheatsData } from "./CheatsScene.ts";
import { openHelp } from "./helpScreen.ts";
import { clearOnHomePageOpening } from "./homeBarPress.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import {
  closeOverlay,
  listenOutsideTap,
  nativeSceneAccepts,
  onBackPressed,
  openOverlay,
  type OverlayData,
} from "./overlay.ts";
import { addHtmlQuestionPanel, type QuestionPanel } from "./questionPanel.ts";
import { addRampDim } from "./rampDim.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import type { SettingsData } from "./SettingsScene.ts";

export type MenuSceneData = OverlayData & { readonly resume: SceneKey } & (
    | { readonly context: "home"; readonly onHeadHome?: never }
    | {
        readonly context: Exclude<MenuContext, "home" | "page">;
        readonly onHeadHome: () => void;
      }
    | { readonly context: "page"; readonly onHeadHome: () => void }
  );

// Non-play navigation uses the pause menu's layout, controls and dismissal lifecycle.
export class MenuScene extends Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(data: MenuSceneData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount({ context, onHeadHome, resume }: MenuSceneData): boolean {
    const area = overlayRegion("home");
    const close = () => closeOverlay(resume, this);
    // A page asked of from its own Menu returns to it.
    const page = (key: SceneKey, open: () => void) => () => {
      if (resume === key) {
        close();
      } else {
        open();
      }
    };
    const actions: Readonly<Record<MenuItem, () => void>> = {
      cheats: page(SCENE_KEYS.cheats, () => {
        const data: CheatsData = { region: "home", resume: SCENE_KEYS.menu };
        openOverlay(this, SCENE_KEYS.cheats, data);
      }),
      close,
      headHome: () => {
        close();
        onHeadHome?.();
      },
      help: page(SCENE_KEYS.help, () =>
        whenArtReady(this, () => openHelp(this, { region: "home", resume: SCENE_KEYS.menu })),
      ),
      logbook: page(SCENE_KEYS.stats, () =>
        openOverlay(this, SCENE_KEYS.stats, { resume: SCENE_KEYS.menu }),
      ),
      settings: page(SCENE_KEYS.settings, () => {
        const data: SettingsData = { region: "home", resume: SCENE_KEYS.menu };
        openOverlay(this, SCENE_KEYS.settings, data);
      }),
    };
    const panel: QuestionPanel = {
      backgroundCancel: close,
      close,
      entries: menuItems(context).map((item) => ({
        label: menuItemLabel(gameData, item),
        press: actions[item],
      })),
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
    onBackPressed(this, close);
    listenOutsideTap(this, () => screenArea(covered), close);
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
