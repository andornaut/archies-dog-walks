import { describe, expect, it, vi } from "vitest";

import * as laneAlternatives from "./laneAlternatives.ts";
import * as moverPlanning from "./moverPlanning.ts";
import { createSlotCandidateDomains } from "./slotCandidateDomains.ts";
import {
  compileSlotKindDomain,
  createSlotPathProjection,
  isNativeSlotPreparation,
  prepareSlotKind,
  prepareSlotKindWithin,
  slotPlacementsAt,
} from "./slotCandidates.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";

function inputs(kind: "cross" | "ride" = "ride") {
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
    zoneLength: 2000,
  };
  const streams = { movers: vi.fn(() => 0.6), spawns: vi.fn(() => 0.4) };
  const source = {
    compile: vi.fn(() => ({
      blocksLane: true,
      mover: {
        footprint: { lanes: 1, rows: 1 },
        motion:
          kind === "ride"
            ? { kind, speedMultiplier: 1.5 }
            : {
                kind,
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
        movement: kind === "ride" ? ("inLane" as const) : ("dart" as const),
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0.2 },
        warningSeconds: 0,
      },
    })),
    footprint: { lanes: 1, rows: 1 },
    kind,
    role: "minorMoving" as const,
    weight: 1,
  };
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: 4,
  }));
  const prepare = (template = vi.fn(() => true)) => {
    const result = prepareSlotKindWithin({ template }, streams, geometry, source);
    if (result.status !== "complete") {
      throw Error("Expected a complete native producer");
    }
    return result.prepared;
  };
  return { geometry, path, prepare, source, streams };
}
function fixture(kind: "cross" | "ride" = "ride") {
  const input = inputs(kind);
  const template = vi.fn(() => true);
  const prepared = input.prepare(template);
  const projection = createSlotPathProjection(input.geometry, input.path);
  const propagation = vi.fn(() => true);
  const tiers = projection.motionTiers({ propagate: propagation }, prepared);
  if (tiers.status !== "tiers") {
    throw Error(`Expected producer draw tiers, received ${tiers.status}`);
  }
  const selected = tiers.members[0]!;
  const count = prepared.placements.filter((placement) => selected.has(placement)).length;
  const anchor = { distance: input.path[4]!.distance, lane: 0, row: 4, slot: 0 };
  return { ...input, anchor, count, prepared, projection, propagation, selected, template, tiers };
}

