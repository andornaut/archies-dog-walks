import { keysOf } from "@andornaut/game-kit/runtime/records";

import type { DogId, GearId, WalkerId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import { walkLength } from "../rules/index.ts";
import { MAX_RUN_DOGS } from "../save/index.ts";
import type { RunSetupLimits } from "./runSetup.ts";

const SPEED_LIMITS = { max: 10, min: 0.1 };

export function runSetupLimitsFor(
  data: Pick<GameData, "dogs" | "shopGear" | "walkers" | "world">,
): RunSetupLimits<DogId, GearId, WalkerId> {
  return {
    dogIds: keysOf(data.dogs),
    gearIds: keysOf(data.shopGear),
    maxPackSize: MAX_RUN_DOGS,
    speed: SPEED_LIMITS,
    walkerIds: keysOf(data.walkers),
    zoneCount: walkLength(data),
    zoneIds: data.world.zones.map(({ id }) => id),
  };
}
