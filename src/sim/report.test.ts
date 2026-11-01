import { itemAt } from "@andornaut/game-kit/arrays";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { DOGS } from "../data/dogs";
import type { DogId, ZoneId } from "../data/types";
import type { SpawnPlanSnapshot } from "../runner/spawnSearch";
import type { SpawnAudit } from "../runner/spawnValidation";
import type { PackDogs } from "../state/runState";
import { cents } from "../units";
import { POLICY_IDS } from "./policies";
import {
  DEFAULT_MATRIX,
  formatDebuffCostTable,
  formatDeliveryKindTable,
  formatDeliveryTable,
  formatKindTable,
  formatSpawnEventTable,
  formatTable,
  type Matrix,
  MATRIX_HEADERS,
  matrixCells,
  type NamedPack,
  rowCells,
  simulateCell,
  simulateMatrix,
  sumSpawnEvents,
} from "./report";
import * as simulator from "./simulate";
import { SKILL_PRESET_IDS, SKILL_PRESETS } from "./skills";
import type { ZoneWalkEvents } from "./walkEvents";

// These tests cover how report.ts seeds, orders and summarizes runs, not the runs
// themselves (simulate.test.ts does). A real run costs over a hundred milliseconds, so a stand-in
// replaces it: like the real one, it draws only from its seed, so a seed fixes its result.
vi.mock("./simulate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./simulate")>();
  const { cents } = await import("../units");
  const { newRun } = await import("../state/runState");
  const { runCountersOf } = await import("../rules/achievements");
  const { seededRandom } = await import("@andornaut/game-kit/random");
  const { SKILL_PRESETS } = await import("./skills");
  const { zoneDelivery } = await import("./delivery");
  const simulateRun: typeof actual.simulateRun = (data, seed, config) => {
    const random = seededRandom(seed);
    // A novice finishes half its walks and is fired twice in each.
    const novice = config.player.skill === SKILL_PRESETS.novice;
    const run = newRun(data, config.pack.length, {
      dogs: config.pack,
      gear: config.gear,
      walker: config.walker,
    });
    return {
      badges: [],
      cardsSeen: Math.floor(random() * 10),
      cashLost: cents(0),
      // The debuffs policy falls back on 1 of 3 free cards; the others choose none.
      choices:
        config.policy === "debuffs"
          ? [true, false, false].map((fellBack) => ({ cost: cents(0), fellBack }))
          : [],
      // Each debuff lasted through 1 bump and took $2.
      debuffCosts: Object.fromEntries(
        Object.keys(data.debuffs).map((debuff) => [debuff, { bumpsWhile: 1, centsLost: 200 }]),
      ) as ReturnType<typeof actual.simulateRun>["debuffCosts"],
      // Each debuff lasted 10 s of the first zone through 1 bump, the pack got it once, and the
      // zone's 20 s with none held 1 bump.
      debuffsByZone: {
        [data.world.zones[0]?.id as ZoneId]: {
          clear: { bumps: 1, seconds: 20 },
          debuffs: Object.fromEntries(
            Object.keys(data.debuffs).map((debuff) => [
              debuff,
              { bumpsWhile: 1, periods: 1, seconds: 10 },
            ]),
          ),
        },
      },
      // Each run plans its first zone: 2 tips asked for and 1 placed.
      deliveries: [
        zoneDelivery(data, 1, data.world.zones[0]?.id as ZoneId, {
          pending: [{ kind: "tip" }],
          planned: [{ count: 2, kind: "tip", movement: null }],
        }),
      ],
      earnings: cents(random() * 10_000),
      facts: {
        ...runCountersOf(run),
        dogsHome: config.pack.length,
        earnedCents: run.money,
        lastHeartOwners: 0,
        packSize: config.pack.length,
        zonesFinished: 0,
      },
      finished: random() >= (novice ? 0.5 : 0.1),
      firings: novice
        ? [
            { dog: "kilo", zoneIndex: 0 },
            { dog: "kilo", zoneIndex: 1 },
          ]
        : [],
      hits: { afterPull: 1, all: 4 },
      inputs: [],
      items: {
        otherDog: { met: 2, touched: 1 },
        sandwichBoard: { met: 4, touched: 1 },
        tip: { met: 10, touched: 6 },
      },
      movers: { ball: { met: 2, touched: 1 }, squirrel: { met: 3, touched: 0 } },
      pullsMoved: 0,
      route: [],
      run,
      spawnEvents: [],
      tips: cents(0),
      zones: [],
    };
  };
  return { ...actual, simulateRun };
});

const SMALL: Matrix = {
  ...DEFAULT_MATRIX,
  packs: [
    { dogs: ["kilo"], name: "Kilo" },
    { dogs: ["buddy", "archie", "sequoia"], name: "Risky trio" },
  ],
  players: [
    { kind: "skill", preset: "typical" },
    { kind: "skill", preset: "expert" },
  ],
  policies: ["heartsUnlessLow", "alwaysPay"],
};

