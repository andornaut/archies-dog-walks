import "./loadingError.css";

import {
  LOADING_FAILURE_TEXT,
  type LoadingAttemptState,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { mountLoadingFailure } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { createModalLayer } from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";

import { PALETTE } from "../palette.ts";
import { guardNativeInput } from "./modalLifecycle.ts";
import { mountMuteControl, type MuteControlSettings } from "./muteControl.ts";
import type { UiLayer } from "./uiLayer.ts";

export interface LoadingErrorView {
  dispose(): void;
  hide(): void;
  show(state: LoadingAttemptState): void;
}

// Recovery controls use the independent bootstrap fonts and chrome, never the failed game
// resources. The same device mute preference remains usable while the game is blocked.
export function mountLoadingError(
  context: {
    readonly layer: UiLayer;
    readonly retry: () => void | PromiseLike<void>;
    readonly settings: MuteControlSettings;
  },
  parent: HTMLElement,
): LoadingErrorView {
  const { layer } = context;
  const doc = parent.ownerDocument;
  const root = doc.createElement("div");
  root.className = "adw-loading-error";
  root.hidden = true;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-label", LOADING_FAILURE_TEXT.title);
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
  root.append(panel);
  parent.append(root);
  const modal = createModalLayer(parent);
  let close: (() => void) | undefined;
  let scope: ReturnType<UiLayer["input"]["open"]> | undefined;
  let removeMute: (() => void) | undefined;
  let disposed = false;
  const place = () => {
    for (const key of ["height", "left", "top", "width"] as const) {
      root.style[key] = layer.element.style[key];
    }
  };
  const stopScale = layer.onScale(place);
  place();
  const failure = mountLoadingFailure(
    {
      onRetry: () => (!disposed && scope?.accepts() ? context.retry() : undefined),
    },
    panel,
  );
  const button = failure.element.querySelector("button")!;
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
      failure.dispose();
      modal.dispose();
      root.remove();
    },
    hide,
    show(state) {
      if (disposed) {
        return;
      }
      failure.update(state);
      panel.hidden = state.kind !== "failed";
      root.setAttribute("aria-busy", String(state.kind === "loading"));
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
