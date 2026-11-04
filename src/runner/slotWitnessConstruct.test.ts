import { describe, expect, it, vi } from "vitest";

import { visibleMoverRows } from "./moverCoverage";
import { createSlotCandidateDomains, type SlotCandidate } from "./slotCandidateDomains";
import { prepareSlotKind } from "./slotCandidates";
import { createSlotConstructionState } from "./slotConstraintState";
import { nextCoverageRows, quietCoverage } from "./slotCoverage";
import { createMovingCoverageHints } from "./slotMovingCoverageHints";
import { createSlotPocketAdapter } from "./slotPocketAdapter";
import { createSlotSolverSession } from "./slotSolverSession";
import {
  constructSlotWitness,
  createSlotWitnessConstruct,
  type SlotWitnessConstructPorts,
} from "./slotWitnessConstruct";
import type { WitnessJob } from "./slotWitnessSearch";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

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
  zoneLength: 800,
};
interface Spec {
  readonly auxiliary?: boolean;
  readonly guaranteed?: boolean;
  readonly key: string;
  readonly moving?: boolean;
  readonly rows?: number;
  readonly width?: number;
  readonly within?: readonly [number, number];
}
function crossing(road: typeof geometry) {
  return prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, road, {
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
}
function reactive(road: typeof geometry) {
  const footprint = { lanes: 2, rows: 1 };
  return prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
    compile: () => ({
      blocksLane: true,
      first: true,
      mover: {
        footprint,
        motion: {
          firstDelaySeconds: [0, 0],
          kind: "approach",
          secondRoadShare: [0.5, 0.5],
          stepSeconds: 0.1,
          steps: { max: 2, min: 2 },
        },
        movement: "approach",
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
        warningSeconds: 0,
      },
    }),
    footprint,
    kind: "reactive",
    role: "minorMoving",
    weight: 1,
  });
}
function fixture(road: typeof geometry, specs: readonly Spec[], limit = Infinity) {
  const path = zoneRows(road, rowSpacing({ ...road, quotas: [] })).map((distance) => ({
    distance,
    lane: road.pathStart,
  }));
  const jobs: WitnessJob<string>[] = specs.map((spec, ordinal) => {
    const footprint = { lanes: spec.width ?? 1, rows: spec.rows ?? 1 };
    const prepared = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
      compile: () => ({
        blocksLane: spec.auxiliary !== true,
        first: true,
        ...(spec.moving
          ? {
              mover: {
                footprint,
                motion: { kind: "ride", speedMultiplier: 1.5 },
                movement: "inLane",
                variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
                warningSeconds: 0,
              },
            }
          : { footprint }),
        ...(spec.within === undefined ? {} : { within: spec.within }),
      }),
      footprint,
      kind: spec.key,
      role: spec.auxiliary ? "auxiliaryFixed" : spec.moving ? "minorMoving" : "minorFixed",
      weight: 1,
    });
    return {
      columnPick: () => 0,
      fixed: !spec.moving && !spec.auxiliary,
      guaranteed: spec.guaranteed === true,
      key: spec.key,
      laneEffect: spec.auxiliary ? "none" : "possible",
      minimumCells: spec.moving || spec.auxiliary ? 0 : footprint.lanes,
      ordinal,
      phase: "active",
      preparations: () => [prepared],
      total: specs.length,
    };
  });
  const domains = createSlotCandidateDomains(road, path);
  const state = createSlotConstructionState(road, path);
  let context = 0;
  let checks = 0;
  let accepted = 0;
  const check = () => ++checks <= limit;
  const work = { anchor: () => true, check, propagate: () => true };
  type Mark = { readonly context: number; readonly native: ReturnType<typeof state.checkpoint> };
  const ports: SlotWitnessConstructPorts<string, Mark> = {
    candidates: (job, prepared, order) => domains.sequence(work, order, job.key, prepared),
    checkpoint: () => ({ context, native: state.checkpoint() }),
    complete: () => (check() ? state.checkComplete() : undefined),
    entries: state.entries,
    preparations: (job) => job.preparations(),
    propagate: work.propagate,
    restore: (mark) => {
      state.restore(mark.native);
      context = mark.context;
    },
    test: (job, candidate) => {
      if (!check()) {
        return undefined;
      }
      const present = new Set(state.entries().map(({ owner }) => owner.key));
      state.reserveCells(
        jobs.reduce(
          (total, next) => total + (present.has(next.key) || next === job ? 0 : next.minimumCells),
          0,
        ),
      );
      const result = state.commit(job, candidate.entry);
      if (result.accepted) {
        accepted++;
        context++;
      }
      return result;
    },
  };
  const pin = (job: WitnessJob<string>, row: number, lane: number) => {
    const prepared = [...job.preparations()][0]!;
    const candidate = domains.at(job.key, prepared, row, lane)[0]!;
    const result = state.commit(job, candidate.entry);
    if (!result.accepted) {
      throw new Error(`Invalid fixture prefix: ${result.failure.rule}`);
    }
    return result.entry;
  };
  return {
    accepted: () => accepted,
    context: () => context,
    jobs,
    laneClosure: () => (check() ? state.checkComplete() : undefined),
    path,
    pin,
    ports,
    state,
  };
}

function warmPorts<Mark>(ports: SlotWitnessConstructPorts<string, Mark>) {
  const hints = new Map<string, SlotCandidate<string>>();
  const preparations = vi.fn(ports.preparations);
  const propagate = vi.fn(ports.propagate);
  const candidates = vi.fn(ports.candidates);
  const complete = vi.fn(ports.complete);
  const test = vi.fn((job: WitnessJob<string>, candidate: SlotCandidate<string>) => {
    const result = ports.test(job, candidate);
    if (result?.accepted) {
      hints.set(job.key, candidate);
    }
    return result;
  });
  const warmed = {
    ...ports,
    candidates,
    complete,
    hint: (job: WitnessJob<string>) => hints.get(job.key),
    preparations,
    propagate,
    test,
  };
  const clear = () => {
    for (const spy of [candidates, complete, preparations, propagate, test]) {
      spy.mockClear();
    }
  };
  return { candidates, clear, complete, ports: warmed, preparations, propagate, test };
}

function pocketFixture() {
  const road = {
    ...geometry,
    laneCount: 5,
    maxEmptyRows: Infinity,
    minOpenLanes: 2,
    pathStart: 0,
    zoneLength: 2000,
  };
  delete road.firstContactSeconds;
  const native = fixture(road, [
    { key: "subject", width: 2 },
    { key: "wall" },
    { key: "dart", moving: true },
    { key: "repair", width: 2 },
  ]);
  native.jobs[2]!.preparations = () => [crossing(road)];
  native.pin(native.jobs[1]!, 4, 2);
  native.pin(native.jobs[2]!, 4, 4);
  return { ...native, road };
}

