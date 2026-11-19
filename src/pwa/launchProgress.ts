import {
  createProgressState,
  type ProgressHandle,
} from "@andornaut/game-kit/runtime/progressState";
import type { LaunchProgress } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

// The one loading run from a first install's download through boot's reads (the kit's
// LaunchProgress), a determinate value that the loading bar shows over every other load until
// boot hands over to the first screen.
export const launchProgress = createProgressState();
let pending: ProgressHandle | undefined;

export function reportLaunchProgress({ phase, value }: Pick<LaunchProgress, "phase" | "value">) {
  if (phase === "ready") {
    pending?.progress(1);
    pending?.finish();
    pending = undefined;
    return;
  }
  pending ??= launchProgress.begin();
  pending.progress(value);
}
