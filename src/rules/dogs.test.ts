import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs.ts";
import type { Modifier, Zone } from "../data/types.ts";
import { activeModifier, testState } from "../testing/runState.ts";
import { TEST_TUNING } from "../testing/tuning.ts";
import {
  maxHearts,
  ownerMaxHearts,
  packPlace,
  packSizeBonus,
  packSizeRaise,
  sizeHearts,
  startHearts,
} from "./dogs.ts";
import { zoneStats } from "./zones.ts";

const collar: readonly Modifier[] = [{ by: "luckyCollarMax", operation: "add", stat: "maxHearts" }];

describe("dog stats", () => {
  it.each([
    ["small", { lead: true, size: 2 }, []],
    ["medium", { lead: false, size: 3 }, collar],
    ["large", { lead: true, size: 1 }, collar],
  ] as const)(
    "starts a %s dog's owner full, including raised and capped maxima",
    (size, place, modifiers) => {
      const dog = { size };
      expect(startHearts(TEST_TUNING, modifiers, place, dog)).toBe(
        maxHearts(TEST_TUNING, modifiers, place, dog),
      );
    },
  );

  it.each([
    ["small", { lead: true, size: 1 }],
    ["medium", { lead: true, size: 2 }],
    ["large", { lead: true, size: 3 }],
    ["small", { lead: false, size: 2 }],
    ["medium", { lead: false, size: 3 }],
  ] as const)("adds only the lead's pack-size bonus to a %s dog's max at %j", (size, place) => {
    const dog = { size };
    const bonus = place.lead ? TEST_TUNING.hearts.packSizeBonus[place.size] : 0;
    expect(packSizeBonus(TEST_TUNING, place)).toBe(bonus);
    expect(maxHearts(TEST_TUNING, [], place, dog)).toBe(sizeHearts(TEST_TUNING, dog) + bonus);
    expect(packSizeRaise(TEST_TUNING, [], place, dog)).toBe(bonus);
  });

  it("caps gear and pack bonuses together and reports only the remaining pack raise", () => {
    const place = { lead: true, size: 1 } as const;
    const dog = { size: "large" } as const;
    expect(maxHearts(TEST_TUNING, collar, place, dog)).toBe(TEST_TUNING.hearts.maxOwnerHearts);
    expect(packSizeRaise(TEST_TUNING, collar, place, dog)).toBe(1);
  });

  it.each([
    [["kilo"], "kilo", { lead: true, size: 1 }],
    [["kilo", "ginger"], "kilo", { lead: true, size: 2 }],
    [["kilo", "ginger"], "ginger", { lead: false, size: 2 }],
  ] as const)("places a dog in the pack %j: %s", (order, dog, place) => {
    expect(packPlace(order, dog)).toEqual(place);
  });
});

describe("ownerMaxHearts", () => {
  // A fired dog keeps its place, so the pack is the size it set out with.
  const collar = activeModifier(
    { gear: "luckyCollar", kind: "gear" },
    { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
  );
  const run = testState({ buddy: 2, kilo: 3, lady: "fired" }, { modifiers: [collar] });
  it.each([
    ["lady", { lead: true, size: 3 }],
    ["kilo", { lead: false, size: 3 }],
  ] as const)(
    "caps %s's owner at the max of its place in the pack it set out with",
    (dog, place) => {
      expect(ownerMaxHearts({ dogs: DOGS, tuning: TEST_TUNING }, run, dog)).toBe(
        maxHearts(TEST_TUNING, run.modifiers, place, DOGS[dog]),
      );
    },
  );
});

describe("zoneStats", () => {
  const plain = {
    density: { luckyFinds: 1, tips: 1 },
    spawnSlots: {
      capacity: { encounterFixed: 8, encounterMoving: 4, minorFixed: 12, minorMoving: 4 },
      counts: [
        { encounterFixed: 3, encounterMoving: 2, minorFixed: 4, minorMoving: 1 },
        { encounterFixed: 4, encounterMoving: 2, minorFixed: 6, minorMoving: 1 },
        { encounterFixed: 5, encounterMoving: 3, minorFixed: 8, minorMoving: 2 },
        { encounterFixed: 6, encounterMoving: 3, minorFixed: 10, minorMoving: 2 },
      ],
    },
    speed: 1,
  } satisfies Pick<Zone, "density" | "speed" | "spawnSlots">;

  it("raises the speed per zone, so the same distance takes less time", () => {
    const first = zoneStats(TEST_TUNING, plain, 0);
    const fourth = zoneStats(TEST_TUNING, plain, 3);
    expect(first.scrollSpeed).toBe(80);
    expect(fourth.scrollSpeed).toBeCloseTo(80 * 1.6);
    expect(first.duration).toBe(240);
    expect(fourth.duration).toBeCloseTo(240 / 1.6);
  });

  it("reads explicit hazard rows while keeping reward growth", () => {
    const { counts } = TEST_TUNING;
    expect(zoneStats(TEST_TUNING, plain, 2).obstacles).toBe(
      plain.spawnSlots.counts[2].encounterFixed + plain.spawnSlots.counts[2].encounterMoving,
    );
    expect(zoneStats(TEST_TUNING, plain, 2).tips).toBe(
      counts.tipsFirstZone + 2 * counts.tipsGainPerZone,
    );
  });

  it("multiplies the speed and the counts by the zone's own, rounding the counts", () => {
    const { counts } = TEST_TUNING;
    const busy = {
      ...plain,
      density: { luckyFinds: 2, tips: 1.5 },
      speed: 1.25,
    };
    const stats = zoneStats(TEST_TUNING, busy, 0);
    expect(stats.scrollSpeed).toBe(80 * 1.25);
    expect(stats.duration).toBe(240 / 1.25);
    expect(stats.minorObstacles).toBe(5);
    expect(stats.obstacles).toBe(5);
    expect(stats.tips).toBe(Math.round(counts.tipsFirstZone * 1.5));
    expect(stats.luckyFinds).toEqual(
      Object.fromEntries(
        Object.entries(counts.luckyFindsPerZone).map(([id, count]) => [id, count * 2]),
      ),
    );
  });
});
