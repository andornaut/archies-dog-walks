import { Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion, regionOutside } from "../home/homeBar.ts";
import { HOME_LAYOUT } from "../home/homeLayout.ts";
import { homeQuestionLayout, QUIT_QUESTION_ANSWERS } from "../hud/pauseMenu.ts";
import { isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import { exitShown } from "../pwa/index.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { exitGame, listenHomeBar } from "./homeBarPress.ts";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay.ts";
import { addHtmlQuestionPanel, addQuestionPanel, type QuestionPanel } from "./questionPanel.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

// Quit? over the dimmed home screen, which back asks with nothing open, laid out as the Home
// question: Keep playing closes it, as back, Escape, P and a tap outside do; Quit leaves the game
// as the top bar's Exit does (exitGame). The top bar keeps its buttons.
export class QuitScene extends Scene {
  constructor() {
    super(SCENE_KEYS.quit);
  }

  create({ resume }: OverlayData): void {
    const area = overlayRegion("home");
    addRampDim(this, area);
    const words = gameData.homeText.quit;
    const keepPlaying = () => closeOverlay(resume, this);
    // Closed first, so a page kept for back-forward caching comes back to the bare home screen.
    const quit = () => {
      keepPlaying();
      exitGame();
    };
    const question: QuestionPanel = {
      avoid: { ...HOME_LAYOUT.gate, width: area.width, x: area.x },
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
    // In HTML where the page's switch is on and its fonts are ready, else on the canvas.
    const covered =
      addHtmlQuestionPanel(this, area, question) ?? addQuestionPanel(this, area, question);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.code) && isPauseKey(event.code)) {
        keepPlaying();
      }
    });
    const exit = exitShown();
    listenDismiss(this, regionOutside(exit, "home", covered), keepPlaying);
    listenHomeBar(this, exit, keepPlaying);
  }
}
