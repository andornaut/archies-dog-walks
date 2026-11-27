import { keysOf } from "@andornaut/game-kit/runtime/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { GearId, ZoneId } from "../data/types.ts";
import { ownerMaxHearts } from "../rules/dogs.ts";
import { firstZoneId } from "../rules/route.ts";
import { startRoad } from "../runner/walk/step.ts";
import { zoneLength } from "../runner/walkMotion.ts";
import { MAX_RUN_DOGS } from "../save/schema.ts";
import { heartsByDog, testState } from "../testing/runState.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { cents } from "../units.ts";
import {
  addToBank,
  canFinishZone,
  finishZone,
  grantOwned,
  NEXT_WALK_OFF,
  nextChoice,
  nextWalkLink,
  nextWalkSetup,
  type OwnGrant,
  pocketChoices,
  seedFrom,
  startZones,
  timeScaleOf,
  upgradesLeft,
  WALK_CHEATS_OFF,
  WALK_GRANT,
  walkCheat,
  withCheats,
} from "./cheats.ts";
import { MAX_SEED, type RunSetup } from "./runSetup.ts";

const BASE: RunSetup = { dev: false, invincible: false, seed: 7, speed: 1, zone: 1 };
const FIRST = firstZoneId(gameData);
const LATER = startZones(gameData)[1] as ZoneId;
const GEAR = keysOf(gameData.shopGear)[0] as GearId;

describe("nextWalkSetup", () => {
  it.each<[string, Partial<typeof NEXT_WALK_OFF>, RunSetup]>([
    ["leaves a setup with every choice off as it is", {}, BASE],
    ["starts in the first neighbourhood as a setup with none", { start: FIRST }, BASE],
    [
      "walks the first neighbourhood before a later one",
      { start: LATER },
      {
        ...BASE,
        route: [FIRST, LATER],
        zone: 2,
      },
    ],
    ["takes the seed", { seed: 42 }, { ...BASE, seed: 42 }],
    ["walks with no Pocket item", { pocket: null }, { ...BASE, gear: null }],
    ["walks with any Pocket item", { pocket: GEAR }, { ...BASE, gear: GEAR }],
    ["makes owners invincible", { invincible: true }, { ...BASE, invincible: true }],
  ])("%s", (_, next, setup) => {
    expect(nextWalkSetup(gameData, { ...NEXT_WALK_OFF, ...next }, BASE)).toEqual(setup);
  });

  it("keeps a base's invincible owners with Invincible owners off", () => {
    const base = { ...BASE, invincible: true };
    expect(nextWalkSetup(gameData, NEXT_WALK_OFF, base)).toEqual(base);
  });
});

describe("nextWalkLink", () => {
  const PAGE = "https://example.com/play/";

  it.each([
    [false, `${PAGE}?seed=7`],
    [true, `${PAGE}?seed=7&invincible=1`],
  ])("writes Invincible owners %s as the link's invincible", (invincible, link) => {
    expect(nextWalkLink(gameData, PAGE, { ...NEXT_WALK_OFF, invincible }, BASE)).toBe(link);
  });
});

describe("the pickers", () => {
  it("go round their choices, the Start screen's pick, none, then every gear item", () => {
    const choices = pocketChoices(gameData);
    expect(choices.slice(0, 2)).toEqual([undefined, null]);
    expect(choices.slice(2)).toEqual(keysOf(gameData.shopGear));
    expect(nextChoice(choices, choices.at(-1))).toBeUndefined();
    expect(startZones(gameData)).toHaveLength(gameData.world.zones.length);
  });
});

describe("the walk's cheats", () => {
  it("scale the walk's time and make owners invincible", () => {
    expect(timeScaleOf(WALK_CHEATS_OFF)).toBe(1);
    expect(timeScaleOf({ ...WALK_CHEATS_OFF, speed: "fast" })).toBeGreaterThan(1);
    const run = testState({ archie: 3 });
    expect(withCheats(WALK_CHEATS_OFF, run)).toBe(run);
    expect(withCheats({ ...WALK_CHEATS_OFF, invincible: true }, run).invincible).toBe(true);
  });
});

