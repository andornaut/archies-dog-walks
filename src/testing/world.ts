import { ENCOUNTERS } from "../data/encounters";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { MOVEMENT_ASSIGNMENTS, MOVEMENT_PROFILES } from "../data/movementProfiles";
import type { SpawnSlotRole, World, Zone, ZoneWeights } from "../data/types";
import { WORLD } from "../data/world";
import { apportionSlotCounts, SLOT_ROLES, slotCountTotal } from "../runner/slotConfig";
import { zoneSlotGuarantees } from "../runner/zonePlan";

// The world with each zone made over by remake, the first zone still first.
export function mapZones(remake: (zone: Zone) => Zone, world: World): World {
  const [first, ...rest] = world.zones;
  return { ...world, zones: [remake(first), ...rest.map((zone) => remake(zone))] };
}

// The zone's guarantees, as the planner derives them from its weights with the real data.
export function zoneGuarantees(zone: Zone): ReturnType<typeof zoneSlotGuarantees> {
  return zoneSlotGuarantees(
    {
      encounters: ENCOUNTERS,
      minorObstacles: MINOR_OBSTACLES,
      movementAssignments: MOVEMENT_ASSIGNMENTS,
      movementProfiles: MOVEMENT_PROFILES,
    },
    zone,
  );
}

// The slot config with each role's counts and capacity raised to hold its guarantees.
export function minimumSlotConfiguration(
  guarantees: readonly { readonly count: number; readonly role: SpawnSlotRole }[],
  config: Zone["spawnSlots"],
): Zone["spawnSlots"] {
  const minimum = Object.fromEntries(
    SLOT_ROLES.map((role) => [
      role,
      guarantees.filter((item) => item.role === role).reduce((sum, item) => sum + item.count, 0),
    ]),
  ) as Record<(typeof SLOT_ROLES)[number], number>;
  const counts = config.counts.map((row) =>
    Object.fromEntries(SLOT_ROLES.map((role) => [role, Math.max(row[role], minimum[role])])),
  ) as unknown as Zone["spawnSlots"]["counts"];
  const capacity = Object.fromEntries(
    SLOT_ROLES.map((role) => [
      role,
      Math.max(config.capacity[role], ...counts.map((row) => row[role])),
    ]),
  ) as Zone["spawnSlots"]["capacity"];
  return { capacity, counts };
}

// Account for modifiers after shortened test counts have retained their guarantee minima.
export function slotCapacityForModifier(
  factor: number,
  config: Zone["spawnSlots"],
): Zone["spawnSlots"] {
  const resolved = config.counts.map((row) =>
    apportionSlotCounts(Math.round(slotCountTotal(row) * factor), row),
  );
  const capacity = Object.fromEntries(
    SLOT_ROLES.map((role) => [
      role,
      Math.max(config.capacity[role], ...resolved.map((row) => row[role])),
    ]),
  ) as Zone["spawnSlots"]["capacity"];
  return { ...config, capacity };
}

const enabledEncounters = ["otherDog", "porchCat", "squirrel"] as const;
const enabledMinor = ["ball", "bench"] as const;
const roster = <Id extends string>(
  weights: Readonly<Record<Id, number>>,
  enabled: readonly string[],
): Record<Id, number> =>
  Object.fromEntries(
    Object.keys(weights).map((id) => [id, enabled.includes(id as Id) ? 1 : 0]),
  ) as Record<Id, number>;

function neutral(zone: Zone): Zone {
  const weights: ZoneWeights = {
    minorObstacles: roster(zone.weights.minorObstacles, enabledMinor),
    obstacles: roster(zone.weights.obstacles, enabledEncounters),
  };
  const remade = { ...zone, density: { luckyFinds: 1, tips: 1 }, moverShare: 0, speed: 1, weights };
  return {
    ...remade,
    spawnSlots: minimumSlotConfiguration(zoneGuarantees(remade), {
      capacity: { encounterFixed: 52, encounterMoving: 0, minorFixed: 118, minorMoving: 0 },
      counts: Array.from({ length: WORLD.walkLength }, (_, index) => ({
        encounterFixed: 25 + index * 3,
        encounterMoving: 0,
        minorFixed: 72 + index * 2,
        minorMoving: 0,
      })) as unknown as Zone["spawnSlots"]["counts"],
    }),
  };
}

// A small static roster for rules tests, every enabled kind fixed and so guaranteed.
// Integrity tests retain the production world and its complete roster.
export const TEST_WORLD: World = mapZones(neutral, WORLD);
