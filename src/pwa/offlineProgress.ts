import { createProgressState, type ProgressHandle } from "@andornaut/game-kit/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";

export const offlineProgress = createProgressState();
let pending: ProgressHandle | undefined;

// Only a first visit's precache, which the player waits on, shows the loading line, without a
// percentage; updates install in the background and show nothing.
export function reportOfflineActivity(activity: OfflineActivity): void {
  if (activity === "precaching") {
    pending ??= offlineProgress.begin();
  } else {
    pending?.finish();
    pending = undefined;
  }
}
