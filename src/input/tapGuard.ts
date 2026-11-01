import type { LiveTuning } from "../data/types";
import { read } from "../rules/units";

// A choice card that breaks into the walk takes no
// tap, press or key until seconds.screenTapGuard has passed since the first frame it is drawn
// on, so a tap meant for the road never answers it (the kit's input/tapGuard).
export function tapGuardMs(tuning: LiveTuning): number {
  return read(tuning, "seconds", "screenTapGuard") * 1000;
}
