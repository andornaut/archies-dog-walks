import { Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { HOME_LAYOUT, overlayRegion } from "../home/index.ts";
import { QUIT_QUESTION_ANSWERS } from "../hud/index.ts";
import { isPauseKey, menuKeyActs, screenArea } from "../input/index.ts";
import { canLeaveFromBack, leaveFromBack } from "../pwa/index.ts";
import { clearOnHomePageOpening, exitGame } from "./homeBarPress.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { closeOverlay, listenDismiss, nativeSceneAccepts, type OverlayData } from "./overlay.ts";
import { addHtmlQuestionPanel, type QuestionPanel } from "./questionPanel.ts";
import { addRampDim } from "./rampDim.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

// The Start confirmation shares its existing native cancellation and focus restoration.
// Explicit Quit keeps its original controls; platform Back uses Cancel/Exit and the Kit guard.
export interface QuitSceneData extends OverlayData {
  readonly platformBack?: boolean;
}

export class QuitScene extends Scene {
  constructor() {
    super(SCENE_KEYS.quit);
  }

  create(data: QuitSceneData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount({ platformBack = false, resume }: QuitSceneData): boolean {
    const area = overlayRegion("home");
    const words = gameData.homeText.quit;
    const keepPlaying = () => closeOverlay(resume, this);
    let leaving = false;
    // Closed first, so a page kept for back-forward caching comes back to the bare home screen.
    const quit = () => {
      if (!platformBack) {
        keepPlaying();
        exitGame();
        return;
      }
      if (leaving || !canLeaveFromBack()) {
        return;
      }
      leaving = true;
      keepPlaying();
      // Kit retains the enabled scope after a failed departure. Start is already restored.
      void leaveFromBack()
        .catch(() => false)
        .finally(() => {
          leaving = false;
        });
    };
    const question: QuestionPanel = {
      avoid: { ...HOME_LAYOUT.gate, width: area.width, x: area.x },
      backgroundCancel: keepPlaying,
      close: keepPlaying,
      entries: QUIT_QUESTION_ANSWERS.map((answer) => ({
        ...(platformBack && answer === "quit" ? { available: canLeaveFromBack() } : {}),
        label: platformBack
          ? gameData.homeText.backExit[answer === "quit" ? "exit" : "cancel"]
          : words[answer],
        press: answer === "quit" ? quit : keepPlaying,
      })),
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
