import type { StopLanes } from "../data/types.ts";
import type { LaneDirection } from "../layout/lanes.ts";
import { DART_VERGE_LANES, dartOutcome } from "./dartOutcomes.ts";
import { drawnCount, rangeAt, speedFactor } from "./moverDraws.ts";
import {
  blockCells,
  bodyLength,
  drawnHitLength,
  rowsCovering,
  sweptLanes,
} from "./moverExtents.ts";
import type { MoverMotion, MoverPlacement, PlacementContext } from "./moverModel.ts";
import { crossingScroll, crossLength, crossScrollTo, type MoverPath } from "./movers.ts";

// The tilts a crosser draws from on a road scrolling at scrollSpeed: its range, its high end cut
// to the steepest that still leaves the pack reactionSeconds from a start highest of the road
// ahead, but never below its low end.
function crossTilts(
  motion: Pick<Extract<MoverMotion, { kind: "cross" }>, "reactionSeconds" | "tilt">,
  scrollSpeed: number,
  sightLength: number,
  highest: number,
): readonly [number, number] {
  const [low, high] = motion.tilt;
  const steepest = (highest * sightLength) / (motion.reactionSeconds * scrollSpeed) - 1;
  return [low, Math.max(low, Math.min(high, steepest))];
}

// A crosser sets off at its drawn share of the road ahead of the pack, the tallest pack's rows at
// sightLength, at its drawn speed and tilt: one placement per side it enters from, its contact with
// the pack, if it has one, starting as its row's window does. Its share is drawn from
// startRoadShare, its low end raised to leave the pack reactionSeconds between its cue ending and
// its reaching the pack's rows at its tilt, and its high end raised with it where a steep tilt
// needs, but never above the highest share that shows its cue wholly on the road. Its tilt is drawn
// from its range cut to the steepest that leaves a share at that highest, at the road's pace; with
// none, even at its range's lowest, it has no placement. Lifted, it sets off that share of the way
// from its drawn share up to the highest that shows its cue, at the same tilt, which leaves the
// pack at least its reaction time. One that turns back crosses back the whole road from its turn,
// on the road and in sight the longer for it, keeping clear every row it is level with and meeting
// the pack in every lane it sweeps either way while its row is in the window. One that stops stands
// in its stop lane, coming down the road with it, until it scrolls off the road's bottom: it meets
// the pack in every lane it sweeps to its stop and in its stop lane, and its start is raised as far
// as needed for the pack to have reactionSeconds to its reaching the pack's rows, which a tilt
// below 0 brings sooner once it stops; past the road's far edge, its stop lane is no stop, and it
// crosses. One that stops on the verge is planned as one that crosses: off the road it is out of
// play, so it holds its rows only while it crosses and stands nowhere past the road. Its contact
// lasts as long as its travel takes to cross the window, window / (1 + tilt) while it crosses,
// which its rows cover. It blocks every lane a box a lane wide would touch, but stands only in the
// lanes its drawn hit box touches over its drawn contact with the pack's hit boxes, until its hit
// box leaves the road if that comes before its contact's end: a stand wider or longer than its hit
// box would hide the road beside or behind it that the pack can step into. One that has crossed
// the road by the time it reaches the pack's rows is harmless: it blocks no lanes and stands
// nowhere. It keeps clear every row it is level with as it crosses or stands. It appears as its
// row comes on screen, or at the road's top where its start is farther up the road than its row,
// and waits idle at its edge until its cue, warningSeconds before it sets off. One with a pause, a
// stop-and-go across, is a vehicle, not a dart: level with its row the whole time it is on screen,
// stops included, it has a body in every lane its hit box touches from setting off until its hit
// box has left the road's bottom, standing in its pause on the way, from its row up the road for
// its hit length, its drawn one or its footprint's planned one, whichever is longer, so no standing
// spawn stands where it crosses. It has placements for each of its stops, from either side, each
// with the lanes it covers there.
export function crossPlacements(
  context: PlacementContext,
  motion: Extract<MoverMotion, { kind: "cross" }>,
  lift: number,
): MoverPlacement[] {
  const { draws, geometry, spec } = context;
  const { cellLength, laneCount, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const cueOnRoad = 1 - (warning + cellLength) / sightLength;
  const tilt = rangeAt(crossTilts(motion, scrollSpeed, sightLength, cueOnRoad), draws.tilt);
  if (tilt <= -1) {
    throw new Error("A crosser's tilt must keep it coming down the road");
  }
  const lanesPerPixel = (motion.lanesPerSecond * speedFactor(spec.variation, draws)) / scrollSpeed;
  const outcome = dartOutcome(motion, draws.turn);
  const turnAfter =
    outcome === "turn" ? rangeAt(motion.turnAtShare, draws.turnAt) * laneCount : null;
  // It stops in the middle of the stopLanes-th lane from its edge, half a lane short of that many.
  const stopLanes = drawnCount(motion.stopLanes, draws.turnAt);
  // One that stops on the verge stops DART_VERGE_LANES past the far edge.
  const stopAfter =
    outcome === "verge"
      ? laneCount + DART_VERGE_LANES
      : outcome === "stop" && stopLanes <= laneCount
        ? stopLanes - 0.5
        : null;
  // Whether it is planned as one that crosses: it never stands on the road. One that stops on the
  // verge is out of play once off the road, so it is.
  const crosses = stopAfter === null || stopAfter > laneCount;
  const span = spec.footprint.lanes;
  if (motion.pause !== undefined && tilt !== 0) {
    throw new Error("A crosser that pauses must cross level with the road");
  }
  const shared = { crosses, lanesPerPixel, span, stopAfter, tilt, turnAfter, warning };
  if (motion.pause === undefined) {
    return crossPlacementsAt(context, motion, lift, {
      ...shared,
      after: null,
      directions: [1, -1],
    });
  }
  return motion.pause.stops.flatMap((stop) =>
    ([1, -1] as const).flatMap((direction) =>
      crossPlacementsAt(context, motion, lift, {
        ...shared,
        after: stopCrossed(laneCount, span, direction, stop),
        directions: [direction],
      }),
    ),
  );
}

// The lanes a stop-and-go across span lanes wide has crossed, from the edge it enters from on
// direction's side, when it stands covering stop's lanes.
function stopCrossed(
  laneCount: number,
  span: number,
  direction: LaneDirection,
  stop: StopLanes,
): number {
  const [first, last] = stop;
  if (last - first + 1 !== span || first < 0 || last >= laneCount) {
    throw new Error("A stop covers as many lanes on the road as its crosser is wide");
  }
  return direction === 1 ? first + span - 0.5 : laneCount - 0.5 - first;
}

// What a crosser's placements share whatever its start (crossPlacements): its stop's lanes crossed,
// if it pauses, and the sides it enters from.
interface CrossShape {
  readonly after: number | null;
  readonly crosses: boolean;
  readonly directions: readonly LaneDirection[];
  readonly lanesPerPixel: number;
  readonly span: number;
  readonly stopAfter: number | null;
  readonly tilt: number;
  readonly turnAfter: number | null;
  readonly warning: number;
}

// A crosser's placements from each of its sides, with its pause, if it has one, at one stop
// (crossPlacements).
function crossPlacementsAt(
  context: PlacementContext,
  motion: Extract<MoverMotion, { kind: "cross" }>,
  lift: number,
  shape: CrossShape,
): MoverPlacement[] {
  const { draws, geometry, spec, work } = context;
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength, window } =
    geometry;
  const { after, crosses, lanesPerPixel, span, stopAfter, tilt, turnAfter, warning } = shape;
  const cueOnRoad = 1 - (warning + cellLength) / sightLength;
  const pause =
    motion.pause === undefined || after === null
      ? {}
      : { pause: { after, cue: warning, length: motion.pause.seconds * scrollSpeed } };
  // Its path but for the side it enters from, which none of the distances below depend on.
  const along = {
    direction: 1,
    enterTravel: 0,
    idle: 0,
    lanesPerPixel,
    motion: "cross",
    movement: spec.movement,
    ...pause,
    ...(motion.slide !== undefined && stopAfter !== null && !crosses
      ? { slide: motion.slide }
      : {}),
    ...(span === 1 ? {} : { span }),
    stopAfter,
    tilt,
    turnAfter,
    warning,
  } as const;
  // The travel it comes down the road in reactionSeconds of setting off.
  const reaction = motion.reactionSeconds * scrollSpeed;
  const reacting = crosses
    ? reaction * (1 + tilt)
    : Math.max(reaction * (1 + tilt), reaction + tilt * Math.min(reaction, crossingScroll(along)));
  const lowest = Math.max(motion.startRoadShare[0], reacting / sightLength);
  const highest = Math.min(cueOnRoad, Math.max(motion.startRoadShare[1], lowest));
  if (highest < lowest) {
    return [];
  }
  const drawn = rangeAt([lowest, highest], draws.start);
  const ahead = rangeAt([drawn, cueOnRoad], lift) * sightLength;
  const enterTravel = sightLength - ahead;
  const scrollTo = (travel: number) => crossScrollTo(along, travel - enterTravel);
  // The scroll from setting off to reaching the pack's rows, and to leaving the road or sight:
  // half a lane past the far edge, or past the edge it entered from once it has turned back. One
  // that stops leaves only off the road's bottom.
  const reaches = crosses ? ahead / (1 + tilt) : scrollTo(sightLength);
  const offRoad = scrollTo(roadLength + cellLength);
  // The scroll from setting off to having crossed lanes lanes, standing in its pause on the way.
  const crossed = (lanes: number) =>
    lanes / lanesPerPixel +
    ("pause" in pause && lanes > pause.pause.after ? pause.pause.length : 0);
  const across = turnAfter === null ? crossLength(laneCount, span) - 0.5 : 2 * turnAfter;
  const moving = crosses ? Math.min(crossed(across + 0.5), offRoad) : offRoad;
  // It shows as its row comes on screen, or at the road's top where it starts farther up the road
  // than its row: waiting idle at its edge until its cue, warning before it sets off.
  const shown = Math.max(warning, Math.min(enterTravel, sightLength - reaches));
  const appears = sightLength - shown - reaches;
  // Its hit box's inset at each side, in lanes, and the scroll from setting off to its hit box
  // leaving the road, which one that stops never does.
  const inset = geometry.laneInset / cellLength;
  const touching = crossed(across + 0.5 - inset);
  // Its contact with the pack's rows, a window long: while it crosses, the travel its window
  // takes at its tilt, cut short where its hit box leaves the road; once it stops, until the
  // window has passed.
  const contactOver = (length: number) =>
    crosses
      ? Math.max(0, Math.min(length / (1 + tilt), touching - reaches))
      : scrollTo(sightLength + length) - reaches;
  const contact = contactOver(window);
  // The row offset it is level with, moving away from its own as it drifts against the road while
  // it crosses, and keeping level with one row once it stops.
  const drift = (scroll: number) => tilt * Math.min(scroll, crossingScroll(along));
  const level = (scroll: number) =>
    crosses
      ? (-tilt * (scroll - reaches)) / rowSpacing
      : -(drift(scroll) - drift(reaches)) / rowSpacing;
  const firstRow = Math.floor(Math.min(level(0), level(moving)) + 1e-9);
  const lastRow = Math.ceil(Math.max(level(0), level(moving)) - 1e-9);
  const rows = rowsCovering(geometry, 1, crosses ? 1 / (1 + tilt) : contact / window);
  // Its contact as drawn, for its stand: its own hit length and the pack's hit boxes.
  const drawnWindow = drawnHitLength(geometry, spec) + geometry.packHitLength;
  const drawnContact = contactOver(drawnWindow);
  const bodyTo = Math.max(
    drawnHitLength(geometry, spec),
    bodyLength(geometry, spec.footprint.rows),
  );
  return shape.directions.map((direction): MoverPlacement => {
    work?.beforePlacement();
    const path: MoverPath = {
      ...along,
      direction,
      enterTravel,
      idle: shown - warning,
      warning: shown,
    };
    const touched = sweptLanes(laneCount, path, sightLength, sightLength + drawnWindow, inset);
    // The safe path excludes actual collision contact, not a larger generic one-row body.
    const lanes = touched;
    const body = {
      from: 0,
      lanes: sweptLanes(laneCount, path, 0, roadLength + bodyTo, inset),
      to: bodyTo,
    };
    return {
      appears,
      ...("pause" in pause ? { body } : {}),
      cells: blockCells(firstRow, lastRow - firstRow + 1, 0, laneCount),
      lane: direction === 1 ? 0 : laneCount - span,
      lanes,
      path,
      rows,
      screen: [appears, appears + shown + moving],
      stands:
        touched.count > 0
          ? [
              {
                distance: 0,
                lane: touched.first,
                lanes: touched.count,
                length: drawnContact - geometry.packHitLength,
              },
            ]
          : [],
      ...("pause" in pause
        ? {
            stop: {
              count: span,
              first:
                direction === 1
                  ? 0.5 - span + pause.pause.after
                  : laneCount - 0.5 - pause.pause.after,
            },
          }
        : {}),
    };
  });
}