const [A, B] = Object.keys(DOGS).sort() as [DogId, DogId];

describe("simulateMatrix", () => {
  it("covers every policy, skill preset and pack of the default matrix", () => {
    const cells = matrixCells(DEFAULT_MATRIX);

    expect(cells).toHaveLength(
      POLICY_IDS.length * SKILL_PRESET_IDS.length * DEFAULT_MATRIX.packs.length,
    );
    expect(
      new Set(
        cells.map(({ pack, player, policy }) => `${policy} ${JSON.stringify(player)} ${pack.name}`),
      ).size,
    ).toBe(cells.length);
    expect(new Set(cells.map(({ gear }) => gear))).toEqual(new Set([null]));
  });

  it("runs each gear as its own cell, after the player and before the pack", () => {
    const rows = simulateMatrix(gameData, 3, 2, {
      ...SMALL,
      gears: [null, "runningShoes"],
      players: [{ kind: "skill", preset: "typical" }],
      policies: ["heartsUnlessLow"],
    });

    expect(rows.map(({ gear, pack }) => [gear, pack])).toEqual([
      ["none", "Kilo"],
      ["none", "Risky trio"],
      ["runningShoes", "Kilo"],
      ["runningShoes", "Risky trio"],
    ]);
  });

  it("gives a row per walker after each pack, the walker named in its own column", () => {
    const walkers = {
      ...SMALL,
      packs: SMALL.packs.slice(0, 1),
      walkers: ["casey", "trista"] as const,
    };
    const rows = simulateMatrix(gameData, 3, 2, { ...walkers, players: SMALL.players.slice(0, 1) });

    expect(rows.map(({ pack, policy, walker }) => [policy, pack, walker])).toEqual([
      ["heartsUnlessLow", "Kilo", "casey"],
      ["heartsUnlessLow", "Kilo", "trista"],
      ["alwaysPay", "Kilo", "casey"],
      ["alwaysPay", "Kilo", "trista"],
    ]);
    expect(formatTable(rows).split("\n")[0]).toMatch(/Pack +Walker/);
  });

  it("gives one row per cell, in policy, player, then pack order", () => {
    const rows = simulateMatrix(gameData, 3, 4, SMALL);

    expect(rows.map(({ pack, player, policy }) => [policy, player, pack])).toEqual([
      ["heartsUnlessLow", "typical", "Kilo"],
      ["heartsUnlessLow", "typical", "Risky trio"],
      ["heartsUnlessLow", "expert", "Kilo"],
      ["heartsUnlessLow", "expert", "Risky trio"],
      ["alwaysPay", "typical", "Kilo"],
      ["alwaysPay", "typical", "Risky trio"],
      ["alwaysPay", "expert", "Kilo"],
      ["alwaysPay", "expert", "Risky trio"],
    ]);
    for (const row of rows) {
      expect(row.runs).toBe(4);
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p50).toBeLessThanOrEqual(row.p90);
      expect(row.finishedShare).toBeGreaterThanOrEqual(0);
      expect(row.finishedShare).toBeLessThanOrEqual(1);
    }
  });

  it("gives the same rows for the same seed", () => {
    const first = simulateMatrix(gameData, 5, 3, SMALL);

    expect(simulateMatrix(gameData, 5, 3, SMALL)).toEqual(first);
    expect(simulateMatrix(gameData, 6, 3, SMALL)).not.toEqual(first);
  });

  it("gives a cell the same row whatever else the matrix holds", () => {
    const [alone] = simulateMatrix(gameData, 5, 3, {
      ...SMALL,
      packs: SMALL.packs.slice(1),
      players: [{ kind: "skill", preset: "expert" }],
      policies: ["alwaysPay"],
    });

    expect(simulateMatrix(gameData, 5, 3, SMALL).at(-1)).toEqual(alone);
  });

  it("seeds a pack from its dog ids, not its names", () => {
    for (const { dogs, otherDogs, otherName, same } of [
      { case: "a renamed dog", dogs: [A], otherDogs: [A], otherName: "Renamed", same: true },
      { case: "different dogs", dogs: [A], otherDogs: [B], otherName: undefined, same: false },
      {
        case: "the same dogs in another order",
        dogs: [A, B],
        otherDogs: [B, A],
        otherName: undefined,
        same: false,
      },
    ]) {
      const pack = (ids: readonly DogId[], rename?: string): NamedPack => ({
        dogs: ids as PackDogs,
        name: ids.map((id) => rename ?? DOGS[id].name).join(" + "),
      });
      const rows = (named: NamedPack) =>
        simulateMatrix(gameData, 5, 3, { ...SMALL, packs: [named] }).map((row) => ({
          ...row,
          pack: "",
        }));

      const expected = expect(rows(pack(otherDogs, otherName)));

      (same ? expected : expected.not).toEqual(rows(pack(dogs)));
    }
  });

  // The squirrels the pack passes through count toward no share of hits.
  it("measures each share over every run's items that reached the pack", () => {
    const [row] = simulateMatrix(gameData, 3, 2, SMALL);

    expect(row?.kindHitShares.sandwichBoard).toBe(0.25);
    expect(row?.kindHitShares.hedge).toBeNull();
    expect(row?.moverHitShares.ball).toBe(0.5);
    expect(row?.moverHitShares).not.toHaveProperty("squirrel");
    expect(row?.bumpShare).toBe(2 / 6);
    expect(row?.hitShare).toBe(0.5);
    expect(row?.meanTips).toBe(6);
    expect(row?.moneyShare).toBeNull();
  });

  it("gives the share of walks with a firing for each preset player", () => {
    for (const { expected, preset } of [
      { expected: 0, preset: "typical" },
      { expected: 1, preset: "novice" },
    ] as const) {
      const [row] = simulateMatrix(gameData, 3, 4, {
        ...SMALL,
        players: [{ kind: "skill", preset }],
      });

      expect(row?.firedShare).toBe(expected);
      expect(row?.meanFirings).toBe(expected * 2);
    }
  });

  it("formats a header line and one line per row", () => {
    const rows = simulateMatrix(gameData, 3, 2, SMALL);

    expect(formatTable(rows).split("\n")).toHaveLength(rows.length + 1);
    // With no card chosen, no share of choices paid.
    const paid = rows.map((row) => itemAt(rowCells(row), MATRIX_HEADERS.indexOf("Paid")));
    expect(new Set(paid)).toEqual(new Set(["-"]));
    expect(formatKindTable(gameData, rows).split("\n")).toHaveLength(rows.length + 1);
    expect(formatDebuffCostTable(gameData, rows).split("\n")).toHaveLength(rows.length + 1);
  });

  it("gives the share of cards a policy with a fallback fell back on, and null for the others", () => {
    const rows = simulateMatrix(gameData, 3, 2, {
      ...SMALL,
      packs: [{ dogs: ["kilo"], name: "Kilo" }],
      players: [{ kind: "skill", preset: "typical" }],
      policies: ["debuffs", "heartsUnlessLow"],
    });

    expect(rows.map((row) => row.policyFallbackShare)).toEqual([1 / 3, null]);
  });

  it("gives each debuff's mean bumps while it lasted and cents it took, in dollars in the table", () => {
    const [row] = simulateMatrix(gameData, 3, 2, SMALL);
    const debuffs = Object.keys(gameData.debuffs);

    expect(Object.values(row?.debuffCosts ?? {})).toEqual(
      debuffs.map(() => ({ meanBumpsWhile: 1, meanCentsLost: 200 })),
    );
    expect(row?.debuffsByZone).toEqual({
      [gameData.world.zones[0]?.id as ZoneId]: {
        clear: { meanBumps: 1, meanSeconds: 20 },
        debuffs: Object.fromEntries(
          debuffs.map((debuff) => [debuff, { meanBumpsWhile: 1, meanPeriods: 1, meanSeconds: 10 }]),
        ),
      },
    });
    const [header, line] = formatDebuffCostTable(gameData, row === undefined ? [] : [row]).split(
      "\n",
    );
    const lost = header?.split(/ {2,}/).indexOf(`${debuffs[0]} lost`) ?? -1;
    expect(line?.trim().split(/ {2,}/)[lost]).toBe("$2");
  });

  it("sums every run's zone plans, and gives each group as placed/planned per plan", () => {
    const rows = simulateMatrix(gameData, 3, 2, SMALL);
    const [sum] = rows[0]?.delivery ?? [];

    expect(sum).toMatchObject({ plans: 2, position: 1, zone: gameData.world.zones[0]?.id });
    expect(sum?.groups.tips).toEqual({ placed: 2, planned: 4 });
    const [header, line, ...rest] = formatDeliveryTable(rows).split("\n");
    expect(rest).toEqual([]);
    const tips = header?.split(/ {2,}/).indexOf("Tips") ?? -1;
    expect(line?.trim().split(/ +/)[tips]).toBe("1.00/2.00");
    expect(formatDeliveryKindTable(rows).split("\n")).toEqual([
      expect.stringMatching(/^Pos +Zone +Kind +Plans +Placed\/planned$/),
      expect.stringMatching(
        new RegExp(`^1 +${String(sum?.zone)} +tip +${2 * rows.length} +1.00/2.00$`),
      ),
    ]);
  });
});

