import {
  createLayeredProgress,
  createProgressState,
} from "@andornaut/game-kit/runtime/progressState";

import { requiredUpdateProgress } from "./pwa/requiredUpdate.ts";
import { acceptedUpdateProgress } from "./pwa/updateAcceptance.ts";
import { LOADING_TIMING } from "./ui/progressBar.ts";

// The loads the player waits for, one at a time: boot (with a resumed walk's art behind the
// loading screen) and Start walk's wait for the walk's art, measured by settled files (the kit's
// watchLoader, marked with waitFor), and the walk's planning, which has no denominator. Every
// other load, such as the art behind the home screen, is silent.
export const waitedLoad = createProgressState();

// The update work a bar shows: a required-save update over one the player accepted with Update
// now. Background staging shows nothing.
export const backgroundLoad = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: acceptedUpdateProgress,
  foreground: requiredUpdateProgress,
});

// What every loading bar follows: a waited-for load over the background work.
export const loadingProgress = createLayeredProgress(globalThis, LOADING_TIMING, {
  background: backgroundLoad,
  foreground: waitedLoad,
});
