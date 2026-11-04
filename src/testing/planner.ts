// The walk tests' view of the spawn planner on the game's road: the real data, the game's
// road and pack, and each lane-blocking spawn's spans and contact with the pack.
import { itemAt } from "@andornaut/game-kit/arrays";
import { keysOf } from "@andornaut/game-kit/records";

import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import { TUNING } from "../data/tuning";
import type { WalkerId, World, Zone, ZoneId } from "../data/types";
import { DEFAULT_WALKER, WALKERS } from "../data/walkers";
import { WORLD } from "../data/world";
import { type PackSprites, PART_INSET } from "../layout/packFormation";
import { read } from "../rules/units";
import { slowestDebuffedAgility, slowestPackAgility } from "../rules/walkers";
import { drawnLanes, hasLeftRoad, type MoverPath, moverPlace } from "../runner/movers";
import { moverOutcomes } from "../runner/outcomes";
import { signaturePlace } from "../runner/signaturePaths";
import {
  componentHitLength,
  itemHeight,
  laneMoveSeconds,
  plannedCellInset,
  type RoadGeometry,
  type Walk,
  walkScrollSpeed,
  zoneLength,
} from "../runner/walk";
import { walkGeometry, walkProjection } from "../runner/walkGeometry";
import { blocksLane, footprintOf, type WalkItem } from "../runner/walkItems";
import { newRun, type RunState } from "../state/runState";
import { type BlockingSpan } from "./avoidable";
import { data } from "./walk";
import { mapZones } from "./world";

