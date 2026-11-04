import { describe, expect, it, vi } from "vitest";

import { moverLeavesMinimumLanes } from "./laneAlternatives.ts";
import * as motion from "./moverPlanning.ts";
import { DART_LIFTS, drawMover, moverPlacements, moverRetries } from "./moverPlanning.ts";
import { auditSlotPartialPlan, auditSlotPlan } from "./slotAudit.ts";
import { createSlotCandidateDomains } from "./slotCandidateDomains.ts";
import {
  compileSlotKindDomain,
  describeSlotKind,
  prepareSlotKind,
  slotMotionSelections,
  slotPlacementsAt,
} from "./slotCandidates.ts";
import type { SlotConfiguration, SlotKind, SlotSource } from "./slotConfig.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import * as entropy from "./slotEntropy.ts";
import { slotMotionStreams } from "./slotEntropy.ts";
import { makeSlotJobs } from "./slotJobs.ts";
import type { SlotAssignment } from "./slotPlan.ts";
import { constructSlotWitness, type SlotWitnessConstructPorts } from "./slotWitnessConstruct.ts";
import type { WitnessJob } from "./slotWitnessSearch.ts";
import {
  blockingLength,
  rowSpacing,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";
import { auditMoverGeometry } from "./spawnMoverValidation.ts";

const context = { seed: 3, zoneIndex: 0 };
const key = "active:minorMoving:0";
const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: -18.79754601226989,
  cellLength: 64,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 12,
  laneMoveSeconds: 1 / 9,
  maxEmptyRows: Infinity,
  minOpenLanes: 2,
  minSpacing: 213,
  moverCaps: { darts: 6, slowVehicles: 4, total: 10 },
  packHitLength: 162.1538461538462,
  packLength: 166.1538461538462,
  pathLaneMoveSeconds: 0.33670033670033667,
  pathStart: 2,
  reactionSeconds: 0.5,
  riderFollowGap: 64,
  roadLength: 724,
  scrollSpeed: 187.5,
  sightLength: 553.8461538461538,
  stepSeconds: 1 / 60,
  zoneLength: 29600,
};
const source: SlotKind<string> = {
  compile: () => ({
    blocksLane: true,
    first: false,
    hitLength: 64,
    mover: {
      footprint: { lanes: 3, rows: 1 },
      hitLength: 68.62681744749602,
      motion: {
        kind: "cross",
        lanesPerSecond: 1.9500000000000002,
        pause: {
          seconds: 1,
          stops: [
            [0, 2],
            [1, 3],
            [2, 4],
          ],
        },
        reactionSeconds: 0.5,
        startRoadShare: [0.15, 0.45],
        stopLanes: { max: 1, min: 1 },
        stopShare: 0,
        tilt: [0, 0],
        turnAtShare: [0, 0],
        turnBackShare: 0,
        vergeShare: 0,
      },
      movement: "stopAndGoAcross",
      variation: { delaySeconds: 0.6, lengthShare: 0.35, speedShare: 0.25 },
      warningSeconds: 0.6,
    },
  }),
  footprint: { lanes: 3, rows: 1 },
  kind: "crosstownBus",
  role: "minorMoving",
  weight: 2.75,
};
const ride: SlotKind<string> = {
  ...source,
  compile: () => ({
    blocksLane: true,
    mover: {
      footprint: { lanes: 1, rows: 3 },
      motion: { kind: "ride", speedMultiplier: 2.3 },
      movement: "inLane",
      variation: { delaySeconds: 0.6, lengthShare: 0.35, speedShare: 0.25 },
      warningSeconds: 0.6,
    },
  }),
  footprint: { lanes: 1, rows: 3 },
};
const grid = {
  ...geometry,
  rowSpacing: rowSpacing({ ...geometry, quotas: [] }),
  window: blockingLength(geometry, 1),
};

