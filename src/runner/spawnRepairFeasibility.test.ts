import { expect, it } from "vitest";

import { herringSpawn, type MoverDraws, moverPlacements, type MoverSpec } from "./moverPlanning";
import { crossLength, type MoverPath } from "./movers";
import { LaneBlocks, SpawnCells } from "./spawnCells";
import {
  blockingLength,
  type PlannedSpawns,
  rowSpacing,
  type SpawnPlan,
  zoneRows,
} from "./spawning";
import { createRepairFeasibility, type RepairEntry } from "./spawnRepairFeasibility";
import { auditSpawnPlan } from "./spawnValidation";
const plan: SpawnPlan<string> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 1 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 2,
  quotas: [
    { blocksLane: true, count: 1, kind: "bench" },
    { blocksLane: true, count: 1, footprint: { lanes: 2, rows: 1 }, kind: "bench" },
  ],
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const path = zoneRows(plan, rowSpacing(plan)).map((distance) => ({ distance, lane: 2 }));
function standing(quotaIndex: number, row: number, lane: number): RepairEntry<string> {
  const quota = plan.quotas[quotaIndex]!,
    distance = path[row]!.distance,
    until = distance + 130;
  return {
    event: { distance, kind: quota.kind, lane },
    herring: false,
    trace: {
      entry: distance,
      hazard: true,
      index: 0,
      kind: quota.kind,
      lane,
      memberIndex: 0,
      nativeUntil: until,
      quotaIndex,
      row: Math.floor(distance / 100),
      source: "events",
      until,
    },
  };
}
function selected(ledger: readonly RepairEntry<string>[]): PlannedSpawns<string> {
  return {
    admission: {
      capacity: { limits: [], rows: path.length },
      counts: [],
      rejections: [],
      substitutions: [],
    },
    events: ledger.filter((e) => !e.herring).map((e) => e.event),
    herrings: ledger.filter((e) => e.herring).map((e) => e.event),
    path,
    visibility: ledger.map((e) => ({
      ...e.trace,
      index: ledger.filter((other) => other.herring === e.herring).indexOf(e),
      source: e.herring ? "herrings" : "events",
    })),
  };
}
it("rehydrates and restores all standing reservations with exact repeated-kind quota identities", () => {
  const original = standing(0, 0, 0),
    wide = standing(1, 5, 3),
    ledger = [original, wide];
  expect(auditSpawnPlan(plan, selected(ledger)).status).toBe("valid");
  const tx = createRepairFeasibility("complete", plan, path, ledger).without(["0:0"]);
  const checkpoint = tx.checkpoint();
  expect(tx.tryInsert(original)).toBe(true);
  expect(tx.tryInsert(original)).toBe(false);
  tx.restore(checkpoint);
  expect(tx.tryInsert(original)).toBe(true);
  tx.restore(checkpoint);
  expect(tx.tryInsert(standing(0, 0, 2))).toBe(false);
  expect(tx.tryInsert(original)).toBe(true);
  const wideTx = createRepairFeasibility("complete", plan, path, ledger).without(["1:0"]);
  expect(wideTx.tryInsert(standing(1, 5, 4))).toBe(false);
  expect(wideTx.tryInsert(wide)).toBe(true);
  expect(() => wideTx.restore(checkpoint)).toThrow("another repair transaction");
  const diagnostic = createRepairFeasibility("complete", plan, path, ledger).without(["0:0"]);
  expect(diagnostic.tryInsertDetailed(standing(0, 5, 0))).toMatchObject({
    accepted: false,
    failure: { classification: "conflict", conflicts: ["1:0"], rule: "kind-row" },
  });
  expect(diagnostic.tryInsertDetailed(standing(0, 0, 2))).toMatchObject({
    accepted: false,
    failure: { classification: "intrinsic", conflicts: [], rule: "path" },
  });
  expect(diagnostic.tryInsertDetailed(original)).toEqual({ accepted: true });
  expect(diagnostic.tryInsertDetailed(original)).toMatchObject({
    accepted: false,
    failure: { classification: "conflict", conflicts: ["0:0"], rule: "duplicate-request" },
  });
});
it("restores moving masks, rider/body/pack reservations and caps without losing the stop guard", () => {
  const spec: MoverSpec = {
    footprint: { lanes: 1, rows: 1 },
    motion: { kind: "ride", speedMultiplier: 1.3 },
    movement: "inLane",
    variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
    warningSeconds: 0,
  };
  const movingPlan = {
    ...plan,
    quotas: [
      { blocksLane: true, count: 1, kind: "a", mover: spec },
      { blocksLane: true, count: 1, kind: "b", mover: spec },
    ],
  };
  const draws: MoverDraws = {
    count: 0,
    delays: [0],
    lengths: [0.5],
    share: 0,
    shy: 0,
    side: 0,
    speed: 0.5,
    start: 0,
    tilt: 0,
    turn: 0,
    turnAt: 0,
  };
  const placements = moverPlacements(
    { ...movingPlan, rowSpacing: 100, window: blockingLength(movingPlan, 1) },
    spec,
    draws,
  );
  function moving(quotaIndex: number, lane: number): RepairEntry<string> {
    const placement = placements.find((candidate) => candidate.lane === lane)!,
      row = 3,
      base = path[row]!.distance;
    const event = {
      distance: base + placement.appears,
      kind: quotaIndex === 0 ? "a" : "b",
      lane,
      mover: placement.path,
    };
    const nativeUntil = base + placement.screen[1];
    return {
      event,
      herring: false,
      placement,
      trace: {
        entry: event.distance,
        hazard: true,
        index: 0,
        kind: event.kind,
        lane,
        memberIndex: 0,
        nativeUntil,
        placement: {
          block: { dart: false, lanes: placement.lanes, row, rows: placement.rows },
          ...(placement.body === undefined
            ? {}
            : {
                body: {
                  ...placement.body,
                  from: base + placement.body.from,
                  to: base + placement.body.to,
                },
              }),
          cells: placement.cells.map((cell) => ({ ...cell, row: row + cell.row })),
          screen: [base + placement.screen[0], nativeUntil],
          selection: { draws, lift: 0 },
          stands: placement.stands.map((stand) => ({ ...stand, distance: base + stand.distance })),
        },
        quotaIndex,
        requestedDraws: draws,
        row: Math.floor(event.distance / 100),
        source: "events",
        until: nativeUntil + 80,
      },
    };
  }
  const a = moving(0, 0),
    b = moving(1, 1),
    tx = createRepairFeasibility("complete", movingPlan, path, [a]).without(["0:0"]),
    checkpoint = tx.checkpoint();
  expect(tx.probeDetailed(a)).toEqual({ accepted: true });
  expect(tx.probeDetailed(b)).toEqual({ accepted: true });
  expect(tx.probeDetailed(a)).toEqual({ accepted: true });
  expect(tx.tryInsert(a)).toBe(true);
  expect(tx.tryInsert(b)).toBe(false);
  expect(createRepairFeasibility("partial", movingPlan, path, [a]).without([]).tryInsert(b)).toBe(
    false,
  );
  const failedProbe = tx.probeDetailed(b);
  expect(failedProbe).toMatchObject({
    accepted: false,
    failure: { conflicts: ["0:0"], rule: "screen-cap" },
  });
  expect(tx.probeDetailed(b)).toEqual(failedProbe);
  expect(tx.tryInsertDetailed(b)).toMatchObject({
    accepted: false,
    failure: { classification: "conflict", conflicts: ["0:0"], rule: "screen-cap" },
  });
  tx.restore(checkpoint);
  expect(tx.tryInsert(b)).toBe(true);
  tx.restore(checkpoint);
  expect(tx.tryInsert({ ...a, placement: { ...a.placement!, stop: { count: 1, first: 2 } } })).toBe(
    false,
  );
  expect(tx.tryInsert(a)).toBe(true);
  expect(auditSpawnPlan(movingPlan, selected([a])).status).toBe("valid");
  const fixedPlan = {
    ...movingPlan,
    quotas: [
      ...movingPlan.quotas,
      { blocksLane: true, count: 1, kind: "solid" },
      { blocksLane: false, count: 1, kind: "pickup" },
    ],
  };
  function fixed(quotaIndex: number, row: number, lane: number): RepairEntry<string> {
    const quota = fixedPlan.quotas[quotaIndex]!,
      distance = path[row]!.distance,
      until = distance + 130;
    return {
      event: { distance, kind: quota.kind, lane },
      herring: false,
      trace: {
        entry: distance,
        hazard: quota.blocksLane,
        index: 0,
        kind: quota.kind,
        lane,
        memberIndex: 0,
        nativeUntil: until,
        quotaIndex,
        row: Math.floor(distance / 100),
        source: "events",
        until,
      },
    };
  }
  const body = a.trace.placement!.body!;
  const bodyRow = path.findIndex((row) => row.distance >= body.from && row.distance < body.to);
  expect(bodyRow).toBeGreaterThanOrEqual(0);
  const solid = fixed(2, bodyRow, a.event.lane);
  const cell = a.trace.placement!.cells.find((cell) => cell.row >= 0 && cell.row < path.length)!;
  const pickup = fixed(3, cell.row, cell.lane);
  for (const standing of [solid, pickup]) {
    expect(
      createRepairFeasibility("complete", fixedPlan, path, [a]).without([]).tryInsert(standing),
    ).toBe(false);
    expect(
      createRepairFeasibility("complete", fixedPlan, path, [a])
        .without([])
        .tryInsertDetailed(standing),
    ).toMatchObject({
      accepted: false,
      failure: { classification: "conflict", conflicts: ["0:0"] },
    });
    expect(
      createRepairFeasibility("partial", fixedPlan, path, [standing]).without([]).tryInsert(a),
    ).toBe(false);
    expect(
      createRepairFeasibility("complete", fixedPlan, path, [standing]).without([]).tryInsert(a),
    ).toBe(false);
  }
  const prizePlan = {
    ...fixedPlan,
    quotas: fixedPlan.quotas.map((quota, index) =>
      index === 0 ? { ...quota, blocksLane: false, hazard: false } : quota,
    ),
  };
  const prize = { ...a, trace: { ...a.trace, hazard: false } };
  for (const mode of ["complete", "partial"] as const) {
    const tx = createRepairFeasibility(mode, prizePlan, path, [prize]).without([]);
    const before = tx.checkpoint();
    expect(tx.tryInsertDetailed(solid)).toMatchObject({
      accepted: false,
      failure: { classification: "conflict", conflicts: ["0:0"], rule: "body" },
    });
    tx.restore(before);
    expect(tx.tryInsertDetailed(solid)).toMatchObject({
      accepted: false,
      failure: { conflicts: ["0:0"], rule: "body" },
    });
    expect(
      createRepairFeasibility(mode, prizePlan, path, [solid]).without([]).tryInsert(prize),
    ).toBe(false);
  }
});

