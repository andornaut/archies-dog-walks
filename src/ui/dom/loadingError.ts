import "./loadingError.css";

import {
  LOADING_FAILURE_TEXT,
  type LoadingAttemptState,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { mountLoadingFailure } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { createModalLayer } from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";

import { bindGameAction } from "./actionBinding.ts";
import { loadingFailurePresentation } from "./loadingFailureStyle.ts";
import { guardNativeInput } from "./modalLifecycle.ts";
import type { UiLayer } from "./uiLayer.ts";

export interface LoadingErrorView {
  dispose(): void;
  hide(): void;
  show(state: LoadingAttemptState): void;
}

// Recovery controls use the independent bootstrap fonts and chrome, never the failed game
// resources. Required loading exposes only its explicit retry action.
export function mountLoadingError(
  context: {
    readonly layer: UiLayer;
    readonly retry: () => void | PromiseLike<void>;
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
  parent.append(root);
  const modal = createModalLayer(parent);
  let close: (() => void) | undefined;
  let scope: ReturnType<UiLayer["input"]["open"]> | undefined;
  let disposed = false;
  const presentation = () => loadingFailurePresentation(layer.scale().unit);
  const failure = mountLoadingFailure(
    {
      onRetry: () => (!disposed && scope?.accepts() ? context.retry() : undefined),
      presentation: presentation(),
    },
    root,
  );
  const panel = failure.element;
  const button = panel.querySelector("button")!;
  const place = () => {
    for (const key of ["height", "left", "top", "width"] as const) {
      root.style[key] = layer.element.style[key];
    }
    failure.setPresentation(presentation());
  };
  const stopScale = layer.onScale(place);
  place();
  const unbindRetry = bindGameAction(
    {
      activate: () => {
        void context.retry();
      },
      available: () => !disposed && scope?.accepts() === true,
      nativeClick: true,
    },
    button,
  );
  const stopInput = guardNativeInput(
    {
      claim: layer.press.claim,
      gate: {
        accepts: () => !disposed && scope?.accepts() === true,
        capture: () => scope?.capture() ?? (() => false),
      },
      holdUnit: () => layer.scale().unit,
      subscribe: layer.input.subscribe,
    },
    root,
  );
  const hide = () => {
    scope?.close();
    scope = undefined;
    close?.();
    close = undefined;
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
      unbindRetry();
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
        // A strict dialog with no close: Retry is the only way on, and no key or tap dismisses it.
        close = modal.open(
          { ...(panel.hidden ? {} : { focus: button }), isolation: "dialog" },
          root,
        );
      }
    },
  };
}
