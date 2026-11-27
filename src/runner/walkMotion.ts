import { type Pixels, pixels } from "@andornaut/game-kit/runtime/units";

import type { GameData } from "../data/index.ts";
import { currentZone, packAgility, read, zoneScrollSpeed } from "../rules/index.ts";
import type { RunState } from "../state/index.ts";
import type { LaneMotionConfig } from "./walk/laneMotion.ts";

// The last lane move time, scroll speed and zone length worked out, with the data groups and run
// fields they were worked out from. A walk asks for the same ones every step until its pack, zone,
// modifiers or debuffs or the data change; data and run states are never changed in place.
let lastLaneMove:
  | (Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers"> &
      Pick<RunState, "pack" | "walker"> & {
        readonly runDebuffs: RunState["debuffs"];
        readonly runModifiers: RunState["modifiers"];
        readonly seconds: number;
      })
  | null = null;
let lastScrollSpeed:
  | (Pick<GameData, "tuning" | "world"> &
      Pick<RunState, "route" | "zoneIndex"> & { readonly speed: Pixels })
  | null = null;

// How long one lane move takes: seconds.laneMove over the pack's agility, a Muddy pack's included.
export function laneMoveSeconds(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack" | "walker">,
): number {
  const last = lastLaneMove;
  if (
    last !== null &&
    last.tuning === data.tuning &&
    last.debuffs === data.debuffs &&
    last.dogs === data.dogs &&
    last.walkers === data.walkers &&
    last.pack === run.pack &&
    last.walker === run.walker &&
    last.runModifiers === run.modifiers &&
    last.runDebuffs === run.debuffs
  ) {
    return last.seconds;
  }
  const seconds = read(data.tuning, "seconds", "laneMove") / packAgility(data, run);
  lastLaneMove = {
    debuffs: data.debuffs,
    dogs: data.dogs,
    pack: run.pack,
    runDebuffs: run.debuffs,
    runModifiers: run.modifiers,
    seconds,
    tuning: data.tuning,
    walker: run.walker,
    walkers: data.walkers,
  };
  return seconds;
}

export function laneMotionConfig(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  laneCount: number,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack" | "walker">,
): LaneMotionConfig {
  return { laneCount, moveDuration: laneMoveSeconds(data, run) };
}

// Pixels per second in the run's current zone, read from the live data. Every walker walks the
// same road at the same speed.
export function walkScrollSpeed(
  data: Pick<GameData, "tuning" | "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): Pixels {
  const last = lastScrollSpeed;
  if (
    last !== null &&
    last.tuning === data.tuning &&
    last.world === data.world &&
    last.route === run.route &&
    last.zoneIndex === run.zoneIndex
  ) {
    return last.speed;
  }
  const speed = zoneScrollSpeed(data.tuning, currentZone(data, run), run.zoneIndex);
  lastScrollSpeed = {
    route: run.route,
    speed,
    tuning: data.tuning,
    world: data.world,
    zoneIndex: run.zoneIndex,
  };
  return speed;
}

// The road's scroll speed in pixels per second: the zone's (walkScrollSpeed) at the road's
// speedFactor.
export function roadScrollSpeed(
  data: Pick<GameData, "tuning" | "world">,
  walk: {
    readonly road: { speedFactor: number };
    readonly run: Pick<RunState, "route" | "zoneIndex">;
  },
): number {
  return walkScrollSpeed(data, walk.run) * walk.road.speedFactor;
}

// Every zone is the distance the base speed covers in zoneAtBaseSpeed.
export function zoneLength(data: Pick<GameData, "tuning">): Pixels {
  return pixels(
    read(data.tuning, "pixels", "roadScrollSpeed") *
      read(data.tuning, "seconds", "zoneAtBaseSpeed"),
  );
}