it("rejects incomplete herring geometry and restores its visibility reservations", () => {
  const spec: MoverSpec = {
    footprint: { lanes: 1, rows: 1 },
    motion: {
      herring: { endRoadShare: 0.5, share: 1 },
      kind: "cross",
      lanesPerSecond: 2,
      reactionSeconds: 0.2,
      startRoadShare: [0.3, 0.3],
      stopLanes: { max: 2, min: 1 },
      stopShare: 0,
      tilt: [0, 0],
      turnAtShare: [0.5, 0.5],
      turnBackShare: 0,
      vergeShare: 0,
    },
    movement: "dart",
    variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
    warningSeconds: 0,
  };
  const herringPlan = {
    ...plan,
    quotas: [{ blocksLane: true, count: 1, kind: "squirrel", mover: spec }],
  };
  const draws: MoverDraws = {
    count: 0,
    delays: [0],
    lengths: [0.5],
    share: 0,
    shy: 0,
    side: 0,
    speed: 0.5,
    start: 0,
    tilt: 0,
    turn: 0,
    turnAt: 0,
  };
  const event = herringSpawn(
    { ...herringPlan, rowSpacing: 100, window: blockingLength(herringPlan, 1) },
    spec,
    draws,
    "squirrel",
    [400],
  )!;
  if (event.mover.motion !== "cross") {
    throw new Error("Expected compiled herring");
  }
  const nativeUntil =
    event.distance + crossLength(plan.laneCount, spec.footprint.lanes) / event.mover.lanesPerPixel;
  const entry: RepairEntry<string> = {
    event,
    herring: true,
    trace: {
      entry: event.distance,
      hazard: true,
      index: 0,
      kind: event.kind,
      lane: event.lane,
      memberIndex: 0,
      nativeUntil,
      quotaIndex: 0,
      requestedDraws: draws,
      row: 4,
      source: "herrings",
      until: nativeUntil + 80,
    },
  };
  const tx = createRepairFeasibility("complete", herringPlan, path, []).without([]),
    checkpoint = tx.checkpoint();
  expect(
    tx.tryInsert({ ...entry, trace: { ...entry.trace, nativeUntil: herringPlan.zoneLength + 1 } }),
  ).toBe(false);
  expect(tx.tryInsert(entry)).toBe(true);
  expect(tx.tryInsert(entry)).toBe(false);
  tx.restore(checkpoint);
  expect(tx.tryInsert(entry)).toBe(true);
});

