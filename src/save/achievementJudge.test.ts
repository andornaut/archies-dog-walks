import { newlyEarned } from "@andornaut/game-kit/runtime/achievements";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { AchievementCondition, DogId, TallyId, ZoneId } from "../data/types.ts";
import { countBump, type RunFacts } from "../rules/achievements.ts";
import { runFactsFor, saveFor } from "../testing/achievements.ts";
import { defined } from "../testing/defined.ts";
import { testState } from "../testing/runState.ts";
import { newPlayerSave, veteranSave } from "../testing/saves.ts";
import { cents } from "../units.ts";
import { achievementJudge } from "./achievementJudge.ts";
import { type SaveDocument } from "./schema.ts";

const JUDGE = achievementJudge(gameData);

const facts = (changes: Partial<RunFacts> = {}): RunFacts => ({
  bumpsByKind: {},
  bumpsByZone: [],
  debuffsGot: {},
  dogsHome: 1,
  earnedCents: cents(0),
  firstZone: 0,
  lastHeartOwners: 0,
  optionPicks: {},
  packSize: 1,
  startCents: cents(0),
  tallies: {},
  zonesFinished: 0,
  ...changes,
});

const holdsForRun = (condition: AchievementCondition, run: Partial<RunFacts>) =>
  JUDGE.holds("bank", { run: facts(run), save: newPlayerSave }, condition);

const ALL_DOGS = keysOf(gameData.dogs);
const ALL_GEAR = keysOf(gameData.shopGear);
const ALL_ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);

function withStats(stats: Partial<SaveDocument["stats"]>): SaveDocument {
  return { ...newPlayerSave, stats: { ...newPlayerSave.stats, ...stats } };
}

// A dog's stats after its owner fired you count times.
const firedTimes = (count: number) => ({ timesFired: count, walks: count, zonesFinished: 0 });

function withOwned(owned: Partial<SaveDocument["owned"]>): SaveDocument {
  return { ...newPlayerSave, owned: { ...newPlayerSave.owned, ...owned } };
}

type Count = number | "all";
const zonesFinished = (count: Count) => ({ count, kind: "zonesFinished" }) as const;
const cleanZones = (count: Count) => ({ count, kind: "cleanZones" }) as const;
const packOf2 = { count: 2, kind: "packSize" } as const;
const payday = { dollars: 500, kind: "earnings" } as const;
const stinky3 = { count: 3, debuff: "stinky", kind: "debuffsGot" } as const;
const zoomies3 = { count: 3, debuff: "zoomies", kind: "debuffsGot" } as const;
const closeShave = { kind: "finishOnLastHeart" } as const;
const everybodyHome = { kind: "fullPackBonus", packSize: 3 } as const;
const walked = { zonesFinished: 4 };
const bumped = (bumpsByZone: number[], finished: number) => ({
  bumpsByZone,
  zonesFinished: finished,
});
const fromZone3 = { firstZone: 2, zonesFinished: 4 };
const homeInZone4 = { firstZone: 3, zonesFinished: 3 };
const minorBump = [...countBump(testState({ kilo: 5 })).bumpsByZone];
const spotlight3 = { count: 3, debuff: "spotlight", kind: "debuffsGot" } as const;

