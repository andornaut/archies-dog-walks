import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { plannerStreams } from "../testing/movers";
import { GAME_ROAD } from "../testing/planner";
import { assignedMovement } from "./movementAssignments";
import { moverSpec } from "./moverSpecs";
import {
  createSlotCandidateDomains,
  type SlotCandidate,
  type SlotOwnerDomainToken,
} from "./slotCandidateDomains";
import * as native from "./slotCandidates";
import { slotMotionStreams } from "./slotEntropy";
import { createSlotFeasibility } from "./slotFeasibility";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning";
import { itemHeight } from "./walk";
import { footprintOf } from "./walkItems";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
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
  pathStart: 4,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
  distance,
  lane: 4,
}));

const stopSource = {
  compile: () => ({
    blocksLane: true,
    first: true,
    mover: {
      footprint: { lanes: 1, rows: 1 },
      motion: {
        kind: "cross" as const,
        lanesPerSecond: 2,
        pause: { seconds: 0.1, stops: [[2, 2]] as const },
        reactionSeconds: 0,
        startRoadShare: [0, 0] as const,
        stopLanes: { max: 2, min: 2 },
        stopShare: 1,
        tilt: [0, 0] as const,
        turnAtShare: [0.5, 0.5] as const,
        turnBackShare: 0,
        vergeShare: 0,
      },
      movement: "stopAndGoAcross" as const,
      variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
      warningSeconds: 0,
    },
  }),
  footprint: { lanes: 1, rows: 1 },
  kind: "dart",
  role: "minorMoving" as const,
  weight: 1,
};