it("shares only the audited reservation classes in both insertion orders", () => {
  const cases: readonly [MoverPath["motion"], MoverPath["motion"], boolean, boolean, boolean][] = [
    ["cross", "signature", true, true, true],
    ["cross", "cross", true, true, false],
    ["signature", "signature", true, true, false],
    ["ride", "ride", true, true, true],
    ["ride", "ride", true, false, false],
  ];
  for (const [a, b, aBlocks, bBlocks, allowed] of cases) {
    for (const [first, second, firstBlocks, secondBlocks] of [
      [a, b, aBlocks, bBlocks],
      [b, a, bBlocks, aBlocks],
    ] as const) {
      const cells = new SpawnCells(1, 1, 0);
      if (firstBlocks) {
        cells.takeMover(first === "cross", 0, 0, first === "ride");
      } else {
        cells.takePrize(first === "cross", 0, 0);
      }
      expect(cells.isFreeForRepair(second, 0, 0, secondBlocks)).toBe(allowed);
    }
  }
});

it("retains nonmonotone wall/dart unions and checks rows outside a relocation's span", () => {
  const lanePlan = { ...plan, minOpenLanes: 2 };
  const lanes = new LaneBlocks(lanePlan, 100, new Int32Array(path.length));
  lanes.retainBlock({ lane: 0, row: 2 }, { lanes: 3, rows: 1 }, true);
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 });
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  // A candidate elsewhere cannot repair an exposed, entirely swept stretch.
  expect(lanes.tryBlock({ lane: 0, row: 7 }, { lanes: 1, rows: 1 }, false, false, true)).toBe(
    false,
  );
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  // Filling that stretch removes it from the road available to the pack.
  expect(lanes.tryBlock({ lane: 0, row: 2 }, { lanes: 2, rows: 1 }, false, false, true)).toBe(true);
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  lanes.retainBlock({ lane: 0, row: 2 }, { lanes: 2, rows: 1 });
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  // The retained dart and both wall masks still count toward minimum open lanes.
  expect(lanes.tryBlock({ lane: 3, row: 2 }, { lanes: 1, rows: 1 }, false, false, true)).toBe(
    false,
  );
  expect(lanes.keepsAllLanesOpen()).toBe(true);
});

