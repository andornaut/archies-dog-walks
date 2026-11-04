import { describe, expect, it, vi } from "vitest";

import type { MoverDraws, MoverPlacement } from "./moverModel.ts";
import * as moverPlanning from "./moverPlanning.ts";
import { createSlotPathProjection, prepareSlotKind, slotPlacementsAt } from "./slotCandidates.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";

function fixture() {
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
    moverCaps: { darts: 2, slowVehicles: 2, total: 4 },
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
        motion: { kind: "ride" as const, speedMultiplier: 1.5 },
        movement: "inLane" as const,
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0.2 },
        warningSeconds: 0,
      },
    })),
    footprint: { lanes: 1, rows: 1 },
    kind: "rider",
    role: "minorMoving" as const,
    weight: 1,
  };
  const prepared = prepareSlotKind(streams, geometry, source);
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: 4,
  }));
  const projection = createSlotPathProjection(geometry, path);
  const built = projection.motionTiers({ propagate: () => true }, prepared);
  if (built.status !== "tiers") {
    throw Error(`Expected native draw groups, received ${built.status}`);
  }
  const selected = built.members[0]!;
  const count = prepared.placements.filter((placement) => selected.has(placement)).length;
  const anchor = { distance: path[4]!.distance, lane: 0, row: 4, slot: 0 };
  return { anchor, built, count, geometry, path, prepared, projection, selected, source, streams };
}

