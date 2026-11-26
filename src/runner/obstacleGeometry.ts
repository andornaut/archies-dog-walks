import { getOrInsertComputed } from "@andornaut/game-kit/runtime/maps";

import { IDLE_TAG, MOVING_TAGS } from "../assets/index.ts";
import type { EncounterId } from "../data/ids.ts";
import type { GameData, SignatureProfile } from "../data/index.ts";
import {
  COMPONENT_SILHOUETTES,
  hasObstacleArt,
  obstacleParts,
  obstacleSilhouette,
  PART_INSET,
} from "../layout/index.ts";
import { type Box, itemBox, type LanedBox } from "./collision.ts";
import { componentHitBoxes } from "./componentHitBoxes.ts";
import { drawnLanes, hasStopped, isSliding, type MoverPath, moverPlace } from "./movers.ts";
import { drawnObstacleBox, exitLength, type PlacedPart } from "./obstacleBox.ts";
import type { RoadGeometry } from "./walkGeometry.ts";
import {
  blocksLane,
  footprintOf,
  isObstacle,
  type ItemCategory,
  itemCategory,
  movementOf,
  type ObstacleKind,
  type WalkItem,
  type WalkItemKind,
} from "./walkItems.ts";

const PLACED_PARTS = new WeakMap<object, Map<string, readonly PlacedPart[]>>();

// The sprites an obstacle draws, standing or moving, with their silhouettes: each over every
// frame, or, with tags, the pose silhouette of the first of them its sprite has one for.
export function obstacleOnRoad(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell">,
  kind: ObstacleKind,
  moving: boolean,
  tags: readonly string[] = [],
): readonly PlacedPart[] {
  const byKind = getOrInsertComputed(data, () => new Map(), PLACED_PARTS);
  const key = `${geometry.cell.length} ${kind} ${moving} ${tags.join(",")}`;
  return getOrInsertComputed(
    key,
    () => {
      const { lanes } = footprintOf(data, kind);
      return obstacleParts(data, hasObstacleArt, kind, moving).map(({ behind, dx, key: art }) => ({
        behind,
        dx,
        silhouette: obstacleSilhouette(geometry.cell.length, lanes, art, tags),
      }));
    },
    byKind,
  );
}

// By lens, then the pack band's bottom, then the parts.
const EXIT_LENGTHS = new WeakMap<object, Map<number, Map<readonly PlacedPart[], number>>>();

type HitGeometry = Pick<RoadGeometry, "cell" | "itemHeights" | "lens" | "packBand">;

// How far an obstacle's drawn hit box runs up the road from its near edge as it leaves the pack's
// band (exitLength).
function drawnHitLength(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: HitGeometry,
  kind: ObstacleKind,
  moving: boolean,
): number {
  const parts = obstacleOnRoad(data, geometry, kind, moving);
  const { bottom } = geometry.packBand;
  const byBottom = getOrInsertComputed(geometry.lens, () => new Map(), EXIT_LENGTHS);
  const lengths = getOrInsertComputed(bottom, () => new Map(), byBottom);
  return getOrInsertComputed(
    parts,
    () => exitLength(geometry.lens, PART_INSET, parts, bottom),
    lengths,
  );
}

// The spacing and runtime height of one independently placed component, using its own art.
export function componentHitLength(
  geometry: Pick<RoadGeometry, "lens" | "packBand">,
  profile: Extract<SignatureProfile, { readonly kind: "delayedTrail" }>,
): number {
  const silhouette = COMPONENT_SILHOUETTES[profile.spriteKey];
  if (silhouette === undefined) {
    throw new Error(`Missing component silhouette ${profile.spriteKey}`);
  }
  return exitLength(
    geometry.lens,
    PART_INSET,
    [{ behind: 0, dx: 0, silhouette }],
    geometry.packBand.bottom,
  );
}

// The planner's inset at each end of a footprint row: whatever lane-blocking obstacle stands in
// a footprint, standing or moving, its hit length is no more than the footprint's rows less this
// at each end, so every blocking span it plans covers the obstacle's. A standing obstacle hits
// within its rows (hitReach), so only a mover drawn longer than its rows makes it negative.
export function plannedCellInset(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: HitGeometry,
): number {
  const kinds = [
    ...Object.keys(data.minorObstacles),
    ...Object.keys(data.encounters).filter((kind) => blocksLane(data, kind as EncounterId)),
  ] as ObstacleKind[];
  const { length } = geometry.cell;
  const over = Math.max(
    ...kinds.flatMap((kind) =>
      (movementOf(data, kind) === null ? [false] : [false, true]).map(
        (moving) =>
          itemHeight(data, geometry, kind, moving) - (footprintOf(data, kind).rows - 1) * length,
      ),
    ),
  );
  return (length - over) / 2;
}

