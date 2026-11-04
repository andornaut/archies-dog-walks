import { describe, expect, it } from "vitest";

import {
  destinationLane,
  type LaneMotion,
  laneMotionX,
  type MovingLaneMotion,
  startMove,
  stillInLane,
  turnAround,
} from "./laneMotion.ts";

const config = { laneCount: 5, moveDuration: 0.2 };
const laneXs = [108, 164, 220, 276, 332];

const moving = (from: number, to: number, elapsed = 0): MovingLaneMotion => ({
  duration: 0.2,
  elapsed,
  from,
  kind: "moving",
  to,
});

describe("startMove", () => {
  it.each([
    { direction: 1, expected: moving(2, 3), lane: 2, name: "starts a move right" },
    { direction: -1, expected: moving(2, 1), lane: 2, name: "starts a move left" },
    { direction: -1, expected: stillInLane(0), lane: 0, name: "stays still off the left edge" },
    { direction: 1, expected: stillInLane(4), lane: 4, name: "stays still off the right edge" },
    {
      direction: 1,
      duration: 0,
      expected: stillInLane(3),
      lane: 2,
      name: "changes lane at once when the move takes no time",
    },
  ] satisfies readonly {
    direction: 1 | -1;
    duration?: number;
    expected: LaneMotion;
    lane: number;
    name: string;
  }[])("$name", ({ direction, duration, expected, lane }) => {
    const moveDuration = duration ?? config.moveDuration;
    expect(startMove({ ...config, moveDuration }, direction, lane)).toEqual(expected);
  });
});

describe("turnAround", () => {
  it("heads back the way the pack came at once, from where it is, or is still if it had not moved", () => {
    const before = moving(2, 3, 0.05);
    const turned = turnAround(before);
    expect(turned).toMatchObject({ from: 3, kind: "moving", to: 2 });
    expect(turned.kind === "moving" && turned.elapsed).toBeCloseTo(0.15);
    expect(laneMotionX(laneXs, turned)).toBeCloseTo(laneMotionX(laneXs, before));
    expect(turnAround(moving(2, 1, 0.12))).toMatchObject({ from: 1, to: 2 });
    expect(turnAround(moving(2, 3, 0))).toEqual(stillInLane(2));
  });
});

describe("destinationLane and laneMotionX", () => {
  it("are the lane and its centre while still, and the lane moved to and a point between while moving", () => {
    expect(destinationLane(stillInLane(1))).toBe(1);
    expect(laneMotionX(laneXs, stillInLane(4))).toBe(332);
    expect(destinationLane(moving(2, 3))).toBe(3);
    expect(laneMotionX(laneXs, moving(2, 3, 0.05))).toBeCloseTo(234);
    expect(laneMotionX(laneXs, moving(2, 1, 0.1))).toBeCloseTo(192);
  });
});
