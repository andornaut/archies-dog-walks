import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json" with { type: "json" };
import { parseManifest } from "../assets/manifest.ts";
import { badgeKey } from "../assets/spriteKeys.ts";
import { forkPaths } from "../rules/route.ts";
import { unlockPrice } from "../rules/shop.ts";
import { read } from "../rules/units.ts";
import { walkerGoal } from "../rules/walkers.ts";
import { weightedZones } from "../rules/zones.ts";
import { SLOT_ROLES } from "../runner/slotConfig.ts";
import { zoneSlotGuarantees } from "../runner/zonePlan.ts";
import { ACHIEVEMENTS } from "./achievements.ts";
import { gameData } from "./index.ts";
import { LANE_COUNT, SCREEN_CONFIG } from "./screen.ts";
import type { CardOption, Effect, EncounterId, MinorObstacleId, ZoneId } from "./types.ts";

// Invariants the rulebook states about the content and numbers, checked on the real data.
const {
  defaultWalker,
  dogSlots,
  dogs,
  encounters,
  minorObstacles,
  shopGear,
  tuning,
  upgrades,
  walkers,
  world,
} = gameData;
const dogList = Object.values(dogs);

// Every card: the encounters that open one.
const cards: readonly { readonly name: string; readonly options: readonly CardOption[] }[] =
  Object.values(encounters).flatMap(({ name, resolution }) =>
    resolution.kind === "card" ? [{ name, options: resolution.options }] : [],
  );
const cardOptions = cards.flatMap((card) => card.options);
const instantEffects: readonly (readonly Effect[])[] = Object.values(encounters).flatMap(
  ({ resolution }) => (resolution.kind === "instant" ? [resolution.effects] : []),
);

describe("roster", () => {
  it("starts with at least one dog, and sells every other dog", () => {
    const starters = dogList.filter((dog) => dog.unlock === "start");
    expect(starters.length).toBeGreaterThan(0);
    expect(
      dogList.filter((dog) => dog.unlock !== "start").every((dog) => dog.unlock === "shop"),
    ).toBe(true);
  });
});

describe("numbers", () => {
  it("keeps owner heart limits, a dog's pay and badge thresholds positive whole numbers", () => {
    const thresholds = gameData.achievements.flatMap(({ conditions }) =>
      conditions.flatMap((condition) =>
        "count" in condition
          ? [condition.count]
          : "dollars" in condition
            ? [condition.dollars]
            : "packSize" in condition
              ? [condition.packSize]
              : [],
      ),
    );
    const numbers = [
      tuning.hearts.maxOwnerHearts,
      ...Object.values(tuning.hearts.maxBySize),
      tuning.money.payPerDog,
      ...thresholds.filter((threshold): threshold is number => threshold !== "all"),
    ];
    expect(numbers.filter((n) => !Number.isInteger(n) || n <= 0)).toEqual([]);
  });

  it("names only positive money effect amounts, and prices every gear item, locked dog and dog slot above $0", () => {
    const amounts = [...cardOptions, ...instantEffects.map((effects) => ({ effects }))].flatMap(
      (option) =>
        option.effects.flatMap((effect) => (effect.kind === "money" ? [effect.amount] : [])),
    );
    for (const amount of amounts) {
      expect(read(tuning, "money", amount)).toBeGreaterThan(0);
    }
    for (const gear of Object.values(shopGear)) {
      expect(tuning.money.prices[gear.price]).toBeGreaterThan(0);
    }
    for (const item of [...dogList, ...dogSlots]) {
      if (item.unlock === "shop") {
        expect(tuning.money.prices[item.price]).toBeGreaterThan(0);
      }
    }
  });
});

describe("cards", () => {
  it("applies every lucky find at once, with only gains", () => {
    const instant = Object.entries(encounters).flatMap(([id, encounter]) =>
      encounter.resolution.kind === "instant" ? [id] : [],
    );
    const lucky = keysOf(encounters).filter((id) => encounters[id].kind === "lucky");
    expect(instant.sort()).toEqual(lucky.sort());
    for (const effect of instantEffects.flat()) {
      expect(effect.kind === "money" ? effect.change : "gain").toBe("gain");
      expect(effect.kind === "hearts" ? effect.amount : 1).toBeGreaterThan(0);
    }
  });

  it("leaves enough unwalked zones for three paths, and upgrades for every path, at every fork", () => {
    expect(world.zones.length - (world.walkLength - 1)).toBeGreaterThanOrEqual(3);
    // Picked upgrades leave the pool.
    const removedBeforeLastPick = world.walkLength - 2;
    const mostPaths = forkPaths(gameData, () => 0, [world.firstZone as ZoneId]).length;
    expect(Object.keys(upgrades).length - removedBeforeLastPick).toBeGreaterThanOrEqual(mostPaths);
  });

  it("keeps saved option ids unique on each card, and saved badge ids unique", () => {
    for (const card of cards) {
      const ids = card.options.map((option) => option.id);
      expect(new Set(ids).size, card.name).toBe(ids.length);
    }
    const badges = gameData.achievements.map(({ id }) => id);
    expect(new Set(badges).size).toBe(badges.length);
  });

  it("lists the badges by tier, easiest first, each tier in authored order", () => {
    const tiers = ["easy", "medium", "hard"] as const;
    const authored = tiers.flatMap((tier) =>
      ACHIEVEMENTS.filter((badge) => badge.tier === tier).map(({ id }) => id),
    );
    expect(gameData.achievements.map(({ id }) => id)).toEqual(authored);
    expect(authored).toHaveLength(ACHIEVEMENTS.length);
  });
});

