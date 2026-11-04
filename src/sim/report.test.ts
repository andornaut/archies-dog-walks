import { itemAt } from "@andornaut/game-kit/arrays";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { DOGS } from "../data/dogs";
import type { DogId, ZoneId } from "../data/types";
import type { SlotDelivery, SlotPartialAudit } from "../runner/slotDelivery";
import { SLOT_LIMITS } from "../runner/slotPlanner";
import type { SpawnPlanSnapshot } from "../runner/spawnSearch";
import type { SpawnAudit } from "../runner/spawnValidation";
import type { WalkItemKind } from "../runner/walkItems";
import {
  replayZoneSlots,
  type ZoneSlotInput,
  ZoneSlotPlanningError,
} from "../runner/zoneSlotInput";
import type { PackDogs } from "../state/runState";
import { cents } from "../units";
import { POLICY_IDS } from "./policies";
import {
  DEFAULT_MATRIX,
  DEFAULT_SPAWN_TARGET,
  formatDebuffCostTable,
  formatDeliveryKindTable,
  formatDeliveryTable,
  formatKindTable,
  formatSpawnEventTable,
  formatSpawnFailures,
  formatTable,
  type Matrix,
  MATRIX_HEADERS,
  matrixCells,
  type NamedPack,
  parseSpawnTarget,
  rowCells,
  simulateCell,
  simulateMatrix,
  spawnValidationFailures,
  sumRoadObstacleEvents,
  sumSpawnEvents,
} from "./report";
import * as simulator from "./simulate";
import { SKILL_PRESET_IDS, SKILL_PRESETS } from "./skills";
import { capturePlanningFailure, type SpawnFlow, type ZoneWalkEvents } from "./walkEvents";

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
        newspaperBox: { met: 4, touched: 1 },
        otherDog: { met: 2, touched: 1 },
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

  it("runs each gear as its own cell after the player, and each walker after the pack", () => {
    const gearRows = simulateMatrix(gameData, 3, 2, {
      ...SMALL,
      gears: [null, "runningShoes"],
      players: [{ kind: "skill", preset: "typical" }],
      policies: ["heartsUnlessLow"],
    });

    expect(gearRows.map(({ gear, pack }) => [gear, pack])).toEqual([
      ["none", "Kilo"],
      ["none", "Risky trio"],
      ["runningShoes", "Kilo"],
      ["runningShoes", "Risky trio"],
    ]);

    // A row per walker after each pack, the walker named in its own column.
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

  it("gives one row per cell, in policy, player, then pack order, and a table line per row", () => {
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
    expect(formatTable(rows).split("\n")).toHaveLength(rows.length + 1);
    // With no card chosen, no share of choices paid.
    const paid = rows.map((row) => itemAt(rowCells(row), MATRIX_HEADERS.indexOf("Paid")));
    expect(new Set(paid)).toEqual(new Set(["-"]));
    expect(formatKindTable(gameData, rows).split("\n")).toHaveLength(rows.length + 1);
    expect(formatDebuffCostTable(gameData, rows).split("\n")).toHaveLength(rows.length + 1);
  });

  it("gives the same rows for the same seed, and a cell the same row whatever else the matrix holds", () => {
    const first = simulateMatrix(gameData, 5, 3, SMALL);

    expect(simulateMatrix(gameData, 5, 3, SMALL)).toEqual(first);
    expect(simulateMatrix(gameData, 6, 3, SMALL)).not.toEqual(first);
    const [alone] = simulateMatrix(gameData, 5, 3, {
      ...SMALL,
      packs: SMALL.packs.slice(1),
      players: [{ kind: "skill", preset: "expert" }],
      policies: ["alwaysPay"],
    });

    expect(first.at(-1)).toEqual(alone);
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

    expect(row?.kindHitShares.newspaperBox).toBe(0.25);
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

// A kind's flow through the walk, none of it unless changes says.
const flow = (changes: Partial<SpawnFlow>): SpawnFlow => ({
  admitted: 0,
  departed: 0,
  encountered: 0,
  generated: 0,
  herrings: 0,
  passed: 0,
  requested: 0,
  touched: 0,
  valid: 0,
  ...changes,
});

const benchCount = (validPlaced: number, requested: number): SpawnAudit["counts"][number] => ({
  emitted: validPlaced,
  kind: "bench",
  movement: null,
  requested,
  validPlaced,
});

// A valid audit of counts that meets its floors, every requested item its minimum, unless changes
// says otherwise.
function spawnAudit(counts: SpawnAudit["counts"], changes: Partial<SpawnAudit> = {}): SpawnAudit {
  const sum = (key: "emitted" | "requested" | "validPlaced") =>
    counts.reduce((total, count) => total + count[key], 0);
  return {
    counts,
    findings: [],
    meetsPlacementFloor: true,
    meetsValidPlacementFloor: true,
    minimumPlaced: sum("requested"),
    missingCoverage: [],
    placed: sum("emitted"),
    requested: sum("requested"),
    status: "valid",
    validPlaced: sum("validPlaced"),
    violations: [],
    ...changes,
  };
}

// A validated walk's first zone, highPark, configured for 10.
const zoneEvents = (changes: Partial<ZoneWalkEvents>): ZoneWalkEvents => ({
  configured: 10,
  herringRendering: "not-simulated",
  kinds: {},
  modifiers: [],
  position: 1,
  route: ["highPark"],
  seed: 7,
  validation: "valid",
  zone: "highPark",
  ...changes,
});

// A matrix row whose one spawn run observed zones.
const observedRow = <Row extends object>(row: Row, zones: readonly ZoneWalkEvents[]) => ({
  ...row,
  spawnRuns: [
    {
      failure: null,
      modifiers: [],
      partial: null,
      route: ["highPark"] as const,
      seed: 7,
      zoneIndex: 0,
      zones,
    },
  ],
});

describe("spawn reporting", () => {
  it("reports a structural runtime failure against actual role counts without inventing a kind mix", () => {
    const cell = itemAt(matrixCells(SMALL), 0);
    const original = simulator.simulateRun(gameData, 7, {
      gear: cell.gear,
      pack: cell.pack.dogs,
      player: { kind: "skill", sight: "sight", skill: SKILL_PRESETS.typical },
      policy: cell.policy,
      route: cell.route,
      walker: cell.walker,
    });
    const { quotas: auxiliary, ...geometry } = failedSnapshot.plan;
    const input: ZoneSlotInput<string> = {
      actualRun: original.run,
      auxiliary,
      catalogue: [],
      config: {
        active: { encounterFixed: 0, encounterMoving: 0, minorFixed: 1, minorMoving: 0 },
        capacity: { encounterFixed: 0, encounterMoving: 0, minorFixed: 20, minorMoving: 0 },
        guarantees: [],
      },
      context: { limits: SLOT_LIMITS, seed: 7, zoneIndex: 3 },
      geometry,
      tuning: gameData.tuning,
    };
    const unsupported = replayZoneSlots(input);
    if (unsupported.status !== "unsupported") {
      throw Error("Expected missing source diagnostic");
    }
    const planningFailure = capturePlanningFailure(7, () => {
      throw new ZoneSlotPlanningError(input, unsupported);
    });
    if (planningFailure === undefined) {
      throw Error("Expected structural planning failure");
    }
    const spy = vi
      .spyOn(simulator, "simulateRun")
      .mockReturnValueOnce({ ...original, planningFailure });
    try {
      const row = simulateCell(gameData, 7, 1, cell);
      expect(row).toMatchObject({ planningFailedRuns: 1, runs: 0 });
      expect(row.spawnRuns[0]).toMatchObject({
        failure: { input, kind: "slots", purpose: "runtime-actual", result: unsupported },
        zoneIndex: 3,
      });
      const table = formatSpawnFailures([row], true);
      expect(table).toContain("all");
      expect(table).toContain("unavailable");
      expect(table).toContain("unverified");
      expect(row.spawnRuns[0]!.failure).not.toHaveProperty("snapshot");
    } finally {
      spy.mockRestore();
    }
  });

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
      planningFailure: {
        kind: "quota" as const,
        message: "unfilled quota",
        seed: 7,
        snapshot: failedSnapshot,
      },
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

  it("keeps unknown validity and validates floor and configured target per zone", () => {
    const zone = zoneEvents({
      kinds: {
        bench: flow({
          admitted: 10,
          departed: 8,
          encountered: 2,
          generated: 9,
          herrings: 1,
          passed: 6,
          requested: 10,
          touched: 1,
          valid: null,
        }),
      },
      validation: "unverified",
    });
    expect(sumSpawnEvents([zone])[0]).toMatchObject({
      configured: null,
      encountered: 2,
      generated: 9,
      goal: "unverified",
      herrings: 1,
      valid: null,
    });
    const audit = (valid: number) =>
      spawnAudit([benchCount(valid, 10)], {
        meetsValidPlacementFloor: valid >= 9,
        minimumPlaced: 9,
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
    const failures = (observed: readonly ZoneWalkEvents[], target = DEFAULT_SPAWN_TARGET) =>
      spawnValidationFailures(target, [observedRow(row, observed)]);
    expect(failures(zones.slice(0, 1))).toEqual([]);
    const partial: ZoneWalkEvents = {
      ...zone,
      audit: spawnAudit([benchCount(90, 100)], { minimumPlaced: 90 }),
      configured: 100,
    };
    expect(failures([partial])).toEqual([]);
    expect(failures([partial], parseSpawnTarget("1"))).toEqual([
      "seed 7, zone 1 highPark: valid 90/100, requires 100",
    ]);
    expect(failures(zones.slice(0, 1), 1)).toEqual([]);
    expect(sumSpawnEvents([partial])[0]).toMatchObject({
      configuredTargetGoal: "below target",
      goal: "met",
    });
    expect(formatSpawnEventTable([observedRow(row, [partial])])).toContain(
      "100% configured target",
    );
    for (const target of ["", "NaN", "0.79", "1.01"]) {
      expect(() => parseSpawnTarget(target)).toThrow("--spawn-target takes a fraction");
    }
    for (const observed of [
      zone,
      zones[1]!,
      { ...zone, audit: { ...audit(10), status: "invalid" as const } },
      { ...zone, audit: { ...audit(10), missingCoverage: ["moving bodies"] } },
      { ...zone, audit: { ...audit(10), requested: 11 } },
    ]) {
      expect(failures([observed])).toHaveLength(1);
    }
    expect(formatSpawnEventTable([observedRow(row, [zone])])).toContain("unverified");
  });

  it("keeps unselected weighted omissions out of per-kind denominators and retains the exact target", () => {
    const byRole = (minorFixed: number) => ({
      auxiliaryFixed: 0,
      auxiliaryMoving: 0,
      encounterFixed: 0,
      encounterMoving: 0,
      minorFixed,
      minorMoving: 0,
    });
    const delivery: SlotDelivery<WalkItemKind> = {
      configured: 10,
      configuredByRole: byRole(10),
      delivered: 9,
      deliveredByRole: byRole(9),
      floor: { denominator: 10, numerator: 9 },
      omissions: [
        { key: "active:minorFixed:9", reason: "not-selected-within-allowance", role: "minorFixed" },
      ],
      policy: "runtime-90",
      required: 9,
    };
    const geometry = spawnAudit([benchCount(9, 9)]);
    const partialAudit: SlotPartialAudit<WalkItemKind> = {
      compiledTemplates: 0,
      delivery,
      geometry,
      purpose: "runtime-partial",
      status: "valid",
      violations: [],
    };
    const zone = zoneEvents({
      audit: geometry,
      kinds: { bench: flow({ admitted: 9, requested: 9, valid: 9 }) },
      slots: { delivery, partialAudit, status: "partial" },
    });
    expect(sumSpawnEvents([zone])[0]).toMatchObject({
      configured: 10,
      configuredTargetGoal: "below target",
      goal: "met",
      valid: 9,
      validConfiguredRate: 0.9,
    });
    expect(sumSpawnEvents([zone], true)[0]).toMatchObject({
      configured: null,
      kind: "bench",
      requested: 9,
      valid: 9,
    });
    expect(sumRoadObstacleEvents(gameData, [zone])[0]).toMatchObject({
      configured: 10,
      requested: 9,
      valid: 9,
      validConfiguredRate: 0.9,
    });
    const row = itemAt(simulateMatrix(gameData, 1, 1, SMALL), 0);
    expect(spawnValidationFailures(DEFAULT_SPAWN_TARGET, [observedRow(row, [zone])])).toEqual([]);
    expect(spawnValidationFailures(1, [observedRow(row, [zone])])).toEqual([
      "seed 7, zone 1 highPark: valid 9/10, requires 10",
    ]);
    const invalid: ZoneWalkEvents = {
      ...zone,
      slots: { delivery, partialAudit: { ...partialAudit, status: "invalid" }, status: "partial" },
    };
    expect(
      spawnValidationFailures(DEFAULT_SPAWN_TARGET, [observedRow(row, [invalid])]),
    ).toHaveLength(1);
  });

  it("separates road obstacles including pulls from lucky finds and preserves unknown validity", () => {
    const minor = Object.keys(gameData.minorObstacles)[0] as WalkItemKind;
    const card = Object.entries(gameData.encounters).find(
      ([, value]) => value.kind === "obstacle" && value.resolution.kind === "card",
    )![0] as WalkItemKind;
    const road = [minor, card, "squirrel"] as const;
    const kinds = [
      ...road,
      "lostWallet",
      "friendlyNeighbour",
      "tip",
      "treat",
      Object.keys(gameData.shopGear)[0],
    ] as WalkItemKind[];
    const flows = Object.fromEntries(
      kinds.map((kind) => [kind, flow({ admitted: 2, requested: 3, valid: 2 })]),
    );
    const zone = zoneEvents({
      audit: spawnAudit(
        kinds.map((kind) => ({ emitted: 2, kind, movement: null, requested: 3, validPlaced: 2 })),
        {
          meetsPlacementFloor: false,
          meetsValidPlacementFloor: false,
          minimumPlaced: Math.ceil(kinds.length * 3 * 0.8),
        },
      ),
      configured: kinds.length * 3,
      kinds: flows,
    });
    expect(sumRoadObstacleEvents(gameData, [zone])).toEqual([
      {
        admitted: road.length * 2,
        configured: road.length * 3,
        position: 1,
        requested: road.length * 3,
        valid: road.length * 2,
        validConfiguredRate: 2 / 3,
        zone: "highPark",
      },
    ]);
    const unknown = { ...zone, kinds: { ...flows, squirrel: { ...flows.squirrel!, valid: null } } };
    expect(sumRoadObstacleEvents(gameData, [zone, unknown])[0]).toMatchObject({
      configured: null,
      requested: road.length * 6,
      valid: null,
      validConfiguredRate: null,
    });
  });
});
