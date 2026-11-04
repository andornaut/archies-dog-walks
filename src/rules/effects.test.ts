import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs.ts";
import { DOGS } from "../data/dogs.ts";
import { ENCOUNTERS } from "../data/encounters.ts";
import { TUNING } from "../data/tuning.ts";
import type { DogId, Effect } from "../data/types.ts";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState.ts";
import { LONE } from "../testing/packPlaces.ts";
import { activeModifier, heartsByDog, testState } from "../testing/runState.ts";
import { TEST_TUNING } from "../testing/tuning.ts";
import { cents } from "../units.ts";
import { maxHearts, ownerMaxHearts } from "./dogs.ts";
import {
  applyEffects,
  type EffectContext,
  moneyCost,
  resolveEffects,
  shareHearts,
  targetDogs,
} from "./effects.ts";
import { read } from "./units.ts";

const data = { debuffs: DEBUFFS, dogs: DOGS, encounters: ENCOUNTERS, tuning: TEST_TUNING };
const SKUNK_IGNORE: EffectSource = { encounter: "skunk", kind: "encounter", option: 2 };
const context = (affected: readonly DogId[]): EffectContext => ({
  affected,
  source: SKUNK_IGNORE,
});
const charmer = activeModifier(
  { kind: "upgrade", upgrade: "charmer" },
  { by: "charmerFreeCards", operation: "add", stat: "freeCards" },
);