describe("run, world and walkers", () => {
  it("gives every walk position a gear drop count of 0 or more, and every gear item a road kind of its own", () => {
    const drops = tuning.counts.gearDropsPerZone as Readonly<Record<number, number>>;
    const positions = Array.from({ length: world.walkLength }, (_, i) => i + 1);
    expect(positions.map((position) => drops[position] ?? -1).every((n) => n >= 0)).toBe(true);
    const roadKinds = [...Object.keys(encounters), ...Object.keys(minorObstacles), "tip", "treat"];
    expect(Object.keys(shopGear).filter((gear) => roadKinds.includes(gear))).toEqual([]);
  });

  it("names only the world's zones on the pre-fork route", () => {
    const ids: readonly string[] = world.zones.map(({ id }) => id);
    expect(world.preForkRoute.filter((id) => !ids.includes(id))).toEqual([]);
  });

  // A dart's one outcome draw picks turning back, stopping or crossing, so its shares to turn
  // back and to stop add up to at most 1, and the lanes a stop is drawn from are a range.
  it("gives every dart shares to turn back and to stop adding up to at most 1, and its stop lanes a range", () => {
    for (const [kind, { movement }] of [
      ...Object.entries(encounters),
      ...Object.entries(minorObstacles),
    ]) {
      if (movement?.kind === "dart") {
        expect(movement.turnBackShare, kind).toBeGreaterThanOrEqual(0);
        expect(movement.stopShare, kind).toBeGreaterThanOrEqual(0);
        expect(movement.turnBackShare + movement.stopShare, kind).toBeLessThanOrEqual(1);
      }
    }
    expect(tuning.counts.dartStopLanesMin).toBeLessThanOrEqual(tuning.counts.dartStopLanesMax);
  });

  it("gives distraction patterns valid probabilities adding up to 1", () => {
    const odds = Object.values(tuning.probability.distractionPatternOdds);
    expect(odds.every((chance) => chance >= 0 && chance <= 1)).toBe(true);
    expect(odds.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("orders zones from easiest to hardest", () => {
    const ranks = world.zones.map(({ difficulty }) => difficulty);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("gives every zone positive multipliers, a mover share from 0 to 1 and a kind to draw", () => {
    for (const zone of world.zones) {
      const { density, moverShare, speed, weights } = zone;
      for (const value of [speed, ...Object.values(density)]) {
        expect(value, zone.name).toBeGreaterThan(0);
      }
      expect(moverShare, zone.name).toBeGreaterThanOrEqual(0);
      expect(moverShare, zone.name).toBeLessThanOrEqual(1);
      for (const group of Object.values(weights) as Readonly<Record<string, number>>[]) {
        const values = Object.values(group);
        expect(
          values.every((weight) => weight >= 0),
          zone.name,
        ).toBe(true);
        expect(
          values.some((weight) => weight > 0),
          zone.name,
        ).toBe(true);
      }
    }
  });

  // Every positive-weight kind appears at least once, so its guarantee fits its role's budget at
  // every walk position.
  it.each(world.zones.map((zone) => [zone.name, zone] as const))(
    "guarantees each positive-weight kind in %s once, within every position's role budget",
    (_, zone) => {
      const guarantees = zoneSlotGuarantees(gameData, zone);
      const weighted = [
        ...Object.entries(zone.weights.obstacles),
        ...Object.entries(zone.weights.minorObstacles),
      ]
        .filter(([, weight]) => weight > 0)
        .map(([kind]) => kind);
      expect(guarantees.map(({ kind }) => kind).sort()).toEqual(weighted.sort());
      expect(guarantees.every(({ count }) => count === 1)).toBe(true);
      for (const role of SLOT_ROLES) {
        const required = guarantees.filter((guarantee) => guarantee.role === role).length;
        for (const counts of [...zone.spawnSlots.counts, zone.spawnSlots.capacity]) {
          expect(counts[role], role).toBeGreaterThanOrEqual(required);
        }
      }
    },
  );

  it("weighs every obstacle in every zone, and counts every lucky find per zone, 0 or more", () => {
    const lucky = Object.keys(encounters).filter(
      (id) => encounters[id as EncounterId].kind === "lucky",
    );
    for (const { name, weights } of world.zones) {
      for (const id of Object.keys(weights.obstacles)) {
        expect(encounters[id as EncounterId].kind, name).toBe("obstacle");
      }
      expect([...Object.keys(weights.obstacles), ...lucky].sort(), name).toEqual(
        Object.keys(encounters).sort(),
      );
    }
    const counts = tuning.counts.luckyFindsPerZone as Readonly<Record<string, number>>;
    expect(Object.keys(counts).sort()).toEqual(lucky.sort());
    expect(Object.values(counts).every((count) => count >= 0)).toBe(true);
  });

  it("weighs each obstacle with skins above 0 in exactly the zones its skins name", () => {
    const offenders = Object.entries(minorObstacles).flatMap(([id, minor]) => {
      if (!("skins" in minor)) {
        return [];
      }
      const named = new Set<string>(Object.values(minor.skins).flatMap(({ zones }) => zones));
      const weighted = weightedZones(world, "minorObstacles", id as MinorObstacleId);
      const expected = world.zones.flatMap((zone) => (named.has(zone.id) ? [zone.id] : []));
      return weighted.join() === expected.join() && named.size === expected.length
        ? []
        : [`${id}: skins name ${[...named].join(", ")}, weighed in ${weighted.join(", ")}`];
    });
    expect(offenders).toEqual([]);
  });

  // So the neighbourhoods stay distinct, no mover or plain obstacle appears in more than 3, each
  // skin of one with skins counting as its own by the zones it names. One test lists every
  // obstacle or skin over the limit, with its zones.
  it("weighs every mover and plain obstacle above 0 in at most 3 zones, each skin on its own", () => {
    const over = Object.entries(minorObstacles).flatMap(([id, minor]) => {
      const looks =
        "skins" in minor
          ? Object.entries(minor.skins).map(([skin, { zones }]) => ({ id: skin, zones }))
          : [{ id, zones: weightedZones(world, "minorObstacles", id as MinorObstacleId) }];
      return looks.flatMap((look) =>
        look.zones.length > 3 ? [`${look.id}: ${look.zones.join(", ")}`] : [],
      );
    });
    expect(over).toEqual([]);
  });

  // Each active wide fixed kind has a narrower replacement and leaves the required lanes open.
  it.each(world.zones)(
    "gives wide fixed obstacles a narrower replacement in $name",
    ({ weights }) => {
      const weighed = weights.minorObstacles as Readonly<Record<string, number>>;
      const fixedWidths = new Set(
        Object.entries(minorObstacles).flatMap(([id, minor]) =>
          !("movement" in minor) && (weighed[id] ?? 0) > 0 ? [minor.shape.lanes] : [],
        ),
      );
      const widths = [...fixedWidths];
      const widest = Math.min(3, LANE_COUNT - read(tuning, "counts", "openLanesPerRowMin"));
      expect(
        widths.every((width) => Number.isInteger(width) && width >= 1 && width <= widest),
      ).toBe(true);
      expect(
        widths.filter((width) => width > 1).every((width) => widths.some((other) => other < width)),
      ).toBe(true);
    },
  );

  it("fits the largest pack in the card row, one dog slot a place, the first free and the rest priced", () => {
    expect(tuning.counts.packSizeMax).toBe(SCREEN_CONFIG.dogSlotCount);
    expect(dogSlots).toHaveLength(tuning.counts.packSizeMax);
    const [first, ...rest] = dogSlots.map((slot) => unlockPrice(tuning, slot));
    expect(first).toBe(0);
    expect(dogSlots.slice(1).every((slot) => slot.unlock === "shop")).toBe(true);
    expect(rest.every((price) => price > 0)).toBe(true);
  });

  it("starts with an unlocked walker and reachable unlock goals", () => {
    const goals = Object.values(walkers).map(walkerGoal);
    expect(walkers[defaultWalker].unlock).toBe("start");
    expect(goals.filter((goal) => goal === null)).toHaveLength(1);
    // A walk takes at most one dog per dog slot.
    expect(
      goals.every(
        (goal) => goal === null || (Number.isInteger(goal) && goal >= 1 && goal <= dogSlots.length),
      ),
    ).toBe(true);
  });
});

describe("the art manifest", () => {
  const sprites = new Set(parseManifest(manifestJson).sprites.map(({ key }) => key));

  it("has every walker's sprite and portrait and every badge's art", () => {
    const keys = [
      ...Object.values(walkers).flatMap((walker) => [walker.spriteKey, walker.portraitKey]),
      ...gameData.achievements.map(({ id }) => badgeKey(id)),
    ];
    expect(keys.filter((key) => !sprites.has(key))).toEqual([]);
  });
});
