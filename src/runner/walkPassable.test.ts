import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it, vi } from "vitest";

import { LANE_COUNT } from "../data/screen.ts";
import { TUNING } from "../data/tuning.ts";
import type { ZoneId } from "../data/types.ts";
import { WORLD } from "../data/world.ts";
import { read } from "../rules/units.ts";
import { lanesReachedAtEnd, pathShortfalls } from "../testing/avoidable.ts";
import { type HopMovement, hoppingInstead, sharedWorld } from "../testing/movers.ts";
import {
  blockingSpans,
  contactOfSpans,
  FASTEST_WALKER,
  GAME_ROAD,
  inZone,
  MOVER_SCROLL,
  moverSpans,
  muddyLaneMove,
  packHitLength,
  REAL,
  type Real,
  realRun,
  ROAD_LENGTH,
  standingSpan,
  TALL_PACK_ROAD,
  TALLER,
  walkwayOf,
  widerRows,
  ZONE_IDS,
} from "../testing/planner.ts";
import { mapZones } from "../testing/world.ts";
import { planZoneForSeed } from "../testing/zonePlan.ts";
import { assignedMovement } from "./movementAssignments.ts";
import { sweptLanes } from "./moverExtents.ts";
import { crossSpan, hasLeftRoad, type MoverPath, moverPlace } from "./movers.ts";
import { onScreenOf } from "./moverScreen.ts";
import { moverOutcomes } from "./outcomes.ts";
import { signaturePlace } from "./signaturePaths.ts";
import { apportionSlotCounts } from "./slotConfig.ts";
import {
  componentHitLength,
  itemHeight,
  type RoadGeometry,
  startRoad,
  type Walk,
  walkScrollSpeed,
} from "./walk.ts";
import { blocksLane, footprintOf, movementOf, type WalkItemKind } from "./walkItems.ts";

// While set, weightedPick ignores its weights, so every weighted planner draw is even.
const unbiased = vi.hoisted(() => ({ on: false }));
vi.mock("@andornaut/game-kit/random", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@andornaut/game-kit/random")>();
  const weightedPick: typeof actual.weightedPick = (random, items, weights) =>
    actual.weightedPick(random, items, unbiased.on ? weights.map(() => 1) : weights);
  return { ...actual, weightedPick };
});

// The scroll over which a mover is on the game's road: from its cue until it has left the road
// or passed the bottom.
function onScreen(distance: number, mover: MoverPath): readonly [number, number] {
  let since = 0;
  while (since < 10_000) {
    const place = moverPlace(LANE_COUNT, mover, since);
    if (hasLeftRoad(LANE_COUNT, place) || place.travel > ROAD_LENGTH) {
      break;
    }
    since += 1;
  }
  return [distance, distance + since];
}
// No more movers on screen than each cap of the game's allows, of those it counts, at the start
// of any of them, where the counts peak.
function expectCapsOnScreen(movers: readonly { distance: number; mover: MoverPath }[]): void {
  const screens = movers.map(({ distance, mover }) => onScreenOf(mover, onScreen(distance, mover)));
  const caps: [number, (screen: (typeof screens)[number]) => boolean][] = [
    [read(TUNING, "counts", "maxMovers"), () => true],
    [read(TUNING, "counts", "maxDartMovers"), (screen) => screen.dart],
    [read(TUNING, "counts", "maxSlowVehicles"), (screen) => screen.slowVehicle],
  ];
  for (const {
    interval: [start],
  } of screens) {
    for (const [cap, counted] of caps) {
      const atOnce = screens.filter(
        (screen) => counted(screen) && screen.interval[0] <= start && start < screen.interval[1],
      ).length;
      expect(atOnce).toBeLessThanOrEqual(cap);
    }
  }
}

// Between these runtime motion boundaries each component is monotone on both axes.
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
    const at = path.warning + pause.after / path.lanesPerPixel;
    cuts.push(at, at + pause.length);
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