describe("the Start screen's grants", () => {
  it("add to the bank on every press", () => {
    const twice = addToBank(cents(500), addToBank(cents(500), newPlayerSave));
    expect(twice.bankCents).toBe(newPlayerSave.bankCents + 1000);
  });

  it.each<[OwnGrant, readonly (keyof typeof newPlayerSave.owned)[]]>([
    ["walkers", ["walkers"]],
    ["dogs", ["dogs"]],
    ["dogSlots", ["dogSlots"]],
    ["gear", ["gear"]],
    ["all", ["dogSlots", "dogs", "gear", "walkers"]],
  ])("own every %s and nothing else", (grant, granted) => {
    const { owned } = grantOwned(gameData, grant, newPlayerSave);
    const every = {
      dogSlots: gameData.dogSlots.slice(0, MAX_RUN_DOGS).map((_, i) => i + 1),
      dogs: keysOf(gameData.dogs),
      gear: keysOf(gameData.shopGear),
      walkers: keysOf(gameData.walkers),
    };
    for (const key of keysOf(every)) {
      const expected = granted.includes(key) ? every[key] : newPlayerSave.owned[key];
      expect([...owned[key]].sort()).toEqual([...expected].sort());
    }
  });
});

describe("This walk's cheats", () => {
  const data = gameData;
  const run = testState({ archie: 1, lady: 1 });

  it("add to the walk's earnings, kept by an early end", () => {
    const added = walkCheat(data, { kind: "addMoney" }, run);
    expect(added.money).toBe(run.money + WALK_GRANT);
    expect(added.zoneEndMoney).toBe(run.zoneEndMoney + WALK_GRANT);
  });

  it("refill every walking owner's hearts", () => {
    const full = walkCheat(data, { kind: "refillHearts" }, run);
    expect(heartsByDog(full)).toEqual({
      archie: ownerMaxHearts(data, run, "archie"),
      lady: ownerMaxHearts(data, run, "lady"),
    });
  });

  it("grant an upgrade once, and every upgrade left", () => {
    const [upgrade] = data.upgradeDrawOrder;
    const once = walkCheat(data, { kind: "upgrade", upgrade: upgrade! }, run);
    expect(once.upgradesPicked).toEqual([upgrade]);
    expect(walkCheat(data, { kind: "upgrade", upgrade: upgrade! }, once)).toBe(once);
    const all = walkCheat(data, { kind: "upgrades" }, once);
    expect([...all.upgradesPicked].sort()).toEqual([...data.upgradeDrawOrder].sort());
    expect(upgradesLeft(data, all)).toEqual([]);
  });

  it("apply a debuff to the pack", () => {
    const [debuff] = keysOf(data.debuffs);
    const debuffed = walkCheat(data, { debuff: debuff!, kind: "debuff" }, run);
    expect(debuffed.debuffs.map((active) => active.debuff)).toEqual([debuff]);
  });

  it("finish the neighbourhood: the road cleared, at its end, only while walking", () => {
    const walk = { road: startRoad(5), run };
    const finished = finishZone(data, walk);
    expect(finished.run.zoneDistance).toBe(zoneLength(data));
    expect(finished.road).toMatchObject({ herrings: [], items: [], pending: [] });
    const ended = {
      ...walk,
      run: { ...run, phase: { kind: "ended", reason: "wentHome" } },
    } as const;
    expect(canFinishZone(ended)).toBe(false);
    expect(finishZone(data, ended)).toBe(ended);
  });
});

describe("seedFrom", () => {
  it.each<[string, number | null | undefined]>([
    ["", null],
    ["  ", null],
    ["42", 42],
    [" 7 ", 7],
    [String(MAX_SEED), MAX_SEED],
    [String(MAX_SEED + 1), undefined],
    ["-1", undefined],
    ["1.5", undefined],
    ["seed", undefined],
  ])("reads %j as %s", (text, seed) => {
    expect(seedFrom(text)).toBe(seed);
  });
});
