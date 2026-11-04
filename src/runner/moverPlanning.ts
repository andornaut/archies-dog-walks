import { itemAt } from "@andornaut/game-kit/arrays";

import type { SignatureProfile, StopLanes } from "../data/types.ts";
import { type LaneDirection, laneMask } from "../layout/lanes.ts";
import {
  delayOf,
  drawnCount,
  drawnStepCount,
  EVEN_DRAWS,
  moveLength,
  rangeAt,
  speedFactor,
} from "./moverDraws.ts";
import { stepSpots } from "./moverHops.ts";
import type {
  BlockCell,
  MoverBody,
  MoverDraws,
  MoverGeometry,
  MoverMotion,
  MoverPlacement,
  MoverPlacementWork,
  MoverSpawn,
  MoverSpec,
  MoverStand,
  ShyHops,
} from "./moverModel.ts";
import {
  type ApproachTiming,
  crossingScroll,
  crossLength,
  crossScrollTo,
  crossSpan,
  type LaneSpan,
  type MoverPath,
  moverPlace,
  type MoverStep,
} from "./movers.ts";
import {
  compileSignature,
  signaturePlace,
  type SignatureSweep,
  signatureTravelSweeps,
} from "./signaturePaths.ts";
import type { SpawnRejection } from "./spawnAdmission.ts";
import type { FeasibilityObserver } from "./spawnFeasibilityDiagnostics.ts";

// The planned hit length of a mover rows long: the window less the pack's length, which is a
// one-row hit box, and a cell for each row after the first.
function bodyLength(geometry: MoverGeometry, rows: number): number {
  return geometry.window - geometry.packLength + (rows - 1) * geometry.cellLength;
}

// A mover's hit length for its stands: its kind's drawn one, or the planned hit length of its
// footprint (bodyLength).
function drawnHitLength(geometry: MoverGeometry, spec: MoverSpec): number {
  return spec.hitLength ?? bodyLength(geometry, spec.footprint.rows);
}

// Every cell of rowCount rows from firstRow by laneCount lanes from firstLane, row by row.
function blockCells(
  firstRow: number,
  rowCount: number,
  firstLane: number,
  laneCount: number,
): BlockCell[] {
  return Array.from({ length: rowCount }, (_, i) =>
    Array.from({ length: laneCount }, (_unused, j) => ({ lane: firstLane + j, row: firstRow + i })),
  ).flat();
}

export function isDartPlacement(placement: Pick<MoverPlacement, "path">): boolean {
  return placement.path.motion === "cross";
}

// The lanes on the road a box overlaps anywhere from lane position low to high: as collision cuts
// a mover's box to its lanes, it spans half a lane either side of its position, less inset lanes
// at each side. A box wholly off the road overlaps none: no lanes from lane 0.
function laneSpan(laneCount: number, low: number, high: number, inset: number): LaneSpan {
  const first = Math.max(0, Math.floor(low - 1 + inset + 1e-9) + 1);
  const last = Math.min(laneCount - 1, Math.ceil(high + 1 - inset - 1e-9) - 1);
  return last < first ? { count: 0, first: 0 } : { count: last - first + 1, first };
}

// The lanes a crosser touches while its travel is from to to: its travel only moves one way and its
// lane position one way to its turn and the other way after, or to its stop and then not at all,
// so its ends and its turn bound it. Its box is inset lanes inside a lane at each side, none
// unless given, so a box between lanes touches both. A rider or stepping mover's are its own.
export function sweptLanes(
  laneCount: number,
  path: MoverPath,
  from: number,
  to: number,
  inset = 0,
): LaneSpan {
  if (path.motion === "signature") {
    const points = signatureTravelSweeps(path.route, from, to).flatMap((sweep) => [
      sweep.from.x,
      sweep.to.x,
    ]);
    return points.length === 0
      ? { count: 0, first: 0 }
      : laneSpan(laneCount, Math.min(...points), Math.max(...points), inset);
  }
  if (path.motion === "ride") {
    const merged = path.lane + (path.merge?.lanes ?? 0);
    return {
      count: path.lanes + Math.abs(merged - path.lane),
      first: Math.min(path.lane, merged),
    };
  }
  if (path.motion === "steps" || path.motion === "approach" || path.motion === "shy") {
    return { count: 1, first: path.lane };
  }
  const moving = Math.max(from, path.enterTravel);
  if (moving >= to) {
    return { count: 0, first: 0 };
  }
  // The lane position once the crosser's travel has reached travel.
  const at = (travel: number) =>
    moverPlace(laneCount, path, path.warning + crossScrollTo(path, travel)).lanePosition;
  const turn =
    path.turnAfter === null
      ? null
      : path.enterTravel + ((1 + path.tilt) * path.turnAfter) / path.lanesPerPixel;
  const places = [moving, to, ...(turn !== null && turn > moving && turn < to ? [turn] : [])].map(
    at,
  );
  const low = Math.min(...places);
  return laneSpan(laneCount, low, Math.max(...places) + crossSpan(path) - 1, inset);
}

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

