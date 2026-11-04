import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { TUNING } from "../data/tuning.ts";
import { WORLD } from "../data/world.ts";
import { FASTEST_WALKER, GAME_ROAD, inZone, REAL, realRun } from "../testing/planner.ts";
import { mapZones } from "../testing/world.ts";
import { captureZoneInput } from "../testing/zonePlan.ts";
import { moverSpec } from "./moverSpecs.ts";
import { prepareSlotKind, slotPlacementsAt } from "./slotCandidates.ts";
import { slotMotionStreams, slotRandom } from "./slotEntropy.ts";
import { createSlotFeasibility } from "./slotFeasibility.ts";
import { makeSlotJobs } from "./slotJobs.ts";
import { guaranteeCompatiblePath } from "./slotPath.ts";
import { drawPath, PATH_HOLD_ROWS, pathReach, rowSpacing, zoneRows } from "./spawning.ts";
import { startRoad } from "./walk.ts";
import { compileZoneSlotInput, type ZoneSlotKind } from "./zoneSlotInput.ts";

const captured = [
  {
    context: {
      limits: {
        anchors: 32768,
        candidateChecks: 32768,
        compiledTemplates: 65536,
        slots: 512,
      },
      seed: 3,
      zoneIndex: 0,
    },
    definition: {
      footprint: {
        lanes: 2,
        rows: 2,
      },
      kind: "skunk",
      movement: {
        kind: "approach",
        steps: {
          max: 6,
          min: 3,
        },
      },
      movingHitLength: 58,
      role: "encounterMoving",
      spec: {
        blocksLane: true,
        first: true,
        hazard: true,
        hitLength: 58,
      },
      weight: 1,
    },
    geometry: {
      cellInset: -18.79754601226989,
      cellLength: 64,
      firstContactSeconds: 2,
      fixedKinds: [],
      laneCount: 5,
      laneInset: 12,
      laneMoveSeconds: 0.11111111111111112,
      maxEmptyRows: null,
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
      pathStart: 2,
      reactionSeconds: 0.5,
      riderFollowGap: 64,
      roadLength: 724,
      scrollSpeed: 200,
      sightLength: 553.8461538461538,
      stepSeconds: 0.016666666666666666,
      zoneLength: 7400,
    },
    key: "active:encounterMoving:0",
  },
  {
    context: {
      limits: {
        anchors: 32768,
        candidateChecks: 32768,
        compiledTemplates: 65536,
        slots: 512,
      },
      seed: 3,
      zoneIndex: 0,
    },
    definition: {
      footprint: {
        lanes: 3,
        rows: 1,
      },
      kind: "crosstownBus",
      movement: {
        kind: "stopAndGoAcross",
        speed: 0.65,
        stopSeconds: 1,
        stops: [
          [0, 2],
          [1, 3],
          [2, 4],
        ],
      },
      movingHitLength: 68.62681744749602,
      role: "minorMoving",
      spec: {
        blocksLane: true,
        first: false,
        hazard: true,
        hitLength: 64,
      },
      weight: 2.75,
    },
    geometry: {
      cellInset: -18.79754601226989,
      cellLength: 64,
      firstContactSeconds: 2,
      fixedKinds: [],
      laneCount: 5,
      laneInset: 12,
      laneMoveSeconds: 0.11111111111111112,
      maxEmptyRows: null,
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
      pathStart: 2,
      reactionSeconds: 0.5,
      riderFollowGap: 64,
      roadLength: 724,
      scrollSpeed: 187.5,
      sightLength: 553.8461538461538,
      stepSeconds: 0.016666666666666666,
      zoneLength: 29600,
    },
    key: "active:minorMoving:0",
  },
] as const;