// Evaluate actual bodies independently of planner masks. All lane/contact crossings split the
// time axis, so endpoints and interval interiors cover every simultaneous occupancy state.
function maximumContactLanes(
  tuned: Real,
  road: RoadGeometry,
  pending: Walk["road"]["pending"],
): number {
  const inset = road.cell.inset / road.cell.length;
  const end = Math.max(0, ...pending.map(({ distance }) => distance)) + MOVER_SCROLL;
  const cuts = new Set([0, end]);
  const actors = pending
    .filter(({ kind }) => blocksLane(tuned, kind))
    .map((event) => {
      const { distance, kind, mover } = event;
      const offset = distance - road.sightLength;
      const width = footprintOf(tuned, kind).lanes;
      const height =
        mover?.motion === "signature" && mover.route.profile.kind === "delayedTrail"
          ? componentHitLength(road, mover.route.profile)
          : itemHeight(tuned, road, kind, mover !== undefined);
      const paths = (mover === undefined ? [undefined] : moverOutcomes(mover)).map((path) => ({
        at(scroll: number): ReturnType<typeof moverPlace>[] {
          const since = scroll - offset;
          const points =
            path === undefined
              ? [{ lanePosition: event.lane, solid: true, travel: since }]
              : path.motion === "signature"
                ? path.route.componentDelays.map((_, component) => {
                    const point = signaturePlace(path.route, since, component);
                    return { lanePosition: point.x, solid: true, travel: point.y };
                  })
                : [moverPlace(LANE_COUNT, path, since)];
          return points.map((point) => ({ ...point, solid: since >= 0 && point.solid }));
        },
        cuts: path === undefined ? [offset] : motionCuts(path).map((at) => at + offset),
      }));
      for (const path of paths) {
        const breaks = [...new Set([0, end, ...path.cuts.filter((at) => at > 0 && at < end)])].sort(
          (a, b) => a - b,
        );
        breaks.forEach((at) => cuts.add(at));
        for (let index = 1; index < breaks.length; index++) {
          const from = breaks[index - 1]!,
            to = breaks[index]!;
          for (let component = 0; component < path.at(from).length; component++) {
            const coordinates = [
              {
                axis: "travel",
                levels: [road.sightLength, road.sightLength + height + packHitLength(road)],
              },
              {
                axis: "lanePosition",
                levels: Array.from({ length: LANE_COUNT }, (_, lane) => [
                  lane + 1 - inset,
                  lane - width + inset,
                ]).flat(),
              },
            ] as const;
            for (const { axis, levels } of coordinates) {
              const value = (at: number) => path.at(at)[component]![axis];
              const a = value(from),
                b = value(to);
              for (const level of levels) {
                if (!(level > Math.min(a, b) && level < Math.max(a, b))) {
                  continue;
                }
                let low = from,
                  high = to;
                for (let iteration = 0; iteration < 60; iteration++) {
                  const middle = (low + high) / 2;
                  if (value(middle) < level === a < b) {
                    low = middle;
                  } else {
                    high = middle;
                  }
                }
                cuts.add((low + high) / 2);
              }
            }
          }
        }
      }
      return { height, paths, width };
    });
  const ordered = [...cuts].sort((a, b) => a - b);
  const samples = [...ordered, ...ordered.slice(1).map((at, index) => (ordered[index]! + at) / 2)];
  let maximum = 0;
  for (const at of samples) {
    let states = [new Set<number>()];
    for (const { height, paths, width } of actors) {
      const options = paths.map((path) => {
        const lanes = new Set<number>();
        for (const point of path.at(at)) {
          if (
            !point.solid ||
            point.travel < road.sightLength - 1e-9 ||
            point.travel >= road.sightLength + height + packHitLength(road) - 1e-9
          ) {
            continue;
          }
          for (let lane = 0; lane < LANE_COUNT; lane++) {
            if (
              lane + 0.5 > point.lanePosition - 0.5 + inset + 1e-9 &&
              lane - 0.5 < point.lanePosition + width - 0.5 - inset - 1e-9
            ) {
              lanes.add(lane);
            }
          }
        }
        return lanes;
      });
      const combined = states.flatMap((prior) =>
        options.map((lanes) => new Set([...prior, ...lanes])),
      );
      states = [...new Map(combined.map((lanes) => [[...lanes].sort().join(","), lanes])).values()];
    }
    maximum = Math.max(maximum, ...states.map((lanes) => lanes.size));
  }
  return maximum;
}