it("defers only nonmonotone stretches while a ledger is partial", () => {
  const lanePlan = { ...plan, minOpenLanes: 2 };
  const held = new Int32Array(path.length).fill(1);
  const lanes = new LaneBlocks(lanePlan, 100, held);
  lanes.retainBlock({ lane: 1, row: 2 }, { lanes: 1, rows: 1 });
  lanes.retainBlock({ lane: 3, row: 2 }, { lanes: 1, rows: 1 });
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 }, true);
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  expect(lanes.keepsAllLanesOpen(undefined, "partial")).toBe(true);
  expect(lanes.tryBlock({ lane: 1, row: 7 }, { lanes: 1, rows: 1 }, false, false, true)).toBe(
    false,
  );
  expect(
    lanes.tryBlock(
      { lane: 1, row: 7 },
      { lanes: 1, rows: 1 },
      false,
      false,
      true,
      undefined,
      "partial",
    ),
  ).toBe(true);
  expect(
    lanes.tryBlock(
      { lane: 0, row: 7 },
      { lanes: 1, rows: 1 },
      false,
      false,
      true,
      undefined,
      "partial",
    ),
  ).toBe(false);
  expect(
    lanes.tryBlock(
      { lane: 4, row: 2 },
      { lanes: 1, rows: 1 },
      false,
      false,
      true,
      undefined,
      "partial",
    ),
  ).toBe(false);
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 });
  expect(lanes.keepsAllLanesOpen()).toBe(true);
});

