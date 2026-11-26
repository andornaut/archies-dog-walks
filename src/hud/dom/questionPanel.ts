import { fillLine } from "@andornaut/game-kit/runtime/lines";
import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { BUTTON_SIZE, type GameData, SCREEN_CONFIG } from "../../data/index.ts";
import { MENU_TEXT_FIELDS } from "../../home/index.ts";
import { cardNumberForKey, isConfirmKey, menuKeyActs } from "../../input/index.ts";
import {
  bindGameAction,
  createControlGlyph,
  createGameButton,
  createTextLine,
  type DomPart,
  type DomTextLine,
  mountModalLifecycle,
  type NativeGesture,
  panelFramePart,
  placeBackedText,
  placeBox,
  placeFrame,
  placeText,
  refuse,
  setBox,
  setRampDimmed,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  closeFace,
  deviceX,
  deviceY,
  type DomScale,
  frameRect,
  gridTransform,
  gridX,
  gridY,
  MODAL,
  type PanelText,
  type QuestionPanelView,
  wholeArtPixels,
} from "../../ui/index.ts";
import { bindPanelFeedback, createPanelButton } from "./panelButton.ts";
import { createQuestionCardFrame } from "./questionCardFrame.ts";

// The pause menu, each question (the Home question, Quit?) and each modal card (the update
// notices) in HTML over the canvas: the panel questionPanelView or modalCardView lays out, drawn
// in the #ui layer at the places the canvas would draw it, as a dialog. A press on its parts is
// its own (Phaser never hears it). A modal panel's backdrop takes every other press in the game
// frame, the top bar's included: it calls backgroundCancel where the panel is closeable and
// otherwise does nothing. Number keys press a question's buttons, Tab and Shift+Tab keep focus
// among its buttons and close control, and Enter or Space presses the focused one.

// The close control's accessible names: close, or closeTitled filled with the panel's title.
export type CloseLabel = Pick<GameData["menuText"]["common"], "close" | "closeTitled">;

// The close control's accessible name: close, or, where another of the panel's buttons is also
// named close (a footer Close), closeTitled filled with the panel's title, so no two of the
// dialog's controls share a name.
export function closeName(
  words: CloseLabel,
  buttonLabels: readonly string[],
  title: string,
): string {
  return buttonLabels.includes(words.close)
    ? fillLine(MENU_TEXT_FIELDS.common, words, "closeTitled", { title })
    : words.close;
}

export interface DomQuestionPanelInput {
  // Base screens opt out of modal ownership; pictures can remain modal without native buttons.
  readonly modal?: boolean;
  // Outside dismissal when there is no interactive X. An interactive X always supplies the
  // backdrop's action too. Required choices without either callback consume the tap.
  readonly backgroundCancel?: () => void;
  // The page's own controls drawn outside the panel, interactive with it.
  readonly companions?: readonly HTMLElement[];
  // What the close control does; null draws no close control, and a panel with no buttons then
  // takes no presses: every press goes through to the canvas. Then its accessible names
  // (closeName), and what each button does, in order.
  readonly close: (() => void) | null;
  readonly closeLabel: CloseLabel;
  // A footer can dismiss a native overlay that intentionally has no corner close control.
  readonly footerPress?: () => void;
  // Gives the caller its exact source control after admission and before activation.
  readonly onInvoke?: (index: number, control: HTMLElement) => void;
  // The id of the part that describes the panel, if any.
  readonly describedBy?: string;
  // Told the index (focusControl's) of the control focus moves to, or undefined for the dialog.
  readonly onFocus?: (index: number | undefined) => void;
  // The dialog's name where the canvas draws its title (view.title empty), as over a
  // celebration.
  readonly label?: string;
  readonly fonts: Readonly<Record<PanelText["font"], BitmapFont>>;
  readonly gesture?: NativeGesture;
  readonly onPaint?: () => void;
  // Whether keys 1 to n press the buttons, as on the pause menu and the questions.
  readonly numberKeys: boolean;
  readonly numberPresses?: readonly (() => void)[];
  // Drawn over the frame, under the title, and read after the title.
  readonly parts?: readonly DomPart[];
  readonly presses: readonly (() => void)[];
  // A tap on the panel's own body, away from its controls, as a detail card's dismissal.
  readonly dismiss?: () => void;
  // The page point of a press as a game point, through the page frame's turn.
  readonly toGame: (client: Point) => Point;
  readonly view: QuestionPanelView;
}

