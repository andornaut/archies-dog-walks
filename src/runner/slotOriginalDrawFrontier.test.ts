import { describe, expect, it, vi } from "vitest";

import * as moverPlanning from "./moverPlanning.ts";
import { createSlotCandidateDomains, type SlotCandidateOrder } from "./slotCandidateDomains.ts";
import { createSlotPathProjection, prepareSlotKind, slotPlacementsAt } from "./slotCandidates.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import { constructSlotWitness, type SlotWitnessConstructPorts } from "./slotWitnessConstruct.ts";
import type { WitnessJob } from "./slotWitnessSearch.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";

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
  zoneLength: 500,
};
function fixture() {
  const movers = vi.fn(() => 0.5),
    spawns = vi.fn(() => 0.5),
    compile = vi.fn(() => ({
      blocksLane: true,
      first: true,
      mover: {
        footprint: { lanes: 1, rows: 1 },
        motion: {
          kind: "cross" as const,
          lanesPerSecond: 2,
          reactionSeconds: 0,
          startRoadShare: [0, 0] as const,
          stopLanes: { max: 2, min: 2 },
          stopShare: 1,
          tilt: [0, 0] as const,
          turnAtShare: [0.5, 0.5] as const,
          turnBackShare: 0,
          vergeShare: 0,
        },
        movement: "dart" as const,
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0.2 },
        warningSeconds: 0,
      },
    }));
  const prepared = prepareSlotKind({ movers, spawns }, geometry, {
    compile,
    footprint: { lanes: 1, rows: 1 },
    kind: "dart",
    role: "minorMoving",
    weight: 1,
  });
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: 4,
  }));
  const domains = createSlotCandidateDomains(geometry, path);
  const state = createSlotConstructionState(geometry, path);
  const work = {
    anchor: vi.fn(() => true),
    check: vi.fn(() => true),
    propagate: vi.fn(() => true),
  };
  const job: WitnessJob<string> = {
    columnPick: () => 0,
    fixed: false,
    guaranteed: true,
    key: "dart",
    laneEffect: "possible",
    ordinal: 0,
    phase: "active",
    preparations: () => [prepared],
    total: 1,
  };
  type Mark = ReturnType<typeof state.checkpoint>;
  const ports: SlotWitnessConstructPorts<string, Mark> = {
    candidates: (owner, source, order) =>
      order.motionTier === undefined
        ? domains.sequence(work, order, owner.key, source)
        : domains.frontierSequence(work, order, owner.key, source),
    checkpoint: state.checkpoint,
    complete: state.checkComplete,
    entries: state.entries,
    motionTiers: (source) => domains.motionTiers(work, source),
    preparations: (owner) => owner.preparations(),
    propagate: work.propagate,
    restore: state.restore,
    test: (owner, candidate) => state.commit(owner, candidate.entry),
  };
  return { compile, domains, job, movers, path, ports, prepared, spawns, state, work };
}