describe("applyEffects: hearts", () => {
  const loseTwo: Effect = { amount: -2, kind: "hearts", target: { kind: "affected" } };
  const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
  const luckyCollar = activeModifier(
    { gear: "luckyCollar", kind: "gear" },
    { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
  );
  type Slots = Parameters<typeof testState>[0];

  it("applies hearts within 0 and the max, the same to every owner", () => {
    for (const [, affected, effect, slots, expected, modifiers = []] of [
      ["never below 0", ["ginger"], loseTwo, { ginger: 1 }, { ginger: 0 }],
      [
        "never above the dog's max, which depends on its size",
        [],
        gainOne,
        { ginger: 6, kilo: 9, pepe: 8 },
        { ginger: 6, kilo: 10, pepe: 8 },
      ],
      [
        "the same amount to every owner",
        ["kilo", "reggie"],
        loseTwo,
        { kilo: 5, reggie: 5 },
        { kilo: 3, reggie: 3 },
      ],
      [
        "the max raised by a maxHearts modifier",
        [],
        gainOne,
        { ginger: 6 },
        { ginger: 7 },
        [luckyCollar],
      ],
    ] satisfies readonly [string, DogId[], Effect, Slots, Slots, ActiveModifier[]?][]) {
      const state = testState(slots, { modifiers });
      expect(heartsByDog(applyEffects(data, context(affected), [effect], state))).toEqual(expected);
    }
  });
});

describe("shareHearts", () => {
  // Each share in the order shareHearts gives them, front dogs first.
  it.each<[string, DogId[], number, Partial<Record<DogId, number>>]>([
    ["a lone dog gets the whole total", ["reggie"], 3, { reggie: 3 }],
    ["a pair's front dog gets the one left over", ["reggie", "kilo"], 3, { kilo: 2, reggie: 1 }],
    ["a trio gets one each", ["reggie", "pepe", "kilo"], 3, { kilo: 1, pepe: 1, reggie: 1 }],
    [
      "the front dogs first, when more are left over",
      ["reggie", "pepe", "kilo"],
      5,
      { kilo: 2, pepe: 2, reggie: 1 },
    ],
    [
      "nothing for a dog whose share is nothing",
      ["reggie", "pepe", "kilo"],
      2,
      { kilo: 1, pepe: 1 },
    ],
    ["nothing among no dogs", [], 3, {}],
  ])("shares %s", (_name, dogs, total, expected) => {
    expect(shareHearts(data, dogs, total)).toEqual(
      Object.entries(expected).map(([dog, hearts]) => ({ dog, hearts })),
    );
  });
});

describe("applyEffects: hearts shared by the pack", () => {
  const shared: Effect = { amount: "neighbourHearts", kind: "sharedHearts" };
  type Slots = Parameters<typeof testState>[0];
  const kiloPair = testState({ kilo: 1, reggie: 1 });
  const kiloMax = ownerMaxHearts(data, kiloPair, "kilo");

  // The pinned tuning shares 3 hearts. The shareHearts table covers each pack size's shares.
  it.each<[string, Slots, Slots]>([
    [
      "2 to the front dog's owner and 1 to the other",
      { kilo: 1, reggie: 1 },
      { kilo: 3, reggie: 2 },
    ],
    [
      "among the dogs still walking, leaving out a fired owner's",
      { ginger: 1, kilo: "fired", reggie: 1 },
      { ginger: 3, reggie: 2 },
    ],
    [
      "within each owner's max, losing the hearts past it",
      { kilo: kiloMax - 1, reggie: 1 },
      { kilo: kiloMax, reggie: 2 },
    ],
  ])("gives %s", (_name, slots, expected) => {
    expect(heartsByDog(applyEffects(data, context([]), [shared], testState(slots)))).toEqual(
      expected,
    );
  });

  it("reports each owner's share and the cap, summing to the change", () => {
    const { changes } = resolveEffects(
      data,
      context([]),
      [shared],
      testState({ kilo: kiloMax - 1, reggie: 1 }),
    );
    expect(changes).toEqual([
      {
        after: kiloMax,
        before: kiloMax - 1,
        causes: [
          { amount: 2, kind: "effect", source: SKUNK_IGNORE },
          { amount: -1, bound: "max", kind: "limit" },
        ],
        dog: "kilo",
        kind: "hearts",
      },
      {
        after: 2,
        before: 1,
        causes: [{ amount: 1, kind: "effect", source: SKUNK_IGNORE }],
        dog: "reggie",
        kind: "hearts",
      },
    ]);
  });
});

describe("resolveEffects: changes and their causes", () => {
  it("reports the base and the cap, summing to the change", () => {
    const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
    const max = maxHearts(TEST_TUNING, [], LONE, DOGS.reggie);
    const { changes } = resolveEffects(
      data,
      context([]),
      [gainTwo],
      testState({ reggie: max - 1 }),
    );
    expect(changes).toEqual([
      {
        after: max,
        before: max - 1,
        causes: [
          { amount: 2, kind: "effect", source: SKUNK_IGNORE },
          { amount: -1, bound: "max", kind: "limit" },
        ],
        dog: "reggie",
        kind: "hearts",
      },
    ]);
  });

  it("reports no change for an owner whose meter does not move", () => {
    const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
    const full = testState({ ginger: maxHearts(TEST_TUNING, [], LONE, DOGS.ginger) });
    const { changes } = resolveEffects(data, context([]), [gainOne], full);
    expect(changes).toEqual([]);
  });

  describe("Second chance", () => {
    const tuning = TUNING;
    const allowance = read(tuning, "hearts", "secondChanceForgiven");
    const source = { kind: "walker", walker: "casey" } as const;
    const secondChance = activeModifier(source, {
      by: "secondChanceForgiven",
      operation: "add",
      stat: "forgivenHearts",
    });
    // Kilo's owner walking Kilo alone, at full hearts.
    const full = maxHearts(tuning, [], LONE, DOGS.kilo);
    const lose = (amount: 1 | 2): Effect => ({
      amount: amount === 1 ? -1 : -2,
      kind: "hearts",
      target: { kind: "all" },
    });

    it("forgives up to its allowance of a loss, reporting it, and no more once it is used this zone", () => {
      for (const loss of [1, 2] as const) {
        const forgiven = Math.min(loss, allowance);
        const state = testState({ kilo: full }, { modifiers: [secondChance] });
        const applied = resolveEffects({ ...data, tuning }, context([]), [lose(loss)], state);
        expect(applied.changes).toEqual([
          {
            after: full - loss + forgiven,
            before: full,
            causes: [
              { amount: -loss, kind: "effect", source: SKUNK_IGNORE },
              { amount: forgiven, forgives: true, kind: "modifier", source },
            ],
            dog: "kilo",
            kind: "hearts",
          },
        ]);
        expect(applied.state.heartsForgiven).toBe(forgiven);
      }
      const used = testState(
        { kilo: full },
        { heartsForgiven: allowance, modifiers: [secondChance] },
      );
      const { changes } = resolveEffects({ ...data, tuning }, context([]), [lose(1)], used);
      expect(changes.map((change) => change.causes.length)).toEqual([1]);
    });
  });

  it("waives a free card's cost, naming Charmer, and makes no money change", () => {
    const towel: Effect = {
      amount: "cardOptionCost",
      change: "lose",
      kind: "money",
    };
    const state = testState({ ginger: 5, kilo: 5 }, { modifiers: [charmer] });
    const { changes } = resolveEffects(data, context(["ginger", "kilo"]), [towel], state);
    expect(changes).toEqual([]);
    expect(moneyCost(data, state, [towel])).toBe(0);
  });
});

describe("targetDogs", () => {
  const pack = testState({ ginger: 3, pepe: "fired", reggie: 3 });

  it.each<[string, Parameters<typeof targetDogs>[3], DogId[], DogId[]]>([
    ["all, leaving out a fired owner's dog", { kind: "all" }, [], ["ginger", "reggie"]],
    ["affected, leaving out a fired owner's dog", { kind: "affected" }, ["pepe"], []],
  ])("picks %s", (_name, target, affected, expected) => {
    expect(targetDogs(data, { affected }, pack, target)).toEqual(expected);
  });
});

describe("moneyCost and applyEffects: money", () => {
  const towel: Effect = {
    amount: "cardOptionCost",
    change: "lose",
    kind: "money",
  };
  const gain: Effect = {
    amount: "lostWalletJackpot",
    change: "gain",
    kind: "money",
  };

  // Charmer, with cardsThisZone cards resolved this zone.
  const talked = (slots: Parameters<typeof testState>[0], cardsThisZone = 0) =>
    testState(slots, { cardsThisZone, modifiers: [charmer] });
  const cost = read(TEST_TUNING, "money", "cardOptionCost");

  it("charges a cost once, nothing on the zone's first card with Charmer", () => {
    for (const [, effect, state, charged] of [
      ["a cost once, whatever the pack", towel, testState({ ginger: 5, kilo: 5, reggie: 5 }), cost],
      ["nothing on the zone's first card with Charmer", towel, talked({ ginger: 5, kilo: 5 }), 0],
      ["nothing for a lone dog either", towel, talked({ ginger: 5 }), 0],
      ["in full on the zone's next card", towel, talked({ ginger: 5, kilo: 5 }, 1), cost],
      ["nothing for a gain", gain, testState({ ginger: 5, kilo: 5 }), 0],
    ] satisfies readonly [string, Effect, RunState, number][]) {
      expect(moneyCost(data, state, [effect])).toBe(charged);
    }
  });

  it("adds gains and subtracts costs", () => {
    const start = testState({ ginger: 5, kilo: 5 }, { money: cents(5000) });
    const gained = read(TEST_TUNING, "money", "lostWalletJackpot");
    expect(applyEffects(data, context([]), [gain], start).money).toBe(5000 + gained);
    expect(applyEffects(data, context([]), [towel], start).money).toBe(5000 - cost);
  });
});

describe("applyEffects: other kinds", () => {
  it("refreshes a debuff the pack already has instead of stacking it", () => {
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    const state = applyEffects(data, context([]), [stinky, stinky], testState({ kilo: 5 }));
    expect(state.debuffs).toEqual([
      {
        debuff: "stinky",
        secondsLeft: read(TEST_TUNING, "seconds", "stinkySeconds"),
        untilZone: 0,
      },
    ]);
    expect(state.debuffsGot).toEqual({ stinky: 2 });
  });

  it("halves a debuff's time with Quick recovery", () => {
    const quickRecovery = activeModifier(
      { kind: "walker", walker: "ada" },
      { by: "quickRecoveryDebuffFactor", operation: "multiply", stat: "debuffSeconds" },
    );
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    // The test tuning makes every walker's perk neutral, so this one is put back at a half.
    const { multipliers } = TEST_TUNING;
    const tuning = {
      ...TEST_TUNING,
      multipliers: { ...multipliers, quickRecoveryDebuffFactor: 0.5 },
    };
    const state = applyEffects(
      { ...data, tuning },
      context([]),
      [stinky],
      testState({ kilo: 5 }, { modifiers: [quickRecovery] }),
    );
    expect(state.debuffs[0]?.secondsLeft).toBe(read(TEST_TUNING, "seconds", "stinkySeconds") / 2);
  });

  const raincoats: Effect = { duration: "run", encounter: "puddle", kind: "immune" };
  const bigTipper: Effect = {
    by: "bigTipperTipBonus",
    duration: "run",
    kind: "modifier",
    operation: "add",
    stat: "tipValue",
  };
  it.each([
    {
      effects: [raincoats, raincoats],
      expected: { immunities: [{ encounter: "puddle", source: SKUNK_IGNORE }] },
      name: "records an immunity once",
    },
    {
      effects: [bigTipper],
      expected: { modifiers: [{ ...bigTipper, source: SKUNK_IGNORE }] },
      name: "keeps a modifier, with its source, for the rules that read its stat",
    },
    {
      effects: [{ kind: "skipOption" } as const],
      expected: { skipPass: SKUNK_IGNORE },
      name: "offers a free Skip, naming what gave it",
    },
  ] satisfies { effects: Effect[]; expected: Partial<RunState>; name: string }[])(
    "$name",
    ({ effects, expected }) => {
      const state = applyEffects(data, context([]), effects, testState({ kilo: 5 }));
      const keys = Object.keys(expected) as (keyof RunState)[];
      expect(Object.fromEntries(keys.map((key) => [key, state[key]]))).toEqual(expected);
    },
  );
});
