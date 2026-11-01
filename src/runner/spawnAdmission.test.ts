import { describe, expect, it, vi } from "vitest";

import { MOVEMENT_PROFILES } from "../data/movementProfiles";
import { plannerStreams } from "../testing/movers";
import { drawMover, type MoverSpec, placeMovers } from "./moverPlanning";
import { minimumSignatureOnScreen } from "./signatureCapacity";
import { validateSpawnCapacity } from "./spawnAdmission";
import type { SpawnPlan } from "./spawning";
import { repairIncumbentSpawns } from "./spawnRepair";
import { searchSpawnAdmission } from "./spawnSearch";
import * as spawnValidation from "./spawnValidation";
import { auditSpawnPlan } from "./spawnValidation";
import { planCompleteSpawns, planSpawns, replaySpawnPlan } from "./zonePlanner";

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
  quotas: [],
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 1100,
  scrollSpeed: 100,
  sightLength: 1000,
  stepSeconds: 0.05,
  zoneLength: 1000,
};

const rider: MoverSpec = {
  footprint: { lanes: 1, rows: 1 },
  motion: { kind: "ride", speedMultiplier: 1.5 },
  movement: "inLane",
  variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0.8 },
  warningSeconds: 0,
};

describe("spawn admission", () => {
  it("adds a missing frozen request without changing its incumbent", () => {
    const initial = {
      ...plan,
      quotas: [{ blocksLane: true, count: 1, kind: "bench" }],
      zoneLength: 300,
    };
    const incumbent = planSpawns(plannerStreams(7), initial);
    const before = JSON.stringify(incumbent);
    const requested = { ...initial, quotas: [{ blocksLane: true, count: 2, kind: "bench" }] };
    const construction = {
      admitted: [[]] as boolean[][],
      drawn: [[]],
      exact: true,
      order: "requested-row" as const,
    };
    const repaired = repairIncumbentSpawns(construction, requested, incumbent);
    expect(JSON.stringify(incumbent)).toBe(before);
    expect(repaired.events).toContainEqual(incumbent.events[0]);
    expect(repaired.events).toHaveLength(requested.quotas[0]!.count);
    expect(repaired.admission.repair?.accepted).toBe(1);
    expect(repaired.admission.counts[0]?.requested).toBe(requested.quotas[0]!.count);
    expect(auditSpawnPlan(requested, repaired).status).toBe("valid");
  });

  it("retains the last valid ledger and reports a rejected fresh certificate", () => {
    const initial = {
      ...plan,
      quotas: [{ blocksLane: true, count: 1, kind: "bench" }],
      zoneLength: 300,
    };
    const incumbent = planSpawns(plannerStreams(7), initial);
    const requested = { ...initial, quotas: [{ blocksLane: true, count: 2, kind: "bench" }] };
    const construction = {
      admitted: [[]] as boolean[][],
      drawn: [[]],
      exact: true,
      order: "requested-row" as const,
    };
    const before = JSON.stringify(incumbent);
    const fullAudit = auditSpawnPlan;
    const certificate = vi
      .spyOn(spawnValidation, "auditSpawnPlan")
      .mockImplementation((data, selected) => {
        const checked = fullAudit(data, selected);
        return selected.events.length + selected.herrings.length >
          incumbent.events.length + incumbent.herrings.length
          ? { ...checked, status: "invalid", violations: ["certificate rejection fixture"] }
          : checked;
      });
    try {
      const repaired = repairIncumbentSpawns(construction, requested, incumbent);
      expect(JSON.stringify(incumbent)).toBe(before);
      expect(repaired.events).toEqual(incumbent.events);
      expect(repaired.admission.repair?.accepted).toBe(0);
      expect(repaired.admission.repair?.validationFailures).toContain(
        "certificate rejection fixture",
      );
    } finally {
      certificate.mockRestore();
    }
  });

  it("keeps failed relocation branches atomic and stops generated work at the global repair budget", () => {
    const initial = {
      ...plan,
      quotas: [{ blocksLane: true, count: 2, kind: "bench" }],
      zoneLength: 300,
    };
    const incumbent = planSpawns(plannerStreams(7), initial);
    expect(incumbent.events).toHaveLength(2);
    const before = JSON.stringify(incumbent);
    const requested = { ...initial, quotas: [{ blocksLane: true, count: 100, kind: "bench" }] };
    const construction = {
      admitted: [[]] as boolean[][],
      drawn: [[]],
      exact: true,
      order: "requested-row" as const,
    };
    const repaired = repairIncumbentSpawns(construction, requested, incumbent);
    expect(JSON.stringify(incumbent)).toBe(before);
    expect(repaired.events).toEqual(incumbent.events);
    expect(repaired.path).toBe(incumbent.path);
    expect(repaired.admission.repair?.accepted).toBe(0);
    expect(repaired.admission.repair?.evaluatedNodes).toBeLessThanOrEqual(4496);
    expect(
      repaired.admission.repair!.auditedNodes + repaired.admission.repair!.feasibilityNodes,
    ).toBe(repaired.admission.repair?.evaluatedNodes);
    expect(repaired.admission.repair!.auditedNodes).toBeLessThanOrEqual(400);
    expect(repaired.admission.repair!.feasibilityNodes).toBeLessThanOrEqual(4096);
    expect(repaired.admission.repair?.validationFailures).toEqual([]);
    expect(repaired.admission.repair!.generatedPlacements).toBeLessThanOrEqual(
      4496 + requested.quotas[0]!.count,
    );
    expect(construction.admitted[0]?.filter(Boolean)).toHaveLength(2);
    expect(auditSpawnPlan(requested, repaired).status).toBe("valid");
  });

  it.each(["drop", "change-speed"] as const)(
    "retains the selected incumbent when final repair would %s a protected request",
    (change) => {
      const orders: string[] = [];
      const result = searchSpawnAdmission(
        (construction, streams) => {
          orders.push(construction.order);
          if (construction.order === "original") {
            construction.drawn[0]!.push(
              ...Array.from({ length: 10 }, () => ({ draws: drawMover(streams), herring: false })),
            );
          }
          const count =
            construction.order === "original"
              ? 7
              : construction.order === "constrained-first"
                ? 8
                : 9;
          const members = Array.from(
            { length: count },
            (_, member) =>
              member + (construction.order === "requested-row" && change === "drop" ? 1 : 0),
          );
          const events = members.map((member) => {
            construction.admitted[0]![member] = true;
            return {
              distance: member * 100,
              kind: "rider",
              lane: member % 5,
              mover: {
                lane: member % 5,
                lanes: 1,
                motion: "ride" as const,
                movement: "inLane" as const,
                speedMultiplier:
                  construction.order === "requested-row" &&
                  change === "change-speed" &&
                  member === 0
                    ? 1
                    : 2,
                warning: 0,
              },
            };
          });
          if (construction.order === "requested-row") {
            expect(construction.motion?.[0]?.[0]).toMatchObject({ speedMultiplier: 2 });
            expect(construction.motion?.[0]?.[8]).toBeUndefined();
          }
          return {
            admission: {
              capacity: { limits: [], rows: 20 },
              counts: [],
              rejections: [],
              substitutions: [],
            },
            events,
            herrings: [],
            path: [],
            visibility: members.map((member, index) => ({
              entry: member * 100,
              hazard: true,
              index,
              kind: "rider",
              lane: member % 5,
              memberIndex: member,
              nativeUntil: member * 100 + 50,
              quotaIndex: 0,
              row: member,
              source: "events" as const,
              until: member * 100 + 50,
            })),
          };
        },
        { seed: 7, zoneIndex: 0 },
        plannerStreams(7),
        { ...plan, quotas: [{ blocksLane: true, count: 10, kind: "rider", mover: rider }] },
      );
      expect(orders).toEqual(["original", "constrained-first", "requested-row"]);
      expect(result.status).toBe("partial");
      if (result.status !== "partial") {
        throw new Error("Expected preserved partial incumbent");
      }
      expect(result.strategy).toBe("constrained-first");
      expect(result.planned.events).toHaveLength(8);
    },
  );

  it("accepts a valid partial floor with frozen counts when the full standing bound fails", () => {
    const crowded = {
      ...plan,
      quotas: [{ blocksLane: false, count: 12, kind: "tip" }],
      zoneLength: 300,
    };
    expect(() => validateSpawnCapacity(crowded, 2)).toThrow(/standing cells/);
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), crowded);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") {
      throw new Error("Expected partial admission");
    }
    expect(result.attempts).toHaveLength(3);
    expect(result.planned.events).toHaveLength(10);
    expect(result.planned.admission.placement).toMatchObject({ placed: 10, requested: 12 });
    expect(
      replaySpawnPlan(JSON.parse(JSON.stringify(result.snapshot)) as typeof result.snapshot),
    ).toEqual(result);
    expect(result.missing).toContainEqual(expect.objectContaining({ count: 2, kind: "tip" }));
    const below = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), {
      ...crowded,
      quotas: [{ blocksLane: false, count: 13, kind: "tip" }],
    });
    expect(below.status).toBe("capacity-impossible");
    if (below.status !== "capacity-impossible") {
      throw new Error("Expected floor bound failure");
    }
    expect(below.reason).toContain("80%");
    const empty = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), {
      ...plan,
      quotas: [],
    });
    expect(empty.status).toBe("complete");
    if (empty.status !== "complete") {
      throw new Error(empty.reason);
    }
    expect(empty.planned.admission.placement).toMatchObject({ placed: 0, ratio: 1, requested: 0 });
  });

  it("repairs same-kind fixed entries without losing their quota and reports exhausted conflicts", () => {
    const fixed = {
      ...plan,
      minSpacing: 100,
      quotas: [{ blocksLane: true, count: 6, kind: "same" }],
      roadLength: 250,
      sightLength: 200,
      zoneLength: 3000,
    };
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), fixed);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error(result.reason);
    }
    expect(result.planned.events).toHaveLength(6);
    for (const [index, event] of result.planned.events.entries()) {
      const active = result.planned.events
        .slice(0, index)
        .filter((other) => other.distance + fixed.roadLength + fixed.cellLength > event.distance);
      expect(active.length).toBeLessThan(2);
      expect(
        active.every((other) => other.lane !== event.lane && other.distance !== event.distance),
      ).toBe(true);
    }
    const failed = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), {
      ...fixed,
      roadLength: 10000,
    });
    expect(failed.status).toBe("planner-unable");
    expect(failed.attempts).toHaveLength(3);
    if (failed.status !== "planner-unable") {
      throw new Error("Expected exhausted admission");
    }
    expect(failed.reason).toContain("same");
    expect(failed.reason).toContain("kind-cap");
    const replayed = replaySpawnPlan(
      JSON.parse(JSON.stringify(failed.snapshot)) as typeof failed.snapshot,
    );
    expect(replayed).toEqual(failed);
  });

  it("reserves repeated mover entries as logical hazards through stopped-scenery clearance", () => {
    const moving = {
      ...plan,
      quotas: [
        {
          blocksLane: true,
          count: 6,
          kind: "same",
          mover: {
            ...rider,
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
      ],
      roadLength: 250,
      sightLength: 200,
      zoneLength: 3000,
    };
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), moving);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error(result.reason);
    }
    expect(result.planned.events).toHaveLength(6);
    const nativeLifetime = (moving.roadLength + moving.cellLength) / 1.5;
    const lifetime =
      nativeLifetime +
      moving.roadLength -
      moving.sightLength +
      moving.packLength +
      moving.cellLength;
    for (const [index, event] of result.planned.events.entries()) {
      expect(event.mover?.motion).toBe("ride");
      const active = result.planned.events
        .slice(0, index)
        .filter((other) => other.distance + lifetime > event.distance);
      expect(active.length).toBeLessThan(2);
      expect(
        active.every(
          (other) =>
            other.lane !== event.lane &&
            Math.abs(other.distance - event.distance) >= moving.scrollSpeed * moving.stepSeconds,
        ),
      ).toBe(true);
    }
  });

  it("rejects demand beyond necessary cell and screen-time bounds before drawing", () => {
    const noDraws = {
      movers: () => {
        throw new Error("unexpected draw");
      },
      spawns: () => {
        throw new Error("unexpected draw");
      },
    };
    expect(() =>
      planSpawns(noDraws, { ...plan, quotas: [{ blocksLane: true, count: 10000, kind: "wall" }] }),
    ).toThrow(/Impossible spawn quota:.*standing cells/);
    expect(() =>
      planSpawns(noDraws, {
        ...plan,
        quotas: [{ blocksLane: true, count: 10000, kind: "rider", mover: rider }],
      }),
    ).toThrow(/mover screen distance/);
    expect(() =>
      planSpawns(noDraws, {
        ...plan,
        quotas: [{ blocksLane: true, count: 10000, first: true, kind: "rider", mover: rider }],
      }),
    ).toThrow(/blocking logical groups/);
    expect(() =>
      planSpawns(noDraws, {
        ...plan,
        quotas: [{ blocksLane: false, count: 1, kind: "tip", within: [0, 0.1] }],
      }),
    ).toThrow(/tip standing cells/);
    expect(() =>
      validateSpawnCapacity(
        { ...plan, quotas: [{ blocksLane: false, count: NaN, kind: "tip" }] },
        9,
      ),
    ).toThrow(/count must be/);
  });

  it("bounds duckling groups by the held cue, finite run and road-speed exit", () => {
    const profile = MOVEMENT_PROFILES.ducklingTrail;
    if (profile?.kind !== "delayedTrail") {
      throw new Error("Missing duckling trail profile");
    }
    const spec: MoverSpec = {
      ...rider,
      motion: { kind: "signature", profile },
      variation: { ...rider.variation, delaySeconds: 20 },
    };
    const minimum = minimumSignatureOnScreen(plan, spec);
    const runningSeconds =
      profile.bends.min * profile.bendSeconds + (profile.bends.min - 1) * profile.straightSeconds;
    expect(minimum).toBeCloseTo(
      profile.warningSeconds * plan.scrollSpeed +
        Math.max(...profile.followerDelays) * plan.scrollSpeed +
        plan.roadLength +
        runningSeconds * plan.scrollSpeed * (1 - profile.downFactor),
    );
    expect(() =>
      validateSpawnCapacity(
        {
          ...plan,
          quotas: [{ blocksLane: true, count: 1000, kind: "ducklings", mover: spec }],
          zoneLength: 29600,
        },
        100,
      ),
    ).toThrow(/mover screen distance/);
    expect(
      minimumSignatureOnScreen(plan, {
        ...spec,
        variation: { ...spec.variation, delaySeconds: 0 },
      }),
    ).toBe(minimum);
  });

  it("bounds a reflection count domain by geometry before compiling routes", () => {
    const profile = MOVEMENT_PROFILES.reflectingRoll;
    if (profile?.kind !== "reflectingDiagonal") {
      throw new Error("Missing reflecting profile");
    }
    const spec: MoverSpec = {
      ...rider,
      motion: {
        kind: "signature",
        profile: { ...profile, reflections: { max: Number.MAX_SAFE_INTEGER, min: 1 } },
      },
    };
    expect(Number.isFinite(minimumSignatureOnScreen(plan, spec))).toBe(true);
    expect(
      minimumSignatureOnScreen(plan, {
        ...spec,
        motion: {
          kind: "signature",
          profile: {
            ...profile,
            reflections: { max: Number.MAX_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER },
          },
        },
      }),
    ).toBe(Infinity);
  });

  it("reports seeded search failure separately from passing necessary bounds", () => {
    const { admission } = planSpawns(plannerStreams(1), {
      ...plan,
      quotas: [{ blocksLane: true, count: 1, footprint: { lanes: 5, rows: 1 }, kind: "wall" }],
    });
    expect(admission.counts).toEqual([
      { admitted: 0, herrings: 0, kind: "wall", movement: null, requested: 1 },
    ]);
    expect(admission.rejections).toContainEqual(
      expect.objectContaining({ kind: "wall", reason: "open-lanes" }),
    );
    expect(
      admission.capacity.limits.every(({ available, required }) => required <= available),
    ).toBe(true);
  });

  it("preserves original member identities and spans when scheduling a quota out of order", () => {
    const source = plannerStreams(7);
    const drawn = Array.from({ length: 3 }, () => ({ draws: drawMover(source), herring: false }));
    const admitted: boolean[] = [];
    const seen: { distance: number; member: number; quota: number }[] = [];
    const grid: Parameters<typeof placeMovers>[3] = {
      block: () => true,
      clearOf: () => true,
      clearRun: () => 1,
      isFree: () => true,
      leavesRoom: () => true,
      occupy: () => {},
      packFits: () => true,
      showed: (event, _interval, _proof, request) => {
        if (request === undefined) {
          throw new Error("Missing request identity");
        }
        expect(request.requestedDraws).toBe(drawn[request.memberIndex]?.draws);
        seen.push({
          distance: event.distance,
          member: request.memberIndex,
          quota: request.quotaIndex,
        });
      },
      stand: () => {},
      take: () => {},
    };
    const placed = placeMovers(
      plannerStreams(11),
      {
        ...plan,
        cellLength: 10,
        roadLength: 100,
        rowSpacing: 200,
        sightLength: 80,
        window: 40,
        zoneLength: 2000,
      },
      plan.moverCaps,
      grid,
      [],
      [200, 400, 600, 800, 1000, 1200],
      [
        {
          admitted,
          count: 3,
          drawn,
          kind: "rider",
          members: [2, 0],
          quotaIndex: 7,
          spec: { ...rider, variation: { ...rider.variation, speedShare: 0 } },
        },
      ],
    );
    expect(placed.spawns).toHaveLength(2);
    expect(placed.dropped).toEqual([]);
    expect(seen.map(({ member, quota }) => [member, quota])).toEqual([
      [2, 7],
      [0, 7],
    ]);
    expect(seen[0]?.distance).toBeGreaterThanOrEqual(1000);
    expect(seen[1]?.distance).toBeLessThanOrEqual(400);
    expect(admitted[0]).toBe(true);
    expect(admitted[1]).toBeUndefined();
    expect(admitted[2]).toBe(true);
  });

  it("fills a usable earlier row after the first rider waits for room", () => {
    let draws = 0;
    const streams = { movers: () => 0.5, spawns: () => (draws++ < 5 ? 0 : 1 - Number.EPSILON) };
    const grid = {
      block: () => true,
      clearOf: () => true,
      clearRun: () => 1,
      isFree: () => true,
      leavesRoom: () => true,
      occupy: () => {},
      packFits: () => true,
      stand: () => {},
      take: () => {},
    };
    const geometry = {
      ...plan,
      cellLength: 10,
      roadLength: 100,
      rowSpacing: 500,
      sightLength: 80,
      window: 40,
    };
    const { dropped, spawns } = placeMovers(
      streams,
      geometry,
      { darts: 1, slowVehicles: 1, total: 1 },
      grid,
      [],
      [0, 500, 1000],
      [{ count: 2, kind: "rider", spec: rider }],
    );
    expect(spawns).toHaveLength(2);
    expect(dropped).toEqual([]);
    expect(spawns[0]?.distance).toBeGreaterThan(0);
    expect(spawns[1]?.distance).toBe(0);
  });
});

