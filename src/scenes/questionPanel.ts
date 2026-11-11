import { containsPoint, type Rect } from "@andornaut/game-kit/rect";
import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { type Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { showQuestionPanel } from "../hud/dom/questionPanel.ts";
import { NOTE_PLATE, type pauseMenuLayout } from "../hud/pauseMenu.ts";
import {
  type PanelMeasure,
  type PanelNotePart,
  type QuestionPanelView,
  questionPanelView,
} from "../hud/questionPanelView.ts";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings.ts";
import { pageFrameTurn } from "../pwa/index.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { PALETTE } from "../ui/palette.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import {
  addPixelText,
  pixelBitmapFont,
  pixelFontMetrics,
  wrapPixelText,
} from "../ui/phaser/pixelText.ts";
import { addCardClose, addCardTitle } from "./homePanels.ts";
import { modalTextWidth } from "./modalMeasure.ts";
import { onSceneEvent } from "./overlay.ts";
import { listenTargetPress } from "./targetPress.ts";
import { addMenuButton, addRimmedPanel, addTapBurst, type MenuButton } from "./uiKit.ts";

// A button on the panel: its label and what a press, a tap or its number key, does.
export interface PanelEntry {
  readonly label: string;
  readonly press: () => void;
}

export interface QuestionPanel {
  readonly avoid?: Rect;
  // What the close control in the panel's top-right corner does, as a tap outside the panel does.
  readonly close: () => void;
  // Top to bottom, the first the call to action and key 1.
  readonly entries: readonly PanelEntry[];
  // pauseMenuLayout, the buttons then the note, or homeQuestionLayout, the note first.
  readonly layout: typeof pauseMenuLayout;
  // No parts draws no note plate.
  readonly note: readonly PanelNotePart[];
  // Whether each sentence of a part starts a line of its own.
  readonly sentenceLines: boolean;
  readonly title: string;
}

// The panel's text measured on the bitmap fonts scene draws it in.
export function canvasPanelMeasure(scene: Scene): PanelMeasure {
  return {
    body: pixelFontMetrics(scene, "body"),
    inkWidth: (font, line) => modalTextWidth(scene, font, [line]),
    title: pixelFontMetrics(scene, "title"),
    wrapNote: (width, text) =>
      wrapPixelText(scene, { colour: PALETTE.plum, scale: NOTE_PLATE.scale }, width, text),
  };
}

// The panel's view, centred in area and measured on scene's fonts.
export function questionView(scene: Scene, area: Rect, question: QuestionPanel): QuestionPanelView {
  return questionPanelView(canvasPanelMeasure(scene), area, {
    avoid: question.avoid,
    labels: question.entries.map(({ label }) => label),
    layout: question.layout,
    note: question.note,
    sentenceLines: question.sentenceLines,
    title: question.title,
  });
}

// The pause menu's panel, and each question laid out as it is (the Home question, Quit?), drawn
// on the canvas from its view (questionPanelView). A press counts where it began and ended on
// the same button or the close control, which wins where their tap areas meet, so the release
// that closes the panel is never what is under it. Returns what a tap outside the panel must
// miss: the panel and the buttons' hit areas.
export function addQuestionPanel(scene: Scene, area: Rect, question: QuestionPanel): Rect[] {
  const { entries } = question;
  const view = questionView(scene, area, question);
  const { panel } = view;

  addRimmedPanel(scene, panel);
  addCardTitle(scene, panel, question.title, true, view.titleY);
  const closeButton = addCardClose(scene, scene.add.container(0, 0), panel, false);
  const buttons: MenuButton[] = view.buttons.map(({ primary, rect, text }) =>
    addMenuButton(scene, rect, text.text, { available: true, primary }),
  );
  if (view.notePlate !== undefined) {
    fillRect(scene.add.graphics(), PALETTE.tan, view.notePlate);
    for (const line of view.note) {
      addPixelText(scene, line.centreX, line.capTop, line.text, {
        colour: line.colour,
        originX: 0.5,
        scale: line.scale,
      });
    }
  }

  // A button by its index, or the close control.
  type Target = number | "close";
  listenTargetPress<Target>(scene, {
    onDown: (pointer) => addTapBurst(scene, pointer.x, pointer.y),
    onPressed: (pressed) => {
      buttons.forEach((button, i) => button.setPressed(i === pressed));
      closeButton.setPressed(pressed === "close");
    },
    onTap: (target) => (target === "close" ? question.close() : entries[target]?.press()),
    targetAt: (x, y) =>
      containsPoint(view.close.hit, x, y)
        ? "close"
        : rectIndexAt(
            view.buttons.map(({ hit }) => hit),
            x,
            y,
          ),
  });
  scene.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
    const number = cardNumberForKey(entries.length, event.key);
    if (number !== undefined && menuKeyActs(event.repeat, event.key)) {
      entries[number - 1]?.press();
    }
  });
  return [...view.covered];
}

// The panel in the HTML layer where the page's switch is on and its layer, web fonts and bitmap
// fonts are ready, laid out as the canvas draws it (questionPanelView): hidden while the scene is
// paused under a canvas page (help, the settings) and gone with the scene. Returns what a tap
// outside must miss, or undefined where the canvas must draw it (addQuestionPanel).
export function addHtmlQuestionPanel(
  scene: Scene,
  area: Rect,
  question: QuestionPanel,
): Rect[] | undefined {
  const layer = uiLayer();
  const body = pixelBitmapFont(scene, "body");
  const title = pixelBitmapFont(scene, "title");
  if (layer?.ready() !== true || body === undefined || title === undefined) {
    return undefined;
  }
  const view = questionView(scene, area, question);
  const panel = showQuestionPanel(layer, {
    close: question.close,
    closeLabel: gameData.menuText.pause.close,
    fonts: { body, title },
    presses: question.entries.map(({ press }) => press),
    toGame: (client) =>
      pageToGame(pageFrameTurn(), layer.element.getBoundingClientRect(), SCREEN_CONFIG, client),
    view,
  });
  onSceneEvent(scene, scene.events, Scenes.Events.PAUSE, () => panel.setShown(false));
  onSceneEvent(scene, scene.events, Scenes.Events.RESUME, () => panel.setShown(true));
  scene.events.once(Scenes.Events.SHUTDOWN, () => panel.destroy());
  return [...view.covered];
}
