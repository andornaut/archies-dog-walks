import {
  type OutsideArea,
  type OutsidePress,
  outsidePressMove,
} from "@andornaut/game-kit/runtime/input/outsideTap";
import { catchOutsideTaps } from "@andornaut/game-kit/runtime/input/phaser/catchOutsideTaps";
import type { PressGate } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import type { Events, Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { openGuard } from "../input/index.ts";
import { logicalInput } from "../input/phaser/index.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import { read } from "../rules/index.ts";
import { deviceFitOwned, logicalBackingBounds, worldFit } from "../ui/index.ts";
import { listenPagePresses } from "./pagePresses.ts";
import type { SceneKey } from "./sceneKeys.ts";

const nativeInputs = new WeakMap<Scene, Set<PressGate>>();

// Scene-owned page and back routes use the same captured admission as their native panel.
export function trackNativeSceneInput(scene: Scene, input: PressGate): () => void {
  const owners = nativeInputs.get(scene) ?? new Set<PressGate>();
  owners.add(input);
  nativeInputs.set(scene, owners);
  return () => {
    owners.delete(input);
    if (owners.size === 0) {
      nativeInputs.delete(scene);
    }
  };
}

function nativeSceneInput(scene: Scene): PressGate {
  const current = () =>
    [...(nativeInputs.get(scene) ?? [])].reverse().find((input) => input.accepts());
  return {
    accepts: () => !nativeInputs.has(scene) || current() !== undefined,
    capture: () => {
      const owner = current();
      if (owner !== undefined) {
        return owner.capture();
      }
      const empty = !nativeInputs.has(scene);
      return () => empty && !nativeInputs.has(scene);
    },
  };
}

// Scene keyboard routes share the native panel's current paint and modal admission.
export function nativeSceneAccepts(scene: Scene): boolean {
  return scene.sys.isActive() && scene.input.enabled && nativeSceneInput(scene).accepts();
}

// Emitted on game.events, with whether sound is now muted, when a top bar's Sound button is
// tapped over an overlay (the home top bar's, or the walk bar's), so the screen under it and the
// settings redraw and say so.
export const BAR_MUTED_EVENT = "bar-muted";

// What every overlay is launched with: the scene under it, which it resumes on close.
export interface OverlayData {
  resume?: SceneKey;
}

const overlayGuard = openGuard();

// Pauses scene and launches the overlay key over it at once, a tap's burst playing on over the
// overlay (addTapBurst). Phaser applies both at its next step, so a second open asked of scene
// before then is dropped (openGuard). Returns whether it opened.
export function openOverlay(scene: Scene, key: SceneKey, data: OverlayData): boolean {
  return overlayGuard(scene.game.events, scene, () => {
    const invoking =
      typeof document === "undefined" ? null : (document.activeElement as HTMLElement);
    if (invoking !== null && invoking !== document.body) {
      onceSceneEvent(scene, scene.events, "resume", () => {
        // The resumed scene restores its native panel at the next render boundary.
        onceSceneEvent(scene, scene.game.events, "postrender", () => {
          if (
            nativeSceneAccepts(scene) &&
            invoking.isConnected &&
            !invoking.closest("[inert], [hidden]")
          ) {
            focusTarget(invoking);
          }
        });
      });
    }
    scene.scene.pause();
    scene.scene.launch(key, data);
  });
}

// Resumes the scene under overlay, if it has one, and stops overlay.
export function closeOverlay(resume: SceneKey | undefined, overlay: Scene): void {
  if (resume !== undefined) {
    overlay.scene.resume(resume);
  }
  overlay.scene.stop();
}

// Listens for a window event, such as PHONE_EVENTS.backPressed, until scene shuts down.
export function onWindowEvent(scene: Scene, type: string, listener: () => void): void {
  window.addEventListener(type, listener);
  scene.events.once("shutdown", () => window.removeEventListener(type, listener));
}

// Listens for an event on emitter, such as game.events, another scene's events or the scene's
// own, until scene shuts down, so a scene started again never hears it twice.
export function onSceneEvent<Args extends unknown[]>(
  scene: Scene,
  emitter: Events.EventEmitter,
  type: string,
  listener: (...args: Args) => void,
): void {
  emitter.on(type, listener);
  scene.events.once("shutdown", () => emitter.off(type, listener));
}

// Listens once for an event on emitter, as onSceneEvent does, dropping the listener unheard if
// scene shuts down first.
export function onceSceneEvent<Args extends unknown[]>(
  scene: Scene,
  emitter: Events.EventEmitter,
  type: string,
  listener: (...args: Args) => void,
): void {
  emitter.once(type, listener);
  scene.events.once("shutdown", () => emitter.off(type, listener));
}

// Calls back on the phone's back button while scene is running, so a screen paused under an
// overlay leaves the press to the overlay.
export function onBackPressed(scene: Scene, back: () => void): void {
  onWindowEvent(scene, PHONE_EVENTS.backPressed, () => {
    if (nativeSceneAccepts(scene)) {
      back();
    }
  });
}

// Closes an overlay the ways every overlay closes besides its own controls: the phone's back
// button, and a tap outside it (listenOutsideTap) in area, around its panel and any control
// drawn outside the panel, or on the page beside the game. A full-screen page covers the screen
// itself, so only the page beside the game counts. back is what the back button does, as Escape
// does (isPauseKey): close unless a card is open over the overlay, which closes first.
export function listenDismiss(
  scene: Scene,
  area: OutsideArea,
  close: () => void,
  back: () => void = close,
): void {
  onBackPressed(scene, back);
  listenOutsideTap(scene, () => area, close);
}

// Calls onTap on a tap in area outside the overlay's panel, or on the bare page beside the game,
// as its close control or Resume would. A press that travels past the tap distance is a drag and
// taps nothing. A press that lands outside on the canvas never reaches the scenes under the
// overlay (the kit's catchOutsideTaps), so the tap that closes it selects and presses nothing
// there. area is read as each press lands: undefined while no panel is open, so the press taps
// nothing.
export function listenOutsideTap(
  scene: Scene,
  area: () => OutsideArea | undefined,
  onTap: () => void,
): void {
  const tapMaxDistance = read(gameData.tuning, "pixels", "tapMaxDistance");
  listenPageTap(scene, tapMaxDistance, () => area() !== undefined, onTap);
  const input = nativeSceneInput(scene);
  const canvas = logicalInput(scene);
  const captured = new Map<number, () => boolean>();
  let released: (() => boolean) | undefined;
  canvas.input.on("pointerdown", (pointer: { id: number }) =>
    captured.set(pointer.id, input.capture()),
  );
  const release = (pointer: { id: number }) => {
    released = captured.get(pointer.id);
    captured.delete(pointer.id);
  };
  canvas.input.on("pointerup", release);
  canvas.input.on("pointerupoutside", release);
  catchOutsideTaps(
    tapMaxDistance,
    canvas,
    () => {
      const open = input.accepts() ? area() : undefined;
      if (open === undefined || !deviceFitOwned(scene.scale)) {
        return open;
      }
      return { ...open, bounds: logicalBackingBounds(worldFit(scene.scale)) };
    },
    () => {
      if (released?.()) {
        onTap();
      }
    },
  );
}

// Calls onTap on a tap on the bare page beside the game's canvas (listenPagePresses) while scene
// is running, takes input and open says a panel is open, so an overlay paused under another, or
// holding its input off (guardScreenInput), never takes it.
function listenPageTap(
  scene: Scene,
  tapMaxDistance: number,
  open: () => boolean,
  onTap: () => void,
): void {
  const input = nativeSceneInput(scene);
  const counts = () => scene.sys.isActive() && scene.input.enabled && input.accepts() && open();
  let press: (OutsidePress & { readonly accepted: () => boolean }) | undefined;
  listenPagePresses(scene, {
    cancel: () => {
      press = undefined;
    },
    down: (_press, point) => {
      press = counts() ? { accepted: input.capture(), start: point, tapping: true } : undefined;
    },
    move: (_press, point) => {
      if (press !== undefined) {
        press = { ...press, ...outsidePressMove(tapMaxDistance, point, press) };
      }
    },
    up: (_press, point, onBare) => {
      const tapped =
        press !== undefined &&
        onBare &&
        press.accepted() &&
        counts() &&
        outsidePressMove(tapMaxDistance, point, press).tapping;
      press = undefined;
      if (tapped) {
        onTap();
      }
    },
  });
}
