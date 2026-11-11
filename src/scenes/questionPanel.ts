import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";
import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { HelpView } from "../help/helpView.ts";
import type { BadgeCardView } from "../home/badgeCardView.ts";
import type { DetailCardView } from "../home/detailCardView.ts";
import type { EndScreenView } from "../home/endScreenView.ts";
import type { LogbookView } from "../home/logbookView.ts";
import type { ConfirmChoice } from "../home/purchaseConfirm.ts";
import type { PurchaseConfirmCardView } from "../home/purchaseConfirmCardView.ts";
import type { ZoneCelebrationView } from "../hud/celebrationView.ts";
import { showBadgeCard } from "../hud/dom/badgeCard.ts";
import {
  type BadgeCelebrationView,
  showBadgeCelebration,
  showZoneCelebration,
} from "../hud/dom/celebration.ts";
import { showDetailCard } from "../hud/dom/detailCard.ts";
import { type DomEndScreen, showEndScreen } from "../hud/dom/endScreen.ts";
import { showHelpScreen } from "../hud/dom/helpScreen.ts";
import { type LogbookScroll, showLogbook } from "../hud/dom/logbook.ts";
import { showPurchaseConfirm } from "../hud/dom/purchaseConfirm.ts";
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
import { displayBitmapFont } from "../ui/phaser/displayText.ts";
import { addModalShade, fillRect } from "../ui/phaser/draw.ts";
import { addPixelText, pixelBitmapFont } from "../ui/phaser/pixelText.ts";
import { pillColours } from "./effectNameColours.ts";
import { addCardClose, addCardTitle, drawDetailCardView } from "./homePanels.ts";
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
  controls: Pick<DomQuestionPanelInput, "close" | "numberKeys" | "presses" | "shade">,
  view: QuestionPanelView,
): DomQuestionPanel {
  const panel = showQuestionPanel(place.layer, { ...controls, ...htmlPanelInput(place), view });
  return followScene(scene, controls.shade === undefined ? panel : shadeOver(panel));
}

// The question in the HTML layer, laid out as the canvas draws it (questionPanelView), over the
// HTML shade over area where shade is set. Returns what a tap outside must miss, or undefined
// where the canvas must draw it (addQuestionPanel).
export function addHtmlQuestionPanel(
  scene: Scene,
  area: Rect,
  question: QuestionPanel,
  shade = false,
): Rect[] | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const view = questionView(scene, area, question);
  const presses = question.entries.map(({ press }) => press);
  const controls = { close: question.close, numberKeys: true, presses };
  showHtmlPanel(scene, place, shade ? { ...controls, shade: area } : controls, view);
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
// explanation, which a press anywhere closes, shown pressed while closePressed. Returns it, for
// its scene to destroy as the card closes, or undefined where the canvas must draw it
// (drawDetailCard).
export function addHtmlDetailCard(
  scene: Scene,
  view: DetailCardView,
  close: (() => void) | undefined,
  closePressed = false,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showDetailCard(place.layer, { ...htmlArtInput(place), close, closePressed, view });
  return followScene(scene, panel);
}

// An HTML panel a scene that draws itself again on every change keeps while what it shows is
// the same: the panel shown for key, or undefined where the canvas draws it.
export interface KeptPanel {
  readonly key: string;
  readonly panel: DomQuestionPanel | undefined;
}

// kept while key is unchanged, else kept's panel destroyed and show's for key in its place;
// undefined, with kept's panel destroyed, where key is undefined.
export function keepPanel(
  kept: KeptPanel | undefined,
  key: string | undefined,
  show: () => DomQuestionPanel | undefined,
): KeptPanel | undefined {
  if (kept !== undefined && kept.key === key) {
    return kept;
  }
  kept?.panel?.destroy();
  return key === undefined ? undefined : { key, panel: show() };
}

// A held item's detail card over a dim layer over dim, its close control shown pressed or not,
// which a press anywhere closes: in HTML over the canvas's dim, kept while it shows the same
// (keepPanel), else on the canvas (drawDetailCardView). Returns the HTML kept.
export function addDetailCardOver(
  scene: Scene,
  parent: GameObjects.Container,
  dim: Rect,
  closePressed: boolean,
  view: DetailCardView,
  kept: KeptPanel | undefined,
): KeptPanel | undefined {
  const html = keepPanel(kept, JSON.stringify([view, closePressed]), () =>
    addHtmlDetailCard(scene, view, undefined, closePressed),
  );
  if (html?.panel === undefined) {
    drawDetailCardView(scene, parent, dim, closePressed, view);
  } else {
    parent.add(addModalShade(scene, dim));
  }
  return html;
}

// The purchase confirm in the HTML layer, laid out as the canvas draws it
// (purchaseConfirmCardView), each answer and the close control, which cancels, doing answer.
// Returns it, for its scene to destroy as the confirm closes, or undefined where the canvas must
// draw it (drawPurchaseConfirm).
export function addHtmlPurchaseConfirm(
  scene: Scene,
  view: PurchaseConfirmCardView,
  answer: (choice: ConfirmChoice) => void,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showPurchaseConfirm(place.layer, {
    ...htmlArtInput(place),
    buy: () => answer("buy"),
    cancel: () => answer("cancel"),
    view,
  });
  return followScene(scene, panel);
}

// Calls step before every frame scene's game draws, until the returned stop is called.
function everyFrame(scene: Scene): (step: () => void) => () => void {
  return (step) => {
    scene.game.events.on(Core.Events.PRE_RENDER, step);
    return () => scene.game.events.off(Core.Events.PRE_RENDER, step);
  };
}

