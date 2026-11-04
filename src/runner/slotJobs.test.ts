import { describe, expect, it, vi } from "vitest";

import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates";
import { type SlotSource } from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import type { SlotJob } from "./slotJobs";
import { materialiseSlotPlan } from "./slotPlan";
import { blockingSpan, rowSpacing, type SpawnPlan, zoneRows } from "./spawning";
import { auditSpawnPlan } from "./spawnValidation";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
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
  zoneLength: 1000,
};
const spacing = rowSpacing({ ...geometry, quotas: [] });
const path = zoneRows(geometry, spacing).map((distance) => ({ distance, lane: 0 }));
const streams = () => ({ movers: () => 0.9, spawns: () => 0.9 });
const fixed = (kind: string, lanes: number, rows = 1, blocksLane = true) =>
  prepareSlotKind(streams(), geometry, {
    compile: () => ({ blocksLane, first: true, footprint: { lanes, rows } }),
    footprint: { lanes, rows },
    kind,
    role: "minorFixed",
    weight: 1,
  });
const jobOf = (source: SlotSource<string>): SlotJob<string> => ({
  guaranteed: true,
  key: source.kind,
  laneEffect: "possible",
  ordinal: 0,
  phase: "active",
  role: source.role,
  sources: [source],
  total: 1,
});
const at = (prepared: ReturnType<typeof fixed>, row: number, lane: number) =>
  slotPlacementsAt(geometry, { distance: path[row]!.distance, lane, row, slot: 0 }, prepared)[0]!;

function sharingPrefix() {
  const wall = fixed("wall", 1);
  const dart = prepareSlotKind(streams(), geometry, {
    compile: () => ({
      blocksLane: true,
      first: true,
      mover: {
        footprint: { lanes: 1, rows: 1 },
        motion: {
          kind: "cross",
          lanesPerSecond: 2,
          reactionSeconds: 0,
          startRoadShare: [0, 0],
          stopLanes: { max: 2, min: 2 },
          stopShare: 1,
          tilt: [0, 0],
          turnAtShare: [0.5, 0.5],
          turnBackShare: 0,
          vergeShare: 0,
        },
        movement: "dart",
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
        warningSeconds: 0,
      },
    }),
    footprint: { lanes: 1, rows: 1 },
    kind: "dart",
    role: "minorMoving",
    weight: 1,
  });
  const state = createSlotConstructionState(geometry, path);
  expect(state.commit(jobOf(wall.source), at(wall, 4, 2)).accepted).toBe(true);
  expect(state.commit(jobOf(dart.source), at(dart, 4, 4)).accepted).toBe(true);
  return state;
}

