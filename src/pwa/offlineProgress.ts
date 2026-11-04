import { createProgressState, type ProgressHandle } from "@andornaut/game-kit/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";

export const offlineProgress = createProgressState();
let pending: ProgressHandle | undefined;

// Browser registration and cache installation report activity, without a percentage.
export function reportOfflineActivity(activity: OfflineActivity): void {
  if (activity === "idle") {
    pending?.finish();
    pending = undefined;
  } else {
    pending ??= offlineProgress.begin();
  }
}