it("bounds the full contact of unsorted spans without changing them", () => {
  const spans = Object.freeze([
    Object.freeze({ distance: 80, lane: 1, laneSpan: 1, length: 5 }),
    Object.freeze({ distance: 12, lane: 2, laneSpan: 1, length: 60 }),
    Object.freeze({ distance: 40, lane: 0, laneSpan: 1, length: 90 }),
  ]);
  expect(contactOfSpans(spans)).toEqual({ end: 130, start: 12 });
});

it("distinguishes a changing swept union from concurrent multi-actor contact", () => {
  const path: MoverPath = {
    direction: 1,
    enterTravel: GAME_ROAD.sightLength,
    idle: 0,
    lanesPerPixel: 0.04,
    motion: "cross",
    movement: "dart",
    span: 2,
    stopAfter: null,
    tilt: 0,
    turnAfter: null,
    warning: 0,
  };
  const event = { distance: 1000, kind: "ferrets", lane: 0, mover: path } as const;
  const contactEnd =
    GAME_ROAD.sightLength +
    itemHeight(REAL, GAME_ROAD, event.kind, true) +
    packHitLength(GAME_ROAD);
  expect(sweptLanes(LANE_COUNT, path, GAME_ROAD.sightLength, contactEnd).count).toBe(LANE_COUNT);
  expect(maximumContactLanes(REAL, GAME_ROAD, [event])).toBeLessThanOrEqual(LANE_COUNT - 2);
  expect(
    maximumContactLanes(REAL, GAME_ROAD, [
      event,
      {
        ...event,
        mover: { ...path, direction: -1 },
      },
    ]),
  ).toBeGreaterThan(LANE_COUNT - 2);
});