describe("guaranteed full-profile paths", () => {
  it("keeps all High Park full-profile guarantees compatible at the last walk position", () => {
    const tuned = {
      ...REAL,
      world: mapZones((zone) => {
        if (zone.id !== "highPark") {
          return zone;
        }
        const weights = zone.weights.minorObstacles;
        const others = keysOf(weights)
          .filter((kind) => kind !== "ferrets")
          .reduce((sum, kind) => sum + weights[kind], 0);
        return {
          ...zone,
          weights: { ...zone.weights, minorObstacles: { ...weights, ferrets: others } },
        };
      }, WORLD),
    };
    const input = captureZoneInput(tuned, GAME_ROAD, 3, {
      road: startRoad(5),
      run: inZone(realRun(tuned, FASTEST_WALKER), "highPark", 3),
    });
    const { catalogue, geometry } = compileZoneSlotInput(input);
    const sources = makeSlotJobs(catalogue, input.auxiliary, input.config)
      .filter((job) => job.guaranteed)
      .flatMap((job) =>
        job.sources.map((source) => ({
          ordinal: job.ordinal,
          prepared: prepareSlotKind(
            slotMotionStreams(input.context, job.key, source.kind),
            geometry,
            source,
          ),
          total: job.total,
        })),
      );
    const random = slotRandom(input.context, "path");
    const draws: number[] = [];
    const rows = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] }));
    const original = drawPath(
      {
        movers: () => {
          const value = random();
          draws.push(value);
          return value;
        },
        spawns: slotRandom(input.context, "path-reserved"),
      },
      { ...geometry, quotas: [] },
      rows.length,
    ).map((lane, row) => ({ distance: rows[row]!, lane }));
    const frozen = JSON.stringify(sources);
    let anchors = 0,
      checks = 0;
    const result = guaranteeCompatiblePath(geometry, original, draws, sources, {
      anchor: () => ++anchors <= input.context.limits.anchors,
      check: () => ++checks <= input.context.limits.candidateChecks,
    });
    expect(result.failedKind).toBeUndefined();
    expect(JSON.stringify(sources)).toBe(frozen);
    expect(result.path[0]!.lane).toBe(geometry.pathStart);
    const board = createSlotFeasibility(geometry, result.path);
    for (const source of sources) {
      expect(
        rows.some((distance, row) =>
          source.prepared.columns.some((lane) =>
            slotPlacementsAt(geometry, { distance, lane, row, slot: 0 }, source.prepared).some(
              (entry) => board.probe(entry).accepted,
            ),
          ),
        ),
        source.prepared.source.kind,
      ).toBe(true);
    }
    expect(anchors).toBeLessThanOrEqual(input.context.limits.anchors);
    expect(checks).toBeLessThanOrEqual(input.context.limits.candidateChecks);
  });

  it.each(captured)(
    "preserves the full $definition.kind profile while checking its path domain",
    (fixture) => {
      const geometry = { ...fixture.geometry, maxEmptyRows: Infinity };
      const definition: ZoneSlotKind<string> = fixture.definition;
      const source = {
        ...definition,
        compile: (streams: Parameters<typeof prepareSlotKind>[0]) => ({
          ...definition.spec,
          mover: {
            ...moverSpec({ tuning: TUNING }, streams, definition.footprint, definition.movement!),
            hitLength: definition.movingHitLength!,
          },
        }),
      };
      const prepared = prepareSlotKind(
        slotMotionStreams(fixture.context, fixture.key, source.kind),
        geometry,
        source,
      );
      const before = JSON.stringify(prepared);
      const random = slotRandom(fixture.context, "path");
      const draws: number[] = [];
      const rows = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] }));
      const original = drawPath(
        {
          movers: () => {
            const value = random();
            draws.push(value);
            return value;
          },
          spawns: () => 0,
        },
        { ...geometry, quotas: [] },
        rows.length,
      ).map((lane, row) => ({ distance: rows[row]!, lane }));
      const fits = (path: typeof original) => {
        const board = createSlotFeasibility(geometry, path);
        return rows.some((distance, row) =>
          prepared.columns.some((lane) =>
            slotPlacementsAt(geometry, { distance, lane, row, slot: 0 }, prepared).some(
              (entry) => board.probe(entry).accepted,
            ),
          ),
        );
      };
      const initiallySupported = fits(original);
      let anchors = 0,
        checks = 0;
      const result = guaranteeCompatiblePath(
        geometry,
        original,
        draws,
        [{ ordinal: 0, prepared, total: 4 }],
        {
          anchor: () => ++anchors <= fixture.context.limits.anchors,
          check: () => ++checks <= fixture.context.limits.candidateChecks,
        },
      );
      expect(result.failedKind).toBeUndefined();
      if (initiallySupported) {
        expect(result.path).toBe(original);
      } else {
        expect(result.path).not.toEqual(original);
      }
      if (source.kind === "skunk") {
        expect(initiallySupported).toBe(false);
      }
      expect(checks).toBeLessThanOrEqual(fixture.context.limits.candidateChecks + 1);
      expect(JSON.stringify(prepared)).toBe(before);
      expect(draws).toHaveLength(rows.length * 2);
      const unchanged = slotRandom(fixture.context, "path");
      for (let index = 0; index < draws.length; index++) {
        unchanged();
      }
      expect(random()).toBe(unchanged());
      expect(result.path[0]!.lane).toBe(geometry.pathStart);
      let held = 1;
      for (let row = 1; row < result.path.length; row++) {
        if (result.path[row]!.lane === result.path[row - 1]!.lane) {
          held++;
        } else {
          expect(held).toBeGreaterThanOrEqual(PATH_HOLD_ROWS);
          expect(Math.abs(result.path[row]!.lane - result.path[row - 1]!.lane)).toBeLessThanOrEqual(
            pathReach({ ...geometry, quotas: [] }),
          );
          held = 1;
        }
      }
      expect(fits([...result.path])).toBe(true);
      const stable = guaranteeCompatiblePath(
        geometry,
        result.path,
        draws,
        [{ ordinal: 0, prepared, total: 4 }],
        { anchor: () => true, check: () => true },
      );
      expect(stable.path).toBe(result.path);
      let stoppedChecks = 0;
      const stopped = guaranteeCompatiblePath(
        geometry,
        original,
        draws,
        [{ ordinal: 0, prepared, total: 4 }],
        {
          anchor: () => true,
          check: () => {
            stoppedChecks++;
            return false;
          },
        },
      );
      expect(stopped).toEqual({ failedKind: source.kind, path: original });
      expect(stoppedChecks).toBe(1);
      expect(JSON.stringify(prepared)).toBe(before);
    },
  );
});
