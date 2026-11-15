// Install error handling before importing the game's renderer and other modules.
import "./crash/install.ts";
import "@andornaut/game-kit/runtime/web/view/frameTurnPortraitGame.css";
import "@andornaut/game-kit/runtime/web/progress/dom/progressBar.css";
import "./main.css";

import { createLayeredProgress, createProgressState } from "@andornaut/game-kit/runtime/progressState";
import { trackInputModality } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { loadingProgress } from "./loadingProgress.ts";
import { mountDomLoadingBar } from "./ui/dom/domLoadingBar.ts";
import { LOADING_TIMING } from "./ui/progressBar.ts";
import { startupLoad, startupProgress } from "./ui/startupProgress.ts";

// A screen that focuses its first control on open shows the focus ring only after keyboard
// input, never on touch (the kit's focusTarget).
trackInputModality(document);

// Module startup hands the same widget over to the game's real loading stream.
const nativeProgress = createProgressState();
const gameProgress = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: loadingProgress,
  foreground: nativeProgress,
});
const progress = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: gameProgress,
  foreground: startupProgress,
});
const loading = mountDomLoadingBar(progress, document.documentElement);

// Module download and renderer setup have no measurable denominator.
void import("./main.ts")
  .then(({ startGame }) => startGame({ loading, nativeProgress }))
  .catch((error: unknown) => {
    startupLoad.finish();
    throw error;
  });
