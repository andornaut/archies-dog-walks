import type { GameData } from "../../data/index.ts";
import { hasLeftRoad, isWarning, laneAt, moverPlace, moverY } from "../movers.ts";
import { obstacleHitBoxes } from "../obstacleGeometry.ts";
import { signatureAlive } from "../signaturePaths.ts";
import type { RoadGeometry } from "../walkGeometry.ts";
import { isObstacle, isPickup, type WalkItem } from "../walkItems.ts";

export function signatureOnRoad(geometry: RoadGeometry, item: WalkItem): boolean {
  const { mover } = item;
  return (
    mover?.path.motion !== "signature" ||
    signatureAlive(
      { laneCount: geometry.laneCount, roadLength: geometry.roadBottom - geometry.roadTop },
      { height: item.height, span: item.laneSpan },
      mover.path.route,
      mover.since,
    )
  );
}

interface SortedItems {
  readonly cues: WalkItem[];
  readonly passed: WalkItem[];
  readonly pickups: WalkItem[];
  readonly solid: WalkItem[];
}

// The road's items, in order, after the road scrolls travel, then the items arriving: each
// moved down by travel, each mover moved on by it, and the crossers that have left the road
// and whatever has scrolled wholly past its bottom dropped. They are sorted into the movers
// that are still only a cue, which cannot be hit, the pickups, and the solid items, which can.
export function scrolledItems(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: RoadGeometry,
  travel: number,
  items: readonly WalkItem[],
  arrived: readonly WalkItem[],
): SortedItems {
  const { laneCount, roadBottom, roadTop } = geometry;
  const sorted: SortedItems = { cues: [], passed: [], pickups: [], solid: [] };
  for (const item of items) {
    if (passedWalker(data, geometry, item)) {
      sorted.passed.push(item);
      continue;
    }
    const { mover } = item;
    if (mover === undefined) {
      const y = item.y + travel;
      if (y < roadBottom) {
        sortItem(laneCount, sorted, { ...item, y });
      }
      continue;
    }
    const since = mover.since + travel;
    const place = moverPlace(laneCount, mover.path, since);
    const y = moverY(roadTop, item.height, place);
    const advanced = { ...item, mover: { ...mover, since }, y };
    const live =
      mover.path.motion === "signature"
        ? signatureOnRoad(geometry, advanced) || signatureOnRoad(geometry, item)
        : !hasLeftRoad(laneCount, place) && y < roadBottom;
    if (live) {
      const lane = laneAt(place.lanePosition);
      sortItem(laneCount, sorted, { ...advanced, lane });
    }
  }
  for (const item of arrived) {
    if (item.mover?.path.motion === "signature" || item.y < roadBottom) {
      sortItem(laneCount, sorted, item);
    }
  }
  return sorted;
}

// A mover is passed only when its whole hit extent, including every trailing component,
// is below the walker. Removing it from the road makes that retirement irreversible.
export function passedWalker(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: RoadGeometry,
  item: WalkItem,
): boolean {
  return (
    item.mover !== undefined &&
    isObstacle(data, item.kind) &&
    obstacleHitBoxes(data, geometry, item).every(({ top }) => top >= geometry.lens.footY)
  );
}

function sortItem(laneCount: number, sorted: SortedItems, item: WalkItem): void {
  const cue = isWarning(laneCount, item);
  if (cue) {
    sorted.cues.push(item);
  }
  if (isPickup(item.kind)) {
    sorted.pickups.push(item);
  } else if (!cue) {
    sorted.solid.push(item);
  }
}
