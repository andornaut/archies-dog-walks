import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { RunState } from "../state/runState.ts";
import { testState } from "../testing/runState.ts";
import {
  achievementConditionText,
  countBump,
  countLandedBump,
  countOptionPick,
  countTally,
  runCountersOf,
} from "./achievements.ts";

describe("counters", () => {
  // Each counter applied to a walk in its third zone, and what it has counted after. A debuff
  // applied is counted where effects apply it.
  it.each([
    {
      count: (run: RunState) => countBump(countBump(run)).bumpsByZone,
      counted: [0, 0, 2],
      name: "bumps by zone, filling the zones before with none",
    },
    {
      count: (run: RunState) =>
        countLandedBump("raccoon", countLandedBump("pigeons", countLandedBump("pigeons", run)))
          .bumpsByKind,
      counted: { pigeons: 2, raccoon: 1 },
      name: "landed bumps by obstacle kind, adding to a kind already counted",
    },
    {
      count: (run: RunState) => countTally("treats", countTally("treats", run)).tallies,
      counted: { treats: 2 },
      name: "a tally, adding to one already counted",
    },
  ])("counts $name", ({ count, counted }) => {
    expect(count(testState({ kilo: 5 }, { zoneIndex: 2 }))).toEqual(counted);
  });

  it("counts option picks by encounter and option id, each apart", () => {
    const run = testState({ kilo: 5 });
    const picked = [
      ["cheeseCrates", "sniff"],
      ["cheeseCrates", "sniff"],
      ["cheeseCrates", "hurryOn"],
      ["greenBinSpill", "wadeThrough"],
    ] as const;
    const after = picked.reduce(
      (state, [encounter, option]) => countOptionPick(encounter, option, state),
      run,
    );
    expect(after.optionPicks).toEqual({
      cheeseCrates: { hurryOn: 1, sniff: 2 },
      greenBinSpill: { wadeThrough: 1 },
    });
    expect(runCountersOf(after).optionPicks).toEqual(after.optionPicks);
  });
});

describe("achievementConditionText", () => {
  it("words every achievement's conditions in walks and neighbourhoods, never runs or zones", () => {
    const worded = gameData.achievements.flatMap(({ conditions }) =>
      conditions.map((condition) => achievementConditionText(gameData, condition)),
    );
    expect(worded.filter((text) => /\b(runs?|zones?|money)\b/.test(text))).toEqual([]);
  });
});
