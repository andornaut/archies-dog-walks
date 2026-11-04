import { expect, it } from "vitest";

import type { MoverPath } from "../runner/movers.ts";
import { blockingSpans, GAME_ROAD, REAL } from "./planner.ts";

it("retains actual return-dart contact without extending it past runtime retirement", () => {
  const mover: MoverPath = {
    direction: -1,
    enterTravel: 433.85220198390573,
    idle: 313.85220198390573,
    lanesPerPixel: 0.01991338772792369,
    motion: "cross",
    movement: "dart",
    stopAfter: null,
    tilt: 0,
    turnAfter: 4.992472470039502,
    warning: 433.85220198390573,
  };
  const spans = blockingSpans(REAL, GAME_ROAD, "highPark", [
    { distance: 17995, kind: "otherDog", lane: 4, mover },
  ]);
  const touches = (lane: number, at: number) =>
    spans.some(
      (span) => span.lane === lane && span.distance <= at && at < span.distance + span.length,
    );
  expect(touches(1, 18595)).toBe(true);
  expect(touches(3, 18815)).toBe(false);
  expect(Math.max(...spans.map((span) => span.distance + span.length))).toBeCloseTo(
    18760.11813643927,
    6,
  );
});
