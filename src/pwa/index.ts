// The game as an installed phone app: the screen wake lock, the back gesture, visibility events,
// the page frame's turn and the orientation lock, audio unlock, the install offer, persistent
// storage and the launch's update state (src/pwa/launch.ts). setupPhoneApp runs once from
// main.ts; the scenes listen for PHONE_EVENTS on window and call the functions below.
import type { FrameTurn } from "@andornaut/game-kit/runtime/view/pagePoint";
import { canExitApp } from "@andornaut/game-kit/runtime/web/pwa/appWindow";
import { backCloseWatcher } from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import {
  type BackNavigationGuard,
  browserCloseWatcher,
  createBackNavigationGuard,
} from "@andornaut/game-kit/runtime/web/pwa/dom/backNavigation";
import {
  type InstallFlow,
  type InstallOutcome,
  watchInstall,
} from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import { watchVisibility } from "@andornaut/game-kit/runtime/web/pwa/dom/visibility";
import {
  createScreenWakeLock,
  type ScreenWakeLock,
} from "@andornaut/game-kit/runtime/web/pwa/dom/wakeLock";
import type {
  InstallState,
  InstallStepsKind,
} from "@andornaut/game-kit/runtime/web/pwa/installState";
import { requestPersistentStorage } from "@andornaut/game-kit/runtime/web/pwa/storagePersistence";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import {
  type FrameTurnWatch,
  lockGameOrientation,
  watchFrameTurn,
} from "@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn";

import type { StorageState } from "../save/index.ts";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events.ts";
import { createInstallNudge, type InstallNudge } from "./installNudge.ts";
import { requireNewer } from "./launch.ts";

export { browserSoundFormat } from "../audio/dom/index.ts";
export { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock.ts";
export { PHONE_EVENTS } from "./events.ts";
export {
  acceptUpdate,
  dismissUpdate,
  networkPlayReason,
  requiredUpdate,
  type RequiredUpdateState,
  updateAcceptanceFailed,
  updateAccepting,
  updateOffered,
} from "./launch.ts";
export type { InstallOutcome } from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
export {
  type InstallState,
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/runtime/web/pwa/installState";

// Explicit Exit is offered only where it closes the installed window.
let backGuard: BackNavigationGuard | undefined;
let exitCloses = false;
let installFlow: InstallFlow | undefined;
let installNudge: InstallNudge | undefined;
let screenWakeLock: ScreenWakeLock | undefined;

// The history state key of the entry that keeps back on the game (the kit's createBackNavigationGuard).
const BACK_GUARD_STATE_KEY = "archiesDogWalksBackGuard";

// Sets up the phone app, once the launch has decided to play this build.
export function setupPhoneApp(): void {
  installFlow = watchInstall(window);
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  void requestPersistentStorage(
    installFlow.state() === "installed",
    "storage" in navigator ? navigator.storage : undefined,
  );
  installNudge = createInstallNudge(installFlow.stepsKind, localSaveStorage());
  watchVisibility(window, document, (visible) =>
    dispatchPhoneEvent(window, visible ? PHONE_EVENTS.appVisible : PHONE_EVENTS.appHidden),
  );
  // On a touch screen in landscape the page frame turns onto its side, so the portrait game
  // stays upright for the device (the kit's frameTurnPortraitGame.css, imported by main.ts).
  // Where the browser allows it, the installed app holds the screen in portrait instead.
  pageFrameWatch();
  lockGameOrientation("portrait", screen);
  // Compute explicit Exit eligibility before the shared platform guard can own a marker.
  const closeWatcher = backCloseWatcher(navigator.userAgent, browserCloseWatcher());
  exitCloses = canExitApp(closeWatcher, window);
  if (backGuard === undefined) {
    const guard = createBackNavigationGuard(
      {
        createCloseWatcher: closeWatcher,
        history,
        onBack: () => dispatchPhoneEvent(window, PHONE_EVENTS.backPressed),
        stateKey: BACK_GUARD_STATE_KEY,
        timer: window,
      },
      window,
    );
    backGuard = guard;
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) {
        guard.dispose();
      }
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        guard.setEnabled(true);
      }
    });
  }
  backGuard.setEnabled(true);
  const wakeLock = "wakeLock" in navigator ? navigator.wakeLock : undefined;
  screenWakeLock = createScreenWakeLock(window, document, wakeLock);
  // Held whenever the game is visible until the scenes take over with stopWakeLock and
  // startWakeLock (for example, letting the screen sleep on a menu).
  screenWakeLock.start();
}

