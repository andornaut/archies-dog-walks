// Install error handling before importing the game's renderer and other modules.
import "./crash/install.ts";
import "@andornaut/game-kit/web/view/frameTurnPortraitGame.css";
import "@andornaut/game-kit/web/progress/dom/progressBar.css";
import "./main.css";

import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN_CONFIG, SCREEN_LAYOUT } from "./data/screen.ts";
import { GAME_PROGRESS_STYLE, LOADING_TIMING } from "./ui/progressBar.ts";
import { startupLoad, startupProgress } from "./ui/startupProgress.ts";

const parent = document.getElementById("game");
if (parent !== null) {
  const view = document.createElement("div");
  Object.assign(view.style, {
    left: "0",
    pointerEvents: "none",
    position: "absolute",
    top: "0",
    transformOrigin: "top left",
  });
  parent.append(view);
  const bar = createDomProgressBar(
    view,
    GAME_PROGRESS_STYLE,
    SCREEN_LAYOUT.zoneProgress,
    LOADING_TIMING,
  );
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
  const close = () => {
    stop();
    resize.disconnect();
    bar.remove();
    view.remove();
  };
  // A finished measured load shows full until the stylesheet hides it; a finished load of
  // unknown size hides the bar at once, which then goes. startupLoad is under way as this
  // subscribes, so the first report never hides it.
  const stop = startupProgress.subscribe((snapshot) => {
    bar.report(snapshot);
    if (bar.element.hidden) {
      close();
    }
  });
  window.addEventListener("pagehide", close, { once: true });
}

// Module download and renderer setup have no measurable denominator.
void import("./main.ts").catch((error: unknown) => {
  startupLoad.finish();
  throw error;
});
