// Remembers, per device, that the start screen has suggested installing the game, so it does so
// once. Installing is per device, so the flag sits beside the save under its own key rather
// than in it. Firefox on a desktop cannot install the game, so it is never suggested there.
import type { SaveStorage } from "@andornaut/game-kit/save/storage";
import {
  type InstallState,
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/web/pwa/installState";

export const INSTALL_NUDGE_KEY = "archies-dog-walks.install-nudged";
const SHOWN = "1";

export interface InstallNudge {
  // Whether the suggestion may show now: the flag has been read and is unset, the browser can
  // install the game, and the state offers a way to install.
  due(state: InstallState): boolean;
  // Records that it showed. A failed write is ignored: the flag stays set for the session.
  markShown(): void;
  // Settles once the flag has been read.
  readonly ready: Promise<void>;
}

// Reads the flag at once. Until the read settles, and when it fails, the suggestion counts as
// shown, so storage the game cannot write never makes it repeat.
export function createInstallNudge(
  stepsKind: InstallStepsKind,
  storage: SaveStorage,
): InstallNudge {
  const installable = stepsKind !== "firefoxDesktop";
  let shown = true;
  let marked = false;
  const ready = storage.read(INSTALL_NUDGE_KEY).then(
    (value) => {
      shown = marked || value === SHOWN;
    },
    () => undefined,
  );
  return {
    due: (state) => installable && !shown && offersInstall(state),
    markShown() {
      marked = true;
      shown = true;
      storage.write(INSTALL_NUDGE_KEY, SHOWN).catch(() => undefined);
    },
    ready,
  };
}
