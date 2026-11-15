import type { ProgressSource } from "@andornaut/game-kit/progressState";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect } from "../../ui/domScale.ts";
import { GAME_PROGRESS_STYLE, LOADING_TIMING } from "../../ui/progressBar.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";
// The home load keeps animating in CSS while the game loop sleeps for a required update.
export function createHomeProgress(
  doc: Document,
  progress: ProgressSource,
): {
  readonly element: HTMLElement;
  place(scale: DomScale): void;
  dispose(): void;
} {
  const element = doc.createElement("div");
  element.className = "adw-framed";
  const frame = HOME_LAYOUT.loadingProgress;
  const bar = createDomProgressBar(
    element,
    GAME_PROGRESS_STYLE,
    { ...frame, x: 0, y: 0 },
    LOADING_TIMING,
  );
  const unsubscribe = progress.subscribe((snapshot) => bar.report(snapshot));
  return {
    dispose: () => {
      unsubscribe();
      bar.remove();
      element.remove();
    },
    element,
    place: (scale) => {
      setBox(element, frameRect(scale, frame));
      bar.element.style.transformOrigin = "top left";
      bar.element.style.transform = `scale(${artPixel(scale)})`;
    },
  };
}
