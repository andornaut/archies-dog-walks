import type { Scene } from "phaser";

import { NEXT_WALK_OFF, type NextWalk } from "../dev/cheats.ts";

// The Cheats modal's choices for the next walk as the scenes share them through the game's
// registry, and whether a walk has started since the Start screen last showed. Nothing here is
// stored; the save's cheats (grants) change the save directly.
const NEXT_WALK_KEY = "cheatsNextWalk";
const WALKED_KEY = "cheatsWalkedSinceHome";

// Emitted on game.events after a cheat changes what the Start screen shows.
export const CHEATS_CHANGED_EVENT = "cheats-changed";

export function nextWalk(scene: Scene): NextWalk {
  return (scene.registry.get(NEXT_WALK_KEY) as NextWalk | undefined) ?? NEXT_WALK_OFF;
}

export function setNextWalk(scene: Scene, next: NextWalk): void {
  scene.registry.set(NEXT_WALK_KEY, next);
}

// Called as every walk starts, so the Start screen that follows clears the next walk's choices.
export function noteWalkStarted(scene: Scene): void {
  scene.registry.set(WALKED_KEY, true);
}

// Called as the Start screen opens: back from a walk, the next walk's choices are off, since they
// set up only the walk they started. Opening and closing a page over the Start screen keeps them.
export function clearNextWalkAfterWalk(scene: Scene): void {
  if (scene.registry.get(WALKED_KEY) !== true) {
    return;
  }
  scene.registry.set(WALKED_KEY, false);
  scene.registry.set(NEXT_WALK_KEY, NEXT_WALK_OFF);
}
