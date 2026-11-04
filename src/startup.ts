// Install error handling before importing the game's renderer and other modules.
import "./crash/install";
import "@andornaut/game-kit/web/view/frameTurnPortraitGame.css";
import "./main.css";

import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN_CONFIG, SCREEN_LAYOUT } from "./data/screen";
import { GAME_PROGRESS_STYLE } from "./ui/progressBar";
import { startupLoad, startupProgress } from "./ui/startupProgress";

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
  const bar = createDomProgressBar(view, GAME_PROGRESS_STYLE, SCREEN_LAYOUT.zoneProgress);
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
  const stop = startupProgress.subscribe(({ active, value }) => {
    view.hidden = !active;
    bar.update(value);
    if (!active) {
      resize.disconnect();
      bar.remove();
      view.remove();
    }
  });
  window.addEventListener(
    "pagehide",
    () => {
      stop();
      resize.disconnect();
      bar.remove();
      view.remove();
    },
    { once: true },
  );
}

// Module download and renderer setup have no measurable denominator.
void import("./main").catch((error: unknown) => {
  startupLoad.finish();
  throw error;
});