function auditedFixture() {
  const empty = { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 0 };
  const config: SlotConfiguration<string> = {
    active: { ...empty, minorMoving: 1 },
    capacity: { ...empty, minorMoving: 1 },
    guarantees: [{ count: 1, kind: source.kind, role: "minorMoving" }],
  };
  const auxiliary: SpawnQuota<string>[] = [
    { blocksLane: false, count: 9, kind: "tip", moversPassOver: true, moversRestOn: true },
  ];
  const jobs = makeSlotJobs([source], auxiliary, config);
  const path = zoneRows(geometry, grid.rowSpacing).map((distance, row) => ({
    distance,
    lane: row < 4 ? 2 : row < 8 ? 3 : 4,
  }));
  const state = createSlotConstructionState(geometry, path);
  const assignments: SlotAssignment<string>[] = [];
  for (const [index, job] of jobs.entries()) {
    const selected = job.sources[0]!;
    const prepared = prepareSlotKind(
      slotMotionStreams(context, job.key, selected.kind),
      geometry,
      selected,
    );
    const row = index === 0 ? 20 : index;
    const entries = slotPlacementsAt(
      geometry,
      { distance: path[row]!.distance, lane: 0, row, slot: index },
      prepared,
    );
    const entry = entries.find((candidate) =>
      index === 0 ? candidate.trace.placement?.selection?.draws.speed === 0.25 : true,
    );
    expect(entry).toBeDefined();
    const result = state.commit(job, entry!);
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      throw new Error("Native retry fixture did not fit");
    }
    assignments.push({
      ...(job.auxiliary ? { auxiliary: job.auxiliary } : {}),
      binding: { kind: selected.kind, role: selected.role, weight: selected.weight },
      entry: result.entry,
      key: job.key,
      phase: "active",
      role: job.role,
    });
  }
  expect(state.checkComplete()).toEqual({ accepted: true });
  return { assignments, auxiliary, config, path };
}

