import type { SignatureProfile, StopLanes } from "../data/types.ts";
import type { LaneDirection } from "../layout/lanes.ts";
import { DART_VERGE_LANES, dartOutcome } from "./dartOutcomes.ts";
import {
  delayOf,
  drawnCount,
  drawnStepCount,
  EVEN_DRAWS,
  moveLength,
  rangeAt,
  speedFactor,
} from "./moverDraws.ts";
import {
  blockCells,
  bodyLength,
  drawnHitLength,
  laneSpan,
  rowsCovering,
  sweptLanes,
} from "./moverExtents.ts";
import { stepSpots } from "./moverHops.ts";
import type {
  MoverDraws,
  MoverGeometry,
  MoverMotion,
  MoverPlacement,
  MoverPlacementWork,
  MoverSpec,
  PlacementContext,
  ShyHops,
} from "./moverModel.ts";
import {
  type ApproachTiming,
  crossingScroll,
  crossLength,
  crossScrollTo,
  type LaneSpan,
  type MoverPath,
  type MoverStep,
} from "./movers.ts";
import {
  compileSignature,
  signaturePlace,
  type SignatureSweep,
  signatureTravelSweeps,
} from "./signaturePaths.ts";

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
function crossPlacements(
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
export function stopCrossed(
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

// A rider enters as its row reaches the point where riding at its speed brings it to the pack
// just as the row's window starts. Faster than the road, it overtakes what is in its lanes,
// from the rows above its own to those below the pack; slower, those rows overtake it, and it
// overlaps the pack for longer, which its rows cover. Its speed is its kind's at its drawn
// factor; every factor keeps it coming down the road. Its cue shows from as soon as its row comes
// on screen, and for at least warningSeconds. One that merges moves a lane to either side that
// stays on the road, one placement each, starting once its travel is its merge's share of the way
// to the pack's rows. Its full visible cue may start before body entry; the merge must finish
// before pack contact. With no room for the complete merge itself, it
// has no placement. It is placed as a rider over both its lanes, blocking and standing in each.
function ridePlacements(
  context: PlacementContext,
  motion: Extract<MoverMotion, { kind: "ride" }>,
): MoverPlacement[] {
  const { draws, geometry, spec, work } = context;
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength } = geometry;
  const speedMultiplier = motion.speedMultiplier * speedFactor(spec.variation, draws);
  if (speedMultiplier <= 0 || speedMultiplier === 1) {
    throw new Error("A rider must move faster or slower than the road");
  }
  const { lanes: across, rows } = spec.footprint;
  const warning = spec.warningSeconds * scrollSpeed;
  const enters = sightLength - sightLength / speedMultiplier;
  // Its cue shows from as soon as its row comes on screen, and never for less than its warning.
  const shown = Math.max(warning, enters);
  const leaves = enters + (roadLength + rows * cellLength) / speedMultiplier;
  // The row offset, in distance, that the rider's near end is level with at a scroll.
  const level = (scroll: number) => scroll - speedMultiplier * (scroll - enters);
  const firstRow = Math.floor(Math.min(level(enters), level(leaves)) / rowSpacing);
  const lastRow = Math.ceil(
    (Math.max(level(enters), level(leaves)) + (rows - 1) * cellLength) / rowSpacing,
  );
  const blockRows = rowsCovering(geometry, rows, 1 / speedMultiplier);
  // Its body covers the road its near end is level with from entering until its hit box, drawn
  // no longer than its planned hit length, has left the road's bottom, and its hit length above.
  const length = bodyLength(geometry, rows);
  const gone = enters + (roadLength + Math.max(length, rows * cellLength)) / speedMultiplier;
  const [nearest, farthest] = [level(enters), level(gone)].sort((a, b) => a - b);
  // A merge's start, as travel down the road from the road's top, and its length in scroll.
  const mergeLength = (motion.merge?.seconds ?? 0) * scrollSpeed;
  const latestMergeFrom = sightLength - mergeLength * speedMultiplier;
  if (motion.merge !== undefined && latestMergeFrom < 0) {
    return [];
  }
  const onRoadMergeFrom = Math.max(
    warning * speedMultiplier,
    Math.min((motion.merge?.at ?? 0) * sightLength, latestMergeFrom),
  );
  // Keep existing feasible timing. A fast rider's cue can start at its visible lane sign
  // before the body enters, with the full merge ending before the pack-contact boundary.
  const mergeFrom =
    onRoadMergeFrom > latestMergeFrom ? Math.max(0, latestMergeFrom - 1e-9) : onRoadMergeFrom;
  const directions = motion.merge === undefined ? [0] : [-1, 1];
  return Array.from({ length: laneCount - across + 1 }, (_, lane) => lane).flatMap((lane) =>
    directions.flatMap((direction): MoverPlacement[] => {
      const merged = lane + direction;
      if (merged < 0 || merged + across > laneCount) {
        return [];
      }
      work?.beforePlacement();
      const lanes = { count: across + Math.abs(direction), first: Math.min(lane, merged) };
      const merge =
        direction === 0
          ? {}
          : {
              merge: {
                at: shown + mergeFrom / speedMultiplier,
                cue: warning,
                lanes: direction as LaneDirection,
                length: mergeLength,
              },
            };
      return [
        {
          appears: enters - shown,
          body: { from: nearest ?? 0, lanes, to: (farthest ?? 0) + length },
          cells: blockCells(firstRow, lastRow - firstRow + 1, lanes.first, lanes.count),
          lane,
          lanes,
          path: {
            lane,
            lanes: across,
            ...merge,
            motion: "ride",
            movement: spec.movement,
            speedMultiplier,
            warning: shown,
          },
          rows: blockRows,
          screen: [enters - shown, leaves],
          stands: [
            {
              distance: 0,
              lane: lanes.first,
              lanes: lanes.count,
              length:
                (drawnHitLength(geometry, spec) + geometry.packHitLength) / speedMultiplier -
                geometry.packHitLength,
            },
          ],
        },
      ];
    }),
  );
}

// Where a mover that stands on the road may be, by lane offset and travel from where it spawns.
interface StandOffset {
  readonly lane: number;
  readonly travel: number;
}

// The placements of a mover that stands on the road from its spawn and may be at any of the
// spots given, by offset from its start, one per start lane that keeps them on the road: it
// blocks every lane it may be in for as long as it can overlap the pack, and stands at every
// spot. It spawns late enough that its furthest spot toward the pack meets the pack no sooner
// than its row would.
function standingPlacements(
  context: PlacementContext,
  spots: readonly StandOffset[],
  pathAt: (start: number) => MoverPath,
): MoverPlacement[] {
  const { geometry, spec, work } = context;
  const { cellLength, laneCount, roadLength, rowSpacing, window } = geometry;
  const { lanes: across, rows } = spec.footprint;
  const height = rows * cellLength;
  const lanes = spots.map(({ lane }) => lane);
  const travels = spots.map(({ travel }) => travel);
  const [minLane, maxLane] = [Math.min(...lanes), Math.max(...lanes)];
  const [minTravel, maxTravel] = [Math.min(...travels), Math.max(...travels)];
  const blockRows = rows + Math.ceil((maxTravel - minTravel) / cellLength - 1e-9);
  const rowCount = Math.ceil((window + (blockRows - 1) * cellLength) / rowSpacing);
  const leaves = maxTravel + roadLength + height - minTravel;
  const placements: MoverPlacement[] = [];
  for (let start = -minLane; start + maxLane + across <= laneCount; start++) {
    work?.beforePlacement();
    const first = start + minLane;
    const count = maxLane - minLane + across;
    placements.push({
      appears: maxTravel,
      // Its spots are from its row up the road by its spread of travels, its hit box above each.
      body: {
        from: 0,
        lanes: { count, first },
        to: maxTravel - minTravel + bodyLength(geometry, rows),
      },
      cells: blockCells(0, rowCount, first, count),
      lane: start,
      lanes: { count, first },
      path: pathAt(start),
      rows: blockRows,
      screen: [maxTravel, leaves],
      stands: spots.map((spot) => ({
        distance: maxTravel - spot.travel,
        lane: start + spot.lane,
        lanes: across,
        length: drawnHitLength(geometry, spec),
      })),
    });
  }
  return placements;
}

// A stepping mover takes each step of a sequence as long as its drawn count in turn, each step
// its drawn length. Its first step's cue shows once it is wholly on the road; each later step,
// with no cue unless the motion cues each, starts its pause after the step before ends. Each move
// comes up to its drawn delay later, so later moves pause a random gap between them. A step with
// drift travels drift of its length along the road, and stands at a spot each cell of it. A step
// that would start once the mover has reached the pack's rows, at sightLength, never comes, nor
// any after it; a sequence with no step left has no placement, since a mover always moves. It
// stands at every spot a step of several spots passes over, as it does at each step's ends, and at
// both corners of each diagonal spot: moving a lane across and a row along at once, its hit box is
// in the lane it leaves while it comes level with the row it reaches, and in the lane it reaches
// while still level with the row it leaves.
function stepsPlacements(
  context: PlacementContext,
  motion: Extract<MoverMotion, { kind: "steps" }>,
): MoverPlacement[] {
  const { draws, geometry, spec } = context;
  const { cellLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const length = motion.stepSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const count = drawnStepCount(motion, draws.count);
  const pause = (motion.pauseSeconds ?? 0) * scrollSpeed;
  const gap = motion.cueEach === true ? Math.max(pause, warning) : pause;
  const drift = motion.drift ?? 0;
  if (motion.shy !== undefined && draws.shy < motion.shy.share) {
    return shyPlacements(context, motion.shy, motion.stepSeconds, count);
  }
  const ways = motion.sequences.filter((sequence) => sequence.length === count);
  const prefixes = new Map<string, MoverPlacement[]>();
  return ways.flatMap((shapes) => {
    const spots: StandOffset[] = [{ lane: 0, travel: 0 }];
    const steps: MoverStep[] = [];
    let ready = height + warning;
    for (const [i, shape] of shapes.entries()) {
      const at = ready + (i > 0 ? gap : 0) + delayOf(spec.variation, draws, i) * scrollSpeed;
      const last = spots.at(-1) ?? { lane: 0, travel: 0 };
      if (at + last.travel >= sightLength) {
        break;
      }
      const stepLength = moveLength(spec.variation, draws, i, length);
      const travel = shape.travel * cellLength + drift * stepLength;
      const spotCount = Math.max(stepSpots(shape), Math.ceil(Math.abs(travel) / cellLength - 1e-9));
      for (let spot = 1; spot <= spotCount; spot++) {
        spots.push({
          lane: last.lane + (shape.lanes * spot) / spotCount,
          travel: last.travel + (travel * spot) / spotCount,
        });
      }
      steps.push({
        at,
        lanes: shape.lanes,
        length: stepLength,
        travel,
        ...(steps.length > 0 && motion.cueEach !== true ? { uncued: true } : {}),
      });
      ready = at + stepLength;
    }
    if (steps.length === 0) {
      return [];
    }
    const corners = spots.slice(1).flatMap((spot, i) => {
      const before = spots[i] ?? spot;
      return before.lane !== spot.lane && before.travel !== spot.travel
        ? [
            { lane: before.lane, travel: spot.travel },
            { lane: spot.lane, travel: before.travel },
          ]
        : [];
    });
    // Unexecuted authored tails may share a prefix. Reuse its immutable geometry while
    // preserving the original sequence order and multiplicity for candidate selection.
    const key = JSON.stringify([steps, spots, corners]);
    const existing = prefixes.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const placements = standingPlacements(context, [...spots, ...corners], (lane) => ({
      lane,
      motion: "steps",
      movement: spec.movement,
      steps,
      warning,
    }));
    prefixes.set(key, placements);
    return placements;
  });
}

// The ways a stalker's or shy hopper's lane range may reach from its start lane, widest first: a
// lane to either side, one side only, or none. Of the two one-sided reaches, the side draw, from 0
// up to 1, puts the left first below a half and the right first from a half, so neither side is
// favoured across movers.
function reachesOf(side: number): readonly (readonly [number, number])[] {
  const oneSided: readonly (readonly [number, number])[] = [
    [-1, 0],
    [0, 1],
  ];
  return [[-1, 1], ...(side < 0.5 ? oneSided : [...oneSided].reverse()), [0, 0]];
}

// Choreography ends before pack contact. Reserve its whole continuous body sweep against
// other spawns, but block the guaranteed path only during actual contact with the pack.
function signaturePlacements(
  context: PlacementContext,
  profile: SignatureProfile,
): MoverPlacement[] {
  const { draws, geometry, spec, work } = context;
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength, window } =
    geometry;
  const span = spec.footprint.lanes;
  const height = Math.max(spec.footprint.rows * cellLength, drawnHitLength(geometry, spec));
  const warning = profile.warningSeconds * scrollSpeed;
  const at = warning + delayOf(spec.variation, draws, 0) * scrollSpeed;
  const inset = geometry.laneInset / cellLength;
  const preferred = draws.side < 0.5 ? -1 : 1;
  const directions: readonly (-1 | 1)[] = [preferred, preferred === -1 ? 1 : -1];
  const placements: MoverPlacement[] = [];
  for (const [directionIndex, direction] of directions.entries()) {
    for (let lane = 0; lane + span <= laneCount; lane++) {
      const route = compileSignature(
        geometry,
        profile,
        { count: draws.count, direction },
        { at, lane, span, travel: height },
      );
      if (route === null) {
        continue;
      }
      // Only exit legs may cross a road edge, and those legs are linear in X.
      const onRoad = (cut: number, sweep: SignatureSweep): SignatureSweep[] => {
        const dx = sweep.to.x - sweep.from.x;
        const left = -span + cut;
        const right = laneCount - cut;
        if (dx === 0) {
          return sweep.from.x > left && sweep.from.x < right ? [sweep] : [];
        }
        const fractions = [(left - sweep.from.x) / dx, (right - sweep.from.x) / dx].sort(
          (a, b) => a - b,
        );
        const first = Math.max(0, fractions[0] ?? 0);
        const last = Math.min(1, fractions[1] ?? 1);
        if (first >= last) {
          return [];
        }
        const start = sweep.start + (sweep.end - sweep.start) * first;
        const end = sweep.start + (sweep.end - sweep.start) * last;
        return [
          {
            component: sweep.component,
            end,
            from: signaturePlace(route, start, sweep.component),
            start,
            to: signaturePlace(route, end, sweep.component),
          },
        ];
      };
      const whole = signatureTravelSweeps(route, 0, roadLength + height).flatMap((sweep) =>
        onRoad(0, sweep),
      );
      const contact = signatureTravelSweeps(route, sightLength, sightLength + window).flatMap(
        (sweep) => onRoad(0, sweep),
      );
      if (whole.length === 0) {
        continue;
      }
      work?.beforePlacement();
      const firstContact =
        contact.length === 0
          ? route.complete + Math.max(0, sightLength - signaturePlace(route, route.complete).y)
          : Math.min(...contact.map((sweep) => sweep.start));
      const appears = sightLength - firstContact;
      const sweptSpan = (sweeps: readonly SignatureSweep[], cut = 0): LaneSpan => {
        const points = sweeps.flatMap((sweep) => [sweep.from.x, sweep.to.x]);
        return points.length === 0
          ? { count: 0, first: 0 }
          : laneSpan(laneCount, Math.min(...points), Math.max(...points) + span - 1, cut);
      };
      const levels = whole.flatMap((sweep) => [
        appears + sweep.start - sweep.from.y,
        appears + sweep.end - sweep.to.y,
      ]);
      const cells = whole.flatMap((sweep) => {
        const swept = sweptSpan([sweep]);
        const levels = [appears + sweep.start - sweep.from.y, appears + sweep.end - sweep.to.y];
        const firstRow = Math.floor(Math.min(...levels) / rowSpacing);
        const lastRow = Math.ceil((Math.max(...levels) + height) / rowSpacing);
        return blockCells(firstRow, lastRow - firstRow + 1, swept.first, swept.count);
      });
      const uniqueCells = [
        ...new Map(cells.map((cell) => [`${cell.row}:${cell.lane}`, cell])).values(),
      ];
      const drawnWindow = drawnHitLength(geometry, spec) + geometry.packHitLength;
      const touched = signatureTravelSweeps(route, sightLength, sightLength + drawnWindow).flatMap(
        (sweep) => onRoad(inset, sweep),
      );
      const contactLength =
        contact.length === 0 ? 0 : Math.max(...contact.map((sweep) => sweep.end)) - firstContact;
      placements.push({
        appears,
        body: {
          from: Math.min(...levels),
          lanes: sweptSpan(whole, inset),
          to: Math.max(...levels) + height,
        },
        cells: uniqueCells,
        lane,
        lanes: sweptSpan(contact),
        path: { lane, motion: "signature", movement: spec.movement, route, warning },
        rank: directions.length - directionIndex,
        rows: Math.max(1, rowsCovering(geometry, 1, contactLength / window)),
        screen: [appears, appears + Math.max(...whole.map((sweep) => sweep.end))],
        stands: touched.map((sweep) => {
          const hit = sweptSpan([sweep], inset);
          return {
            distance: appears + sweep.start - sightLength,
            lane: hit.first,
            lanes: hit.count,
            length: sweep.end - sweep.start - geometry.packHitLength,
          };
        }),
      });
    }
  }
  return placements;
}

// A stalker's or shy hopper's placements, one per reach that fits, the first in reachesOf its side
// draw ranked highest: it may stand at every travel given in every lane of its reach. pathAt makes
// its path from its start lane and its reach.
function reachPlacements(
  context: PlacementContext,
  travels: readonly number[],
  pathAt: (lane: number, reach: LaneSpan) => MoverPath,
): MoverPlacement[] {
  const reaches = reachesOf(context.draws.side);
  return reaches.flatMap(([left, right], rank) => {
    const spots = Array.from({ length: right - left + 1 }, (_, i) =>
      travels.map((travel) => ({ lane: left + i, travel })),
    ).flat();
    return standingPlacements(context, spots, (lane) =>
      pathAt(lane, { count: right - left + 1, first: lane + left }),
    ).map((placement) => ({ ...placement, rank: reaches.length - rank }));
  });
}

// A stalker may be at any spot in its lanes, from its start down as many rows as its drawn count
// of steps, and is placed as standing at each of them, so whichever step it chooses on the road
// keeps the road passable. Its lanes are its start lane and, where there is room, a lane to
// either side: the wider, the more it can follow the pack, and the planner takes the widest that
// fits (rank). Its first step's cue comes its drawn delay after it is wholly on the road, and each
// later step, with no cue, once the step before has ended and the road between it and the pack,
// the tallest pack's rows at sightLength, is down to its drawn share of the road's length. Each
// step is its drawn length.
function approachPlacements(
  context: PlacementContext,
  motion: Extract<MoverMotion, { kind: "approach" }>,
): MoverPlacement[] {
  const { draws, geometry, spec } = context;
  const { cellLength, roadLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const steps = drawnCount(motion.steps, draws.count);
  const pending: ApproachTiming[] = [
    {
      at:
        height + (rangeAt(motion.firstDelaySeconds, draws.delays[0] ?? 0) * scrollSpeed + warning),
      kind: "after",
    },
    ...Array.from({ length: steps - 1 }, (): ApproachTiming => ({
      kind: "near",
      travel: sightLength - rangeAt(motion.secondRoadShare, draws.share) * roadLength,
    })),
  ];
  const travels = Array.from({ length: steps + 1 }, (_, row) => row * cellLength);
  const lengths = Array.from({ length: steps }, (_, i) =>
    moveLength(spec.variation, draws, i, motion.stepSeconds * scrollSpeed),
  );
  return reachPlacements(context, travels, (lane, reach) => ({
    burst: cellLength,
    lane,
    lengths,
    motion: "approach",
    movement: spec.movement,
    pending,
    reach,
    rows: steps,
    steps: [],
    stopTravel: sightLength,
    warning,
  }));
}

// A shy hopper may be at any spot in its lanes, from its start up as many rows as its rise, and is
// placed as standing at each of them, so whichever hop it chooses on the road keeps the road
// passable. Its lanes are its start lane and, where there is room, a lane to either side, the
// widest that fits (rank). Its first hop's cue begins as its row comes within nearSeconds of the
// road's travel of the tallest pack's rows at sightLength, but no sooner than it is wholly on the
// road, and each later hop, with no cue, starts as the hop before ends, up to its drawn delay
// later; it makes as many hops as its drawn count, each its drawn length.
function shyPlacements(
  context: PlacementContext,
  shy: ShyHops,
  hopSeconds: number,
  count: number,
): MoverPlacement[] {
  const { draws, geometry, spec } = context;
  const { cellLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const first = Math.max(height, sightLength - shy.nearSeconds * scrollSpeed) + warning;
  const lengths = Array.from({ length: count }, (_, i) =>
    moveLength(spec.variation, draws, i, hopSeconds * scrollSpeed),
  );
  const pending: number[] = [];
  for (let i = 0; i < count; i++) {
    const before = pending.at(-1);
    pending.push(
      before === undefined
        ? first
        : before + (lengths[i - 1] ?? 0) + delayOf(spec.variation, draws, i) * scrollSpeed,
    );
  }
  const travels = Array.from({ length: shy.rise + 1 }, (_, row) => -row * cellLength);
  return reachPlacements(context, travels, (lane, reach) => ({
    burst: cellLength,
    lane,
    lengths,
    motion: "shy",
    movement: spec.movement,
    pending,
    reach,
    rise: shy.rise,
    shapes: shy.shapes,
    steps: [],
    stopTravel: sightLength,
    warning,
  }));
}

// One mover's placements, at its draws. A dart's start is lifted that share of the way from its
// drawn share up to the highest that shows its cue; other movers have no lift.
export function moverPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  draws: MoverDraws = EVEN_DRAWS,
  lift = 0,
): MoverPlacement[] {
  return moverPlacementsWithWork(undefined, geometry, spec, draws, lift);
}

export function moverPlacementsWithWork(
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  draws: MoverDraws = EVEN_DRAWS,
  lift = 0,
): MoverPlacement[] {
  const context: PlacementContext = { draws, geometry, spec, work };
  const { motion } = spec;
  switch (motion.kind) {
    case "signature":
      return signaturePlacements(context, motion.profile);
    case "approach":
      return approachPlacements(context, motion);
    case "cross":
      return crossPlacements(context, motion, lift);
    case "ride":
      return ridePlacements(context, motion);
    default:
      return stepsPlacements(context, motion);
  }
}
