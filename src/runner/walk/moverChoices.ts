import {
  approachChoices,
  type ApproachPath,
  nearestStep,
  nextChoiceAt,
  nextStepAt,
  takeStep,
} from "../approach.ts";
import type { RoadPoint } from "../collision.ts";
import { moverPlace } from "../movers.ts";
import { awayHop, nextShyChoiceAt, shyChoices, type ShyPath, takeHop } from "../shy.ts";
import type { RoadGeometry } from "../walkGeometry.ts";
import type { WalkItem } from "../walkItems.ts";
import type { LaneMotion } from "./laneMotion.ts";
import { packCentre } from "./packPlacement.ts";

// A mover's centre on the road at a place.
function moverCentre(
  geometry: Pick<RoadGeometry, "cell" | "roadTop">,
  item: WalkItem,
  place: { readonly lanePosition: number; readonly travel: number },
): RoadPoint {
  return {
    x: (place.lanePosition + item.laneSpan / 2) * geometry.cell.length,
    y: geometry.roadTop - item.height / 2 + place.travel,
  };
}

// Each stalker whose next step is due to be chosen, as its cue begins or, with no cue, as it
// starts, chooses that step toward the pack where it is now (approach.ts): the pack's centre
// (packCentre), and the stalker's centre as the step starts.
export function stalkersStepped(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "packBand" | "roadTop">,
  motion: LaneMotion,
  items: readonly WalkItem[],
): WalkItem[] {
  const { cell, laneCount } = geometry;
  const pack = packCentre(geometry, motion);
  return items.map((item) => {
    const { mover } = item;
    if (mover?.path.motion !== "approach") {
      return item;
    }
    let path: ApproachPath = mover.path;
    for (let choice = nextChoiceAt(path); choice !== null && mover.since >= choice;) {
      const at = nextStepAt(path) ?? choice;
      const centre = moverCentre(geometry, item, moverPlace(laneCount, path, at));
      path = takeStep(
        path,
        nearestStep(cell.length, path.burst, centre, pack, approachChoices(path)),
      );
      choice = nextChoiceAt(path);
    }
    return path === mover.path ? item : { ...item, mover: { ...mover, path } };
  });
}

// Each shy hopper whose next hop is due to be chosen, as its cue begins or, with no cue, as it
// starts, chooses that hop away from the pack where it is now (shy.ts): the pack's centre
// (packCentre), with the lanes it is in or moving into, and the hopper's centre as the hop starts.
export function shyHopped(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "packBand" | "roadTop">,
  motion: LaneMotion,
  items: readonly WalkItem[],
): WalkItem[] {
  const { cell, laneCount } = geometry;
  const pack = {
    ...packCentre(geometry, motion),
    lanes: motion.kind === "still" ? [motion.lane] : [motion.from, motion.to],
  };
  return items.map((item) => {
    const { mover } = item;
    if (mover?.path.motion !== "shy") {
      return item;
    }
    let path: ShyPath = mover.path;
    for (let choice = nextShyChoiceAt(path); choice !== null && mover.since >= choice;) {
      const centre = moverCentre(
        geometry,
        item,
        moverPlace(laneCount, path, path.pending[0] ?? choice),
      );
      path = takeHop(path, awayHop(cell.length, path.burst, centre, pack, shyChoices(path)));
      choice = nextShyChoiceAt(path);
    }
    return path === mover.path ? item : { ...item, mover: { ...mover, path } };
  });
}
