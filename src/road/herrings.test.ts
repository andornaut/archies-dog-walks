import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { seededRandom } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { LANE_COUNT } from "../data/screen.ts";
import type { MinorObstacleId, ZoneId } from "../data/types.ts";
import { read } from "../rules/units.ts";
import { drawMover } from "../runner/moverDraws.ts";
import { isHerring } from "../runner/moverPlanning.ts";
import { moverPlace, moverTell } from "../runner/movers.ts";
import { moverSpec } from "../runner/moverSpecs.ts";
import { startRoad, stepWalk, type Walk, zoneLength } from "../runner/walk.ts";
import { footprintOf } from "../runner/walkItems.ts";
import { planZone } from "../runner/zonePlan.ts";
import { plannerStreams } from "../testing/movers.ts";
import { FASTEST_WALKER, GAME_ROAD, inZone, REAL, type Real, realRun } from "../testing/planner.ts";
import { distractionScroll } from "./distractions.ts";
import { herringNow } from "./herrings.ts";

// The kinds with red herrings, each with its share and the zones that weigh it above 0.
const HERRING_KINDS = keysOf(REAL.minorObstacles).flatMap((kind: MinorObstacleId) => {
  const entry = REAL.minorObstacles[kind];
  const movement = "movement" in entry ? entry.movement : undefined;
  if (movement?.kind !== "stopAndGoAcross" || !("herringShare" in movement)) {
    return [];
  }
  const zones = REAL.world.zones
    .filter(({ weights }) => weights.minorObstacles[kind] > 0)
    .map(({ id }) => id as ZoneId);
  return [
    { kind, movement, share: read(REAL.tuning, "probability", movement.herringShare), zones },
  ];
});
const SEEDS = Array.from({ length: 6 }, (_, i) => i + 1);
const HERRING_SHARE_TOLERANCE = 0.1;
// Enough draws that the tolerance is 4 standard deviations of their share, sqrt(0.25 / n) at most.
const HERRING_MOVERS_ENOUGH = Math.ceil(0.25 / (HERRING_SHARE_TOLERANCE / 4) ** 2);
const HERRING_SEEDS_MOST = 240;

// A zone planned on a seed at the walk's first or last position.
const planned = (data: Real, zone: ZoneId, zoneIndex: number, seed: number): Walk =>
  planZone(data, GAME_ROAD, plannerStreams(seed), {
    road: startRoad(LANE_COUNT),
    run: inZone(realRun(data, FASTEST_WALKER), zone, zoneIndex),
  });
// The game's data planned in a zone at a walk position on a seed, planned once for every test.
const realPlans = new Map<string, Walk>();
const realPlanned = (zone: ZoneId, zoneIndex: number, seed: number): Walk => {
  const key = `${zone} ${zoneIndex} ${seed}`;
  let walk = realPlans.get(key);
  if (walk === undefined) {
    walk = planned(REAL, zone, zoneIndex, seed);
    realPlans.set(key, walk);
  }
  return walk;
};
const plansOf = (zones: readonly ZoneId[], seeds: readonly number[]) =>
  zones.flatMap((zone) =>
    [0, REAL.world.walkLength - 1].flatMap((zoneIndex) =>
      seeds.map((seed) => ({ seed, walk: realPlanned(zone, zoneIndex, seed), zone, zoneIndex })),
    ),
  );

describe("red herrings", { timeout: 60_000 }, () => {
  it("has a kind with red herrings", () => {
    expect(HERRING_KINDS.length).toBeGreaterThan(0);
  });

  // Admission can omit a drawn mover, so its configured probability is measured before placement.
  it.each(HERRING_KINDS)("draws about $share of $kind's movers as red herrings", (herring) => {
    const streams = plannerStreams(1);
    const spec = moverSpec(REAL, streams, footprintOf(REAL, herring.kind), herring.movement);
    let herrings = 0;
    for (let mover = 0; mover < HERRING_MOVERS_ENOUGH; mover++) {
      herrings += Number(isHerring(spec, drawMover(streams)));
    }
    expect(Math.abs(herrings / HERRING_MOVERS_ENOUGH - herring.share)).toBeLessThan(
      HERRING_SHARE_TOLERANCE,
    );
  });

  // Each red herring is no spawn of the walk's, and its seed plans it again the same (checked on
  // the first plan with one, as the planner draws every zone's herrings from the same streams). It
  // shows from as its row comes on screen with no cue, never coming nearer the pack than the road
  // ahead a distraction is gone by, and crosses the whole road, gone before its zone ends.
  it.each(HERRING_KINDS)("plans $kind's red herrings outside the walk, with no cue", (herring) => {
    const end = distractionScroll(REAL, GAME_ROAD);
    const length = zoneLength(REAL);
    let shown = 0;
    for (const { seed, walk, zone, zoneIndex } of plansOf(herring.zones, SEEDS)) {
      const { road } = walk;
      if (shown === 0 && road.herrings.length > 0) {
        expect(planned(REAL, zone, zoneIndex, seed).road.herrings).toEqual(road.herrings);
      }
      for (const event of road.herrings) {
        shown += 1;
        expect(road.pending).not.toContainEqual(event);
        expect(herringNow(REAL, GAME_ROAD, event.distance - 1, event)).toBeNull();
        const lanes = new Set<number>();
        let at = event.distance;
        for (; ; at++) {
          const item = herringNow(REAL, GAME_ROAD, at, event);
          if (item === null) {
            break;
          }
          const { path, since } = item.mover;
          expect(moverTell(path, since)).toBeNull();
          const place = moverPlace(LANE_COUNT, path, since);
          expect(place.travel).toBeLessThanOrEqual(end + 1e-6);
          for (let lane = 0; lane < item.laneSpan; lane++) {
            lanes.add(Math.round(place.lanePosition) + lane);
          }
        }
        expect(at).toBeLessThanOrEqual(length + 1);
        for (let lane = 0; lane < LANE_COUNT; lane++) {
          expect(lanes).toContain(lane);
        }
      }
    }
    expect(shown).toBeGreaterThan(0);
  });

  // The walk never reads its red herrings: stepped with or without them, a planned zone walks the
  // same, every hit and pickup included.
  it.each(HERRING_KINDS)(
    "walks a zone the same with or without $kind's red herrings",
    (herring) => {
      // The first seed's plan with one of them.
      let plan: { walk: Walk } | undefined;
      for (let seed = 1; seed <= HERRING_SEEDS_MOST && plan === undefined; seed++) {
        plan = plansOf(herring.zones, [seed]).find(({ walk }) =>
          walk.road.herrings.some(({ kind }) => kind === herring.kind),
        );
      }
      expect(plan).toBeDefined();
      const walked = (walk: Walk) => {
        const random = seededRandom(1);
        const steps = [];
        let current = walk;
        for (let i = 0; i < 60 * 60; i++) {
          const step = stepWalk(REAL, GAME_ROAD, random, STEP_SECONDS, current);
          current = step.walk;
          steps.push({
            ...step,
            walk: { ...step.walk, road: { ...step.walk.road, herrings: [] } },
          });
        }
        return steps;
      };
      const walk = plan?.walk ?? planned(REAL, herring.zones[0] ?? "highPark", 0, 1);
      expect(walked({ ...walk, road: { ...walk.road, herrings: [] } })).toEqual(walked(walk));
    },
  );
});