describe("compiled native slot domains", () => {
  it("attests exact full owner EOF without row projections and rejects changed native provenance", () => {
    const prepared = native.prepareSlotKind(plannerStreams(3), geometry, stopSource);
    const owner = { key: "owner", phase: "active" as const, preparations: () => [prepared] };
    const domains = createSlotCandidateDomains(geometry, path);
    const scope = domains.pocketScope([owner]);
    const work = {
      anchor: () => true,
      check: () => true,
      propagate: () => true,
      stopped: () => false,
    };
    const values: SlotCandidate<string>[] = [];
    let token: SlotOwnerDomainToken | undefined;
    for (const step of domains.completeOwnerDomain(work, scope, owner)) {
      if (step.status === "candidate") {
        values.push(step.value);
      } else if (step.status === "complete") {
        token = step.token;
      } else {
        throw new Error(`Unexpected native frontier ${step.status}`);
      }
    }
    expect(values.length).toBeGreaterThan(1);
    expect(token).toBeDefined();
    const projections = vi.spyOn(domains, "guaranteedWalls");
    expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, token!)).toBe(true);
    expect(projections).not.toHaveBeenCalled();
    expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values.slice(1), token!)).toBe(
      false,
    );
    expect(
      domains.attestsCompleteOwnerDomain(work, scope, owner, [...values].reverse(), token!),
    ).toBe(false);
    expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, { ...token! })).toBe(
      false,
    );
    expect(domains.attestsCompleteOwnerDomain(work, scope, { ...owner }, values, token!)).toBe(
      false,
    );
    expect(
      domains.attestsCompleteOwnerDomain(
        { ...work, propagate: () => false },
        scope,
        owner,
        values,
        token!,
      ),
    ).toBeUndefined();
    const mover = values[0]!.entry.event.mover!;
    const warning = mover.warning;
    try {
      Reflect.set(mover, "warning", warning + 1);
      expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, token!)).toBe(false);
    } finally {
      Reflect.set(mover, "warning", warning);
    }
    expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, token!)).toBe(true);
    owner.preparations = () => [];
    expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, token!)).toBe(false);
    projections.mockRestore();
  });

  it("enumerates once with stable identities and exact repeated weighted occurrences", () => {
    const prepared = native.prepareSlotKind(plannerStreams(3), geometry, {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: { kind: "ride", speedMultiplier: 1.5 },
          movement: "inLane",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0.2,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "rider",
      role: "minorMoving",
      weight: 1,
    });
    const original = prepared.placements.find((placement) => placement.lane === 0)!;
    const alternate = { ...original };
    const repeated = { ...prepared, placements: [original, alternate, original] };
    const before = JSON.stringify(repeated);
    const domain = createSlotCandidateDomains(geometry, path);
    const spy = vi.spyOn(native, "slotPlacementsAt");
    let candidates;
    try {
      candidates = domain.at("active:minorMoving:0", repeated, 3, 0);
      expect(domain.at("active:minorMoving:0", repeated, 3, 0)).toBe(candidates);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
    const expected = native.slotPlacementsAt(
      geometry,
      { distance: path[3]!.distance, lane: 0, row: 3, slot: 0 },
      repeated,
    );
    expect(candidates.map((candidate) => candidate.entry)).toEqual(expected);
    expect(candidates[0]).toBe(candidates[2]);
    expect(candidates[0]!.id).not.toBe(candidates[1]!.id);
    expect(candidates.map((candidate) => candidate.multiplicity)).toEqual([2, 1, 2]);
    expect(Object.isFrozen(candidates)).toBe(true);
    expect(Object.isFrozen(candidates[0])).toBe(true);
    expect(Object.isFrozen(candidates[0]!.entry.trace)).toBe(true);
    for (const candidate of candidates) {
      expect(candidate.entry.trace.quotaIndex).toBe(0);
      expect(candidate.entry.event.mover).toBe(candidate.entry.placement!.path);
    }
    const other = createSlotCandidateDomains(geometry, path);
    other.at("active:minorMoving:0", repeated, 4, 0);
    expect(
      other.at("active:minorMoving:0", repeated, 3, 0).map((candidate) => candidate.id),
    ).toEqual(candidates.map((candidate) => candidate.id));
    expect(domain.at("active:minorMoving:0", repeated, 4, 0)[0]!.id).not.toBe(candidates[0]!.id);
    expect(JSON.stringify(repeated)).toBe(before);
    const changed = native.prepareSlotKind(plannerStreams(3), geometry, {
      ...prepared.source,
      compile: () => ({
        blocksLane: true,
        mover: {
          ...prepared.request.mover!,
          motion: { kind: "ride", speedMultiplier: 2 },
        },
        within: [0.9, 1],
      }),
    });
    const changedCandidates = domain.at("active:minorMoving:0", changed, 3, 0);
    expect(changedCandidates[0]!.id).not.toBe(candidates[0]!.id);
    expect(domain.intrinsic(candidates[0]!)).toEqual({ accepted: true });
    expect(domain.intrinsic(changedCandidates[0]!)).toEqual({
      accepted: false,
      rule: "quota-span",
    });
    expect(domain.at("active:minorMoving:0", repeated, 3, 0)).toBe(candidates);

    const order = { columnStart: 0, columns: [0], rows: [3] };
    const beforeCardinality = domain.statistics();
    expect(domain.completedCardinality(order, "active:minorMoving:0", repeated)).toBeUndefined();
    expect(domain.statistics()).toEqual(beforeCardinality);
    const occurrences = [
      ...domain.sequence(
        { anchor: () => true, check: () => true },
        order,
        "active:minorMoving:0",
        repeated,
      ),
    ];
    expect(
      occurrences.map((step) => (step.status === "candidate" ? step.candidate : undefined)),
    ).toEqual(candidates);
    expect(domain.completedCardinality(order, "active:minorMoving:0", repeated)).toBe(2);
    expect([
      ...domain.sequence(
        {
          anchor: () => false,
          check: () => false,
          exclude: () => new Set(candidates.map(({ id }) => id)),
        },
        order,
        "active:minorMoving:0",
        repeated,
      ),
    ]).toEqual([]);
    expect(domain.completedCardinality(order, "active:minorMoving:0", repeated)).toBe(2);

    expect(() => other.intrinsic(candidates[0]!)).toThrow("another compiled domain");
  });

  it("replays compact valid sequences without revisiting invalid anchors or hiding budget exits", () => {
    const prepared = native.prepareSlotKind(plannerStreams(1), geometry, {
      compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 }, within: [0, 0.25] }),
      footprint: { lanes: 1, rows: 1 },
      kind: "prize",
      role: "minorFixed",
      weight: 1,
    });
    const domain = createSlotCandidateDomains(geometry, path);
    const order = { columnStart: 0, columns: [0], rows: [10, 0] };
    const work = { anchor: vi.fn(() => true), check: vi.fn(() => true) };
    const first = [...domain.sequence(work, order, "job", prepared)];
    expect(first).toEqual([
      { candidate: domain.at("job", prepared, 0, 0)[0], status: "candidate" },
    ]);
    expect(work.anchor).toHaveBeenCalledTimes(2);
    expect(work.check).toHaveBeenCalledTimes(2);
    expect([
      ...domain.sequence(work, { ...order, rows: [...order.rows] }, "job", prepared),
    ]).toEqual(first);
    expect(work.anchor).toHaveBeenCalledTimes(2);
    expect(work.check).toHaveBeenCalledTimes(2);
    expect(domain.statistics()).toMatchObject({
      expansions: 2,
      replays: 1,
      traversals: 2,
      unaryChecks: 2,
    });

    // Another ordered domain is new traversal work even when native anchors are cached.
    expect([
      ...domain.sequence(work, { ...order, rows: [...order.rows].reverse() }, "job", prepared),
    ]).toEqual(first);
    expect(work.anchor).toHaveBeenCalledTimes(4);
    expect(work.check).toHaveBeenCalledTimes(2);
    const stopped = { anchor: vi.fn(() => true), check: vi.fn(() => false) };
    expect([...domain.sequence(stopped, { ...order, rows: [1] }, "job", prepared)]).toEqual([
      { kind: "candidateChecks", status: "budget" },
    ]);
    expect(domain.completedCardinality({ ...order, rows: [1] }, "job", prepared)).toBeUndefined();
    expect([...domain.sequence(work, { ...order, rows: [1] }, "job", prepared)]).toHaveLength(1);
    expect(work.anchor).toHaveBeenCalledTimes(4);
    expect(stopped.anchor).toHaveBeenCalledTimes(1);
    const noAnchor = { anchor: () => false, check: () => true };
    expect([...domain.sequence(noAnchor, { ...order, rows: [2] }, "job", prepared)]).toEqual([
      { kind: "anchors", status: "budget" },
    ]);
    expect([...domain.sequence(work, { ...order, rows: [2] }, "job", prepared)]).toHaveLength(1);
    expect(work.anchor).toHaveBeenCalledTimes(5);
  });

  it("replays filtered native frontiers without rescanning known rejected values", () => {
    const prepared = native.prepareSlotKind(plannerStreams(1), geometry, {
      compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 } }),
      footprint: { lanes: 1, rows: 1 },
      kind: "prize",
      role: "minorFixed",
      weight: 1,
    });
    const domains = createSlotCandidateDomains(geometry, path);
    const order = { columnStart: 0, columns: [0], rows: [0, 1, 2] };
    const work = { anchor: () => true, check: () => true };
    const original = [...domains.sequence(work, order, "job", prepared)];
    const rejected = new Set(
      original.slice(0, 2).map((step) => (step.status === "candidate" ? step.candidate.id : "")),
    );
    const filtered = { ...work, exclude: () => rejected, propagate: () => true };
    expect([...domains.sequence(filtered, order, "job", prepared)]).toEqual(original.slice(2));
    const before = domains.statistics();
    expect([...domains.sequence(filtered, order, "job", prepared)]).toEqual(original.slice(2));
    expect(domains.statistics().filterScans).toBe(before.filterScans);
    expect(domains.statistics().unaryChecks).toBe(before.unaryChecks);
    expect(domains.statistics().replays).toBe(before.replays + 1);
    expect([
      ...domains.sequence(
        { ...filtered, exclude: () => new Set(), propagate: () => false },
        order,
        "job",
        prepared,
      ),
    ]).toEqual(original);
    expect([
      ...domains.sequence(
        { ...filtered, exclude: () => new Set(["new"]), propagate: () => false },
        order,
        "job",
        prepared,
      ),
    ]).toEqual([{ kind: "propagation", status: "budget" }]);
  });

  it("projects trusted stop groups before translation while preserving raw identities and foreign validation", () => {
    const source = stopSource;
    const prepared = native.prepareSlotKind(
      { movers: () => 0.9, spawns: () => 0.9 },
      geometry,
      source,
    );
    const template = prepared.placements.find((placement) => placement.stop !== undefined)!;
    expect(template).toBeDefined();
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.placements)).toBe(true);
    expect(Object.isFrozen(template.stop)).toBe(true);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(prepared.request.mover)).toBe(false);
    const blockedPath = path.map((row) => ({ ...row, lane: template.stop!.first }));
    const projection = native.createSlotPathProjection(geometry, blockedPath);
    const anchor = { distance: path[4]!.distance, lane: template.lane, row: 4, slot: 0 };
    const work = { check: vi.fn(() => true), propagate: vi.fn(() => true) };
    const raw = native.slotPlacementsAt(geometry, anchor, prepared);
    expect(raw.length).toBeGreaterThan(0);
    const projected = projection.at(work, anchor, prepared);
    expect(projected).toMatchObject({ entries: [], status: "entries" });
    expect(projection.statistics().skippedTemplates).toBeGreaterThan(0);
    const evaluations = work.check.mock.calls.length;
    const another = native.prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
      ...source,
      kind: "another",
    });
    expect(projection.at(work, anchor, another)).toMatchObject({ entries: [], status: "entries" });
    expect(work.check).toHaveBeenCalledTimes(evaluations);
    expect(projection.statistics().stopReuse).toBeGreaterThan(0);
    const unequal = native.prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
      ...source,
      compile: () => {
        const compiled = source.compile();
        return {
          ...compiled,
          blocksLane: false,
          mover: {
            ...compiled.mover,
            motion: { ...compiled.mover.motion, pause: { seconds: 0.1, stops: [[1, 1]] as const } },
          },
        };
      },
    });
    const unequalResult = projection.at(work, anchor, unequal);
    expect(unequalResult.status).toBe("entries");
    if (unequalResult.status !== "entries") {
      throw new Error("Expected an eligible stop group");
    }
    expect(unequalResult.entries.length).toBeGreaterThan(0);
    expect(work.check).toHaveBeenCalledTimes(evaluations + 1);
    const foreign = { ...prepared, request: { ...prepared.request, count: 2 } };
    const foreignResult = projection.at(work, anchor, foreign);
    expect(foreignResult.status).toBe("entries");
    if (foreignResult.status !== "entries") {
      throw new Error("Expected the raw foreign catalogue");
    }
    expect(foreignResult.entries).toHaveLength(raw.length);
    const foreignDomain = createSlotCandidateDomains(geometry, blockedPath);
    expect(
      foreignDomain.intrinsic(foreignDomain.at("foreign", foreign, 4, template.lane)[0]!),
    ).toEqual({ accepted: false, rule: "request-identity" });
    const interrupted = native.createSlotPathProjection(geometry, blockedPath);
    expect(interrupted.at({ check: () => false }, anchor, prepared)).toEqual({
      kind: "candidateChecks",
      status: "budget",
    });
    expect(interrupted.at(work, anchor, prepared)).toMatchObject({
      entries: [],
      status: "entries",
    });
    const interruptedDomain = createSlotCandidateDomains(geometry, blockedPath);
    const anchorWork = vi.fn(() => true);
    const order = { columnStart: 0, columns: [template.lane], rows: [4] };
    expect([
      ...interruptedDomain.sequence(
        { anchor: anchorWork, check: () => false },
        order,
        "stopped",
        prepared,
      ),
    ]).toEqual([{ kind: "candidateChecks", status: "budget" }]);
    expect([
      ...interruptedDomain.sequence(
        { anchor: anchorWork, check: () => true },
        order,
        "stopped",
        prepared,
      ),
    ]).toEqual([]);
    expect(anchorWork).toHaveBeenCalledTimes(1);
    const unblocked = native.prepareSlotKind({ movers: () => 0.9, spawns: () => 0.9 }, geometry, {
      ...source,
      compile: () => ({ ...source.compile(), blocksLane: false }),
    });
    const safePath = path.map((row) => ({ ...row, lane: 0 }));
    const domain = createSlotCandidateDomains({ ...geometry, pathStart: 0 }, safePath);
    const steps = [
      ...domain.sequence(
        { anchor: () => true, check: () => true },
        { columnStart: 0, columns: [template.lane], rows: [4] },
        "native",
        unblocked,
      ),
    ];
    const actual = domain.at("native", unblocked, 4, template.lane);
    const valid = actual.filter((candidate) => domain.intrinsic(candidate).accepted);
    expect(valid.length).toBeGreaterThan(0);
    expect(steps).toEqual(valid.map((candidate) => ({ candidate, status: "candidate" })));
    expect(
      steps.every((step) => step.status === "candidate" && actual.includes(step.candidate)),
    ).toBe(true);
  });

  it("reports immutable raccoon path failure before a mutable cell conflict can mask it", () => {
    const capturedGeometry = {
      cellInset: -18.79754601226989,
      cellLength: 64,
      fixedKinds: [],
      laneCount: 5,
      laneInset: 12,
      laneMoveSeconds: 0.11111111111111112,
      maxEmptyRows: 3,
      minOpenLanes: 2,
      minSpacing: 213,
      moverCaps: {
        darts: 6,
        slowVehicles: 4,
        total: 10,
      },
      packHitLength: 162.1538461538462,
      packLength: 166.1538461538462,
      pathLaneMoveSeconds: 0.33670033670033667,
      pathStart: 3,
      reactionSeconds: 0.5,
      riderFollowGap: 64,
      roadLength: 724,
      scrollSpeed: 300,
      sightLength: 553.8461538461538,
      stepSeconds: 0.016666666666666666,
      zoneLength: 7400,
    };
    const capturedPath = [
      {
        distance: 308,
        lane: 3,
      },
      {
        distance: 616,
        lane: 3,
      },
      {
        distance: 924,
        lane: 3,
      },
      {
        distance: 1232,
        lane: 4,
      },
      {
        distance: 1540,
        lane: 4,
      },
      {
        distance: 1848,
        lane: 3,
      },
      {
        distance: 2156,
        lane: 3,
      },
      {
        distance: 2464,
        lane: 2,
      },
      {
        distance: 2772,
        lane: 2,
      },
      {
        distance: 3080,
        lane: 1,
      },
      {
        distance: 3388,
        lane: 1,
      },
      {
        distance: 3696,
        lane: 2,
      },
      {
        distance: 4004,
        lane: 2,
      },
      {
        distance: 4312,
        lane: 2,
      },
      {
        distance: 4620,
        lane: 1,
      },
      {
        distance: 4928,
        lane: 1,
      },
      {
        distance: 5236,
        lane: 2,
      },
      {
        distance: 5544,
        lane: 2,
      },
      {
        distance: 5852,
        lane: 2,
      },
      {
        distance: 6160,
        lane: 2,
      },
      {
        distance: 6468,
        lane: 3,
      },
      {
        distance: 6776,
        lane: 3,
      },
      {
        distance: 7084,
        lane: 2,
      },
    ];
    const movement = assignedMovement(gameData, "yongeStreet", "raccoon")!;
    const footprint = footprintOf(gameData, "raccoon");
    const prepared = native.prepareSlotKind(
      slotMotionStreams({ seed: 3, zoneIndex: 3 }, "active:minorMoving:11", "raccoon"),
      capturedGeometry,
      {
        compile: (streams) => ({
          blocksLane: true,
          first: false,
          hazard: true,
          hitLength: itemHeight(gameData, GAME_ROAD, "raccoon", false),
          mover: {
            ...moverSpec(gameData, streams, footprint, movement),
            hitLength: itemHeight(gameData, GAME_ROAD, "raccoon", true),
          },
        }),
        footprint,
        kind: "raccoon",
        role: "minorMoving",
        weight: 1,
      },
    );
    const domain = createSlotCandidateDomains(capturedGeometry, capturedPath);
    const candidate = domain.at("active:minorMoving:11", prepared, 6, 1)[0]!;
    const proof = domain.intrinsic(candidate);
    expect(proof).toEqual({ accepted: false, rule: "path" });
    expect(domain.intrinsic(candidate)).toBe(proof);
    const rows = zoneRows(capturedGeometry, rowSpacing({ ...capturedGeometry, quotas: [] }));
    const blockerPrepared = native.prepareSlotKind(plannerStreams(1), capturedGeometry, {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: { kind: "ride", speedMultiplier: 1.5 },
          movement: "inLane",
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0.2,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "blocker",
      role: "minorMoving",
      weight: 1,
    });
    const empty = createSlotFeasibility(capturedGeometry, capturedPath);
    const blocker = candidate.entry.trace
      .placement!.cells.flatMap((cell) => {
        if (cell.row < 0 || cell.row >= rows.length) {
          return [];
        }
        return native.slotPlacementsAt(
          capturedGeometry,
          { distance: rows[cell.row]!, lane: cell.lane, row: cell.row, slot: 0 },
          blockerPrepared,
        );
      })
      .find(
        (entry) =>
          empty.probe(entry).accepted &&
          entry.trace.placement!.cells.some((other) =>
            candidate.entry.trace.placement!.cells.some(
              (cell) => cell.row === other.row && cell.lane === other.lane,
            ),
          ),
      )!;
    expect(blocker).toBeDefined();
    const original = native.slotPlacementsAt(
      capturedGeometry,
      { distance: rows[6]!, lane: 1, row: 6, slot: 1 },
      prepared,
    )[0]!;
    expect(
      createSlotFeasibility<string>(capturedGeometry, capturedPath, [blocker]).probe(original),
    ).toMatchObject({
      accepted: false,
      failure: { classification: "intrinsic", conflicts: [], rule: "path" },
    });
    expect(domain.intrinsic(candidate)).toBe(proof);
    const safe = createSlotCandidateDomains(
      { ...capturedGeometry, pathStart: 4 },
      capturedPath.map((row) => ({ ...row, lane: 4 })),
    );
    expect(safe.intrinsic(safe.at("active:minorMoving:11", prepared, 6, 1)[0]!)).toEqual({
      accepted: true,
    });
  });

  it("keeps quota and native row bounds as intrinsic facts without pruning occurrences", () => {
    const within = native.prepareSlotKind(plannerStreams(1), geometry, {
      compile: () => ({ blocksLane: false, footprint: { lanes: 1, rows: 1 }, within: [0, 0.25] }),
      footprint: { lanes: 1, rows: 1 },
      kind: "prize",
      role: "minorFixed",
      weight: 1,
    });
    const domain = createSlotCandidateDomains(geometry, path);
    const outside = domain.at("active:minorFixed:0", within, 10, 0);
    expect(outside).toHaveLength(1);
    expect(domain.intrinsic(outside[0]!)).toEqual({ accepted: false, rule: "quota-span" });
    const long = native.prepareSlotKind(plannerStreams(1), geometry, {
      compile: () => ({ blocksLane: true, footprint: { lanes: 1, rows: 2 } }),
      footprint: { lanes: 1, rows: 2 },
      kind: "long",
      role: "minorFixed",
      weight: 1,
    });
    const last = domain.at("active:minorFixed:1", long, path.length - 1, 0);
    expect(domain.intrinsic(last[0]!)).toEqual({ accepted: false, rule: "outside-rows" });
  });
});

