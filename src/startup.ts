// Install error handling before importing the game's renderer and other modules.
import "./crash/install.ts";
import "@andornaut/game-kit/runtime/web/view/frameTurnPortraitGame.css";
import "@andornaut/game-kit/runtime/web/progress/dom/progressBar.css";
import "./main.css";

import {
  createLayeredProgress,
  createProgressState,
} from "@andornaut/game-kit/runtime/progressState";
import { trackInputModality } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { prepareSoundBanks } from "./audio/soundBankUrls.ts";
import { loadingProgress } from "./loadingProgress.ts";
import { startLaunch } from "./pwa/launch.ts";
import { launchGame } from "./pwa/launchGame.ts";
import { launchProgress } from "./pwa/launchProgress.ts";
import { mountDomLoadingBar } from "./ui/dom/domLoadingBar.ts";
import { mountLaunchFailure } from "./ui/dom/launchFailure.ts";
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
const startup = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: gameProgress,
  foreground: startupProgress,
});
// The launch's one determinate run, a first install's download through boot's reads, shows over
// everything else until boot hands over.
const progress = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: startup,
  foreground: launchProgress,
});
const loading = mountDomLoadingBar(progress, document.documentElement);

// The launch decides first: a first visit installs the complete build, so the game's modules,
// art and sounds then load from the installed build. Module download and renderer setup before
// the launch reports have no measurable denominator.
void launchGame(
  startLaunch(
    (retry) => mountLaunchFailure(retry, document.body),
    () => {
      startupLoad.finish();
      loading.dispose();
    },
  ),
  async () => {
    const [{ startGame }] = await Promise.all([import("./main.ts"), prepareSoundBanks()]);
    startGame({ loading, nativeProgress });
  },
).catch((error: unknown) => {
  startupLoad.finish();
  throw error;
});
