import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";
import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { HelpView } from "../help/helpView.ts";
import type { DetailCardView } from "../home/detailCardView.ts";
import { showDetailCard } from "../hud/dom/detailCard.ts";
import { showHelpScreen } from "../hud/dom/helpScreen.ts";
import {
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "../hud/dom/questionPanel.ts";
import { pillKind } from "../hud/effectNames.ts";
import type { pauseMenuLayout } from "../hud/pauseMenu.ts";
import {
  type CardAction,
  modalCardView,
  type PanelNotePart,
  type QuestionPanelView,
  questionPanelView,
} from "../hud/questionPanelView.ts";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings.ts";
import { pageFrameTurn } from "../pwa/index.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { PALETTE } from "../ui/palette.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import { addPixelText, pixelBitmapFont } from "../ui/phaser/pixelText.ts";
import { pillColours } from "./effectNameColours.ts";
import { addCardClose, addCardTitle } from "./homePanels.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
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

// The HTML layer and the bitmap fonts that lay out its web fonts' text, where the page's switch
// is on and both are ready, else undefined: the canvas draws the panel.
export function htmlPanelPlace(scene: Scene) {
  const layer = uiLayer();
  const body = pixelBitmapFont(scene, "body");
  const title = pixelBitmapFont(scene, "title");
  return layer?.ready() !== true || body === undefined || title === undefined
    ? undefined
    : { fonts: { body, title }, layer };
}

// What every HTML panel in place is given: the shared close label, the fonts and the page point
// of a press as a game point, through the page frame's turn.
export function htmlPanelInput(place: NonNullable<ReturnType<typeof htmlPanelPlace>>) {
  const { layer } = place;
  return {
    closeLabel: gameData.menuText.common.close,
    fonts: place.fonts,
    toGame: (client: Point) =>
      pageToGame(pageFrameTurn(), layer.element.getBoundingClientRect(), SCREEN_CONFIG, client),
  };
}

// panel, hidden while the scene is paused or asleep under a canvas page (help, the settings)
// and gone with the scene, or by destroy, which stops it following the scene.
export function followScene<P extends Pick<DomQuestionPanel, "destroy" | "setShown">>(
  scene: Scene,
  panel: P,
): P {
  const listeners = [
    [Scenes.Events.PAUSE, () => panel.setShown(false)],
    [Scenes.Events.RESUME, () => panel.setShown(true)],
    [Scenes.Events.SLEEP, () => panel.setShown(false)],
    [Scenes.Events.WAKE, () => panel.setShown(true)],
  ] as const;
  const destroy = () => {
    for (const [type, listener] of listeners) {
      scene.events.off(type, listener);
    }
    scene.events.off(Scenes.Events.SHUTDOWN, destroy);
    panel.destroy();
  };
  for (const [type, listener] of listeners) {
    scene.events.on(type, listener);
  }
  scene.events.once(Scenes.Events.SHUTDOWN, destroy);
  return { ...panel, destroy };
}

// A panel's view in the HTML layer, following its scene (followScene).
function showHtmlPanel(
  scene: Scene,
  place: NonNullable<ReturnType<typeof htmlPanelPlace>>,
  controls: Pick<DomQuestionPanelInput, "close" | "numberKeys" | "presses">,
  view: QuestionPanelView,
): DomQuestionPanel {
  const panel = showQuestionPanel(place.layer, { ...controls, ...htmlPanelInput(place), view });
  return followScene(scene, panel);
}

// The question in the HTML layer, laid out as the canvas draws it (questionPanelView). Returns
// what a tap outside must miss, or undefined where the canvas must draw it (addQuestionPanel).
export function addHtmlQuestionPanel(
  scene: Scene,
  area: Rect,
  question: QuestionPanel,
): Rect[] | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const view = questionView(scene, area, question);
  const presses = question.entries.map(({ press }) => press);
  showHtmlPanel(scene, place, { close: question.close, numberKeys: true, presses }, view);
  return [...view.covered];
}

// A modal card's button and what a press on it does.
export interface CardEntry extends CardAction {
  readonly press: () => void;
}

// A modal card in the HTML layer over card, laid out as the canvas draws it (modalCardView): its
// title, its close control doing close, and its buttons, which number keys never press. Returns
// it, for its scene to destroy as the card closes, or undefined where the canvas must draw it.
export function addHtmlModalCard(
  scene: Scene,
  card: Rect,
  title: string,
  entries: readonly CardEntry[],
  close: () => void,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const view = modalCardView(canvasPanelMeasure(scene), card, title, entries);
  const presses = entries.map(({ press }) => press);
  return showHtmlPanel(scene, place, { close, numberKeys: false, presses }, view);
}

// A detail card in the HTML layer, laid out as the canvas draws it (detailCardView), its close
// control doing close, or a picture of one on a card that takes no presses, as the walk's
// explanation, which a press anywhere closes. Returns it, for its scene to destroy as the card
// closes, or undefined where the canvas must draw it (drawDetailCard).
export function addHtmlDetailCard(
  scene: Scene,
  view: DetailCardView,
  close: (() => void) | undefined,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showDetailCard(place.layer, {
    ...htmlPanelInput(place),
    artUrl,
    close,
    loadSheet,
    pillColours: (index) => {
      const kind = pillKind(index);
      return kind === undefined ? undefined : pillColours(kind);
    },
    view,
  });
  return followScene(scene, panel);
}

// The help screen in the HTML layer, laid out as the canvas draws it (helpView), over the dark
// screen and the page's picture the canvas keeps; it takes no presses. Returns it, for its scene
// to replace as the page or a pressed control changes, or undefined where the canvas must draw
// it.
export function addHtmlHelpScreen(scene: Scene, view: HelpView): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  return followScene(scene, showHelpScreen(place.layer, { ...htmlPanelInput(place), view }));
}
