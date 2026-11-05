import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { UpgradeId } from "../data/types.ts";
import { testState } from "../testing/runState.ts";
import { cardFor } from "./choices.ts";
import { effectDuration, upgradeDuration } from "./durations.ts";

describe("an upgrade's duration", () => {
  it("is one every effect of every upgrade shares", () => {
    for (const upgrade of Object.values(gameData.upgrades)) {
      expect(new Set(upgrade.effects.map(effectDuration))).toEqual(
        new Set([upgradeDuration(upgrade)]),
      );
    }
  });

  it("is on each fork path card, for the upgrade it carries", () => {
    const upgrades: UpgradeId[] = ["bellyRubs", "rushHour", "raincoats"];
    const card = cardFor(gameData, testState({ kilo: 5 }), {
      kind: "fork",
      paths: ["cabbagetown", "highPark", "distilleryDistrict"],
      upgrades,
    });
    expect(card.options.map(({ duration }) => duration)).toEqual(
      upgrades.map((id) => upgradeDuration(gameData.upgrades[id])),
    );
  });
});