describe("native path-footprint projection", () => {
  it("rejects shared native footprints before translation and resumes interrupted indexing and proofs", () => {
    const prepared = native.prepareSlotKind(plannerStreams(3), geometry, {
      compile: () => ({
        blocksLane: true,
        mover: {
          footprint: { lanes: 1, rows: 1 },
          motion: {
            count: { max: 1, min: 1 },
            kind: "steps" as const,
            sequences: [[{ lanes: 1, travel: 0 }], [{ lanes: 1, travel: 0 }]],
            stepSeconds: 0.2,
          },
          movement: "step" as const,
          variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
          warningSeconds: 0.2,
        },
      }),
      footprint: { lanes: 1, rows: 1 },
      kind: "stepper",
      role: "minorMoving",
      weight: 1,
    });
    const lane = prepared.columns[0]!;
    const blockedPath = path.map((row) => ({ ...row, lane: prepared.placements[0]!.lanes.first }));
    const anchor = { distance: path[4]!.distance, lane, row: 4, slot: 0 };
    const raw = native.slotPlacementsAt(geometry, anchor, prepared);
    expect(raw.length).toBeGreaterThan(1);
    expect(prepared.placements.every((placement) => placement.stop === undefined)).toBe(true);
    expect(Reflect.set(prepared.placements[0]!, "stop", { count: 1, first: lane })).toBe(false);
    expect(
      Reflect.set(prepared.placements, 0, {
        ...prepared.placements[0],
        stop: { count: 1, first: lane },
      }),
    ).toBe(false);
    const domains = createSlotCandidateDomains(geometry, blockedPath);
    const candidates = domains.at("blocked", prepared, 4, lane);
    const expected = candidates
      .filter((candidate) => domains.intrinsic(candidate).accepted)
      .map((candidate) => candidate.entry);
    expect(expected.length).toBeLessThan(raw.length);
    const projection = native.createSlotPathProjection(geometry, blockedPath);
    const work = { check: vi.fn(() => true), propagate: vi.fn(() => true) };
    expect(projection.at(work, anchor, prepared)).toEqual({ entries: expected, status: "entries" });
    const stats = projection.statistics();
    expect(stats.pathEvaluations).toBeGreaterThan(0);
    expect(stats.pathEvaluations).toBeLessThan(raw.length);
    expect(stats.pathSkippedTemplates).toBeGreaterThanOrEqual(raw.length - expected.length);
    expect(stats.indexedTemplates).toBe(prepared.placements.length);
    expect(stats).toMatchObject({
      groupLookups: 0,
      stopCatalogueLookups: 0,
      stopEvaluations: 0,
    });
    expect(work.check).toHaveBeenCalledTimes(stats.pathEvaluations);
    expect(work.propagate).toHaveBeenCalledTimes(
      prepared.placements.length + stats.pathEvaluations,
    );
    const previous = work.check.mock.calls.length;
    const previousPropagation = work.propagate.mock.calls.length;
    expect(projection.at(work, anchor, prepared)).toEqual({ entries: expected, status: "entries" });
    expect(work.check).toHaveBeenCalledTimes(previous);
    expect(projection.statistics().pathReuse).toBeGreaterThan(0);
    expect(work.propagate.mock.calls.length - previousPropagation).toBe(stats.pathEvaluations);
    expect(projection.at({ check: () => true, propagate: () => false }, anchor, prepared)).toEqual({
      kind: "propagation",
      status: "budget",
    });

    const interrupted = native.createSlotPathProjection(geometry, blockedPath);
    let indexWork = 0;
    expect(
      interrupted.at({ check: () => true, propagate: () => indexWork++ < 2 }, anchor, prepared),
    ).toEqual({ kind: "propagation", status: "budget" });
    expect(interrupted.statistics().indexedTemplates).toBe(2);
    expect(interrupted.at(work, anchor, prepared)).toEqual({
      entries: expected,
      status: "entries",
    });
    expect(interrupted.statistics().indexedTemplates).toBe(prepared.placements.length);
    const interruptedProof = native.createSlotPathProjection(geometry, blockedPath);
    expect(interruptedProof.at({ check: () => false }, anchor, prepared)).toEqual({
      kind: "candidateChecks",
      status: "budget",
    });
    expect(interruptedProof.statistics().pathEvaluations).toBe(0);
    expect(interruptedProof.at(work, anchor, prepared)).toEqual({
      entries: expected,
      status: "entries",
    });
    const foreign = { ...prepared };
    expect(projection.at(work, anchor, foreign)).toMatchObject({ entries: raw, status: "entries" });
  });

  it("reuses only completed stop catalogues across rows with the same native held mask", () => {
    const source = {
      ...stopSource,
      compile: () => ({ ...stopSource.compile(), blocksLane: false }),
    };
    const prepared = native.prepareSlotKind(plannerStreams(3), geometry, source);
    const template = prepared.placements.find((placement) => placement.stop !== undefined)!;
    const heldPath = path.map((row) => ({ ...row, lane: template.stop!.first }));
    const projection = native.createSlotPathProjection(geometry, heldPath);
    const anchor = { distance: path[4]!.distance, lane: template.lane, row: 4, slot: 0 };
    const work = { check: () => true, propagate: vi.fn(() => true) };
    expect(projection.at({ check: () => false }, anchor, prepared).status).toBe("budget");
    expect(projection.statistics().stopCatalogueReuse).toBe(0);
    expect(projection.at(work, anchor, prepared)).toEqual({ entries: [], status: "entries" });
    const first = projection.statistics();
    expect(first.stopCatalogueReuse).toBe(0);
    const next = { ...anchor, distance: path[5]!.distance, row: 5, slot: 2 };
    const previousWork = work.propagate.mock.calls.length;
    expect(projection.at(work, next, prepared)).toEqual({ entries: [], status: "entries" });
    expect(work.propagate.mock.calls.length - previousWork).toBe(1);
    expect(projection.statistics()).toMatchObject({
      groupLookups: first.groupLookups,
      stopCatalogueReuse: 1,
      stopEvaluations: first.stopEvaluations,
    });
    const another = native.prepareSlotKind(plannerStreams(3), geometry, source);
    expect(projection.at(work, next, another)).toEqual({ entries: [], status: "entries" });
    expect(projection.statistics().groupLookups).toBeGreaterThan(first.groupLookups);

    const changing = heldPath.map((row, index) => ({ ...row, lane: index < 6 ? 4 : row.lane }));
    const byMask = native.createSlotPathProjection(geometry, changing);
    const passing = byMask.at(work, anchor, prepared);
    expect(passing).toEqual({
      entries: native.slotPlacementsAt(geometry, anchor, prepared),
      status: "entries",
    });
    expect(passing.status === "entries" && passing.entries.length).toBeGreaterThan(0);
    expect(byMask.at(work, { ...next, distance: path[6]!.distance, row: 6 }, prepared)).toEqual({
      entries: [],
      status: "entries",
    });
    expect(byMask.statistics().stopCatalogueReuse).toBe(0);
    const otherLane = prepared.columns.find((lane) => lane !== template.lane)!;
    expect(otherLane).toBeDefined();
    const otherAnchor = { ...anchor, lane: otherLane };
    expect(byMask.at(work, otherAnchor, prepared)).toEqual({
      entries: native.slotPlacementsAt(geometry, otherAnchor, prepared),
      status: "entries",
    });
    expect(byMask.statistics().stopCatalogueReuse).toBe(0);
  });

  it("keeps positive footprints subject to native checks and separates lane spans and anchor rows", () => {
    const rider = (lanes: number) =>
      native.prepareSlotKind(plannerStreams(3), geometry, {
        compile: () => ({
          blocksLane: true,
          mover: {
            footprint: { lanes, rows: 1 },
            motion: { kind: "ride" as const, speedMultiplier: 1.5 },
            movement: "inLane" as const,
            variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
            warningSeconds: 0.2,
          },
        }),
        footprint: { lanes, rows: 1 },
        kind: "rider",
        role: "minorMoving",
        weight: 1,
      });
    const narrow = rider(1),
      wide = rider(2);
    const heldPath = path.map((row) => ({ ...row, lane: 1 }));
    const projection = native.createSlotPathProjection(geometry, heldPath);
    const work = { check: () => true, propagate: () => true };
    const anchor = { distance: path[4]!.distance, lane: 0, row: 4, slot: 0 };
    const passing = projection.at(work, anchor, narrow);
    expect(passing.status).toBe("entries");
    if (passing.status !== "entries") {
      throw new Error("Expected completed projection");
    }
    expect(passing.entries).toEqual(native.slotPlacementsAt(geometry, anchor, narrow));
    expect(passing.entries.length).toBeGreaterThan(0);
    expect(projection.at(work, anchor, wide)).toEqual({ entries: [], status: "entries" });
    const changing = path.map((row, index) => ({ ...row, lane: index <= 5 ? 1 : 0 }));
    const byRow = native.createSlotPathProjection(geometry, changing);
    expect(byRow.at(work, anchor, narrow)).toMatchObject({
      entries: passing.entries,
      status: "entries",
    });
    expect(byRow.at(work, { ...anchor, distance: path[5]!.distance, row: 5 }, narrow)).toEqual({
      entries: [],
      status: "entries",
    });
    const domains = createSlotCandidateDomains(geometry, heldPath);
    const actual = domains.at("positive", narrow, 4, 0);
    const expected = actual.filter((candidate) => domains.intrinsic(candidate).accepted);
    const steps = [
      ...domains.sequence(
        { anchor: () => true, ...work },
        { columnStart: 0, columns: [0], rows: [4] },
        "positive",
        narrow,
      ),
    ];
    expect(steps).toEqual(expected.map((candidate) => ({ candidate, status: "candidate" })));
    expect(domains.statistics().unaryChecks).toBeGreaterThan(0);
    const prize = native.prepareSlotKind(plannerStreams(3), geometry, {
      ...stopSource,
      compile: () => ({ ...stopSource.compile(), blocksLane: false }),
    });
    const prizeRaw = native.slotPlacementsAt(
      geometry,
      { ...anchor, lane: prize.columns[0]! },
      prize,
    );
    const prizeProjection = native.createSlotPathProjection(
      geometry,
      path.map((row) => ({ ...row, lane: 0 })),
    );
    prizeProjection.at(work, { ...anchor, lane: prize.columns[0]! }, prize);
    expect(prizeRaw.length).toBeGreaterThan(0);
    expect(prizeProjection.statistics().pathEvaluations).toBe(0);
  });
});
