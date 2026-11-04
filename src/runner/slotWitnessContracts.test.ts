import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { GAME_ROAD } from "../testing/planner.ts";
import { assignedMovement } from "./movementAssignments.ts";
import { moverSpec } from "./moverSpecs.ts";
import { auditSlotPlan } from "./slotAudit.ts";
import { createSlotCandidateDomains } from "./slotCandidateDomains.ts";
import { prepareSlotKind } from "./slotCandidates.ts";
import type { SlotConfiguration, SlotKind } from "./slotConfig.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import { slotMotionStreams, slotRandom, type SlotSeedContext } from "./slotEntropy.ts";
import { materialiseSlotPlan, type SlotAssignment } from "./slotPlan.ts";
import {
  createSlotWitnessSearch,
  type WitnessJob,
  type WitnessSelection,
  type WitnessWork,
} from "./slotWitnessSearch.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";
import { auditSpawnPlan } from "./spawnValidation.ts";
import { itemHeight } from "./walk.ts";
import { footprintOf } from "./walkItems.ts";

type Geometry = Omit<SpawnPlan<string>, "quotas">;
const context = { seed: 3, zoneIndex: 3 };
const smallRoad: Geometry = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 2,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 0,
  minSpacing: 100,
  moverCaps: { darts: 3, slowVehicles: 3, total: 6 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 1,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 400,
};
function route(geometry: Geometry) {
  return zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
}
function boundedWork(): WitnessWork<string> {
  let remaining = 32768;
  const spend = () => --remaining >= 0;
  return { anchor: spend, check: spend, propagate: spend, stopped: () => remaining < 0 };
}
function prepareJob(
  context: SlotSeedContext,
  geometry: Geometry,
  sources: readonly SlotKind<string>[],
  options: Pick<WitnessJob<string>, "key" | "ordinal" | "phase" | "total">,
) {
  const prepared = sources.map((source) =>
    prepareSlotKind(slotMotionStreams(context, options.key, source.kind), geometry, source),
  );
  const columnPick = slotRandom(context, `${options.key}-layout`)();
  const job: WitnessJob<string> = {
    ...options,
    columnPick: () => columnPick,
    fixed: prepared.every(({ request }) => request.mover === undefined),
    guaranteed: options.phase === "active",
    laneEffect: prepared.some(({ request }) => request.blocksLane) ? "possible" : "none",
    preparations: () => prepared,
  };
  return { job, prepared };
}
function assignments(selections: readonly WitnessSelection<string>[]): SlotAssignment<string>[] {
  return selections.map(({ candidate, entry, job }) => {
    const { source } = candidate.prepared;
    return {
      binding: { kind: source.kind, role: source.role, weight: source.weight },
      entry,
      key: job.key,
      phase: job.phase,
      role: source.role,
    };
  });
}
function fixedSource(kind: string, width: number): SlotKind<string> {
  return {
    compile: () => ({ blocksLane: false, footprint: { lanes: width, rows: 1 }, hazard: true }),
    footprint: { lanes: width, rows: 1 },
    kind,
    role: "minorFixed",
    weight: 1,
  };
}

