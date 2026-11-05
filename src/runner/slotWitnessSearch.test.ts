import { describe, expect, it, vi } from "vitest";

import { createSlotCandidateDomains } from "./slotCandidateDomains.ts";
import { prepareSlotKind } from "./slotCandidates.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import { quietCoverage } from "./slotCoverage.ts";
import { createSlotWitnessSearch, type WitnessJob, type WitnessWork } from "./slotWitnessSearch.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  firstContactSeconds: 0,
  fixedKinds: [],
  laneCount: 4,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: 2,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 3, slowVehicles: 3, total: 6 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 3,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 600,
};
function fixture(overrides: Partial<WitnessWork<string>> = {}, auxiliary = false) {
  const road = auxiliary ? { ...geometry, maxEmptyRows: Infinity } : geometry;
  const path = zoneRows(road, rowSpacing({ ...road, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
  const jobs: WitnessJob<string>[] = ["first", "second", "third", "fourth"].map((key, ordinal) => {
    const inert = auxiliary && key === "third";
    const prepared = prepareSlotKind({ movers: () => 0, spawns: () => 0 }, road, {
      compile: () => ({ blocksLane: !inert, first: true, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind: key,
      role: inert ? "auxiliaryFixed" : "minorFixed",
      weight: 1,
    });
    return {
      columnPick: () => 0,
      fixed: !inert,
      guaranteed: false,
      key,
      laneEffect: inert ? "none" : "possible",
      ordinal,
      phase: "active",
      preparations: () => [prepared],
      total: 4,
    };
  });
  const domains = createSlotCandidateDomains(road, path);
  const state = createSlotConstructionState(road, path);
  const work: WitnessWork<string> = { anchor: () => true, check: () => true, ...overrides };
  const search = createSlotWitnessSearch(road, path, domains, jobs, work);
  return { domains, jobs, path, search, state };
}

describe("native composition solve", () => {
  it("returns exact insertion-order provenance and certifies the complete composition once", () => {
    const certify = vi.fn((selections: readonly unknown[]) => selections.length === 4);
    const { jobs, search, state } = fixture({ certify });
    const result = search.solve(state);
    expect(certify).toHaveBeenCalledOnce();
    expect(quietCoverage(geometry, result.status === "compatible" ? result.witness : []).over).toBe(
      0,
    );
    expect(result.status).toBe("compatible");
    if (result.status !== "compatible") {
      throw new Error("Expected a certified joint native layout");
    }
    expect(result.witness).toHaveLength(jobs.length);
    expect(result.selections).toHaveLength(result.witness.length);
    for (const [index, selection] of result.selections.entries()) {
      expect(selection.entry).toBe(result.witness[index]!.entry);
      expect(selection.owner).toBe(selection.job);
      expect(selection.entry.event).toBe(selection.candidate.entry.event);
      expect(selection.entry.request).toBe(selection.candidate.prepared.request);
      expect(selection.entry.trace.quotaIndex).toBe(index);
    }
    expect(state.entries()).toEqual([]);
  });

  it.each([
    { progress: 0, restarts: 0 },
    { progress: 1, restarts: 1 },
  ])(
    "reports $restarts reserve restarts and the first floor-meeting layout at progress $progress",
    ({ progress, restarts }) => {
      const floorMet = vi.fn();
      const reserveRestarted = vi.fn();
      const { search, state } = fixture({
        floorMet,
        minimumDelivery: 3,
        progress: () => progress,
        reserveRestarted,
      });
      expect(search.solve(state).status).toBe("compatible");
      expect(reserveRestarted).toHaveBeenCalledTimes(restarts);
      expect(floorMet).toHaveBeenCalledOnce();
    },
  );

  it("rejects a nonempty root without moving or rebinding its native entries", () => {
    const { domains, jobs, search, state } = fixture();
    const job = jobs[0]!;
    const candidate = domains.at(job.key, [...job.preparations()][0]!, 0, 0)[0]!;
    expect(state.commit(job, candidate.entry).accepted).toBe(true);
    const prefix = state.entries();
    expect(search.solve(state)).toMatchObject({
      failure: { rule: "unsupported-root" },
      status: "blocked",
    });
    expect(state.entries()).toEqual(prefix);
    expect(state.entries()[0]!.entry).toBe(prefix[0]!.entry);
  });

  it("stops without further native work after final certification fails", () => {
    let stopped = false;
    let commits = 0;
    let commitsAtStop = 0;
    const active = vi.fn(() => {
      commitsAtStop = commits;
      stopped = true;
      return false;
    });
    const { jobs, search, state } = fixture({ certify: active, stopped: () => stopped });
    const commit = state.commit;
    const phases: string[] = [];
    const result = search.solve({
      ...state,
      commit: (owner, entry) => {
        expect(stopped).toBe(false);
        commits++;
        phases.push(jobs.find((job) => job === owner)!.phase);
        return commit(owner, entry);
      },
    });
    expect(result.status).toBe("budget");
    expect(active).toHaveBeenCalledOnce();
    expect(commits).toBe(commitsAtStop);
    expect(commits).toBeGreaterThanOrEqual(jobs.length);
    expect(new Set(phases)).toEqual(new Set(["active"]));
    expect(state.entries()).toEqual([]);
  });

  it("checks inert-suffix lane closure before complete composition certification", () => {
    const certify = vi.fn((selections: readonly unknown[]) => selections.length === 4);
    const { jobs, search, state } = fixture({ certify }, true);
    const prefixes: number[] = [];
    const result = search.solve({
      ...state,
      checkComplete: () => {
        const length = state.entries().length;
        prefixes.push(length);
        expect(certify).not.toHaveBeenCalled();
        return state.checkComplete();
      },
    });
    expect(result.status).toBe("compatible");
    expect(prefixes).toContain(3);
    expect(prefixes.at(-1)).toBe(4);
    expect(certify).toHaveBeenCalledOnce();
    expect(certify.mock.calls[0]![0]).toHaveLength(4);
    if (result.status === "compatible") {
      expect(result.selections.map(({ job }) => job)).toEqual([jobs[0], jobs[1], jobs[3], jobs[2]]);
    }
    expect(state.entries()).toEqual([]);
  });

  it.each(["before", "after"] as const)(
    "honours caller exhaustion %s native row advice",
    (when) => {
      let stopped = false;
      let size = () => 0;
      let chargesAtStop = 0;
      const check = vi.fn(() => {
        if (when === "before" && size() === 1) {
          chargesAtStop = check.mock.calls.length;
          return false;
        }
        return true;
      });
      const { jobs, search, state } = fixture({ check, stopped: () => stopped }, true);
      size = () => state.entries().length;
      const preparations = vi.spyOn(jobs[1]!, "preparations");
      const commit = vi.fn(state.commit);
      const openStretchRow = vi.fn(() => {
        expect(check.mock.results.at(-1)!.value).toBe(true);
        expect(state.entries()).toHaveLength(1);
        const row = state.openStretchRow();
        stopped = true;
        chargesAtStop = check.mock.calls.length;
        return row;
      });
      expect(search.solve({ ...state, commit, openStretchRow })).toEqual({ status: "budget" });
      expect(check.mock.calls).toHaveLength(chargesAtStop);
      expect(chargesAtStop).toBeGreaterThan(0);
      expect(openStretchRow).toHaveBeenCalledTimes(when === "before" ? 0 : 1);
      expect(preparations).not.toHaveBeenCalled();
      expect(commit).toHaveBeenCalledOnce();
      expect(state.entries()).toEqual([]);
    },
  );

  it("restores the root on bounded work exhaustion and preserves unattributed native failures", () => {
    const bounded = fixture({ check: () => false });
    expect(bounded.search.solve(bounded.state)).toEqual({ status: "budget" });
    expect(bounded.state.entries()).toEqual([]);
    const session = bounded.search.start(bounded.state);
    let progress = session.advance(1);
    while (progress.status === "pending") {
      progress = session.advance(1);
    }
    expect(progress).toEqual({ result: { status: "budget" }, status: "unsupported" });
    expect(session.advance(1)).toEqual(progress);
    expect(session.cancel()).toEqual(progress);
    const { search, state } = fixture();
    const failure = {
      classification: "unattributed" as const,
      owners: [],
      rule: "native-overflow",
    };
    const commit = vi.fn(() => ({ accepted: false as const, failure }));
    expect(search.solve({ ...state, commit })).toEqual({ failure, status: "blocked" });
    expect(commit).toHaveBeenCalledOnce();
    expect(state.entries()).toEqual([]);
  });
  it("preserves native results, work and complete certification across different slice sizes", () => {
    const run = (slice?: number) => {
      const counts = { active: 0, anchors: 0, checks: 0, propagation: 0 };
      const { search, state } = fixture({
        anchor: () => {
          counts.anchors++;
          return true;
        },
        certify: () => {
          counts.active++;
          return true;
        },
        check: () => {
          counts.checks++;
          return true;
        },
        propagate: () => {
          counts.propagation++;
          return true;
        },
      });
      if (slice === undefined) {
        return { counts, result: search.solve(state) };
      }
      const session = search.start(state);
      let progress = session.advance(slice);
      while (progress.status === "pending") {
        progress = session.advance(slice);
      }
      expect(progress.status).toBe("complete");
      expect(state.entries()).toEqual([]);
      const saved = { ...counts };
      expect(session.advance(slice)).toEqual(progress);
      expect(session.cancel()).toEqual({
        result: progress.status === "complete" ? progress.result : undefined,
        status: "complete",
      });
      expect(counts).toEqual(saved);
      if (progress.status !== "complete") {
        throw new Error("Missing native witness");
      }
      return { counts, result: progress.result };
    };
    const synchronous = run();
    expect(synchronous.result.status).toBe("compatible");
    expect(synchronous.counts.active).toBe(1);
    expect(JSON.stringify(run(1))).toEqual(JSON.stringify(synchronous));
    expect(JSON.stringify(run(11))).toEqual(JSON.stringify(synchronous));
  });

  it("cancels a suspended native transaction and unwinds callback errors without later work", () => {
    const { search, state } = fixture();
    const restore = vi.fn(state.restore);
    const session = search.start({ ...state, restore });
    expect(() => session.advance(0)).toThrow(RangeError);
    let progress = session.advance(1);
    while (progress.status === "pending" && state.entries().length === 0) {
      progress = session.advance(1);
    }
    expect(progress.status).toBe("pending");
    expect(state.entries().length).toBeGreaterThan(0);
    expect(session.cancel()).toEqual({ status: "cancelled" });
    expect(state.entries()).toEqual([]);
    const count = restore.mock.calls.length;
    expect(session.advance(1)).toEqual({ status: "cancelled" });
    expect(session.cancel()).toEqual({ status: "cancelled" });
    expect(restore).toHaveBeenCalledTimes(count);

    const failing = fixture();
    const failure = new Error("native callback failed");
    const commit = vi.fn((...args: Parameters<typeof failing.state.commit>) => {
      if (failing.state.entries().length > 0) {
        throw failure;
      }
      return failing.state.commit(...args);
    });
    const interrupted = failing.search.start({ ...failing.state, commit });
    expect(() => {
      while (interrupted.advance(1).status === "pending") {
        /* Drain to the native error. */
      }
    }).toThrow(failure);
    expect(failing.state.entries()).toEqual([]);
    const calls = commit.mock.calls.length;
    expect(() => interrupted.advance(1)).toThrow(failure);
    expect(() => interrupted.cancel()).toThrow(failure);
    expect(commit).toHaveBeenCalledTimes(calls);
  });
});