describe("native witness construction mode", () => {
  it("orders moving guarantees by their full native envelopes before motion family", () => {
    const road = {
      ...geometry,
      laneCount: 5,
      maxEmptyRows: Infinity,
      minOpenLanes: 2,
      pathStart: 4,
      zoneLength: 3000,
    };
    delete road.firstContactSeconds;
    const { jobs, path, ports, state } = fixture(road, [
      { guaranteed: true, key: "crossing", moving: true },
      { guaranteed: true, key: "reactive", moving: true, width: 2 },
    ]);
    const dart = crossing(road);
    const following = reactive(road);
    expect(following.source.footprint.lanes).toBe(2);
    expect(Math.min(...following.placements.map(({ lanes }) => lanes.count))).toBe(4);
    expect(Math.max(...dart.placements.map(({ lanes }) => lanes.count))).toBeLessThan(4);
    jobs[0] = { ...jobs[0]!, preparations: () => [dart] };
    jobs[1] = { ...jobs[1]!, preparations: () => [following] };
    const attempts: string[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        test(job, candidate) {
          attempts.push(job.key);
          return ports.test(job, candidate);
        },
      },
      road,
      path,
      jobs,
    );
    expect(attempts[0]).toBe("reactive");
    expect(result.status).toBe("compatible");
    if (result.status === "compatible") {
      expect(new Set(result.witness.map(({ owner }) => owner))).toEqual(new Set(jobs));
      expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
    }
    expect(state.entries()).toEqual([]);
  });

  it("uses the least restrictive compiled alternative without changing weighted value order", () => {
    const road = {
      ...geometry,
      laneCount: 5,
      maxEmptyRows: Infinity,
      minOpenLanes: 2,
      pathStart: 4,
      zoneLength: 3000,
    };
    delete road.firstContactSeconds;
    const { jobs, path, ports, state } = fixture(road, [
      { guaranteed: true, key: "crossing", moving: true },
      { guaranteed: true, key: "mixed", moving: true },
    ]);
    const dart = crossing(road);
    const following = reactive(road);
    const narrow = [...jobs[1]!.preparations()][0]!;
    jobs[0] = { ...jobs[0]!, preparations: () => [dart] };
    jobs[1] = { ...jobs[1]!, preparations: () => [following, narrow] };
    const attempts: { candidate: SlotCandidate<string>; key: string }[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        test(job, candidate) {
          attempts.push({ candidate, key: job.key });
          return ports.test(job, candidate);
        },
      },
      road,
      path,
      jobs,
    );
    expect(attempts[0]!.key).toBe("crossing");
    expect(attempts.find(({ key }) => key === "mixed")!.candidate.prepared).toBe(following);
    expect(result.status).toBe("compatible");
    expect(state.entries()).toEqual([]);
  });

  it("keeps original guarantee order when native envelopes and motion families tie", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    delete road.firstContactSeconds;
    const { jobs, path, ports } = fixture(road, [
      { guaranteed: true, key: "first", moving: true },
      { guaranteed: true, key: "second", moving: true },
    ]);
    const attempts: string[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        test(job, candidate) {
          attempts.push(job.key);
          return ports.test(job, candidate);
        },
      },
      road,
      path,
      jobs,
    );
    expect(attempts[0]).toBe("first");
    expect(result.status).toBe("compatible");
  });

  it("charges envelope inspection and never caches interrupted guarantee metadata", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    delete road.firstContactSeconds;
    const { context, jobs, path, ports, state } = fixture(road, [
      { guaranteed: true, key: "required", moving: true },
    ]);
    const preparations = vi.fn(ports.preparations);
    const candidates = vi.fn(ports.candidates);
    const test = vi.fn(ports.test);
    const propagate = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const construct = createSlotWitnessConstruct(road, path, jobs);
    expect(construct({ ...ports, candidates, preparations, propagate, test })).toEqual({
      status: "budget",
    });
    expect(propagate).toHaveBeenCalledTimes(2);
    expect(candidates).not.toHaveBeenCalled();
    expect(test).not.toHaveBeenCalled();
    expect(state.entries()).toEqual([]);
    expect(context()).toBe(0);
    propagate.mockImplementation(() => true);
    expect(construct({ ...ports, preparations, propagate }).status).toBe("compatible");
    expect(preparations).toHaveBeenCalledTimes(2);
  });

  it("ignores delivery count advice when exact construction is requested", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { jobs, path, ports, state } = fixture(road, [{ key: "wall" }]);
    const result = constructSlotWitness(
      { ...ports, bestDelivery: () => jobs.length },
      road,
      path,
      jobs,
    );
    expect(result.status).toBe("compatible");
    expect(state.entries()).toEqual([]);
  });

  it.each([false, true])(
    "delays a required compiled nonblocker without treating ordering as native proof (sliced %s)",
    (sliced) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { context, jobs, path, ports, state } = fixture(road, [
        { auxiliary: true, guaranteed: true, key: "required-prize" },
        { key: "ordinary-wall" },
        { key: "later" },
      ]);
      jobs[0] = { ...jobs[0]!, laneEffect: "possible" };
      const accepted: string[] = [];
      const closureDepth: number[] = [];
      const complete = vi.fn(() => {
        expect(state.entries().some(({ owner }) => owner === jobs[0])).toBe(true);
        return ports.complete();
      });
      const wired = {
        ...ports,
        complete,
        laneClosure: () => {
          closureDepth.push(state.entries().length);
          return state.checkComplete();
        },
        test: (job: WitnessJob<string>, candidate: SlotCandidate<string>) => {
          const result = ports.test(job, candidate);
          if (result?.accepted) {
            accepted.push(job.key);
          }
          return result;
        },
      };
      let result;
      if (sliced) {
        const session = createSlotSolverSession(
          createSlotWitnessConstruct(road, path, jobs).begin(wired),
        );
        let progress = session.advance(1);
        while (progress.status === "pending") {
          progress = session.advance(1);
        }
        if (progress.status !== "complete") {
          throw new Error("Missing terminal witness");
        }
        result = progress.result;
      } else {
        result = constructSlotWitness(wired, road, path, jobs);
      }
      expect(result.status).toBe("compatible");
      expect(accepted).toEqual(["ordinary-wall", "later", "required-prize"]);
      expect(complete.mock.calls).toEqual([[]]);
      expect(closureDepth).toEqual([1, 2, 3]);
      expect(jobs[0]!.laneEffect).toBe("possible");
      expect(state.entries()).toEqual([]);
      expect(context()).toBe(0);
    },
  );

  it("keeps a mixed guaranteed profile pool in normal mandatory order", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { context, jobs, path, ports, state } = fixture(road, [
      { auxiliary: true, guaranteed: true, key: "mixed" },
      { key: "ordinary-wall" },
    ]);
    const nonblocking = [...jobs[0]!.preparations()][0]!;
    const blocking = [...jobs[1]!.preparations()][0]!;
    jobs[0] = { ...jobs[0]!, laneEffect: "possible", preparations: () => [nonblocking, blocking] };
    const accepted: string[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        test: (job, candidate) => {
          const result = ports.test(job, candidate);
          if (result?.accepted) {
            accepted.push(job.key);
          }
          return result;
        },
      },
      road,
      path,
      jobs,
    );
    expect(result.status).toBe("compatible");
    expect(accepted).toEqual(["mixed", "ordinary-wall"]);
    expect(state.entries()).toEqual([]);
    expect(context()).toBe(0);
  });

  it("consumes a native-issued conditional refutation without inventing smaller dependencies", () => {
    const road = {
      ...geometry,
      laneCount: 5,
      maxEmptyRows: Infinity,
      minOpenLanes: 2,
      pathStart: 0,
      zoneLength: 2000,
    };
    delete road.firstContactSeconds;
    const { context, jobs, path, pin, ports, state } = fixture(road, [
      { key: "wall" },
      { key: "dart", moving: true },
      { key: "subject" },
      { key: "repair" },
    ]);
    jobs[1]!.preparations = () => [crossing(road)];
    pin(jobs[0]!, 4, 2);
    pin(jobs[1]!, 4, 4);
    const root = state.entries();
    const domains = createSlotCandidateDomains(road, path);
    const adapter = createSlotPocketAdapter(
      { anchor: () => true, check: () => true, propagate: ports.propagate, stopped: () => false },
      road,
      path,
      domains,
      jobs,
    );
    const attestRefutation = vi.fn((proof: Parameters<typeof adapter.attestRefutation>[1]) => {
      const result = adapter.attestRefutation(state, proof);
      expect(result).toEqual({
        dependencies: state.entries().map(({ owner }) => owner),
        status: "attested",
      });
      expect(result.status === "attested" && result.dependencies).toContain(jobs[2]);
      return result;
    });
    const result = constructSlotWitness(
      {
        ...ports,
        attestRefutation,
        *candidates(job, prepared) {
          yield* ports.candidates(job, prepared, { columnStart: 0, columns: [1], rows: [10] });
        },
        support: () => adapter.check(state, "active"),
      },
      road,
      path,
      jobs,
    );
    expect(result).toEqual({ status: "inconclusive" });
    expect(attestRefutation).toHaveBeenCalledOnce();
    expect(state.entries()).toEqual(root);
    expect(context()).toBe(0);
  });

  it("completes mixed jobs and coverage without changing the pinned proposal or active entries", () => {
    const { context, jobs, path, pin, ports, state } = fixture(geometry, [
      { guaranteed: true, key: "pinned" },
      { guaranteed: true, key: "rider", moving: true },
      { key: "first-cover" },
      { key: "second-cover" },
      { key: "third-cover" },
      { auxiliary: true, key: "reward" },
      { key: "extra" },
      { key: "extra-rider", moving: true },
    ]);
    const current = pin(jobs[0]!, 0, 0);
    const before = state.entries();
    const result = constructSlotWitness(ports, geometry, path, jobs);
    expect(result.status).toBe("compatible");
    if (result.status !== "compatible") {
      throw new Error("Expected a complete native composition");
    }
    expect(result.coverageKey).toBe("first-cover");
    expect(new Set(result.witness.map(({ owner }) => owner.key))).toEqual(
      new Set(jobs.map((job) => job.key)),
    );
    expect(result.witness[0]!.entry).toBe(current);
    const active = result.witness.filter(
      ({ owner }) => jobs.find((job) => job === owner)?.phase === "active",
    );
    expect(result.witness.slice(0, active.length)).toEqual(active);
    expect(quietCoverage(geometry, active).over).toBe(0);
    const replay = createSlotConstructionState(geometry, path, result.witness);
    expect(replay.checkComplete()).toEqual({ accepted: true });
    expect(state.entries()).toEqual(before);
    expect(context()).toBe(0);
  });

  it("returns inconclusive and restores the caller when the remaining native domain cannot fit", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { context, jobs, path, pin, ports, state } = fixture(road, [
      { key: "pinned" },
      {
        key: "blocked",
        width: 3,
        within: [0, 1 / zoneRows(road, rowSpacing({ ...road, quotas: [] })).length],
      },
    ]);
    pin(jobs[0]!, 0, 0);
    const before = state.entries();
    expect(constructSlotWitness(ports, road, path, jobs)).toEqual({ status: "inconclusive" });
    expect(state.entries()).toEqual(before);
    expect(context()).toBe(0);
  });

  it("propagates a spent caller budget and rolls back a trial already committed natively", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { accepted, context, jobs, path, pin, ports, state } = fixture(
      road,
      [{ key: "pinned" }, { key: "trial" }],
      2,
    );
    pin(jobs[0]!, 0, 0);
    const before = state.entries();
    expect(constructSlotWitness(ports, road, path, jobs)).toEqual({ status: "budget" });
    expect(accepted()).toBe(1);
    expect(state.entries()).toEqual(before);
    expect(context()).toBe(0);
  });

  it.each(["test", "complete"] as const)(
    "stops on an unattributed %s failure without retrying or changing the caller",
    (stage) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { accepted, context, jobs, path, pin, ports, state } = fixture(road, [
        { key: "pinned" },
        { guaranteed: stage === "complete", key: "trial" },
        { key: "later" },
      ]);
      pin(jobs[0]!, 0, 0);
      const before = state.entries();
      const failure = { classification: "unattributed" as const, owners: [], rule: "overflow" };
      let tests = 0;
      let completions = 0;
      const guarded: typeof ports = {
        ...ports,
        complete: () => {
          completions++;
          return { accepted: false, failure };
        },
        test: (job, candidate) => {
          tests++;
          return stage === "test" ? { accepted: false, failure } : ports.test(job, candidate);
        },
      };
      expect(constructSlotWitness(guarded, road, path, jobs)).toEqual({
        failure,
        status: "blocked",
      });
      expect(tests).toBe(stage === "complete" ? 2 : 1);
      expect(completions).toBe(stage === "complete" ? 1 : 0);
      expect(accepted()).toBe(stage === "complete" ? 2 : 0);
      expect(state.entries()).toEqual(before);
      expect(context()).toBe(0);
    },
  );

  it.each(["entry", "empty-preparations", "truncated-preparations", "domain-eof"] as const)(
    "observes producer stop at %s before further work or native checks",
    (stage) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { context, jobs, path, pin, ports, state } = fixture(road, [
        { key: "pinned" },
        { guaranteed: true, key: "trial" },
        { key: "later" },
      ]);
      pin(jobs[0]!, 0, 0);
      const before = state.entries();
      let stop = stage === "entry";
      const complete = vi.fn(ports.complete);
      const test = vi.fn(ports.test);
      const propagate = vi.fn(ports.propagate);
      const candidates = vi.fn(function* (...args: Parameters<typeof ports.candidates>) {
        if (stage === "domain-eof") {
          stop = true;
          return;
        }
        yield* ports.candidates(...args);
      });
      const preparations = vi.fn(function* (job: WitnessJob<string>) {
        if (stage === "domain-eof") {
          yield* ports.preparations(job);
          return;
        }
        if (stage === "truncated-preparations") {
          yield [...ports.preparations(job)][0]!;
        }
        stop = true;
      });
      expect(
        constructSlotWitness(
          { ...ports, candidates, complete, preparations, propagate, stopped: () => stop, test },
          road,
          path,
          jobs,
        ),
      ).toEqual({ status: "budget" });
      expect(preparations).toHaveBeenCalledTimes(stage === "entry" ? 0 : 1);
      expect(propagate).toHaveBeenCalledTimes(
        stage === "truncated-preparations" || stage === "domain-eof" ? 1 : 0,
      );
      expect(candidates).toHaveBeenCalledTimes(stage === "domain-eof" ? 1 : 0);
      expect(test).not.toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
      expect(state.entries()).toEqual(before);
      expect(context()).toBe(0);
    },
  );

  it("rolls back an accepted trial when the caller stops before its complete check", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { accepted, context, jobs, path, pin, ports, state } = fixture(road, [
      { key: "pinned" },
      { key: "trial" },
    ]);
    pin(jobs[0]!, 0, 0);
    const before = state.entries();
    let stop = false;
    const complete = vi.fn(ports.complete);
    const test = vi.fn((...args: Parameters<typeof ports.test>) => {
      const result = ports.test(...args);
      stop = true;
      return result;
    });
    expect(
      constructSlotWitness({ ...ports, complete, stopped: () => stop, test }, road, path, jobs),
    ).toEqual({ status: "budget" });
    expect(test).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(accepted()).toBe(1);
    expect(state.entries()).toEqual(before);
    expect(context()).toBe(0);
  });

  it("reuses complete guaranteed metadata and still certifies the complete composition", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { context, jobs, path, pin, ports, state } = fixture(road, [
      { key: "pinned" },
      { guaranteed: true, key: "active" },
      { auxiliary: true, key: "reward" },
      { key: "later" },
    ]);
    const current = pin(jobs[0]!, 0, 0);
    const before = state.entries();
    const construct = createSlotWitnessConstruct(road, path, jobs);
    const warm = warmPorts(ports);
    expect(construct(warm.ports).status).toBe("compatible");
    warm.clear();
    warm.complete.mockImplementation(() => {
      expect(state.entries()).toHaveLength(4);
      return ports.complete();
    });
    const result = construct(warm.ports);
    expect(result.status).toBe("compatible");
    expect(warm.preparations.mock.calls.map(([job]) => job.key)).toEqual(["later", "reward"]);
    expect(warm.propagate).toHaveBeenCalledTimes(2);
    expect(warm.candidates).not.toHaveBeenCalled();
    expect(warm.test).toHaveBeenCalledTimes(3);
    expect(warm.complete.mock.calls).toEqual([[]]);
    if (result.status === "compatible") {
      expect(result.witness[0]!.entry).toBe(current);
    }
    expect(state.entries()).toEqual(before);
    expect(context()).toBe(0);
  });

  it("retains a repairable native stretch until every active job is present", () => {
    const road: typeof geometry = {
      ...geometry,
      laneCount: 5,
      maxEmptyRows: Infinity,
      minOpenLanes: 2,
      pathStart: 0,
      zoneLength: 2000,
    };
    delete road.firstContactSeconds;
    const { jobs, path, ports, state } = fixture(road, [
      { key: "wall" },
      { key: "dart", moving: true },
      { key: "repair", width: 2 },
    ]);
    const dart = crossing(road);
    jobs[1]!.preparations = () => [dart];
    const columns = new Map([
      [jobs[0], 2],
      [jobs[1], 4],
      [jobs[2], 3],
    ]);
    const complete = vi.fn(ports.complete);
    const support = vi.fn(() => ({ status: "unknown" as const }));
    let repairable = false;
    const tested: string[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        *candidates(job, prepared, order) {
          if (order.rows?.includes(4)) {
            yield* ports.candidates(job, prepared, {
              columnStart: 0,
              columns: [columns.get(job)!],
              rows: [4],
            });
          }
        },
        complete,
        support,
        test: (job, candidate) => {
          const result = ports.test(job, candidate);
          tested.push(`${job.key}:${result?.accepted}`);
          if (job === jobs[1] && result?.accepted) {
            const partial = state.checkComplete();
            repairable = !partial.accepted && partial.failure.rule === "open-stretches";
          }
          return result;
        },
      },
      road,
      path,
      jobs,
    );
    expect(tested).toEqual(["wall:true", "dart:true", "repair:true"]);
    expect(repairable).toBe(true);
    expect(result.status).toBe("compatible");
    expect(support).toHaveBeenCalledTimes(3);
    expect(complete.mock.calls).toEqual([[]]);
    if (result.status === "compatible") {
      expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
    }
    expect(state.entries()).toEqual([]);
  });

  it.each([false, true])(
    "uses native per-source continuation ordering with fair sources %s",
    (fairSources) => {
      const road = { ...geometry, laneCount: 5, maxEmptyRows: Infinity, pathStart: 4 };
      delete road.firstContactSeconds;
      const { jobs, path, pin, ports, state } = fixture(road, [
        { key: "broad", width: 2 },
        { key: "blocker" },
      ]);
      pin(jobs[1]!, 2, 1);
      const prefix = state.entries();
      const broad = [...jobs[0]!.preparations()][0]!;
      const narrow = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
        compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 1, rows: 1 } }),
        footprint: { lanes: 1, rows: 1 },
        kind: "narrow",
        role: "minorFixed",
        weight: 1,
      });
      const prepared: string[] = [],
        closed: string[] = [],
        tried: string[] = [];
      let sourceClosed = false;
      jobs[0]!.preparations = function* () {
        try {
          for (const source of [broad, narrow]) {
            prepared.push(source.source.kind);
            yield source;
          }
        } finally {
          sourceClosed = true;
        }
      };
      const trace: unknown[] = [];
      const hint = vi.fn(() => undefined);
      const result = constructSlotWitness(
        {
          ...ports,
          *candidates(job, source, order) {
            try {
              yield* ports.candidates(job, source, {
                ...order,
                rows: order.rows.filter((row) => row === 2),
              });
            } finally {
              closed.push(source.source.kind);
            }
          },
          fairSources,
          hint,
          test(job, candidate) {
            tried.push(candidate.prepared.source.kind);
            const result = ports.test(job, candidate);
            trace.push({
              kind: candidate.prepared.source.kind,
              lane: candidate.entry.event.lane,
              result: result?.accepted === false ? result.failure : result?.accepted,
              row: path.findIndex(({ distance }) => distance === candidate.entry.event.distance),
            });
            return result;
          },
        },
        road,
        path,
        jobs,
      );
      expect(result.status).toBe("compatible");
      expect(hint).toHaveBeenCalledOnce();
      if (result.status !== "compatible") {
        throw Error("Expected native complete composition");
      }
      const selected = result.witness.find(({ owner }) => owner === jobs[0])!;
      expect(selected.entry.request, JSON.stringify(trace)).toBe(
        fairSources ? narrow.request : broad.request,
      );
      expect(prepared).toEqual(fairSources ? ["broad", "narrow"] : ["broad"]);
      if (fairSources) {
        expect(tried.slice(0, 3)).toEqual(["broad", "broad", "narrow"]);
      }
      expect(closed).toContain("broad");
      expect(sourceClosed).toBe(true);
      expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
      expect(state.entries()).toEqual(prefix);
    },
  );

  it.each([false, true])(
    "retains native unsafe FIFO fallback with fair sources %s",
    (fairSources) => {
      const { context, jobs, path, ports, road, state } = pocketFixture();
      const prefix = state.entries();
      const first = [...jobs[0]!.preparations()][0]!;
      const compiled: string[] = [];
      let closed = false;
      jobs[0]!.preparations = function* () {
        try {
          compiled.push("first");
          yield first;
          compiled.push("later");
          yield prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
            compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 2, rows: 1 } }),
            footprint: { lanes: 2, rows: 1 },
            kind: "later-weighted",
            role: "minorFixed",
            weight: 1,
          });
        } finally {
          closed = true;
        }
      };
      const attempted: { kind: string; row: number }[] = [];
      const advice: { accepted: boolean; row: number }[] = [];
      const supported: number[] = [];
      const complete = vi.fn(ports.complete);
      const result = constructSlotWitness(
        {
          ...ports,
          *candidates(job, prepared, order) {
            const rows = order.rows.filter((row) => (job === jobs[0] ? [0, 4] : [4]).includes(row));
            yield* ports.candidates(job, prepared, { columnStart: 0, columns: [3], rows });
          },
          complete,
          fairSources,
          laneClosure: () => {
            const checked = state.checkComplete();
            const last = state.entries().at(-1)!;
            if (last.owner === jobs[0] && last.entry.request === first.request) {
              advice.push({
                accepted: checked.accepted,
                row: path.findIndex(({ distance }) => distance === last.entry.event.distance),
              });
            }
            return checked;
          },
          support: () => {
            const last = state.entries().at(-1)!;
            if (last.owner === jobs[0] && last.entry.request === first.request) {
              supported.push(
                path.findIndex(({ distance }) => distance === last.entry.event.distance),
              );
            }
            return { status: "unknown" };
          },
          test: (job, candidate) => {
            if (job === jobs[0]) {
              attempted.push({
                kind: candidate.prepared.source.kind,
                row: path.findIndex(({ distance }) => distance === candidate.entry.event.distance),
              });
            }
            return ports.test(job, candidate);
          },
        },
        road,
        path,
        jobs,
      );
      expect(result.status).toBe("compatible");
      expect(
        attempted.filter(({ kind }) => kind === first.source.kind).map(({ row }) => row),
      ).toEqual([0, 4, 0]);
      expect(advice).toEqual([
        { accepted: false, row: 0 },
        { accepted: true, row: 4 },
      ]);
      expect(supported).toEqual([4, 0]);
      expect(compiled).toEqual(fairSources ? ["first", "later"] : ["first"]);
      expect(closed).toBe(true);
      expect(complete.mock.calls).toEqual([[]]);
      if (result.status === "compatible") {
        expect(result.witness[2]!.entry.request).toBe(first.request);
        expect(result.witness[2]!.entry.event.distance).toBe(path[0]!.distance);
        expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
          accepted: true,
        });
      }
      expect(state.entries()).toEqual(prefix);
      expect(context()).toBe(0);
    },
  );

  it.each([
    { fairSources: false, mode: "stop" },
    { fairSources: false, mode: "budget" },
    { fairSources: true, mode: "stop" },
    { fairSources: true, mode: "budget" },
  ] as const)(
    "abandons queued unsafe values on $mode with fair sources $fairSources",
    ({ fairSources, mode }) => {
      const { context, jobs, path, ports, road, state } = pocketFixture();
      const prefix = state.entries();
      const first = [...jobs[0]!.preparations()][0]!;
      const compiled: string[] = [];
      let sourceClosed = false;
      let candidatesClosed = false;
      let stopped = false;
      const trial = {};
      let certificate: object | undefined;
      jobs[0]!.preparations = function* () {
        try {
          compiled.push("first");
          yield first;
          compiled.push("later");
          yield first;
        } finally {
          sourceClosed = true;
        }
      };
      const complete = vi.fn(ports.complete);
      const support = vi.fn(() => ({ status: "unknown" as const }));
      const laneClosure = vi.fn(() => {
        expect(certificate).toBe(trial);
        const checked = state.checkComplete();
        expect(checked.accepted).toBe(false);
        return checked;
      });
      const test = vi.fn((job: WitnessJob<string>, candidate: SlotCandidate<string>) => {
        const checked = ports.test(job, candidate);
        if (checked?.accepted) {
          certificate = trial;
        }
        return checked;
      });
      expect(
        constructSlotWitness(
          {
            ...ports,
            *candidates(job, prepared, order) {
              if (!order.rows.includes(0)) {
                return;
              }
              const candidates = ports.candidates(job, prepared, {
                columnStart: 0,
                columns: [3],
                rows: [0],
              });
              const cursor = candidates[Symbol.iterator]();
              try {
                const step = cursor.next();
                if (!step.done) {
                  yield step.value;
                  expect(state.entries()).toEqual(prefix);
                  expect(context()).toBe(0);
                  expect(certificate).toBeUndefined();
                  if (mode === "stop") {
                    stopped = true;
                  }
                  yield { kind: "candidateChecks", status: "budget" };
                }
              } finally {
                cursor.return?.();
                candidatesClosed = true;
              }
            },
            checkpoint: () => ({ caller: ports.checkpoint(), certificate }),
            complete,
            fairSources,
            laneClosure,
            restore: (mark) => {
              ports.restore(mark.caller);
              certificate = mark.certificate;
            },
            stopped: () => stopped,
            support,
            test,
          },
          road,
          path,
          jobs,
        ),
      ).toEqual({ status: "budget" });
      expect(test).toHaveBeenCalledOnce();
      expect(laneClosure).toHaveBeenCalledOnce();
      expect(complete).not.toHaveBeenCalled();
      expect(support).not.toHaveBeenCalled();
      expect(compiled).toEqual(fairSources ? ["first", "later"] : ["first"]);
      expect(candidatesClosed).toBe(true);
      expect(sourceClosed).toBe(true);
      expect(certificate).toBeUndefined();
      expect(state.entries()).toEqual(prefix);
      expect(context()).toBe(0);
    },
  );

  it.each([false, true])(
    "rejects native stretch failure with early lane closure %s and retains every owner",
    (early) => {
      const road: typeof geometry = {
        ...geometry,
        laneCount: 5,
        maxEmptyRows: Infinity,
        minOpenLanes: 2,
        pathStart: 0,
        zoneLength: 2000,
      };
      delete road.firstContactSeconds;
      const { context, jobs, laneClosure, path, ports, state } = fixture(
        road,
        [
          { key: "wall" },
          { key: "dart", moving: true },
          { key: "repair", width: 2 },
          { auxiliary: true, key: "reward-a" },
          { auxiliary: true, key: "reward-b" },
          { auxiliary: true, key: "reward-c" },
          { auxiliary: true, key: "later" },
        ],
        128,
      );
      const dart = crossing(road);
      jobs[1]!.preparations = () => [dart];
      const repair = [...jobs[2]!.preparations()][0]!;
      const attempts = new Map<string, number>();
      const completions: (string | undefined)[] = [];
      const closurePrefixes: number[] = [];
      const result = constructSlotWitness(
        {
          ...ports,
          ...(early
            ? {
                laneClosure: () => {
                  closurePrefixes.push(state.entries().length);
                  return laneClosure();
                },
              }
            : {}),
          *candidates(job, prepared, order) {
            if (job.laneEffect === "none" || job.key === "later") {
              yield* ports.candidates(job, prepared, order);
            } else if (order.rows.some((row) => (job === jobs[2] ? [6, 4] : [4]).includes(row))) {
              const lane = job === jobs[0] ? 2 : job === jobs[1] ? 4 : 3;
              yield* ports.candidates(job, prepared, {
                columnStart: 0,
                columns: [lane],
                rows: order.rows,
              });
            }
          },
          complete: () => {
            const result = ports.complete();
            completions.push(result?.accepted === false ? result.failure.rule : undefined);
            return result;
          },
          test: (job, candidate) => {
            attempts.set(job.key, (attempts.get(job.key) ?? 0) + 1);
            return ports.test(job, candidate);
          },
        },
        road,
        path,
        jobs,
      );
      expect(result.status).toBe("compatible");
      expect(completions).toEqual([...(early ? [] : ["open-stretches"]), undefined]);
      if (early) {
        expect(closurePrefixes.slice(0, 2)).toEqual([1, 2]);
        expect(closurePrefixes).toContain(3);
        expect(closurePrefixes.slice(-4)).toEqual([4, 5, 6, 7]);
      } else {
        expect(closurePrefixes).toEqual([]);
      }
      for (const job of jobs.filter((job) => job.laneEffect === "none")) {
        expect(attempts.get(job.key)).toBe(early ? 1 : 2);
      }
      if (result.status === "compatible") {
        expect(result.witness.map(({ owner }) => owner)).toEqual(jobs);
        expect(result.witness[2]!.entry.request).toBe(repair.request);
        expect(result.witness[2]!.entry.event.distance).toBe(path[4]!.distance);
        expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
          accepted: true,
        });
      }
      expect(state.entries()).toEqual([]);
      expect(context()).toBe(0);
    },
  );

  it("distinguishes an absent lane-closure port from a present exhausted callback", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { jobs, path, pin, ports, state } = fixture(road, [
      { key: "pinned" },
      { auxiliary: true, key: "reward" },
    ]);
    pin(jobs[0]!, 0, 0);
    const before = state.entries();
    const preparations = vi.fn(ports.preparations);
    const test = vi.fn(ports.test);
    expect(
      constructSlotWitness(
        { ...ports, laneClosure: () => undefined, preparations, test },
        road,
        path,
        jobs,
      ),
    ).toEqual({ status: "budget" });
    expect(preparations).not.toHaveBeenCalled();
    expect(test).not.toHaveBeenCalled();
    expect(state.entries()).toEqual(before);
    expect(constructSlotWitness(ports, road, path, jobs).status).toBe("compatible");
  });

  it("exhausts an earlier weighted kind before using another kind or its hint", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { jobs, path, ports } = fixture(road, [{ key: "subject" }]);
    const job = jobs[0]!;
    const later = [...job.preparations()][0]!;
    const footprint = { lanes: 2, rows: 1 };
    const first = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
      compile: () => ({
        blocksLane: true,
        first: true,
        footprint,
        within: [0, 1 / path.length],
      }),
      footprint,
      kind: "first-weighted",
      role: "minorFixed",
      weight: 3,
    });
    job.preparations = () => [first, later];
    const hint = createSlotCandidateDomains(road, path).at(job.key, later, 4, 0)[0]!;
    const result = constructSlotWitness({ ...ports, hint: () => hint }, road, path, jobs);
    expect(result.status).toBe("compatible");
    if (result.status === "compatible") {
      expect(result.witness[0]!.entry.request).toBe(first.request);
      expect(result.witness[0]!.entry.event.distance).toBe(path[0]!.distance);
    }
  });

  it.each([false, true])(
    "tries an advised busy row first without dropping weighted sources or fallback rows (mandatory %s)",
    (guaranteed) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { context, jobs, path, pin, ports, state } = fixture(road, [
        { key: "pinned" },
        { key: "busy" },
        { guaranteed, key: "subject" },
      ]);
      pin(jobs[0]!, 0, 0);
      pin(jobs[1]!, 1, 2);
      const prefix = state.entries();
      const job = jobs[2]!;
      const first = [...job.preparations()][0]!;
      const later = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
        compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 1, rows: 1 } }),
        footprint: { lanes: 1, rows: 1 },
        kind: "later-weighted",
        role: "minorFixed",
        weight: 1,
      });
      job.preparations = () => [first, later];
      const hint = createSlotCandidateDomains(road, path).at(job.key, first, 4, 0)[0]!;
      const rows: { kind: string; row: number }[] = [];
      const trials: { accepted: boolean; row: number }[] = [];
      const repairRow = vi.fn(() => ({ row: 1, status: "row" as const }));
      const result = constructSlotWitness(
        {
          ...ports,
          candidates: (owner, source, order) => {
            rows.push({ kind: source.source.kind, row: order.rows![0]! });
            return ports.candidates(owner, source, order);
          },
          hint: () => hint,
          repairRow,
          test: (owner, candidate) => {
            const checked = ports.test(owner, candidate)!;
            trials.push({
              accepted: checked.accepted,
              row: path.findIndex(({ distance }) => distance === candidate.entry.event.distance),
            });
            return {
              accepted: false,
              failure: { classification: "intrinsic", owners: [], rule: "exhaust-values" },
            };
          },
        },
        road,
        path,
        jobs,
      );
      const ideal = Math.floor(((job.ordinal + 0.5) * path.length) / job.total);
      const fallback = Array.from({ length: path.length }, (_, row) => row)
        .filter((row) => row !== 1)
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b);
      expect(rows).toEqual(
        [first, later].flatMap((source) =>
          [1, ...fallback].map((row) => ({ kind: source.source.kind, row })),
        ),
      );
      expect(trials[0]).toEqual({ accepted: false, row: 1 });
      expect(result).toEqual({ status: "inconclusive" });
      expect(repairRow).toHaveBeenCalledOnce();
      expect(state.entries()).toEqual(prefix);
      expect(context()).toBe(0);
    },
  );

  it("samples fresh row advice for a restored prefix and retains it while retrying the same frame", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { context, jobs, path, pin, ports, state } = fixture(road, [
      { key: "pinned" },
      { key: "choice" },
      { key: "repair" },
      { key: "later" },
    ]);
    pin(jobs[0]!, 0, 2);
    const prefix = state.entries();
    const prefixes: (number | undefined)[] = [];
    const repairRows: number[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        *candidates(job, prepared, order) {
          const choice = state.entries().find(({ owner }) => owner.key === "choice");
          const row = job.key === "repair" ? choice!.entry.event.lane + 1 : 0;
          if (job.key === "repair") {
            repairRows.push(order.rows![0]!);
          }
          if (order.rows?.includes(row)) {
            yield* ports.candidates(job, prepared, {
              columnStart: 0,
              columns: job.key === "choice" ? [0, 1] : [0],
              rows: [row],
            });
          }
        },
        repairRow: () => {
          const lane = state.entries().find(({ owner }) => owner.key === "choice")?.entry
            .event.lane;
          prefixes.push(lane);
          return { row: lane === undefined ? 0 : lane + 1, status: "row" };
        },
      },
      road,
      path,
      jobs,
    );
    expect(result.status).toBe("compatible");
    expect(prefixes).toEqual([undefined, 0, 0, 1, 1]);
    expect(repairRows[0]).toBe(1);
    expect(repairRows.at(-1)).toBe(2);
    if (result.status === "compatible") {
      expect(result.witness.map(({ entry }) => entry.event.lane)).toEqual([2, 1, 0, 0]);
    }
    expect(state.entries()).toEqual(prefix);
    expect(context()).toBe(0);
  });

  it.each(["none", "budget"] as const)(
    "handles %s row advice before lazy preparation",
    (status) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { context, jobs, path, pin, ports, state } = fixture(road, [
        { key: "pinned" },
        { key: "subject" },
      ]);
      pin(jobs[0]!, 0, 0);
      const prefix = state.entries();
      const preparations = vi.fn(ports.preparations);
      const test = vi.fn(ports.test);
      const repairRow = vi.fn(() => ({ status }));
      const result = constructSlotWitness(
        { ...ports, preparations, repairRow, test },
        road,
        path,
        jobs,
      );
      expect(repairRow).toHaveBeenCalledOnce();
      if (status === "budget") {
        expect(result).toEqual({ status: "budget" });
        expect(preparations).not.toHaveBeenCalled();
        expect(test).not.toHaveBeenCalled();
      } else {
        expect(result.status).toBe("compatible");
        expect(test.mock.calls[0]![1].entry.event.distance).toBe(
          path[Math.floor(((jobs[1]!.ordinal + 0.5) * path.length) / jobs[1]!.total)]!.distance,
        );
      }
      expect(state.entries()).toEqual(prefix);
      expect(context()).toBe(0);
    },
  );

  it("uses a fixed anchor before the leading quiet row when its native span covers that row", () => {
    const road = { ...geometry, maxEmptyRows: 0 };
    delete road.firstContactSeconds;
    const positions = [
      [0, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ] as const;
    const { jobs, path, pin, ports, state } = fixture(road, [
      ...positions.map((_, index) => ({ key: `pinned-${index}` })),
      { key: "long", rows: 3 },
    ]);
    positions.forEach(([row, lane], index) => pin(jobs[index]!, row, lane));
    const prefix = state.entries();
    expect(nextCoverageRows(road, prefix)).toEqual([1]);
    const before = state.checkpoint();
    pin(jobs.at(-1)!, 0, 1);
    expect(quietCoverage(road, state.entries())).toEqual({ over: 0, runs: [] });
    expect(state.checkComplete()).toEqual({ accepted: true });
    state.restore(before);

    const construct = createSlotWitnessConstruct(road, path, jobs);
    let charges = 0;
    expect(construct({ ...ports, propagate: () => ++charges < 3 })).toEqual({ status: "budget" });
    expect(charges).toBe(3);
    expect(state.entries()).toEqual(prefix);
    const result = construct(ports);
    expect(result.status).toBe("compatible");
    if (result.status === "compatible") {
      const long = result.witness.find(({ owner }) => owner.key === "long")!;
      expect(long.entry.event.distance).toBe(path[0]!.distance);
      expect(quietCoverage(road, result.witness)).toEqual({ over: 0, runs: [] });
    }
    expect(state.entries()).toEqual(prefix);
  });

  it("prepares weighted fallback kinds lazily for coverage and later owners and closes unused tails", () => {
    const { context, jobs, path, ports, state } = fixture(geometry, [
      { key: "cover-a" },
      { key: "cover-b" },
      { key: "cover-c" },
      { key: "later" },
    ]);
    const compiled: string[] = [];
    const closed: string[] = [];
    for (const job of jobs) {
      const good = [...job.preparations()][0]!;
      job.preparations = function* () {
        try {
          const footprint = { lanes: geometry.laneCount, rows: 1 };
          compiled.push(`${job.key}:wide`);
          yield prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, geometry, {
            compile: () => ({ blocksLane: true, first: true, footprint }),
            footprint,
            kind: `${job.key}:wide`,
            role: "minorFixed",
            weight: 2,
          });
          compiled.push(`${job.key}:good`);
          yield good;
          compiled.push(`${job.key}:tail`);
          yield prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, geometry, {
            compile: () => ({ blocksLane: true, first: true, footprint: { lanes: 1, rows: 1 } }),
            footprint: { lanes: 1, rows: 1 },
            kind: `${job.key}:tail`,
            role: "minorFixed",
            weight: 1,
          });
        } finally {
          closed.push(job.key);
        }
      };
    }
    const repairRow = vi.fn(() => ({ status: "none" as const }));
    const result = constructSlotWitness({ ...ports, repairRow }, geometry, path, jobs);
    expect(result.status).toBe("compatible");
    expect(repairRow).toHaveBeenCalledOnce();
    expect(compiled).toEqual(jobs.flatMap((job) => [`${job.key}:wide`, `${job.key}:good`]));
    expect(closed).toEqual([...jobs].reverse().map((job) => job.key));
    if (result.status === "compatible") {
      expect(result.coverageKey).toBe(jobs[0]!.key);
      expect(result.witness.map(({ entry }) => entry.event.kind)).toEqual(
        jobs.map((job) => job.key),
      );
      expect(createSlotConstructionState(geometry, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
    }
    expect(state.entries()).toEqual([]);
    expect(context()).toBe(0);
  });

  it("backtracks an earlier choice when a later owner cannot fit", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { context, jobs, path, ports, state } = fixture(road, [
      { key: "first" },
      { key: "later" },
    ]);
    const complete = vi.fn(ports.complete);
    let laterAttempts = 0;
    const result = constructSlotWitness(
      {
        ...ports,
        *candidates(job, prepared, order) {
          if (order.rows?.includes(0)) {
            yield* ports.candidates(job, prepared, {
              columnStart: 0,
              columns: job === jobs[0] ? [0, 1] : [0],
              rows: [0],
            });
          }
        },
        complete,
        test: (job, candidate) => {
          if (job === jobs[1]) {
            laterAttempts++;
          }
          return ports.test(job, candidate);
        },
      },
      road,
      path,
      jobs,
    );
    expect(result.status).toBe("compatible");
    expect(laterAttempts).toBe(2);
    expect(complete).toHaveBeenCalledOnce();
    if (result.status === "compatible") {
      expect(result.witness.map(({ entry }) => entry.event.lane)).toEqual([1, 0]);
    }
    expect(state.entries()).toEqual([]);
    expect(context()).toBe(0);
  });

  it.each(["refuted", "budget", "fatal"] as const)(
    "handles conditional support %s without retaining its hypothetical state",
    (status) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { context, jobs, path, ports, state } = fixture(road, [{ key: "subject" }]);
      const failure = { classification: "unattributed" as const, owners: [], rule: "overflow" };
      let attempts = 0;
      const complete = vi.fn(ports.complete);
      const result = constructSlotWitness(
        {
          ...ports,
          complete,
          support: () => {
            attempts++;
            return status === "fatal" ? { failure, status } : { status };
          },
        },
        road,
        path,
        jobs,
      );
      expect(result).toEqual(
        status === "fatal"
          ? { failure, status: "blocked" }
          : { status: status === "refuted" ? "inconclusive" : "budget" },
      );
      if (status === "refuted") {
        expect(attempts).toBeGreaterThan(1);
      } else {
        expect(attempts).toBe(1);
      }
      expect(complete).not.toHaveBeenCalled();
      expect(state.entries()).toEqual([]);
      expect(context()).toBe(0);
    },
  );

  it("invalidates job metadata and old hints when the preparation method is replaced", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { jobs, path, pin, ports } = fixture(road, [
      { key: "pinned" },
      { guaranteed: true, key: "subject" },
    ]);
    pin(jobs[0]!, 0, 0);
    const construct = createSlotWitnessConstruct(road, path, jobs);
    const warm = warmPorts(ports);
    expect(construct(warm.ports).status).toBe("compatible");
    warm.clear();
    const footprint = { lanes: 2, rows: 1 };
    const replacement = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, road, {
      compile: () => ({ blocksLane: true, first: true, footprint }),
      footprint,
      kind: "subject",
      role: "minorFixed",
      weight: 1,
    });
    jobs[1]!.preparations = () => [replacement];
    const result = construct(warm.ports);
    expect(result.status).toBe("compatible");
    expect(warm.preparations).toHaveBeenCalledTimes(1);
    expect(warm.candidates).toHaveBeenCalled();
    if (result.status === "compatible") {
      expect(result.witness.find(({ owner }) => owner === jobs[1])!.entry.request).toBe(
        replacement.request,
      );
    }
  });

  it("does not publish a truncated preparation list when the producer stops", () => {
    const road = { ...geometry, maxEmptyRows: Infinity };
    const { jobs, path, pin, ports } = fixture(road, [
      { key: "pinned" },
      { guaranteed: true, key: "subject" },
    ]);
    pin(jobs[0]!, 0, 0);
    const original = [...jobs[1]!.preparations()][0]!;
    let stop = false;
    let interrupt = true;
    jobs[1]!.preparations = function* () {
      yield original;
      if (interrupt) {
        stop = true;
      }
    };
    const construct = createSlotWitnessConstruct(road, path, jobs);
    const warm = warmPorts({ ...ports, stopped: () => stop });
    expect(construct(warm.ports)).toEqual({ status: "budget" });
    expect(warm.preparations).toHaveBeenCalledTimes(1);
    stop = false;
    interrupt = false;
    expect(construct(warm.ports).status).toBe("compatible");
    expect(warm.preparations).toHaveBeenCalledTimes(2);
    warm.clear();
    expect(construct(warm.ports).status).toBe("compatible");
    expect(warm.preparations).not.toHaveBeenCalled();
    warm.clear();
    stop = true;
    expect(construct(warm.ports)).toEqual({ status: "budget" });
    expect(warm.preparations).not.toHaveBeenCalled();
    expect(warm.test).not.toHaveBeenCalled();
    expect(warm.complete).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "tries initial coverage before wide guarantees only when enabled (%s)",
    (coverageFirst) => {
      const road = { ...geometry, laneCount: 5, minOpenLanes: 2, pathStart: 4 };
      delete road.firstContactSeconds;
      const { context, jobs, path, ports, state } = fixture(road, [
        { guaranteed: true, key: "wide", moving: true, width: 3 },
        { guaranteed: true, key: "required-cover" },
        { key: "cover-a" },
        { key: "cover-b" },
        { key: "cover-c" },
      ]);
      const accepted: string[] = [];
      const result = constructSlotWitness(
        {
          ...ports,
          coverageFirst,
          test(job, candidate) {
            const result = ports.test(job, candidate);
            if (result?.accepted) {
              accepted.push(job.key);
            }
            return result;
          },
        },
        road,
        path,
        jobs,
      );
      expect(accepted[0]).toBe(coverageFirst ? "required-cover" : "wide");
      expect(result.status).toBe("compatible");
      if (result.status !== "compatible") {
        throw new Error("Expected a complete native witness");
      }
      expect(new Set(result.witness.map(({ owner }) => owner))).toEqual(new Set(jobs));
      expect(quietCoverage(road, result.witness).over).toBe(0);
      expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
      expect(state.entries()).toEqual([]);
      expect(context()).toBe(0);
    },
  );

  it("restores ordinary mandatory choices when the initial fixed coverage domain is empty", () => {
    const road = { ...geometry, laneCount: 5, minOpenLanes: 2, pathStart: 4 };
    delete road.firstContactSeconds;
    const { context, jobs, path, ports, state } = fixture(
      road,
      [
        { guaranteed: true, key: "wide", moving: true, width: 3 },
        { guaranteed: true, key: "late-cover", within: [0.5, 1] },
      ],
      500,
    );
    const visited: string[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        candidates(job, prepared, order) {
          visited.push(job.key);
          return ports.candidates(job, prepared, order);
        },
        coverageFirst: true,
      },
      road,
      path,
      jobs,
    );
    expect(visited[0]).toBe("late-cover");
    expect(visited).toContain("wide");
    expect(result.status).not.toBe("compatible");
    expect(state.entries()).toEqual([]);
    expect(context()).toBe(0);
  });

  it.each([false, true])(
    "tries native moving gap anchors before an unrelated warm suffix (fair sources %s)",
    (fairSources) => {
      const road = { ...geometry, maxEmptyRows: 1 };
      const { context, jobs, path, pin, ports, state } = fixture(road, [
        { key: "first" },
        { key: "second" },
        { key: "third" },
        { key: "last" },
        { key: "moving", moving: true },
      ]);
      [0, 2, 4, 7].forEach((row, index) => pin(jobs[index]!, row, 0));
      const prefix = state.entries();
      const leading = nextCoverageRows(road, prefix)!;
      expect(leading).toEqual([6, 5]);
      const job = jobs[4]!;
      const source = [...job.preparations()][0]!;
      const domains = createSlotCandidateDomains(road, path);
      const warm = domains.at(job.key, source, 6, 1)[0]!;
      expect(
        visibleMoverRows(
          road,
          path.map(({ distance }) => distance),
          warm.entry,
        ).some((row) => leading.includes(row)),
      ).toBe(false);
      const native = state.checkpoint();
      expect(state.commit(job, warm.entry).accepted).toBe(true);
      state.restore(native);
      const accepted: SlotCandidate<string>[] = [];
      const result = constructSlotWitness(
        {
          ...ports,
          candidates: (owner, prepared, order) =>
            ports.candidates(owner, prepared, { ...order, columns: [1] }),
          fairSources,
          hint: () => warm,
          minimumDelivery: jobs.length,
          test(owner, candidate) {
            const checked = ports.test(owner, candidate);
            if (checked?.accepted) {
              accepted.push(candidate);
            }
            return checked;
          },
        },
        road,
        path,
        jobs,
      );
      expect(accepted.length).toBeGreaterThan(0);
      const visible = visibleMoverRows(
        road,
        path.map(({ distance }) => distance),
        accepted[0]!.entry,
      );
      expect(visible.some((row) => leading.includes(row))).toBe(true);
      expect(accepted[0]).not.toBe(warm);
      expect(result.status).toBe("compatible");
      if (result.status === "compatible") {
        expect(quietCoverage(road, result.witness).over).toBe(0);
        expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
          accepted: true,
        });
      }
      expect(state.entries()).toEqual(prefix);
      expect(context()).toBe(0);
    },
  );

  it("retains later weighted sources and every ordinary moving anchor during quiet repair", () => {
    const road = { ...geometry, maxEmptyRows: 1 };
    const { context, jobs, path, pin, ports, state } = fixture(road, [
      { key: "first" },
      { key: "second" },
      { key: "third" },
      { key: "last" },
      { key: "moving", moving: true },
    ]);
    [0, 2, 4, 7].forEach((row, index) => pin(jobs[index]!, row, 0));
    const prefix = state.entries();
    const job = jobs[4]!;
    const first = [...job.preparations()][0]!;
    const later = crossing(road);
    job.preparations = () => [first, later];
    const rows = new Map<string, number[]>();
    const native: { accepted: boolean; kind: string; row: number }[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        *candidates(owner, prepared, order) {
          const visited = rows.get(prepared.source.kind) ?? [];
          visited.push(order.rows![0]!);
          rows.set(prepared.source.kind, visited);
          yield* ports.candidates(owner, prepared, order);
        },
        minimumDelivery: jobs.length,
        test(owner, candidate) {
          const checked = ports.test(owner, candidate)!;
          native.push({
            accepted: checked.accepted,
            kind: candidate.prepared.source.kind,
            row: candidate.entry.trace.placement!.block.row,
          });
          return {
            accepted: false,
            failure: { classification: "intrinsic", owners: [], rule: "exhaust-values" },
          };
        },
      },
      road,
      path,
      jobs,
    );
    expect([...rows.keys()]).toEqual([first.source.kind, later.source.kind]);
    for (const visited of rows.values()) {
      expect([...visited].sort((a, b) => a - b)).toEqual(path.map((_, row) => row));
    }
    expect(native.some(({ accepted, kind }) => accepted && kind === later.source.kind)).toBe(true);
    expect(
      native.some(({ accepted, kind, row }) => accepted && kind === first.source.kind && row === 6),
    ).toBe(true);
    expect(native.some(({ row }) => row === 0)).toBe(true);
    expect(result).toEqual({ status: "inconclusive" });
    expect(state.entries()).toEqual(prefix);
    expect(context()).toBe(0);
  });

  it("samples only one native template and retains all ordinary rows in a warm hint cache", () => {
    const { jobs, path } = fixture(geometry, [{ key: "moving", moving: true }]);
    const prepared = [...jobs[0]!.preparations()][0]!;
    const reads: number[] = [];
    const source = {
      ...prepared,
      placements: new Proxy(prepared.placements, {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) {
            reads.push(Number(key));
            if (Number(key) > 0) {
              throw new Error("Only the first complete native template supplies hints");
            }
          }
          return Reflect.get(target, key, receiver);
        },
      }),
    };
    const hints = createMovingCoverageHints(geometry);
    const propagate = vi.fn(() => true);
    const rows = path.map((_, row) => row).reverse();
    const first = hints({ propagate }, [5], rows, source)!;
    const inspected = propagate.mock.calls.length;
    const warm = hints({ propagate }, [2], rows, source)!;
    expect([...first].sort((a, b) => a - b)).toEqual(path.map((_, row) => row));
    expect([...warm].sort((a, b) => a - b)).toEqual(path.map((_, row) => row));
    expect(reads).toEqual([0]);
    expect(propagate.mock.calls.length - inspected).toBeLessThan(inspected);
  });

  it.each(["budget", "cancel"] as const)(
    "closes an interrupted moving hint scan and restores native state on %s",
    (mode) => {
      const road = { ...geometry, maxEmptyRows: 1 };
      const { context, jobs, path, pin, ports, state } = fixture(road, [
        { key: "first" },
        { key: "second" },
        { key: "third" },
        { key: "last" },
        { key: "moving", moving: true },
      ]);
      [0, 2, 4, 7].forEach((row, index) => pin(jobs[index]!, row, 0));
      const prefix = state.entries();
      const job = jobs[4]!;
      const prepared = [...job.preparations()][0]!;
      let closed = false;
      let calls = 0;
      job.preparations = function* () {
        try {
          yield prepared;
        } finally {
          closed = true;
        }
      };
      const candidates = vi.fn(ports.candidates);
      const test = vi.fn(ports.test);
      expect(
        constructSlotWitness(
          {
            ...ports,
            candidates,
            minimumDelivery: jobs.length,
            propagate: () => ++calls < 3 || mode === "cancel",
            stopped: () => mode === "cancel" && calls >= 3,
            test,
          },
          road,
          path,
          jobs,
        ),
      ).toEqual({ status: "budget" });
      expect(closed).toBe(true);
      expect(candidates).not.toHaveBeenCalled();
      expect(test).not.toHaveBeenCalled();
      expect(state.entries()).toEqual(prefix);
      expect(context()).toBe(0);
    },
  );
});

