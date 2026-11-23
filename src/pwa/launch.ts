// The game's launch on the kit's one loader (runtime/web/pwa/dom/launch). A first visit installs
// the complete build, verified, under the loading screen before play; a later launch plays the
// active build at once and stages a newer one in the background, which Update now offers wherever
// the player is. startLaunch runs once from src/startup.ts before the game's modules load, so
// nothing reads or writes a save or builds Phaser before the launch decides. The scenes read the
// rest through src/pwa/index.ts.
import type { LoadingAttemptState } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import {
  type LaunchFailure,
  type LaunchResult,
  type NetworkPlayNotice,
  ObsoleteUpdateOfferError,
  type UpdateOffer,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import {
  browserLaunchContext,
  createLaunch,
  type RequiredUpdateState,
} from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

import { browserSoundFormat } from "../audio/soundFormat.ts";
import { CACHE_POLICY, SERVICE_WORKER_URL } from "./cachePolicy.ts";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events.ts";
import { reportLaunchProgress } from "./launchProgress.ts";
import { reportRequiredStaging, reportRequiredUpdate } from "./requiredUpdate.ts";
import { acceptedUpdateProgress } from "./updateAcceptance.ts";

// The first install's Loading failed view, shown before the game exists.
export interface LaunchFailureView {
  dispose(): void;
  update(state: LoadingAttemptState): void;
}

export type {
  LaunchResult,
  NetworkPlayNotice,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
export type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

// The share of boot's progress its loader's reads fill. The rest (registering the art, opening
// the profile and drawing the first screen) completes when boot hands over (bootHandedOver).
export const BOOT_READS_SHARE = 0.95;

let launch: ReturnType<typeof createLaunch> | undefined;
let booted = false;
// Why this launch plays from the network, where the device could not install the game.
let networkPlay: NetworkPlayNotice["reason"] | undefined;
// The update a newer save requires, from the first report on; undefined while none is required.
let required: RequiredUpdateState | undefined;
// The staged update Update now offers, until the player dismisses it.
let offer: UpdateOffer | undefined;
let accepting: ProgressHandle | undefined;
let acceptFailed = false;

function reportRequired(state: RequiredUpdateState): void {
  required = state;
  reportRequiredUpdate(state);
  dispatchPhoneEvent(window, PHONE_EVENTS.requiredUpdate);
}

function changedOffer(): void {
  dispatchPhoneEvent(window, PHONE_EVENTS.updateReady);
}

// The production build only: the dev server has no /sw.js, and a router would serve stale
// modules over hot reloads. Without a launch (the dev server, or a browser with no service
// workers or Cache Storage) the game plays from the network and "play" resolves at once. A
// first install that fails on the network or verification shows mountFailure's Loading failed;
// Retry resumes the install from the files already stored, and the launch resolves once it
// succeeds. Where the device cannot install (the router cannot register, or storage is full) the
// game plays from the network and the start screen says why (networkPlayReason); the next
// launch tries the install again.
export function startLaunch(mountFailure: (retry: () => void) => LaunchFailureView) {
  const context = import.meta.env.PROD ? browserLaunchContext(CACHE_POLICY) : undefined;
  if (context === undefined) {
    return Promise.resolve<LaunchResult>("play");
  }
  let failure: LaunchFailureView | undefined;
  let attempt = 0;
  let retry: () => void = () => undefined;
  const started = createLaunch(context, {
    onFailure: (next: LaunchFailure) => {
      attempt += 1;
      retry = next.retry;
      failure ??= mountFailure(() => {
        failure?.update({ attempt, kind: "loading" });
        retry();
      });
      failure.update({ attempt, error: next.reason, kind: "failed" });
    },
    onNetworkPlay: ({ reason }) => {
      networkPlay = reason;
    },
    onProgress: reportLaunchProgress,
    onRequireNewer: reportRequired,
    onUpdateReady: (next) => {
      offer = next;
      acceptFailed = false;
      changedOffer();
    },
    // Background staging never shows Loading failed or interrupts play; only a required update's
    // staging fills the loading line.
    onUpdateState: reportRequiredStaging,
    serviceWorkerUrl: SERVICE_WORKER_URL,
    // Only the alternative this page plays installs, counts and is checked; a browser that plays
    // neither format installs no sounds and the game is silent.
    soundFormat: browserSoundFormat(),
  });
  launch = started;
  return started.run().then((result) => {
    failure?.dispose();
    failure = undefined;
    if (result === "play") {
      // Shows the launch's progress at once, carried across a first install's reload.
      started.bootProgress(0, 1);
    }
    return result;
  });
}

// Boot's progress through the launch's one value, done of total in any unit, until boot hands
// over. Without a launch the boot's reads alone fill the line.
function bootProgress(done: number, total: number): void {
  if (booted) {
    return;
  }
  booted = done >= total;
  if (launch !== undefined) {
    launch.bootProgress(done, total);
  } else {
    reportLaunchProgress({ phase: booted ? "ready" : "booting", value: done / total });
  }
}

// Why this launch plays from the network rather than an installed build, or undefined when it
// installed (or had no launch to install with).
export function networkPlayReason(): NetworkPlayNotice["reason"] | undefined {
  return networkPlay;
}

// Whether boot has handed over to the first screen.
export function bootFinished(): boolean {
  return booted;
}

// A genuine return to Start or entry to play wakes the existing launch. Initial boot already
// checks for updates. The kit owns eligibility, coalescing and staging.
export function requestGameUpdateCheck(): void {
  if (bootFinished()) {
    launch?.requestUpdateCheck();
  }
}

// Boot has drawn the first screen: the launch's line fills and fades.
export function bootHandedOver(): void {
  bootProgress(1, 1);
}

// The progress a loader watch reports while boot loads: its reads count toward the launch's
// value (BOOT_READS_SHARE of boot) until boot hands over, and later waits, such as Start walk's,
// show on after's line.
export function bootLoad(after: { begin(): ProgressHandle }): { begin(): ProgressHandle } {
  return {
    begin() {
      if (booted) {
        return after.begin();
      }
      const reads: ProgressHandle = {
        finish: () => bootProgress(BOOT_READS_SHARE, 1),
        progress: (value) => {
          if (value !== undefined) {
            bootProgress(value * BOOT_READS_SHARE, 1);
          }
        },
      };
      return reads;
    },
  };
}

// A save or earned record from a newer version requires that version, whatever the player does:
// the kit stages it and switches to it once stored, never offering it ("updating"), or waits to
// be online and tries again ("unavailable"). Without a launch nothing can update, so the update
// stays "unavailable". Repeated calls change nothing.
export function requireNewer(): void {
  if (launch !== undefined) {
    launch.requireNewer();
  } else if (required === undefined) {
    reportRequired("unavailable");
  }
}

// The update a newer save requires, or undefined while none is. While one is, the save stays as
// stored and Start and walks stay closed. PHONE_EVENTS.requiredUpdate fires on each change.
export function requiredUpdate(): RequiredUpdateState | undefined {
  return required;
}

// Whether Update now is offered: a staged update finished downloading this session and the
// player has not dismissed it. PHONE_EVENTS.updateReady fires on each change.
export function updateOffered(): boolean {
  return offer !== undefined;
}

// Whether Update now is saving and switching, from the press until the next document replaces
// this one.
export function updateAccepting(): boolean {
  return accepting !== undefined;
}

// Whether the last Update now could not switch; the prompt says so and offers it again.
export function updateAcceptanceFailed(): boolean {
  return acceptFailed;
}

// Update now: waits for save, then activates the staged build and reloads into it with no
// download. An obsolete accepted offer closes only its own prompt; other failures keep retry.
export function acceptUpdate(save: () => Promise<void>): void {
  const current = offer;
  if (current === undefined || accepting !== undefined || required !== undefined) {
    return;
  }
  accepting = acceptedUpdateProgress.begin();
  acceptFailed = false;
  changedOffer();
  current.updateNow(save).catch((error: unknown) => {
    accepting?.finish();
    accepting = undefined;
    if (error instanceof ObsoleteUpdateOfferError) {
      if (error.version === current.version && offer === current) {
        offer = undefined;
        acceptFailed = false;
      }
    } else {
      console.warn("Update now could not switch builds.", error);
      acceptFailed = true;
    }
    changedOffer();
  });
}

// Dismissing the prompt continues play on this build; the next launch applies the update
// silently, before the save opens.
export function dismissUpdate(): void {
  if (offer === undefined || accepting !== undefined) {
    return;
  }
  offer.dismiss();
  offer = undefined;
  acceptFailed = false;
  changedOffer();
}
