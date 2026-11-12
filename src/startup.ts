// Install error handling before importing the game's renderer and other modules.
import "./crash/install.ts";
import "@andornaut/game-kit/web/view/frameTurnPortraitGame.css";
import "@andornaut/game-kit/web/progress/dom/progressBar.css";
import "./main.css";

import { SCREEN_LAYOUT } from "./data/screen.ts";
import { mountDomLoadingBar } from "./ui/dom/domLoadingBar.ts";
import { startupLoad, startupProgress } from "./ui/startupProgress.ts";

// The bar travels until the first frame draws, then stays hidden.
const parent = document.getElementById("game");
if (parent !== null) {
  mountDomLoadingBar(parent, SCREEN_LAYOUT.zoneProgress, startupProgress);
}

// Module download and renderer setup have no measurable denominator.
void import("./main.ts").catch((error: unknown) => {
  startupLoad.finish();
  throw error;
});
