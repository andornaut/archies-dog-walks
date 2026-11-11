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
  readonly element: HTMLElement;
  readonly place: (scale: DomScale) => void;
}

export interface DomQuestionPanelInput {
  // What the close control does, or undefined for a panel that takes no presses: its close
  // control is a picture and every press goes through to the canvas, whose scene closes it.
  // Then its accessible name, and what each button does, in order.
  readonly close: (() => void) | undefined;
  readonly closeLabel: string;
  // The id of the part that describes the panel, if any.
  readonly describedBy?: string;
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
  destroy(): void;
  // Hides the panel while a canvas page covers it (help, the settings), and shows it again.
  setShown(shown: boolean): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// art: the close control's 16x16 glyph on its 20x20 ui-icon-button face, from the face's corner,
// as the canvas draws it (addIconButton).
const CLOSE_ART = { glyph: { size: 16, x: 2, y: 1 } } as const;

// art: fx-tap's side.
const BURST_SIDE = 16;

// Ids that tie each panel's dialog to its title and note.
let panels = 0;

// The panel in layer, shown and its dialog focused.
export function showQuestionPanel(layer: UiLayer, input: DomQuestionPanelInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  panels += 1;
  const id = `adw-panel-${panels}`;
  const { view } = input;
  const dialog = doc.createElement("div");
  const passive = input.close === undefined;
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
  } else {
    dialog.append(rim, panel);
  }

  // The parts drawn at game pixels, placed again as the scale changes.
  const placed: ((scale: DomScale) => void)[] = [];
  const box = (element: HTMLElement, origin: Point, rect: Rect) =>
    placed.push((scale) => placeBox(scale, origin, element, rect));
  // A nine-slice frame, whole art pixels wide and tall.
  const frame = (element: HTMLElement, origin: Point, rect: Rect) =>
    placed.push((scale) => placeFrame(scale, origin, element, rect));
  const text = (parent: HTMLElement, origin: Point, line: DomTextLine) => {
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
  title.setAttribute("aria-label", view.title.map((line) => line.text).join(" "));
  for (const line of view.title) {
    text(title, ORIGIN, line).setAttribute("aria-hidden", "true");
  }
  dialog.setAttribute("aria-labelledby", title.id);
  dialog.append(title);

  if (view.notePlate !== undefined) {
    const plate = doc.createElement("div");
    plate.className = "adw-plate";
    box(plate, ORIGIN, view.notePlate);
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

  const burst = (event: PointerEvent) => {
    const at = input.toGame({ x: event.clientX, y: event.clientY });
    const element = doc.createElement("span");
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
    dialog.append(element);
  };
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

  const buttons = view.buttons.map((button, i) => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = button.primary ? "adw-button adw-go" : "adw-button";
    element.setAttribute("aria-label", button.label);
    element.setAttribute("aria-keyshortcuts", String(i + 1));
    const face = doc.createElement("span");
    face.className = "adw-face";
    element.append(face);
    box(element, ORIGIN, button.hit);
    frame(face, button.hit, button.rect);
    text(element, button.hit, button.text).setAttribute("aria-hidden", "true");
    pressable(element, () => input.presses[i]?.());
    return element;
  });

  // The close control after the buttons, so it is on top where their press areas meet; a
  // picture of one on a panel that takes no presses.
  const close = doc.createElement(passive ? "span" : "button");
  close.className = "adw-close";
  if (!passive) {
    (close as HTMLButtonElement).type = "button";
    close.setAttribute("aria-label", input.closeLabel);
  } else {
    close.setAttribute("aria-hidden", "true");
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
  if (input.close !== undefined) {
    pressable(close as HTMLButtonElement, input.close);
  }
  dialog.append(...buttons, close);

  // Phaser handles a press on the page outside its canvas as its own; a press here is the menu's.
  for (const type of passive ? [] : ["mousedown", "touchstart"]) {
    dialog.addEventListener(type, (event) => event.stopPropagation());
  }
  const focusables = passive ? buttons : [...buttons, close as HTMLButtonElement];
  dialog.addEventListener("keydown", (event) => {
    // Enter and Space press the focused control natively; the scene under never hears them.
    if (isConfirmKey(event.key) && focusables.includes(event.target as HTMLButtonElement)) {
      event.stopPropagation();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const at = focusables.indexOf(doc.activeElement as HTMLButtonElement);
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
    destroy() {
      blur();
      stopScale();
      doc.defaultView?.removeEventListener("keydown", onKey);
      dialog.remove();
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
