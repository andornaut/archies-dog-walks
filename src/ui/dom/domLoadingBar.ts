import type { ProgressSource } from "@andornaut/game-kit/progressState";
import type { Rect } from "@andornaut/game-kit/rect";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { GAME_PROGRESS_STYLE, LOADING_TIMING } from "../progressBar.ts";

// The kit's DOM loading bar over the game's canvas, at frame in game pixels, following progress
// for the page's life: hidden while idle. The kit's progressBar.css moves it, so it animates with
// no script frames, before the game's renderer runs and while its loop sleeps. The canvas fits
// parent's height at the top, centred across (main.ts's Phaser scale), so the bar's view does
// too. setShown(false) hides it whatever progress says.
export function mountDomLoadingBar(
  parent: HTMLElement,
  frame: Rect,
  progress: ProgressSource,
): { setShown(shown: boolean): void } {
  const view = document.createElement("div");
  Object.assign(view.style, {
    left: "0",
    pointerEvents: "none",
    position: "absolute",
    top: "0",
    transformOrigin: "top left",
  });
  parent.append(view);
  const bar = createDomProgressBar(view, GAME_PROGRESS_STYLE, frame, LOADING_TIMING);
  bar.element.setAttribute("aria-label", parent.getAttribute("aria-label") ?? document.title);
  const place = () => {
    const scale = Math.min(
      parent.clientWidth / SCREEN_CONFIG.width,
      parent.clientHeight / SCREEN_CONFIG.height,
    );
    const x = (parent.clientWidth - SCREEN_CONFIG.width * scale) / 2;
    view.style.transform = `translateX(${x}px) scale(${scale})`;
  };
  const resize = new ResizeObserver(place);
  resize.observe(parent);
  place();
  // A finished measured load shows full until the stylesheet hides it; a finished load of
  // unknown size hides the bar at once.
  progress.subscribe((snapshot) => bar.report(snapshot));
  return {
    setShown: (shown) => {
      view.hidden = !shown;
    },
  };
}
