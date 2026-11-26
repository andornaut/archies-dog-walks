import { STEP_SECONDS } from "@andornaut/game-kit/runtime/clock/fixedStep";
import { getOrInsertComputed } from "@andornaut/game-kit/runtime/maps";

import { laneMask, type RoadProjection, screenXAt } from "../layout/index.ts";
import {
  hasLeftRoad,
  laneAt,
  type LanedBox,
  type MoverPath,
  moverPlace,
  moverY,
  obstacleHitBoxes,
  type RoadGeometry,
  type ScaledBox,
  signatureAlive,
  sweptOverlapAt,
  type WalkItem,
} from "../runner/index.ts";
import type { BotRoad } from "./bot.ts";
import type { LaneHazard, LanePrize } from "./lanePlan.ts";

// Hazards, standing or moving, are widened a walk step at each end: a lane change starts on the
// first step at or after it is due, up to a step late, so a planned miss never turns into a hit.
export const MARGIN_SECONDS = STEP_SECONDS;

// How often a mover's path is sampled, in road pixels of scroll.
const MOVER_SAMPLE_SCROLL = 1;
// How far a mover is followed at most: well past any road length.
const MOVER_SCROLL_MAX = 10_000;

// A stretch of walking time, from now, over which something touches the pack in lane.
interface LaneContact {
  readonly from: number;
  readonly lane: number;
  readonly to: number;
}

// A mover's contacts with the pack, by its scroll since its cue appeared: they depend on its
// path, its size and the pack's geometry alone, so each is worked out once.
interface ScrollContact {
  readonly from: number;
  readonly lane: number;
  to: number;
}

type ContactGeometry = Pick<
  RoadGeometry,
  "cell" | "itemHeights" | "laneCount" | "lens" | "packBand" | "packParts" | "roadTop"
>;

const SCROLL_CONTACTS = new WeakMap<
  ContactGeometry,
  WeakMap<object, Map<string, readonly ScrollContact[]>>
>();

// A mover as one sample of its path finds it: its hit box, the top and bottom of its rows on the
// screen, whether it is between lanes, and whether it is solid.
interface MoverSample {
  readonly between: boolean;
  readonly bottom: number;
  readonly box: LanedBox;
  readonly solid: boolean;
  readonly top: number;
}

// Where an edge is at one sample and at the next, moving evenly between them.
type Edge = readonly [number, number];

// Whether, at some moment between two samples, every pair's first edge is before its second, as
// each edge moves evenly from one sample to the next.
function holdTogether(pairs: readonly (readonly [Edge, Edge])[]): boolean {
  return (
    sweptOverlapAt(
      pairs.map(([before, after]) => after[0] - before[0]),
      pairs.map(([before, after]) => after[1] - before[1]),
    ) !== null
  );
}

// Whether a mover moving from one sample to the next touches a part as drawn at some moment
// between them while level with the pack's band: touchesAsDrawn's comparisons and the band's
// all holding at once. A box moving down the road and across it at once, as a tilted dart does,
// can clip a part's corner between two samples, where the walk's collision, at its own walk
// steps, can meet it. With the two samples the same, it is touchesAsDrawn's test.
function touchesBetween(
  lens: Pick<RoadProjection, "centreX">,
  band: RoadGeometry["packBand"],
  part: ScaledBox,
  from: MoverSample,
  to: MoverSample,
): boolean {
  const across = (scale: number, x: number) => screenXAt(lens, scale, x);
  const a = from.box;
  const b = to.box;
  // Clear of the part all the way along: the box between them stays within both samples'.
  if (
    Math.max(a.bottom, b.bottom) <= part.top ||
    Math.min(a.top, b.top) >= part.bottom ||
    Math.max(across(a.scale, a.right), across(b.scale, b.right)) <= across(part.scale, part.left) ||
    Math.min(across(a.scale, a.left), across(b.scale, b.left)) >= across(part.scale, part.right)
  ) {
    return false;
  }
  const edge = (at: (sample: MoverSample) => number): Edge => [at(from), at(to)];
  const still = (value: number): Edge => [value, value];
  // The box's sides, each cut to its lanes as drawn on the part's row.
  const lefts = [
    edge(({ box }) => across(box.scale, box.left)),
    edge(({ box }) => across(part.scale, box.lanes.left)),
  ];
  const rights = [
    edge(({ box }) => across(box.scale, box.right)),
    edge(({ box }) => across(part.scale, box.lanes.right)),
  ];
  const partLeft = still(across(part.scale, part.left));
  const partRight = still(across(part.scale, part.right));
  return holdTogether([
    ...lefts.flatMap((left) => rights.map((right) => [left, right] as const)),
    ...rights.map((right) => [partLeft, right] as const),
    ...lefts.map((left) => [left, partRight] as const),
    [still(part.top), edge(({ box }) => box.bottom)],
    [edge(({ box }) => box.top), still(part.bottom)],
    [still(band.top), edge(({ bottom }) => bottom)],
    [edge(({ top }) => top), still(band.bottom)],
  ]);
}