const failedSnapshot: SpawnPlanSnapshot = {
  context: { seed: 7, zoneIndex: 3 },
  draws: { movers: [0.2], spawns: [0.4] },
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
    quotas: [
      { blocksLane: false, count: 10, first: false, footprint: { lanes: 1, rows: 1 }, kind: "tip" },
    ],
    reactionSeconds: 0.5,
    riderFollowGap: 10,
    roadLength: 100,
    scrollSpeed: 100,
    sightLength: 90,
    stepSeconds: 1 / 60,
    zoneLength: 1000,
  },
};

describe("spawn reporting", () => {
  it("retains partial failures without adding them to gameplay means", () => {
    const cell = itemAt(matrixCells(SMALL), 0);
    const result = simulator.simulateRun(gameData, 7, {
      gear: cell.gear,
      pack: cell.pack.dogs,
      player: { kind: "skill", sight: "sight", skill: SKILL_PRESETS.typical },
      policy: cell.policy,
      route: cell.route,
      walker: cell.walker,
    });
    const failure = {
      ...result,
      earnings: cents(999999),
      finished: false,
      planningFailure: { message: "unfilled quota", seed: 7, snapshot: failedSnapshot },
    };
    const spy = vi
      .spyOn(simulator, "simulateRun")
      .mockReturnValueOnce(result)
      .mockReturnValueOnce(failure);
    try {
      const row = simulateCell(gameData, 7, 2, cell);
      expect(row).toMatchObject({
        finishedShare: Number(result.finished),
        meanEarnings: result.earnings,
        planningFailedRuns: 1,
        requestedRuns: 2,
        runs: 1,
      });
      expect(row.spawnRuns[1]).toMatchObject({
        failure: failure.planningFailure,
        modifiers: result.run.modifiers,
        partial: { earnings: failure.earnings },
      });
      spy.mockReturnValueOnce(failure);
      const failed = simulateCell(gameData, 7, 1, cell);
      expect(JSON.parse(JSON.stringify(failed))).toMatchObject({
        finishedShare: null,
        gameplayStatus: "unavailable",
        meanEarnings: null,
        runs: 0,
      });
      expect(formatTable([failed])).toContain("unavailable");
      expect(formatTable([failed])).not.toContain("NaN");
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps unknown moving validity and evaluates each zone exposure before pooling", () => {
    const flow = {
      admitted: 10,
      departed: 8,
      encountered: 2,
      generated: 9,
      herrings: 1,
      passed: 6,
      requested: 10,
      touched: 1,
      valid: null,
    };
    const zone: ZoneWalkEvents = {
      configured: 10,
      herringRendering: "not-simulated",
      kinds: { bench: flow },
      modifiers: [],
      position: 1,
      route: ["highPark"],
      seed: 7,
      validation: "unverified",
      zone: "highPark",
    };
    expect(sumSpawnEvents([zone])[0]).toMatchObject({
      configured: null,
      encountered: 2,
      generated: 9,
      goal: "unverified",
      herrings: 1,
      valid: null,
    });
    const audit = (valid: number): SpawnAudit => ({
      counts: [{ emitted: 10, kind: "bench", movement: null, requested: 10, validPlaced: valid }],
      findings: [],
      meetsPlacementFloor: true,
      meetsValidPlacementFloor: valid >= 8,
      minimumPlaced: 8,
      missingCoverage: [],
      placed: 10,
      requested: 10,
      status: "valid",
      validPlaced: valid,
      violations: [],
    });
    const zones = [
      { ...zone, audit: audit(10), validation: "valid" as const },
      { ...zone, audit: audit(6), kinds: {}, validation: "valid" as const },
    ];
    expect(sumSpawnEvents(zones)[0]).toMatchObject({
      configured: 20,
      exposures: 2,
      goal: "below floor",
      valid: 16,
    });
    expect(sumSpawnEvents(zones, true)[0]).toMatchObject({
      exposures: 2,
      kind: "bench",
      perExposure: {
        admitted: { max: 10, mean: 5, min: 0 },
        requested: { max: 10, mean: 10, min: 10 },
      },
      planned: 10,
      requested: 20,
    });
    const row = itemAt(
      simulateMatrix(gameData, 1, 1, {
        ...SMALL,
        packs: [itemAt(SMALL.packs, 0)],
        players: [itemAt(SMALL.players, 0)],
        policies: ["alwaysPay"],
      }),
      0,
    );
    expect(
      formatSpawnEventTable([
        {
          ...row,
          spawnRuns: [
            {
              failure: null,
              modifiers: [],
              partial: null,
              route: ["highPark"],
              seed: 7,
              zoneIndex: 0,
              zones: [zone],
            },
          ],
        },
      ]),
    ).toContain("unverified");
  });
});
