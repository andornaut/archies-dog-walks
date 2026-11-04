import { describe, expect, it, vi } from "vitest";

import { createSlotCandidateDomains, type SlotOwnerWallsToken } from "./slotCandidateDomains";
import { prepareSlotKind } from "./slotCandidates";
import { createSlotConstructionState, type SlotPocketScope } from "./slotConstraintState";
import { createSlotPocketAdapter } from "./slotPocketAdapter";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

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
  zoneLength: 2000,
};

function fixture(width: number, adviceLimit?: number) {
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
  const streams = { movers: () => 0.9, spawns: () => 0.9 };
  const standing = (lanes: number, kind: string) =>
    prepareSlotKind(streams, geometry, {
      compile: () => ({ blocksLane: true, first: true, footprint: { lanes, rows: 1 } }),
      footprint: { lanes, rows: 1 },
      kind,
      role: "minorFixed",
      weight: 1,
    });
  const divider = standing(1, "divider");
  const repair = standing(width, "repair");
  const dart = prepareSlotKind(streams, geometry, {
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
  const owners = [divider, dart, repair].map((prepared) => ({
    key: prepared.source.kind,
    phase: "active" as const,
    preparations: () => [prepared],
  }));
  const domains = createSlotCandidateDomains(geometry, path);
  const state = createSlotConstructionState(geometry, path);
  expect(
    state.commit(owners[0]!, domains.at(owners[0]!.key, divider, 4, 2)[0]!.entry).accepted,
  ).toBe(true);
  expect(state.commit(owners[1]!, domains.at(owners[1]!.key, dart, 4, 4)[0]!.entry).accepted).toBe(
    true,
  );
  expect(state.checkComplete()).toMatchObject({
    accepted: false,
    failure: { rule: "open-stretches" },
  });
  const before = state.entries();
  const probeOwner = { key: "reservation-probe" };
  const probe = domains.at(probeOwner.key, standing(2, "reservation-probe"), 10, 1)[0]!;
  state.reserveCells(path.length * geometry.laneCount);
  const reservation = () => state.probe(probeOwner, probe.entry);
  expect(reservation()).toMatchObject({ accepted: false, failure: { rule: "reservation" } });
  const work = {
    ...(adviceLimit === undefined ? {} : { adviceLimit }),
    anchor: vi.fn(() => true),
    check: vi.fn(() => true),
    propagate: vi.fn(() => true),
    stopped: () => false,
  };
  const adapter = createSlotPocketAdapter(work, geometry, path, domains, owners);
  const restored = () => {
    expect(state.entries()).toEqual(before);
    state.entries().forEach(({ entry, owner }, index) => {
      expect(entry).toBe(before[index]!.entry);
      expect(owner).toBe(before[index]!.owner);
    });
    expect(reservation()).toMatchObject({ accepted: false, failure: { rule: "reservation" } });
  };
  return {
    adapter,
    domains,
    owners,
    repair: domains.at(owners[2]!.key, repair, 4, 3)[0]!,
    restored,
    state,
    work,
  };
}

describe("native pocket adapter", () => {
  it("refutes a native pocket using the complete remaining owner frontier", () => {
    const test = fixture(1);
    const result = test.adapter.check(test.state, "active");
    expect(result.status).toBe("refuted");
    expect(test.work.anchor).toHaveBeenCalled();
    expect(test.work.check).toHaveBeenCalled();
    expect(test.work.propagate).toHaveBeenCalled();
    if (result.status !== "refuted") {
      throw new Error("Expected the native owner-capacity obstruction");
    }
    expect(result.proof.remaining).toEqual([test.owners[2]]);
    expect(result.proof.domains.length).toBeGreaterThan(0);
    expect(test.adapter.attestRefutation(test.state, result.proof)).toEqual({
      dependencies: test.state.entries().map(({ owner }) => owner),
      status: "attested",
    });
    expect(test.adapter.attestRefutation(test.state, { ...result.proof })).toEqual({
      status: "unknown",
    });
    for (const domain of result.proof.domains) {
      expect(domain.values.every(({ guaranteedWalls }) => guaranteedWalls !== 0)).toBe(true);
      expect(
        test.domains.attestOwnerWalls(
          test.work,
          result.proof.scope as SlotPocketScope,
          domain.row,
          domain.owner,
          domain.values,
          domain.token as SlotOwnerWallsToken,
        ),
      ).toBe(true);
    }
    const root = test.state.checkpoint();
    test.state.reserveCells(0);
    const other = test.domains.at(
      test.owners[2]!.key,
      [...test.owners[2]!.preparations()][0]!,
      10,
      3,
    )[0]!;
    expect(test.state.commit(test.owners[2]!, other.entry).accepted).toBe(true);
    expect(test.adapter.attestRefutation(test.state, result.proof)).toEqual({ status: "unknown" });
    test.state.restore(root);
    expect(test.adapter.attestRefutation(test.state, result.proof).status).toBe("attested");
    const preparation = test.owners[2]!.preparations;
    test.owners[2]!.preparations = () => [...preparation()];
    expect(test.adapter.attestRefutation(test.state, result.proof)).toEqual({ status: "unknown" });
    test.owners[2]!.preparations = preparation;
    test.work.propagate.mockReturnValue(false);
    expect(test.adapter.attestRefutation(test.state, result.proof)).toEqual({ status: "budget" });
    test.restored();
  });

  it("returns UNKNOWN when a native future wall can repair the pocket", () => {
    const test = fixture(2);
    expect(test.adapter.check(test.state, "capacity")).toEqual({ status: "unknown" });
    test.restored();
    const before = test.state.checkpoint();
    test.state.reserveCells(0);
    expect(test.state.commit(test.owners[2]!, test.repair.entry).accepted).toBe(true);
    expect(test.state.checkComplete()).toEqual({ accepted: true });
    const frontier = vi.spyOn(test.domains, "completeOwnerWalls");
    expect(test.adapter.check(test.state, "active")).toEqual({ status: "unknown" });
    expect(frontier).not.toHaveBeenCalled();
    frontier.mockRestore();
    test.state.restore(before);
    const commits = vi.spyOn(test.state, "commit");
    try {
      expect(test.adapter.check(test.state, "active")).toEqual({ status: "unknown" });
      expect(
        commits.mock.results.some((result) => result.type === "return" && result.value.accepted),
      ).toBe(true);
      expect(test.work.anchor).toHaveBeenCalled();
      expect(test.work.check).toHaveBeenCalled();
    } finally {
      commits.mockRestore();
    }
    test.restored();
  });

  it("keeps caller budget exhaustion sticky and restores the future reservation", () => {
    const test = fixture(2);
    test.work.check.mockReturnValue(false);
    expect(test.adapter.check(test.state, "active")).toEqual({ status: "budget" });
    expect(test.work.check).toHaveBeenCalled();
    const checks = test.work.check.mock.calls.length;
    test.work.check.mockReturnValue(true);
    expect(test.adapter.check(test.state, "active")).toEqual({ status: "budget" });
    expect(test.work.check).toHaveBeenCalledTimes(checks);
    expect(test.adapter.check(test.state, "capacity")).toEqual({ status: "budget" });
    expect(test.work.check).toHaveBeenCalledTimes(checks);
    test.restored();
  });

  it("spends an explicit optional allowance once across calls without poisoning shared work", () => {
    const test = fixture(1, 1);
    expect(test.adapter.check(test.state, "active")).toEqual({ status: "unknown" });
    expect(test.work.propagate).toHaveBeenCalled();
    const before = {
      anchors: test.work.anchor.mock.calls.length,
      checks: test.work.check.mock.calls.length,
      propagation: test.work.propagate.mock.calls.length,
    };
    expect(test.adapter.check(test.state, "active")).toEqual({ status: "unknown" });
    expect(test.work.anchor).toHaveBeenCalledTimes(before.anchors);
    expect(test.work.check).toHaveBeenCalledTimes(before.checks);
    expect(test.work.propagate).toHaveBeenCalledTimes(before.propagation);
    expect(test.work.check()).toBe(true);
    expect(test.work.propagate()).toBe(true);
    expect(test.adapter.check(test.state, "capacity")).toEqual({ status: "unknown" });
    test.restored();
  });
});
