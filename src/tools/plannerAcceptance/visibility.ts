import { gameData } from "../../data/index.ts";
import { herringNow } from "../../road/herrings.ts";
import { nextChoiceAt } from "../../runner/approach.ts";
import { drawnLanes, type MoverPath, moverPlace } from "../../runner/movers.ts";
import { screenRoadGeometry } from "../../runner/screenGeometry.ts";
import { nextShyChoiceAt } from "../../runner/shy.ts";
import { signaturePlace } from "../../runner/signaturePaths.ts";
import type { SlotAssignment } from "../../runner/slotPlan.ts";
import type { SpawnPlan } from "../../runner/spawning.ts";
import type { WalkItemKind } from "../../runner/walkItems.ts";
import type { RunState } from "../../state/runState.ts";

export type VisibleGeometry = Pick<
  SpawnPlan<WalkItemKind>,
  "cellLength" | "laneCount" | "laneInset" | "roadLength" | "zoneLength"
>;

export interface VisibleWitness {
  readonly since: number;
  readonly source: "events" | "herrings";
}

interface Point {
  readonly lanePosition: number;
  readonly solid: boolean;
  readonly travel: number;
}

// The scroll distances since spawn where a mover's place can change: its steps' and legs' ends,
// its warning and a crosser's arrival on the road.
function knots(laneCount: number, path: MoverPath): number[] {
  const points = [path.warning];
  if ("steps" in path) {
    points.push(...path.steps.flatMap((step) => [step.at, step.at + step.length]));
  }
  if (path.motion === "signature") {
    points.push(
      ...path.route.componentDelays.flatMap((delay) =>
        path.route.legs.flatMap((leg) => [leg.at + delay, leg.at + leg.length + delay]),
      ),
    );
  }
  if (path.motion === "cross") {
    points.push(path.warning + (laneCount + (path.span ?? 1)) / (2 * path.lanesPerPixel));
  }
  return points;
}

function places(laneCount: number, path: MoverPath, since: number): Point[] {
  if (path.motion === "signature") {
    return path.route.componentDelays.map((_, component) => {
      const place = signaturePlace(path.route, since, component);
      return { lanePosition: place.x, solid: true, travel: place.y };
    });
  }
  return [moverPlace(laneCount, path, since)];
}

// A visible witness for one active assignment: a scroll distance at which its native body stands
// inside the visible road before any unresolved choice or native exit. An authored herring must
// also render there through the renderer's herringNow.
export function visibleWitness(
  geometry: VisibleGeometry,
  run: RunState,
  assignment: SlotAssignment<WalkItemKind>,
): VisibleWitness | null {
  const { entry } = assignment;
  const { event } = entry;
  const lo = Math.max(0, -event.distance);
  const hi = Math.min(
    entry.trace.nativeUntil - event.distance,
    geometry.zoneLength - event.distance,
  );
  if (!(hi > lo)) {
    return null;
  }
  const path = event.mover;
  if (path === undefined) {
    return { since: (lo + hi) / 2, source: "events" };
  }
  const cut =
    path.motion === "approach"
      ? nextChoiceAt(path)
      : path.motion === "shy"
        ? nextShyChoiceAt(path)
        : null;
  const end = cut === null ? hi : Math.min(hi, cut);
  if (!(end > lo)) {
    return null;
  }
  const sorted = [
    ...new Set(
      [lo, end, ...knots(geometry.laneCount, path)].filter(
        (point) => Number.isFinite(point) && point >= lo && point <= end,
      ),
    ),
  ].sort((a, b) => a - b);
  const samples = [
    ...sorted,
    ...sorted.slice(1).map((point, index) => (point + sorted[index]!) / 2),
    lo + Math.min((end - lo) / 2, 0.001),
  ];
  const mover = entry.request.mover;
  if (mover === undefined) {
    return null;
  }
  const span = drawnLanes(mover.footprint.lanes, path);
  const inset = geometry.laneInset / geometry.cellLength;
  const height = mover.hitLength ?? mover.footprint.rows * geometry.cellLength;
  const inside = (point: Point) =>
    point.solid &&
    point.travel > 0 &&
    point.travel - height < geometry.roadLength &&
    point.lanePosition + span - inset > 0 &&
    point.lanePosition + inset < geometry.laneCount;
  const road = screenRoadGeometry(run);
  for (const since of samples) {
    if (!(since >= lo && since < end)) {
      continue;
    }
    if (entry.herring) {
      const item = herringNow(gameData, road, event.distance + since, event);
      if (item !== null && inside(moverPlace(geometry.laneCount, path, since))) {
        return { since, source: "herrings" };
      }
    } else if (places(geometry.laneCount, path, since).some(inside)) {
      return { since, source: "events" };
    }
  }
  return null;
}