// The real world, as the integrity tests read it.
export const REAL = { ...data, tuning: TUNING, world: WORLD };
export type Real = Omit<typeof REAL, "world"> & { world: World };
export const ZONE_IDS = WORLD.zones.map(({ id }) => id);
// The game's road, as RunScene lays it out for realRun's pack.
export const GAME_ROAD = (() => {
  const road = SCREEN_LAYOUT.road;
  const pack: PackSprites = { dogs: ["ginger", "lady", "kilo"], walker: DEFAULT_WALKER };
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
export const ROAD_LENGTH = GAME_ROAD.roadBottom - GAME_ROAD.roadTop;
// A pack half again as tall as the game's three, as a taller pack box would make it.
export const TALLER = Math.round(GAME_ROAD.tallestPackBand / 2);
export const TALL_PACK_ROAD: RoadGeometry = {
  ...GAME_ROAD,
  packBand: { ...GAME_ROAD.packBand, top: GAME_ROAD.packBand.top - TALLER },
  sightLength: GAME_ROAD.sightLength - TALLER,
  tallestPackBand: GAME_ROAD.tallestPackBand + TALLER,
};
// The data with spawn rows spaced wider by this much.
export const widerRows = (tuned: Real, wider: number): Real => ({
  ...tuned,
  tuning: {
    ...tuned.tuning,
    pixels: {
      ...tuned.tuning.pixels,
      spawnRowSpacing: tuned.tuning.pixels.spawnRowSpacing + wider,
    },
  },
});
export const realRun = (tuned: Real, walker: WalkerId = DEFAULT_WALKER) =>
  newRun(tuned, 3, { dogs: ["ginger", "lady", "kilo"], gear: null, walker });
// The world with every zone's weights changed by reweigh.
export function reweighed(reweigh: (weights: Zone["weights"]) => Zone["weights"]): World {
  return mapZones((zone) => ({ ...zone, weights: reweigh(zone.weights) }), WORLD);
}
// The weights with each of ids weighed one higher.
export function raised<Id extends string>(
  weights: Readonly<Record<Id, number>>,
  ids: readonly Id[],
): Record<Id, number> {
  const entries = keysOf(weights).map((id) => [
    id,
    ids.includes(id) ? weights[id] + 1 : weights[id],
  ]);
  return Object.fromEntries(entries) as Record<Id, number>;
}
export const OBSTACLE_IDS = keysOf(WORLD.zones[0].weights.obstacles);
export const MINOR_OBSTACLE_IDS = keysOf(MINOR_OBSTACLES);
export const LUCKY_IDS = keysOf(TUNING.counts.luckyFindsPerZone);
// The run in zone, walked at position zoneIndex.
export const inZone = (run: RunState, zone: ZoneId, zoneIndex: number): RunState => ({
  ...run,
  route: Array.from({ length: zoneIndex + 1 }, () => zone),
  zoneIndex,
});
// The slowest pack's lane move, which sets the row spacing.
export const slowestLaneMove = read(TUNING, "seconds", "laneMove") / slowestPackAgility(REAL);
// The slowest pack's lane move while Muddy, which spaces the held path's lane changes.
export const muddyLaneMove = read(TUNING, "seconds", "laneMove") / slowestDebuffedAgility(REAL);
// The walkway from the zone's start, as blockingSpans measures it, for the slowest pack while
// Muddy: its whole scroll, until the zone's last row has passed the pack.
export const walkwayOf = (tuned: Real, road: RoadGeometry, run: RunState) => ({
  laneCount: LANE_COUNT,
  laneMoveSeconds: muddyLaneMove,
  scrollSpeed: walkScrollSpeed(tuned, run),
  zoneLength: zoneLength(tuned) + road.sightLength,
});
// The walker whose pace scrolls the road fastest.
export const FASTEST_WALKER = keysOf(WALKERS).reduce((fastest, walker) => {
  const speed = (id: WalkerId) => walkScrollSpeed(REAL, realRun(REAL, id));
  return speed(walker) > speed(fastest) ? walker : fastest;
});
// The walkers whose lane move covers the least and the most road: a lane move takes the same
// time whoever walks, over road that a walker's pace scrolls faster or slower.
export const LANE_MOVE_WALKERS = (() => {
  const road = (walker: WalkerId) => {
    const run = realRun(REAL, walker);
    return laneMoveSeconds(REAL, run) * walkScrollSpeed(REAL, run);
  };
  const walkers = keysOf(WALKERS).sort((a, b) => road(a) - road(b));
  return [itemAt(walkers, 0), itemAt(walkers, walkers.length - 1)];
})();
// The greatest common divisor: the row spacing, of distances on rows, some of them negative.
export const gcdOf = (values: readonly number[]): number =>
  values.reduce((a, b) => {
    let [x, y] = [Math.abs(a), Math.abs(b)];
    while (y !== 0) {
      [x, y] = [y, x % y];
    }
    return x;
  }, 0);
// The length the planner gives a spawn's hit box: its rows less the planned inset at each end,
// which covers its drawn hit box (itemHeight) whatever obstacle it is.
const plannedHeight = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  kind: WalkItem["kind"],
): number =>
  blocksLane(tuned, kind)
    ? footprintOf(tuned, kind).rows * road.cell.length - 2 * plannedCellInset(tuned, road)
    : itemHeight(tuned, road, kind, false);
// The length of the tallest pack's hit boxes, inside its outline by PART_INSET at each end, which
// the pack-fit gap keeps clear.
export const packHitLength = (road: RoadGeometry): number => road.tallestPackBand - 2 * PART_INSET;
// How the pack-fit check measures a spawn: planned, at the planner's hit length for its
// footprint and the tallest pack's outline; or drawn, at its kind's drawn hit length and the
// tallest pack's hit boxes.
type Sizing = "drawn" | "planned";
// A spawn's hit length and the pack's length, as sizing measures them.
const sized = (
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  kind: WalkItem["kind"],
  moving: boolean,
): { height: number; pack: number } =>
  sizing === "planned"
    ? { height: plannedHeight(tuned, road, zone, kind), pack: road.tallestPackBand }
    : { height: itemHeight(tuned, road, kind, moving), pack: packHitLength(road) };
// A standing spawn's span on the game's road.
export const standingSpan = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  { distance, kind, lane }: { distance: number; kind: WalkItem["kind"]; lane: number },
): BlockingSpan => ({
  distance,
  lane,
  laneSpan: footprintOf(tuned, kind).lanes,
  length: plannedHeight(tuned, road, zone, kind) + road.tallestPackBand,
});
export type MoverEvent = { distance: number; kind: WalkItem["kind"]; mover: MoverPath };
// The scroll since its cue over which moverSpans and moverContact look for a mover's contact.
export const MOVER_SCROLL = Math.ceil(4 * ROAD_LENGTH);
// Runtime phase boundaries split each body's motion into monotone pieces.
function motionCuts(path: MoverPath): number[] {
  const cuts = [0, path.warning];
  if (path.motion === "signature") {
    return [
      ...cuts,
      path.route.entryEnd,
      path.route.complete,
      ...path.route.componentDelays.flatMap((delay) =>
        path.route.legs.flatMap((leg) => [leg.at + delay, leg.at + leg.length + delay]),
      ),
    ];
  }
  if (path.motion === "ride") {
    return path.merge === undefined
      ? cuts
      : [...cuts, path.merge.at, path.merge.at + path.merge.length];
  }
  if (path.motion !== "cross") {
    return [...cuts, ...path.steps.flatMap((step) => [step.at, step.at + step.length])];
  }
  const pause = path.pause;
  if (pause !== undefined) {
    const start = path.warning + pause.after / path.lanesPerPixel;
    cuts.push(start, start + pause.length);
  }
  const after = (lanes: number) =>
    path.warning +
    lanes / path.lanesPerPixel +
    (pause !== undefined && lanes > pause.after ? pause.length : 0);
  if (path.turnAfter !== null) {
    cuts.push(after(path.turnAfter));
  }
  if (path.stopAfter !== null) {
    const landing = path.slide === undefined ? path.stopAfter : Math.max(0, path.stopAfter - 1);
    cuts.push(
      after(landing),
      path.warning +
        (landing + (path.stopAfter - landing) / (path.slide ?? 1)) / path.lanesPerPixel,
    );
  }
  return cuts;
}

