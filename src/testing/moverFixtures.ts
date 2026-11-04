import type { GameData } from "../data/types";
import { PART_INSET } from "../layout/packFormation";
import { currentZoneId } from "../rules/route";
import { read } from "../rules/units";
import { assignedMovement } from "../runner/movementAssignments";
import { drawMover, moverPlacements } from "../runner/moverPlanning";
import type { MoverPath } from "../runner/movers";
import { moverSpec } from "../runner/moverSpecs";
import { blockingLength } from "../runner/spawning";
import {
  componentHitLength,
  itemHeight,
  plannedCellInset,
  type RoadGeometry,
  walkScrollSpeed,
} from "../runner/walk";
import { blocksLane, footprintOf, type WalkItemKind } from "../runner/walkItems";
import type { RunState } from "../state/runState";
import { plannerStreams } from "./movers";

type FixtureData = Pick<
  GameData,
  "encounters" | "minorObstacles" | "movementAssignments" | "movementProfiles" | "tuning" | "world"
>;
interface MoverFixture {
  readonly kind: WalkItemKind;
  readonly lane: number;
  readonly mover: MoverPath;
  readonly speed: number;
}
interface MoverFixtureDraws {
  readonly placement: "native-default" | "seeded";
  readonly seed: number;
}

// Compile a representative native placement from the complete authored movement profile.
export function moverFixture(
  data: FixtureData,
  geometry: RoadGeometry,
  run: RunState,
  draws: MoverFixtureDraws,
  kind: WalkItemKind,
): MoverFixture {
  const movement = assignedMovement(data, currentZoneId(data, run), kind);
  if (movement === null) {
    throw new Error(`Mover fixture requires movement for ${kind}`);
  }
  const streams = plannerStreams(draws.seed);
  const speed = walkScrollSpeed(data, run);
  const { cell, laneCount, roadBottom, roadTop, sightLength, tallestPackBand } = geometry;
  const spec = moverSpec(data, streams, footprintOf(data, kind), movement);
  const placements = moverPlacements(
    {
      cellLength: cell.length,
      laneCount,
      laneInset: cell.inset,
      packHitLength: tallestPackBand - 2 * PART_INSET,
      packLength: tallestPackBand,
      roadLength: roadBottom - roadTop,
      rowSpacing: read(data.tuning, "pixels", "spawnRowSpacing"),
      scrollSpeed: speed,
      sightLength,
      window: blockingLength(
        {
          cellInset: plannedCellInset(data, geometry),
          cellLength: cell.length,
          packLength: tallestPackBand,
        },
        1,
      ),
    },
    {
      ...spec,
      ...(blocksLane(data, kind)
        ? {
            hitLength:
              movement.signature?.kind === "delayedTrail"
                ? componentHitLength(geometry, movement.signature)
                : itemHeight(data, geometry, kind, true),
          }
        : {}),
    },
    draws.placement === "seeded" ? drawMover(streams) : undefined,
  );
  const first = placements[0];
  if (first === undefined) {
    throw new Error(`No native placement for ${kind} fixture at seed ${draws.seed}`);
  }
  return { kind, lane: first.lane, mover: first.path, speed };
}
