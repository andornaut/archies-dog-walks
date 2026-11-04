import { describe, expect, it, vi } from "vitest";

import { createSlotCandidateDomains } from "./slotCandidateDomains";
import type { PreparedSlotKind } from "./slotCandidates";
import * as preparation from "./slotCandidates";
import type { SlotSource } from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import { constructSlotWitness, type SlotWitnessConstructPorts } from "./slotWitnessConstruct";
import type { WitnessJob } from "./slotWitnessSearch";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 3, slowVehicles: 3, total: 6 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 4,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 3000,
};
const variation = { delaySeconds: 0, lengthShare: 0, speedShare: 0 };
function profiles() {
  const footprint = { lanes: 2, rows: 1 };
  const following: SlotSource<string> = {
    compile: () => ({
      blocksLane: true,
      mover: {
        footprint,
        motion: {
          firstDelaySeconds: [0, 0],
          kind: "approach",
          secondRoadShare: [0.5, 0.5],
          stepSeconds: 0.1,
          steps: { max: 2, min: 2 },
        },
        movement: "approach",
        variation,
        warningSeconds: 0,
      },
    }),
    footprint,
    kind: "following",
    role: "minorMoving",
    weight: 2,
  };
  const rider: SlotSource<string> = {
    compile: () => ({
      blocksLane: true,
      mover: {
        footprint: { lanes: 1, rows: 1 },
        motion: { kind: "ride", speedMultiplier: 1.5 },
        movement: "inLane",
        variation,
        warningSeconds: 0,
      },
    }),
    footprint: { lanes: 1, rows: 1 },
    kind: "rider",
    role: "minorMoving",
    weight: 3,
  };
  const exit: SlotSource<string> = {
    compile: () => ({
      blocksLane: true,
      mover: {
        footprint: { lanes: 1, rows: 1 },
        motion: {
          kind: "signature",
          profile: {
            downSeconds: 0.2,
            finishAheadSeconds: 0.1,
            kind: "turnExit",
            lanesPerSecond: 5,
            rows: 1,
            warningSeconds: 0.1,
          },
        },
        movement: "inLane",
        variation,
        warningSeconds: 0.1,
      },
    }),
    footprint: { lanes: 1, rows: 1 },
    kind: "exit",
    role: "minorMoving",
    weight: 1,
  };
  const fixed: SlotSource<string> = {
    compile: () => ({ blocksLane: true }),
    footprint: { lanes: 1, rows: 1 },
    kind: "wall",
    role: "minorFixed",
    weight: 1,
  };
  const compile = (source: SlotSource<string>) =>
    preparation.prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, geometry, source);
  return {
    exit: compile(exit),
    fixed: compile(fixed),
    following: compile(following),
    rider: compile(rider),
  };
}

