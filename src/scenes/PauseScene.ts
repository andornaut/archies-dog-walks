import { Core, Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/index.ts";
import { HOME_QUESTION_ANSWERS, type HomeNoteLine } from "../hud/index.ts";
import { screenArea } from "../input/index.ts";
import { SCREEN_LAYOUT, WALKER_SILHOUETTES, walkerFootY } from "../layout/index.ts";
import {
  MODAL,
  navigationMenuWidth,
  PALETTE,
  PAUSE_MENU_ITEMS,
  PAUSE_MENU_KEY_ORDER,
  type PauseMenuItem,
  pauseMenuItemLabel,
} from "../ui/index.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import type { CheatsData } from "./CheatsScene.ts";
import { HELP_CLOSED_EVENT } from "./HelpScene.ts";
import { openHelp } from "./helpScreen.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { listenOutsideTap, onceSceneEvent, openOverlay } from "./overlay.ts";
import { addHtmlQuestionPanel, type PanelEntry, type QuestionPanel } from "./questionPanel.ts";
import type { RunScene } from "./RunScene.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { SETTINGS_CLOSED_EVENT, type SettingsData } from "./SettingsScene.ts";
import { soundboardOf } from "./soundboard.ts";

// Help or the settings, opened at once over the menu from the walk bar: alone, closing it
// resumes the walk; opened over the menu or the question, closing it shows the menu again.
export interface PauseOverlay {
  readonly alone: boolean;
  readonly open: "help" | "settings";
}

// menu is the pause menu, its note saying what End walk keeps; homeQuestion asks whether to
// end the walk, for a fork card's End walk, its note saying what going home keeps and gives
// up.
export type PauseSceneData = {
  onHeadHome: () => void;
  onResume: () => void;
} & (
  | { mode: "homeQuestion"; note: readonly HomeNoteLine[] }
  | { mode: "menu"; note: string; onTitle: () => void; overlay?: PauseOverlay }
);

// The Home question's note lines' colours, by what they say.
const NOTE_COLOURS: Readonly<Record<HomeNoteLine["kind"], number>> = {
  keep: PALETTE.plum,
  lose: PALETTE.darkRed,
  zonesLeft: PALETTE.plum,
};

// The pause menu over the dimmed walk, HUD and walk bar: Cheats, Help and Settings (pages over the
// walk, under the live walk bar), Back to title or Resume; or the Home button's question, keep
// walking or end the walk. The HUD keeps running under it, dimmed and inactive; its pause keys (P
// and Escape) resume.
export class PauseScene extends Scene {
  constructor() {
    super(SCENE_KEYS.pause);
  }

  create(data: PauseSceneData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount(data: PauseSceneData): boolean {
    const { onHeadHome, onResume } = data;
    const walkView = overlayRegion("walk");
    const headHome = () => {
      soundboardOf(this).stopMusic();
      onHeadHome();
    };
    const presses: Readonly<Record<PauseMenuItem, () => void>> = {
      cheats: () => {
        const cheats: CheatsData = { region: "walk", resume: SCENE_KEYS.pause };
        this.hideUnder(() => openOverlay(this, SCENE_KEYS.cheats, cheats));
      },
      headHome: data.mode === "menu" ? data.onTitle : headHome,
      help: () =>
        this.hideUnder(() => openHelp(this, { region: "walk", resume: SCENE_KEYS.pause })),
      resume: onResume,
      settings: () => this.openSettings(),
    };
    const source = this.scene.get(SCENE_KEYS.run) as RunScene;
    const shown = source.hudView();
    const tops = shown?.run.pack.flatMap(({ dog }) => source.dogPoint(dog)?.y ?? []) ?? [];
    const walkerTop =
      shown === undefined
        ? SCREEN_LAYOUT.walkView.y + SCREEN_LAYOUT.walkView.height
        : walkerFootY(SCREEN_LAYOUT.road) - WALKER_SILHOUETTES[shown.run.walker].above;
    const top = Math.min(walkerTop, ...tops);
    const avoid = {
      height: SCREEN_LAYOUT.walkView.y + SCREEN_LAYOUT.walkView.height - top,
      width: SCREEN_LAYOUT.walkView.width,
      x: SCREEN_LAYOUT.walkView.x,
      y: top,
    };
    const question = gameData.runText.homeQuestion;
    const menu = gameData.menuText.pause;
    // Resume is the menu's bottom primary; Keep walking remains the question's safe answer.
    const entries: PanelEntry[] =
      data.mode === "homeQuestion"
        ? HOME_QUESTION_ANSWERS.map((answer) => ({
            label: question[answer],
            press: answer === "headHome" ? headHome : onResume,
          }))
        : PAUSE_MENU_ITEMS.map((item) => ({
            label: pauseMenuItemLabel(gameData, item),
            press: presses[item],
          }));
    // The menu's own note starts each sentence on a line of its own.
    const panel: QuestionPanel =
      data.mode === "homeQuestion"
        ? {
            avoid,
            backgroundCancel: onResume,
            close: onResume,
            entries,
            note: data.note.map((line) => ({ colour: NOTE_COLOURS[line.kind], text: line.text })),
            sentenceLines: false,
            title: question.title,
          }
        : {
            avoid,
            backgroundCancel: onResume,
            close: onResume,
            entries,
            note: [{ colour: PALETTE.plum, text: data.note }],
            numberPresses: PAUSE_MENU_KEY_ORDER.map((item) => presses[item]),
            panelWidth: navigationMenuWidth(
              gameData,
              canvasPanelMeasure(this),
              walkView.width - 2 * MODAL.margin,
            ),
            primary: "last",
            sentenceLines: true,
            showKeyNumbers: false,
            title: menu.title,
          };
    const covered = addHtmlQuestionPanel(this, walkView, panel);
    if (covered === undefined) {
      return false;
    }
    addRampDim(this);
    // The close control and a tap anywhere around the panel resume, as Resume and Keep walking
    // do: the panel's backdrop takes the game frame, the walk bar and dog cards included, and
    // this takes the page beside the game.
    const outside = screenArea(covered);
    listenOutsideTap(this, () => outside, onResume);
    const overlay = data.mode === "menu" ? data.overlay : undefined;
    if (overlay !== undefined) {
      const closed = overlay.open === "help" ? HELP_CLOSED_EVENT : SETTINGS_CLOSED_EVENT;
      if (overlay.alone) {
        onceSceneEvent(this, this.game.events, closed, onResume);
      }
      // Opened once the dim has read back its first frame, so the dim holds the walk, never
      // the page, when the page closes back to the menu.
      const open = () => presses[overlay.open]();
      onceSceneEvent(this, this.game.events, Core.Events.POST_RENDER, open);
    }
    return true;
  }

  // The settings over the walk, a page under the live walk bar.
  private openSettings(): void {
    const data: SettingsData = { region: "walk", resume: SCENE_KEYS.pause };
    this.hideUnder(() => openOverlay(this, SCENE_KEYS.settings, data));
  }

  // Opens a page (Cheats, Help or Settings) over the menu, which hides under it, dim and all, and
  // shows again as the page resumes it; the page leaves the walk bar over it live and undimmed.
  private hideUnder(open: () => boolean): void {
    if (open()) {
      this.scene.setVisible(false);
      onceSceneEvent(this, this.events, Scenes.Events.RESUME, () => this.scene.setVisible(true));
    }
  }
}