describe("run conditions", () => {
  // A dev start from zone 3 never walked zones 1 and 2: they count as neither finished nor clean.
  const cases: [string, AchievementCondition, Partial<RunFacts>, boolean][] = [
    ["zonesFinished below the count", zonesFinished(1), { zonesFinished: 0 }, false],
    ["zonesFinished at the count", zonesFinished(1), { zonesFinished: 1 }, true],
    ["zonesFinished all, a zone short", zonesFinished("all"), { zonesFinished: 3 }, false],
    ["zonesFinished all, every zone", zonesFinished("all"), { zonesFinished: 4 }, true],
    ["cleanZones, a finished zone clean", cleanZones(1), bumped([2, 0], 2), true],
    ["cleanZones, the finished zone bumped", cleanZones(1), bumped([2], 1), false],
    ["cleanZones, never the zone in progress", cleanZones(1), bumped([1], 1), false],
    ["cleanZones, no zone finished", cleanZones(1), { zonesFinished: 0 }, false],
    ["cleanZones, spoilt by a plain hit", cleanZones(1), bumped(minorBump, 1), false],
    ["cleanZones all, no bump", cleanZones("all"), { zonesFinished: 4 }, true],
    ["cleanZones all, a bump in the last zone", cleanZones("all"), bumped([0, 0, 0, 1], 4), false],
    ["cleanZones all, a zone short", cleanZones("all"), { zonesFinished: 3 }, false],
    ["dev start from zone 3, zonesFinished 2", zonesFinished(2), fromZone3, true],
    ["dev start from zone 3, zonesFinished 3", zonesFinished(3), fromZone3, false],
    ["dev start from zone 3, zonesFinished all", zonesFinished("all"), fromZone3, false],
    ["dev start from zone 3, cleanZones 2", cleanZones(2), fromZone3, true],
    ["dev start from zone 3, cleanZones all", cleanZones("all"), fromZone3, false],
    ["dev start home in zone 4, zonesFinished", zonesFinished(1), homeInZone4, false],
    ["dev start home in zone 4, cleanZones", cleanZones(1), homeInZone4, false],
    ["packSize, fewer dogs set out", packOf2, { packSize: 1 }, false],
    ["packSize, more dogs set out, fired or not", packOf2, { packSize: 3 }, true],
    ["earnings a cent short", payday, { earnedCents: cents(49_999) }, false],
    ["earnings at the dollars", payday, { earnedCents: cents(50_000) }, true],
    [
      "earnings at the dollars only with the starting money",
      payday,
      { earnedCents: cents(50_000), startCents: cents(2_000) },
      false,
    ],
    [
      "earnings at the dollars net of the starting money",
      payday,
      { earnedCents: cents(52_000), startCents: cents(2_000) },
      true,
    ],
    ["debuffsGot below the count", stinky3, { debuffsGot: { stinky: 2 } }, false],
    ["debuffsGot at the count", stinky3, { debuffsGot: { stinky: 3 } }, true],
    ["debuffsGot counts one walk's zoomies", zoomies3, { debuffsGot: { zoomies: 3 } }, true],
    ["debuffsGot counts no other debuff", zoomies3, { debuffsGot: { stinky: 3 } }, false],
    ["debuffsGot, the Spotlight a time short", spotlight3, { debuffsGot: { spotlight: 2 } }, false],
    ["debuffsGot, the Spotlight at the count", spotlight3, { debuffsGot: { spotlight: 3 } }, true],
    ["finishOnLastHeart, finished on one", closeShave, { ...walked, lastHeartOwners: 1 }, true],
    ["finishOnLastHeart, none on one", closeShave, { ...walked, lastHeartOwners: 0 }, false],
    [
      "finishOnLastHeart, headed home on one",
      closeShave,
      { lastHeartOwners: 1, zonesFinished: 3 },
      false,
    ],
    ["finishOnLastHeart, dev start", closeShave, { ...fromZone3, lastHeartOwners: 1 }, true],
    [
      "fullPackBonus, every dog of 3 home",
      everybodyHome,
      { ...walked, dogsHome: 3, packSize: 3 },
      true,
    ],
    [
      "fullPackBonus, a dog of 3 fired",
      everybodyHome,
      { ...walked, dogsHome: 2, packSize: 3 },
      false,
    ],
    [
      "fullPackBonus, a smaller pack",
      everybodyHome,
      { ...walked, dogsHome: 2, packSize: 2 },
      false,
    ],
    [
      "fullPackBonus, headed home",
      everybodyHome,
      { dogsHome: 3, packSize: 3, zonesFinished: 3 },
      false,
    ],
  ];

  it("holds each run condition from its threshold, over the zones the walk finished", () => {
    const wrong = cases
      .filter(([, condition, run, holds]) => holdsForRun(condition, run) !== holds)
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });
});

