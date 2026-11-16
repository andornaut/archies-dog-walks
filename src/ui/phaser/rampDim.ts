import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { shownWorldRect } from "../worldFit.ts";
import { addModalShade } from "./draw.ts";
import { fitWorldCamera } from "./worldCamera.ts";

// Shade only the visible logical world region; native modal paint stays in its separate layer.
export function addRampDim(
  scene: Scene,
  rect: Rect,
  onDrawn?: () => void,
): readonly GameObjects.GameObject[] {
  fitWorldCamera(scene, scene.cameras.main);
  const shown = shownWorldRect(scene.cameras.main, rect);
  if (onDrawn !== undefined) {
    onceBeforeRender(scene, onDrawn);
  }
  return shown === undefined ? [] : [addModalShade(scene, shown.world)];
}

// Calls then once, before the game's next frame is rendered, unless scene shuts down first.
export function onceBeforeRender(scene: Scene, then: () => void): void {
  const { events } = scene.game;
  const forget = () => events.off(Core.Events.PRE_RENDER, then);
  events.once(Core.Events.PRE_RENDER, then);
  scene.events.once(Scenes.Events.SHUTDOWN, forget);
}
