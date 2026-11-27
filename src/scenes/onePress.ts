import type { Input, Scene } from "phaser";

import { followOnePress, type PointerPhase } from "../input/index.ts";
import {
  canvasPressAllowed,
  type LogicalPointer,
  logicalPointer,
  primaryCanvasContact,
} from "../input/phaser/index.ts";

// cancelled: the browser called the press off (a system gesture, an incoming call), so its
// release picks nothing. A release outside the canvas is an ordinary release.
interface OnePressHandlers {
  down: (pointer: LogicalPointer) => void;
  move?: (pointer: LogicalPointer) => void;
  up: (pointer: LogicalPointer, cancelled: boolean) => void;
}

// Every scene but the walk follows one finger: the first one down, until it lifts.
export function listenOnePress(scene: Scene, handlers: OnePressHandlers): void {
  let owner: number | undefined;
  const ownerDown = () =>
    scene.input.manager.pointers.some(
      (pointer) => pointer.id === owner && pointer.isDown && primaryCanvasContact("move", pointer),
    );
  const on = (phase: "down" | "move" | "up", pointer: Input.Pointer) => {
    if (!primaryCanvasContact(phase, pointer) || (phase === "down" && !canvasPressAllowed(scene))) {
      return;
    }
    const cancelled = phase === "up" && pointer.wasCanceled;
    const followed: PointerPhase = cancelled ? "cancel" : phase;
    const step = followOnePress(ownerDown(), followed, pointer.id, owner);
    owner = step.owner;
    if (!step.handle) {
      return;
    }
    const point = logicalPointer(scene, pointer);
    if (phase === "down") {
      handlers.down(point);
    } else if (phase === "move") {
      handlers.move?.(point);
    } else {
      handlers.up(point, cancelled);
    }
  };
  scene.input.on("pointerdown", (pointer: Input.Pointer) => on("down", pointer));
  scene.input.on("pointermove", (pointer: Input.Pointer) => on("move", pointer));
  scene.input.on("pointerup", (pointer: Input.Pointer) => on("up", pointer));
  scene.input.on("pointerupoutside", (pointer: Input.Pointer) => on("up", pointer));
}
