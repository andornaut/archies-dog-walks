import "./loadingError.css";

import {
  LOADING_FAILURE_TEXT,
  type LoadingAttemptState,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import {
  type LoadingFailurePresentation,
  mountLoadingFailure,
} from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { createModalLayer } from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";

import { BUTTON_SIZE } from "../../data/layout.ts";
import { PALETTE } from "../palette.ts";
import { bindGameAction } from "./actionBinding.ts";
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
  parent.append(root);
  const modal = createModalLayer(parent);
  let close: (() => void) | undefined;
  let scope: ReturnType<UiLayer["input"]["open"]> | undefined;
  let removeMute: (() => void) | undefined;
  let disposed = false;
  // Typography and panel spacing stay in CSS pixels; only the normal action follows game fit.
  const presentation = (): LoadingFailurePresentation => {
    const unit = layer.scale().unit;
    const colour = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
    return {
      action: {
        borderWidthPx: Math.max(1, unit),
        heightPx: BUTTON_SIZE.compact.height * unit,
        highlightHeightPx: Math.max(1, unit),
        paddingBottomPx: 4 * unit,
        paddingXPx: 12,
        shadeHeightPx: 4 * unit,
        widthPx: BUTTON_SIZE.compact.width * unit,
      },
      palette: {
        action: colour(PALETTE.green),
        actionText: colour(PALETTE.ink),
        border: colour(PALETTE.ink),
        highlight: colour(PALETTE.yellow),
        lip: colour(PALETTE.tan),
        panel: colour(PALETTE.cream),
        shade: colour(PALETTE.forest),
        shadow: colour(PALETTE.ink),
        text: colour(PALETTE.plum),
      },
      panel: {
        bodyActionGapPx: 24,
        borderWidthPx: 1,
        lipHeightPx: 4,
        maxWidthPx: 328,
        paddingBottomPx: 16,
        paddingTopPx: 24,
        paddingXPx: 16,
        safeInsetPx: 16,
        shadowOffsetPx: 4,
        titleBodyGapPx: 16,
      },
      text: {
        action: { lineHeight: 1.2, sizePx: 18, weight: 700 },
        body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
        title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
      },
    };
  };
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
        removeMute = mountMuteControl(context.settings, root);
        close = modal.open({ focus: button }, root);
      }
    },
  };
}
