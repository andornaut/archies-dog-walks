import { createProgressState, type ProgressHandle } from "@andornaut/game-kit/progressState";
import type { DownloadProgress } from "@andornaut/game-kit/web/pwa/downloadProgress";
import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";

// The newer version a newer save requires, while it downloads: a load the player waits for, so
// it shows the travelling loading line, without a percentage. "unavailable" shows none; the home
// screen says the update is needed instead.
export const requiredUpdateProgress = createProgressState();
let pending: ProgressHandle | undefined;
let operation: Pick<DownloadProgress, "operationId" | "version"> | undefined;

export function reportRequiredUpdate(state: RequiredUpdateState): void {
  if (state === "updating") {
    pending ??= requiredUpdateProgress.begin();
  } else {
    pending?.finish();
    pending = undefined;
    operation = undefined;
  }
}

// The existing activity handle admits one installing worker's operation, not an older report.
export function reportRequiredDownload(snapshot: DownloadProgress): void {
  if (pending === undefined) {
    return;
  }
  operation ??= snapshot;
  if (operation.operationId === snapshot.operationId && operation.version === snapshot.version) {
    pending.progress(snapshot.phase === "downloading" ? snapshot.value : undefined);
  }
}
