// Install error handling before importing the game's renderer and other modules.
import "./crash/install.ts";
import "@andornaut/game-kit/web/view/frameTurnPortraitGame.css";
import "@andornaut/game-kit/web/progress/dom/progressBar.css";
import "./main.css";

import { SCREEN_LAYOUT } from "./data/screen.ts";
import { mountDomLoadingBar } from "./ui/dom/domLoadingBar.ts";
import { startupLoad, startupProgress } from "./ui/startupProgress.ts";

// The bar shows until the first frame draws, then goes. startupLoad is under way as it
// subscribes, so the first report never hides it.
const parent = document.getElementById("game");
if (parent !== null) {
  mountDomLoadingBar(parent, SCREEN_LAYOUT.zoneProgress, startupProgress, true);
}

// Module download and renderer setup have no measurable denominator.
void import("./main.ts").catch((error: unknown) => {
  startupLoad.finish();
  throw error;
});
