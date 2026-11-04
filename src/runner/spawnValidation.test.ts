import { describe, expect, it } from "vitest";

import { MOVEMENT_PROFILES } from "../data/movementProfiles.ts";
import { moverPlacements, type MoverSpec } from "./moverPlanning.ts";
import {
  blockingLength,
  type PlannedSpawns,
  rowSpacing,
  type SpawnPlan,
  zoneRows,
} from "./spawning.ts";
import { auditSpawnPlan, type SpawnAuditTrace } from "./spawnValidation.ts";

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
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 2,
  quotas: [{ blocksLane: true, count: 5, kind: "bench" }],
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 1000,
};
function emitted(events: PlannedSpawns<string>["events"]): PlannedSpawns<string> {
  const planned = {
    admission: {
      capacity: { limits: [], rows: 9 },
      counts: [{ admitted: 999, herrings: 999, kind: "bench", movement: null, requested: 999 }],
      rejections: [],
      substitutions: [],
    },
    events,
    herrings: [],
    path: Array.from({ length: 9 }, (_, index) => ({ distance: 100 * (index + 1), lane: 2 })),
    visibility: [],
  };
  return planned;
}
const four = [100, 300, 500, 700].map((distance) => ({ distance, kind: "bench", lane: 0 }));

describe("independent emitted spawn audit", () => {
  it("uses frozen quotas and emitted groups, ignoring invented admission counts", () => {
    const result = auditSpawnPlan(plan, emitted(four));
    expect(result).toMatchObject({
      meetsValidPlacementFloor: true,
      minimumPlaced: 4,
      placed: 4,
      requested: 5,
      status: "valid",
      validPlaced: 4,
    });
    expect(auditSpawnPlan(plan, emitted(four.slice(1))).meetsValidPlacementFloor).toBe(false);
  });
  it("does not credit substitutions, unknown kinds or overcounts", () => {
    const result = auditSpawnPlan(
      plan,
      emitted([...four, { distance: 800, kind: "hedge", lane: 0 }]),
    );
    expect(result.placed).toBe(4);
    expect(result.status).toBe("invalid");
    expect(result.findings[4]?.reasons.join()).toContain("unrequested");
    const over = auditSpawnPlan(
      { ...plan, quotas: [{ blocksLane: true, count: 1, kind: "bench" }] },
      emitted(four),
    );
    expect(over.validPlaced).toBe(0);
    expect(over.violations).toContain("overcount bench/standing");
  });
  it("marks every participant in same-kind caps and row/lane/entry conflicts invalid", () => {
    const result = auditSpawnPlan(
      plan,
      emitted([0, 1, 3].map((lane) => ({ distance: 100, kind: "bench", lane }))),
    );
    expect(result.validPlaced).toBe(0);
    expect(
      result.findings.every((finding) =>
        finding.reasons.includes("more than two logical groups of one kind visible"),
      ),
    ).toBe(true);
    expect(result.findings[0]?.reasons).toContain("overlapping same-kind entry tick");
  });
  it("rejects footprint bounds and guaranteed-path obstruction", () => {
    const result = auditSpawnPlan(
      plan,
      emitted([
        { distance: 100, kind: "bench", lane: 2 },
        { distance: 300, kind: "bench", lane: 5 },
      ]),
    );
    expect(result.validPlaced).toBe(0);
    expect(result.findings[0]?.reasons.join()).toContain("guaranteed path");
    expect(result.findings[1]?.reasons.join()).toContain("outside");
  });
  it("counts actual emitted herrings and flags unsupported moving geometry without claiming valid placement", () => {
    const movingPlan: SpawnPlan<string> = {
      ...plan,
      quotas: [
        {
          blocksLane: true,
          count: 1,
          kind: "rider",
          mover: {
            footprint: { lanes: 1, rows: 1 },
            motion: { kind: "ride", speedMultiplier: 1 },
            movement: "inLane",
            variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
            warningSeconds: 0,
          },
        },
      ],
    };
    const planned = emitted([]);
    planned.herrings.push({
      distance: 100,
      kind: "rider",
      lane: 0,
      mover: {
        lane: 0,
        lanes: 1,
        motion: "ride",
        movement: "inLane",
        speedMultiplier: 1,
        warning: 0,
      },
    });
    const result = auditSpawnPlan(movingPlan, planned);
    expect(result).toMatchObject({
      meetsPlacementFloor: true,
      meetsValidPlacementFloor: false,
      placed: 1,
      requested: 1,
      status: "unverified",
      validPlaced: 0,
    });
    expect(result.missingCoverage).toContain("missing or ambiguous bound moving visibility trace");
  });
});