describe("profile conditions", () => {
  const all = (
    kind:
      | "dogsFinishedWith"
      | "dogsOwned"
      | "firedByOwners"
      | "gearOwned"
      | "walkersFinishedWith"
      | "walkersUnlocked"
      | "zonesEverFinished",
  ) => ({ count: "all", kind }) as const;
  const count = (
    kind: "noFiringStreak" | "timesFired" | "walksFinished" | "walksPlayed",
    n: number,
  ) => ({ count: n, kind }) as const;
  const sniffCheese = (n: number) =>
    ({ count: n, encounter: "cheeseCrates", kind: "optionPicks", option: "sniff" }) as const;
  const tally = (name: TallyId, n: number) => ({ count: n, kind: "tally", tally: name }) as const;
  const birds = (n: number) => ({ count: n, kind: "bumps", kinds: ["goose", "pigeons"] }) as const;
  const lifetime = { dollars: 200, kind: "lifetimeEarnings" } as const;
  const firedBy = (dogs: readonly DogId[]) =>
    Object.fromEntries(dogs.map((dog) => [dog, { timesFired: 1, walks: 1, zonesFinished: 0 }]));
  const ALL_WALKERS = keysOf(gameData.walkers);
  const veteran = veteranSave();

  type ProfileCase = [string, AchievementCondition, SaveDocument | null, boolean];
  // A condition just short of its goal and just meeting it.
  const edge = (
    name: string,
    condition: AchievementCondition,
    short: SaveDocument,
    met: SaveDocument,
  ): ProfileCase[] => [
    [`${name}, short`, condition, short, false],
    [`${name}, met`, condition, met, true],
  ];
  const dogsOwned = newPlayerSave.owned.dogs.length;

  const cases: ProfileCase[] = [
    ["a run condition, without a run", zonesFinished(1), veteran, false],
    ["packSize, without a run", { count: 1, kind: "packSize" }, veteran, false],
    ["dogsOwned at the count", { count: dogsOwned, kind: "dogsOwned" }, newPlayerSave, true],
    [
      "dogsOwned below the count",
      { count: dogsOwned + 1, kind: "dogsOwned" },
      newPlayerSave,
      false,
    ],
    ...edge("dogsOwned all", all("dogsOwned"), newPlayerSave, withOwned({ dogs: ALL_DOGS })),
    ...edge(
      "gearOwned all",
      all("gearOwned"),
      withOwned({ gear: ALL_GEAR.slice(1) }),
      withOwned({ gear: ALL_GEAR }),
    ),
    ...edge(
      "noFiringStreak",
      count("noFiringStreak", 10),
      withStats({ noFiringStreak: 9 }),
      withStats({ noFiringStreak: 10 }),
    ),
    ...edge(
      "optionPicks",
      sniffCheese(10),
      withStats({ optionPicks: { cheeseCrates: { sniff: 9 } } }),
      withStats({ optionPicks: { cheeseCrates: { sniff: 10 } } }),
    ),
    [
      "optionPicks, another option of the card",
      sniffCheese(10),
      withStats({ optionPicks: { cheeseCrates: { buy: 10, hurryOn: 10 } } }),
      false,
    ],
    [
      "optionPicks, an option of the same id on another card",
      { count: 10, encounter: "otherDog", kind: "optionPicks", option: "sniff" },
      withStats({ optionPicks: { cheeseCrates: { sniff: 10 } } }),
      false,
    ],
    [
      "timesFired at the count, over every owner",
      count("timesFired", 10),
      withStats({ dogs: { kilo: firedTimes(6), lady: firedTimes(4) } }),
      true,
    ],
    ...edge(
      "tally",
      tally("dodges", 5),
      withStats({ tallies: { dodges: 4 } }),
      withStats({ tallies: { dodges: 5 } }),
    ),
    [
      "tally, another tally's count",
      tally("dodges", 5),
      withStats({ tallies: { treats: 9 } }),
      false,
    ],
    ...edge(
      "walkersUnlocked all",
      all("walkersUnlocked"),
      withOwned({ walkers: ALL_WALKERS.slice(1) }),
      withOwned({ walkers: ALL_WALKERS }),
    ),
    ...edge(
      "dogsFinishedWith all, across walks",
      all("dogsFinishedWith"),
      withStats({ dogsFinishedWith: ALL_DOGS.slice(1) }),
      withStats({ dogsFinishedWith: ALL_DOGS }),
    ),
    ...edge(
      "zonesEverFinished all, across walks",
      all("zonesEverFinished"),
      withStats({ zonesEverFinished: ALL_ZONES.slice(1) }),
      withStats({ zonesEverFinished: ALL_ZONES }),
    ),
    ...edge(
      "bumps across kinds",
      birds(3),
      withStats({ bumpsByKind: { pigeons: 2 } }),
      withStats({ bumpsByKind: { goose: 1, pigeons: 2 } }),
    ),
    [
      "bumps, another kind's count",
      birds(3),
      withStats({ bumpsByKind: { pigeons: 2, raccoon: 5 } }),
      false,
    ],
    ...edge(
      "firedByOwners all, every owner once",
      all("firedByOwners"),
      withStats({ dogs: firedBy(ALL_DOGS.slice(1)) }),
      withStats({ dogs: firedBy(ALL_DOGS) }),
    ),
    [
      "firedByOwners, a dog walked but never fired",
      { count: 1, kind: "firedByOwners" },
      withStats({ dogs: { kilo: { timesFired: 0, walks: 3, zonesFinished: 4 } } }),
      false,
    ],
    ...edge(
      "lifetimeEarnings at the dollars",
      lifetime,
      withStats({ lifetimeCents: cents(19_999) }),
      withStats({ lifetimeCents: cents(20_000) }),
    ),
    ...edge(
      "lifetimeEarnings at the dollars net of starting cash",
      lifetime,
      withStats({ lifetimeCents: cents(25_000), lifetimeStartCents: cents(5_001) }),
      withStats({ lifetimeCents: cents(25_000), lifetimeStartCents: cents(5_000) }),
    ),
    ...edge(
      "walkersFinishedWith all",
      all("walkersFinishedWith"),
      withStats({ walkersFinishedWith: ALL_WALKERS.slice(1) }),
      withStats({ walkersFinishedWith: ALL_WALKERS }),
    ),
    ...edge(
      "walksPlayed, however they ended",
      count("walksPlayed", 6),
      withStats({ runs: { finished: 1, noDogs: 2, wentHome: 2 } }),
      withStats({ runs: { finished: 1, noDogs: 2, wentHome: 3 } }),
    ),
    ...edge(
      "walksFinished, the others played ended early",
      count("walksFinished", 6),
      withStats({ runs: { finished: 5, noDogs: 4, wentHome: 4 } }),
      withStats({ runs: { finished: 6, noDogs: 0, wentHome: 0 } }),
    ),
    ["anything without a save, as for the simulator", count("timesFired", 0), null, false],
  ];

  it("holds each profile condition from its threshold, and none without a save", () => {
    const holds = (condition: AchievementCondition, save: SaveDocument | null) =>
      save === null
        ? JUDGE.holds("run", { run: facts() }, condition)
        : JUDGE.holds("profile", { save }, condition);
    const wrong = cases
      .filter(([, condition, save, held]) => holds(condition, save) !== held)
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });
});

