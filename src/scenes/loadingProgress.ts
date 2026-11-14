import { createLayeredProgress, createProgressState } from "@andornaut/game-kit/progressState";

import { offlineProgress } from "../pwa/offlineProgress.ts";
import { requiredUpdateProgress } from "../pwa/requiredUpdate.ts";
import { acceptedUpdateProgress } from "../pwa/updateAcceptance.ts";
import { LOADING_TIMING } from "../ui/progressBar.ts";

// The loads the player waits for, one at a time: boot (with a resumed walk's art behind the
// loading screen) and Start walk's wait for the walk's art, measured by settled files (the kit's
// watchLoader, marked with waitFor), and the walk's planning, which has no denominator. Every
// other load, such as the art behind the home screen, is silent.
export const waitedLoad = createProgressState();

// Required-save updates retain priority over an optional update the player accepted.
const updateProgress = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: acceptedUpdateProgress,
  foreground: requiredUpdateProgress,
});

// The background work a bar shows: a required or accepted update over a first visit's precache.
export const backgroundLoad = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: offlineProgress,
  foreground: updateProgress,
});

// What every loading bar follows: a waited-for load over the background work.
export const loadingProgress = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: backgroundLoad,
  foreground: waitedLoad,
});
