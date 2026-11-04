import { getOrInsertComputed } from "@andornaut/game-kit/maps";

import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen.ts";
import { formationOrder } from "../layout/packFormation.ts";
import { packDogs } from "../state/pack.ts";
import type { RunState } from "../state/runState.ts";
import type { RoadGeometry } from "./walk.ts";
import { walkGeometry, walkProjection } from "./walkGeometry.ts";

const ROAD = SCREEN_LAYOUT.road;
const VIEW = walkProjection(ROAD_CAMERA, ROAD);
const GEOMETRIES = new Map<string, RoadGeometry>();

// The road's geometry on the game's screen for the run's walker and walking dogs, which the run
// scene and the simulator both walk: one per pack, made once.
export function screenRoadGeometry(run: Pick<RunState, "pack" | "walker">): RoadGeometry {
  const pack = { dogs: formationOrder(packDogs(run)), walker: run.walker };
  const key = `${pack.walker} ${pack.dogs.join(" ")}`;
  return getOrInsertComputed(key, () => walkGeometry(LANE_COUNT, pack, VIEW, ROAD), GEOMETRIES);
}
