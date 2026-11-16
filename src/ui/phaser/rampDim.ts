import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { Core, type Game, type GameObjects, type Scene, Scenes } from "phaser";

import { MODAL_DARKNESS } from "../dimArt.ts";
import { shownWorldRect } from "../worldFit.ts";
import { fitWorldCamera } from "./worldCamera.ts";

interface ShadeRequest {
  readonly graphic: GameObjects.Graphics;
  readonly rect: Rect;
  readonly scene: Scene;
}
const shades = new WeakMap<Game, Set<ShadeRequest>>();

// Front overlay regions own their overlap; lower requests shade only uncovered world pixels.
function without(rect: Rect, over: Rect): Rect[] {
  const left = Math.max(rect.x, over.x),
    top = Math.max(rect.y, over.y),
    right = Math.min(rect.x + rect.width, over.x + over.width),
    bottom = Math.min(rect.y + rect.height, over.y + over.height);
  if (left >= right || top >= bottom) {
    return [rect];
  }
  return [
    { height: top - rect.y, width: rect.width, x: rect.x, y: rect.y },
    { height: rect.y + rect.height - bottom, width: rect.width, x: rect.x, y: bottom },
    { height: bottom - top, width: left - rect.x, x: rect.x, y: top },
    { height: bottom - top, width: rect.x + rect.width - right, x: right, y: top },
  ].filter((part) => part.width > 0 && part.height > 0);
}

// Original world colours under modal regions receive one neutral-black layer at existing strength.
export function addModalShade(scene: Scene, rect: Rect): GameObjects.Graphics {
  let requests = shades.get(scene.game);
  if (requests === undefined) {
    requests = new Set();
    shades.set(scene.game, requests);
  }
  const graphic = scene.add.graphics();
  const request = { graphic, rect, scene };
  requests.add(request);
  const refresh = () => {
    const order = scene.game.scene.scenes;
    const shown = [...requests]
      .filter((entry) => entry.graphic.active && entry.scene.sys.isVisible())
      .sort((left, right) => order.indexOf(left.scene) - order.indexOf(right.scene));
    [...requests].forEach((entry) => entry.graphic.clear());
    shown.forEach((entry, index) => {
      const pieces = shown
        .slice(index + 1)
        .reduce((parts, over) => parts.flatMap((part) => without(part, over.rect)), [entry.rect]);
      entry.graphic.fillStyle(0x000000, MODAL_DARKNESS);
      pieces.forEach((part) => entry.graphic.fillRect(part.x, part.y, part.width, part.height));
    });
  };
  const release = () => {
    requests.delete(request);
    scene.game.events.off(Core.Events.PRE_RENDER, refresh);
    scene.events.off("shutdown", release);
    graphic.off("destroy", release);
    graphic.clear();
    refresh();
  };
  scene.game.events.on(Core.Events.PRE_RENDER, refresh);
  scene.events.once("shutdown", release);
  graphic.once("destroy", release);
  refresh();
  return graphic;
}

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
