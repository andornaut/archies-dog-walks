import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { pauseMenuLayout } from "../hud/pauseMenu.ts";
import { isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import { screenArea } from "../input/outsideTap.ts";
import { MODAL } from "../ui/modal/layout.ts";
import {
  type MenuContext,
  type MenuItem,
  menuItemLabel,
  menuItems,
  navigationMenuWidth,
} from "../ui/navigationMenu.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { whenArtReady } from "./artReady.ts";
import { type CheatsModal, openCheatsModal } from "./cheatsModal.ts";
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
    let cheats: CheatsModal | undefined;
    let cheatsInvoker: HTMLElement | undefined;
    const closeCheats = (restore = true) => {
      const open = cheats !== undefined;
      const invoker = cheatsInvoker;
      cheats?.destroy();
      cheats = undefined;
      cheatsInvoker = undefined;
      if (
        restore &&
        open &&
        nativeSceneAccepts(this) &&
        invoker?.isConnected &&
        !invoker.hidden &&
        invoker.closest("[hidden], [inert]") === null &&
        invoker.ownerDocument.activeElement !== invoker
      ) {
        focusTarget(invoker);
      }
    };
    const back = () => {
      if (cheats !== undefined) {
        if (!cheats.back()) {
          closeCheats();
        }
      } else {
        closeOverlay(resume, this);
      }
    };
    const close = back;
    this.events.once(Scenes.Events.SHUTDOWN, () => closeCheats(false));
    const settings = () => {
      const data: SettingsData = { region: "home", resume: SCENE_KEYS.menu };
      openOverlay(this, SCENE_KEYS.settings, data);
    };
    const actions: Readonly<Record<MenuItem, () => void>> = {
      cheats: () => {
        if (cheats === undefined) {
          cheats = openCheatsModal(this, false, closeCheats);
        }
      },
      close,
      headHome: () => {
        close();
        onHeadHome?.();
      },
      help: () => {
        if (resume === SCENE_KEYS.help) {
          close();
        } else {
          whenArtReady(this, () => openHelp(this, { region: "home", resume: SCENE_KEYS.menu }));
        }
      },
      logbook: () => {
        if (resume === SCENE_KEYS.stats) {
          close();
        } else {
          openOverlay(this, SCENE_KEYS.stats, { resume: SCENE_KEYS.menu });
        }
      },
      settings,
    };
    const panel: QuestionPanel = {
      backgroundCancel: close,
      close,
      entries: menuItems(context).map((item) => ({
        ...(item === "cheats"
          ? {
              onInvoke: (control: HTMLElement) => {
                cheatsInvoker = control;
              },
            }
          : {}),
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
    onBackPressed(this, back);
    listenOutsideTap(
      this,
      () => (cheats === undefined ? screenArea(covered) : screenArea([cheats.panel()])),
      back,
    );
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