describe("future native cell reservations", () => {
  it.each([false, true])(
    "counts only newly taken cells when a standing footprint shares a dart reservation (standing first %s)",
    (standingFirst) => {
      const prefix = sharingPrefix().entries();
      const wall = prefix[0]!;
      const dart = prefix[1]!;
      const taken = new Set([
        "4:2",
        ...dart.entry.trace.placement!.cells.map(({ lane, row }) => `${row}:${lane}`),
      ]);
      expect(taken.has("4:3") && taken.has("4:4")).toBe(true);
      const state = createSlotConstructionState(geometry, path);
      expect(state.commit(wall.owner, wall.entry).accepted).toBe(true);
      for (let row = 0; row < path.length; row++) {
        for (let lane = 0; lane < geometry.laneCount; lane++) {
          if (taken.has(`${row}:${lane}`)) {
            continue;
          }
          const filler = prepareSlotKind(streams(), geometry, {
            compile: () => ({
              blocksLane: false,
              first: true,
              footprint: { lanes: 1, rows: 1 },
              moversRestOn: true,
            }),
            footprint: { lanes: 1, rows: 1 },
            kind: `filler-${row}-${lane}`,
            role: "auxiliaryFixed",
            weight: 1,
          });
          expect(state.commit(jobOf(filler.source), at(filler, row, lane)).accepted).toBe(true);
        }
      }
      const wide = fixed("wide", 2);
      const standing = { entry: at(wide, 4, 3), owner: jobOf(wide.source) };
      for (const { entry, owner } of standingFirst ? [standing, dart] : [dart, standing]) {
        expect(state.commit(owner, entry).accepted).toBe(true);
      }
      expect(state.checkComplete()).toEqual({ accepted: true });
      const assignments = state.entries().map(({ entry, owner }) => {
        const role =
          entry.request.hazard === false
            ? ("auxiliaryFixed" as const)
            : entry.request.mover === undefined
              ? ("minorFixed" as const)
              : ("minorMoving" as const);
        return {
          binding: { kind: entry.event.kind, role, weight: 1 },
          entry,
          key: owner.key,
          phase: "active" as const,
          role,
        };
      });
      const materialised = materialiseSlotPlan(geometry, path, assignments);
      expect(auditSpawnPlan(materialised.plan, materialised.planned)).toMatchObject({
        missingCoverage: [],
        status: "valid",
        validPlaced: assignments.length,
        violations: [],
      });
    },
  );

  it("keeps a complete native sharing layout with a wide choice", () => {
    const state = sharingPrefix();
    const moverCells = state.entries()[1]!.entry.trace.placement!.cells;
    expect(moverCells).toEqual(
      expect.arrayContaining([
        { lane: 3, row: 4 },
        { lane: 4, row: 4 },
      ]),
    );
    const wide = fixed("wide", 2);
    const future = ["north-left", "north-right", "south-left", "south-right"].map((kind) =>
      fixed(kind, 1, 10),
    );
    expect(state.probe(jobOf(wide.source), at(wide, 0, 3)).accepted).toBe(true);
    expect(state.commit(jobOf(wide.source), at(wide, 4, 3)).accepted).toBe(true);
    for (const [index, prepared] of future.entries()) {
      expect(
        state.commit(jobOf(prepared.source), at(prepared, index < 2 ? 0 : 5, 1 + (index % 2)))
          .accepted,
      ).toBe(true);
    }
    expect(state.checkComplete()).toEqual({ accepted: true });
    const assignments = state.entries().map(({ entry, owner }) => {
      const role =
        entry.request.mover === undefined ? ("minorFixed" as const) : ("minorMoving" as const);
      return {
        binding: { kind: entry.event.kind, role, weight: 1 },
        entry,
        key: owner.key,
        phase: "active" as const,
        role,
      };
    });
    const materialised = materialiseSlotPlan(geometry, path, assignments);
    expect(auditSpawnPlan(materialised.plan, materialised.planned)).toMatchObject({
      missingCoverage: [],
      status: "valid",
      validPlaced: 7,
      violations: [],
    });
    const blocked = fixed("blocked", 2);
    expect(state.probe(jobOf(blocked.source), at(blocked, 4, 3))).toMatchObject({
      accepted: false,
      failure: { rule: "cells" },
    });
  });

  it("uses native row spans and blocking flags at the final grid boundary", () => {
    const parked = fixed("parkedCar", 1, 3);
    const parkedJob = jobOf(parked.source);
    expect(parked.source.footprint.rows).toBe(3);
    expect(blockingSpan({ ...geometry, quotas: [] }, spacing, 0, 3).lastRow + 1).toBe(2);
    const state = createSlotConstructionState(geometry, path);
    const last = path.length - 1;
    expect(state.probe(parkedJob, at(parked, last, 1))).toMatchObject({
      accepted: false,
      failure: { rule: "outside-rows" },
    });
    const passable = fixed("passable", 1, 3, false);
    expect(state.commit(jobOf(passable.source), at(passable, last, 1)).accepted).toBe(true);
  });

  it("keeps all source alternatives without compiling unknown profiles", () => {
    const compile = vi.fn(() => {
      throw new Error("Unexpected profile draw");
    });
    const source = (kind: string, lanes: number): SlotSource<string> => ({
      compile,
      footprint: { lanes, rows: 3 },
      kind,
      role: "minorFixed",
      weight: 1,
    });
    const job = { ...jobOf(source("wide", 3)), sources: [source("wide", 3), source("narrow", 1)] };
    expect(job.sources.map(({ kind }) => kind)).toEqual(["wide", "narrow"]);
    expect(compile).not.toHaveBeenCalled();
  });
});