function taxiFixture() {
  const profile = MOVEMENT_PROFILES.twoMerges!;
  const spec: MoverSpec = {
    footprint: { lanes: 1, rows: 2 },
    motion: { kind: "signature", profile },
    movement: "inLane",
    variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
    warningSeconds: profile.warningSeconds,
  };
  const taxiPlan: SpawnPlan<string> = {
    ...plan,
    pathStart: 4,
    quotas: [{ blocksLane: true, count: 1, footprint: spec.footprint, kind: "taxi", mover: spec }],
    roadLength: 700,
    sightLength: 600,
    zoneLength: 6000,
  };
  const spacing = rowSpacing(taxiPlan);
  const rows = zoneRows(taxiPlan, spacing);
  const draws = {
    count: 0,
    delays: [0, 0, 0, 0, 0, 0],
    lengths: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    share: 0,
    shy: 0,
    side: 0,
    speed: 0.5,
    start: 0,
    tilt: 0,
    turn: 0,
    turnAt: 0,
  };
  const spot = moverPlacements(
    {
      cellLength: taxiPlan.cellLength,
      laneCount: taxiPlan.laneCount,
      laneInset: taxiPlan.laneInset,
      packHitLength: taxiPlan.packHitLength,
      packLength: taxiPlan.packLength,
      roadLength: taxiPlan.roadLength,
      rowSpacing: spacing,
      scrollSpeed: taxiPlan.scrollSpeed,
      sightLength: taxiPlan.sightLength,
      window: blockingLength(taxiPlan, 1),
    },
    spec,
    draws,
  ).find((placement) => placement.lane === 0)!;
  const row = 19,
    base = rows[row]!;
  const event = { distance: base + spot.appears, kind: "taxi", lane: spot.lane, mover: spot.path };
  const nativeUntil = base + spot.screen[1];
  const trace: SpawnAuditTrace = {
    entry: event.distance,
    hazard: true,
    index: 0,
    kind: event.kind,
    lane: event.lane,
    memberIndex: 0,
    nativeUntil,
    placement: {
      block: { dart: false, lanes: spot.lanes, row, rows: spot.rows },
      body: { ...spot.body!, from: base + spot.body!.from, to: base + spot.body!.to },
      cells: spot.cells.map((cell) => ({ ...cell, row: row + cell.row })),
      screen: [event.distance, nativeUntil],
      selection: { draws, lift: 0 },
      stands: spot.stands.map((stand) => ({ ...stand, distance: base + stand.distance })),
    },
    quotaIndex: 0,
    requestedDraws: draws,
    row: Math.floor(event.distance / spacing),
    source: "events",
    until:
      nativeUntil +
      Math.max(0, taxiPlan.roadLength - taxiPlan.sightLength) +
      taxiPlan.packLength +
      (spec.hitLength ?? taxiPlan.cellLength),
  };
  const planned = emitted([event]);
  planned.path = rows.map((distance) => ({ distance, lane: 4 }));
  return { plan: taxiPlan, planned, trace };
}
describe("independent signature geometry audit", () => {
  it("certifies an emitted production Taxi route from actual component sweeps", () => {
    const fixture = taxiFixture();
    const result = auditSpawnPlan(fixture.plan, fixture.planned, [fixture.trace]);
    expect(result.findings).toEqual([{ coverage: [], index: 0, reasons: [], source: "events" }]);
    expect(result).toMatchObject({
      meetsValidPlacementFloor: true,
      status: "valid",
      validPlaced: 1,
    });
  });
  it("rejects forged body and contact proof and a guaranteed path through the actual Taxi contact", () => {
    const fixture = taxiFixture();
    const body = structuredClone(fixture.trace);
    const badBody = {
      ...body,
      placement: {
        ...body.placement!,
        body: { ...body.placement!.body!, to: body.placement!.body!.to - 1 },
      },
    };
    expect(auditSpawnPlan(fixture.plan, fixture.planned, [badBody]).findings[0]!.reasons).toContain(
      "signature body reservation mismatch",
    );
    const contact = structuredClone(fixture.trace);
    const badContact = { ...contact, placement: { ...contact.placement!, stands: [] } };
    expect(
      auditSpawnPlan(fixture.plan, fixture.planned, [badContact]).findings[0]!.reasons,
    ).toContain("signature pack-contact stands mismatch");
    const lane = fixture.trace.placement!.block.lanes.first;
    const blocked = {
      ...fixture.planned,
      path: fixture.planned.path.map((point) => ({ ...point, lane })),
    };
    const result = auditSpawnPlan({ ...fixture.plan, pathStart: lane }, blocked, [fixture.trace]);
    expect(result.validPlaced).toBe(0);
    expect(result.findings[0]!.reasons).toContain("moving contact block obstructs guaranteed path");
  });
});

it("requires unique frozen request members and rejects an invalid leftover even above the numeric floor", () => {
  const fixture = taxiFixture();
  const duplicate = {
    ...fixture.planned,
    events: [...fixture.planned.events, ...fixture.planned.events],
  };
  const traces = [fixture.trace, { ...fixture.trace, index: 1 }];
  const result = auditSpawnPlan(
    { ...fixture.plan, quotas: [{ ...fixture.plan.quotas[0]!, count: 2 }] },
    duplicate,
    traces,
  );
  expect(
    result.findings.every((finding) =>
      finding.reasons.includes("duplicate frozen request identity"),
    ),
  ).toBe(true);
  expect(result.meetsValidPlacementFloor).toBe(false);
  const invalid = emitted([...four, { distance: 800, kind: "unknown", lane: 0 }]);
  const raw = auditSpawnPlan(plan, invalid);
  expect(raw.validPlaced).toBe(4);
  expect(raw.meetsValidPlacementFloor).toBe(false);
});

it("measures standing footprint length in cell pixels rather than spacing rows", () => {
  const result = auditSpawnPlan(
    {
      ...plan,
      quotas: [{ blocksLane: true, count: 1, footprint: { lanes: 1, rows: 3 }, kind: "bench" }],
    },
    emitted([{ distance: 800, kind: "bench", lane: 0 }]),
  );
  expect(result).toMatchObject({ status: "valid", validPlaced: 1 });
});