describe("constructive spawn admission", () => {
  const counted = () => {
    const draws = { movers: 0, spawns: 0 };
    const source = plannerStreams(7);
    return {
      draws,
      streams: {
        movers: () => {
          draws.movers += 1;
          return source.movers();
        },
        spawns: () => {
          draws.spawns += 1;
          return source.spawns();
        },
      },
    };
  };

  it("returns a complete original layout and primary RNG cursor unchanged", () => {
    const mixed: SpawnPlan<string> = {
      ...plan,
      quotas: [
        {
          blocksLane: true,
          count: 1,
          kind: "rider",
          mover: {
            ...rider,
            motion: { kind: "ride", speedMultiplier: 2 },
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
        { blocksLane: true, count: 2, kind: "wall" },
        { blocksLane: false, count: 2, kind: "tip" },
      ],
      roadLength: 500,
      sightLength: 400,
      zoneLength: 4000,
    };
    const raw = counted();
    const expected = planSpawns(raw.streams, mixed);
    const searched = counted();
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, searched.streams, mixed);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error(result.status);
    }
    expect(result.strategy).toBe("original");
    expect(result.attempts).toHaveLength(1);
    expect(
      replaySpawnPlan(JSON.parse(JSON.stringify(result.snapshot)) as typeof result.snapshot),
    ).toEqual(result);
    const { placement, ...admission } = result.planned.admission;
    expect({ ...result.planned, admission }).toEqual(expected);
    expect(placement).toMatchObject({ missing: [], ratio: 1 });
    expect(searched.draws).toEqual(raw.draws);
  });

  it("repairs a path-blocked mix without further primary draws or changed requests", () => {
    const blocked: SpawnPlan<string> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 1, footprint: { lanes: 3, rows: 1 }, kind: "hedge" },
        {
          blocksLane: true,
          count: 1,
          kind: "rider",
          mover: {
            ...rider,
            motion: { kind: "ride", speedMultiplier: 1.5 },
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
      ],
      roadLength: 500,
      sightLength: 400,
      zoneLength: 4000,
    };
    const heldPath = () => {
      const draws = { movers: 0, spawns: 0 };
      return {
        draws,
        streams: {
          movers: () => {
            draws.movers += 1;
            return 0.9;
          },
          spawns: () => {
            draws.spawns += 1;
            return 0.5;
          },
        },
      };
    };
    const raw = heldPath();
    expect(
      planSpawns(raw.streams, blocked).events.filter(({ kind }) => kind === "hedge"),
    ).toHaveLength(0);
    const primary = heldPath();
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, primary.streams, blocked);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      throw new Error(result.status);
    }
    expect(result.strategy).not.toBe("original");
    expect(
      replaySpawnPlan(JSON.parse(JSON.stringify(result.snapshot)) as typeof result.snapshot),
    ).toEqual(result);
    expect(result.planned.events.map(({ kind }) => kind).sort()).toEqual(["hedge", "rider"]);
    expect(result.planned.admission.substitutions).toEqual([]);
    expect(primary.draws).toEqual(raw.draws);
  });

  it("reports exact original missing members rather than crediting a still downgrade", () => {
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, plannerStreams(7), {
      ...plan,
      quotas: [
        {
          blocksLane: true,
          count: 1,
          first: true,
          kind: "shared",
          mover: {
            ...rider,
            motion: { kind: "ride", speedMultiplier: 0.2 },
            variation: { ...rider.variation, speedShare: 0 },
          },
        },
        { blocksLane: true, count: 1, footprint: { lanes: 5, rows: 1 }, kind: "shared" },
      ],
    });
    expect(result.status).toBe("planner-unable");
    if (result.status !== "planner-unable") {
      throw new Error(result.status);
    }
    expect(result.attempts).toHaveLength(3);
    expect(
      result.missing.map(({ count, kind, movement, requests }) => ({
        count,
        kind,
        movement,
        requests,
      })),
    ).toEqual([
      {
        count: 1,
        kind: "shared",
        movement: "inLane",
        requests: [{ memberIndex: 0, quotaIndex: 0 }],
      },
      { count: 1, kind: "shared", movement: null, requests: [{ memberIndex: 0, quotaIndex: 1 }] },
    ]);
    expect(result.missing.flatMap(({ observedRejections }) => observedRejections)).toContainEqual(
      expect.objectContaining({ reason: "open-lanes" }),
    );
  });

  it("separates proved capacity failure from invalid quota definitions", () => {
    const noDraws = {
      movers: () => {
        throw new Error("unexpected draw");
      },
      spawns: () => {
        throw new Error("unexpected draw");
      },
    };
    const invalid = { ...plan, quotas: [{ blocksLane: true, count: 10000, kind: "wall" }] };
    const result = planCompleteSpawns({ seed: 7, zoneIndex: 0 }, noDraws, invalid);
    expect(result.status).toBe("capacity-impossible");
    expect(result.attempts).toEqual([]);
    expect(() =>
      planCompleteSpawns({ seed: 7, zoneIndex: 0 }, noDraws, {
        ...invalid,
        quotas: [{ blocksLane: true, count: NaN, kind: "wall" }],
      }),
    ).toThrow(/count must be/);
  });
});