const ALL_IDS = gameData.achievements.map(({ id }) => id);
// The condition kinds judged on one run; every other kind is judged on the save.
const RUN_KINDS: readonly AchievementCondition["kind"][] = [
  "cleanZones",
  "debuffsGot",
  "earnings",
  "finishOnLastHeart",
  "fullPackBonus",
  "packSize",
  "zonesFinished",
];

describe("newlyEarned", () => {
  // The first badge of each set of condition kinds: each kind's threshold is checked above, and
  // every badge together below.
  const kindsOf = (id: string) =>
    defined(gameData.achievements.find((each) => each.id === id))
      .conditions.map(({ kind }) => kind)
      .sort()
      .join();
  const sampleIds = ALL_IDS.filter(
    (id, i) => ALL_IDS.findIndex((other) => kindsOf(other) === kindsOf(id)) === i,
  );

  it.each(sampleIds)("earns %s from the least its goal asks for, and only once", (id) => {
    const save = saveFor(gameData, [id], newPlayerSave);
    const run = runFactsFor(gameData, [id]);
    const { achievements } = gameData;
    expect(newlyEarned(JUDGE, achievements, "bank", { run, save }, [])).toContain(id);
    expect(newlyEarned(JUDGE, achievements, "bank", { run, save }, [id])).not.toContain(id);
  });

  it("lists every achievement met and not yet earned, in wall order", () => {
    const save = saveFor(gameData, ALL_IDS, newPlayerSave);
    const run = runFactsFor(gameData, ALL_IDS);
    expect(newlyEarned(JUDGE, gameData.achievements, "bank", { run, save }, [])).toEqual(ALL_IDS);
  });

  // A badge of two conditions: a pack of 2 that finishes the walk.
  const [first] = gameData.achievements;
  const both = { ...first, conditions: [packOf2, zonesFinished("all")] } as const;
  it.each<[string, Partial<RunFacts>, boolean]>([
    ["both met", { packSize: 2, ...walked }, true],
    ["the pack too small", { packSize: 1, ...walked }, false],
    ["a zone short", { packSize: 2, zonesFinished: 3 }, false],
  ])("needs every condition: %s", (_, run, earned) => {
    const judged = { run: facts(run), save: newPlayerSave };
    expect(newlyEarned(JUDGE, [both], "bank", judged, [])).toEqual(earned ? [first.id] : []);
  });
});

describe("the run scope", () => {
  it("earns only achievements whose conditions are all about the run", () => {
    const aboutTheRun = gameData.achievements
      .filter(({ conditions }) => conditions.every(({ kind }) => RUN_KINDS.includes(kind)))
      .map(({ id }) => id);
    const run = runFactsFor(gameData, ALL_IDS);
    expect(aboutTheRun.length).toBeLessThan(ALL_IDS.length);
    expect(newlyEarned(JUDGE, gameData.achievements, "run", { run }, [])).toEqual(aboutTheRun);
  });
});
