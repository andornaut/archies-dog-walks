import type { Random } from "@andornaut/game-kit/random";

import type { MoveCount, MovementKind, SignatureProfile, StopLanes } from "../data/types.ts";
import type { LaneSpan, MoverPath, StepShape } from "./movers.ts";

export interface MoverPlacementWork {
  // Admission happens before a unique placement is built; shared prefixes reuse existing values.
  beforePlacement(): void;
}

// Planning works in road distance. sightLength is how far a row travels down the road before
// its window, the stretch of road over which a one-row spawn on it overlaps the pack, which is
// window long. rowSpacing is the distance between rows, and cellLength a row of a footprint and a
// lane's width. laneInset is how far inside its lane a mover's hit box is at each side.
// packHitLength is the length of the pack's hit boxes, by which a mover's stands are measured.
export interface MoverGeometry {
  readonly cellLength: number;
  readonly laneCount: number;
  readonly laneInset: number;
  readonly packHitLength: number;
  readonly packLength: number;
  readonly roadLength: number;
  readonly rowSpacing: number;
  readonly scrollSpeed: number;
  readonly sightLength: number;
  readonly window: number;
}

// Where a mover stands as an obstacle, for the pack-fit gap: the distance at which its hit box
// meets the pack, its leftmost lane, the lanes it covers, and its contact with the pack less the
// pack's length: the road behind it the pack cannot step into while it passes.
export interface MoverStand {
  readonly distance: number;
  readonly lane: number;
  readonly lanes: number;
  readonly length: number;
}

// A cell a mover keeps clear: a row offset from its own row, and a lane.
export interface BlockCell {
  readonly lane: number;
  readonly row: number;
}

// The road a mover's hit box covers, in its lanes, from its near end's nearest distance to its
// far end's farthest. Each distance is where the near edge of a standing spawn's hit box would
// be level with it, so a standing spawn whose hit box runs from its own distance up the road for
// its hit length shares no road with the mover when the two spans do not overlap.
export interface MoverBody {
  readonly from: number;
  readonly lanes: LaneSpan;
  readonly to: number;
}

// One way a mover can meet a row. Distances are relative to the row's distance; appears is
// its spawn. lanes and rows are what it blocks from its row on, as a standing obstacle that
// size would: every lane it touches while it overlaps the pack, for as long as it can. cells
// are the row offsets and lanes kept clear of other spawns, but a lane-blocking standing spawn
// clear of its body: those it passes through on the road. stands are each place it stands as an
// obstacle, by distance from its row. screen is from its cue appearing until it is out of sight.
// body is the road its hit box covers at any moment while it is on the road, by distance from its
// row; a dart has none, as a standing spawn may stand where a dart passes, but a stop-and-go
// across, a vehicle crossing side-on, has one. Of the placements that fit in a start lane and row,
// the planner takes one of the highest rank, 0 when unset. stop is the lanes a stop-and-go across
// covers while it stands in its pause (crossPlacements).
export interface MoverPlacement {
  readonly appears: number;
  readonly body?: MoverBody;
  readonly cells: readonly BlockCell[];
  readonly lane: number;
  readonly lanes: LaneSpan;
  readonly path: MoverPath;
  readonly rank?: number;
  readonly rows: number;
  readonly screen: readonly [number, number];
  readonly selection?: { readonly draws: MoverDraws; readonly lift: number };
  readonly stands: readonly MoverStand[];
  readonly stop?: LaneSpan;
}

// The footprint a mover keeps: lanes across and rows along the road.
export interface MoverFootprint {
  readonly lanes: number;
  readonly rows: number;
}

// How a shy hopper hops, at a share of the movers of its kind drawn per mover: as the road between
// it and the pack's rows comes down to nearSeconds of the road's travel, each of its hops one of
// shapes chosen away from the pack (shy.ts), ending at most rise rows up the road.
export interface ShyHops {
  readonly nearSeconds: number;
  readonly rise: number;
  readonly shapes: readonly StepShape[];
  readonly share: number;
}

