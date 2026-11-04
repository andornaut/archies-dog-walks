import { type Pixels, pixels, type Seconds, seconds } from "@andornaut/game-kit/units";

import type { LiveTuning, LuckyEncounterId, Zone } from "../data/types";
import { read } from "./units";

interface ZoneStats {
  // At base speed and before upgrades.
  readonly duration: Seconds;
  // How many of each kind of lucky find the zone places on average, which chanceRound rounds.
  readonly luckyFinds: Readonly<Record<LuckyEncounterId, number>>;
  // Obstacles that open no card, on top of obstacles.
  readonly minorObstacles: number;
  readonly obstacles: number;
  readonly scrollSpeed: Pixels;
  readonly tips: number;
  readonly treats: number;
}

// Hazard counts are explicit for the walk position. Reward growth and scroll speed retain
// their tuning and zone multipliers; every zone covers the same distance.
export function zoneStats(
  tuning: LiveTuning,
  zone: Pick<Zone, "density" | "spawnSlots" | "speed">,
  zoneIndex: number,
): ZoneStats {
  const speedFactor = zoneSpeedFactor(tuning, zone, zoneIndex);
  const { density } = zone;
  const slots = zone.spawnSlots.counts[zoneIndex];
  if (slots === undefined) {
    throw new RangeError(`No spawn slot budget for position ${zoneIndex}`);
  }
  return {
    duration: seconds(read(tuning, "seconds", "zoneAtBaseSpeed") / speedFactor),
    luckyFinds: Object.fromEntries(
      Object.entries(tuning.counts.luckyFindsPerZone).map(([id, count]) => [
        id,
        count * density.luckyFinds,
      ]),
    ) as Record<LuckyEncounterId, number>,
    minorObstacles: slots.minorFixed + slots.minorMoving,
    obstacles: slots.encounterFixed + slots.encounterMoving,
    scrollSpeed: zoneScrollSpeed(tuning, zone, zoneIndex),
    tips: zoneCount(
      zoneIndex,
      read(tuning, "counts", "tipsFirstZone"),
      read(tuning, "counts", "tipsGainPerZone"),
      density.tips,
    ),
    treats: read(tuning, "counts", "treatsPerZone"),
  };
}

// zoneStats' scrollSpeed alone.
export function zoneScrollSpeed(
  tuning: LiveTuning,
  zone: Pick<Zone, "speed">,
  zoneIndex: number,
): Pixels {
  return pixels(
    read(tuning, "pixels", "roadScrollSpeed") * zoneSpeedFactor(tuning, zone, zoneIndex),
  );
}

function zoneSpeedFactor(tuning: LiveTuning, zone: Pick<Zone, "speed">, zoneIndex: number): number {
  return (1 + read(tuning, "multipliers", "scrollSpeedGainPerZone") * zoneIndex) * zone.speed;
}

function zoneCount(zoneIndex: number, first: number, gain: number, density: number): number {
  return Math.round((first + gain * zoneIndex) * density);
}