// How far up the road from its near edge an obstacle may hit: a moving one as far as it is
// drawn, and a standing one no farther than its footprint's rows, so a standing sprite drawn
// taller than its rows draws over the road behind it but hits only within them.
export function hitReach(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell">,
  kind: ObstacleKind,
  moving: boolean,
): number {
  return moving ? Infinity : footprintOf(data, kind).rows * geometry.cell.length;
}

// An obstacle's hit length: how far its drawn hit box runs up the road from its near edge as it
// leaves the pack's band (exitLength), so its rows overlap the band exactly while its drawn hit
// box does, at most its hitReach. Anything else's is its item height.
export function itemHeight(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: HitGeometry,
  kind: WalkItemKind,
  moving: boolean,
): number {
  if (!isObstacle(data, kind)) {
    const category = itemCategory(data, kind) as Exclude<ItemCategory, "minor" | "obstacle">;
    return geometry.itemHeights[category];
  }
  return Math.min(
    drawnHitLength(data, geometry, kind, moving),
    hitReach(data, geometry, kind, moving),
  );
}

// The lane an item's footprint starts on: a mover's continuous place across the lanes, so one
// between lanes touches what is beside it in both, and anything else's lane.
function footprintLane(laneCount: number, item: WalkItem): number {
  const { mover } = item;
  return mover === undefined
    ? item.lane
    : moverPlace(laneCount, mover.path, mover.since).lanePosition;
}

// An item's footprint box on the road: its lanes less the inset at each side, along its height.
export function walkItemBox(
  geometry: Pick<RoadGeometry, "cell" | "laneCount">,
  item: WalkItem,
): Box {
  return itemBox(geometry.cell, { ...item, lane: footprintLane(geometry.laneCount, item) });
}

// The tags a mover's pose may be drawn in, most likely first: its dive while it slides, its idle
// once it has stopped, and otherwise its movement's.
function poseTags(path: MoverPath, since: number): readonly string[] {
  if (isSliding(path, since)) {
    return ["dive"];
  }
  return hasStopped(path, since) ? [IDLE_TAG] : MOVING_TAGS[path.movement];
}

// The box an obstacle hits the pack's parts with, in the lanes of its footprint: as it is drawn
// (drawnObstacleBox), from its sprites standing on its near edge across from the middle of the
// lanes it is drawn over (drawnLanes for a mover), a mover in its pose (poseTags), and a standing
// obstacle no farther up the road than its hitReach. Its spacing on the road is planned with its
// silhouette over every frame, which holds every pose's.
export function obstacleHitBox(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell" | "itemHeights" | "laneCount" | "lens" | "packBand">,
  item: WalkItem,
): LanedBox {
  if (!isObstacle(data, item.kind)) {
    throw new Error(`${item.kind} is not an obstacle`);
  }
  const component = componentHitBoxes(geometry, item)?.[0];
  if (component !== undefined) {
    return component;
  }
  const { cell, lens } = geometry;
  const feetY = item.y + item.height;
  const lane = footprintLane(geometry.laneCount, item);
  const lanes = { left: lane * cell.length, right: (lane + item.laneSpan) * cell.length };
  const { mover } = item;
  const drawn = mover === undefined ? item.laneSpan : drawnLanes(item.laneSpan, mover.path);
  const tags = mover === undefined ? [] : poseTags(mover.path, mover.since);
  const moving = mover !== undefined;
  const parts = obstacleOnRoad(data, geometry, item.kind, moving, tags);
  const x = (lane + drawn / 2) * cell.length;
  const reach = hitReach(data, geometry, item.kind, moving);
  return { ...drawnObstacleBox(lens, PART_INSET, parts, { feetY, x }, reach), lanes };
}

// A logical obstacle may draw separate components. Their gaps stay outside its hit boxes.
export function obstacleHitBoxes(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell" | "itemHeights" | "laneCount" | "lens" | "packBand">,
  item: WalkItem,
): readonly LanedBox[] {
  return componentHitBoxes(geometry, item) ?? [obstacleHitBox(data, geometry, item)];
}
