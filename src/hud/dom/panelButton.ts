import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { ButtonView } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { createGameButton } from "../../ui/dom/gameButton.ts";
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
export function bindPanelFeedback(
  view: ButtonView,
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
    readonly press?: PanelPress;
  },
  button: PanelButton,
): { readonly element: HTMLElement; dispose(): void; place(scale: DomScale): void } {
  const passive = input.press === undefined;
  const content = doc.createElement("span");
  content.className = "adw-lines";
  const className = [
    "adw-button",
    ...(button.primary ? ["adw-go"] : []),
    ...(button.secondary === true ? ["adw-secondary"] : []),
    ...(button.available === false ? ["adw-disabled"] : []),
  ].join(" ");
  const control: { element?: HTMLElement } = {};
  const view = passive
    ? undefined
    : createGameButton(doc, {
        appearance: {
          className,
          face: { className: "adw-face" },
          role: button.primary ? "primary" : "secondary",
        },
        content: { icon: content, kind: "icon", name: button.label },
        getAction: () => (input.press!.accepts() ? { activate: input.press!.press } : null),
        getState: () => ({
          availability:
            control.element?.hidden === true
              ? { kind: "omitted" }
              : button.available === false
                ? { kind: "pointer-refusal" }
                : { kind: "available" },
        }),
        onPointerRefusal: () => {
          if (input.press!.accepts()) {
            input.press!.press();
          }
        },
      });
  const element = view?.element ?? doc.createElement("span");
  control.element = element;
  const face = view?.face ?? doc.createElement("span");
  const stopFeedback = view === undefined ? undefined : bindPanelFeedback(view, input.press!);
  if (passive) {
    element.className = className;
    element.setAttribute("aria-hidden", "true");
    face.className = "adw-face";
    element.append(face, content);
  }
  if (button.pressed === true && button.available !== false) {
    if (view === undefined) {
      element.setAttribute("data-pressed", "");
    } else {
      view.setPressed(true);
    }
  }
  const lines = (button.key === undefined ? [button.text] : [button.key, button.text]).map(
    (line) => {
      const text = createTextLine(doc, line);
      text.setAttribute("aria-hidden", "true");
      content.append(text);
      return { line, text };
    },
  );
  return {
    dispose() {
      stopFeedback?.();
      view?.dispose();
    },
    element,
    place(scale) {
      placeBox(scale, ORIGIN, element, button.hit);
      placeFrame(scale, button.hit, face, button.rect);
      for (const { line, text } of lines) {
        placeText(input.fonts[line.font], scale, passive ? button.hit : button.rect, text, line);
      }
    },
  };
}
