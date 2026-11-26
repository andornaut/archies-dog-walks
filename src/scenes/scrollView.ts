import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData, SCREEN_CONFIG } from "../data/index.ts";
import { LIST_FLING, type ScrollRule } from "../input/listScroll.ts";
import { read } from "../rules/index.ts";
import { paintRectMask } from "./rectMask.ts";

// A scrolling list's fling, and its drag once a press travels past the tap distance.
export const LIST_SCROLL_RULE: ScrollRule = {
  ...LIST_FLING,
  dragSlopPx: read(gameData.tuning, "pixels", "tapMaxDistance"),
};

// Clips list to rect, through a screen-sized texture named key, white over rect and repainted
// when rect changes (paintRectMask). Without WebGL there are no filters and the list is not
// clipped.
export function maskToRect(
  scene: Scene,
  key: string,
  rect: Rect,
  list: GameObjects.Container,
): void {
  if (paintRectMask(scene.textures, SCREEN_CONFIG, key, rect) === undefined) {
    return;
  }
  list.enableFilters();
  // Filter autofocus copies camera size and zoom but retains its independent origin.
  const camera = scene.cameras.main;
  list.filterCamera?.setOrigin(camera.originX, camera.originY);
  list.filters?.internal.addMask(key);
}
