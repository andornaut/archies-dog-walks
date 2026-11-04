import { describe, expect, it } from "vitest";

import { TUNING } from "../data/tuning";
import { moverPlacements } from "./moverPlanning";
import { moverSpec } from "./moverSpecs";
import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates";
import type { SlotKind } from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import { slotMotionStreams } from "./slotEntropy";
import { materialiseSlotPlan } from "./slotPlan";
import { blockingLength, rowSpacing, type SpawnPlan, zoneRows } from "./spawning";
import { auditSpawnPlan } from "./spawnValidation";

const context = { seed: 32, zoneIndex: 0 };
const key = "active:minorMoving:10";
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
  pathStart: 4,
  reactionSeconds: 0.5,
  riderFollowGap: 64,
  roadLength: 724,
  scrollSpeed: 200,
  sightLength: 553.8461538461538,
  stepSeconds: 1 / 60,
  zoneLength: 29600,
};
const source: SlotKind<string> = {
  compile: (streams) => ({
    blocksLane: true,
    first: false,
    hitLength: 64,
    mover: {
      ...moverSpec(
        { tuning: TUNING },
        streams,
        { lanes: 1, rows: 1 },
        { kind: "step", steps: { max: 4, min: 3 } },
      ),
      hitLength: 72.8089887640449,
    },
  }),
  footprint: { lanes: 1, rows: 1 },
  kind: "mailCarrier",
  role: "minorMoving",
  weight: 2,
};

function fixture() {
  const prepared = prepareSlotKind(slotMotionStreams(context, key, source.kind), geometry, source);
  const spacing = rowSpacing({ ...geometry, quotas: [] });
  const path = zoneRows(geometry, spacing).map((distance) => ({ distance, lane: 4 }));
  const entry = slotPlacementsAt(
    geometry,
    { distance: path[5]!.distance, lane: 0, row: 5, slot: 0 },
    prepared,
  )[0]!;
  expect(entry).toBeDefined();
  const assignments = [
    {
      binding: { kind: source.kind, role: source.role, weight: source.weight },
      entry,
      key,
      phase: "active" as const,
      role: source.role,
    },
  ];
  return { assignments, entry, path, prepared, spacing };
}

describe("native deterministic mover occupancy", () => {
  it("admits and freshly audits the unchanged full four-lane step profile", () => {
    const { assignments, entry, path, prepared, spacing } = fixture();
    const spec = prepared.request.mover!;
    expect(spec.motion).toMatchObject({ count: { max: 4, min: 3 }, kind: "steps" });
    const original = moverPlacements(
      { ...geometry, rowSpacing: spacing, window: blockingLength(geometry, 1) },
      spec,
      prepared.draws,
    );
    expect(original).toHaveLength(4);
    expect(prepared.placements).toEqual(original);
    expect(prepared.placements.every(({ lanes }) => lanes.count === 4)).toBe(true);
    expect(entry.event.mover).toBe(prepared.placements[0]!.path);
    expect(entry.event.mover).toMatchObject({
      motion: "steps",
      steps: [{ lanes: 1 }, { lanes: 1 }, { lanes: 1 }],
    });
    const unchanged = structuredClone(entry);
    const state = createSlotConstructionState(geometry, path);
    expect(state.commit({ key }, entry).accepted).toBe(true);
    expect(state.checkComplete()).toEqual({ accepted: true });
    const materialized = materialiseSlotPlan(geometry, path, assignments);
    const audit = auditSpawnPlan(materialized.plan, materialized.planned);
    expect(audit.status).toBe("valid");
    expect(audit.findings).toHaveLength(1);
    expect(audit.findings[0]).toMatchObject({ coverage: [], reasons: [] });
    expect(audit.violations).toEqual([]);
    expect(audit.missingCoverage).toEqual([]);
    expect(entry).toEqual(unchanged);
  });

  it("retains complete path clearance and the wider instantaneous lane-count rejection", () => {
    const { assignments, entry, path } = fixture();
    const blockedPath = path.map((row) => ({ ...row, lane: 2 }));
    const crossed = { ...geometry, pathStart: 2 };
    expect(createSlotConstructionState(crossed, blockedPath).probe({ key }, entry)).toMatchObject({
      accepted: false,
      failure: { rule: "path" },
    });
    const blocked = materialiseSlotPlan(crossed, blockedPath, assignments);
    expect(auditSpawnPlan(blocked.plan, blocked.planned).status).toBe("invalid");

    const narrow = { ...geometry, minOpenLanes: 4 };
    expect(createSlotConstructionState(narrow, path).probe({ key }, entry)).toMatchObject({
      accepted: false,
      failure: { rule: "open-lanes" },
    });
    const crowded = materialiseSlotPlan(narrow, path, assignments);
    const audit = auditSpawnPlan(crowded.plan, crowded.planned);
    expect(audit.status).toBe("invalid");
    expect(audit.findings[0]!.reasons).toContain("insufficient open lanes");
  });
});
