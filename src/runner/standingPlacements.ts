import { delayOf, drawnCount, drawnStepCount, moveLength, rangeAt } from "./moverDraws.ts";
import { blockCells, bodyLength, drawnHitLength } from "./moverExtents.ts";
import { stepSpots } from "./moverHops.ts";
import type { MoverMotion, MoverPlacement, PlacementContext, ShyHops } from "./moverModel.ts";
import type { ApproachTiming, LaneSpan, MoverPath, MoverStep } from "./movers.ts";

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
export function stepsPlacements(
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
export function approachPlacements(
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