// Platform confirmation delegates departure eligibility and execution to the shared guard.
export function canLeaveFromBack(): boolean {
  return backGuard?.canLeave() ?? false;
}

export function leaveFromBack(): Promise<boolean> {
  return backGuard?.leave() ?? Promise.resolve(false);
}

// Whether explicit Quit is offered by the home top bar or Q, as read at load:
// only in an installed app whose window a script can close, which leaving closes (the kit's
// canExitApp). A browser tab never offers it, since leaving there would navigate away rather than
// close, and neither does an installed app that cannot close (an app whose platform never closes,
// by APP_WINDOW_CLOSES, or whose history holds more than the game's entry).
export function exitShown(): boolean {
  return exitCloses;
}

let frameWatch: FrameTurnWatch | undefined;

// The page frame's turn, watched from its first use (setupPhoneApp) for the page's life.
export function pageFrameWatch(): FrameTurnWatch {
  frameWatch ??= watchFrameTurn("portrait", window);
  return frameWatch;
}

// The page frame's turn now: 0 upright, or -90 or 90 on a touch screen in landscape.
export function pageFrameTurn(): FrameTurn {
  return pageFrameWatch().turn();
}

// Calls listener on each change of the page frame's turn, until the returned function is called.
export function onFrameTurnChange(listener: (turn: FrameTurn) => void): () => void {
  return pageFrameWatch().onChange(listener);
}

// Keep the screen on while the game is visible.
export function startWakeLock(): void {
  screenWakeLock?.start();
}

// Let the screen sleep.
export function stopWakeLock(): void {
  screenWakeLock?.stop();
}

// A save or earned record from a newer version requires that version (the launch's
// requireNewer). Repeated calls change nothing.
export function noteSaveStorage(storage: StorageState): void {
  if (storage === "newer") {
    requireNewer();
  }
}

// Before setupPhoneApp there is no install flow, and nothing offers to install.
export function installState(): InstallState {
  return installFlow?.state() ?? "installed";
}

// Calls listener on each change of the install state until the returned function is called.
export function onInstallStateChange(listener: (state: InstallState) => void): () => void {
  return installFlow?.onChange(listener) ?? (() => undefined);
}

// Shows the browser's install prompt, or tells the caller to show stepsKind's steps. Call it
// from the player's tap: the browser shows its prompt only during a gesture.
export function installApp(): Promise<InstallOutcome> {
  return installFlow?.install() ?? Promise.resolve("steps");
}

// The browser whose install steps installApp's steps outcome calls for.
export function stepsKind(): InstallStepsKind {
  return installFlow?.stepsKind ?? "other";
}

// Whether the start screen should suggest installing now: once per device, while the state
// offers a way to install.
export function installNudgeDue(): boolean {
  return installNudge?.due(installState()) ?? false;
}

export function noteInstallNudged(): void {
  installNudge?.markShown();
}

export {
  bootFinished,
  bootHandedOver,
  bootLoad,
  requestGameUpdateCheck,
  startLaunch,
} from "./launch.ts";
export { launchGame } from "./launchGame.ts";
export { launchProgress } from "./launchProgress.ts";
export { requiredUpdateProgress } from "./requiredUpdate.ts";
export { acceptedUpdateProgress } from "./updateAcceptance.ts";
