import type { Point } from "@andornaut/game-kit/rect";
import type { Input, Scene } from "phaser";

import { deviceFitOwned, logicalWorldPoint, worldFit } from "../../ui/worldFit.ts";
import { canvasPressAllowed } from "./pressAdmission.ts";

export type LogicalPointer = Point &
  Readonly<Pick<Input.Pointer, "downTime" | "id" | "isDown" | "wasCanceled">>;

// DOM adapters already supply logical coordinates. Only native canvas events cross this
// boundary; the native pointer remains unchanged for Phaser's own camera and hit testing.
export function logicalPoint(scene: Pick<Scene, "scale">, point: Point): Point {
  return deviceFitOwned(scene.scale) ? logicalWorldPoint(worldFit(scene.scale), point) : point;
}

export function logicalPointer(
  scene: Pick<Scene, "scale">,
  pointer: Input.Pointer,
): LogicalPointer {
  return {
    ...logicalPoint(scene, pointer),
    downTime: pointer.downTime,
    id: pointer.id,
    isDown: pointer.isDown,
    wasCanceled: pointer.wasCanceled,
  };
}

// The published outside-tap adapter reads native pointer events. Supply its scene input
// boundary in logical coordinates without altering the events delivered to other listeners.
export function logicalInput(scene: Scene): Pick<Scene, "input"> {
  const input = Object.create(scene.input) as Scene["input"];
  input.on = (
    event: string | symbol,
    listener: (...args: unknown[]) => void,
    context?: unknown,
  ) => {
    scene.input.on(event, (pointer: Input.Pointer, ...rest: unknown[]) => {
      if (event === "pointerdown" && !canvasPressAllowed(scene)) {
        return;
      }
      listener.call(context, logicalPointer(scene, pointer), ...rest);
    });
    return input;
  };
  input.stopPropagation = () => scene.input.stopPropagation();
  return { input };
}
