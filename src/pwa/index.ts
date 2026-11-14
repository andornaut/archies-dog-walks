// The game as an installed phone app: the service worker and its update plate, the screen wake
// lock, the back gesture, visibility events, the page frame's turn and the orientation lock,
// audio unlock, the install offer and persistent storage. setupPhoneApp runs once from main.ts; the
// scenes listen for PHONE_EVENTS on window and call the functions below.
import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import type { FrameTurn } from "@andornaut/game-kit/view/pagePoint";
import { appCannotClose } from "@andornaut/game-kit/web/pwa/appWindow";
import { backCloseWatcher } from "@andornaut/game-kit/web/pwa/backNavigation";
import {
  browserCloseWatcher,
  guardBackNavigation,
} from "@andornaut/game-kit/web/pwa/dom/backNavigation";
import {
  type InstallFlow,
  type InstallOutcome,
  watchInstall,
} from "@andornaut/game-kit/web/pwa/dom/installFlow";
import {
  browserOfflinePage,
  type LaunchResult,
  type OfflinePlay,
  startOfflinePlay,
} from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import type { UpdateFlow } from "@andornaut/game-kit/web/pwa/dom/updateReady";
import { watchVisibility } from "@andornaut/game-kit/web/pwa/dom/visibility";
import {
  createScreenWakeLock,
  type ScreenWakeLock,
} from "@andornaut/game-kit/web/pwa/dom/wakeLock";
import type { InstallState, InstallStepsKind } from "@andornaut/game-kit/web/pwa/installState";
import { serviceWorkerUrl } from "@andornaut/game-kit/web/pwa/serviceWorkerUrl";
import {
  requestPersistentStorage,
  type StoragePersistence,
} from "@andornaut/game-kit/web/pwa/storagePersistence";
import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";
import {
  type FrameTurnWatch,
  lockGameOrientation,
  watchFrameTurn,
} from "@andornaut/game-kit/web/view/dom/watchFrameTurn";

import { chooseSoundFormat, type SoundFormat } from "../audio/soundFormat.ts";
import type { StorageState } from "../save/profile.ts";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events.ts";
import { createInstallNudge, type InstallNudge } from "./installNudge.ts";
import { reportOfflineActivity } from "./offlineProgress.ts";
import { reportRequiredUpdate } from "./requiredUpdate.ts";
import { acceptedUpdateProgress } from "./updateAcceptance.ts";

export { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock.ts";
export { PHONE_EVENTS } from "./events.ts";
export type { InstallOutcome } from "@andornaut/game-kit/web/pwa/dom/installFlow";
export {
  type InstallState,
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/web/pwa/installState";
export type { StoragePersistence } from "@andornaut/game-kit/web/pwa/storagePersistence";

const SERVICE_WORKER_URL = "/sw.js";

// The sound format BootScene loads and the service worker precaches.
export function browserSoundFormat(): SoundFormat | undefined {
  const audio = document.createElement("audio");
  return chooseSoundFormat((mimeType) => audio.canPlayType(mimeType));
}

// Whether the game offers to leave, read once at load (exitShown).
let leaveOffered = false;
let installFlow: InstallFlow | undefined;
let installNudge: InstallNudge | undefined;
let persistence: Promise<StoragePersistence> = Promise.resolve("unsupported");
let screenWakeLock: ScreenWakeLock | undefined;
let updateFlow: UpdateFlow | undefined;
// Registration readiness and update-offer visibility follow the actual start screen.
let registrationHook: () => void = () => undefined;
let offerHook: (visible: boolean) => void = () => undefined;
// Whether the home screen shows the update plate.
let updateShown = false;
let accepting: ProgressHandle | undefined;
let updateFailed = false;
// The update a save from a newer version requires, from the first report on; undefined while
// none is required.
let required: RequiredUpdateState | undefined;

// The history state key of the entry that keeps back on the game (the kit's guardBackNavigation).
const BACK_GUARD_STATE_KEY = "archiesDogWalksBackGuard";

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads. The kit's offline play: a page a version controls runs the version
// on disk and registers after its launch check, so a newer version downloads while the game
// plays, and is offered on the home screen only once it is stored; a first visit registers once
// the home screen shows, so the precache does not compete with the game's own downloads. The page
// coming back into view on the home screen checks for a newer version (an installed app resumed
// without relaunching).
function registerServiceWorker(): OfflinePlay | undefined {
  const page = import.meta.env.PROD ? browserOfflinePage() : undefined;
  if (page === undefined) {
    return undefined;
  }
  const play = startOfflinePlay(
    {
      onOfflineActivity: reportOfflineActivity,
      onRequireNewer: reportRequired,
      onUpdateShown: (shown) => {
        updateShown = shown;
        dispatchPhoneEvent(window, PHONE_EVENTS.updatePlate);
      },
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, browserSoundFormat()),
    },
    page,
  );
  updateFlow = play.flow;
  registrationHook = () => play.registrationReady();
  offerHook = (visible) => play.flow.setOfferVisible(visible);
  return play;
}

function reportRequired(state: RequiredUpdateState): void {
  required = state;
  reportRequiredUpdate(state);
  dispatchPhoneEvent(window, PHONE_EVENTS.requiredUpdate);
}

// Sets up the phone app and checks for an already-staged launch before saves or the game open.
export function setupPhoneApp(): Promise<LaunchResult> {
  const launch = registerServiceWorker()?.launchReady() ?? Promise.resolve("continue" as const);
  installFlow = watchInstall(window);
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  persistence = requestPersistentStorage(
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
  // Read before the guard pushes any entry. An installed app that cannot close its window keeps
  // its own back, so the game never asks Quit? there.
  const closeWatcher = backCloseWatcher(navigator.userAgent, browserCloseWatcher());
  leaveOffered = !appCannotClose(closeWatcher, window);
  if (leaveOffered) {
    // Each back the guard keeps opens the pause menu or Quit?, as the scenes decide.
    guardBackNavigation(
      {
        onBack: () => dispatchPhoneEvent(window, PHONE_EVENTS.backPressed),
        stateKey: BACK_GUARD_STATE_KEY,
      },
      window,
      window,
      closeWatcher,
      history,
    );
  }
  const wakeLock = "wakeLock" in navigator ? navigator.wakeLock : undefined;
  screenWakeLock = createScreenWakeLock(window, document, wakeLock);
  // Held whenever the game is visible until the scenes take over with stopWakeLock and
  // startWakeLock (for example, letting the screen sleep on a menu).
  screenWakeLock.start();
  return launch;
}

// Whether the game offers to leave (the home top bar's Exit, Q and back's Quit?), as read at load:
// in a browser tab, which goes to the site's home page, and in an installed app that can close its
// window, which closes; never in another installed app (the kit's appCannotClose: an app whose
// platform never closes, by APP_WINDOW_CLOSES, or whose history holds more than the game's entry).
export function exitShown(): boolean {
  return leaveOffered;
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

// Whether the home screen is in front, the only place the update plate shows. A first visit
// registers the service worker on its first arrival home.
export function setOnHomeScreen(onHome: boolean): void {
  if (onHome) {
    registrationHook();
  }
  offerHook(onHome);
}

// An arrival at the home screen: the launch's first StartScene and each one after a walk, never a
// menu or card closing over it. It clears a dismissed offer and checks for a newer version.
export function arriveHome(): void {
  updateFlow?.arriveHome();
}

// Dismiss the update offer until the next arrival home (arriveHome) or the page coming back into
// view on the home screen.
export function dismissUpdateOffer(): void {
  updateFailed = false;
  updateFlow?.dismissOffer();
}

// Whether the home screen shows the update plate: a newer version waits, fully stored, behind the
// version that controls the page, with the home screen in front and the offer not dismissed.
// PHONE_EVENTS.updatePlate fires on each change.
export function updatePlateShown(): boolean {
  return accepting === undefined && (updateShown || updateFailed);
}

export function updateAccepting(): boolean {
  return accepting !== undefined;
}

export function updateAcceptanceFailed(): boolean {
  return updateFailed;
}

// The update offer's Update now button: switch to the waiting version and reload into it. The
// offer shows only while a version waits, so only with a service worker.
export function acceptUpdate(): void {
  const flow = updateFlow;
  if (flow === undefined || accepting !== undefined || required !== undefined) {
    return;
  }
  accepting = acceptedUpdateProgress.begin();
  updateFailed = false;
  dispatchPhoneEvent(window, PHONE_EVENTS.updatePlate);
  const blocked = () => {
    accepting?.finish();
    accepting = undefined;
    updateFailed = true;
    dispatchPhoneEvent(window, PHONE_EVENTS.updatePlate);
  };
  // "reloading" only means navigation was requested. Keep the wait visible until the next
  // document replaces this one, rather than claiming the new version has loaded.
  try {
    void flow.accept().then((result) => {
      if (result === "blocked") {
        blocked();
      }
    }, blocked);
  } catch {
    blocked();
  }
}

// A save or earned record from a newer version requires that version, whatever the player does:
// the kit downloads it and switches to it once stored, never offering it ("updating"), or waits
// to be online and tries again ("unavailable"). Without a service worker nothing can update, so
// the update stays "unavailable". Repeated calls change nothing.
export function noteSaveStorage(storage: StorageState): void {
  if (storage !== "newer") {
    return;
  }
  if (updateFlow !== undefined) {
    updateFlow.requireNewer();
  } else if (required === undefined) {
    reportRequired("unavailable");
  }
}

// The update a newer save requires, or undefined while none is. While one is, the save stays as
// stored, Start and walks stay closed and the game loop sleeps between home screen changes.
// PHONE_EVENTS.requiredUpdate fires on each change.
export function requiredUpdate(): RequiredUpdateState | undefined {
  return required;
}

// What the browser answered when asked to keep the game's storage, for the dev panel.
export function storagePersistence(): Promise<StoragePersistence> {
  return persistence;
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
