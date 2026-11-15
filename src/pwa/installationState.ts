import type {
  InstallationState,
  OfflinePlay,
} from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";

export interface OfflineInstallation {
  retry(): Promise<void>;
  state(): InstallationState;
  subscribe(listener: (state: InstallationState) => void): () => void;
}

let state: InstallationState = {
  attempt: 0,
  kind: "idle",
  operationId: undefined,
  stage: "idle",
  version: undefined,
};
let owner: Pick<OfflinePlay, "retryInstallation"> | undefined;
const listeners = new Set<(state: InstallationState) => void>();

// The existing offline-play owner retains registration, singleflight and attempt identities.
export const offlineInstallation: OfflineInstallation = {
  async retry() {
    await owner?.retryInstallation();
  },
  state: () => state,
  subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },
};

export function reportInstallation(next: InstallationState): void {
  state = next;
  for (const listener of listeners) {
    listener(state);
  }
}

export function setInstallationOwner(play: Pick<OfflinePlay, "retryInstallation">): void {
  owner = play;
}
