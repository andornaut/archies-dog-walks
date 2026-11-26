import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { ButtonView } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import type { DomScale, PanelButton } from "../index.ts";
import { createGameButton } from "./gameButton.ts";
import { createTextLine, placeBox, placeFrame, placeText } from "./pixelLine.ts";

const ORIGIN = { x: 0, y: 0 };

export interface PanelPress {
  readonly accepts: () => boolean;
  readonly burst: (event: PointerEvent) => void;
  readonly press: () => void;
}

// The enclosing native surface owns pointer admission and modal lifetime.
export function bindPanelFeedback(
  view: Pick<ButtonView, "element" | "setPressed">,
  input: Pick<PanelPress, "accepts" | "burst">,
): () => void {
  const control = view.element;
  const lift = () => view.setPressed(false);
  const down = (event: PointerEvent) => {
    if (!input.accepts()) {
      return;
    }
    if (control.hasPointerCapture(event.pointerId)) {
      control.releasePointerCapture(event.pointerId);
    }
    view.setPressed(true);
    input.burst(event);
  };
  const enter = (event: PointerEvent) => {
    if (event.buttons !== 0 && input.accepts()) {
      view.setPressed(true);
    }
  };
  control.addEventListener("pointerdown", down);
  control.addEventListener("pointerenter", enter);
  for (const type of ["pointerleave", "pointerup", "pointercancel"]) {
    control.addEventListener(type, lift);
  }
  return () => {
    control.removeEventListener("pointerdown", down);
    control.removeEventListener("pointerenter", enter);
    for (const type of ["pointerleave", "pointerup", "pointercancel"]) {
      control.removeEventListener(type, lift);
    }
  };
}

export function createPanelButton(
  doc: Document,
  input: {
    readonly fonts: Readonly<Record<"body" | "title", BitmapFont>>;
    readonly press: PanelPress;
  },
  button: PanelButton,
): {
  readonly element: HTMLElement;
  dispose(): void;
  // Places the button in device pixels from its container's corner at origin, the screen's by
  // default.
  place(scale: DomScale, origin?: Point): void;
  // Places the face and label in the button, which an action group places on its face.
  placeContent(scale: DomScale): void;
} {
  const content = doc.createElement("span");
  content.className = "adw-lines";
  const className = [
    "adw-button",
    ...(button.primary ? ["adw-go"] : []),
    ...(button.secondary === true ? ["adw-secondary"] : []),
    ...(button.available === false ? ["adw-disabled"] : []),
  ].join(" ");
  const control: { element?: HTMLElement } = {};
  const view = createGameButton(doc, {
    appearance: {
      className,
      face: { className: "adw-face" },
      role: button.primary ? "primary" : "secondary",
    },
    content: { icon: content, kind: "icon", name: button.label },
    getAction: () => (input.press.accepts() ? { activate: input.press.press } : null),
    getState: () => ({
      availability:
        control.element?.hidden === true
          ? { kind: "omitted" }
          : button.available === false
            ? { kind: "pointer-refusal" }
            : { kind: "available" },
    }),
    onPointerRefusal: () => {
      if (input.press.accepts()) {
        input.press.press();
      }
    },
  });
  const { element, face } = view;
  control.element = element;
  const stopFeedback = bindPanelFeedback(view, input.press);
  if (button.pressed === true && button.available !== false) {
    view.setPressed(true);
  }
  const lines = (button.key === undefined ? [button.text] : [button.key, button.text]).map(
    (line) => {
      const text = createTextLine(doc, line);
      text.setAttribute("aria-hidden", "true");
      content.append(text);
      return { line, text };
    },
  );
  // The face and label from the button's corner at corner.
  const placeContent = (scale: DomScale, corner: Point) => {
    placeFrame(scale, corner, face, button.rect);
    for (const { line, text } of lines) {
      placeText(input.fonts[line.font], scale, button.rect, text, line);
    }
  };
  return {
    dispose() {
      stopFeedback();
      view.dispose();
    },
    element,
    place(scale, origin = ORIGIN) {
      placeBox(scale, origin, element, button.hit);
      placeContent(scale, button.hit);
    },
    placeContent: (scale) => placeContent(scale, button.rect),
  };
}
