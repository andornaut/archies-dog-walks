import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs.ts";
import { DOGS } from "../data/dogs.ts";
import { ENCOUNTERS } from "../data/encounters.ts";
import { RUN_TEXT } from "../data/runText.ts";
import { SHOP_GEAR } from "../data/shop.ts";
import type { DogId, Effect } from "../data/types.ts";
import { UPGRADES } from "../data/upgrades.ts";
import type { EffectSource, RunState } from "../state/runState.ts";
import { LONE } from "../testing/packPlaces.ts";
import { activeModifier, testState } from "../testing/runState.ts";
import { TEST_TUNING } from "../testing/tuning.ts";
import { TEST_WALKER_DATA } from "../testing/walkers.ts";
import { type Change, changeAmount } from "./causes.ts";
import { maxHearts } from "./dogs.ts";
import { resolveEffects } from "./effects.ts";
import { tipValue } from "./run.ts";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning: TEST_TUNING,
  upgrades: UPGRADES,
};
const skunkIgnore = { encounter: "skunk", kind: "encounter", option: 2 } as const;

function only(changes: readonly Change[]): Change {
  const [change, ...rest] = changes;
  if (change === undefined || rest.length > 0) {
    throw new Error(`Expected one change, got ${changes.length}`);
  }
  return change;
}

// The one change the effect makes to the state.
const resolved = (
  effect: Effect,
  state: RunState,
  affected: readonly DogId[] = [],
  source: EffectSource = skunkIgnore,
) => only(resolveEffects(data, { affected, source }, [effect], state).changes);

// A lone dog's owner's max.
const maxOf = (dog: DogId) => maxHearts(TEST_TUNING, [], LONE, DOGS[dog]);
const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);
const bigTipperTip = () => tipValue(data, testState({ kilo: 5 }, { modifiers: [bigTipper] }));

describe("change causes", () => {
  it("add up to the change", () => {
    for (const [, change] of [
      ["a tip with Big tipper's bonus", bigTipperTip],
      [
        "hearts capped",
        () => resolved(gainTwo, testState({ reggie: maxOf("reggie") - 1 }), [], skunkIgnore),
      ],
    ] satisfies readonly [string, () => Change][]) {
      const made = change();
      expect(made.causes.reduce((total, { amount }) => total + amount, 0)).toBe(changeAmount(made));
    }
  });
});
