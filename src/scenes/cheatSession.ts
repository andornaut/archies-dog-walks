import type { Scene } from "phaser";

import { NEXT_WALK_OFF, type NextWalk } from "../dev/cheats.ts";
import { endCheatSession, inCheatSession, startCheatSession } from "./profileStore.ts";

// The cheat session as the scenes share it through the game's registry: the next walk's choices,
// and whether a walk has started since the Start screen last showed. The save's side of the
// session is the profile's (ProfileSession.startCheats). Nothing here is stored.
const NEXT_WALK_KEY = "cheatsNextWalk";
const WALKED_KEY = "cheatsWalkedSinceHome";

// Emitted on game.events after a cheat changes what the Start screen shows.
export const CHEATS_CHANGED_EVENT = "cheats-changed";

export function nextWalk(scene: Scene): NextWalk {
  return (scene.registry.get(NEXT_WALK_KEY) as NextWalk | undefined) ?? NEXT_WALK_OFF;
}

// Using a cheat starts the cheat session, if none has started.
export function useCheat(scene: Scene): void {
  startCheatSession(scene);
}

// A Next walk choice is a cheat: setting one starts the cheat session.
export function setNextWalk(scene: Scene, next: NextWalk): void {
  useCheat(scene);
  scene.registry.set(NEXT_WALK_KEY, next);
}

// Called as every walk starts, so the Start screen that follows ends the session.
export function noteWalkStarted(scene: Scene): void {
  scene.registry.set(WALKED_KEY, true);
}

// Called as the Start screen opens: back from a walk, any cheat session ends, every cheat off and
// the save as it was before the first cheat. Opening and closing a page over the Start screen
// shows it again without ending it.
export function endCheatsAfterWalk(scene: Scene): void {
  if (scene.registry.get(WALKED_KEY) !== true) {
    return;
  }
  scene.registry.set(WALKED_KEY, false);
  if (inCheatSession(scene)) {
    endCheatSession(scene);
  }
  scene.registry.set(NEXT_WALK_KEY, NEXT_WALK_OFF);
}
