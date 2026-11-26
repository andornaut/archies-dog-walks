import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { pageToGame } from "@andornaut/game-kit/runtime/view/pagePoint";
import { Core, type Scene, Scenes } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import { gameData, SCREEN_CONFIG } from "../data/index.ts";
import type { HelpView } from "../help/index.ts";
import type { BadgeCardView, DetailCardView, EndScreenView } from "../home/index.ts";
import {
  type DomEndScreen,
  type DomEndScreenInput,
  type DomHelpInput,
  showBadgeCard,
  showDetailCard,
  showEndScreen,
  showHelpScreen,
  showQuestionPanel,
} from "../hud/dom/index.ts";
import { questionPanelView } from "../hud/index.ts";
import { pillKind } from "../presentation/index.ts";
import { pageFrameTurn } from "../pwa/index.ts";
import {
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  loadSheet,
  uiLayer,
} from "../ui/dom/index.ts";
import {
  type CardAction,
  modalCardView,
  type PanelNotePart,
  type QuestionPanelView,
} from "../ui/index.ts";
import { displayBitmapFont, hasDisplayFont, pixelBitmapFont } from "../ui/phaser/index.ts";
import { pillColours } from "./effectNameColours.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { nativeModalShade } from "./nativeModalShade.ts";
import { trackNativeSceneInput } from "./overlay.ts";

// A button on the panel: its label and what a press, a tap or its number key, does.
export interface PanelEntry {
  // Supplies the exact admitted source control before its action opens a modal.
  readonly onInvoke?: (control: HTMLElement) => void;
  readonly label: string;
  readonly press: () => void;
}

export interface QuestionPanel {
  readonly avoid?: Rect;
  readonly backgroundCancel?: () => void;
  // What the close control in the panel's top-right corner does, as a tap outside the panel does.
  readonly close: () => void;
  // Source callback and digit order; placement moves the existing primary last.
  readonly entries: readonly PanelEntry[];
  // No parts draws no note plate.
  readonly note: readonly PanelNotePart[];
  readonly panelWidth?: number;
  readonly primary?: "first" | "last";
  readonly numberPresses?: readonly (() => void)[];
  // Whether each sentence of a part starts a line of its own.
  readonly sentenceLines: boolean;
  readonly showKeyNumbers?: boolean;
  readonly title: string;
}

// The panel's view, centred in area and measured on scene's fonts.
export function questionView(scene: Scene, area: Rect, question: QuestionPanel): QuestionPanelView {
  return questionPanelView(canvasPanelMeasure(scene), area, {
    avoid: question.avoid,
    labels: question.entries.map(({ label }) => label),
    note: question.note,
    ...(question.panelWidth === undefined ? {} : { panelWidth: question.panelWidth }),
    ...(question.primary === undefined ? {} : { primary: question.primary }),
    sentenceLines: question.sentenceLines,
    ...(question.showKeyNumbers === undefined ? {} : { showKeyNumbers: question.showKeyNumbers }),
    title: question.title,
  });
}

// Native views mount only when the shared layer and the scene's bitmap font metrics are ready.
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
    closeLabel: gameData.menuText.common,
    fonts: place.fonts,
    toGame: (client: Point) =>
      pageToGame(pageFrameTurn(), layer.element.getBoundingClientRect(), SCREEN_CONFIG, client),
  };
}

// Native panels follow scene visibility while inactive scenes retain dimmed, inert content.
export function followScene<
  P extends Pick<
    DomQuestionPanel,
    "accepts" | "capture" | "destroy" | "setShown" | "setEnabled" | "setInert" | "setDimmed"
  >,
>(scene: Scene, panel: P): P {
  const stopInput = trackNativeSceneInput(scene, panel);
  let active: boolean | undefined;
  const sync = () => {
    const next = scene.sys.isActive();
    if (next !== active) {
      active = next;
      panel.setDimmed(!next);
      panel.setInert(!next);
    }
    panel.setEnabled(next && scene.input.enabled);
    panel.setShown(scene.sys.isVisible());
  };
  const events = [
    Scenes.Events.PAUSE,
    Scenes.Events.RESUME,
    Scenes.Events.SLEEP,
    Scenes.Events.WAKE,
  ] as const;
  const destroy = () => {
    for (const event of events) {
      scene.events.off(event, sync);
    }
    scene.events.off(Scenes.Events.SHUTDOWN, destroy);
    scene.game.events.off(Core.Events.PRE_RENDER, sync);
    stopInput();
    panel.destroy();
  };
  for (const event of events) {
    scene.events.on(event, sync);
  }
  scene.events.once(Scenes.Events.SHUTDOWN, destroy);
  scene.game.events.on(Core.Events.PRE_RENDER, sync);
  sync();
  return { ...panel, destroy };
}

// A panel's view in the HTML layer, following its scene (followScene).
function showHtmlPanel(
  scene: Scene,
  place: NonNullable<ReturnType<typeof htmlPanelPlace>>,
  controls: Pick<
    DomQuestionPanelInput,
    "backgroundCancel" | "close" | "onInvoke" | "numberKeys" | "numberPresses" | "presses"
  >,
  view: QuestionPanelView,
): DomQuestionPanel {
  const panel = showQuestionPanel(place.layer, { ...controls, ...htmlPanelInput(place), view });
  return followScene(scene, panel);
}

// The native question panel retains its view, actions and caller-owned outside-tap regions.
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
  const controls = {
    ...(question.backgroundCancel === undefined
      ? {}
      : { backgroundCancel: question.backgroundCancel }),
    close: question.close,
    numberKeys: true,
    onInvoke: (index: number, control: HTMLElement) => question.entries[index]?.onInvoke?.(control),
    presses,
    ...(question.numberPresses === undefined ? {} : { numberPresses: question.numberPresses }),
  };
  showHtmlPanel(scene, place, controls, view);
  return [...view.covered];
}

