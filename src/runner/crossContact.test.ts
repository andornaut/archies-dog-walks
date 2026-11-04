import { expect, it } from "vitest";

import { laneMask } from "../layout/lanes.ts";
import { drawMover, type MoverGeometry, moverPlacements, type MoverSpec } from "./moverPlanning.ts";
import { crossScrollTo, crossSpan, moverPlace } from "./movers.ts";
import { slotMotionStreams } from "./slotEntropy.ts";

const geometry: MoverGeometry = {
  cellLength: 64,
  laneCount: 5,
  laneInset: 12,
  packHitLength: 162.1538461538462,
  packLength: 166.1538461538462,
  roadLength: 724,
  rowSpacing: 295,
  scrollSpeed: 200,
  sightLength: 553.8461538461538,
  window: 267.748938178386,
};
const spec: MoverSpec & { readonly motion: Extract<MoverSpec["motion"], { kind: "cross" }> } = {
  footprint: { lanes: 2, rows: 1 },
  hitLength: 28.40480274442541,
  motion: {
    kind: "cross",
    lanesPerSecond: 3,
    reactionSeconds: 0.5,
    startRoadShare: [0.15, 0.45],
    stopLanes: { max: 4, min: 2 },
    stopShare: 0,
    tilt: [0, 0],
    turnAtShare: [0.5, 1],
    turnBackShare: 0.3,
    vergeShare: 0.25,
  },
  movement: "dart",
  variation: { delaySeconds: 0.6, lengthShare: 0.35, speedShare: 0.4 },
  warningSeconds: 0.6,
};

it("reserves every continuous collision interval while excluding the generic taller body", () => {
  const draws = drawMover(
    slotMotionStreams({ seed: 534215944, zoneIndex: 0 }, "active:minorMoving:2", "ferrets"),
  );
  const motions = [
    spec,
    { ...spec, motion: { ...spec.motion, turnBackShare: 1 } },
    {
      ...spec,
      motion: {
        ...spec.motion,
        pause: { seconds: 0.4, stops: [[2, 3]] },
        turnBackShare: 0,
      },
    },
  ] satisfies readonly MoverSpec[];
  for (const source of motions) {
    for (const lift of [0.25, 0.5, 0.75]) {
      const placements = moverPlacements(geometry, source, draws, lift);
      expect(placements.length).toBeGreaterThan(0);
      for (const placement of placements) {
        const path = placement.path;
        if (path.motion !== "cross") {
          throw new Error("Expected compiled crosser");
        }
        const from = path.warning + crossScrollTo(path, geometry.sightLength);
        const to =
          path.warning +
          crossScrollTo(path, geometry.sightLength + source.hitLength! + geometry.packHitLength);
        const pauseStart =
          path.pause === undefined
            ? Infinity
            : path.warning + path.pause.after / path.lanesPerPixel;
        const pauseEnd = pauseStart + (path.pause?.length ?? 0);
        const turn =
          path.turnAfter === null
            ? Infinity
            : path.warning +
              path.turnAfter / path.lanesPerPixel +
              (path.pause !== undefined && path.turnAfter > path.pause.after
                ? path.pause.length
                : 0);
        const stop =
          path.stopAfter === null ? Infinity : path.warning + path.stopAfter / path.lanesPerPixel;
        const cuts = [
          from,
          ...[pauseStart, pauseEnd, turn, stop].filter((at) => at > from && at < to),
          to,
        ].sort((a, b) => a - b);
        expect(moverPlace(5, path, from).travel).toBeCloseTo(geometry.sightLength);
        expect(moverPlace(5, path, to).travel).toBeCloseTo(
          geometry.sightLength + source.hitLength! + geometry.packHitLength,
        );
        let actual = 0;
        // Between these exact breakpoints the runtime trajectory is linear. Endpoint extrema
        // bound the entire continuous interval, including a pause, turn or stop.
        for (let index = 1; index < cuts.length; index++) {
          const a = moverPlace(5, path, cuts[index - 1]!).lanePosition;
          const b = moverPlace(5, path, cuts[index]!).lanePosition;
          const left = Math.min(a, b) - 0.5 + geometry.laneInset / geometry.cellLength;
          const right =
            Math.max(a, b) + crossSpan(path) - 0.5 - geometry.laneInset / geometry.cellLength;
          for (let lane = 0; lane < 5; lane++) {
            if (lane + 0.5 > left + 1e-9 && lane - 0.5 < right - 1e-9) {
              actual |= laneMask(lane, 1);
            }
          }
        }
        expect(laneMask(placement.lanes.first, placement.lanes.count)).toBe(actual);
        if (source === spec) {
          expect(placement.lanes.count).toBe(4);
        }
      }
    }
  }
});
