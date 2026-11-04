import { afterEach, describe, expect, it, vi } from "vitest";

import * as candidates from "./slotCandidates.ts";
import type { SlotPlacement } from "./slotFeasibility.ts";
import { guaranteeCompatiblePath } from "./slotPath.ts";
import { SpawnBoard } from "./spawnBoard.ts";
import * as spawning from "./spawning.ts";

const geometry: Omit<spawning.SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  firstContactSeconds: 0.5,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 2,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 0,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const streams = { movers: () => 0.5, spawns: () => 0.5 };
function fixedFixture(plan = geometry) {
  const prepared = candidates.prepareSlotKind(streams, plan, {
    compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 1, rows: 1 } }),
    footprint: { lanes: 1, rows: 1 },
    kind: "wall",
    role: "minorFixed",
    weight: 1,
  });
  const rows = spawning.zoneRows(plan, spawning.rowSpacing({ ...plan, quotas: [] }));
  expect(rows[0], "the fixture grid starts at native trace row zero").toBe(0);
  const path = rows.map((distance) => ({ distance, lane: plan.pathStart }));
  const at = (row: number, lane = plan.pathStart) =>
    candidates.slotPlacementsAt(plan, { distance: rows[row]!, lane, row, slot: 0 }, prepared)[0]!;
  return { at, path, plan, prepared };
}
function unbound(entry: SlotPlacement<string>): SlotPlacement<string> {
  return { ...entry, trace: { ...entry.trace, kind: "unbound" } };
}
function solve(
  fixture: Omit<ReturnType<typeof fixedFixture>, "at">,
  entries: readonly SlotPlacement<string>[],
  limit = 10000,
) {
  const at = vi
    .spyOn(candidates, "slotPlacementsAt")
    .mockImplementation((_plan, anchor) =>
      entries.filter(
        (entry) =>
          (entry.trace.placement?.block.row ?? entry.trace.row) === anchor.row &&
          entry.event.lane === anchor.lane,
      ),
    );
  const probe = vi.spyOn(SpawnBoard.prototype, "probe");
  let checks = 0;
  try {
    const result = guaranteeCompatiblePath(
      fixture.plan,
      fixture.path,
      Array<number>(fixture.path.length * 2).fill(0.25),
      [{ ordinal: 0, prepared: fixture.prepared, total: 1 }],
      { anchor: () => true, check: () => ++checks <= limit },
    );
    return {
      checks,
      nativeAccepted: probe.mock.results.map(({ value }) => value),
      result,
    };
  } finally {
    at.mockRestore();
    probe.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe("path transition facts", () => {
  it("reuses completed true and false transitions without changing native fallback or path ties", () => {
    const fixture = fixedFixture();
    const entry = fixture.at(4);
    const cold = solve(fixture, [entry]);
    const warm = solve(fixture, [unbound(entry), entry]);

    expect(cold.result.failedKind).toBeUndefined();
    expect(cold.result.path).not.toEqual(fixture.path);
    expect(warm.result).toEqual(cold.result);
    expect(cold.nativeAccepted).toEqual([false, true]);
    expect(warm.nativeAccepted).toEqual([false, false, false, true]);
    expect(warm.checks).toBe(cold.checks + 2);
    expect(cold.checks).toBeGreaterThan(cold.nativeAccepted.length);
  });

  it("separates changed previous/current masks and row/from/to transitions", () => {
    const fixture = fixedFixture();
    const entry = fixture.at(7);
    const cold = solve(fixture, [entry]);
    const warm = solve(fixture, [unbound(fixture.at(10)), entry]);

    expect(cold.result.failedKind).toBeUndefined();
    expect(cold.result.path).not.toEqual(fixture.path);
    expect(warm.result).toEqual(cold.result);
    expect(warm.nativeAccepted).toEqual([false, false, false, true]);
    expect(warm.checks).toBeGreaterThan(cold.checks + 2);
  });

  it("retains distinct complete reaction contexts for native multi-stand placements", () => {
    const fixture = fixedFixture({
      ...geometry,
      firstContactSeconds: 2.4,
      roadLength: 300,
      sightLength: 240,
    });
    const prepared = candidates.prepareSlotKind(streams, fixture.plan, {
      compile: () => ({
        blocksLane: true,
        first: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: {
            count: { max: 2, min: 2 },
            kind: "steps",
            sequences: [
              [
                { lanes: 1, travel: 4 },
                { lanes: -1, travel: 4 },
              ],
              [
                { lanes: 1, travel: 5 },
                { lanes: -1, travel: 3 },
              ],
            ],
            stepSeconds: 0.1,
          },
          movement: "step",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "stepper",
      role: "minorMoving",
      weight: 1,
    });
    const values = candidates.slotPlacementsAt(
      fixture.plan,
      { distance: fixture.path[4]!.distance, lane: 0, row: 4, slot: 0 },
      prepared,
    );
    const first = values[0]!;
    const second = values.find(
      (entry) =>
        JSON.stringify(entry.trace.placement!.block) ===
          JSON.stringify(first.trace.placement!.block) &&
        JSON.stringify(entry.trace.placement!.stands) !==
          JSON.stringify(first.trace.placement!.stands),
    );
    expect(
      second,
      "two native variants with equal blocking bounds and distinct stands",
    ).toBeDefined();
    const stands = second!.trace.placement!.stands;
    expect(stands.length).toBeGreaterThanOrEqual(2);
    const cold = solve({ ...fixture, prepared }, [second!]);
    const reaction = vi.spyOn(spawning, "packFitsOnPath");
    const warm = solve({ ...fixture, prepared }, [unbound(first), second!]);

    expect(cold.result.failedKind).toBeUndefined();
    expect(warm.result).toEqual(cold.result);
    expect(warm.nativeAccepted.at(-1)).toBe(true);
    expect(reaction.mock.calls.some(([, , a, b]) => stands.includes(a) && stands.includes(b))).toBe(
      true,
    );
    const reactionTimes = new Map<string, Set<number>>();
    for (const [, changes, a, b] of reaction.mock.calls) {
      if (stands.includes(a) && stands.includes(b) && changes.length === 1) {
        const { at, from, to } = changes[0]!;
        const key = `${stands.indexOf(a)}:${stands.indexOf(b)}:${from}:${to}`;
        const times = reactionTimes.get(key) ?? new Set<number>();
        times.add(at);
        reactionTimes.set(key, times);
      }
    }
    expect([...reactionTimes.values()].some((times) => times.size > 1)).toBe(true);
  });

  it("discards invocation facts after interruption and changed geometry/path contexts", () => {
    const fixture = fixedFixture();
    const entry = fixture.at(4);
    const cold = solve(fixture, [entry]);
    const limit = Math.floor(cold.checks / 2);
    const interrupted = solve(fixture, [entry], limit);
    expect(interrupted.result).toEqual({ failedKind: "wall", path: fixture.path });
    expect(interrupted.checks).toBe(limit + 1);
    expect(interrupted.nativeAccepted).toEqual([false]);
    expect(solve(fixture, [entry])).toEqual(cold);

    const changed = fixedFixture({ ...geometry, pathStart: 4, scrollSpeed: 150 });
    const other = changed.at(6);
    const changedCold = solve(changed, [other]);
    const changedWarm = solve(changed, [unbound(other), other]);
    expect(changedCold.result.failedKind).toBeUndefined();
    expect(changedWarm.result).toEqual(changedCold.result);
    expect(changedWarm.checks).toBe(changedCold.checks + 2);
    expect(changedCold.result.path[0]!.lane).toBe(4);
  });
});