export interface DomQuestionPanel {
  readonly element: HTMLElement;
  setActionShown(index: number, shown: boolean): void;
  accepts(): boolean;
  capture(): () => boolean;
  setEnabled(enabled: boolean): void;
  // A tap burst at a game point, over the panel.
  burst(at: Point): void;
  destroy(): void;
  // Focuses the parts' controls, then the buttons, then the close control, by index, or the
  // dialog itself for undefined, as the scene's own focus moves.
  focusControl(index: number | undefined): void;
  // Plays the refusal cue (refusal.ts) on the index-th button.
  refuse(index: number, reducedMotion: boolean): void;
  // Darkens this covered panel once while preserving its original colours and assets.
  setDimmed(dimmed: boolean): void;
  // Lets the panel take no presses and no focus while another's dim covers it (a celebration
  // under the pause menu), and take them again.
  setInert(inert: boolean): void;
  // Hides the panel while a canvas page covers it (help, the settings), and shows it again.
  setShown(shown: boolean): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// art: fx-tap's side.
const BURST_SIDE = 16;

// fx-tap's burst over every panel (burstHost), centred on a game point where a press landed.
export function addTapBurst(layer: UiLayer, at: Point): void {
  const element = layer.element.ownerDocument.createElement("span");
  element.className = "adw-burst";
  const scale = layer.scale();
  const side = BURST_SIDE * artPixel(scale);
  setBox(element, {
    height: side,
    left: deviceX(scale, at.x) - side / 2,
    top: deviceY(scale, at.y) - side / 2,
    width: side,
  });
  element.style.setProperty("--adw-burst", `${side}px`);
  element.addEventListener("animationend", () => element.remove());
  burstHost(layer, scale).append(element);
}

// Ids that tie each panel's dialog to its title and note.
let panels = 0;

// Each layer's root for tap bursts: over every panel, laid out in device pixels as a panel is,
// so a burst plays on while a panel under it is drawn again, as the canvas's burst scene does.
const burstHosts = new WeakMap<HTMLElement, HTMLElement>();

function burstHost(layer: UiLayer, scale: DomScale): HTMLElement {
  let host = burstHosts.get(layer.element);
  if (host === undefined) {
    host = layer.element.ownerDocument.createElement("div");
    host.className = "adw-dialog adw-passive adw-bursts";
    host.setAttribute("aria-hidden", "true");
    burstHosts.set(layer.element, host);
  }
  host.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
  host.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
  host.style.transform = gridTransform(scale);
  // Last, so over every panel.
  layer.element.append(host);
  return host;
}

// The panel in layer, shown and its dialog focused.
export function showQuestionPanel(layer: UiLayer, input: DomQuestionPanelInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  const accepts = () => lifecycle.accepts();
  panels += 1;
  const id = `adw-panel-${panels}`;
  const { view } = input;
  const modal = input.modal !== false;
  const titleName = input.label ?? view.title.map((line) => line.text).join(" ");
  const nativeCard =
    view.frame === "card"
      ? createQuestionCardFrame(doc, {
          actionHits: [...view.buttons, ...(view.footer === undefined ? [] : [view.footer])].map(
            ({ hit }) => hit,
          ),
          id,
          panel: view.panel,
          title: titleName,
          titleLines: view.title,
        })
      : undefined;
  const dialog = nativeCard?.element ?? doc.createElement("div");
  // Parts with native controls participate independently of modal ownership.
  const passive =
    input.dismiss === undefined &&
    input.footerPress === undefined &&
    input.close === null &&
    input.presses.length === 0 &&
    !(input.parts ?? []).some((part) => (part.controls?.length ?? 0) > 0);
  dialog.classList.add("adw-dialog");
  dialog.classList.toggle("adw-passive", passive);
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", String(modal));
  // Focus starts on the dialog itself, so no button shows the keyboard's ring until Tab.
  dialog.tabIndex = -1;

  // A question's ui-panel in its rim, or a modal card's ui-detail-card.
  const rim = doc.createElement("div");
  rim.className = "adw-rim";
  const panel =
    nativeCard === undefined
      ? panelFramePart(doc, view.frame === "card" ? "card" : "panel", view.panel)
      : undefined;
  if (view.frame === "panel") {
    dialog.append(rim, panel!.element);
  }

  // The parts drawn at game pixels, placed again as the scale changes.
  const placed: ((scale: DomScale) => void)[] = [];
  const box = (element: HTMLElement, origin: Point, rect: Rect) =>
    placed.push((scale) => placeBox(scale, origin, element, rect));
  // A nine-slice frame, whole art pixels wide and tall.
  const frame = (element: HTMLElement, origin: Point, rect: Rect) =>
    placed.push((scale) => placeFrame(scale, origin, element, rect));
  const text = (parent: HTMLElement, origin: Point, line: DomTextLine & PanelText) => {
    const element = createTextLine(doc, line);
    parent.append(element);
    placed.push((scale) => placeText(input.fonts[line.font], scale, origin, element, line));
    return element;
  };
  const paintedPanel = (scale: DomScale) => {
    const box = frameRect(scale, view.panel);
    const rim = view.frame === "panel" ? artPixel(scale) : 0;
    return {
      height: box.height + 2 * rim,
      left: box.left - rim,
      top: box.top - rim,
      width: box.width + 2 * rim,
    };
  };
  // The screen's root in device pixels on the device grid, and the rim one art pixel round the
  // panel.
  placed.push((scale) => {
    dialog.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
    dialog.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
    dialog.style.transform = gridTransform(scale);
    setBox(rim, paintedPanel(scale));
  });
  if (nativeCard === undefined) {
    placed.push(panel!.place);
  } else {
    placed.push((scale) =>
      nativeCard.place(
        scale,
        close === undefined ? undefined : { element: close, hit: view.close.hit },
      ),
    );
  }

  // The title, its lines in capitals; a screen reader reads its words as written. It comes first,
  // so the dialog reads in the order it shows: the title, the body, then the actions. It paints
  // over the parts (adw-panel-title), which lie under it.
  const title = nativeCard?.title ?? doc.createElement("h2");
  if (nativeCard === undefined) {
    title.className = "adw-lines adw-panel-title";
    title.id = `${id}-title`;
    dialog.append(title);
  }
  title.setAttribute("aria-label", titleName);
  for (const line of view.title) {
    text(nativeCard?.titleLines ?? title, ORIGIN, line).setAttribute("aria-hidden", "true");
  }
  dialog.setAttribute("aria-labelledby", title.id);

  const body = nativeCard?.body ?? dialog;
  for (const part of input.parts ?? []) {
    body.append(part.element);
    placed.push(part.place);
  }
  if (input.describedBy !== undefined) {
    dialog.setAttribute("aria-describedby", input.describedBy);
  }

  if (view.notePlate !== undefined) {
    const backing = view.notePlate;
    const plate = doc.createElement("div");
    plate.className = "adw-plate";
    frame(plate, ORIGIN, view.notePlate);
    const note = doc.createElement("p");
    note.className = "adw-lines";
    note.id = `${id}-note`;
    // Each line ends in a space, so a screen reader reads the lines as running text.
    const lines = view.note.map((line) => {
      const element = createTextLine(doc, line);
      note.append(element);
      element.textContent = `${element.textContent ?? ""} `;
      return { element, line };
    });
    placed.push((scale) => placeBackedText(input.fonts.body, scale, ORIGIN, backing, lines));
    dialog.setAttribute("aria-describedby", note.id);
    body.append(plate, note);
  }

  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));
  const actions = view.buttons.map((button, visualIndex) => {
    const index = button.actionIndex ?? visualIndex;
    return { button, index, press: input.presses[index] };
  });
  if (view.footer !== undefined) {
    actions.push({
      button: view.footer,
      index: -1,
      press: input.footerPress ?? input.close ?? undefined,
    });
  }
  actions.sort((a, b) => a.button.rect.y - b.button.rect.y || a.button.rect.x - b.button.rect.x);
  const sourceButtons = new Map<number, HTMLElement>();
  const disposeButtons: (() => void)[] = [];
  const buttons = actions.map(({ button, index, press }) => {
    const part = createPanelButton(
      doc,
      {
        fonts: input.fonts,
        press: {
          accepts,
          burst,
          press: () => {
            if (!accepts()) {
              return;
            }
            if (part.element.isConnected && !part.element.hidden) {
              input.onInvoke?.(index, part.element);
            }
            press?.();
          },
        },
      },
      button,
    );
    const number = input.numberPresses === undefined ? index : input.numberPresses.indexOf(press!);
    if (!passive && input.numberKeys && number >= 0) {
      part.element.setAttribute("aria-keyshortcuts", String(number + 1));
    }
    placed.push(part.place);
    disposeButtons.push(part.dispose);
    sourceButtons.set(index, part.element);
    return part.element;
  });

  // The close control, pressing press, placed at view.close.
  const closeControlElement = (press: () => void): HTMLElement => {
    const glyph = doc.createElement("span");
    glyph.className = "adw-close-glyph";
    const icon = createControlGlyph(doc, "close");
    Object.assign(icon.style, { height: "100%", width: "100%" });
    glyph.append(icon);
    const closeView = createGameButton(doc, {
      appearance: {
        className: "adw-close",
        face: { className: "adw-close-face" },
        role: "navigation",
      },
      content: {
        icon: glyph,
        kind: "icon",
        name: closeName(
          input.closeLabel,
          actions.map(({ button }) => button.label),
          titleName,
        ),
      },
      getAction: () => (accepts() ? { activate: press } : null),
    });
    const closeArt = closeFace(view.close);
    const { element, face } = closeView;
    if (nativeCard === undefined) {
      box(element, ORIGIN, view.close.hit);
    }
    // The face and its glyph in whole art pixels, from the face's corner on the art-pixel
    // grid.
    placed.push((scale) => {
      const pixel = artPixel(scale);
      const panelBounds = paintedPanel(scale);
      const inset = wholeArtPixels(scale, MODAL.closeInset * scale.unit * scale.dpr);
      const side = closeArt.width * pixel;
      const left =
        panelBounds.left + panelBounds.width - inset - side - gridX(scale, view.close.hit.x);
      const top = panelBounds.top + inset - gridY(scale, view.close.hit.y);
      setBox(face, { height: side, left, top, width: side });
      // The close control's glyph on its ui-icon-button-normal face.
      const glyphSide = BUTTON_SIZE.icon.glyph * pixel;
      // Native content starts inside the persistent one-art-pixel face border.
      const glyphInset = (side - glyphSide) / 2 - pixel;
      setBox(glyph, { height: glyphSide, left: glyphInset, top: glyphInset, width: glyphSide });
    });
    const stopFeedback = bindPanelFeedback(closeView, { accepts, burst });
    disposeButtons.push(() => {
      stopFeedback();
      closeView.dispose();
    });
    return element;
  };
  // The close control after the buttons, so it is on top where their press areas meet.
  const close = input.close === null ? undefined : closeControlElement(input.close);
  (nativeCard?.actions ?? dialog).append(...buttons);
  if (close !== undefined && nativeCard === undefined) {
    dialog.append(close);
  }

  // Phaser handles a press on the page outside its canvas as its own; a press here is the menu's.
  for (const type of passive ? [] : ["mousedown", "touchstart"]) {
    dialog.addEventListener(type, (event) => event.stopPropagation());
  }
  const native: HTMLElement[] = passive
    ? []
    : [...buttons, ...(close === undefined ? [] : [close])];
  // Read when used, so a part may change its controls.
  const focusables = () => [
    ...(input.parts ?? []).flatMap((part) => part.controls ?? []),
    ...native,
  ];
  dialog.addEventListener("focusin", (event) => {
    const at = focusables().indexOf(event.target as HTMLElement);
    input.onFocus?.(at === -1 ? undefined : at);
  });
  bindDialogKeys({ accepts, focusables }, dialog);
  if (input.dismiss !== undefined) {
    const dismiss = input.dismiss;
    bindGameAction(
      {
        activate: (origin) => {
          if (
            origin.kind === "hold" ||
            !focusables().some((control) => control.contains(origin.event.target as Node))
          ) {
            if (origin.kind === "click") {
              origin.event.stopPropagation();
            }
            dismiss();
          }
        },
        available: accepts,
      },
      dialog,
    );
  }
  const onKey = (event: KeyboardEvent) => {
    const numberPresses = input.numberPresses ?? input.presses;
    const number = cardNumberForKey(numberPresses.length, event.code);
    if (
      input.numberKeys &&
      accepts() &&
      number !== undefined &&
      menuKeyActs(event.repeat, event.code)
    ) {
      const press = numberPresses[number - 1];
      const index = input.presses.indexOf(press!);
      const control = sourceButtons.get(index);
      if (control?.isConnected && !control.hidden) {
        input.onInvoke?.(index, control);
      }
      press?.();
    }
  };
  doc.defaultView?.addEventListener("keydown", onKey);

  const place = (scale: DomScale) => {
    for (const part of placed) {
      part(scale);
    }
  };
  place(layer.scale());
  const stopScale = layer.onScale(place);
  layer.element.append(dialog);
  const urls = artUrls(dialog);
  // Scene gestures own custom content, not the panel's own action and close buttons.
  // Their accepted release must not consume the browser click of a native control.
  let sceneGesture = false;
  const gesture: NativeGesture | undefined =
    input.gesture === undefined
      ? undefined
      : {
          cancel: () => {
            sceneGesture = false;
            input.gesture?.cancel?.();
          },
          down: (event) => {
            sceneGesture = ![...buttons, ...(close === undefined ? [] : [close])].some((control) =>
              control.contains(event.target as Node),
            );
            if (sceneGesture) {
              input.gesture?.down?.(event);
            }
          },
          move: (event) => {
            if (sceneGesture) {
              input.gesture?.move?.(event);
            }
          },
          up: (event, cancelled) => {
            const active = sceneGesture;
            sceneGesture = false;
            return active ? input.gesture?.up?.(event, cancelled) : false;
          },
        };
  const lifecycle = mountModalLifecycle(
    layer,
    {
      ...(gesture === undefined ? {} : { gesture }),
      ...((input.close ?? input.backgroundCancel) === undefined
        ? {}
        : { backgroundCancel: input.close ?? input.backgroundCancel }),
      ...(input.companions === undefined ? {} : { companions: input.companions }),
      ...(input.onPaint === undefined ? {} : { onPaint: input.onPaint }),
      modal,
      reveal: layer.reveal(
        Promise.all(
          (input.parts ?? []).flatMap((part) => (part.ready === undefined ? [] : [part.ready])),
        ).then((parts) => [...urls, ...parts.flat()]),
        dialog,
      ),
    },
    dialog,
  );
  return {
    accepts,
    burst: (at) => addTapBurst(layer, at),
    capture: () => lifecycle.capture(),
    destroy() {
      disposeButtons.forEach((dispose) => dispose());
      setRampDimmed(dialog, false);
      lifecycle.destroy();
      stopScale();
      nativeCard?.dispose();
      doc.defaultView?.removeEventListener("keydown", onKey);
      dialog.remove();
    },
    element: dialog,
    focusControl(index) {
      if (!accepts()) {
        return;
      }
      const target = index === undefined ? undefined : focusables()[index];
      const control =
        target?.tagName.toLowerCase() === "button" && target.tabIndex < 0 ? undefined : target;
      if (doc.activeElement !== (control ?? dialog)) {
        focusTarget(control ?? dialog);
      }
    },
    refuse(index, reducedMotion) {
      const button = sourceButtons.get(index);
      if (button !== undefined) {
        refuse(reducedMotion, button);
      }
    },
    setActionShown(index, shown) {
      const button = sourceButtons.get(index);
      if (button !== undefined) {
        button.hidden = !shown;
      }
    },
    setDimmed(dimmed) {
      setRampDimmed(dialog, dimmed);
    },
    setEnabled: (enabled) => lifecycle.setEnabled(enabled),
    setInert: (inert) => lifecycle.setInert(inert),
    setShown: (shown) => lifecycle.setShown(shown),
  };
}

