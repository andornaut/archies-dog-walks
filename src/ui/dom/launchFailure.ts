import "./loadingError.css";

import {
  LOADING_FAILURE_TEXT,
  type LoadingAttemptState,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { mountLoadingFailure } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { createModalLayer } from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { loadingFailurePresentation } from "./loadingFailureStyle.ts";

// The game's fit before Phaser exists: CSS pixels per game pixel for the whole screen in view.
function viewportUnit(view: Pick<Window, "innerHeight" | "innerWidth">): number {
  return Math.min(view.innerWidth / SCREEN_CONFIG.width, view.innerHeight / SCREEN_CONFIG.height);
}

// A first install's Loading failed, before the game's modules, fonts or art load: the kit's
// hardened view in the loading error's look, centred over the viewport, with Retry its only
// action and focus kept inside it. The loading bar stays visible above it.
export function mountLaunchFailure(
  retry: () => void,
  parent: HTMLElement,
): { dispose(): void; update(state: LoadingAttemptState): void } {
  const doc = parent.ownerDocument;
  const view = doc.defaultView ?? window;
  const root = doc.createElement("div");
  root.className = "adw-loading-error";
  root.hidden = true;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-label", LOADING_FAILURE_TEXT.title);
  Object.assign(root.style, { inset: "0px", position: "fixed" });
  parent.append(root);
  const modal = createModalLayer(parent);
  const failure = mountLoadingFailure(
    { onRetry: retry, presentation: loadingFailurePresentation(viewportUnit(view)) },
    root,
  );
  const button = failure.element.querySelector("button");
  const resize = () => failure.setPresentation(loadingFailurePresentation(viewportUnit(view)));
  view.addEventListener("resize", resize);
  let close: (() => void) | undefined;
  return {
    dispose() {
      close?.();
      close = undefined;
      view.removeEventListener("resize", resize);
      failure.dispose();
      modal.dispose();
      root.remove();
    },
    update(state) {
      failure.update(state);
      failure.element.hidden = state.kind !== "failed";
      root.setAttribute("aria-busy", String(state.kind === "loading"));
      if (close === undefined) {
        root.hidden = false;
        // A strict dialog with no close: Retry is the only way on.
        close = modal.open(
          { ...(button === null ? {} : { focus: button }), isolation: "dialog" },
          root,
        );
      }
    },
  };
}