describe("native whole-profile motion ranges", () => {
  it("reuses a contiguous native draw group while billing every copied alias occurrence", () => {
    const native = moverPlanning.moverPlacementsWithWork;
    const repeated = vi
      .spyOn(moverPlanning, "moverPlacementsWithWork")
      .mockImplementation((...args) => {
        const placements = native(...args);
        return placements.length > 1
          ? [placements[0]!, placements[1]!, placements[0]!, ...placements.slice(2), placements[1]!]
          : placements;
      });
    try {
      const { anchor, count, geometry, prepared, projection, selected, source, streams } =
        fixture();
      const before = JSON.stringify(prepared);
      const draws = [streams.movers.mock.calls.length, streams.spawns.mock.calls.length];
      const propagate = vi.fn(() => true);
      const result = projection.view({ propagate }, prepared, selected);
      expect(result.status).toBe("view");
      expect(propagate).toHaveBeenCalledTimes(count + 1);
      expect(count).toBeGreaterThan(selected.size);
      expect(projection.statistics().membershipVisits).toBe(prepared.placements.length);
      if (result.status !== "view") {
        throw Error("Expected native range view");
      }
      const expected = slotPlacementsAt(geometry, anchor, prepared).filter((entry) =>
        selected.has(entry.placement!),
      );
      expect(expected.length).toBeGreaterThan(1);
      expect(expected[0]).toBe(expected[1]);
      const viewed = projection.at(
        { check: () => true, propagate: () => true },
        anchor,
        prepared,
        result.view,
      );
      expect(viewed).toEqual({ entries: expected, status: "entries" });
      if (viewed.status !== "entries") {
        throw Error("Expected native range entries");
      }
      expect(viewed.entries[0]).toBe(viewed.entries[1]);
      viewed.entries.forEach((entry, ordinal) =>
        expect(entry.placement).toBe(expected[ordinal]!.placement),
      );
      expect(JSON.stringify(prepared)).toBe(before);
      expect(source.compile).toHaveBeenCalledTimes(1);
      expect([streams.movers.mock.calls.length, streams.spawns.mock.calls.length]).toEqual(draws);
    } finally {
      repeated.mockRestore();
    }
  });

  it("uses the checked selector fallback for copied or noncontiguous native member sets", () => {
    const { count, prepared, projection, selected } = fixture();
    const iterate = vi.fn(() => selected[Symbol.iterator]());
    const copied = { ...selected, [Symbol.iterator]: iterate };
    const propagate = vi.fn(() => true);
    expect(projection.view({ propagate }, prepared, copied).status).toBe("view");
    expect(iterate).toHaveBeenCalledTimes(1);
    expect(propagate.mock.calls.length).toBeGreaterThan(count + 1);
    expect(projection.view({ propagate }, { ...prepared }, selected)).toEqual({
      status: "unknown",
    });
    const native = moverPlanning.moverRetries;
    const repeated = vi.spyOn(moverPlanning, "moverRetries").mockImplementation((spec, draws) => {
      const retries = native(spec, draws);
      return retries.length === 0 ? retries : [retries[0]!, draws, ...retries.slice(1)];
    });
    try {
      const other = fixture();
      const calls = vi.fn(() => true);
      const result = other.projection.view({ propagate: calls }, other.prepared, other.selected);
      expect(result.status).toBe("view");
      expect(calls.mock.calls.length).toBeGreaterThan(other.count + 1);
      if (result.status !== "view") {
        throw Error("Expected noncontiguous native selector fallback");
      }
      expect(
        other.projection.at(
          { check: () => true, propagate: () => true },
          other.anchor,
          other.prepared,
          result.view,
        ),
      ).toEqual({
        entries: slotPlacementsAt(other.geometry, other.anchor, other.prepared).filter((entry) =>
          other.selected.has(entry.placement!),
        ),
        status: "entries",
      });
    } finally {
      repeated.mockRestore();
    }
  });

  it("retains copy charges on interruption without publishing a partial view or rebuilding the complete index", () => {
    const { count, prepared, projection, selected } = fixture();
    let calls = 0;
    const refused = vi.fn(() => ++calls <= count);
    expect(projection.view({ propagate: refused }, prepared, selected)).toEqual({
      kind: "propagation",
      status: "budget",
    });
    expect(refused).toHaveBeenCalledTimes(count + 1);
    const complete = vi.fn(() => true);
    expect(projection.view({ propagate: complete }, prepared, selected).status).toBe("view");
    expect(complete).toHaveBeenCalledTimes(count + 1);
    expect(projection.statistics()).toMatchObject({
      membershipBuilds: 1,
      membershipVisits: prepared.placements.length,
    });
    const error = Error("native copy interruption");
    expect(() =>
      projection.view(
        {
          propagate: () => {
            throw error;
          },
        },
        prepared,
        selected,
      ),
    ).toThrow(error);
  });

  it("rejects a source replacement in the final native-copy callback and still publishes the view", () => {
    const { count, prepared, projection, selected, source } = fixture();
    const compile = source.compile;
    let calls = 0;
    let replaced: boolean | undefined;
    const result = projection.view(
      {
        propagate: () => {
          if (++calls === count + 1) {
            replaced = Reflect.set(source, "compile", (...args: Parameters<typeof compile>) =>
              compile(...args),
            );
          }
          return true;
        },
      },
      prepared,
      selected,
    );
    expect(calls).toBe(count + 1);
    expect(replaced).toBe(false);
    expect(source.compile).toBe(compile);
    expect(result.status).toBe("view");
  });

  it("rejects a path change in the selector callback before publishing ordering facts", () => {
    for (const empty of [false, true]) {
      const { path, prepared, projection, selected } = fixture();
      const refs = new Set(empty ? [] : selected);
      const iterate = refs[Symbol.iterator].bind(refs);
      Object.defineProperty(refs, Symbol.iterator, {
        *value() {
          yield* iterate();
          path[0]!.lane = 3;
        },
      });
      expect(() => projection.view({ propagate: () => true }, prepared, refs)).toThrow(TypeError);
      expect(path[0]!.lane).toBe(4);
      expect(
        projection.view({ propagate: () => true }, prepared, new Set<MoverPlacement>()).status,
      ).toBe("empty-view");
    }
  });

  it("keeps an empty native draw group conditional on its scope and rejects a path change", () => {
    const native = moverPlanning.moverPlacementsWithWork;
    let original: MoverDraws | undefined;
    const empty = vi
      .spyOn(moverPlanning, "moverPlacementsWithWork")
      .mockImplementation((...args) => {
        original ??= args[3];
        return args[3] === original ? [] : native(...args);
      });
    try {
      const { count, path, prepared, projection, selected } = fixture();
      expect(count).toBe(0);
      const propagate = vi.fn(() => true);
      expect(projection.view({ propagate }, prepared, selected)).toEqual({ status: "empty-view" });
      expect(propagate).toHaveBeenCalledOnce();
      expect(projection.view({ propagate: () => false }, prepared, selected)).toEqual({
        kind: "propagation",
        status: "budget",
      });
      expect(() =>
        projection.view(
          {
            propagate: () => {
              path[0]!.lane = 3;
              return true;
            },
          },
          prepared,
          selected,
        ),
      ).toThrow(TypeError);
      expect(path[0]!.lane).toBe(4);
      expect(projection.statistics().indexedTemplates).toBe(0);
    } finally {
      empty.mockRestore();
    }
  });
});