// Whether a mover moving from one sample to the next touches the pack in lane, as the walk's
// collision has it: one of the pack's hit rectangles touches it as drawn, placed at the lane's
// centre, or, for a box between lanes, anywhere on the road within half a lane of it on the box's
// side of each lane edge. A box as narrow as a cat's can pass between a pack standing in either
// of two lanes and still meet it changing lanes, which the plan counts as in both, so the half
// lane each side of an edge counts for the lane on the box's side of it alone: the lane beyond
// stays clear for a pack that stands there while the box passes.
function touchesPackIn(
  geometry: ContactGeometry,
  lane: number,
  from: MoverSample,
  to: MoverSample,
): boolean {
  const { cell, laneCount } = geometry;
  const x = (lane + 0.5) * cell.length;
  const centre = ({ box }: MoverSample) => (box.lanes.left + box.lanes.right) / 2;
  const widens = (side: (sample: MoverSample) => boolean) =>
    [from, to].some((sample) => sample.between && side(sample)) ? cell.length / 2 : 0;
  const left = widens((sample) => lane > 0 && centre(sample) >= lane * cell.length);
  const right = widens(
    (sample) => lane < laneCount - 1 && centre(sample) < (lane + 1) * cell.length,
  );
  const { dogs, walker } = geometry.packParts;
  return [...dogs, walker].some((part) =>
    touchesBetween(
      geometry.lens,
      geometry.packBand,
      { ...part, left: part.left + x - left, right: part.right + x + right },
      from,
      to,
    ),
  );
}

// The scroll over which a mover on path touches the pack in each lane (sampleContacts), worked
// out once per geometry, path and size.
function scrollContacts(
  road: Pick<BotRoad, "data">,
  geometry: ContactGeometry,
  item: WalkItem,
  path: NonNullable<WalkItem["mover"]>["path"],
): readonly ScrollContact[] {
  const { height, kind, laneSpan } = item;
  const key = `${kind} ${height} ${laneSpan}`;
  const byPath = getOrInsertComputed(geometry, () => new WeakMap(), SCROLL_CONTACTS);
  const bySize = getOrInsertComputed(path, () => new Map(), byPath);
  return getOrInsertComputed(key, () => sampleContacts(road, geometry, item, path), bySize);
}

