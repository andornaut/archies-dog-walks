import { describe, expect, it } from "vitest";

import { type MoverDraws, type MoverSpec } from "./moverModel.ts";
import { herringSpawn, moverPlacements } from "./moverPlanning.ts";
import {
  blockingLength,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";
import {
  auditHerringGeometry,
  auditMoverGeometry,
  type MoverProof,
} from "./spawnMoverValidation.ts";

const plan: SpawnPlan<string> = {
  cellInset: -5,
  cellLength: 50,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 10,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 150,
  moverCaps: { darts: 5, slowVehicles: 5, total: 10 },
  packHitLength: 40,
  packLength: 40,
  pathLaneMoveSeconds: 0.1,
  pathStart: 2,
  quotas: [],
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 600,
  scrollSpeed: 100,
  sightLength: 400,
  stepSeconds: 0.05,
  zoneLength: 8000,
};
const draws: MoverDraws = {
  count: 0,
  delays: [0, 0],
  lengths: [0.5, 0.5],
  share: 0,
  shy: 0.999,
  side: 0,
  speed: 0.5,
  start: 0,
  tilt: 0,
  turn: 0.999,
  turnAt: 0.5,
};
const cross: Extract<MoverSpec["motion"], { kind: "cross" }> = {
  kind: "cross",
  lanesPerSecond: 2,
  reactionSeconds: 0.2,
  startRoadShare: [0.3, 0.3],
  stopLanes: { max: 2, min: 1 },
  stopShare: 0,
  tilt: [0, 0],
  turnAtShare: [0.5, 0.5],
  turnBackShare: 0,
  vergeShare: 0,
};
const geometry = { ...plan, rowSpacing: rowSpacing(plan), window: blockingLength(plan, 1) };
function fixture(motion: MoverSpec["motion"]) {
  const spec: MoverSpec = {
    footprint: { lanes: 1, rows: 1 },
    motion,
    movement:
      motion.kind === "ride"
        ? "inLane"
        : motion.kind === "cross"
          ? "dart"
          : motion.kind === "approach"
            ? "approach"
            : "step",
    variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
    warningSeconds: 1,
  };
  const quota: SpawnQuota<string> = { blocksLane: true, count: 1, kind: "test", mover: spec };
  const candidate = moverPlacements(geometry, spec, draws, 0)[0];
  expect(candidate, "fixture requires an actual legal candidate").toBeDefined();
  if (candidate === undefined) {
    throw new Error("missing fixture candidate");
  }
  const row = 3,
    origin = zoneRows(plan, rowSpacing(plan))[row]!;
  const event: SpawnEvent<string> = {
    distance: origin + candidate.appears,
    kind: quota.kind,
    lane: candidate.lane,
    mover: candidate.path,
  };
  const proof: MoverProof = {
    block: {
      dart: candidate.path.motion === "cross",
      lanes: candidate.lanes,
      row,
      rows: candidate.rows,
    },
    ...(candidate.body === undefined
      ? {}
      : {
          body: {
            ...candidate.body,
            from: origin + candidate.body.from,
            to: origin + candidate.body.to,
          },
        }),
    cells: candidate.cells.map((cell) => ({ ...cell, row: row + cell.row })),
    screen: [origin + candidate.screen[0], origin + candidate.screen[1]],
    selection: { draws, lift: 0 },
    stands: candidate.stands.map((stand) => ({ ...stand, distance: origin + stand.distance })),
  };
  return { event, proof, quota };
}
describe("selected legacy mover evidence", () => {
  it.each([
    { kind: "ride", speedMultiplier: 2 },
    { kind: "ride", merge: { at: 0.5, seconds: 0.3 }, speedMultiplier: 2 },
    cross,
    {
      count: { max: 1, min: 1 },
      kind: "steps",
      sequences: [[{ lanes: 1, travel: 0 }]],
      stepSeconds: 0.2,
    },
    {
      count: { max: 1, min: 1 },
      kind: "steps",
      sequences: [[{ lanes: 1, travel: 0 }]],
      shy: { nearSeconds: 1.6, rise: 1, shapes: [{ lanes: 1, travel: 0 }], share: 1 },
      stepSeconds: 0.2,
    },
    {
      firstDelaySeconds: [0, 0],
      kind: "approach",
      secondRoadShare: [0.3, 0.3],
      stepSeconds: 0.2,
      steps: { max: 1, min: 1 },
    },
  ] satisfies MoverSpec["motion"][])("reconstructs $kind selected geometry", (motion) => {
    const { event, proof, quota } = fixture(motion);
    expect(auditMoverGeometry(plan, quota, event, proof)).toEqual({ coverage: [], reasons: [] });
  });
  it("rejects corrupted path, body, reservations, contact intervals and visibility", () => {
    const { event, proof, quota } = fixture({ kind: "ride", speedMultiplier: 2 });
    const mutations: MoverProof[] = [
      { ...proof, body: { ...proof.body!, to: proof.body!.to - 1 } },
      { ...proof, cells: [] },
      { ...proof, stands: [] },
      { ...proof, screen: [proof.screen[0], proof.screen[1] - 1] },
      { ...proof, block: { ...proof.block, rows: proof.block.rows + 1 } },
    ];
    for (const changed of mutations) {
      expect(auditMoverGeometry(plan, quota, event, changed).reasons).not.toEqual([]);
    }
    expect(auditMoverGeometry(plan, quota, { ...event, lane: 99 }, proof).reasons).not.toEqual([]);
    expect(
      auditMoverGeometry(plan, quota, { ...event, mover: { ...event.mover!, warning: 999 } }, proof)
        .reasons,
    ).not.toEqual([]);
    const { selection: omitted, ...withoutSelection } = proof;
    expect(omitted).toBeDefined();
    expect(auditMoverGeometry(plan, quota, event, withoutSelection).coverage).not.toEqual([]);
  });
  it("proves herring exit without crediting an altered contact path", () => {
    const { quota } = fixture({ ...cross, herring: { endRoadShare: 0.5, share: 0.5 } });
    const event = herringSpawn(
      { ...geometry, zoneLength: plan.zoneLength },
      quota.mover!,
      draws,
      quota.kind,
      zoneRows(plan, rowSpacing(plan)),
    )!;
    if (event.mover.motion !== "cross") {
      throw new Error("expected crossing");
    }
    const until =
      event.distance +
      (plan.laneCount + quota.mover!.footprint.lanes - 0.5) / event.mover.lanesPerPixel;
    expect(auditHerringGeometry(plan, quota, event, until)).toEqual({ coverage: [], reasons: [] });
    expect(
      auditHerringGeometry(plan, quota, { ...event, mover: { ...event.mover, tilt: 0 } }, until)
        .reasons,
    ).toContain("herring can reach pack contact");
    expect(auditHerringGeometry(plan, quota, event, until - 1).reasons).not.toEqual([]);
  });
});
