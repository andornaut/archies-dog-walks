// The walk tests' data, road and helpers that build and step a walk.
import { seededRandom } from "@andornaut/game-kit/random";

import { DEBUFFS } from "../data/debuffs.ts";
import { DOGS } from "../data/dogs.ts";
import { ENCOUNTERS } from "../data/encounters.ts";
import { HOME_TEXT } from "../data/homeText.ts";
import { MINOR_OBSTACLES } from "../data/minorObstacles.ts";
import { MOVEMENT_ASSIGNMENTS, MOVEMENT_PROFILES } from "../data/movementProfiles.ts";
import { RUN_TEXT } from "../data/runText.ts";
import { SHOP_GEAR } from "../data/shop.ts";
import { TUNING } from "../data/tuning.ts";
import { UPGRADES } from "../data/upgrades.ts";
import { stillInLane } from "../runner/laneMotion.ts";
import { startRoad, stepWalk, type Walk } from "../runner/walk.ts";
import { type WalkItem } from "../runner/walkItems.ts";
import { mapPack } from "../state/pack.ts";
import { newRun, type PackDogs } from "../state/runState.ts";
import { clampHearts } from "../units.ts";
import { TEST_ROAD_GEOMETRY } from "./packGeometry.ts";
import { TEST_TUNING } from "./tuning.ts";
import { TEST_WALKER_DATA } from "./walkers.ts";
import { mapZones, minimumSlotConfiguration, TEST_WORLD, zoneGuarantees } from "./world.ts";

// 80px/s for 30s is a 2400px zone: 14 rows of spawns 160px apart.
export const tuning = {
  ...TEST_TUNING,
  counts: {
    ...TEST_TUNING.counts,
    luckyFindsPerZone: { friendlyNeighbour: 1, lostWallet: 1 },
    tipsFirstZone: 8,
    tipsGainPerZone: 1,
    treatsPerZone: 2,
  },
  pixels: { ...TUNING.pixels, roadScrollSpeed: 80, spawnRowSpacing: 160 },
  seconds: {
    ...TEST_TUNING.seconds,
    collisionGrace: 1,
    hitStopSeconds: 1,
    laneMove: 0.18,
    minorHitStopSeconds: 0.6,
    zoneAtBaseSpeed: 30,
  },
};
export const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  minorObstacles: MINOR_OBSTACLES,
  movementAssignments: MOVEMENT_ASSIGNMENTS,
  movementProfiles: MOVEMENT_PROFILES,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning,
  upgrades: UPGRADES,
  world: mapZones(
    (zone) => ({
      ...zone,
      spawnSlots: minimumSlotConfiguration(zoneGuarantees(zone), {
        capacity: { encounterFixed: 14, encounterMoving: 0, minorFixed: 11, minorMoving: 0 },
        counts: Array.from({ length: TEST_WORLD.walkLength }, (_, index) => ({
          encounterFixed: 6 + index,
          encounterMoving: 0,
          minorFixed: 4 + index,
          minorMoving: 0,
        })) as unknown as typeof zone.spawnSlots.counts,
      }),
    }),
    TEST_WORLD,
  ),
};

export const geometry = TEST_ROAD_GEOMETRY;

export const walkWith = (dogs: PackDogs, items: WalkItem[] = []): Walk => ({
  road: { ...startRoad(5), items, nextItemId: items.length },
  run: newRun(data, 3, { dogs, gear: null, walker: "casey" }),
});
export const RAINCOATS = { kind: "upgrade", upgrade: "raincoats" } as const;
// An item in the middle lane, its bottom just inside the pack's band.
export const atPack = (kind: WalkItem["kind"], id = 0, lane = 2, laneSpan = 1): WalkItem => ({
  height: 12,
  id,
  kind,
  lane,
  laneSpan,
  y: 560,
});
// The walk with the pack standing still in lane.
export const inLane = (lane: number, walk: Walk): Walk => ({
  ...walk,
  road: {
    ...walk.road,
    control: { ...walk.road.control, motion: stillInLane(lane), target: lane },
  },
});
// The walk with every owner at hearts.
export const withHearts = (hearts: number, walk: Walk): Walk => ({
  ...walk,
  run: {
    ...walk.run,
    pack: mapPack(
      (slot) =>
        slot.status === "walking" ? { ...slot, hearts: clampHearts(hearts, hearts) } : slot,
      walk.run.pack,
    ),
  },
});
export const graced = (walk: Walk): Walk => ({
  ...walk,
  road: { ...walk.road, invulnerableSeconds: 0.5 },
});
export const step = (walk: Walk, seconds = 0.01) =>
  stepWalk(data, geometry, seededRandom(1), seconds, walk);