function run(pools: readonly (readonly PreparedSlotKind<string>[])[], allowance = Infinity) {
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
  const jobs: WitnessJob<string>[] = pools.map((pool, ordinal) => ({
    columnPick: () => 0,
    fixed: pool[0]!.request.mover === undefined,
    guaranteed: true,
    key: `job:${ordinal}`,
    laneEffect: "possible",
    minimumCells: 0,
    ordinal,
    phase: "active",
    preparations: () => pool,
    total: pools.length,
  }));
  const state = createSlotConstructionState(geometry, path);
  const domains = createSlotCandidateDomains(geometry, path);
  let propagation = 0;
  let orderingPropagation: number | undefined;
  let orderingVisits = 0;
  let stringifyCalls = 0;
  let stringifyVisits = 0;
  let ordering = true;
  const calls: string[] = [];
  const originalPrepared = new Set(pools.flat());
  const arrays = new Set(pools.flat().map((prepared) => prepared.placements));
  const iterator = Array.prototype[Symbol.iterator];
  const iteratorDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!;
  Object.defineProperty(Array.prototype, Symbol.iterator, {
    ...iteratorDescriptor,
    value(this: unknown[]) {
      const result = iterator.call(this);
      if (ordering && arrays.has(this as PreparedSlotKind<string>["placements"])) {
        const next = result.next.bind(result);
        result.next = () => {
          const value = next();
          if (!value.done) {
            orderingVisits++;
          }
          return value;
        };
      }
      return result;
    },
  });
  const stringify = JSON.stringify;
  const stringifyDescriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  Object.defineProperty(JSON, "stringify", {
    ...stringifyDescriptor,
    value(value: unknown, replacer: unknown, space?: number | string) {
      if (typeof replacer === "function") {
        const actual = replacer as (this: unknown, key: string, value: unknown) => unknown;
        if (ordering && originalPrepared.has(value as PreparedSlotKind<string>)) {
          stringifyCalls++;
          return stringify(
            value,
            function (this: unknown, key: string, field: unknown) {
              stringifyVisits++;
              return actual.call(this, key, field);
            },
            space,
          );
        }
        return stringify(value, actual, space);
      }
      return stringify(value, replacer as (number | string)[] | null | undefined, space);
    },
  });
  const work = {
    anchor: () => true,
    check: () => true,
    propagate: () => ++propagation <= allowance,
  };
  const ports: SlotWitnessConstructPorts<string, ReturnType<typeof state.checkpoint>> = {
    candidates(job, prepared, order) {
      orderingPropagation ??= propagation;
      ordering = false;
      calls.push(`${job.key}:${prepared.source.kind}`);
      return domains.sequence(work, order, job.key, prepared);
    },
    checkpoint: state.checkpoint,
    complete: state.checkComplete,
    entries: state.entries,
    preparations: (job) => job.preparations(),
    propagate: work.propagate,
    restore: state.restore,
    test: (job, candidate) => state.commit(job, candidate.entry),
  };
  try {
    const result = constructSlotWitness(ports, geometry, path, jobs);
    expect(state.entries()).toEqual([]);
    if (result.status === "compatible") {
      expect(createSlotConstructionState(geometry, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
    }
    return {
      calls,
      orderingPropagation,
      orderingVisits,
      propagation,
      result:
        result.status === "compatible"
          ? {
              entries: result.witness.map(({ entry, owner }) => ({ entry, owner: owner.key })),
              status: result.status,
            }
          : result,
      stringifyCalls,
      stringifyVisits,
    };
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, iteratorDescriptor);
    Object.defineProperty(JSON, "stringify", stringifyDescriptor);
  }
}

function scanned(pools: readonly (readonly PreparedSlotKind<string>[])[]) {
  const snapshot = vi
    .spyOn(preparation, "nativeSlotPreparationOrderingHint")
    .mockReturnValue({ status: "unknown" });
  try {
    return run(pools);
  } finally {
    snapshot.mockRestore();
  }
}

describe("native envelope metadata consumer", () => {
  it("preserves full-source ordering and native output while removing the duplicate placement iteration", () => {
    const { following, rider } = profiles();
    const pools = [[rider], [following], [following, rider]];
    const before = scanned(pools);
    const after = run(pools);
    expect(after.result).toEqual(before.result);
    expect(after.result.status).toBe("compatible");
    expect(after.calls).toEqual(before.calls);
    expect(after.calls[0]).toBe("job:1:following");
    expect(before.orderingVisits).toBe(
      rider.placements.length * 2 + following.placements.length * 2,
    );
    expect(after.orderingVisits).toBe(0);
    // Four source reads and four billed native-origin hint lookups replace the placement scan.
    expect(after.orderingPropagation).toBe(8);
    expect(before.orderingPropagation).toBe(18);
    expect(before.orderingVisits).toBe(14);
    expect(before.stringifyCalls).toBe(0);
    expect(after.stringifyCalls).toBe(0);
    expect(after.stringifyVisits).toBe(0);
    console.info("ordering-operation-counts", {
      after: {
        duplicateVisits: after.orderingVisits,
        propagation: after.orderingPropagation,
        stringifyCalls: after.stringifyCalls,
        stringifyVisits: after.stringifyVisits,
      },
      before: {
        duplicateVisits: before.orderingVisits,
        propagation: before.orderingPropagation,
        stringifyCalls: before.stringifyCalls,
        stringifyVisits: before.stringifyVisits,
      },
    });
    expect(before.orderingPropagation! - after.orderingPropagation!).toBe(
      before.orderingVisits - 4,
    );
  });

  it("preserves zero contact width and empty fixed-catalogue ordering and output", () => {
    const { exit, fixed, rider } = profiles();
    expect(exit.placements.some(({ lanes }) => lanes.count === 0)).toBe(true);
    expect(fixed.placements).toEqual([]);
    const pools = [[exit], [fixed], [rider]];
    const before = scanned(pools);
    const after = run(pools);
    expect(after.result).toEqual(before.result);
    expect(after.result.status).toBe("compatible");
    expect(after.calls).toEqual(before.calls);
    expect(after.calls[0]).toBe("job:2:rider");
    expect(after.orderingVisits).toBe(0);
  });

  it.each(["foreign", "stale"] as const)(
    "preserves the source universe for %s preparations",
    (kind) => {
      const { following } = profiles();
      const input = kind === "foreign" ? { ...following } : following;
      if (kind === "stale") {
        Object.defineProperty(following.source, "weight", { value: 9 });
      }
      const before = scanned([[input]]);
      const after = run([[input]]);
      expect(after.result).toEqual(before.result);
      expect(after.calls).toEqual(before.calls);
      // Foreign wrappers retain both old scans; an original native hint may remain stale.
      expect(after.orderingVisits).toBe(kind === "foreign" ? before.orderingVisits : 0);
      expect(after.orderingPropagation).toBe(
        before.orderingPropagation! + (kind === "foreign" ? 2 : 1 - input.placements.length),
      );
      expect(after.stringifyCalls).toBe(0);
    },
  );

  it("returns budget and restores root when the native guard or fallback scan is interrupted", () => {
    const { following } = profiles();
    const native = run([[following]], 1);
    expect(native.result).toEqual({ status: "budget" });
    expect(native.calls).toEqual([]);
    expect(native.propagation).toBe(2);
    expect(native.orderingVisits).toBe(0);
    const foreign = run([[{ ...following }]], 2);
    expect(foreign.result).toEqual({ status: "budget" });
    expect(foreign.calls).toEqual([]);
    expect(foreign.propagation).toBe(3);
    expect(foreign.orderingVisits).toBe(1);
  });
});
