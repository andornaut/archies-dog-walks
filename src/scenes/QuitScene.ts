import { Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { HOME_LAYOUT } from "../home/homeLayout.ts";
import { homeQuestionLayout, QUIT_QUESTION_ANSWERS } from "../hud/pauseMenu.ts";
import { isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import { screenArea } from "../input/outsideTap.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { clearOnHomePageOpening, exitGame } from "./homeBarPress.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { closeOverlay, listenDismiss, nativeSceneAccepts, type OverlayData } from "./overlay.ts";
import { addHtmlQuestionPanel, type QuestionPanel } from "./questionPanel.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

// Quit? over the dimmed home screen, which back asks with nothing open, laid out as the Home
// question: Keep playing closes it, as back, Escape, P and a tap outside do; Quit leaves the game
// as the top bar's Exit does (exitGame). The top bar stays dimmed and inactive under it.
export class QuitScene extends Scene {
  constructor() {
    super(SCENE_KEYS.quit);
  }

  create(data: OverlayData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount({ resume }: OverlayData): boolean {
    const area = overlayRegion("home");
    const words = gameData.homeText.quit;
    const keepPlaying = () => closeOverlay(resume, this);
    // Closed first, so a page kept for back-forward caching comes back to the bare home screen.
    const quit = () => {
      keepPlaying();
      exitGame();
    };
    const question: QuestionPanel = {
      avoid: { ...HOME_LAYOUT.gate, width: area.width, x: area.x },
      backgroundCancel: keepPlaying,
      close: keepPlaying,
      entries: QUIT_QUESTION_ANSWERS.map((answer) => ({
        label: words[answer],
        press: answer === "quit" ? quit : keepPlaying,
      })),
      layout: homeQuestionLayout,
      note: [],
      sentenceLines: false,
      title: words.title,
    };
    const covered = addHtmlQuestionPanel(this, area, question);
    if (covered === undefined) {
      return false;
    }
    addRampDim(this);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!nativeSceneAccepts(this)) {
        return;
      }
      if (menuKeyActs(event.repeat, event.code) && isPauseKey(event.code)) {
        keepPlaying();
      }
    });
    listenDismiss(this, screenArea(covered), keepPlaying);
    clearOnHomePageOpening(this, keepPlaying);
    return true;
  }
}