describe("native slot motion retry capabilities", () => {
  it("keeps one original draw vector and all template charges while a full bus gains a legal retry", () => {
    const raw = slotMotionStreams(context, key, source.kind);
    const streams = { movers: vi.fn(raw.movers), spawns: vi.fn(raw.spawns) };
    const expectedRaw = slotMotionStreams(context, key, source.kind);
    const expectedStreams = {
      movers: vi.fn(expectedRaw.movers),
      spawns: vi.fn(expectedRaw.spawns),
    };
    const requested = drawMover(expectedStreams);
    const prepared = prepareSlotKind(streams, geometry, source);
    const original = [0, ...DART_LIFTS].flatMap((lift) =>
      moverPlacements(grid, prepared.request.mover!, requested, lift),
    );
    expect(original).toHaveLength(30);
    expect(
      original.every(
        (placement) => !moverLeavesMinimumLanes(geometry, source.footprint, placement),
      ),
    ).toBe(true);
    expect(prepared.compiledCount).toBe(300);
    expect(prepared.placements).toHaveLength(16);
    expect(prepared.draws).toEqual(requested);
    expect(streams.movers.mock.calls).toEqual(expectedStreams.movers.mock.calls);
    expect(streams.spawns.mock.calls).toEqual(expectedStreams.spawns.mock.calls);
    expect(prepared.placements[0]?.selection?.draws.speed).toBe(0.25);
    expect(
      prepared.placements.every(
        (placement) => placement.path.movement === "stopAndGoAcross" && placement.stop?.count === 3,
      ),
    ).toBe(true);
  });

  it("skips a guarded empty original tier without skipping later native retry tuples", () => {
    const prepared = prepareSlotKind(
      slotMotionStreams(context, key, source.kind),
      geometry,
      source,
    );
    expect(prepared.placements.length).toBeGreaterThan(0);
    expect(prepared.placements.every((value) => value.selection?.draws !== prepared.draws)).toBe(
      true,
    );
    const path = zoneRows(geometry, grid.rowSpacing).map((distance) => ({ distance, lane: 4 }));
    const domains = createSlotCandidateDomains(geometry, path);
    const work = {
      anchor: vi.fn(() => true),
      check: vi.fn(() => true),
      propagate: vi.fn(() => true),
    };
    const tiers = domains.motionTiers(work, prepared);
    expect(tiers.status).toBe("tiers");
    const order = { columnStart: 0, columns: prepared.columns, motionTier: 0, rows: [20, 21] };
    work.propagate.mockClear();
    expect([...domains.frontierSequence(work, order, key, prepared)]).toEqual([
      { status: "empty-tier" },
    ]);
    expect(work.anchor).not.toHaveBeenCalled();
    expect(work.check).not.toHaveBeenCalled();
    expect(work.propagate).toHaveBeenCalledOnce();
    expect(domains.statistics().expansions).toBe(0);
    expect(domains.statistics().projection.indexedTemplates).toBe(0);
    expect(domains.completedCardinality(order, key, prepared)).toBeUndefined();
    work.propagate.mockClear();
    expect([...domains.frontierSequence(work, order, key, prepared)]).toEqual([
      { status: "empty-tier" },
    ]);
    expect(work.propagate).toHaveBeenCalledOnce();
    expect([
      ...domains.frontierSequence({ ...work, propagate: () => false }, order, key, prepared),
    ]).toEqual([{ kind: "propagation", status: "budget" }]);
    expect(() => {
      path[0]!.lane = 3;
    }).toThrow(TypeError);
    expect([...domains.frontierSequence(work, order, key, prepared)]).toEqual([
      { status: "empty-tier" },
    ]);
    const state = createSlotConstructionState(geometry, path);
    const job: WitnessJob<string> = {
      columnPick: () => 0,
      fixed: false,
      guaranteed: true,
      key,
      laneEffect: "possible",
      ordinal: 0,
      phase: "active",
      preparations: () => [prepared],
      total: 1,
    };
    const requested: (number | undefined)[] = [];
    const ports: SlotWitnessConstructPorts<string, ReturnType<typeof state.checkpoint>> = {
      candidates(owner, kind, order) {
        requested.push(order.motionTier);
        return order.motionTier === undefined
          ? domains.sequence(work, order, owner.key, kind)
          : domains.frontierSequence(work, order, owner.key, kind);
      },
      checkpoint: state.checkpoint,
      complete: state.checkComplete,
      entries: state.entries,
      motionTiers: (kind) => domains.motionTiers(work, kind),
      preparations: (owner) => owner.preparations(),
      propagate: work.propagate,
      restore: state.restore,
      test: (owner, candidate) => state.commit(owner, candidate.entry),
    };
    const result = constructSlotWitness(ports, geometry, path, [job]);
    expect(result.status).toBe("compatible");
    expect(requested.filter((tier) => tier === 0)).toHaveLength(1);
    expect(requested.some((tier) => tier !== undefined && tier > 0)).toBe(true);
    if (result.status !== "compatible") {
      throw Error("Expected retained native retry support");
    }
    const entry = result.witness[0]!.entry;
    expect(entry.trace.requestedDraws).toBe(prepared.draws);
    expect(entry.trace.placement!.selection!.draws).not.toBe(prepared.draws);
    expect(createSlotConstructionState(geometry, path, result.witness).checkComplete()).toEqual({
      accepted: true,
    });
    expect(state.entries()).toEqual([]);
  });

  it("retains nonblocking and herring domains instead of applying a hazard-only lane bound", () => {
    const nonblocking: SlotSource<string> = {
      ...source,
      compile: (streams) => ({ ...source.compile(streams), blocksLane: false }),
    };
    const prize = prepareSlotKind(
      slotMotionStreams(context, key, source.kind),
      geometry,
      nonblocking,
    );
    expect(prize.placements).toHaveLength(300);
    expect(
      prize.placements.some(
        (placement) => !moverLeavesMinimumLanes(geometry, source.footprint, placement),
      ),
    ).toBe(true);
    const herring: SlotSource<string> = {
      ...source,
      compile: (streams) => {
        const request = source.compile(streams);
        if (request.mover?.motion.kind !== "cross") {
          throw new Error("Expected crosser");
        }
        return {
          ...request,
          mover: {
            ...request.mover,
            motion: { ...request.mover.motion, herring: { endRoadShare: 0.5, share: 1 } },
          },
        };
      },
    };
    const scenery = prepareSlotKind(
      slotMotionStreams(context, key, source.kind),
      geometry,
      herring,
    );
    expect(scenery.herring).toBe(true);
    expect(scenery.compiledCount).toBe(1);
    expect(scenery.placements).toEqual([]);
    expect(scenery.columns).toHaveLength(1);
  });

  it("retains native ride speed order and the full original reactive count and rank", () => {
    const rider = prepareSlotKind(slotMotionStreams(context, key, ride.kind), geometry, ride);
    expect([
      ...new Set(rider.placements.map((placement) => placement.selection?.draws.speed)),
    ]).toEqual([
      rider.draws!.speed,
      ...moverRetries(rider.request.mover!, rider.draws!).map((draws) => draws.speed),
    ]);
    const approach: SlotSource<string> = {
      ...source,
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 2, rows: 2 },
          motion: {
            firstDelaySeconds: [0, 0.5],
            kind: "approach",
            secondRoadShare: [0.25, 0.45],
            stepSeconds: 0.4,
            steps: { max: 6, min: 3 },
          },
          movement: "approach",
          variation: { delaySeconds: 0.6, lengthShare: 0.35, speedShare: 0.25 },
          warningSeconds: 0.6,
        },
      }),
      footprint: { lanes: 2, rows: 2 },
    };
    const reactive = prepareSlotKind(
      slotMotionStreams(context, key, approach.kind),
      geometry,
      approach,
    );
    const original = moverPlacements(grid, reactive.request.mover!, reactive.draws);
    expect(moverRetries(reactive.request.mover!, reactive.draws!)).not.toEqual([]);
    expect(reactive.compiledCount).toBe(original.length);
    expect(
      reactive.placements.every(
        (placement) => placement.rank === Math.max(...original.map((value) => value.rank ?? 0)),
      ),
    ).toBe(true);
    expect(reactive.placements.some((placement) => placement.lanes.count === 4)).toBe(true);
  });

  it("freshly certifies an actual retry and the same retained retry in a partial layout", () => {
    const f = auditedFixture();
    const complete = auditSlotPlan(
      context,
      geometry,
      f.path,
      [source],
      f.auxiliary,
      f.config,
      "active",
      f.assignments,
    );
    expect(complete.violations).toEqual([]);
    expect(complete.geometry.violations).toEqual([]);
    expect(complete.status).toBe("valid");
    expect(complete.geometry.validPlaced).toBe(10);
    const partial = auditSlotPartialPlan(
      context,
      geometry,
      f.path,
      [source],
      f.auxiliary,
      f.config,
      [
        {
          auxiliary: { memberIndex: 8, requestIndex: 0 },
          key: "auxiliary:0:8",
          kind: "tip",
          reason: "not-selected-within-allowance",
          role: "auxiliaryFixed",
        },
      ],
      f.assignments.slice(0, -1),
    );
    expect(partial.status).toBe("valid");
    expect(partial.geometry.validPlaced).toBe(9);
    expect(partial.delivery.configured).toBe(10);
  });

  it.each([
    { kind: source, name: "cross" },
    { kind: ride, name: "ride" },
  ])(
    "freshly compiles and draws once while billing only the selected native $name tier",
    ({ kind: authored }) => {
      // Native preparation freezes its source, so the compile spy needs an unprepared copy.
      const kind = { ...authored };
      const f = auditedFixture();
      if (authored !== source) {
        const prepared = prepareSlotKind(
          slotMotionStreams(context, key, kind.kind),
          geometry,
          authored,
        );
        const entry = slotPlacementsAt(
          geometry,
          { distance: f.path[20]!.distance, lane: 0, row: 20, slot: 0 },
          prepared,
        ).find((candidate) => candidate.trace.placement?.selection?.draws.speed === 0.25);
        expect(entry).toBeDefined();
        f.assignments[0] = { ...f.assignments[0]!, entry: entry! };
      }
      const selected = f.assignments[0]!.entry.trace.placement!.selection!;
      const tier = moverPlacements(
        grid,
        f.assignments[0]!.entry.request.mover!,
        selected.draws,
        selected.lift,
      );
      const compile = vi.spyOn(kind, "compile");
      const generate = vi.spyOn(motion, "moverPlacementsWithWork");
      const raw = entropy.slotMotionStreams;
      const records: { key: string; streams: ReturnType<typeof observedStreams> }[] = [];
      function observedStreams(streams: ReturnType<typeof slotMotionStreams>) {
        return { movers: vi.fn(streams.movers), spawns: vi.fn(streams.spawns) };
      }
      const capture = vi
        .spyOn(entropy, "slotMotionStreams")
        .mockImplementation((context, key, kind) => {
          const streams = observedStreams(raw(context, key, kind));
          records.push({ key, streams });
          return streams;
        });
      try {
        const audit = auditSlotPlan(
          context,
          geometry,
          f.path,
          [kind],
          f.auxiliary,
          f.config,
          "active",
          f.assignments,
        );
        expect(audit.status).toBe("valid");
        expect(audit.geometry.validPlaced).toBe(10);
        expect(compile).toHaveBeenCalledTimes(1);
        expect(audit.compiledTemplates).toBe(new Set(tier).size + 9);
        expect(generate.mock.calls.filter(([work]) => work !== undefined)).toHaveLength(1);
        const expected = observedStreams(raw(context, key, kind.kind));
        drawMover(expected);
        const descriptions = records.filter((record) => record.key === key);
        expect(descriptions).toHaveLength(1);
        expect(descriptions[0]!.streams.movers.mock.results).toEqual(expected.movers.mock.results);
        expect(descriptions[0]!.streams.spawns.mock.results).toEqual(expected.spawns.mock.results);
      } finally {
        capture.mockRestore();
        generate.mockRestore();
        compile.mockRestore();
      }
    },
  );

  it("rejects native geometry made from a non-coupled tilt and speed retry", () => {
    const cross: SlotKind<string> = {
      ...source,
      compile: (streams) => {
        const request = source.compile(streams);
        if (request.mover?.motion.kind !== "cross") {
          throw new Error("Expected cross profile");
        }
        const motion = { ...request.mover.motion, tilt: [-0.1, 0.1] as const };
        delete motion.pause;
        return {
          ...request,
          mover: {
            ...request.mover,
            footprint: { lanes: 1, rows: 1 },
            motion,
          },
        };
      },
      footprint: { lanes: 1, rows: 1 },
      kind: "cross",
    };
    const f = auditedFixture();
    const descriptor = describeSlotKind(slotMotionStreams(context, key, cross.kind), cross);
    const original = descriptor.draws!;
    const legal = slotMotionSelections(descriptor);
    const tilt = legal.find((choice) => choice.draws.tilt !== original.tilt)!;
    const speed = legal.find((choice) => choice.draws.speed !== original.speed)!;
    const mixed = { ...original, speed: speed.draws.speed, tilt: tilt.draws.tilt };
    expect(
      legal.some(
        (choice) => choice.draws.speed === mixed.speed && choice.draws.tilt === mixed.tilt,
      ),
    ).toBe(false);
    const placements = moverPlacements(grid, descriptor.request.mover!, mixed)
      .filter((placement) => moverLeavesMinimumLanes(geometry, cross.footprint, placement))
      .map((placement) => ({ ...placement, selection: { draws: mixed, lift: 0 } }));
    const domain = compileSlotKindDomain(undefined, geometry, descriptor);
    const entry = slotPlacementsAt(
      geometry,
      { distance: f.path[20]!.distance, lane: 0, row: 20, slot: 0 },
      { ...domain, placements },
    )[0]!;
    expect(entry).toBeDefined();
    expect(
      auditMoverGeometry(
        { ...geometry, quotas: [entry.request] },
        entry.request,
        entry.event,
        entry.trace.placement!,
      ).reasons,
    ).toEqual([]);
    const audit = auditSlotPlan(
      context,
      geometry,
      f.path,
      [cross],
      f.auxiliary,
      { ...f.config, guarantees: [{ count: 1, kind: cross.kind, role: cross.role }] },
      "active",
      [
        {
          ...f.assignments[0]!,
          binding: { kind: cross.kind, role: cross.role, weight: cross.weight },
          entry,
        },
        ...f.assignments.slice(1),
      ],
    );
    expect(audit.status).toBe("invalid");
    expect(audit.violations).toContain("slot-motion-capability");
  });

  it.each(["draws", "mixed", "path", "lift", "requested", "unused"] as const)(
    "rejects a forged retry %s tuple",
    (field) => {
      const f = auditedFixture();
      const assignments = structuredClone(f.assignments);
      const entry = assignments[0]!.entry;
      if (field === "unused") {
        Reflect.set(entry.trace.placement!.selection!.draws, "count", 0.12345);
      } else if (field === "draws" || field === "mixed") {
        Reflect.set(entry.trace.placement!.selection!, "draws", {
          ...entry.trace.placement!.selection!.draws,
          speed: field === "mixed" ? 1 : 0.12345,
        });
      } else if (field === "path") {
        Reflect.set(entry.event.mover!, "lanesPerPixel", 0.012345);
      } else if (field === "lift") {
        Reflect.set(entry.trace.placement!.selection!, "lift", 0.12345);
      } else {
        Reflect.set(entry.trace.requestedDraws!, "speed", 0.12345);
      }
      const audit = auditSlotPlan(
        context,
        geometry,
        f.path,
        [source],
        f.auxiliary,
        f.config,
        "active",
        assignments,
      );
      expect(audit.status).toBe("invalid");
      expect(audit.violations).toContain(
        field === "requested" ? "slot-profile-binding" : "slot-motion-capability",
      );
    },
  );
});
