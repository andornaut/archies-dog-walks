import {
  createProgressState,
  type ProgressHandle,
} from "@andornaut/game-kit/runtime/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";
import type { DownloadProgress } from "@andornaut/game-kit/runtime/web/pwa/downloadProgress";

export const offlineProgress = createProgressState();
let pending: ProgressHandle | undefined;
let operation: Pick<DownloadProgress, "operationId" | "version"> | undefined;

// Only a first visit's precache shows the shared loading line. Known download byte totals fill
// it; unmeasured phases travel. Background updates show nothing.
export function reportOfflineActivity(activity: OfflineActivity): void {
  if (activity === "precaching") {
    pending ??= offlineProgress.begin();
  } else {
    pending?.finish();
    pending = undefined;
    operation = undefined;
  }
}

// The existing activity handle admits one installing worker's operation, not an older report.
export function reportOfflineDownload(snapshot: DownloadProgress): void {
  if (pending === undefined) {
    return;
  }
  operation ??= snapshot;
  if (operation.operationId === snapshot.operationId && operation.version === snapshot.version) {
    pending.progress(snapshot.phase === "downloading" ? snapshot.value : undefined);
  }
}
