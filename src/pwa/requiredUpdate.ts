import {
  createProgressState,
  type ProgressHandle,
} from "@andornaut/game-kit/runtime/progressState";
import type { DownloadProgress } from "@andornaut/game-kit/runtime/web/pwa/downloadProgress";
import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/updateReady";

// A newer-save requirement shows the shared loading line: known download byte totals fill it,
// and unmeasured phases travel. "unavailable" shows no line; home shows the required-update notice.
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