describe("balanced runtime ordinary selection", () => {
  it("interleaves native job traits while retaining mandatory priority and original sources", () => {
    const road = { ...geometry, maxEmptyRows: Infinity, zoneLength: 3000 };
    const { jobs, path, ports, state } = fixture(road, [
      { key: "fixed-a" },
      { key: "fixed-b" },
      { key: "moving-a", moving: true },
      { key: "moving-b", moving: true },
      { auxiliary: true, key: "reward-a" },
      { auxiliary: true, key: "reward-b" },
      { guaranteed: true, key: "mandatory" },
    ]);
    const original = [...jobs];
    const accepted: string[] = [];
    const result = constructSlotWitness(
      {
        ...ports,
        minimumDelivery: 7,
        ordinaryOrder: "balanced",
        test(job, candidate) {
          const result = ports.test(job, candidate);
          if (result?.accepted) {
            accepted.push(job.key);
          }
          return result;
        },
      },
      road,
      path,
      jobs,
    );
    expect(result.status).toBe("compatible");
    expect(accepted).toEqual([
      "mandatory",
      "fixed-a",
      "moving-a",
      "reward-a",
      "fixed-b",
      "moving-b",
      "reward-b",
    ]);
    expect(jobs).toEqual(original);
    if (result.status === "compatible") {
      expect(createSlotConstructionState(road, path, result.witness).checkComplete()).toEqual({
        accepted: true,
      });
    }
    expect(state.entries()).toEqual([]);
  });

  it.each([1, 4, 12])(
    "restores the native root when order partition or merge stops at charge %s",
    (limit) => {
      const road = { ...geometry, maxEmptyRows: Infinity };
      const { jobs, path, pin, ports, state } = fixture(road, [
        { guaranteed: true, key: "mandatory" },
        { key: "fixed" },
        { auxiliary: true, key: "reward" },
      ]);
      pin(jobs[0]!, 0, 0);
      const before = state.entries();
      let charges = 0;
      const test = vi.fn(ports.test);
      const result = constructSlotWitness(
        {
          ...ports,
          minimumDelivery: 3,
          ordinaryOrder: "balanced",
          propagate: () => ++charges < limit,
          test,
        },
        road,
        path,
        jobs,
      );
      expect(result).toEqual({ status: "budget" });
      expect(charges).toBe(limit);
      expect(test).not.toHaveBeenCalled();
      expect(state.entries()).toEqual(before);
    },
  );
});
