import type { ProgressSource } from "@andornaut/game-kit/progressState";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { GAME_PROGRESS_STYLE, LOADING_TIMING } from "../progressBar.ts";

export const LOADING_BAR_HEIGHT = 3;

export interface LoadingBar {
  readonly element: HTMLElement;
  dispose(): void;
}

// One page-lifetime loading indicator. Only its width follows the game viewport; the vertical
// CSS size is independent of logical fit, renderer backing resolution and device pixel ratio.
export function mountDomLoadingBar(progress: ProgressSource, parent: HTMLElement): LoadingBar {
  const view = parent.ownerDocument.createElement("div");
  view.className = "adw-loading-bar";
  Object.assign(view.style, {
    height: `${LOADING_BAR_HEIGHT}px`,
    left: "0px",
    pointerEvents: "none",
    position: "absolute",
    top: "0px",
    transformOrigin: "top left",
    width: `${SCREEN_CONFIG.width}px`,
    zIndex: "2",
  });
  parent.append(view);
  // Three CSS rows carry the existing fill colours without a border taking their rows.
  const bar = createDomProgressBar(
    view,
    { ...GAME_PROGRESS_STYLE, border: 0 },
    {
      height: LOADING_BAR_HEIGHT,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: 0,
    },
    LOADING_TIMING,
  );
  bar.element.setAttribute(
    "aria-label",
    parent.getAttribute("aria-label") ?? parent.ownerDocument.title,
  );
  const place = () => {
    view.style.transform = `scaleX(${parent.clientWidth / SCREEN_CONFIG.width})`;
  };
  const observer = new ResizeObserver(place);
  observer.observe(parent);
  place();
  const stop = progress.subscribe((snapshot) => bar.report(snapshot));
  let disposed = false;
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      stop();
      observer.disconnect();
      bar.remove();
      view.remove();
    },
    element: view,
  };
}
