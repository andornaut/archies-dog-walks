import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { cardNumberForKey, isConfirmKey, menuKeyActs } from "../../input/keyBindings.ts";
import { closeFace } from "../../ui/closeControl.ts";
import {
  createTextLine,
  type DomTextLine,
  placeBox,
  placeFrame,
  placeText,
  setBox,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  artPixel,
  deviceX,
  deviceY,
  type DomScale,
  frameRect,
  gridTransform,
} from "../../ui/domScale.ts";
import type { PanelText, QuestionPanelView } from "../questionPanelView.ts";

// The pause menu, each question (the Home question, Quit?) and each modal card (the update
// notices) in HTML over the canvas: the panel questionPanelView or modalCardView lays out, drawn
// in the #ui layer at the places the canvas would draw it, as a dialog. A press on its parts is
// its own (Phaser never hears it); everywhere else presses go through to the canvas, where the
// top bar's buttons keep working and the scene's outside tap closes it. Number keys press a
// question's buttons, Tab and Shift+Tab keep focus among its buttons and close control, and Enter
// or Space presses the focused one.

// A part a panel draws beyond its frame, title, note and buttons (a detail card's well, art and
// text), placed again as the scale changes.
export interface DomPart {
  // The part's controls, which Tab reaches before the panel's buttons and close control, in
  // order; keys on them go through to the scene under, which acts on its own focus.
  readonly controls?: readonly HTMLElement[];
  readonly element: HTMLElement;
  readonly place: (scale: DomScale) => void;
}

export interface DomQuestionPanelInput {
  // What the close control does; undefined draws it as a picture, and a panel with no buttons
  // then takes no presses: every press goes through to the canvas, whose scene closes it. null
  // draws no close control. Then its accessible name, and what each button does, in order.
  readonly close: (() => void) | null | undefined;
  readonly closeLabel: string;
  // Whether a panel that takes no presses shows its close control pressed.
  readonly closePressed?: boolean;
  // The id of the part that describes the panel, if any.
  readonly describedBy?: string;
  // Told the index (focusControl's) of the control focus moves to, or undefined for the dialog.
  readonly onFocus?: (index: number | undefined) => void;
  // The dialog's name where the canvas draws its title (view.title empty), as over a
  // celebration.
  readonly label?: string;
  readonly fonts: Readonly<Record<PanelText["font"], BitmapFont>>;
  // Whether keys 1 to n press the buttons, as on the pause menu and the questions.
  readonly numberKeys: boolean;
  // Drawn over the frame, under the title.
  readonly parts?: readonly DomPart[];
  readonly presses: readonly (() => void)[];
  // The page point of a press as a game point, through the page frame's turn.
  readonly toGame: (client: Point) => Point;
  readonly view: QuestionPanelView;
}

export interface DomQuestionPanel {
  // A tap burst at a game point, over the panel.
  burst(at: Point): void;
  destroy(): void;
  // Focuses the parts' controls, then the buttons, then the close control, by index, or the
  // dialog itself for undefined, as the scene's own focus moves.
  focusControl(index: number | undefined): void;
  // Shakes the index-th button and flashes its label, as the canvas refuses a disabled
  // control (refuseControl): still, its label red, under reduced motion.
  refuse(index: number, refusal: DomRefusal): void;
  // Hides the panel while a canvas page covers it (help, the settings), and shows it again.
  setShown(shown: boolean): void;
}

// How a refusal's label flashes, as refuseControl's REFUSE says, and whether motion is reduced;
// its shake is the stylesheet's (controlStateStyle.ts).
export interface DomRefusal {
  readonly flashMs: number;
  readonly flashes: number;
  readonly reducedMotion: boolean;
}

const ORIGIN = { x: 0, y: 0 } as const;

