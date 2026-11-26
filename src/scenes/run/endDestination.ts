import type { RunState } from "../../state/index.ts";
import { SCENE_KEYS } from "../sceneKeys.ts";

export type EndDestination = "end" | "title";

// Only an explicitly confirmed navigation exit skips the already-saved results screen.
export function endSceneFor(destination: EndDestination, phase: RunState["phase"]) {
  return phase.kind === "ended" && phase.reason === "wentHome" && destination === "title"
    ? SCENE_KEYS.start
    : SCENE_KEYS.end;
}