// cross: across the road at lanesPerSecond, tilted down the road by a tilt of the road's speed
// drawn per mover from tilt, setting off a share of the road ahead of the pack drawn per mover
// from startRoadShare, never so low that the pack has less than reactionSeconds after its cue to
// meet it at its drawn tilt, raised past startRoadShare where a steep tilt needs. At turnBackShare
// of them, drawn per mover, it turns back once it has crossed a share of the road drawn per mover
// from turnAtShare, and crosses the whole road back. At stopShare of them, drawn with the same
// draw (dartOutcome), it stops: at vergeShare of those on the far verge, DART_VERGE_LANES past the
// road's far edge, out of play, and at the rest in the lane stopLanes lanes from the edge it
// enters from, drawn per mover, standing there. With slide (a dive), it crosses its last lane
// before that stop at slide of its speed. With pause (a stop-and-go across), it stands for its
// seconds once in one of its stops (stopCrossed), cued again before it sets off once more. With
// herring, its share of them, drawn per mover (isHerring), are red herrings (herringSpawn).
// ride: down its lane at speedMultiplier of the road's speed, above 1 toward the pack, below 1
// away. With merge, once its travel down the road is at of the way to the pack's rows it moves a
// lane to one side over seconds, after a cue. steps: one of the sequences as long as its count,
// drawn per mover from count, each step stepSeconds long however many spots it covers; the
// planner picks whichever keeps the road passable. The count is drawn from the lengths of the
// sequences within count, each as likely. Each step after the first comes pauseSeconds after the
// one before ends, none without it; with cueEach, each step has a cue of its own, and the pause
// is at least the cue. With drift, each step also travels drift of its length down the road, up
// when below 0: a push at a speed. With shy, a share of them hop shy instead, as many times as
// their count. approach: steps steps toward the pack, drawn per mover, each stepSeconds long, the
// first's cue firstDelaySeconds after the mover is wholly on the road and each later one, with no
// cue, once the step before has ended and the road between it and the pack is secondRoadShare of
// the road's length, each range drawn from per mover.
export type MoverMotion =
  | { readonly kind: "signature"; readonly profile: SignatureProfile }
  | {
      readonly firstDelaySeconds: readonly [number, number];
      readonly kind: "approach";
      readonly secondRoadShare: readonly [number, number];
      readonly stepSeconds: number;
      readonly steps: MoveCount;
    }
  | {
      readonly herring?: HerringShare;
      readonly kind: "cross";
      readonly lanesPerSecond: number;
      readonly pause?: { readonly seconds: number; readonly stops: readonly StopLanes[] };
      readonly reactionSeconds: number;
      readonly startRoadShare: readonly [number, number];
      readonly stopLanes: MoveCount;
      readonly slide?: number;
      readonly stopShare: number;
      readonly tilt: readonly [number, number];
      readonly turnAtShare: readonly [number, number];
      readonly turnBackShare: number;
      readonly vergeShare: number;
    }
  | {
      readonly kind: "ride";
      readonly merge?: { readonly at: number; readonly seconds: number };
      readonly speedMultiplier: number;
    }
  | {
      readonly count: MoveCount;
      readonly cueEach?: true;
      readonly drift?: number;
      readonly kind: "steps";
      readonly pauseSeconds?: number;
      readonly sequences: readonly (readonly StepShape[])[];
      readonly shy?: ShyHops;
      readonly stepSeconds: number;
    };

// A red herring crosser's share of its kind, and how far down the road ahead of the pack it is gone
// by, as a share of that road (multipliers.distractionEndRoadShare).
export interface HerringShare {
  readonly endRoadShare: number;
  readonly share: number;
}

// How much movers of a kind differ: each one's speed by up to speedShare of it either way, each
// of its steps or hops up to delaySeconds later than its earliest moment, and each step's or hop's
// length by up to lengthShare of it either way.
export interface MoverVariation {
  readonly delaySeconds: number;
  readonly lengthShare: number;
  readonly speedShare: number;
}

// hitLength is the kind's drawn hit length while it moves, by which its stands are measured;
// without it, the planned hit length of its footprint.
export interface MoverSpec {
  readonly footprint: MoverFootprint;
  readonly hitLength?: number;
  readonly motion: MoverMotion;
  readonly movement: MovementKind;
  readonly variation: MoverVariation;
  readonly warningSeconds: number;
}

// One mover's draws, each from 0 up to 1, made as it is planned: how many times it moves, its
// speed, the delay before each of its moves, the length of each of its moves, a stalker's
// later-step road share, where a dart sets off, a dart's tilt, whether a hopper of a shy kind hops
// shy (below its kind's share), a dart's outcome (dartOutcome) and whether a crosser is a red
// herring (isHerring), where a dart turns back or stops and which of the stop spots that fit a
// stop-and-go across stands at, and which side a stalker's or shy hopper's one-sided reach favours
// (below a half, the left).
// EVEN_DRAWS moves it at its kind's speed and move length with no delay, at the near end of a
// range, never shy and crossing.
export interface MoverDraws {
  readonly count: number;
  readonly delays: readonly number[];
  readonly lengths: readonly number[];
  readonly share: number;
  readonly shy: number;
  readonly side: number;
  readonly speed: number;
  readonly start: number;
  readonly tilt: number;
  readonly turn: number;
  readonly turnAt: number;
}

// The planner's random streams. spawns places every spawn and draws each mover's speed, first two
// delays and share; movers draws each mover's count, later delays, start, shyness, tilt, outcome,
// where it turns back or stops, reach side and move lengths, and each mover's start lane, so those
// never shift the spawns stream.
export interface PlannerStreams {
  readonly movers: Random;
  readonly spawns: Random;
}

export interface MoverSpawn<Kind extends string> {
  readonly distance: number;
  readonly kind: Kind;
  readonly lane: number;
  readonly mover: MoverPath;
}