// The Logbook in the HTML layer, laid out as the canvas draws it (logbookView), following the
// scroll before every frame. It takes no presses. Returns it, for its scene to replace as what it
// shows changes, or undefined where the canvas must draw it.
export function addHtmlLogbook(
  scene: Scene,
  view: LogbookView,
  scroll: () => LogbookScroll,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showLogbook(place.layer, {
    ...htmlArtInput(place),
    everyFrame: everyFrame(scene),
    scroll,
    view,
  });
  return followScene(scene, panel);
}

// A badge's card in the HTML layer, laid out as the canvas draws it (badgeCardView), over the
// HTML shade, its confetti played by scene's clock. It takes no presses: its scene closes it.
// Returns it, for its scene to destroy as the card closes, or undefined where the canvas must
// draw it (drawBadgeCard).
export function addHtmlBadgeCard(scene: Scene, view: BadgeCardView): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showBadgeCard(place.layer, {
    ...htmlArtInput(place),
    everyFrame: everyFrame(scene),
    now: () => scene.time.now,
    view,
  });
  return followScene(scene, panel);
}

// What a celebration's HTML draws with beyond a panel's: art files, sheets and pill colours.
function htmlArtInput(place: NonNullable<ReturnType<typeof htmlPanelPlace>>) {
  return {
    ...htmlPanelInput(place),
    artUrl,
    loadSheet,
    pillColours: (index: number) => {
      const kind = pillKind(index);
      return kind === undefined ? undefined : pillColours(kind);
    },
  };
}

// A zone celebration's plate or bubble in the HTML layer, laid out as the canvas draws it
// (zoneCelebrationView), its button doing press, the dialog named label. Returns it, or
// undefined where the canvas must draw it.
export function addHtmlZoneCelebration(
  scene: Scene,
  view: ZoneCelebrationView,
  label: string,
  press: () => void,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showZoneCelebration(place.layer, { ...htmlArtInput(place), label, press, view });
  return dimUnderPause(scene, followScene(scene, panel));
}

// HTML a scene draws that the pause menu's shade dims while it pauses the scene: shown under the
// menu, taking no presses or focus, and hidden while help or the settings cover the menu.
export interface Dimmable {
  focusControl?: (index: number | undefined) => void;
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
}

// HTML paused under the pause menu, which its shade dims while it shows.
const dimmedUnder = new Set<Dimmable>();

// html, which the pause menu's shade dims while it pauses scene, in place of hiding it, until it
// is destroyed.
export function dimUnderPause<P extends Dimmable & { destroy(): void }>(scene: Scene, html: P): P {
  const pause = () => dimmedUnder.add(html);
  // As the scene resumes it takes presses and focus again.
  const resume = () => {
    if (dimmedUnder.delete(html)) {
      html.setInert(false);
      html.setShown(true);
      html.focusControl?.(undefined);
    }
  };
  const stop = () => {
    scene.events.off(Scenes.Events.PAUSE, pause);
    scene.events.off(Scenes.Events.RESUME, resume);
    scene.events.off(Scenes.Events.SHUTDOWN, stop);
    dimmedUnder.delete(html);
  };
  scene.events.on(Scenes.Events.PAUSE, pause);
  scene.events.on(Scenes.Events.RESUME, resume);
  // The scene's shutdown destroys html itself.
  scene.events.once(Scenes.Events.SHUTDOWN, stop);
  return {
    ...html,
    destroy: () => {
      stop();
      html.destroy();
    },
  };
}

// Whether HTML lies under the pause menu that its shade must dim: a paused celebration's, where
// the menu draws in HTML.
export function pauseShadesHtml(scene: Scene): boolean {
  return dimmedUnder.size > 0 && htmlPanelPlace(scene) !== undefined;
}

// The pause menu's HTML panel, over the HTML shade where it dims the panels paused under it
// (pauseShadesHtml), which show under it while it shows and hide while it hides.
function shadeOver(panel: DomQuestionPanel): DomQuestionPanel {
  const dim = (shown: boolean) => {
    for (const under of dimmedUnder) {
      under.setInert(true);
      under.setShown(shown);
    }
  };
  dim(true);
  return {
    ...panel,
    destroy: () => {
      dim(false);
      panel.destroy();
    },
    setShown: (shown) => {
      dim(shown);
      panel.setShown(shown);
    },
  };
}

// A badge celebration's title, names, close control and button in the HTML layer over the panel
// the canvas draws, each control doing close. Returns it, or undefined where the canvas must
// draw them.
export function addHtmlBadgeCelebration(
  scene: Scene,
  view: BadgeCelebrationView,
  close: () => void,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  return place === undefined
    ? undefined
    : followScene(
        scene,
        showBadgeCelebration(place.layer, { ...htmlArtInput(place), close, view }),
      );
}

// The End screen's text, pips, bubbles and Back to title in the HTML layer, laid out as the
// canvas draws them (endScreenView), over the parts the canvas keeps; it takes no presses.
// Returns it, for its scene to show Back to title pressed or bobbing, or undefined where the
// canvas must draw them, as while the display lettering's font is missing.
export function addHtmlEndScreen(scene: Scene, view: EndScreenView): DomEndScreen | undefined {
  const place = htmlPanelPlace(scene);
  const display = displayBitmapFont(scene);
  if (place === undefined || display === undefined) {
    return undefined;
  }
  return followScene(scene, showEndScreen(place.layer, { ...htmlArtInput(place), display, view }));
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
