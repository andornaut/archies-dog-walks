import { createProgressState, type ProgressHandle } from "@andornaut/game-kit/progressState";
import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";

// The newer version a newer save requires, while it downloads: a load the player waits for, so
// it shows the travelling loading line, without a percentage. "unavailable" shows none; the home
// screen says the update is needed instead.
export const requiredUpdateProgress = createProgressState();
let pending: ProgressHandle | undefined;

export function reportRequiredUpdate(state: RequiredUpdateState): void {
  if (state === "updating") {
    pending ??= requiredUpdateProgress.begin();
  } else {
    pending?.finish();
    pending = undefined;
  }
}
