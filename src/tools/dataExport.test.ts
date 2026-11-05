import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { gearShort, upgradeLine } from "../rules/effectText.ts";
import { dataExportFiles } from "./dataExport.ts";
import { gameDataExport } from "./gameDataExport.ts";

const ROOT = new URL("../../", import.meta.url);

describe("shared/export", () => {
  it.each([...dataExportFiles(gameData)])(
    "%s is what the code exports now: run npm run export:data and commit it",
    async (path, text) => {
      const committed = await readFile(new URL(path, ROOT), "utf8");
      // Compared parsed first, so a failure names the field that moved.
      expect(JSON.parse(committed)).toEqual(JSON.parse(text));
      expect(committed).toBe(text);
    },
  );
});

describe("gameDataExport", () => {
  const exported = gameDataExport(gameData);

  it("exports each gear item's short line as the shop shows it", () => {
    for (const gear of exported.gear) {
      expect(gear.short).toBe(gearShort(gameData, gear.id));
      expect(gear.short).not.toMatch(/\{\w+\}/);
    }
  });

  it("exports each upgrade's cardEffect and effect as its cards show them", () => {
    for (const upgrade of exported.upgrades) {
      const data = gameData.upgrades[upgrade.id];
      expect(upgrade.cardEffect).toBe(upgradeLine(gameData.tuning, "cardEffect", data));
      expect(upgrade.effect).toBe(upgradeLine(gameData.tuning, "effect", data));
      expect(`${upgrade.cardEffect} ${upgrade.effect}`).not.toMatch(/\{\w+\}/);
    }
  });
});
