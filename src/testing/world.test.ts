import { describe, expect, it } from "vitest";

import { TUNING } from "../data/tuning.ts";
import type { SpawnSlotCounts, Zone } from "../data/types.ts";
import { WORLD } from "../data/world.ts";
import { read } from "../rules/units.ts";
import {
  apportionSlotCounts,
  SLOT_ROLES,
  slotConfigurationFailures,
  slotCountTotal,
  type SlotKind,
} from "../runner/slotConfig.ts";
import { makeSlotJobs } from "../runner/slotJobs.ts";
import { SLOT_LIMITS } from "../runner/slotPlanner.ts";
import { minimumSlotConfiguration, slotCapacityForModifier, zoneGuarantees } from "./world.ts";

const factor = read(TUNING, "multipliers", "rushHourObstacles");

function shortened(zone: Zone): Zone["spawnSlots"] {
  const config = zone.spawnSlots;
  const scaled = (count: number) => Math.round(count * 0.25);
  return minimumSlotConfiguration(zoneGuarantees(zone), {
    capacity: Object.fromEntries(
      SLOT_ROLES.map((role) => [role, scaled(config.capacity[role])]),
    ) as unknown as SpawnSlotCounts,
    counts: config.counts.map((row) =>
      apportionSlotCounts(scaled(slotCountTotal(row)), row),
    ) as unknown as Zone["spawnSlots"]["counts"],
  });
}

describe("modifier-compatible test slot ceilings", () => {
  it.each([
    { index: 1, zone: "kensingtonMarket" },
    { index: 2, zone: "theBeaches" },
  ] as const)("retains the post-minimum Rush hour requests for $zone", ({ index, zone }) => {
    const authored = WORLD.zones.find((candidate) => candidate.id === zone)!;
    const guarantees = zoneGuarantees(authored);
    const config = shortened(authored);
    const unchanged = structuredClone(config);
    const row = config.counts[index]!;
    const active = apportionSlotCounts(Math.round(slotCountTotal(row) * factor), row);
    const catalogue: SlotKind<string>[] = guarantees.map(({ kind, role }) => ({
      compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind,
      role,
      weight: 1,
    }));
    const overflow = {
      available: config.capacity.minorMoving,
      code: "role-capacity",
      required: active.minorMoving,
      role: "minorMoving",
    };
    expect(
      slotConfigurationFailures(catalogue, SLOT_LIMITS, {
        active,
        capacity: config.capacity,
        guarantees,
      }),
    ).toContainEqual(overflow);

    const adjusted = slotCapacityForModifier(factor, config);
    expect(adjusted.capacity).toEqual({ ...config.capacity, minorMoving: active.minorMoving });
    expect(adjusted.counts).toBe(config.counts);
    expect(config).toEqual(unchanged);
    expect(
      makeSlotJobs(catalogue, [], {
        active,
        capacity: adjusted.capacity,
        guarantees,
      }),
    ).toEqual(
      makeSlotJobs(catalogue, [], {
        active,
        capacity: config.capacity,
        guarantees,
      }),
    );
    expect(
      slotConfigurationFailures(catalogue, SLOT_LIMITS, {
        active,
        capacity: adjusted.capacity,
        guarantees,
      }),
    ).toEqual([]);

    const inadequate = { ...adjusted.capacity, minorMoving: active.minorMoving - 1 };
    expect(
      slotConfigurationFailures(catalogue, SLOT_LIMITS, {
        active,
        capacity: inadequate,
        guarantees,
      }),
    ).toContainEqual({ ...overflow, available: inadequate.minorMoving });
  });

  it("keeps existing authored headroom and the original requested rows", () => {
    const original = WORLD.zones.find((zone) => zone.id === "kensingtonMarket")!.spawnSlots;
    const adjusted = slotCapacityForModifier(factor, original);
    expect(adjusted.capacity).toEqual(original.capacity);
    expect(adjusted.counts).toBe(original.counts);
  });
});
