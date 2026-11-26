import { pixels } from "@andornaut/game-kit/runtime/units";

import type { Effect, GameData, Modifier } from "../data/index.ts";
import { packFor, packOrder } from "../state/pack.ts";
import type { EffectSource, Loadout, RunState } from "../state/runState.ts";
import { cents } from "../units.ts";
import { packPlace, startHearts } from "./dogs.ts";
import { applyEffects } from "./effects.ts";
import { firstZoneId } from "./route.ts";
import { read } from "./units.ts";
import { walkerEffects } from "./walkers.ts";

const NO_SPARE_TREATS: RunState["spareTreats"] = { held: 0, spent: 0, stored: 0 };

// A run at its start with nothing on it yet but its gear, pack, route and walker: no money, no
// effects, nothing counted, walking zone 0 from its start.
export function blankRun(start: Pick<RunState, "gear" | "pack" | "route" | "walker">): RunState {
  const { gear, pack, route, walker } = start;
  return {
    bumpsByKind: {},
    bumpsByZone: [],
    cardsThisZone: 0,
    debuffs: [],
    debuffsGot: {},
    dodges: [],
    firstZone: 0,
    foundGear: null,
    gear,
    heartsForgiven: 0,
    immunities: [],
    modifiers: [],
    money: cents(0),
    optionPicks: {},
    pack,
    phase: { kind: "walking" },
    route,
    skipPass: null,
    skipUsed: false,
    spareTreats: NO_SPARE_TREATS,
    startMoney: cents(0),
    tallies: {},
    upgradesPicked: [],
    walker,
    zoneDistance: pixels(0),
    zoneEndMoney: cents(0),
    zoneIndex: 0,
  };
}

// A run's opening state, in the world's first zone: the walker's effects and the gear's applied,
// then each owner's starting hearts, full for the pack's size, and the starting money. Throws for a
// dog listed twice or more dogs than the player has slots.
export function newRun(
  data: Pick<
    GameData,
    "debuffs" | "dogs" | "encounters" | "shopGear" | "tuning" | "walkerPerks" | "walkers" | "world"
  >,
  dogSlots: number,
  loadout: Loadout,
): RunState {
  if (new Set(loadout.dogs).size !== loadout.dogs.length) {
    throw new Error(`A dog can walk only once in a pack: ${loadout.dogs.join(", ")}`);
  }
  if (loadout.dogs.length > dogSlots) {
    throw new Error(`A pack of ${loadout.dogs.length} needs that many dog slots, not ${dogSlots}`);
  }
  const order = packOrder(data.dogs, loadout.dogs);
  const packWith = (modifiers: readonly Modifier[]) =>
    packFor(
      (dog) => ({
        dog,
        hearts: startHearts(data.tuning, modifiers, packPlace(order, dog), data.dogs[dog]),
        status: "walking",
      }),
      order,
    );
  const { walker } = loadout;
  const empty = blankRun({
    gear: loadout.gear,
    pack: packWith([]),
    route: [firstZoneId(data)],
    walker,
  });
  const applyFrom = (source: EffectSource, effects: readonly Effect[], state: RunState) =>
    applyEffects(data, { affected: [], source }, effects, state);
  const walked = applyFrom({ kind: "walker", walker }, walkerEffects(data, walker), empty);
  const geared =
    loadout.gear === null
      ? walked
      : applyFrom(
          { gear: loadout.gear, kind: "gear" },
          data.shopGear[loadout.gear].effects,
          walked,
        );
  const money = read(data.tuning, "money", "startPurse");
  return {
    ...geared,
    money,
    pack: packWith(geared.modifiers),
    startMoney: money,
    zoneEndMoney: money,
  };
}
