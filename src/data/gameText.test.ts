import { type FieldTable, strayNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { HOME_TEXT_FIELDS } from "../home/homeText.ts";
import { MENU_TEXT_FIELDS } from "../home/menuText.ts";
import { RUN_TEXT_FIELDS } from "../hud/runText.ts";
import { read } from "../rules/units.ts";
import { gameData } from "./index.ts";

describe("the game's text", () => {
  it("uses only the names each home, menu and run line is given", () => {
    for (const [, table, text] of [
      ["home", HOME_TEXT_FIELDS, gameData.homeText],
      ["menu", MENU_TEXT_FIELDS, gameData.menuText],
      ["run", RUN_TEXT_FIELDS, gameData.runText],
    ] satisfies readonly [string, FieldTable, object][]) {
      expect(strayNames(table, text)).toEqual([]);
    }
  });
});

describe("a line that says its number in words", () => {
  const { debuffs, shopGear, tuning, upgrades, walkerPerks } = gameData;

  it("agrees with the tuning value it names", () => {
    for (const [line, words, value, expected] of [
      [upgrades.charmer.effect, "First card", read(tuning, "counts", "charmerFreeCards"), 1],
      [
        upgrades.goodLeash.effect,
        "No pulls",
        read(tuning, "multipliers", "goodLeashSquirrelPull"),
        0,
      ],
      [walkerPerks.longReach.effect, "a lane", read(tuning, "counts", "longReachLanes"), 1],
      [
        walkerPerks.secondChance.effect,
        "First ♥",
        read(tuning, "hearts", "secondChanceForgiven"),
        1,
      ],
      [shopGear.fannyPack.short, "a spare treat", read(tuning, "counts", "fannyPackTreats"), 1],
      [debuffs.stinky.stake, "pay nothing", read(tuning, "multipliers", "stinkyTipValue"), 0],
    ] as const) {
      expect(line).toContain(words);
      expect(value).toBe(expected);
    }
  });
});
