import type { Scene } from "phaser";

import type { RunScene } from "./RunScene.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

// An unfinished walk confirms and settles through its existing Home question and save path.
// Settled and home pages can return immediately without leaving covered scenes running.
export function requestTitleReturn(scene: Scene): void {
  const shown = (key: string) => scene.scene.isActive(key) || scene.scene.isPaused(key);
  if (shown(SCENE_KEYS.run)) {
    (scene.scene.get(SCENE_KEYS.run) as RunScene).openTitleQuestion();
    return;
  }
  for (const key of Object.values(SCENE_KEYS)) {
    if (key !== SCENE_KEYS.start && key !== SCENE_KEYS.boot && shown(key)) {
      scene.scene.stop(key);
    }
  }
  scene.scene.start(SCENE_KEYS.start);
}
