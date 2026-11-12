// Install error handling before importing the game's renderer and other modules.
import "./crash/install.ts";
import "@andornaut/game-kit/web/view/frameTurnPortraitGame.css";
import "@andornaut/game-kit/web/progress/dom/progressBar.css";
import "./main.css";

import { trackInputModality } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { SCREEN_LAYOUT } from "./data/screen.ts";
import { mountDomLoadingBar } from "./ui/dom/domLoadingBar.ts";
import { startupLoad, startupProgress } from "./ui/startupProgress.ts";

// A screen that focuses its first control on open shows the focus ring only after keyboard
// input, never on touch (the kit's focusTarget).
trackInputModality(document);

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