// art: the close control's 16x16 glyph on its 20x20 ui-icon-button face, from the face's corner,
// as the canvas draws it (addIconButton).
const CLOSE_ART = { glyph: { size: 16, x: 2, y: 1 } } as const;

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
  panels += 1;
  const id = `adw-panel-${panels}`;
  const { view } = input;
  const dialog = doc.createElement("div");
  const passive = input.close === undefined && input.presses.length === 0;
  dialog.className = passive ? "adw-dialog adw-passive" : "adw-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  // Focus starts on the dialog itself, so no button shows the keyboard's ring until Tab.
  dialog.tabIndex = -1;

  // A question's ui-panel in its rim, or a modal card's ui-detail-card.
  const rim = doc.createElement("div");
  rim.className = "adw-rim";
  const panel = doc.createElement("div");
  panel.className = view.frame === "card" ? "adw-card" : "adw-panel";
  if (view.frame === "card") {
    dialog.append(panel);
  } else if (view.frame === "panel") {
    dialog.append(rim, panel);
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
  // The screen's root in device pixels on the device grid, and the rim one art pixel round the
  // panel.
  placed.push((scale) => {
    dialog.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
    dialog.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
    dialog.style.transform = gridTransform(scale);
    const outer = frameRect(scale, view.panel);
    const pixel = artPixel(scale);
    setBox(rim, {
      height: outer.height + 2 * pixel,
      left: outer.left - pixel,
      top: outer.top - pixel,
      width: outer.width + 2 * pixel,
    });
  });
  frame(panel, ORIGIN, view.panel);
  for (const part of input.parts ?? []) {
    dialog.append(part.element);
    placed.push(part.place);
  }
  if (input.describedBy !== undefined) {
    dialog.setAttribute("aria-describedby", input.describedBy);
  }

  // The title, its lines in capitals; a screen reader reads its words as written.
  const title = doc.createElement("h2");
  title.className = "adw-lines";
  title.id = `${id}-title`;
  title.setAttribute("aria-label", input.label ?? view.title.map((line) => line.text).join(" "));
  for (const line of view.title) {
    text(title, ORIGIN, line).setAttribute("aria-hidden", "true");
  }
  dialog.setAttribute("aria-labelledby", title.id);
  dialog.append(title);

  if (view.notePlate !== undefined) {
    const plate = doc.createElement("div");
    plate.className = "adw-plate";
    frame(plate, ORIGIN, view.notePlate);
    const note = doc.createElement("p");
    note.className = "adw-lines";
    note.id = `${id}-note`;
    // Each line ends in a space, so a screen reader reads the lines as running text.
    for (const line of view.note) {
      const element = text(note, ORIGIN, line);
      element.textContent = `${element.textContent ?? ""} `;
    }
    dialog.setAttribute("aria-describedby", note.id);
    dialog.append(plate, note);
  }

  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));
  // Shows a control pressed while a press that began on it stays on it, as the canvas's do.
  // Releasing the implicit capture a touch takes lets the press leave the control, so click,
  // which fires only where the press began and ended, presses it.
  const pressable = (control: HTMLButtonElement, press: () => void) => {
    const lift = () => control.removeAttribute("data-pressed");
    control.addEventListener("pointerdown", (event) => {
      if (control.hasPointerCapture(event.pointerId)) {
        control.releasePointerCapture(event.pointerId);
      }
      control.setAttribute("data-pressed", "");
      burst(event);
    });
    control.addEventListener("pointerenter", (event) => {
      if (event.buttons !== 0) {
        control.setAttribute("data-pressed", "");
      }
    });
    for (const type of ["pointerleave", "pointerup", "pointercancel"]) {
      control.addEventListener(type, lift);
    }
    control.addEventListener("click", press);
  };

  // A panel that takes no presses shows its buttons as pictures.
  const buttons = view.buttons.map((button, i) => {
    const element = doc.createElement(passive ? "span" : "button");
    element.className = [
      "adw-button",
      ...(button.primary ? ["adw-go"] : []),
      ...(button.available === false ? ["adw-disabled"] : []),
    ].join(" ");
    if (passive) {
      element.setAttribute("aria-hidden", "true");
    } else {
      (element as HTMLButtonElement).type = "button";
      element.setAttribute("aria-label", button.label);
      element.setAttribute("aria-keyshortcuts", String(i + 1));
    }
    if (passive && button.pressed === true && button.available !== false) {
      element.setAttribute("data-pressed", "");
    }
    const face = doc.createElement("span");
    face.className = "adw-face";
    element.append(face);
    box(element, ORIGIN, button.hit);
    frame(face, button.hit, button.rect);
    for (const line of button.key === undefined ? [button.text] : [button.key, button.text]) {
      text(element, button.hit, line).setAttribute("aria-hidden", "true");
    }
    if (!passive) {
      pressable(element as HTMLButtonElement, () => input.presses[i]?.());
    }
    return element;
  });

  // The close control after the buttons, so it is on top where their press areas meet; a
  // picture of one where nothing presses it.
  const pressClose = input.close ?? undefined;
  const close = doc.createElement(pressClose === undefined ? "span" : "button");
  close.className = "adw-close";
  if (pressClose !== undefined) {
    (close as HTMLButtonElement).type = "button";
    close.setAttribute("aria-label", input.closeLabel);
  } else {
    close.setAttribute("aria-hidden", "true");
    if (input.closePressed === true) {
      close.setAttribute("data-pressed", "");
    }
  }
  const closeArt = closeFace(view.close);
  const face = doc.createElement("span");
  face.className = "adw-close-face";
  const glyph = doc.createElement("span");
  glyph.className = "adw-close-glyph";
  close.append(face, glyph);
  box(close, ORIGIN, view.close.hit);
  // The face and its glyph in whole art pixels, from the face's corner on the device grid.
  placed.push((scale) => {
    const pixel = artPixel(scale);
    const left = deviceX(scale, closeArt.x) - deviceX(scale, view.close.hit.x);
    const top = deviceY(scale, closeArt.y) - deviceY(scale, view.close.hit.y);
    const side = closeArt.width * pixel;
    setBox(face, { height: side, left, top, width: side });
    const { glyph: at } = CLOSE_ART;
    setBox(glyph, {
      height: at.size * pixel,
      left: left + at.x * pixel,
      top: top + at.y * pixel,
      width: at.size * pixel,
    });
  });
  if (pressClose !== undefined) {
    pressable(close as HTMLButtonElement, pressClose);
  }
  dialog.append(...buttons);
  if (input.close !== null) {
    dialog.append(close);
  }

  // Phaser handles a press on the page outside its canvas as its own; a press here is the menu's.
  for (const type of passive ? [] : ["mousedown", "touchstart"]) {
    dialog.addEventListener(type, (event) => event.stopPropagation());
  }
  const native: HTMLElement[] = passive
    ? []
    : [...buttons, ...(pressClose === undefined ? [] : [close])];
  const focusables = [...(input.parts ?? []).flatMap((part) => part.controls ?? []), ...native];
  dialog.addEventListener("focusin", (event) => {
    const at = focusables.indexOf(event.target as HTMLElement);
    input.onFocus?.(at === -1 ? undefined : at);
  });
  dialog.addEventListener("keydown", (event) => {
    // Enter and Space press the focused control natively; the scene under never hears them.
    if (isConfirmKey(event.key) && native.includes(event.target as HTMLElement)) {
      event.stopPropagation();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const at = focusables.indexOf(doc.activeElement as HTMLElement);
    const step = event.shiftKey ? focusables.length - 1 : 1;
    // From the dialog itself, Tab enters at the first button and Shift+Tab at the close control.
    const next =
      at === -1 ? (event.shiftKey ? focusables.length - 1 : 0) : (at + step) % focusables.length;
    event.preventDefault();
    focusables[next]?.focus();
  });
  const onKey = (event: KeyboardEvent) => {
    const number = cardNumberForKey(input.presses.length, event.key);
    if (
      input.numberKeys &&
      !dialog.hidden &&
      number !== undefined &&
      menuKeyActs(event.repeat, event.key)
    ) {
      input.presses[number - 1]?.();
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
  const focusFirst = () => dialog.focus({ preventScroll: true });
  focusFirst();

  const blur = () => {
    if (dialog.contains(doc.activeElement)) {
      (doc.activeElement as HTMLElement).blur();
    }
  };
  return {
    burst: (at) => addTapBurst(layer, at),
    destroy() {
      blur();
      stopScale();
      doc.defaultView?.removeEventListener("keydown", onKey);
      dialog.remove();
    },
    focusControl(index) {
      const control = index === undefined ? undefined : focusables[index];
      if (doc.activeElement !== (control ?? dialog)) {
        (control ?? dialog).focus({ preventScroll: true });
      }
    },
    refuse(index, refusal) {
      const button = buttons[index];
      // A refusal under way plays on.
      if (
        button === undefined ||
        ["adw-refusing", "adw-refusing-still"].some((name) => button.classList.contains(name))
      ) {
        return;
      }
      const style = button.style;
      const total = refusal.flashMs * refusal.flashes;
      style.setProperty("--adw-flash-ms", `${2 * refusal.flashMs}ms`);
      style.setProperty("--adw-flashes", String(refusal.flashes / 2));
      style.setProperty("--adw-refuse-ms", `${total}ms`);
      const refusing = refusal.reducedMotion ? "adw-refusing-still" : "adw-refusing";
      button.classList.add(refusing);
      doc.defaultView?.setTimeout(() => button.classList.remove(refusing), total);
    },
    setShown(shown) {
      if (shown === !dialog.hidden) {
        return;
      }
      if (!shown) {
        blur();
      }
      dialog.hidden = !shown;
      if (shown) {
        focusFirst();
      }
    },
  };
}