// The fewest rows whose blocking length covers rows' blocking length stretched by stretch.
function rowsCovering(geometry: MoverGeometry, rows: number, stretch: number): number {
  const { cellLength, window } = geometry;
  const needed = (window + (rows - 1) * cellLength) * stretch;
  return Math.max(rows, 1 + Math.ceil((needed - window) / cellLength - 1e-9));
}

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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "cross" }>,
  draws: MoverDraws,
  lift: number,
): MoverPlacement[] {
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
    return crossPlacementsAt(work, geometry, spec, motion, draws, lift, {
      ...shared,
      after: null,
      directions: [1, -1],
    });
  }
  return motion.pause.stops.flatMap((stop) =>
    ([1, -1] as const).flatMap((direction) =>
      crossPlacementsAt(work, geometry, spec, motion, draws, lift, {
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "cross" }>,
  draws: MoverDraws,
  lift: number,
  shape: CrossShape,
): MoverPlacement[] {
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "ride" }>,
  draws: MoverDraws,
): MoverPlacement[] {
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  spots: readonly StandOffset[],
  pathAt: (start: number) => MoverPath,
): MoverPlacement[] {
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "steps" }>,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const length = motion.stepSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const count = drawnStepCount(motion, draws.count);
  const pause = (motion.pauseSeconds ?? 0) * scrollSpeed;
  const gap = motion.cueEach === true ? Math.max(pause, warning) : pause;
  const drift = motion.drift ?? 0;
  if (motion.shy !== undefined && draws.shy < motion.shy.share) {
    return shyPlacements(work, geometry, spec, motion.shy, motion.stepSeconds, count, draws);
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
    const placements = standingPlacements(work, geometry, spec, [...spots, ...corners], (lane) => ({
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  profile: SignatureProfile,
  draws: MoverDraws,
): MoverPlacement[] {
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  side: number,
  travels: readonly number[],
  pathAt: (lane: number, reach: LaneSpan) => MoverPath,
): MoverPlacement[] {
  const reaches = reachesOf(side);
  return reaches.flatMap(([left, right], rank) => {
    const spots = Array.from({ length: right - left + 1 }, (_, i) =>
      travels.map((travel) => ({ lane: left + i, travel })),
    ).flat();
    return standingPlacements(work, geometry, spec, spots, (lane) =>
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "approach" }>,
  draws: MoverDraws,
): MoverPlacement[] {
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
  return reachPlacements(work, geometry, spec, draws.side, travels, (lane, reach) => ({
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
  work: MoverPlacementWork | undefined,
  geometry: MoverGeometry,
  spec: MoverSpec,
  shy: ShyHops,
  hopSeconds: number,
  count: number,
  draws: MoverDraws,
): MoverPlacement[] {
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
  return reachPlacements(work, geometry, spec, draws.side, travels, (lane, reach) => ({
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
  const { motion } = spec;
  switch (motion.kind) {
    case "signature":
      return signaturePlacements(work, geometry, spec, motion.profile, draws);
    case "approach":
      return approachPlacements(work, geometry, spec, motion, draws);
    case "cross":
      return crossPlacements(work, geometry, spec, motion, draws, lift);
    case "ride":
      return ridePlacements(work, geometry, spec, motion, draws);
    default:
      return stepsPlacements(work, geometry, spec, motion, draws);
  }
}

// Reservation sharing is symmetric in a completed layout; construction insertion
// order remains governed by its directional grid query.
export function moverReservationsMayShare(
  a: MoverPath["motion"],
  b: MoverPath["motion"],
  aBlocksLane: boolean,
  bBlocksLane: boolean,
): boolean {
  return (
    (a === "cross") !== (b === "cross") ||
    (a === "ride" && b === "ride" && aBlocksLane && bBlocksLane)
  );
}

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

// The spawn planner's grid of rows and lanes. block blocks lanes in a row's window for rows rows,
// as a dart's sweep where dart is set, if every lane-blocking spawn keeps clear of the path, and
// undoes it unless keep is set. leavesRoom is false when taking the cells would leave too few for
// the spawns placed later that are never skipped. packFits is true when the pack fits between each
// stand and every lane-blocking spawn placed so far along the path, and between the stands
// themselves, and stand records the stands for the spawns placed later. isFree is true when a mover
// of a motion may take a cell (moverMayTake in spawning.ts). take holds a cell for a mover, a dart
// if dart is set, so nothing placed later takes it, but a lane-blocking standing spawn where no
// mover's body comes: occupy records a mover's body, at distances along the zone, for those.
// clearOf is true when a mover's body, at distances along the zone, shares no road with a
// lane-blocking standing spawn placed so far, which a dart may set off over. clearOfRiders is true
// when a lane-blocking rider's hit box keeps riderFollowGap from that of each recorded by rode, which a grid of
// movers that block no lane leaves out. heldLanes is the lane mask the path holds on a row, none
// without it.
export interface MoverVisibilityProof {
  readonly block: {
    readonly dart: boolean;
    readonly lanes: LaneSpan;
    readonly row: number;
    readonly rows: number;
  };
  readonly body?: MoverBody;
  readonly cells: readonly BlockCell[];
  readonly screen: readonly [number, number];
  readonly selection: { readonly draws: MoverDraws; readonly lift: number };
  readonly stands: readonly MoverStand[];
}

export interface MoverGrid {
  readonly onFailure?: FeasibilityObserver | undefined;
  block(row: number, lanes: LaneSpan, rows: number, keep: boolean, dart?: boolean): boolean;
  clearOf(body: MoverBody): boolean;
  clearRun(lanes: LaneSpan, row: number): number;
  isFree(motion: MoverPath["motion"], lane: number, row: number): boolean;
  leavesRoom(cells: readonly BlockCell[]): boolean;
  occupy(body: MoverBody): void;
  packFits(stands: readonly MoverStand[]): boolean;
  stand(stands: readonly MoverStand[]): void;
  take(dart: boolean, lane: number, row: number, rider?: boolean): void;
  canShow?(
    spawn: MoverSpawn<string>,
    interval: readonly [number, number],
    cells?: readonly BlockCell[],
  ): boolean;
  showed?(
    spawn: MoverSpawn<string>,
    interval: readonly [number, number],
    proof?: MoverVisibilityProof,
    request?: {
      readonly memberIndex: number;
      readonly quotaIndex: number;
      readonly requestedDraws?: MoverDraws;
    },
  ): void;
  clearOfRiders?(ride: RiderSpan): boolean;
  heldLanes?(row: number): number;
  rode?(ride: RiderSpan): void;
}

// A lane-blocking rider in road and time: the lanes it covers over its whole path as a lane mask,
// the zone's scroll from which its hit box is on the road and moving (from) until it has left the
// road's bottom (to), its speed down the road over the road's, and its planned hit length.
export interface RiderSpan {
  readonly from: number;
  readonly lanes: number;
  readonly length: number;
  readonly speed: number;
  readonly to: number;
}

// The rider span of a rider spawned at distance, at its planned hit length.
export function riderSpanOf(
  geometry: MoverGeometry,
  spec: MoverSpec,
  distance: number,
  placement: MoverPlacement,
): RiderSpan | undefined {
  const { path } = placement;
  if (path.motion !== "ride") {
    return undefined;
  }
  const length = Math.max(
    bodyLength(geometry, spec.footprint.rows),
    drawnHitLength(geometry, spec),
  );
  const from = distance + path.warning;
  return {
    from,
    lanes: ((1 << placement.lanes.count) - 1) << placement.lanes.first,
    length,
    speed: path.speedMultiplier,
    to: from + (geometry.roadLength + length) / path.speedMultiplier,
  };
}

// Whether two riders come within gap of each other: they share a lane and, at some moment both are
// on the road, less than gap of road lies between their hit boxes. Each one's travel grows at its
// speed from when it enters, so the road between them changes linearly over the moments they share.
export function ridersMeet(gap: number, a: RiderSpan, b: RiderSpan): boolean {
  if ((a.lanes & b.lanes) === 0) {
    return false;
  }
  const from = Math.max(a.from, b.from);
  const to = Math.min(a.to, b.to);
  if (from >= to) {
    return false;
  }
  // a's travel less b's: a's hit box ends at its travel and starts its length above it, so b's
  // lies wholly above a's, gap clear, while this is at least a's length and gap, and wholly below
  // while it is at most less b's length and gap.
  const ahead = (scroll: number) => a.speed * (scroll - a.from) - b.speed * (scroll - b.from);
  const [low, high] = [ahead(from), ahead(to)].sort((x, y) => x - y) as [number, number];
  return low < a.length + gap && high > -(b.length + gap);
}

export interface Spot {
  readonly distance: number;
  readonly placement: MoverPlacement;
  readonly row: number;
}

function screenOf(spot: Spot): readonly [number, number] {
  const [start, end] = spot.placement.screen;
  return [spot.distance + start, spot.distance + end];
}

// A spot's body, if it has one, at distances along the zone.
function bodyOf(spot: Spot): MoverBody | undefined {
  const { body } = spot.placement;
  return body === undefined
    ? undefined
    : { from: spot.distance + body.from, lanes: body.lanes, to: spot.distance + body.to };
}

// Whether a placement's stop, if it has one, leaves open the lanes the path holds on its row, held
// as a lane mask.
export function leavesPathOpen(held: number, placement: Pick<MoverPlacement, "stop">): boolean {
  const { stop } = placement;
  return stop === undefined || (laneMask(stop.first, stop.count) & held) === 0;
}

function standsOf(spot: Spot): MoverStand[] {
  return spot.placement.stands.map((stand) => ({
    ...stand,
    distance: spot.distance + stand.distance,
  }));
}

// Commits an already selected compiled candidate without changing its motion.
export function keepMoverSpot(
  geometry: MoverGeometry,
  spec: MoverSpec,
  grid: MoverGrid,
  onScreen: OnScreen[],
  spot: Spot,
): void {
  const { placement } = spot;
  const dart = isDartPlacement(placement);
  const rider = placement.path.motion === "ride";
  placement.cells.forEach(({ lane, row }) => grid.take(dart, lane, spot.row + row, rider));
  const ride = riderSpanOf(geometry, spec, spot.distance + placement.appears, placement);
  if (ride !== undefined) {
    grid.rode?.(ride);
  }
  const body = bodyOf(spot);
  if (body !== undefined) {
    grid.occupy(body);
  }
  grid.block(spot.row, placement.lanes, placement.rows, true, dart);
  grid.stand(standsOf(spot));
  onScreen.push(onScreenOf(placement.path, screenOf(spot)));
}

export function moverWithinZone(geometry: { readonly zoneLength: number }, spot: Spot): boolean {
  const [start, end] = screenOf(spot);
  return start >= 0 && end <= geometry.zoneLength;
}

export function fitsMoverSpot(
  geometry: MoverGeometry & { readonly zoneLength: number },
  caps: MoverCaps,
  grid: MoverGrid,
  onScreen: readonly OnScreen[],
  spec: MoverSpec,
  kind: string | undefined,
  reject: (reason: SpawnRejection) => false,
  spot: Spot,
): boolean {
  const [start, end] = screenOf(spot);
  const { placement } = spot;
  const { cells } = placement;
  const body = bodyOf(spot);
  const rider = riderSpanOf(geometry, spec, spot.distance + placement.appears, placement);
  if (!moverWithinZone(geometry, spot)) {
    return reject("outside-zone");
  }
  if (
    kind !== undefined &&
    !(
      grid.canShow?.(
        {
          distance: spot.distance + placement.appears,
          kind,
          lane: placement.lane,
          mover: placement.path,
        },
        [start, end],
        cells.map(({ lane, row }) => ({ lane, row: spot.row + row })),
      ) ?? true
    )
  ) {
    return false;
  }
  if (!screenHasRoom(caps, onScreen, onScreenOf(placement.path, [start, end]), grid.onFailure)) {
    return reject("screen-cap");
  }
  if (!cells.every(({ lane, row }) => grid.isFree(placement.path.motion, lane, spot.row + row))) {
    return reject("cells");
  }
  if (!(rider === undefined || (grid.clearOfRiders?.(rider) ?? true))) {
    return reject("rider-gap");
  }
  if (body !== undefined && !grid.clearOf(body)) {
    return reject("body");
  }
  if (!grid.leavesRoom(cells.map(({ lane, row }) => ({ lane, row: spot.row + row })))) {
    return reject("reservation");
  }
  if (!grid.packFits(standsOf(spot))) {
    return reject("pack-gap");
  }
  return (
    grid.block(spot.row, placement.lanes, placement.rows, false, isDartPlacement(placement)) ||
    reject("open-lanes")
  );
}