describe("native producer motion indexing", () => {
  it.each(["cross", "ride"] as const)(
    "fuses %s membership into unchanged retention work and preserves every aliased occurrence",
    (kind) => {
      const native = moverPlanning.moverPlacementsWithWork;
      const alias = vi
        .spyOn(moverPlanning, "moverPlacementsWithWork")
        .mockImplementation((...args) => {
          const placements = native(...args);
          return placements.length > 1
            ? [placements[0]!, placements[1]!, placements[0]!, ...placements.slice(2)]
            : placements;
        });
      const retain = vi.spyOn(laneAlternatives, "moverLeavesMinimumLanes");
      try {
        const actual = fixture(kind);
        const visits = retain.mock.calls.length;
        retain.mockClear();
        const baselineWork = { beforePlacement: vi.fn() };
        const rebuilt = compileSlotKindDomain(baselineWork, actual.geometry, actual.prepared);
        expect(rebuilt).toEqual(actual.prepared);
        expect(baselineWork.beforePlacement).toHaveBeenCalledTimes(
          actual.template.mock.calls.length,
        );
        expect(retain).toHaveBeenCalledTimes(visits);
        expect(isNativeSlotPreparation(rebuilt)).toBe(false);
        expect(actual.propagation).not.toHaveBeenCalled();
        expect(actual.projection.statistics()).toMatchObject({
          membershipBuilds: 0,
          membershipVisits: 0,
        });
        expect(actual.tiers.draws[0]).toBe(actual.prepared.draws);
        expect(actual.count).toBeGreaterThan(actual.selected.size);
        const draws = actual.prepared.placements.map((placement) => placement.selection!.draws);
        const expectedDraws = [...new Set([actual.prepared.draws!, ...draws])];
        expect(actual.tiers.draws).toEqual(expectedDraws);
        actual.tiers.draws.forEach((draw, tier) => {
          expect([...actual.tiers.members[tier]!]).toEqual([
            ...new Set(
              actual.prepared.placements.filter((placement) => placement.selection!.draws === draw),
            ),
          ]);
        });
        const copies = vi.fn(() => true);
        const viewed = actual.projection.view(
          { propagate: copies },
          actual.prepared,
          actual.selected,
        );
        expect(viewed.status).toBe("view");
        expect(copies).toHaveBeenCalledTimes(actual.count + 1);
        if (viewed.status !== "view") {
          throw Error("Expected a producer range view");
        }
        const expected = slotPlacementsAt(actual.geometry, actual.anchor, actual.prepared).filter(
          (entry) => actual.selected.has(entry.placement!),
        );
        const translated = actual.projection.at(
          { check: () => true, propagate: () => true },
          actual.anchor,
          actual.prepared,
          viewed.view,
        );
        expect(translated).toEqual({ entries: expected, status: "entries" });
        if (translated.status !== "entries") {
          throw Error("Expected native entries");
        }
        translated.entries.forEach((entry, ordinal) =>
          expect(entry.placement).toBe(expected[ordinal]!.placement),
        );
        expect(actual.projection.statistics().membershipVisits).toBe(0);
        expect(actual.source.compile).toHaveBeenCalledOnce();
        expect(actual.streams.movers).toHaveBeenCalledTimes(17);
        expect(actual.streams.spawns).toHaveBeenCalledTimes(4);
      } finally {
        alias.mockRestore();
        retain.mockRestore();
      }
    },
  );

  it("preserves exact draw identity when a caller attempts an equivalent-value binding replacement", () => {
    for (const metered of [false, true]) {
      const input = inputs();
      const prepared = metered
        ? input.prepare()
        : prepareSlotKind(input.streams, input.geometry, input.source);
      const placement = prepared.placements[0]!;
      const selected = placement.selection!;
      const clone = { ...selected.draws };
      const before = JSON.stringify(prepared);
      const changed = Reflect.set(selected, "draws", clone);
      expect(JSON.stringify(prepared)).toBe(before);
      const projection = createSlotPathProjection(input.geometry, input.path);
      const tiers = projection.motionTiers({ propagate: () => true }, prepared);
      if (tiers.status !== "tiers") {
        throw Error("Expected native draw groups after equivalent-value replacement attempt");
      }
      const draws = [
        ...new Set([
          prepared.draws!,
          ...prepared.placements.map((entry) => entry.selection!.draws),
        ]),
      ];
      expect(tiers.draws.length).toBe(draws.length);
      draws.forEach((draw, ordinal) => {
        expect(tiers.draws[ordinal]).toBe(draw);
        expect([...tiers.members[ordinal]!]).toEqual([
          ...new Set(prepared.placements.filter((entry) => entry.selection!.draws === draw)),
        ]);
      });
      expect(changed).toBe(false);
      expect(Object.isFrozen(selected)).toBe(true);
      expect(Object.isFrozen(selected.draws)).toBe(true);
      expect(Object.isFrozen(prepared.request.mover)).toBe(true);
    }
  });

  it("keeps copied selectors and unmetered preparations on the complete paid index", () => {
    const actual = fixture();
    const selected = new Set(actual.selected);
    expect(
      actual.projection.view({ propagate: () => true }, actual.prepared, selected).status,
    ).toBe("view");
    expect(actual.projection.statistics()).toMatchObject({
      membershipBuilds: 1,
      membershipVisits: actual.prepared.placements.length,
    });
    expect(
      actual.projection.view({ propagate: () => true }, { ...actual.prepared }, actual.selected),
    ).toEqual({ status: "unknown" });
    const other = fixture();
    expect(
      actual.projection.view({ propagate: () => true }, other.prepared, actual.selected),
    ).toEqual({ status: "unknown" });
    const unmetered = inputs();
    const prepared = prepareSlotKind(unmetered.streams, unmetered.geometry, unmetered.source);
    const projection = createSlotPathProjection(unmetered.geometry, unmetered.path);
    const propagation = vi.fn(() => true);
    expect(projection.motionTiers({ propagate: propagation }, prepared).status).toBe("tiers");
    expect(propagation).toHaveBeenCalledTimes(prepared.placements.length);
    expect(projection.statistics().membershipVisits).toBe(prepared.placements.length);
  });

  it("builds the checked alias index lazily for noncontiguous native draw groups", () => {
    const native = moverPlanning.moverRetries;
    const repeated = vi.spyOn(moverPlanning, "moverRetries").mockImplementation((spec, draws) => {
      const retries = native(spec, draws);
      return retries.length === 0 ? retries : [retries[0]!, draws, ...retries.slice(1)];
    });
    try {
      const actual = fixture();
      expect(actual.propagation).not.toHaveBeenCalled();
      const viewed = actual.projection.view(
        { propagate: () => true },
        actual.prepared,
        actual.selected,
      );
      expect(viewed.status).toBe("view");
      if (viewed.status !== "view") {
        throw Error("Expected noncontiguous producer fallback");
      }
      expect(
        actual.projection.at(
          { check: () => true, propagate: () => true },
          actual.anchor,
          actual.prepared,
          viewed.view,
        ),
      ).toEqual({
        entries: slotPlacementsAt(actual.geometry, actual.anchor, actual.prepared).filter((entry) =>
          actual.selected.has(entry.placement!),
        ),
        status: "entries",
      });
      expect(actual.projection.statistics()).toMatchObject({
        membershipBuilds: 1,
        membershipVisits: actual.prepared.placements.length,
      });
    } finally {
      repeated.mockRestore();
    }
  });

  it("keeps empty producer tiers conditional on current scope and the issuance budget", () => {
    const native = moverPlanning.moverPlacementsWithWork;
    let original: moverPlanning.MoverDraws | undefined;
    const empty = vi
      .spyOn(moverPlanning, "moverPlacementsWithWork")
      .mockImplementation((...args) => {
        original ??= args[3];
        return args[3] === original ? [] : native(...args);
      });
    try {
      const actual = fixture();
      expect(actual.count).toBe(0);
      expect(actual.propagation).not.toHaveBeenCalled();
      const propagation = vi.fn(() => true);
      expect(
        actual.projection.view({ propagate: propagation }, actual.prepared, actual.selected),
      ).toEqual({ status: "empty-view" });
      expect(propagation).toHaveBeenCalledOnce();
      expect(
        actual.projection.view({ propagate: () => false }, actual.prepared, actual.selected),
      ).toEqual({ kind: "propagation", status: "budget" });
      expect(() =>
        actual.projection.view(
          {
            propagate: () => {
              actual.path[0]!.lane = 3;
              return true;
            },
          },
          actual.prepared,
          actual.selected,
        ),
      ).toThrow(TypeError);
      expect(actual.path[0]!.lane).toBe(4);
      expect(actual.projection.statistics()).toMatchObject({
        membershipBuilds: 0,
        membershipVisits: 0,
      });
    } finally {
      empty.mockRestore();
    }
  });

  it("withholds producer facts when the final template callback changes the compile binding", () => {
    const baseline = fixture();
    const input = inputs();
    const compile = input.source.compile;
    let calls = 0;
    const prepared = input.prepare(
      vi.fn(() => {
        if (++calls === baseline.template.mock.calls.length) {
          Reflect.set(input.source, "compile", (...args: Parameters<typeof compile>) =>
            compile(...args),
          );
        }
        return true;
      }),
    );
    const projection = createSlotPathProjection(input.geometry, input.path);
    const propagation = vi.fn(() => true);
    expect(projection.motionTiers({ propagate: propagation }, prepared).status).toBe("tiers");
    expect(propagation).toHaveBeenCalledTimes(prepared.placements.length);
    expect(projection.statistics().membershipVisits).toBe(prepared.placements.length);
    const error = Error("native template callback failure");
    expect(() =>
      input.prepare(
        vi.fn(() => {
          throw error;
        }),
      ),
    ).toThrow(error);
    const template = vi.fn(() => false);
    expect(
      prepareSlotKindWithin({ template }, input.streams, input.geometry, input.source),
    ).toEqual({
      status: "budget",
    });
    expect(template).toHaveBeenCalledOnce();
  });

  it.each(["compile", "geometry", "nested", "path"] as const)(
    "rejects %s mutation at the final copy callback and publishes the unchanged view",
    (subject) => {
      const actual = fixture();
      const compile = actual.source.compile;
      const warning = actual.prepared.placements[0]!.path.warning;
      const snapshot = JSON.stringify([actual.geometry, actual.path, actual.prepared]);
      const mutate = (): boolean => {
        if (subject === "compile") {
          return Reflect.set(actual.source, "compile", (...args: Parameters<typeof compile>) =>
            compile(...args),
          );
        }
        if (subject === "nested") {
          return Reflect.set(actual.prepared.placements[0]!.path, "warning", warning + 1);
        }
        try {
          if (subject === "geometry") {
            actual.geometry.roadLength++;
          } else {
            actual.path[0]!.lane = 3;
          }
          return true;
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
          return false;
        }
      };
      let changed: boolean | undefined;
      let calls = 0;
      expect(
        actual.projection.view(
          {
            propagate: () => {
              if (++calls === actual.count + 1) {
                changed = mutate();
              }
              return true;
            },
          },
          actual.prepared,
          actual.selected,
        ).status,
      ).toBe("view");
      expect(calls).toBe(actual.count + 1);
      expect(changed).toBe(false);
      expect(JSON.stringify([actual.geometry, actual.path, actual.prepared])).toBe(snapshot);
      expect(actual.projection.motionTiers({ propagate: () => true }, actual.prepared).status).toBe(
        "tiers",
      );
      let refused = 0;
      expect(
        actual.projection.view(
          { propagate: () => ++refused <= actual.count },
          actual.prepared,
          actual.selected,
        ),
      ).toEqual({ kind: "propagation", status: "budget" });
      expect(refused).toBe(actual.count + 1);
      expect(actual.projection.statistics().membershipVisits).toBe(0);
    },
  );

  it("keeps complete-domain cardinality conditional on full traversal rather than producer tiers", () => {
    const actual = fixture("cross");
    const domains = createSlotCandidateDomains(actual.geometry, actual.path);
    const work = { anchor: () => true, check: () => true, propagate: () => true };
    const tiers = domains.motionTiers(work, actual.prepared);
    if (tiers.status !== "tiers") {
      throw Error("Expected producer tiers");
    }
    const order = { columnStart: 0, columns: actual.prepared.columns, rows: [1, 2] };
    const frontiers = tiers.tiers.flatMap((motionTier) => {
      const selectedOrder = { ...order, motionTier };
      const candidates = [
        ...domains.frontierSequence(work, selectedOrder, "native", actual.prepared),
      ];
      expect(
        domains.completedCardinality(selectedOrder, "native", actual.prepared),
      ).toBeUndefined();
      return candidates.flatMap((step) => (step.status === "candidate" ? [step.candidate] : []));
    });
    expect(domains.completedCardinality(order, "native", actual.prepared)).toBeUndefined();
    const full = [...domains.sequence(work, order, "native", actual.prepared)].flatMap((step) =>
      step.status === "candidate" ? [step.candidate] : [],
    );
    expect(frontiers.map(({ id }) => id).sort()).toEqual(full.map(({ id }) => id).sort());
    expect(domains.completedCardinality(order, "native", actual.prepared)).toBe(
      new Set(full.map(({ id }) => id)).size,
    );
  });
});
