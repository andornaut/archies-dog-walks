import { describe, expect, it, vi } from "vitest";

import { visibleMoverRows } from "./moverCoverage";
import { createSlotCandidateDomains, type SlotCandidate } from "./slotCandidateDomains";
import { type PreparedSlotKind, prepareSlotKind } from "./slotCandidates";
import type { SlotSource } from "./slotConfig";
import { createSlotConstructionState } from "./slotConstraintState";
import { nextCoverageRows } from "./slotCoverage";
import { createSlotWitnessConstruct, type SlotWitnessConstructPorts } from "./slotWitnessConstruct";
import type { WitnessJob } from "./slotWitnessSearch";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: 2,
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
  zoneLength: 600,
};
const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
  distance,
  lane: 4,
}));
function source(kind: string, blocksLane: boolean, lanes = 1): SlotSource<string> {
  const footprint = { lanes, rows: 1 };
  return {
    compile: vi.fn<SlotSource<string>["compile"]>(() => ({
      blocksLane,
      first: true,
      mover: {
        footprint,
        motion: { kind: "ride", speedMultiplier: 1.5 },
        movement: "inLane",
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
        warningSeconds: 0,
      },
    })),
    footprint,
    kind,
    role: "minorMoving",
    weight: 1,
  };
}
function fixture(pools: readonly (readonly SlotSource<string>[])[], fairSources: boolean) {
  const prepared = new Map<string, PreparedSlotKind<string>[]>();
  const streams = pools.map(() => ({ movers: vi.fn(() => 0.5), spawns: vi.fn(() => 0.5) }));
  const opened = vi.fn(),
    closed = vi.fn();
  const jobs: WitnessJob<string>[] = pools.map((pool, ordinal) => ({
    columnPick: () => 0.5,
    fixed: false,
    guaranteed: false,
    key: String(ordinal),
    laneEffect: "possible",
    minimumCells: 0,
    ordinal,
    phase: "active",
    *preparations() {
      opened(ordinal);
      try {
        for (const value of pool) {
          const native = prepareSlotKind(streams[ordinal]!, geometry, value);
          const seen = prepared.get(String(ordinal)) ?? [];
          seen.push(native);
          prepared.set(String(ordinal), seen);
          yield native;
        }
      } finally {
        closed(ordinal);
      }
    },
    total: pools.length,
  }));
  const state = createSlotConstructionState(geometry, path),
    domains = createSlotCandidateDomains(geometry, path);
  const work = {
    anchor: vi.fn(() => true),
    check: vi.fn(() => true),
    propagate: vi.fn(() => true),
  };
  type Mark = ReturnType<typeof state.checkpoint>;
  const attempts: { candidate: SlotCandidate<string>; key: string }[] = [];
  const ports: SlotWitnessConstructPorts<string, Mark> = {
    candidates: (job, value, order) => domains.sequence(work, order, job.key, value),
    checkpoint: state.checkpoint,
    complete: state.checkComplete,
    entries: state.entries,
    fairSources,
    minimumDelivery: pools.length,
    preparations: (job) => job.preparations(),
    propagate: work.propagate,
    restore: state.restore,
    test(job, candidate) {
      attempts.push({ candidate, key: job.key });
      return state.commit(job, candidate.entry);
    },
  };
  const construct = createSlotWitnessConstruct(geometry, path, jobs);
  return {
    attempts,
    closed,
    construct,
    domains,
    jobs,
    opened,
    ports,
    prepared,
    state,
    streams,
    work,
  };
}
function firstAttempt(f: ReturnType<typeof fixture>) {
  const cursor = f.construct.begin(f.ports);
  try {
    for (let step = 0; step < 20 && f.attempts.length === 0; step++) {
      if (cursor.next().done) {
        break;
      }
    }
  } finally {
    const draws = f.streams.map((stream) => [
      stream.movers.mock.calls.length,
      stream.spawns.mock.calls.length,
    ]);
    cursor.return({ status: "inconclusive" });
    expect(
      f.streams.map((stream) => [stream.movers.mock.calls.length, stream.spawns.mock.calls.length]),
    ).toEqual(draws);
  }
  expect(f.attempts.length).toBeGreaterThan(0);
  return f.attempts[0]!;
}

describe("moving coverage source priority", () => {
  it.each([false, true])(
    "tries a later moving blocker before an earlier nonblocking source with fair traversal %s",
    (fairSources) => {
      const ordinary = source("nonblocking", false),
        blocking = source("blocking", true);
      const f = fixture([[ordinary], [blocking]], fairSources);
      const candidate = firstAttempt(f).candidate;
      expect(candidate.prepared.source).toBe(blocking);
      const visible = visibleMoverRows(
        geometry,
        path.map(({ distance }) => distance),
        candidate.entry,
      );
      expect(nextCoverageRows(geometry, [])!.some((row) => visible.includes(row))).toBe(true);
      expect(ordinary.compile).toHaveBeenCalledOnce();
      expect(blocking.compile).toHaveBeenCalledOnce();
      expect(f.opened.mock.calls.map(([ordinal]) => ordinal)).toEqual([0, 1]);
      expect(f.closed.mock.calls.map(([ordinal]) => ordinal)).toEqual([0, 1]);
      expect(f.state.entries()).toEqual([]);
    },
  );

  it("stops a moving coverage sample at the shared budget and restores native state", () => {
    const f = fixture([[source("blocking", true)]], false);
    let sampling = false;
    f.work.propagate.mockImplementation(() => !sampling);
    const result = f.construct({
      ...f.ports,
      *candidates(job, prepared, order) {
        for (const step of f.ports.candidates(job, prepared, order)) {
          if (step.status === "candidate") {
            sampling = true;
          }
          yield step;
        }
      },
    });
    expect(sampling).toBe(true);
    expect(result).toEqual({ status: "budget" });
    expect(f.state.entries()).toEqual([]);
    expect(f.closed).toHaveBeenCalledOnce();
  });
});
