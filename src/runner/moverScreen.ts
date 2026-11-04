import type { MoverPath } from "./movers.ts";
import type { FeasibilityObserver } from "./spawnFeasibilityDiagnostics.ts";

// How many movers may be on screen at once: in all, darting, and in-lane slower than the road
// (the slow vehicles).
export interface MoverCaps {
  readonly darts: number;
  readonly slowVehicles: number;
  readonly total: number;
}

// A mover on screen over [start, end), and the caps it counts toward.
export interface OnScreen {
  readonly dart: boolean;
  readonly interval: readonly [number, number];
  readonly slowVehicle: boolean;
}

export function onScreenOf(path: MoverPath, interval: readonly [number, number]): OnScreen {
  return {
    dart:
      path.motion === "cross" ||
      (path.motion === "signature" &&
        (path.movement === "dart" ||
          path.movement === "dive" ||
          path.movement === "stopAndGoAcross")),
    interval,
    slowVehicle: path.motion === "ride" && path.speedMultiplier < 1,
  };
}

// True when a mover keeps within every cap alongside the movers already planned: at no moment
// are more on screen than a cap allows, of the movers that cap counts.
export function screenHasRoom(
  caps: MoverCaps,
  planned: readonly OnScreen[],
  mover: OnScreen,
  onFailure?: FeasibilityObserver,
): boolean {
  const [start, end] = mover.interval;
  const overlapping = planned.filter(({ interval: [from, to] }) => from < end && start < to);
  // The count on screen is highest at the start of one of the intervals.
  const moments = [
    start,
    ...overlapping.map(({ interval: [from] }) => from).filter((from) => from > start),
  ];
  const within = (cap: number, counted: (other: OnScreen) => boolean) =>
    !counted(mover) ||
    moments.every((moment) => {
      const active = overlapping.filter(
        (other) => counted(other) && other.interval[0] <= moment && moment < other.interval[1],
      );
      const fits = active.length < cap;
      if (!fits) {
        onFailure?.({ contributors: active, intrinsic: cap === 0, moment, rule: "screen-cap" });
      }
      return fits;
    });
  return (
    within(caps.total, () => true) &&
    within(caps.darts, (other) => other.dart) &&
    within(caps.slowVehicles, (other) => other.slowVehicle)
  );
}