// The contacts scrollContacts holds for a mover on path, sampled every MOVER_SAMPLE_SCROLL of
// scroll until it leaves the road or passes the pack's band.
function sampleContacts(
  road: Pick<BotRoad, "data">,
  geometry: ContactGeometry,
  item: WalkItem,
  path: NonNullable<WalkItem["mover"]>["path"],
): ScrollContact[] {
  const { laneCount, packBand, roadTop } = geometry;
  const { height } = item;
  const contacts: ScrollContact[] = [];
  // The contact under way in each lane, by lane. Between lanes, a mover's box can touch the
  // pack standing in either lane it straddles.
  const current = new Map<number, ScrollContact>();
  let previous: readonly MoverSample[] = [];
  for (let since = 0; since < MOVER_SCROLL_MAX; since += MOVER_SAMPLE_SCROLL) {
    const place = moverPlace(laneCount, path, since);
    const y = moverY(roadTop, height, place);
    const alive =
      path.motion === "signature"
        ? signatureAlive(
            { laneCount, roadLength: packBand.bottom - roadTop },
            { height, span: item.laneSpan },
            path.route,
            since,
          )
        : !hasLeftRoad(laneCount, place) && y < packBand.bottom;
    if (!alive) {
      break;
    }
    const samples = obstacleHitBoxes(road.data, geometry, {
      ...item,
      mover: { path, since },
      y,
    }).map((box): MoverSample => {
      const lane = box.lanes.left / geometry.cell.length;
      return {
        between: Math.abs(lane - Math.round(lane)) > 1e-9,
        bottom: path.motion === "signature" ? box.bottom : y + height,
        box,
        solid: place.solid,
        top: path.motion === "signature" ? box.top : y,
      };
    });
    // Since the sample before: a contact found here may have started any time after it.
    for (let lane = 0; lane < laneCount; lane++) {
      const touching = samples.some((sample, component) => {
        const from = previous[component] ?? sample;
        const level =
          sample.solid &&
          Math.max(from.bottom, sample.bottom) > packBand.top &&
          Math.min(from.top, sample.top) < packBand.bottom;
        return level && touchesPackIn(geometry, lane, from, sample);
      });
      const under = current.get(lane);
      if (touching && under !== undefined) {
        under.to = since;
      } else if (touching) {
        const contact = { from: since, lane, to: since };
        contacts.push(contact);
        current.set(lane, contact);
      } else {
        current.delete(lane);
      }
    }
    previous = samples;
  }
  return contacts;
}

// The stretches over which a mover, once it moves, touches the pack standing in a lane, on any
// of paths, one per lane and stretch, that start within horizon seconds. Its paths are sampled,
// so each stretch is widened by a sample at each end.
function moverContacts(
  road: BotRoad,
  horizon: number,
  paths: readonly MoverPath[],
  item: WalkItem,
): LaneContact[] {
  const { mover } = item;
  if (mover === undefined) {
    return [];
  }
  const contacts: LaneContact[] = [];
  for (const path of paths) {
    for (const { from, lane, to } of scrollContacts(road, road.geometry, item, path)) {
      const start = (from - MOVER_SAMPLE_SCROLL - mover.since) / road.speed;
      const end = (to + MOVER_SAMPLE_SCROLL - mover.since) / road.speed;
      if (end > 0 && start < horizon) {
        contacts.push({ from: start, lane, to: end });
      }
    }
  }
  return contacts;
}

// The hazards a mover makes on any of paths, one per lane and stretch it touches the pack in, each
// widened a walk step at each end as a standing obstacle's is.
export function moverHazards(
  road: BotRoad,
  horizon: number,
  paths: readonly MoverPath[],
  item: WalkItem,
): LaneHazard[] {
  return moverContacts(road, horizon, paths, item).map(({ from, lane, to }) => ({
    from: from - MARGIN_SECONDS,
    lanes: 1 << lane,
    to: to + MARGIN_SECONDS,
  }));
}

// The prize a moving prize, such as a lucky find that walks about, makes on each of paths: in
// the lanes it covers as it reaches the pack's rows, when that is within horizon seconds, worth
// value shared among its paths. Its paths are sampled.
export function moverPrizes(
  road: BotRoad,
  horizon: number,
  value: number,
  paths: readonly MoverPath[],
  item: WalkItem,
): LanePrize[] {
  const { mover } = item;
  if (mover === undefined) {
    return [];
  }
  const { laneCount, packBand, roadTop } = road.geometry;
  const last = mover.since + horizon * road.speed;
  return paths.flatMap((path) => {
    for (let since = mover.since; since <= last; since += MOVER_SAMPLE_SCROLL) {
      const place = moverPlace(laneCount, path, since);
      const y = moverY(roadTop, item.height, place);
      if (hasLeftRoad(laneCount, place) || y >= packBand.bottom) {
        return [];
      }
      if (place.solid && y + item.height > packBand.top) {
        const lanes = itemLanes({ lane: laneAt(place.lanePosition), laneSpan: item.laneSpan });
        return [{ at: (since - mover.since) / road.speed, lanes, value: value / paths.length }];
      }
    }
    return [];
  });
}

// The lanes an item covers, as a lane mask.
export function itemLanes(item: Pick<WalkItem, "lane" | "laneSpan">): number {
  return laneMask(item.lane, item.laneSpan);
}