// A modal card's button and what a press on it does.
export interface CardEntry extends CardAction {
  readonly press: () => void;
}

// A native modal card with caller-owned actions; undefined while its resources are pending.
export function addHtmlModalCard(
  scene: Scene,
  card: Rect,
  title: string,
  entries: readonly CardEntry[],
  close: () => void,
  backgroundCancel?: () => void,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const measure = canvasPanelMeasure(scene);
  const view = modalCardView(measure, card, title, entries);
  const presses = entries.map(({ press }) => press);
  const panel = showQuestionPanel(place.layer, {
    ...(backgroundCancel === undefined ? {} : { backgroundCancel }),
    close,
    numberKeys: false,
    presses,

    ...htmlPanelInput(place),
    view,
  });
  return followScene(scene, panel);
}

// Native detail content shares the modal palette and close semantics. dismiss is what a tap on the
// card's body or anywhere outside it does.
export function addHtmlDetailCard(
  scene: Scene,
  layout: () => DetailCardView,
  close: (() => void) | undefined,
  dismiss?: () => void,
  presses?: readonly (() => void)[],
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const mount = (view: DetailCardView) =>
    showDetailCard(place.layer, {
      ...htmlArtInput(place),
      ...(close === undefined ? {} : { close }),
      ...(dismiss === undefined ? {} : { backgroundCancel: dismiss, dismiss }),
      ...(presses === undefined ? {} : { presses }),
      view,
    });
  let view = layout();
  let panel = mount(view);
  let needsLayout = false;
  let pendingFocus: number | undefined;
  const stopScale = place.layer.onScale(() => {
    needsLayout = true;
  });
  const handle: DomQuestionPanel = {
    accepts: () => panel.accepts(),
    burst: (at) => panel.burst(at),
    capture: () => panel.capture(),
    destroy() {
      stopScale();
      panel.destroy();
    },
    get element() {
      return panel.element;
    },
    focusControl: (index) => panel.focusControl(index),
    refuse: (index, reducedMotion) => panel.refuse(index, reducedMotion),
    setActionShown: (index, shown) => panel.setActionShown(index, shown),
    setDimmed: (dimmed) => panel.setDimmed(dimmed),
    setEnabled(enabled) {
      panel.setEnabled(enabled);
      if (!enabled || !panel.accepts()) {
        return;
      }
      if (needsLayout) {
        needsLayout = false;
        const next = layout();
        if (JSON.stringify(view) !== JSON.stringify(next)) {
          const buttons = [...panel.element.querySelectorAll("button")];
          pendingFocus = buttons.indexOf(
            panel.element.ownerDocument.activeElement as HTMLButtonElement,
          );
          panel.destroy();
          view = next;
          panel = mount(next);
        }
      }
      if (pendingFocus !== undefined && panel.accepts()) {
        panel.focusControl(pendingFocus < 0 ? undefined : pendingFocus);
        pendingFocus = undefined;
      }
    },
    setInert: (inert) => panel.setInert(inert),
    setShown: (shown) => panel.setShown(shown),
  };
  return followScene(scene, nativeModalShade(scene, handle));
}

// A native panel is retained while its presentation key is unchanged.
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

// Calls step before every frame scene's game draws, until the returned stop is called.
function everyFrame(scene: Scene): (step: () => void) => () => void {
  return (step) => {
    scene.game.events.on(Core.Events.PRE_RENDER, step);
    return () => scene.game.events.off(Core.Events.PRE_RENDER, step);
  };
}

// Native badge detail retains its view; dismiss is what its close control, a tap on its body and a
// tap anywhere outside it do.
export function addHtmlBadgeCard(
  scene: Scene,
  view: BadgeCardView,
  dismiss?: () => void,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const panel = showBadgeCard(place.layer, {
    ...htmlArtInput(place),
    ...(dismiss === undefined ? {} : { dismiss }),
    everyFrame: everyFrame(scene),
    now: () => scene.time.now,
    view,
  });
  return followScene(scene, nativeModalShade(scene, panel));
}

// What a celebration's HTML draws with beyond a panel's: art files, sheets and pill colours.
export function htmlArtInput(place: NonNullable<ReturnType<typeof htmlPanelPlace>>) {
  return {
    ...htmlPanelInput(place),
    artUrl: domArtUrl,
    loadSheet,
    pillColours: (index: number) => {
      const kind = pillKind(index);
      return kind === undefined ? undefined : pillColours(kind);
    },
  };
}

// Native End results use the scene's fonts, assets, clock and action ownership.
export function addHtmlEndScreen(
  scene: Scene,
  actions: Pick<
    DomEndScreenInput,
    "badges" | "gesture" | "home" | "openBadge" | "reduced" | "ribbon"
  >,
  view: EndScreenView,
): DomEndScreen | undefined {
  const place = htmlPanelPlace(scene);
  const display = hasDisplayFont(scene, view.results.title.text)
    ? displayBitmapFont(scene)
    : undefined;
  if (place === undefined) {
    return undefined;
  }
  return followScene(
    scene,
    showEndScreen(place.layer, {
      ...htmlArtInput(place),
      ...actions,
      display,
      everyFrame: everyFrame(scene),
      now: () => scene.time.now,
      view,
    }),
  );
}

// Native Help controls retain the scene's paging and gesture rules.
export function addHtmlHelpScreen(
  scene: Scene,
  actions: Pick<DomHelpInput, "footerPress" | "gesture" | "presses" | "reducedMotion">,
  view: HelpView,
): DomQuestionPanel | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  return followScene(
    scene,
    showHelpScreen(place.layer, { ...htmlPanelInput(place), ...actions, view }),
  );
}