it("restores a mandatory wall through a partial prefix and still requires a complete audit", () => {
  const spec: MoverSpec = {
    footprint: { lanes: 1, rows: 1 },
    motion: {
      kind: "cross",
      lanesPerSecond: 0.5,
      reactionSeconds: 0.2,
      startRoadShare: [5 / 6, 5 / 6],
      stopLanes: { max: 2, min: 1 },
      stopShare: 0,
      tilt: [0, 0],
      turnAtShare: [0.5, 0.5],
      turnBackShare: 0,
      vergeShare: 0,
    },
    movement: "dart",
    variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
    warningSeconds: 0,
  };
  const relocationPlan: SpawnPlan<string> = {
    ...plan,
    minOpenLanes: 2,
    pathStart: 0,
    quotas: [
      { blocksLane: true, count: 1, kind: "left" },
      { blocksLane: true, count: 1, kind: "middle" },
      { blocksLane: true, count: 1, kind: "right" },
      { blocksLane: true, count: 1, kind: "dart", mover: spec },
      { blocksLane: false, count: 1, kind: "pending" },
    ],
    roadLength: 800,
    sightLength: 600,
    zoneLength: 4000,
  };
  const rows = zoneRows(relocationPlan, rowSpacing(relocationPlan));
  const fixedPath = rows.map((distance) => ({ distance, lane: 0 }));
  const draws: MoverDraws = {
    count: 0,
    delays: [0],
    lengths: [0.5],
    share: 0,
    shy: 0,
    side: 0,
    speed: 0.5,
    start: 0,
    tilt: 0,
    turn: 0,
    turnAt: 0,
  };
  const placement = moverPlacements(
    {
      ...relocationPlan,
      rowSpacing: rowSpacing(relocationPlan),
      window: blockingLength(relocationPlan, 1),
    },
    spec,
    draws,
  )[0]!;
  expect(placement.lanes).toEqual({ count: 2, first: 2 });
  const row = 8,
    base = rows[row]!;
  function fixed(quotaIndex: number, lane: number, spawnRow = row): RepairEntry<string> {
    const quota = relocationPlan.quotas[quotaIndex]!,
      distance = rows[spawnRow]!,
      until = distance + 830;
    return {
      event: { distance, kind: quota.kind, lane },
      herring: false,
      trace: {
        entry: distance,
        hazard: quota.blocksLane,
        index: 0,
        kind: quota.kind,
        lane,
        memberIndex: 0,
        nativeUntil: until,
        quotaIndex,
        row: Math.floor(distance / rowSpacing(relocationPlan)),
        source: "events",
        until,
      },
    };
  }
  const nativeUntil = base + placement.screen[1];
  const dart: RepairEntry<string> = {
    event: {
      distance: base + placement.appears,
      kind: "dart",
      lane: placement.lane,
      mover: placement.path,
    },
    herring: false,
    placement,
    trace: {
      entry: base + placement.appears,
      hazard: true,
      index: 0,
      kind: "dart",
      lane: placement.lane,
      memberIndex: 0,
      nativeUntil,
      placement: {
        block: { dart: true, lanes: placement.lanes, row, rows: placement.rows },
        cells: placement.cells.map((cell) => ({ ...cell, row: row + cell.row })),
        screen: [base + placement.screen[0], nativeUntil],
        selection: { draws, lift: 0 },
        stands: placement.stands.map((stand) => ({ ...stand, distance: base + stand.distance })),
      },
      quotaIndex: 3,
      requestedDraws: draws,
      row: Math.floor((base + placement.appears) / rowSpacing(relocationPlan)),
      source: "events",
      until: nativeUntil + 260,
    },
  };
  const middle = fixed(1, 2),
    pending = fixed(4, 4, 1),
    ledger = [fixed(0, 1), middle, fixed(2, 3), dart];
  function audit(entries: readonly RepairEntry<string>[]) {
    return auditSpawnPlan(relocationPlan, { ...selected(entries), path: fixedPath });
  }
  expect(audit(ledger).status).toBe("valid");
  const complete = createRepairFeasibility("complete", relocationPlan, fixedPath, ledger).without([
    "1:0",
  ]);
  expect(complete.tryInsert(pending)).toBe(false);
  const partial = createRepairFeasibility("partial", relocationPlan, fixedPath, ledger).without([
      "1:0",
    ]),
    checkpoint = partial.checkpoint();
  expect(partial.tryInsert(pending)).toBe(true);
  expect(audit([...ledger.filter((entry) => entry !== middle), pending]).status).toBe("invalid");
  partial.restore(checkpoint);
  expect(partial.tryInsert(pending)).toBe(true);
  expect(partial.tryInsert(middle)).toBe(true);
  expect(audit([...ledger, pending])).toMatchObject({ status: "valid", validPlaced: 5 });
});

