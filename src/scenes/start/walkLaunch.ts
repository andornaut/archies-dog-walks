import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import { Core, type Scene, type Time } from "phaser";

import { waitedLoad } from "../../loadingProgress.ts";
import { startWakeLock } from "../../pwa/index.ts";
import { artReady, waitForWalkArt, whenArtReady } from "../boot/artReady.ts";
import { nextWalk } from "../cheatChoices.ts";
import { HELP_CLOSED_EVENT } from "../HelpScene.ts";
import { openHelp } from "../helpScreen.ts";
import { onceSceneEvent } from "../overlay.ts";
import { nextRunStart } from "../run/runRecorder.ts";
import { type RunPick, runSceneData } from "../run/runStart.ts";
import { SCENE_KEYS } from "../sceneKeys.ts";

type ArtWaitKind = "help" | "start";

export function createWalkLaunch(
  scene: Scene,
  { pending, redraw }: { readonly pending: Set<Time.TimerEvent>; readonly redraw: () => void },
) {
  // The latest press waiting for the walk's art. Start stays pressed and dimmed while it waits.
  let artWait: { action: () => void; kind: ArtWaitKind } | undefined;
  let entry: object | undefined;
  let planning: ProgressHandle | undefined;

  function finishPlanning(): void {
    planning?.finish();
    planning = undefined;
  }

  function afterArt(kind: ArtWaitKind, action: () => void): void {
    if (artReady(scene)) {
      action();
      return;
    }
    const waiting = artWait !== undefined;
    artWait = { action, kind };
    if (kind === "start") {
      waitForWalkArt();
    }
    redraw();
    if (!waiting) {
      whenArtReady(scene, () => {
        const wait = artWait;
        artWait = undefined;
        redraw();
        wait?.action();
      });
    }
  }

  function begin(needsHelp: boolean, pick: RunPick): void {
    const go = () => {
      if (entry !== undefined) {
        return;
      }
      const token = {};
      entry = token;
      startWakeLock();
      artWait = { action: () => undefined, kind: "start" };
      // Planning has no denominator. Paint its travelling line before planning blocks.
      planning = waitedLoad.begin();
      planning.progress(undefined);
      redraw();
      onceSceneEvent(scene, scene.game.events, Core.Events.POST_RENDER, () => {
        if (entry !== token) {
          return;
        }
        const timer = scene.time.delayedCall(0, () => {
          pending.delete(timer);
          if (entry !== token) {
            return;
          }
          scene.scene.start(SCENE_KEYS.run, runSceneData(nextRunStart(nextWalk(scene)), pick));
        });
        pending.add(timer);
      });
    };
    if (!needsHelp) {
      go();
      return;
    }
    // A dropped help open leaves no listener.
    if (openHelp(scene, { region: "home", resume: SCENE_KEYS.start })) {
      onceSceneEvent(scene, scene.game.events, HELP_CLOSED_EVENT, go);
    }
  }

  return {
    afterArt,
    begin,
    // The screen clears its timers, then invalidates the art and entry callbacks.
    cancel() {
      artWait = undefined;
      finishPlanning();
      entry = undefined;
    },
    finishPlanning,
    waiting: () => artWait?.kind,
  };
}
