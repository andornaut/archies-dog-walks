import type { Scene } from "phaser";

import type { OverlayRegion } from "../home/homeBar.ts";
import { openOverlay, type OverlayData } from "./overlay.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";

// What help opens with: the scene under it, which it resumes on close, and where it opens, which
// sets whose top bar stays live over it: a home page's, or on a walk the walk bar.
export interface HelpData extends OverlayData {
  readonly region: OverlayRegion;
  readonly resume: SceneKey;
}

// Pauses the calling scene and opens help over it as a page; help resumes it on close. Returns
// whether it opened, as openOverlay does.
export function openHelp(scene: Scene, data: HelpData): boolean {
  return openOverlay(scene, SCENE_KEYS.help, data);
}
