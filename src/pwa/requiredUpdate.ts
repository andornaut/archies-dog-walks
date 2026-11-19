import {
  createProgressState,
  type ProgressHandle,
} from "@andornaut/game-kit/runtime/progressState";
import type { UpdateState } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

// A newer-save requirement shows the shared loading line: the newer build's staging fills it, and
// finding the build travels. "unavailable" shows no line; home shows the required-update notice.
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

// Background staging reports nothing to the player; only a required update shows its bytes.
export function reportRequiredStaging(state: UpdateState): void {
  if (pending !== undefined && state.phase === "staging") {
    pending.progress(state.value);
  }
}