describe("original draw native frontiers", () => {
  it("retains the complete native occurrence multiset and every lift without minting tier EOF proof", () => {
    const { compile, domains, job, movers, prepared, spawns, work } = fixture();
    const snapshot = JSON.stringify(prepared);
    const draws = [movers.mock.calls.length, spawns.mock.calls.length];
    const frontiers = domains.motionTiers(work, prepared);
    expect(frontiers.status).toBe("tiers");
    if (frontiers.status !== "tiers") {
      throw Error("Expected native draw frontiers");
    }
    expect(frontiers.tiers.length).toBeGreaterThan(1);
    expect(frontiers.draws[0]).toBe(prepared.draws);
    const order = { columnStart: 0, columns: prepared.columns, rows: [1, 2] };
    const tiered = frontiers.tiers.flatMap((motionTier) => {
      const tierOrder = { ...order, motionTier };
      const steps = [...domains.frontierSequence(work, tierOrder, job.key, prepared)];
      expect(steps.every(({ status }) => status === "candidate")).toBe(true);
      expect(domains.completedCardinality(tierOrder, job.key, prepared)).toBeUndefined();
      return steps.flatMap((step) => (step.status === "candidate" ? [step.candidate] : []));
    });
    expect(domains.completedCardinality(order, job.key, prepared)).toBeUndefined();
    const full = [...domains.sequence(work, order, job.key, prepared)].flatMap((step) =>
      step.status === "candidate" ? [step.candidate] : [],
    );
    expect(full.length).toBeGreaterThan(0);
    expect(tiered.map(({ id }) => id).sort()).toEqual(full.map(({ id }) => id).sort());
    for (const candidate of tiered) {
      expect(full).toContain(candidate);
      expect(candidate.entry.trace.requestedDraws).toBe(prepared.draws);
    }
    const originalLifts = new Set(
      full
        .filter(({ entry }) => entry.placement?.selection?.draws === prepared.draws)
        .map(({ entry }) => entry.placement!.selection!.lift),
    );
    const firstTierLifts = new Set(
      tiered
        .filter(({ entry }) => entry.placement?.selection?.draws === frontiers.draws[0])
        .map(({ entry }) => entry.placement!.selection!.lift),
    );
    expect(originalLifts.size).toBeGreaterThan(1);
    expect(firstTierLifts).toEqual(originalLifts);
    expect(domains.completedCardinality(order, job.key, prepared)).toBe(
      new Set(full.map(({ id }) => id)).size,
    );
    expect([movers.mock.calls.length, spawns.mock.calls.length]).toEqual(draws);
    expect(compile).toHaveBeenCalledOnce();
    expect(JSON.stringify(prepared)).toBe(snapshot);
  });

  it("keeps interrupted membership work charged and resumes without caching a partial view", () => {
    const { domains, job, path, prepared, work } = fixture();
    expect(domains.motionTiers(work, { ...prepared, herring: true })).toEqual({
      status: "unknown",
    });
    expect(
      domains.motionTiers(work, {
        ...prepared,
        placements: [{ ...prepared.placements[0]!, rank: 1 }],
      }),
    ).toEqual({ status: "unknown" });
    expect(domains.motionTiers({ ...work, propagate: () => false }, prepared)).toEqual({
      status: "budget",
    });
    const frontiers = domains.motionTiers(work, prepared);
    expect(frontiers.status).toBe("tiers");
    const order = { columnStart: 0, columns: prepared.columns, motionTier: 0, rows: [1] };
    const before = domains.statistics();
    let remaining = 3;
    const propagate = vi.fn(() => remaining-- > 0);
    expect([...domains.frontierSequence({ ...work, propagate }, order, job.key, prepared)]).toEqual(
      [{ kind: "propagation", status: "budget" }],
    );
    expect(propagate).toHaveBeenCalledTimes(4);
    expect(domains.statistics().expansions).toBe(before.expansions);
    expect(domains.completedCardinality(order, job.key, prepared)).toBeUndefined();
    const resumed = [...domains.frontierSequence(work, order, job.key, prepared)];
    expect(resumed.some(({ status }) => status === "candidate")).toBe(true);
    const warning = prepared.placements[0]!.path.warning;
    expect(Reflect.set(prepared.placements[0]!.path, "warning", warning + 1)).toBe(false);
    expect(prepared.placements[0]!.path.warning).toBe(warning);
    expect([...domains.frontierSequence(work, order, job.key, prepared)]).toEqual(resumed);
    const emptyOrder = { ...order, rows: [path.length - 1] };
    expect([...domains.frontierSequence(work, emptyOrder, job.key, prepared)]).toEqual([]);
  });

  it("visits original draws at later anchors before retry draws while default traversal stays unchanged", () => {
    for (const originalDrawsFirst of [false, true]) {
      const { job, path, ports, prepared, state } = fixture();
      const selected = constructSlotWitness(
        {
          ...ports,
          originalDrawsFirst,
          test(owner, candidate) {
            const row = candidate.entry.trace.placement!.block.row;
            if (row !== 1 && candidate.entry.placement?.selection?.draws === prepared.draws) {
              return {
                accepted: false,
                failure: { classification: "conflict", owners: [], rule: "fixture-anchor" },
              };
            }
            return ports.test(owner, candidate);
          },
        },
        geometry,
        path,
        [job],
      );
      expect(selected.status).toBe("compatible");
      if (selected.status !== "compatible") {
        throw Error("Expected native complete witness");
      }
      const entry = selected.witness[0]!.entry;
      expect(entry.trace.placement!.selection!.draws === prepared.draws).toBe(originalDrawsFirst);
      expect(entry.trace.requestedDraws).toBe(prepared.draws);
      expect(createSlotConstructionState(geometry, path, selected.witness).checkComplete()).toEqual(
        { accepted: true },
      );
      expect(state.entries()).toEqual([]);
    }
  });

  it("resumes the full native source when a tier view becomes unavailable", () => {
    const { job, path, ports, state } = fixture();
    const orders: (number | undefined)[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        *candidates(owner, source, order) {
          orders.push(order.motionTier);
          if (order.motionTier !== undefined) {
            yield { status: "unavailable" };
            return;
          }
          yield* ports.candidates(owner, source, order);
        },
        originalDrawsFirst: true,
      },
      geometry,
      path,
      [job],
    );
    expect(result.status).toBe("compatible");
    expect(orders).toEqual([0, undefined]);
    if (result.status !== "compatible") {
      throw Error("Expected native fallback witness");
    }
    expect(createSlotConstructionState(geometry, path, result.witness).checkComplete()).toEqual({
      accepted: true,
    });
    expect(state.entries()).toEqual([]);
  });

  it.each([false, true])(
    "drains original unsafe fallback before opening a retry tier with fair sources %s",
    (fairSources) => {
      const { job, path, ports, prepared, state } = fixture();
      const orders: SlotCandidateOrder[] = [];
      const result = constructSlotWitness(
        {
          ...ports,
          candidates(owner, source, order) {
            orders.push(order);
            return ports.candidates(owner, source, order);
          },
          fairSources,
          laneClosure: () => ({
            accepted: false,
            failure: { classification: "conflict", owners: [], rule: "fixture-closure" },
          }),
          originalDrawsFirst: true,
        },
        geometry,
        path,
        [job],
      );
      expect(result.status).toBe("compatible");
      expect(orders.length).toBeGreaterThan(0);
      expect(orders.every(({ motionTier }) => motionTier === 0)).toBe(true);
      if (result.status !== "compatible") {
        throw Error("Expected native unsafe fallback witness");
      }
      expect(result.witness[0]!.entry.trace.placement!.selection!.draws).toBe(prepared.draws);
      expect(state.entries()).toEqual([]);
    },
  );
  it("builds native draw groups and every alias ordinal in one shared traversal", () => {
    const native = moverPlanning.moverPlacementsWithWork;
    const repeated = vi
      .spyOn(moverPlanning, "moverPlacementsWithWork")
      .mockImplementation((...args) => {
        const values = native(...args);
        return values.length > 1
          ? [values[0]!, values[1]!, values[0]!, ...values.slice(2), values[1]!]
          : values;
      });
    try {
      const { path, prepared } = fixture();
      const snapshot = JSON.stringify(prepared);
      const projection = createSlotPathProjection(geometry, path);
      const propagate = vi.fn(() => true);
      const indexed = projection.motionTiers({ propagate }, prepared);
      expect(indexed.status).toBe("tiers");
      expect(propagate).toHaveBeenCalledTimes(prepared.placements.length);
      expect(projection.statistics()).toMatchObject({
        membershipBuilds: 1,
        membershipVisits: prepared.placements.length,
      });
      if (indexed.status !== "tiers") {
        throw Error("Expected fused native index");
      }
      expect(indexed.draws[0]).toBe(prepared.draws);
      expect(indexed.draws).toEqual([
        ...new Set([
          prepared.draws,
          ...prepared.placements.map((value) => value.selection?.draws ?? prepared.draws),
        ]),
      ]);
      const aliases = prepared.placements.filter((value) => value === prepared.placements[0]);
      expect(aliases.length).toBeGreaterThan(1);
      const selected = new Set([prepared.placements.at(-1)!, prepared.placements[0]!]);
      const issued = projection.view({ propagate }, prepared, selected);
      expect(issued.status).toBe("view");
      if (issued.status !== "view") {
        throw Error("Expected native alias view");
      }
      const anchor = {
        distance: path[1]!.distance,
        lane: prepared.placements[0]!.lane,
        row: 1,
        slot: 0,
      };
      const viewed = projection.at({ check: () => true, propagate }, anchor, prepared, issued.view);
      const expected = slotPlacementsAt(geometry, anchor, prepared).filter((entry) =>
        selected.has(entry.placement!),
      );
      expect(expected.length).toBeGreaterThan(1);
      expect(viewed).toEqual({ entries: expected, status: "entries" });
      expect(projection.statistics().membershipVisits).toBe(prepared.placements.length);
      const warm = vi.fn(() => false);
      expect(projection.motionTiers({ propagate: warm }, prepared)).toEqual(indexed);
      expect(warm).not.toHaveBeenCalled();
      expect(projection.statistics().nativeChecks).toBeGreaterThan(0);
      expect(JSON.stringify(prepared)).toBe(snapshot);
    } finally {
      repeated.mockRestore();
    }
  });

  it("reuses an arbitrary selected-reference index when motion tiers are requested later", () => {
    const { path, prepared } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    const selected = prepared.placements[0]!;
    expect(projection.view({ propagate: () => true }, prepared, new Set([selected])).status).toBe(
      "view",
    );
    const propagate = vi.fn(() => false);
    expect(projection.motionTiers({ propagate }, prepared).status).toBe("tiers");
    expect(propagate).not.toHaveBeenCalled();
    expect(projection.statistics()).toMatchObject({
      membershipBuilds: 1,
      membershipVisits: prepared.placements.length,
    });
  });

  it("discards both incomplete structures at the last charge boundary and retains spent work", () => {
    const { path, prepared } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    let remaining = prepared.placements.length - 1;
    const refused = vi.fn(() => remaining-- > 0);
    expect(projection.motionTiers({ propagate: refused }, prepared)).toEqual({
      kind: "propagation",
      status: "budget",
    });
    expect(refused).toHaveBeenCalledTimes(prepared.placements.length);
    expect(projection.statistics()).toMatchObject({
      membershipBuilds: 0,
      membershipVisits: prepared.placements.length - 1,
    });
    const complete = vi.fn(() => true);
    expect(projection.motionTiers({ propagate: complete }, prepared).status).toBe("tiers");
    expect(complete).toHaveBeenCalledTimes(prepared.placements.length);
    expect(projection.statistics()).toMatchObject({
      membershipBuilds: 1,
      membershipVisits: 2 * prepared.placements.length - 1,
    });
    const exact = createSlotPathProjection(geometry, path);
    let allowance = prepared.placements.length;
    const boundary = vi.fn(() => allowance-- > 0);
    expect(exact.motionTiers({ propagate: boundary }, prepared).status).toBe("tiers");
    expect(boundary).toHaveBeenCalledTimes(prepared.placements.length);
  });

  it("publishes no index after callback interruption and rejects a source change during the traversal", () => {
    const { path, prepared } = fixture();
    const projection = createSlotPathProjection(geometry, path);
    const interrupted = vi.fn(() => {
      throw Error("fixture-interruption");
    });
    expect(() => projection.motionTiers({ propagate: interrupted }, prepared)).toThrow(
      "fixture-interruption",
    );
    expect(projection.statistics().membershipBuilds).toBe(0);
    const compile = prepared.source.compile;
    let calls = 0;
    let replaced: boolean | undefined;
    expect(
      projection.motionTiers(
        {
          propagate: () => {
            if (++calls === prepared.placements.length) {
              replaced = Reflect.set(
                prepared.source,
                "compile",
                (...args: Parameters<typeof compile>) => compile(...args),
              );
            }
            return true;
          },
        },
        prepared,
      ).status,
    ).toBe("tiers");
    expect(calls).toBe(prepared.placements.length);
    expect(replaced).toBe(false);
    expect(prepared.source.compile).toBe(compile);
    expect(projection.statistics().membershipBuilds).toBe(1);
  });

  it("keeps shared indices warm while the frozen source and context reject changes", () => {
    const { domains, path, prepared, work } = fixture();
    expect(domains.motionTiers(work, prepared).status).toBe("tiers");
    expect(() => {
      path[0]!.lane = 3;
    }).toThrow(TypeError);
    const warning = prepared.placements[0]!.path.warning;
    expect(Reflect.set(prepared.placements[0]!.path, "warning", warning + 1)).toBe(false);
    work.propagate.mockClear();
    expect(domains.motionTiers(work, prepared).status).toBe("tiers");
    expect(work.propagate).not.toHaveBeenCalled();
    expect(domains.motionTiers(work, { ...prepared })).toEqual({ status: "unknown" });
  });
});