// Split at physical lane/contact crossings, without using planner reservations as an oracle.
export function moverSpans(
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  event: MoverEvent,
): BlockingSpan[] {
  const inset = road.cell.inset / road.cell.length;
  return moverOutcomes(event.mover).flatMap((path) => {
    const trail = path.motion === "signature" && path.route.profile.kind === "delayedTrail";
    const nativeHeight =
      trail && path.motion === "signature" && path.route.profile.kind === "delayedTrail"
        ? componentHitLength(road, path.route.profile)
        : itemHeight(tuned, road, event.kind, true);
    const width = trail ? 1 : drawnLanes(footprintOf(tuned, event.kind).lanes, path);
    const measured = sized(sizing, tuned, road, zone, event.kind, true);
    const contactEnd =
      road.sightLength +
      (trail ? nativeHeight + packHitLength(road) : measured.height + measured.pack);
    const retiredAt = road.sightLength + nativeHeight + packHitLength(road);
    const points = (since: number): ReturnType<typeof moverPlace>[] => {
      const result =
        path.motion === "signature"
          ? path.route.componentDelays.map((_, component) => {
              const point = signaturePlace(path.route, since, component);
              return { lanePosition: point.x, solid: since >= 0, span: width, travel: point.y };
            })
          : [moverPlace(LANE_COUNT, path, since)];
      if (
        result.length === 0 ||
        result.some(
          (point) => !Number.isFinite(point.lanePosition) || !Number.isFinite(point.travel),
        )
      ) {
        throw new Error("Moving contact geometry must have finite body positions");
      }
      return result;
    };
    const retired = (at: ReturnType<typeof points>) =>
      at.every((point) => point.travel >= retiredAt) ||
      at.every(
        (point) =>
          hasLeftRoad(LANE_COUNT, point) ||
          point.travel - nativeHeight >= road.roadBottom - road.roadTop,
      );
    const phases = motionCuts(path);
    if (
      !phases.every(Number.isFinite) ||
      !Number.isFinite(retiredAt) ||
      !Number.isFinite(contactEnd) ||
      !Number.isFinite(width) ||
      width <= 0
    ) {
      throw new Error("Moving contact geometry must have finite phases and positive body width");
    }
    let end = Math.max(MOVER_SCROLL, ...phases);
    while (!retired(points(end))) {
      end *= 2;
      if (!Number.isFinite(end)) {
        throw new Error("Moving contact geometry must eventually retire");
      }
    }
    // Resolve crossings to a billionth of a cell; keep the full numerical bracket occupied.
    const tolerance = road.cell.length * 1e-9;
    const cuts = new Set([0, end, ...phases.filter((at) => at > 0 && at < end)]);
    const phasesOrdered = [...cuts].sort((a, b) => a - b);
    for (let i = 1; i < phasesOrdered.length; i++) {
      const from = phasesOrdered[i - 1]!,
        to = phasesOrdered[i]!;
      const first = points(from),
        last = points(to);
      for (let component = 0; component < first.length; component++) {
        const axes = [
          {
            axis: "travel",
            levels: [
              road.sightLength,
              contactEnd,
              retiredAt,
              road.roadBottom - road.roadTop + nativeHeight,
            ],
          },
          {
            axis: "lanePosition",
            levels: [
              -width,
              LANE_COUNT,
              ...Array.from({ length: LANE_COUNT }, (_, lane) => [
                lane + 1 - inset,
                lane - width + inset,
              ]).flat(),
            ],
          },
        ] as const;
        for (const { axis, levels } of axes) {
          const a = first[component]![axis],
            b = last[component]![axis];
          for (const level of levels) {
            if (!(level > Math.min(a, b) && level < Math.max(a, b))) {
              continue;
            }
            let low = from,
              high = to;
            for (let iteration = 0; iteration < 48; iteration++) {
              const middle = (low + high) / 2;
              if (points(middle)[component]![axis] < level === a < b) {
                low = middle;
              } else {
                high = middle;
              }
            }
            if (high - low > tolerance) {
              throw new Error("Moving contact crossing could not be resolved conservatively");
            }
            // Keep both sides of the numerical bracket, preserving conservative coverage.
            cuts.add(low);
            cuts.add(high);
          }
        }
      }
    }
    const ordered = [...cuts].sort((a, b) => a - b);
    const spans: BlockingSpan[] = [];
    for (let i = 1; i < ordered.length; i++) {
      const from = ordered[i - 1]!,
        to = ordered[i]!;
      const samples =
        to - from <= tolerance
          ? [points(from), points((from + to) / 2), points(to)]
          : [points((from + to) / 2)];
      if (samples.every(retired)) {
        break;
      }
      const lanes = new Set<number>();
      for (const point of samples.filter((sample) => !retired(sample)).flat()) {
        if (
          !point.solid ||
          hasLeftRoad(LANE_COUNT, point) ||
          point.travel < road.sightLength ||
          point.travel >= contactEnd
        ) {
          continue;
        }
        for (let lane = 0; lane < LANE_COUNT; lane++) {
          if (point.lanePosition + inset < lane + 1 && point.lanePosition + width - inset > lane) {
            lanes.add(lane);
          }
        }
      }
      for (const lane of lanes) {
        spans.push({
          distance: event.distance + from - road.sightLength,
          lane,
          laneSpan: 1,
          length: to - from,
        });
      }
    }
    return spans;
  });
}

// The envelope of already measured contacts, including every branch and component.
export function contactOfSpans(spans: readonly BlockingSpan[]): { end: number; start: number } {
  return {
    end: Math.max(...spans.map((span) => span.distance + span.length)),
    start: Math.min(...spans.map((span) => span.distance)),
  };
}

// The complete continuous contact interval, including every possible branch and component.
export function moverContact(
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  event: MoverEvent,
): { end: number; start: number } {
  return contactOfSpans(moverSpans(sizing, tuned, road, zone, event));
}
// Standing spawns retain their conservative row envelope; movers use native authored contact.
// Each is placed by the scroll from the zone's start, so a row
// on the road in view as the zone starts, at a negative distance, is walked from the start.
export const blockingSpans = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  pending: Walk["road"]["pending"],
): BlockingSpan[] =>
  pending
    .filter((event) => blocksLane(tuned, event.kind))
    .flatMap((event) =>
      event.mover === undefined
        ? [standingSpan(tuned, road, zone, event)]
        : moverSpans("drawn", tuned, road, zone, { ...event, mover: event.mover }),
    )
    .map((span) => ({ ...span, distance: span.distance + road.sightLength }));