it("probes success and failure repeatedly without changing requests or checkpoint contents", () => {
  const entry = standing(0, 0, 0),
    invalid = standing(0, 0, 2);
  const tx = createRepairFeasibility("complete", plan, path, []).without([]);
  const checkpoint = tx.checkpoint();
  const rejected = tx.probeDetailed(invalid);
  expect(rejected).toMatchObject({
    accepted: false,
    failure: { classification: "intrinsic", rule: "path" },
  });
  expect(tx.probeDetailed(invalid)).toEqual(rejected);
  expect(tx.probeDetailed(entry)).toEqual({ accepted: true });
  expect(tx.probeDetailed(entry)).toEqual({ accepted: true });
  expect(tx.checkpoint().entries).toEqual(checkpoint.entries);
  expect(tx.tryInsertDetailed(entry)).toEqual({ accepted: true });
  expect(tx.probeDetailed(entry)).toMatchObject({
    accepted: false,
    failure: { rule: "duplicate-request" },
  });
  tx.restore(checkpoint);
  expect(tx.probeDetailed(entry)).toEqual({ accepted: true });
  expect(tx.tryInsert(entry)).toBe(true);
});

it("rebuilds swept masks when a standing wall moves and restores the complete saved union", () => {
  const lanes = new LaneBlocks({ ...plan, minOpenLanes: 2 }, 100, new Int32Array(path.length));
  for (const lane of [1, 3]) {
    lanes.retainBlock({ lane, row: 2 }, { lanes: 1, rows: 1 });
  }
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 }, true);
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 });
  const wall = lanes.latest();
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  const restore = lanes.save();
  lanes.remove(wall);
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  // A legal destination cannot repair the dart-only island left at the source.
  expect(lanes.tryBlock({ lane: 1, row: 7 }, { lanes: 1, rows: 1 }, true)).toBe(true);
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  restore();
  expect(lanes.latest()).toBe(wall);
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  lanes.remove(wall);
  expect(lanes.keepsAllLanesOpen()).toBe(false);
});

it("restores wall and dart masks after speculative additions and dart removal", () => {
  const lanes = new LaneBlocks(plan, 100, new Int32Array(path.length));
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 3, rows: 1 }, true);
  const dart = lanes.latest();
  const restore = lanes.save();
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 });
  expect(lanes.keepsAllLanesOpen()).toBe(false);
  lanes.remove(dart);
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  restore();
  expect(lanes.keepsAllLanesOpen()).toBe(true);
  lanes.retainBlock({ lane: 2, row: 2 }, { lanes: 1, rows: 1 });
  expect(lanes.keepsAllLanesOpen()).toBe(false);
});
