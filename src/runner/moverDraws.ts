import type { MoveCount } from "../data/types.ts";
import type {
  MoverDraws,
  MoverMotion,
  MoverSpec,
  MoverVariation,
  PlannerStreams,
} from "./moverModel.ts";

// How many move delays and lengths each mover draws: as many as the most moves any kind makes.
const MOVE_DRAWS = 6;

export const EVEN_DRAWS: MoverDraws = {
  count: 0,
  delays: Array.from({ length: MOVE_DRAWS }, () => 0),
  lengths: Array.from({ length: MOVE_DRAWS }, () => 0.5),
  share: 0,
  shy: 0.999999,
  side: 0,
  speed: 0.5,
  start: 0,
  tilt: 0,
  turn: 0.999999,
  turnAt: 0,
};

// Every mover draws the same number of times from each stream, whatever it is and wherever it goes.
export function drawMover(streams: PlannerStreams): MoverDraws {
  const { movers, spawns } = streams;
  const delays = [spawns(), spawns()] as const;
  const share = spawns();
  const speed = spawns();
  const count = movers();
  const later = Array.from({ length: MOVE_DRAWS - delays.length }, () => movers());
  const start = movers();
  const shy = movers();
  const tilt = movers();
  const turn = movers();
  const turnAt = movers();
  const side = movers();
  return {
    count,
    delays: [...delays, ...later],
    lengths: Array.from({ length: MOVE_DRAWS }, () => movers()),
    share,
    shy,
    side,
    speed,
    start,
    tilt,
    turn,
    turnAt,
  };
}

// The count a draw from 0 up to 1 picks from a mover's range, each count as likely.
export function drawnCount(range: MoveCount, draw: number): number {
  const spread = range.max - range.min;
  return range.min + Math.min(spread, Math.floor(draw * (spread + 1)));
}

// The factor a mover's speed is multiplied by, from 1 - speedShare to 1 + speedShare.
export function speedFactor(variation: MoverVariation, draws: MoverDraws): number {
  return 1 + variation.speedShare * (2 * draws.speed - 1);
}

export function delayOf(variation: MoverVariation, draws: MoverDraws, index: number): number {
  return variation.delaySeconds * (draws.delays[index] ?? 0);
}

// How long a mover's move at index lasts: length at a factor from 1 - lengthShare to
// 1 + lengthShare, drawn per move.
export function moveLength(
  variation: MoverVariation,
  draws: MoverDraws,
  index: number,
  length: number,
): number {
  return length * (1 + variation.lengthShare * (2 * (draws.lengths[index] ?? 0.5) - 1));
}

// The value a draw from 0 up to 1 picks in a range, from its low end to its high end.
export function rangeAt(range: readonly [number, number], draw: number): number {
  return range[0] + (range[1] - range[0]) * draw;
}

// The step count a draw from 0 up to 1 picks: one of the lengths of the sequences within the
// motion's count, each as likely. Where every count in the range has sequences, as a stepper's and
// a hopper's do, it is drawnCount's.
export function drawnStepCount(
  motion: Pick<Extract<MoverMotion, { kind: "steps" }>, "count" | "sequences">,
  draw: number,
): number {
  const lengths = stepCounts(motion);
  return (
    lengths[Math.min(lengths.length - 1, Math.floor(draw * lengths.length))] ?? motion.count.min
  );
}

// The lengths of a stepping mover's sequences within its motion's count, fewest first.
function stepCounts(
  motion: Pick<Extract<MoverMotion, { kind: "steps" }>, "count" | "sequences">,
): number[] {
  const { max, min } = motion.count;
  return [...new Set(motion.sequences.map((sequence) => sequence.length))]
    .filter((length) => length >= min && length <= max)
    .sort((a, b) => a - b);
}

// How far a dart with no room at its drawn start is raised toward the highest start that shows
// its cue, lowest first, when the planner retries it.
export const DART_LIFTS = [0.25, 0.5, 0.75, 1] as const;

// The even draws from 0 to 1 a mover with no room at its own draws retries its tilt and speed at.
const RETRY_DRAWS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1] as const;

// The draws from 0 up to 1 that pick each of counts counts other than the one own picks, as
// drawnCount and drawnStepCount read a draw: nearest the one own picks first, the fewer first
// between two as near.
function otherCountDraws(counts: number, own: number): number[] {
  const picked = Math.min(counts - 1, Math.floor(own * counts));
  return Array.from({ length: counts }, (_, index) => index)
    .filter((index) => index !== picked)
    .sort((a, b) => Math.abs(a - picked) - Math.abs(b - picked) || a - b)
    .map((index) => (index + 0.5) / counts);
}

// The draws a mover with no room at its own retries at, each its own draws with one changed. A
// dart retries its tilt at each of RETRY_DRAWS, then its speed at each; a rider its speed at each;
// a stepper, hopper or stalker each other count of moves it may draw (drawnStepCount, drawnCount).
// Each is tried nearest its own draw first, the lower first between two as near. A draw its kind
// does not vary by, a tilt with no range, a speed with no jitter or a single count, is not retried.
export function moverRetries(spec: MoverSpec, draws: MoverDraws): MoverDraws[] {
  const { motion, variation } = spec;
  const nearest = (own: number) =>
    RETRY_DRAWS.filter((draw) => Math.abs(draw - own) > 1e-9).sort(
      (a, b) => Math.abs(a - own) - Math.abs(b - own) || a - b,
    );
  const speeds = variation.speedShare > 0 ? nearest(draws.speed) : [];
  switch (motion.kind) {
    case "signature":
      return [];
    case "approach": {
      const counts = motion.steps.max - motion.steps.min + 1;
      return otherCountDraws(counts, draws.count).map((count) => ({ ...draws, count }));
    }
    case "cross": {
      const tilts = motion.tilt[0] < motion.tilt[1] ? nearest(draws.tilt) : [];
      return [
        ...tilts.map((tilt) => ({ ...draws, tilt })),
        ...speeds.map((speed) => ({ ...draws, speed })),
      ];
    }
    case "ride":
      return speeds.map((speed) => ({ ...draws, speed }));
    default: {
      const counts = stepCounts(motion).length;
      return otherCountDraws(counts, draws.count).map((count) => ({ ...draws, count }));
    }
  }
}
