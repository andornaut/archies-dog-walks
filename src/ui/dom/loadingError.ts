import "./loadingError.css";

import { createModalLayer } from "@andornaut/game-kit/web/ui/dom/modalLayer";

import { PALETTE } from "../palette.ts";
import { guardNativeInput } from "./modalLifecycle.ts";
import { mountMuteControl, type MuteControlSettings } from "./muteControl.ts";
import type { UiLayer } from "./uiLayer.ts";

export interface LoadingErrorView {
  dispose(): void;
  hide(): void;
  show(busy: boolean): void;
}

// Recovery controls use the independent bootstrap fonts and chrome, never the failed game
// resources. The same device mute preference remains usable while the game is blocked.
export function mountLoadingError(
  context: {
    readonly layer: UiLayer;
    readonly retry: () => void;
    readonly settings: MuteControlSettings;
    readonly words: { readonly body: string; readonly retry: string; readonly title: string };
  },
  parent: HTMLElement,
): LoadingErrorView {
  const { layer, words } = context;
  const doc = parent.ownerDocument;
  const root = doc.createElement("div");
  root.className = "adw-loading-error";
  root.hidden = true;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-labelledby", "adw-loading-error-title");
  root.setAttribute("aria-describedby", "adw-loading-error-body");
  const palette = {
    background: PALETTE.ink,
    "button-face": PALETTE.green,
    "button-lip": PALETTE.forest,
    ink: PALETTE.ink,
    paper: PALETTE.cream,
    "paper-lip": PALETTE.tan,
    "paper-text": PALETTE.plum,
    text: PALETTE.cream,
  };
  for (const [name, value] of Object.entries(palette)) {
    root.style.setProperty(`--crash-${name}`, `#${value.toString(16).padStart(6, "0")}`);
  }
  const panel = doc.createElement("section");
  panel.className = "crash-panel";
  const title = doc.createElement("h1");
  title.id = "adw-loading-error-title";
  title.className = "crash-title";
  title.textContent = words.title;
  const body = doc.createElement("p");
  body.id = "adw-loading-error-body";
  body.className = "crash-body";
  body.textContent = words.body;
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "crash-button";
  button.textContent = words.retry;
  panel.append(title, body, button);
  root.append(panel);
  parent.append(root);
  const modal = createModalLayer(parent);
  let close: (() => void) | undefined;
  let scope: ReturnType<UiLayer["input"]["open"]> | undefined;
  let removeMute: (() => void) | undefined;
  let busy = false;
  let disposed = false;
  const place = () => {
    for (const key of ["height", "left", "top", "width"] as const) {
      root.style[key] = layer.element.style[key];
    }
  };
  const stopScale = layer.onScale(place);
  place();
  const stopInput = guardNativeInput(
    {
      claim: layer.press.claim,
      gate: {
        accepts: () => !disposed && scope?.accepts() === true,
        capture: () => scope?.capture() ?? (() => false),
      },
      subscribe: layer.input.subscribe,
    },
    root,
  );
  const retry = () => {
    if (!disposed && !busy && scope?.accepts()) {
      context.retry();
    }
  };
  button.addEventListener("click", retry);
  const hide = () => {
    scope?.close();
    scope = undefined;
    close?.();
    close = undefined;
    removeMute?.();
    removeMute = undefined;
    root.hidden = true;
  };
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      hide();
      stopInput();
      stopScale();
      button.removeEventListener("click", retry);
      modal.dispose();
      root.remove();
    },
    hide,
    show(pending) {
      if (disposed) {
        return;
      }
      busy = pending;
      button.disabled = busy;
      root.setAttribute("aria-busy", String(busy));
      if (close === undefined) {
        root.hidden = false;
        place();
        scope = layer.input.open();
        removeMute = mountMuteControl(context.settings, root);
        close = modal.open({ focus: button }, root);
      }
    },
  };
}
