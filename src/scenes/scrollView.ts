import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData, SCREEN_CONFIG } from "../data/index.ts";
import { LIST_FLING, type ScrollRule } from "../input/index.ts";
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
  const camera = list.filterCamera;
  if (camera === null) {
    return;
  }
  // Context focus assumes a zero viewport origin when compositing. Capture on the authored
  // logical grid and let the parent camera place the result, including its letterbox offset.
  list.setFiltersAutoFocus(false);
  list.setFiltersFocusContext(false);
  list.setFilterSize(SCREEN_CONFIG.width, SCREEN_CONFIG.height);
  camera.setOrigin(0, 0);
  list.filters?.internal.addMask(key);
}
