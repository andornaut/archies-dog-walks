import { expect, it } from "vitest";

import { MOVEMENT_PROFILES } from "../data/movementProfiles";
import { visibleMoverRows } from "./moverCoverage";
import type { MoverPath } from "./movers";
import type { SlotPlacement } from "./slotFeasibility";

const geometry = {
  cellLength: 64,
  laneCount: 5,
  laneInset: 12,
  roadLength: 100,
};
function entry(path: MoverPath, nativeUntil = 500): SlotPlacement<string> {
  return {
    event: { distance: 0, kind: "mover", lane: 2, mover: path },
    herring: false,
    request: { blocksLane: true, count: 1, footprint: { lanes: 1, rows: 1 }, kind: "mover" },
    trace: {
      entry: 0,
      hazard: true,
      index: 0,
      kind: "mover",
      lane: 2,
      memberIndex: 0,
      nativeUntil,
      quotaIndex: 0,
      row: 0,
      source: "events",
      until: 1000,
    },
  };
}
it("credits visible pre-contact bodies while excluding off-road and cue-only phases", () => {
  const body = entry({ lane: 2, motion: "steps", movement: "step", steps: [], warning: 0 });
  expect(visibleMoverRows(geometry, [0, 50, 200], body)).toEqual([1]);
  expect(
    visibleMoverRows(
      geometry,
      [50],
      entry({ lane: -2, motion: "steps", movement: "step", steps: [], warning: 0 }),
    ),
  ).toEqual([]);
  expect(
    visibleMoverRows(
      geometry,
      [50],
      entry({
        lane: 2,
        lanes: 1,
        motion: "ride",
        movement: "inLane",
        speedMultiplier: 1.5,
        warning: 100,
      }),
    ),
  ).toEqual([]);
});
it("excludes hypothetical stopped scenery and nonblocking or herring bodies", () => {
  const body = entry(
    { lane: 2, lanes: 1, motion: "ride", movement: "inLane", speedMultiplier: 0.1, warning: 0 },
    100,
  );
  expect(visibleMoverRows(geometry, [50, 150], body)).toEqual([0]);
  expect(visibleMoverRows(geometry, [50], { ...body, herring: true })).toEqual([]);
  expect(
    visibleMoverRows(geometry, [50], { ...body, request: { ...body.request, blocksLane: false } }),
  ).toEqual([]);
});
it("counts actual delayed followers after their leader has left the road", () => {
  const profile = MOVEMENT_PROFILES.ducklingTrail;
  if (profile?.kind !== "delayedTrail") {
    throw new Error("Expected delayed trail profile");
  }
  const body = entry({
    lane: 0,
    motion: "signature",
    movement: "follow",
    route: {
      complete: 1000,
      componentDelays: [0, 15, 30],
      cues: [],
      entryEnd: 0,
      legs: [{ at: 0, easing: "linear", from: { x: 0, y: 50 }, length: 100, to: { x: 6, y: 50 } }],
      profile,
      scrollSpeed: 100,
      tail: { x: 0, y: 0 },
    },
    warning: 0,
  });
  expect(visibleMoverRows(geometry, [100, 150], body)).toEqual([0]);
});