// Every zone at the fastest pace, with every obstacle that can move moving: a way past every
// lane-blocking spawn from every lane, at most the caps of movers on screen, the pack-fit gap
// wherever the path changes lanes between two obstacles, and each mover moving as its kind does.
describe("the planned road", { timeout: 200_000 }, () => {
  const everyMover: Real = { ...REAL, world: sharedWorld(WORLD, 1) };
  // Every stepper and hopper hopping 1 or 2 times, each hop up to 2 spots any way.
  const HOP: HopMovement = { kind: "hop", most: 2, times: { max: 2, min: 1 } };
  const hopping = hoppingInstead(everyMover, HOP);
  // The game's pack, and a taller one on rows spaced wider by as much.
  const packs = [
    { pack: "the game's pack", road: GAME_ROAD, taller: 0 },
    { pack: "a taller pack", road: TALL_PACK_ROAD, taller: TALLER },
  ];
  // The zones' shares with both packs, a share of 1 only where some zone's share is under 1, since
  // it plans the same zones otherwise, and every hopper hopping.
  const everyZoneMoves = WORLD.zones.every(({ moverShare }) => moverShare === 1);
  const worlds = [
    { packs, tuned: REAL },
    ...(everyZoneMoves ? [] : [{ packs: packs.slice(0, 1), tuned: everyMover }]),
    { packs: packs.slice(0, 1), tuned: hopping },
  ];
  // The data with the minor obstacles' counts changed as given.
  const withMinorCounts = (
    counts: { readonly first?: number; readonly gain?: number },
    tuned: Real,
  ): Real => ({
    ...tuned,
    world: mapZones((zone) => {
      const rows = zone.spawnSlots.counts.map((row, position) => {
        const total =
          (counts.first ??
            zone.spawnSlots.counts[0].minorFixed + zone.spawnSlots.counts[0].minorMoving) +
          position * (counts.gain ?? 0);
        const split = apportionSlotCounts(total, {
          encounterFixed: 0,
          encounterMoving: 0,
          minorFixed: row.minorFixed,
          minorMoving: row.minorMoving,
        });
        return { ...row, minorFixed: split.minorFixed, minorMoving: split.minorMoving };
      }) as unknown as typeof zone.spawnSlots.counts;
      return {
        ...zone,
        spawnSlots: {
          ...zone.spawnSlots,
          capacity: {
            ...zone.spawnSlots.capacity,
            minorFixed: Math.max(
              zone.spawnSlots.capacity.minorFixed,
              ...rows.map((row) => row.minorFixed),
            ),
            minorMoving: Math.max(
              zone.spawnSlots.capacity.minorMoving,
              ...rows.map((row) => row.minorMoving),
            ),
          },
          counts: rows,
        },
      };
    }, tuned.world),
  });
  // Every zone as the walk's last, and the walk's first zone as its first, whose rows reach back
  // onto the road in view as it starts.
  const zonePlaces = [
    ...ZONE_IDS.map((zone) => ({ zone, zoneIndex: WORLD.walkLength - 1 })),
    { zone: WORLD.firstZone as ZoneId, zoneIndex: 0 },
  ];
  // The most seeds the overlap check plans each zone place on, and how many stop-and-go crossers
  // it plans before it stops.
  const OVERLAP_SEEDS = 8;
  const OVERLAP_CROSSERS = 8;
  type PassableCase = {
    road: RoadGeometry;
    seed?: number;
    tuned: Real;
    zone: ZoneId;
    zoneIndex: number;
  };
  // Every world, pack and zone place.
  const PASSABLE: readonly PassableCase[] = worlds.flatMap(({ packs: sized, tuned }) =>
    sized.flatMap(({ road, taller }) =>
      zonePlaces.map(({ zone, zoneIndex }) => ({
        road,
        tuned: taller === 0 ? tuned : widerRows(tuned, taller),
        zone,
        zoneIndex,
      })),
    ),
  );
  // Each case's plan on its seed, 1 unless given, planned once for every check made of it, by its
  // data and road objects, zone, walk position and seed.
  const ids = new Map<object, number>();
  const idOf = (value: object): number => {
    let id = ids.get(value);
    if (id === undefined) {
      id = ids.size;
      ids.set(value, id);
    }
    return id;
  };
  const plans = new Map<string, Walk>();
  const planOf = (passable: PassableCase): Walk => {
    const { road, seed = 1, tuned, zone, zoneIndex } = passable;
    const key = `${idOf(tuned)} ${idOf(road)} ${zone} ${zoneIndex} ${seed}`;
    let walk = plans.get(key);
    if (walk === undefined) {
      walk = planZoneForSeed(tuned, road, seed, {
        road: startRoad(LANE_COUNT),
        run: inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex),
      });
      plans.set(key, walk);
    }
    return walk;
  };

  it.each(zonePlaces)(
    "keeps every move passable in $zone at walk position $zoneIndex, at the shares, with a taller pack and hopping",
    ({ zone, zoneIndex }) => {
      const cases = PASSABLE.filter(
        (passable) => passable.zone === zone && passable.zoneIndex === zoneIndex,
      );
      expect(cases.length).toBeGreaterThan(0);
      expectPassable(cases);
    },
  );
  // Other minor obstacle counts on the game's pack: denser, the last zone's count rising by the
  // gain for each zone walked before it, and counts at which seed 1 plans a dart that leaves the
  // road while it meets the pack, with another obstacle beside it or soon after it in a lane next
  // to its own: the pack-fit gap holds for the lanes and stretch its hit box meets the pack in.
  it.each([{ gain: 3 }, { first: 51, gain: 0 }, { first: 58, gain: 1 }])(
    "keeps every move passable at minor obstacle counts %o",
    (counts) => {
      const tuned = withMinorCounts(counts, REAL);
      expectPassable(zonePlaces.map((place) => ({ ...place, road: GAME_ROAD, tuned })));
    },
  );
  // Minor obstacle counts at which seed 1, with even weighted draws and every hopper hopping,
  // plans the last zone with a mover just after a card mover stilled for want of room, or with a
  // dart just before a stepper in the lane beside those it meets the pack in: the pack-fit gap
  // holds whatever the draws.
  it.each([
    { first: 70, gain: 0 },
    { first: 90, gain: 1 },
  ])("keeps every move passable with even weighted draws: %o", (counts) => {
    unbiased.on = true;
    try {
      expectPassable([
        {
          road: GAME_ROAD,
          tuned: withMinorCounts(counts, hopping),
          zone: WORLD.lastZone,
          zoneIndex: WORLD.walkLength - 1,
        },
      ]);
    } finally {
      unbiased.on = false;
    }
  });
  // Each dart more than a lane wide, in each zone it comes in, weighed there as heavily as the
  // zone's other minor obstacles together, so every plan has several, planned on many seeds with
  // the zone first in the walk and last: each one crosses as wide as its footprint, some turn
  // back and some cross, and the road stays passable around them (expectPassable). The lanes the
  // planner reserves for one in the pack's window contain its complete sweep. Actual bodies
  // across all actors retain openLanesPerRowMin lanes at each instant.
  const WIDE_DARTS = keysOf(REAL.minorObstacles).flatMap((kind) =>
    movementOf(REAL, kind)?.kind === "dart" && footprintOf(REAL, kind).lanes > 1
      ? WORLD.zones
          .filter(({ weights }) => weights.minorObstacles[kind] > 0)
          .map(({ id }) => ({ kind, zone: id }))
      : [],
  );
  const WIDE_DART_SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
  const WIDE_DART_CASES = WIDE_DARTS.flatMap(({ kind, zone }) => {
    const tuned: Real = {
      ...REAL,
      world: mapZones((each) => {
        if (each.id !== zone) {
          return each;
        }
        const weights = each.weights.minorObstacles;
        const others = keysOf(weights)
          .filter((other) => other !== kind)
          .reduce((sum, other) => sum + weights[other], 0);
        return {
          ...each,
          weights: { ...each.weights, minorObstacles: { ...weights, [kind]: others } },
        };
      }, WORLD),
    };
    return [0, WORLD.walkLength - 1].flatMap((zoneIndex) =>
      WIDE_DART_SEEDS.map((seed) => ({
        kind,
        passable: { road: GAME_ROAD, seed, tuned, zone, zoneIndex },
        seed,
        zone,
        zoneIndex,
      })),
    );
  });
  it.each(WIDE_DART_CASES)(
    "places $kind in $zone (zone $zoneIndex, seed $seed) by every placement rule",
    ({ kind, passable, zone }) => {
      const { tuned } = passable;
      expectPassable([passable]);
      const blocking = planOf(passable).road.pending.filter((event) =>
        blocksLane(tuned, event.kind),
      );
      const wide = blocking.flatMap(({ distance, kind: other, mover }) =>
        other === kind && mover?.motion === "cross" ? [{ distance, kind, mover }] : [],
      );
      expect(wide.length).toBeGreaterThan(0);
      const minOpen = read(tuned.tuning, "counts", "openLanesPerRowMin");
      expect(maximumContactLanes(tuned, GAME_ROAD, blocking)).toBeLessThanOrEqual(
        LANE_COUNT - minOpen,
      );
      for (const dart of wide) {
        expect(crossSpan(dart.mover)).toBe(footprintOf(tuned, kind).lanes);
        const touched = new Set(
          moverSpans("planned", tuned, GAME_ROAD, zone, dart).map(({ lane }) => lane),
        );
        const sight = GAME_ROAD.sightLength;
        const window = standingSpan(tuned, GAME_ROAD, zone, { ...dart, lane: 0 }).length;
        const { count, first } = sweptLanes(LANE_COUNT, dart.mover, sight, sight + window);
        const swept = Array.from({ length: count }, (_, i) => first + i);
        expect(swept).toEqual(expect.arrayContaining([...touched]));
      }
    },
  );
  it.each(WIDE_DARTS)("plans $kind in $zone both crossing and turning back", ({ kind, zone }) => {
    const outcomes = WIDE_DART_CASES.filter((wide) => wide.kind === kind && wide.zone === zone)
      .flatMap(({ passable }) => planOf(passable).road.pending)
      .flatMap(({ kind: other, mover }) =>
        other === kind && mover?.motion === "cross" ? [mover.turnAfter === null] : [],
      );
    expect([...new Set(outcomes)].sort()).toEqual([false, true]);
  });
  // A pack following the zone's path passes every obstacle with full margins (pathShortfalls),
  // measured as drawn: each obstacle at its kind's drawn hit length, the pack at the tallest pack's
  // hit boxes, the lane moves in whole walk steps and the reaction margin, less a pixel for a
  // mover's contact sampled a pixel of scroll at a time. The pack also has a way through the zone
  // from the path's first lane.
  function expectPassable(cases: readonly PassableCase[]): void {
    for (const passable of cases) {
      const { road, tuned, zone, zoneIndex } = passable;
      const walk = planOf(passable);
      const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex);
      const speed = walkScrollSpeed(tuned, zoned);
      const laneMove = Math.ceil(muddyLaneMove / STEP_SECONDS - 1e-9) * STEP_SECONDS * speed;
      const margin = read(tuned.tuning, "seconds", "pathReactionMargin") * speed;
      const fit = (moves: number) => packHitLength(road) + moves * laneMove + margin - 1;
      const blocking = walk.road.pending.filter((event) => blocksLane(tuned, event.kind));
      const spans = blockingSpans(tuned, road, zone, blocking);
      const start = walk.road.path[0]?.lane ?? -1;
      const label = `${zone} ${zoneIndex}`;
      expect(lanesReachedAtEnd(walkwayOf(tuned, road, zoned), spans, start), label).not.toEqual([]);
      const movers = blocking.flatMap(({ distance, kind, mover }) =>
        mover === undefined ? [] : [{ distance, kind, mover }],
      );
      for (const { kind, mover } of movers) {
        expect(mover.movement).toBe(assignedMovement(tuned, zone, kind)?.kind);
      }
      expectCapsOnScreen(movers);
      // Each obstacle's contact with the pack: its drawn hit box's extent and its lanes.
      const contacts = blocking.map((event) => {
        const named = `${event.kind} at ${event.distance}`;
        if (event.mover === undefined) {
          const { lanes } = footprintOf(tuned, event.kind);
          return {
            end: event.distance + itemHeight(tuned, road, event.kind, false),
            label: named,
            lanes: new Set(Array.from({ length: lanes }, (_, i) => event.lane + i)),
            start: event.distance,
          };
        }
        const moving = { ...event, mover: event.mover };
        const touched = moverSpans("drawn", tuned, road, zone, moving);
        const { end, start: meets } = contactOfSpans(touched);
        return {
          end: end - packHitLength(road),
          label: named,
          lanes: new Set(touched.map(({ lane }) => lane)),
          start: meets,
        };
      });
      expect(pathShortfalls(packHitLength(road), fit, walk.road.path, contacts), label).toEqual([]);
    }
  }

  // A standing obstacle may stand where a dart passes, crossing over or past it, but never where
  // another mover is while it is there, a stop-and-go crossing the road side-on included: at no
  // moment with both on the road do their drawn hit boxes overlap in a lane both cover, whichever
  // way a stalker or shy hopper chooses its moves. Each overlap, named.
  const standingOverlaps = (passable: PassableCase): string[] => {
    const { road, seed = 1, tuned, zone } = passable;
    const walk = planOf(passable);
    const blocking = walk.road.pending.filter((event) => blocksLane(tuned, event.kind));
    const roadLength = road.roadBottom - road.roadTop;
    const inset = road.cell.inset / road.cell.length;
    const standing = blocking.filter(({ mover }) => mover === undefined);
    return blocking.flatMap(({ distance, kind, mover }) => {
      if (mover === undefined || (mover.motion === "cross" && mover.pause === undefined)) {
        return [];
      }
      const height = itemHeight(tuned, road, kind, true);
      const across = footprintOf(tuned, kind).lanes;
      // By lane, the nearest and farthest distances along the zone its near edge reaches on the
      // road.
      const reached = new Map<number, { far: number; near: number }>();
      for (const path of moverOutcomes(mover)) {
        for (let since = 0; since < MOVER_SCROLL; since++) {
          const place = moverPlace(LANE_COUNT, path, since);
          if (!place.solid || place.travel <= 0) {
            continue;
          }
          if (place.travel - height >= roadLength) {
            break;
          }
          const at = distance + since - place.travel;
          const first = Math.floor(place.lanePosition - 1 + inset) + 1;
          const last = Math.ceil(place.lanePosition + across - inset) - 1;
          for (let lane = first; lane <= last; lane++) {
            const { far, near } = reached.get(lane) ?? { far: at, near: at };
            reached.set(lane, { far: Math.max(far, at), near: Math.min(near, at) });
          }
        }
      }
      return standing.flatMap((obstacle) => {
        const { lanes } = footprintOf(tuned, obstacle.kind);
        const length = itemHeight(tuned, road, obstacle.kind, false);
        const overlaps = Array.from({ length: lanes }, (_, i) => obstacle.lane + i).some((lane) => {
          const span = reached.get(lane);
          return (
            span !== undefined &&
            obstacle.distance < span.far + height &&
            span.near < obstacle.distance + length
          );
        });
        return overlaps ? [`${zone} seed ${seed}: ${obstacle.kind} on ${kind} at ${distance}`] : [];
      });
    });
  };
  it("keeps every standing obstacle's hit box off every mover's but a dart's", () => {
    expect(PASSABLE.flatMap(standingOverlaps)).toEqual([]);
  });
  // Over many seeds of every zone place whose zone weighs a stop-and-go crosser, as no one seed
  // plans every stop-and-go crosser next to a standing obstacle: a seed at a time from seed 1 until
  // it has planned enough of them. The check above covers every zone place on seed 1.
  const isCrosser = ({ mover }: Walk["road"]["pending"][number]) =>
    mover?.motion === "cross" && mover.pause !== undefined;
  const weighsCrosser = (zone: ZoneId) =>
    WORLD.zones.some(
      ({ id, weights }) =>
        id === zone &&
        [...Object.entries(weights.minorObstacles), ...Object.entries(weights.obstacles)].some(
          ([kind, weight]) =>
            weight > 0 && movementOf(REAL, kind as WalkItemKind)?.kind === "stopAndGoAcross",
        ),
    );
  it.each(zonePlaces.filter(({ zone }) => weighsCrosser(zone)))(
    "keeps every standing obstacle's hit box off every mover's but a dart's in $zone at $zoneIndex",
    (place) => {
      const overlaps: string[] = [];
      let crossers = 0;
      for (let seed = 1; seed <= OVERLAP_SEEDS && crossers < OVERLAP_CROSSERS; seed++) {
        const passable = { ...place, road: GAME_ROAD, seed, tuned: REAL };
        overlaps.push(...standingOverlaps(passable));
        crossers += planOf(passable).road.pending.filter(isCrosser).length;
      }
      expect(crossers).toBeGreaterThan(0);
      expect(overlaps).toEqual([]);
    },
  );
});
