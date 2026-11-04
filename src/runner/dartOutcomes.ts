import { itemAt } from "@andornaut/game-kit/arrays";

import type { LaneDirection } from "../layout/lanes.ts";
import { speedFactor } from "./moverDraws.ts";
import type {
  MoverDraws,
  MoverGeometry,
  MoverMotion,
  MoverSpawn,
  MoverSpec,
} from "./moverModel.ts";
import { crossLength, type MoverPath } from "./movers.ts";

// How a dart ends, by its outcome draw from 0 up to 1: below turnBackShare it turns back; below
// turnBackShare + stopShare it stops, in a lane at the low 1 - vergeShare of that stretch and on
// the far verge at the rest; and otherwise it crosses. The turn-back and stop shares add up to at
// most 1. One draw decides all of it, so the verge share takes no draw of its own.
type DartOutcome = "cross" | "stop" | "turn" | "verge";

export function dartOutcome(
  motion: Pick<
    Extract<MoverMotion, { kind: "cross" }>,
    "stopShare" | "turnBackShare" | "vergeShare"
  >,
  draw: number,
): DartOutcome {
  const { stopShare, turnBackShare, vergeShare } = motion;
  if (draw < turnBackShare) {
    return "turn";
  }
  if (draw < turnBackShare + stopShare * (1 - vergeShare)) {
    return "stop";
  }
  return draw < turnBackShare + stopShare ? "verge" : "cross";
}

// How far past the road's far edge, in lanes, a dart that stops on the verge stands: clear of
// the curb props on the widest sidewalk, where the ambient verge movers stop.
export const DART_VERGE_LANES = 1.25;

// Whether a crosser with a herring share is a red herring, by its outcome draw: below that share. A
// stop-and-go across has no other outcome, so a red herring takes no draw of its own.
export function isHerring(spec: MoverSpec, draws: MoverDraws): boolean {
  const { motion } = spec;
  return (
    motion.kind === "cross" && motion.herring !== undefined && draws.turn < motion.herring.share
  );
}

// A red herring crosser, one of its quota's in the rows from first to end: no mover on the road
// but scenery the walk never reads, which takes no cell, blocks no lane and counts toward no movement-class cap.
// It appears at its edge as its row comes on screen, its row the one its start draw picks among
// those rows that let it be gone before the zone ends, each as likely, on the side its side draw
// picks (below a half, the left), and sets off at once with no cue, crossing the whole road without
// stopping at its drawn speed. It drifts up the road as it crosses, at the tilt that has it gone
// past the far edge just as it is down to its share of the road ahead of the pack, or level with
// its row where it is gone sooner. With no such row, none shows.
export function herringSpawn<Kind extends string>(
  geometry: MoverGeometry & { readonly zoneLength: number },
  spec: MoverSpec,
  draws: MoverDraws,
  kind: Kind,
  rows: readonly number[],
): MoverSpawn<Kind> | null {
  const { laneCount, scrollSpeed, sightLength, zoneLength } = geometry;
  const { motion } = spec;
  if (motion.kind !== "cross" || motion.herring === undefined) {
    return null;
  }
  const span = spec.footprint.lanes;
  const lanesPerPixel = (motion.lanesPerSecond * speedFactor(spec.variation, draws)) / scrollSpeed;
  const crossing = crossLength(laneCount, span) / lanesPerPixel;
  const gone = sightLength * (1 - motion.herring.endRoadShare);
  const fitting = rows.filter((distance) => distance + crossing <= zoneLength);
  if (gone <= 0 || fitting.length === 0) {
    return null;
  }
  const direction: LaneDirection = draws.side < 0.5 ? 1 : -1;
  return {
    distance: itemAt(
      fitting,
      Math.min(fitting.length - 1, Math.floor(draws.start * fitting.length)),
    ),
    kind,
    lane: direction === 1 ? 0 : laneCount - span,
    mover: {
      direction,
      enterTravel: 0,
      idle: 0,
      lanesPerPixel,
      motion: "cross",
      movement: spec.movement,
      ...(span === 1 ? {} : { span }),
      stopAfter: null,
      tilt: Math.min(0, gone / crossing - 1),
      turnAfter: null,
      warning: 0,
    },
  };
}

// Whether a dart stops on the verge, past the road's far edge: one with a stop beyond the road.
export function stopsOnVerge(laneCount: number, path: MoverPath): boolean {
  return path.motion === "cross" && path.stopAfter !== null && path.stopAfter > laneCount;
}
