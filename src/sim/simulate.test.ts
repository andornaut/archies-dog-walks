import { itemAt } from "@andornaut/game-kit/arrays";
import { keysOf } from "@andornaut/game-kit/records";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import type { DebuffId } from "../data/types";
import { currentZoneId } from "../rules/route";
import { bumpCash, tipValue } from "../rules/run";
import { NO_PULLS } from "../runner/pulls";
import * as sessions from "../runner/session";
import { SpawnPlanningError, type SpawnPlanSnapshot } from "../runner/spawnSearch";
import { startRoad, type WalkStep } from "../runner/walk";
import type { WalkItemKind } from "../runner/walkItems";
import type { ZonePlanObservation } from "../runner/zonePlan";
import { TALLY_IDS } from "../save/schema";
import { packDogs, packOrder } from "../state/pack";
import type { PackDogs, RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { activeModifier, testState } from "../testing/runState";
import { IDEAL_SKILL, simConfig } from "../testing/sim";
import { cents } from "../units";
import { badgeCounters } from "./report";
import {
  type DebuffCosts,
  type DebuffsByZone,
  noteDebuffCosts,
  noteZoneDebuffs,
  type RunResult,
  type SimConfig,
  simulateRun,
} from "./simulate";
import { type Skill, SKILL_PRESETS } from "./skills";

const TRIO: PackDogs = ["ginger", "lady", "kilo"];
const RISKY: PackDogs = ["buddy", "archie", "sequoia"];
// A bot that misses every lane change it plans, so it walks into whatever comes.
const BLIND: Skill = {
  driftReactionSeconds: 0,
  errorRate: 1,
  laneChangeCooldown: 0,
  lookAheadSeconds: 0,
  reactionSeconds: 0,
};

type Overrides = Partial<Omit<SimConfig, "player">> & { readonly skill?: Skill };

function config(overrides: Overrides = {}): SimConfig {
  const { pack = TRIO, skill = SKILL_PRESETS.typical, ...rest } = overrides;
  return simConfig(skill, pack, rest);
}

function runs(count: number, overrides: Overrides = {}): RunResult[] {
  return Array.from({ length: count }, (_, seed) =>
    simulateRun(gameData, seed + 1, config(overrides)),
  );
}

const FEE_AND_BADGE_SEEDS = [1, 2] as const;
const feeAndBadgeRuns = new Map<number, RunResult>();

// Fee and badge assertions only read this exact pair of real walks.
function feeAndBadgeRun(seed: (typeof FEE_AND_BADGE_SEEDS)[number]): RunResult {
  let result = feeAndBadgeRuns.get(seed);
  if (result === undefined) {
    result = simulateRun(
      gameData,
      seed,
      config({ pack: RISKY, policy: "alwaysHearts", skill: SKILL_PRESETS.novice }),
    );
    feeAndBadgeRuns.set(seed, result);
  }
  return result;
}

// Each whole-run comparison gets its own execution limit.
describe("simulateRun", { timeout: 30_000 }, () => {
  describe("seed reproducibility", () => {
    const risky = config({ pack: RISKY, skill: SKILL_PRESETS.novice });
    let first: RunResult;
    beforeAll(() => {
      first = simulateRun(gameData, 7, risky);
    }, 30_000);

    it("gives the same result for the same seed", () => {
      expect(simulateRun(gameData, 7, risky)).toEqual(first);
    });

    it("gives a different result for a different seed", () => {
      expect(simulateRun(gameData, 8, risky)).not.toEqual(first);
    });
  });

  // A fork offers 3 of the zones left after the first zone, easiest first: the left path is one of
  // the 3 easiest left, the right one of the 3 hardest, and a random one any of them. The ideal
  // player reaches the first fork. A walk each, so each test plans one walk's zones.
  const afterFirst = gameData.world.zones
    .map(({ id }) => id)
    .filter((zone) => zone !== gameData.world.firstZone);
  it.each([
    { offered: afterFirst.slice(0, 3), route: "left" },
    { offered: afterFirst.slice(-3), route: "right" },
    { offered: afterFirst, route: "random" },
  ] as const)(
    "walks different zones from the first zone, taking the $route path at each fork",
    ({ offered, route }) => {
      const walked = itemAt(runs(1, { policy: "alwaysPay", route, skill: IDEAL_SKILL }), 0).route;
      expect(walked.length).toBeLessThanOrEqual(gameData.world.walkLength);
      expect(walked[0]).toBe(gameData.world.firstZone);
      expect(new Set(walked).size).toBe(walked.length);
      expect(offered).toContain(defined(walked[1]));
    },
  );

  it("never pays money with the alwaysHearts policy", () => {
    const choices = runs(2, { pack: RISKY, policy: "alwaysHearts", skill: BLIND }).flatMap(
      (result) => result.choices,
    );

    expect(choices.length).toBeGreaterThan(0);
    expect(choices.filter((choice) => choice.cost > 0)).toEqual([]);
  });

  // A cash option the purse can't cover is disabled, so with the tuned starting purse whether
  // the blind walk can pay depends on the tips it grabs before its pack is fired. Starting with
  // a purse of the dearest card option's price, every card's cash option is open from the
  // first card.
  it("pays for cards with the alwaysPay policy", () => {
    const { money } = gameData.tuning;
    const prices = Object.values(gameData.encounters).flatMap(({ resolution }) =>
      resolution.kind === "card"
        ? resolution.options.map(({ effects }) =>
            effects.reduce(
              (sum, effect) =>
                effect.kind === "money" && effect.change === "lose"
                  ? sum + money[effect.amount]
                  : sum,
              0,
            ),
          )
        : [],
    );
    const flush = {
      ...gameData,
      tuning: {
        ...gameData.tuning,
        money: { ...money, startPurse: Math.ceil(Math.max(...prices)) },
      },
    };
    const paying = config({ pack: RISKY, policy: "alwaysPay", skill: BLIND });
    const choices = [1, 2].flatMap((seed) => simulateRun(flush, seed, paying).choices);

    expect(Math.max(...prices)).toBeGreaterThan(0);
    expect(choices.filter((choice) => choice.cost > 0).length).toBeGreaterThan(0);
  });

  // What each fee pays is the run rules' own test; this checks the walk pays the dogs it should.
  it.each(FEE_AND_BADGE_SEEDS)(
    "holds each zone's pay for every dog still walking at its end (seed %i)",
    (seed) => {
      const result = feeAndBadgeRun(seed);
      for (const zone of result.zones) {
        const gone = result.firings
          .filter((firing) => firing.zoneIndex <= zone.zoneIndex)
          .map((firing) => firing.dog);
        const walking = packOrder(gameData.dogs, RISKY).filter((dog) => !gone.includes(dog));
        expect(zone.fees.map((fee) => fee.dog)).toEqual(walking);
      }
    },
  );

  it("ends with no dogs when every owner has fired you", () => {
    const ended = runs(3, { pack: ["archie"], policy: "alwaysHearts", skill: BLIND }).filter(
      (result) => !result.finished,
    );

    expect(ended.length).toBeGreaterThan(0);
    for (const result of ended) {
      expect(result.firings.map((firing) => firing.dog)).toEqual(["archie"]);
      expect(result.zones.length).toBeLessThan(gameData.world.walkLength);
    }
  });
});

// The badge counters of a few real walks match what their sessions counted.
describe("badgeCounters", { timeout: 30_000 }, () => {
  const results: RunResult[] = [];
  for (const seed of FEE_AND_BADGE_SEEDS) {
    beforeAll(() => {
      results.push(feeAndBadgeRun(seed));
    }, 30_000);
  }
  const counters = () =>
    badgeCounters(
      gameData,
      RISKY.length,
      results.map((result) => result.facts),
    );
  const sessionMean = (count: (run: RunState, result: RunResult) => number) =>
    results.reduce((sum, result) => sum + count(result.run, result), 0) / results.length;
  const finished = (result: RunResult) =>
    result.finished && result.zones.length === gameData.world.walkLength;
  const cleanZones = (result: RunResult) =>
    result.zones.filter(({ zoneIndex }) => (result.run.bumpsByZone[zoneIndex] ?? 0) === 0).length;

  // Some tally counts, so the comparison is not all of zeros.
  it("gives the mean of every tally per walk", () => {
    expect(Object.values(counters().meanTallies).some((count) => count > 0)).toBe(true);
    expect(counters().meanTallies).toEqual(
      Object.fromEntries(
        TALLY_IDS.map((tally) => [tally, sessionMean((run) => run.tallies[tally] ?? 0)]),
      ),
    );
  });

  it("gives the mean landed bumps by every minor obstacle per walk", () => {
    expect(counters().meanBumpsByKind).toEqual(
      Object.fromEntries(
        keysOf(gameData.minorObstacles).map((kind) => [
          kind,
          sessionMean((run) => run.bumpsByKind[kind] ?? 0),
        ]),
      ),
    );
  });

  // Of 2 walks, the 90th percentile is the higher.
  it.each(keysOf(gameData.debuffs))(
    "gives the mean and 90th percentile times %s was got in a walk",
    (debuff) => {
      const got = results.map((result) => result.run.debuffsGot[debuff] ?? 0);
      expect(counters().debuffsGot[debuff]).toEqual({
        mean: sessionMean((run) => run.debuffsGot[debuff] ?? 0),
        p90: Math.max(...got),
      });
    },
  );

  it.each([
    {
      field: "allCleanShare",
      holds: (result: RunResult) =>
        finished(result) && cleanZones(result) === gameData.world.walkLength,
    },
    { field: "cleanZoneShare", holds: (result: RunResult) => cleanZones(result) > 0 },
    {
      field: "fullPackBonusShare",
      holds: (result: RunResult) =>
        finished(result) && packDogs(result.run).length === RISKY.length,
    },
    {
      field: "lastHeartShare",
      holds: (result: RunResult) =>
        finished(result) &&
        result.run.pack.some((slot) => slot.status === "walking" && slot.hearts === 1),
    },
  ] as const)("gives $field as the share of walks it holds for", ({ field, holds }) => {
    expect(counters()[field]).toBe(sessionMean((_, result) => (holds(result) ? 1 : 0)));
  });

  it("gives no Walk bonus share for a pack under the most dogs", () => {
    const facts = results.map((result) => result.facts);
    expect(badgeCounters(gameData, RISKY.length - 1, facts).fullPackBonusShare).toBeNull();
  });
});

describe("noteDebuffCosts", () => {
  const DEBUFFS = keysOf(gameData.debuffs);
  const held = (debuff: DebuffId) => [{ debuff, secondsLeft: 20, untilZone: 0 }];
  const zeros = (): DebuffCosts =>
    Object.fromEntries(
      DEBUFFS.map((debuff) => [debuff, { bumpsWhile: 0, centsLost: 0 }]),
    ) as DebuffCosts;
  // A walking step's tip and bumps, each priced by the rules on state, one bump landed and one
  // dodged.
  const step = (state: RunState) => {
    const item = {} as WalkStep["bumps"][number]["item"];
    const tipItem = {} as WalkStep["tips"][number]["item"];
    return {
      bumps: [
        { cash: bumpCash(gameData, state), change: null, dodged: false, dog: "ginger", item },
        { cash: null, change: null, dodged: true, dog: "ginger", item },
      ] as const satisfies WalkStep["bumps"],
      tips: [{ change: tipValue(gameData, state), item: tipItem }],
      walk: { run: state },
    };
  };
  const plain = testState({ ginger: 3 }, { money: cents(5000) });
  const costsWhile = (debuff: DebuffId) => {
    const state = { ...plain, debuffs: held(debuff) };
    const costs = zeros();
    noteDebuffCosts(gameData, costs, state, step(state));
    return { costs, state };
  };

  // What the debuff took: what the tip would pay without it less what it paid, and the cash the
  // bump cost.
  it.each(DEBUFFS)("counts the landed bump while %s lasts, and the cash it took", (debuff) => {
    const { costs, state } = costsWhile(debuff);
    const lost =
      tipValue(gameData, plain).amount -
      tipValue(gameData, state).amount -
      (bumpCash(gameData, state)?.amount ?? 0);

    expect(costs).toEqual({ ...zeros(), [debuff]: { bumpsWhile: 1, centsLost: lost } });
  });

  it("finds some debuff that takes cash, so the comparisons are not all of zeros", () => {
    expect(DEBUFFS.some((debuff) => costsWhile(debuff).costs[debuff].centsLost > 0)).toBe(true);
  });

  // Whether the run held the debuff before and after the step, and the bumps counted toward it:
  // one that starts in the step, or ran out as it began, counts none.
  it.each([
    [true, true, 1],
    [false, true, 0],
    [true, false, 0],
  ] as const)("held before %s and after %s counts %i bumps", (before, after, counted) => {
    const debuff = itemAt(DEBUFFS, 0);
    const costs = zeros();
    const at = (holds: boolean) => ({ ...plain, debuffs: holds ? held(debuff) : [] });
    noteDebuffCosts(gameData, costs, at(before), step(at(after)));

    expect(costs[debuff].bumpsWhile).toBe(counted);
  });
});

describe("noteZoneDebuffs", () => {
  const debuff = itemAt(keysOf(gameData.debuffs), 0);
  const plain = testState({ ginger: 3 });
  const zone = currentZoneId(gameData, plain);
  const at = (holds: boolean, got: number) => ({
    ...plain,
    debuffs: holds ? [{ debuff, secondsLeft: 20, untilZone: 0 }] : [],
    debuffsGot: got === 0 ? {} : { [debuff]: got },
  });

  // Whether the run held the debuff before and after a step of 2 bumps and 0.5 s, and what the
  // zone counts: the step toward the debuff when it held it throughout, toward clear when it held
  // none, and a period when the pack got it.
  it.each([
    { after: true, before: true, clear: 0, got: 0, held: 1 },
    { after: true, before: false, clear: 0, got: 1, held: 0 },
    { after: false, before: true, clear: 0, got: 0, held: 0 },
    { after: false, before: false, clear: 1, got: 0, held: 0 },
  ])(
    "held before $before and after $after counts $held toward it and $clear toward clear",
    ({ after, before, clear, got, held }) => {
      const zones: DebuffsByZone = {};
      noteZoneDebuffs(gameData, zones, { bumps: 2, seconds: 0.5 }, at(before, 0), at(after, got));

      expect(zones[zone]?.clear).toEqual({ bumps: 2 * clear, seconds: 0.5 * clear });
      expect(zones[zone]?.debuffs[debuff] ?? { bumpsWhile: 0, periods: 0, seconds: 0 }).toEqual({
        bumpsWhile: 2 * held,
        periods: got,
        seconds: 0.5 * held,
      });
    },
  );
});

describe("simulateRun planning diagnostics", () => {
  it("returns prior zone observations and the live run when later planning fails", () => {
    const first = testState({ ginger: 4 });
    const modifier = activeModifier(
      { kind: "upgrade", upgrade: "rushHour" },
      { by: "rushHourObstacles", operation: "multiply", stat: "obstacleSpawns" },
    );
    const second = {
      ...first,
      modifiers: [modifier],
      route: ["highPark", "cabbagetown"],
      zoneIndex: 1,
    } as const;
    const road = { ...startRoad(5), planned: [{ count: 3, kind: "tip", movement: null }] } as const;
    const initial: sessions.Session = {
      card: null,
      debuffMovement: null,
      distanceBeforeZone: 0,
      needsZonePlan: false,
      pulls: NO_PULLS,
      queue: [],
      timeMs: 0,
      walk: { road, run: first },
      zoneEndPending: false,
    };
    const snapshot: SpawnPlanSnapshot<WalkItemKind> = {
      context: { seed: 7, zoneIndex: 2 },
      draws: { movers: [], spawns: [] },
      plan: {
        cellInset: 0,
        cellLength: 10,
        fixedKinds: [],
        laneCount: 5,
        laneInset: 0,
        laneMoveSeconds: 0.1,
        maxEmptyRows: null,
        minOpenLanes: 2,
        minSpacing: 20,
        moverCaps: { darts: 6, slowVehicles: 4, total: 10 },
        packHitLength: 10,
        packLength: 10,
        pathLaneMoveSeconds: 0.3,
        pathStart: 2,
        quotas: [],
        reactionSeconds: 0.5,
        riderFollowGap: 10,
        roadLength: 100,
        scrollSpeed: 100,
        sightLength: 90,
        stepSeconds: 1 / 60,
        zoneLength: 1000,
      },
    };
    const observed: { observation: ZonePlanObservation; run: RunState }[] = [];
    const observationSnapshot = { ...snapshot, context: { seed: 7, zoneIndex: 1 } };
    const starting = vi.spyOn(sessions, "startSession").mockReturnValue(initial);
    const stepping = vi
      .spyOn(sessions, "stepSession")
      .mockImplementationOnce((_data, streams) => {
        const observation = {
          context: { seed: 7, zoneIndex: 1 },
          plan: {
            ...snapshot.plan,
            fixedKinds: [],
            maxEmptyRows: Infinity,
            quotas: [{ blocksLane: false, count: 5, kind: "tip" as const }],
          },
          planned: {
            admission: {
              capacity: { limits: [], rows: 0 },
              counts: [],
              rejections: [],
              substitutions: [],
            },
            events: [],
            herrings: [],
            path: [],
            visibility: [],
          },
          snapshot: observationSnapshot,
        };
        streams.observeSpawns?.(observation);
        return {
          events: [{ kind: "zonePlanned", unplanned: initial.walk }],
          session: { ...initial, walk: { road, run: second } },
        };
      })
      .mockImplementationOnce(() => {
        throw new SpawnPlanningError("unfilled later quota", snapshot);
      });
    try {
      const result = simulateRun(gameData, 7, {
        ...config(),
        observeSpawnPlan: (observation, run) => observed.push({ observation, run }),
      });
      expect(result.planningFailure).toEqual({
        kind: "quota",
        message: "unfilled later quota",
        seed: 7,
        snapshot,
      });
      expect(
        result.spawnEvents.map(({ configured, position }) => ({ configured, position })),
      ).toEqual([
        { configured: 3, position: 1 },
        { configured: 5, position: 2 },
      ]);
      expect(result.spawnEvents[1]?.audit?.requested).toBe(5);
      expect(result.spawnEvents[1]?.validation).toBe("invalid");
      expect(result.run).toBe(second);
      expect(observed).toHaveLength(1);
      expect(observed[0]?.run).toBe(second);
      expect(observed[0]?.observation).toMatchObject({ snapshot: observationSnapshot });
      expect(result.spawnEvents[1]?.modifiers).toEqual([modifier]);
      expect(result.spawnEvents[1]?.route).toEqual(["highPark", "cabbagetown"]);
      expect(result.finished).toBe(false);
      stepping.mockImplementationOnce(() => {
        throw new Error("broken session");
      });
      expect(() => simulateRun(gameData, 7, config())).toThrow("broken session");
    } finally {
      starting.mockRestore();
      stepping.mockRestore();
    }
  });
});
