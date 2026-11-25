import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "./achievements.ts";
import { DEBUFFS } from "./debuffs.ts";
import { DOGS } from "./dogs.ts";
import { ENCOUNTERS } from "./encounters.ts";
import { HINTS } from "./hints.ts";
import {
  ACHIEVEMENT_IDS,
  CARD_OPTION_IDS,
  DEBUFF_IDS,
  DOG_IDS,
  GEAR_IDS,
  HINT_IDS,
  LUCKY_ENCOUNTER_IDS,
  MINOR_OBSTACLE_IDS,
  MOVEMENT_PROFILE_IDS,
  OBSTACLE_ENCOUNTER_IDS,
  SKIN_IDS,
  UPGRADE_IDS,
  WALKER_IDS,
  WALKER_PERK_IDS,
  ZONE_IDS,
} from "./ids.ts";
import { MINOR_OBSTACLES } from "./minorObstacles.ts";
import { MOVEMENT_PROFILES } from "./movementProfiles.ts";
import { SHOP_GEAR } from "./shop.ts";
import { UPGRADES } from "./upgrades.ts";
import { WALKER_PERKS, WALKERS } from "./walkers.ts";
import { WORLD } from "./world.ts";

const encountersOfKind = (kind: "lucky" | "obstacle") =>
  Object.entries(ENCOUNTERS).flatMap(([id, encounter]) => (encounter.kind === kind ? [id] : []));

// Each id list beside the ids its table holds, in the table's order: the lists of a record table
// are alphabetized, as sort-keys keeps the table.
describe("the data id lists", () => {
  it.each<[string, readonly string[], readonly string[]]>([
    ["achievement", ACHIEVEMENT_IDS, ACHIEVEMENTS.map(({ id }) => id)],
    ["debuff", DEBUFF_IDS, Object.keys(DEBUFFS)],
    ["dog", DOG_IDS, Object.keys(DOGS)],
    ["gear", GEAR_IDS, Object.keys(SHOP_GEAR)],
    ["hint", HINT_IDS, Object.keys(HINTS)],
    ["lucky encounter", LUCKY_ENCOUNTER_IDS, encountersOfKind("lucky")],
    ["minor obstacle", MINOR_OBSTACLE_IDS, Object.keys(MINOR_OBSTACLES)],
    ["movement profile", MOVEMENT_PROFILE_IDS, Object.keys(MOVEMENT_PROFILES)],
    ["obstacle encounter", OBSTACLE_ENCOUNTER_IDS, encountersOfKind("obstacle")],
    ["upgrade", UPGRADE_IDS, Object.keys(UPGRADES)],
    ["walker", WALKER_IDS, Object.keys(WALKERS)],
    ["walker perk", WALKER_PERK_IDS, Object.keys(WALKER_PERKS)],
    ["zone", ZONE_IDS, WORLD.zones.map(({ id }) => id)],
  ])("lists the %s ids exactly", (_table, list, table) => {
    expect(list).toEqual(table);
  });

  it.each<[string, Readonly<Record<string, readonly string[]>>, Record<string, string[]>]>([
    [
      "card option",
      CARD_OPTION_IDS,
      Object.fromEntries(
        Object.entries(ENCOUNTERS).flatMap(([id, { resolution }]) =>
          resolution.kind === "card" ? [[id, resolution.options.map((option) => option.id)]] : [],
        ),
      ),
    ],
    [
      "skin",
      SKIN_IDS,
      Object.fromEntries(
        Object.entries(MINOR_OBSTACLES).flatMap(([id, obstacle]) =>
          "skins" in obstacle ? [[id, Object.keys(obstacle.skins)]] : [],
        ),
      ),
    ],
  ])("lists the %s ids exactly", (_table, lists, table) => {
    expect(lists).toEqual(table);
  });
});