describe("complete witness native contracts", () => {
  it("preserves full mover profiles and freshly audits a complete maximum composition", () => {
    const geometry: Geometry = {
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
      pathStart: 3,
      reactionSeconds: 0.5,
      riderFollowGap: 64,
      roadLength: 724,
      scrollSpeed: 300,
      sightLength: 553.8461538461538,
      stepSeconds: 1 / 60,
      zoneLength: 7400,
    };
    const path = route(geometry);
    const catalogue: SlotKind<string>[] = (["crosstownBus", "car", "raccoon"] as const).map(
      (kind) => {
        const movement = assignedMovement(gameData, "yongeStreet", kind)!;
        const footprint = footprintOf(gameData, kind);
        return {
          compile: (streams) => ({
            blocksLane: true,
            first: false,
            hazard: true,
            hitLength: itemHeight(gameData, GAME_ROAD, kind, false),
            mover: {
              ...moverSpec(gameData, streams, footprint, movement),
              hitLength: itemHeight(gameData, GAME_ROAD, kind, true),
            },
          }),
          footprint,
          kind,
          role: "minorMoving",
          weight: 1,
        };
      },
    );
    const config: SlotConfiguration<string> = {
      active: { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 3 },
      capacity: { encounterFixed: 0, encounterMoving: 0, minorFixed: 0, minorMoving: 4 },
      guarantees: catalogue.map(({ kind, role }) => ({ count: 1, kind, role })),
    };
    const preparations = [
      ...catalogue.map((source, ordinal) =>
        prepareJob(context, geometry, [source], {
          key: `active:minorMoving:${ordinal}`,
          ordinal,
          phase: "active",
          total: 4,
        }),
      ),
      prepareJob(context, geometry, catalogue, {
        key: "capacity:minorMoving:0",
        ordinal: 3,
        phase: "active",
        total: 4,
      }),
    ];
    const frozen = JSON.stringify(preparations.map(({ prepared }) => prepared));
    const jobs = preparations.map(({ job }) => job);
    const state = createSlotConstructionState(geometry, path);
    const domains = createSlotCandidateDomains(geometry, path);
    const audits: ReturnType<typeof auditSlotPlan>[] = [];
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      ...boundedWork(),
      certify: (selections) => {
        expect(selections.every(({ job }) => job.phase === "active")).toBe(true);
        const audit = auditSlotPlan(
          context,
          geometry,
          path,
          catalogue,
          [],
          config,
          "capacity",
          assignments(selections),
        );
        expect(audit.status).toBe("valid");
        expect(audit.delivered).toBe(audit.configured);
        audits.push(audit);
        return audit.status === "valid";
      },
    }).solve(state);
    expect(result.status).toBe("compatible");
    if (result.status !== "compatible") {
      throw new Error("Expected a joint witness from full native mover preparations");
    }
    expect(audits).toHaveLength(1);
    expect(new Set(result.selections.map(({ job }) => job))).toEqual(new Set(jobs));
    for (const [index, selection] of result.selections.entries()) {
      const { candidate, entry, job } = selection;
      expect(preparations.find((prepared) => prepared.job === job)!.prepared).toContain(
        candidate.prepared,
      );
      expect(selection.entry).toBe(result.witness[index]!.entry);
      expect(selection.owner).toBe(job);
      expect(entry.event).toBe(candidate.entry.event);
      expect(entry.request).toBe(candidate.prepared.request);
      expect(candidate.prepared.placements).toContain(entry.placement);
      expect(entry.event.mover).toBe(entry.placement!.path);
      expect(entry.trace.requestedDraws).toEqual(candidate.prepared.draws);
      expect(entry.trace.quotaIndex).toBe(index);
    }
    const capacityAudit = auditSlotPlan(
      context,
      geometry,
      path,
      catalogue,
      [],
      config,
      "capacity",
      assignments(result.selections),
    );
    expect(capacityAudit.status).toBe("valid");
    expect(capacityAudit.delivered).toBe(config.capacity.minorMoving);
    expect(capacityAudit.violations).toEqual([]);
    expect(capacityAudit.geometry.missingCoverage).toEqual([]);
    expect(state.entries()).toEqual([]);
    expect(JSON.stringify(preparations.map(({ prepared }) => prepared))).toBe(frozen);
  });

  it("fits multi-cell fixed jobs on the native board", () => {
    const path = route(smallRoad);
    expect(path).toHaveLength(3);
    const solveWidths = (widths: readonly number[]) => {
      const jobs = widths.map(
        (width, ordinal) =>
          prepareJob(context, smallRoad, [fixedSource(`fixed-${ordinal}`, width)], {
            key: `active:minorFixed:${ordinal}`,
            ordinal,
            phase: "active",
            total: widths.length,
          }).job,
      );
      const state = createSlotConstructionState(smallRoad, path);
      const result = createSlotWitnessSearch(
        smallRoad,
        path,
        createSlotCandidateDomains(smallRoad, path),
        jobs,
        boundedWork(),
      ).solve(state);
      expect(state.entries()).toEqual([]);
      return result;
    };
    const result = solveWidths([1, 2, 2]);
    expect(result.status).toBe("compatible");
    if (result.status !== "compatible") {
      throw new Error("Expected five occupied cells to fit the six-cell native board");
    }
    const materialised = materialiseSlotPlan(smallRoad, path, assignments(result.selections));
    const audit = auditSpawnPlan(materialised.plan, materialised.planned);
    expect(audit.status).toBe("valid");
    expect(audit.validPlaced).toBe(3);
  });

  it("rejects capacity that exhausts same-kind visibility despite spare native cells", () => {
    const geometry = { ...smallRoad, zoneLength: 300 };
    const path = route(geometry);
    expect(path).toHaveLength(2);
    const source = fixedSource("same", 1);
    const jobs = [0, 1, 2].map(
      (ordinal) =>
        prepareJob(context, geometry, [source], {
          key: `${ordinal < 2 ? "active" : "capacity"}:minorFixed:${ordinal}`,
          ordinal,
          phase: "active",
          total: 3,
        }).job,
    );
    const config: SlotConfiguration<string> = {
      active: { encounterFixed: 0, encounterMoving: 0, minorFixed: 2, minorMoving: 0 },
      capacity: { encounterFixed: 0, encounterMoving: 0, minorFixed: 3, minorMoving: 0 },
      guarantees: [{ count: 1, kind: source.kind, role: source.role }],
    };
    const state = createSlotConstructionState(geometry, path);
    const domains = createSlotCandidateDomains(geometry, path);
    const certify = (selections: readonly WitnessSelection<string>[]) => {
      const audit = auditSlotPlan(
        context,
        geometry,
        path,
        [source],
        [],
        config,
        "active",
        assignments(selections),
      );
      expect(audit.status).toBe("valid");
      return audit.status === "valid";
    };
    const first = createSlotWitnessSearch(geometry, path, domains, jobs.slice(0, 2), {
      ...boundedWork(),
      certify,
    }).solve(state);
    expect(first.status).toBe("compatible");
    if (first.status !== "compatible") {
      throw new Error("Expected two simultaneous native same-kind placements");
    }
    expect(first.witness).toHaveLength(2);
    const rejected: string[] = [];
    const result = createSlotWitnessSearch(geometry, path, domains, jobs, {
      ...boundedWork(),
      rejected: (_candidate, failure) => rejected.push(failure.rule),
    }).solve(state);
    expect(result.status).toBe("blocked");
    expect(rejected).toContain("kind-row");
    expect(state.entries()).toEqual([]);
  });
});