// Enter and Space press the focused button natively, and the scene under never hears them; Tab and
// Shift+Tab move the focus among the visible focusables in order, round from the last to the
// first, and from the dialog itself enter at the first or the last.
export function bindDialogKeys(
  input: { readonly accepts: () => boolean; readonly focusables: () => readonly HTMLElement[] },
  dialog: HTMLElement,
): void {
  const doc = dialog.ownerDocument;
  const { accepts, focusables } = input;
  dialog.addEventListener("keydown", (event) => {
    if (!accepts()) {
      return;
    }
    // Enter and Space press the focused control natively; the scene under never hears them.
    if (
      isConfirmKey(event.code) &&
      focusables().some(
        (control) =>
          control.tagName.toLowerCase() === "button" && control.contains(event.target as Node),
      )
    ) {
      if (event.repeat) {
        event.preventDefault();
      }
      event.stopPropagation();
      return;
    }
    if (event.code !== "Tab") {
      return;
    }
    const visible = focusables().filter(
      (control) =>
        (control.tagName.toLowerCase() !== "button" || control.tabIndex >= 0) &&
        !control.hidden &&
        control.closest?.("[hidden]") == null,
    );
    const at = visible.indexOf(doc.activeElement as HTMLElement);
    const step = event.shiftKey ? visible.length - 1 : 1;
    // From the dialog itself, Tab enters at the first button and Shift+Tab at the close control.
    const next =
      at === -1 ? (event.shiftKey ? visible.length - 1 : 0) : (at + step) % visible.length;
    event.preventDefault();
    (visible[next] ?? dialog).focus();
  });
}

// The art URLs every element in root draws as a background image, so its reveal waits for them.
export function artUrls(root: HTMLElement): Set<string> {
  const view = root.ownerDocument.defaultView;
  const urls = new Set<string>();
  const visit = (element: HTMLElement) => {
    const background =
      view?.getComputedStyle?.(element).backgroundImage ?? element.style.backgroundImage ?? "";
    for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      urls.add(match[1]!);
    }
    for (const child of element.children) {
      visit(child as HTMLElement);
    }
  };
  visit(root);
  return urls;
}
