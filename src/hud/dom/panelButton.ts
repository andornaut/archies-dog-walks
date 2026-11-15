import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { createTextLine, placeBox, placeFrame, placeText } from "../../ui/dom/pixelLine.ts";
import type { DomScale } from "../../ui/domScale.ts";
import type { PanelButton } from "../../ui/modal/types.ts";

const ORIGIN = { x: 0, y: 0 };

export interface PanelPress {
  readonly accepts: () => boolean;
  readonly burst: (event: PointerEvent) => void;
  readonly press: () => void;
}

// The enclosing native surface owns pointer admission and modal lifetime.
export function bindPanelPress(control: HTMLButtonElement, input: PanelPress): void {
  const lift = () => control.removeAttribute("data-pressed");
  control.addEventListener("pointerdown", (event) => {
    if (!input.accepts()) {
      return;
    }
    if (control.hasPointerCapture(event.pointerId)) {
      control.releasePointerCapture(event.pointerId);
    }
    control.setAttribute("data-pressed", "");
    input.burst(event);
  });
  control.addEventListener("pointerenter", (event) => {
    if (event.buttons !== 0) {
      control.setAttribute("data-pressed", "");
    }
  });
  for (const type of ["pointerleave", "pointerup", "pointercancel"]) {
    control.addEventListener(type, lift);
  }
  control.addEventListener("click", () => {
    if (input.accepts()) {
      input.press();
    }
  });
}

export function createPanelButton(
  doc: Document,
  input: {
    readonly fonts: Readonly<Record<"body" | "title", BitmapFont>>;
    readonly press?: PanelPress;
  },
  button: PanelButton,
): { readonly element: HTMLElement; place(scale: DomScale): void } {
  const passive = input.press === undefined;
  const element = doc.createElement(passive ? "span" : "button");
  element.className = [
    "adw-button",
    ...(button.primary ? ["adw-go"] : []),
    ...(button.secondary === true ? ["adw-secondary"] : []),
    ...(button.available === false ? ["adw-disabled"] : []),
  ].join(" ");
  if (passive) {
    element.setAttribute("aria-hidden", "true");
  } else {
    (element as HTMLButtonElement).type = "button";
    element.setAttribute("aria-label", button.label);
    bindPanelPress(element as HTMLButtonElement, input.press!);
  }
  if (button.pressed === true && button.available !== false) {
    element.setAttribute("data-pressed", "");
  }
  const face = doc.createElement("span");
  face.className = "adw-face";
  element.append(face);
  const lines = (button.key === undefined ? [button.text] : [button.key, button.text]).map(
    (line) => {
      const text = createTextLine(doc, line);
      text.setAttribute("aria-hidden", "true");
      element.append(text);
      return { line, text };
    },
  );
  return {
    element,
    place(scale) {
      placeBox(scale, ORIGIN, element, button.hit);
      placeFrame(scale, button.hit, face, button.rect);
      for (const { line, text } of lines) {
        placeText(input.fonts[line.font], scale, button.hit, text, line);
      }
    },
  };
}
