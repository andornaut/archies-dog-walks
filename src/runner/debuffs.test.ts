import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { applyEffects } from "../rules/effects";
import { read } from "../rules/units";
import type { ActiveDebuff, RunState } from "../state/runState";
import { testState } from "../testing/runState";
import { startRoad, stepWalk, type Walk } from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

const data = gameData;
const { tuning } = data;
const DEBUFF_IDS = keysOf(data.debuffs);
const PACK = Object.fromEntries(
  keysOf(data.dogs)
    .slice(0, 2)
    .map((dog) => [dog, 5]),
);
const GEOMETRY = (() => {
  const road = SCREEN_LAYOUT.road;
  const pack = { dogs: keysOf<DogId>(PACK), walker: data.defaultWalker };
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
const STEP = 1 / 60;
const noRandom = () => 0;

const withDebuffs = (run: RunState, ids: readonly DebuffId[]): RunState =>
  applyEffects(
    data,
    { affected: [], source: { kind: "walker", walker: run.walker } },
    ids.map((debuff) => ({ debuff, kind: "debuff" as const })),
    run,
  );

const walkOf = (run: RunState): Walk => ({ road: startRoad(LANE_COUNT), run });

// Steps the walk this many seconds, a 60 Hz step at a time.
function walkFor(seconds: number, walk: Walk): Walk {
  let next = walk;
  for (let step = 0; step < Math.round(seconds / STEP); step++) {
    next = stepWalk(data, GEOMETRY, noRandom, STEP, next).walk;
  }
  return next;
}

const held = (run: RunState, debuff: DebuffId): ActiveDebuff | undefined =>
  run.debuffs.find((active) => active.debuff === debuff);

// The seconds a debuff lasts.
function secondsOf(debuff: DebuffId): number {
  return read(tuning, "seconds", data.debuffs[debuff].seconds);
}

describe("debuff durations", () => {
  // Each debuff lasts its data's seconds, counts down while walking, holds during a hit stop,
  // ends when its time runs out and starts over when applied again.
  it.each(DEBUFF_IDS)("times %s", (debuff) => {
    const seconds = secondsOf(debuff);
    const applied = withDebuffs(testState(PACK, { zoneIndex: 1 }), [debuff]);
    expect(held(applied, debuff)).toEqual({ debuff, secondsLeft: seconds, untilZone: 1 });

    const start = walkOf(withDebuffs(testState(PACK), [debuff]));
    const halfway = walkFor(seconds / 2, start);
    expect(held(halfway.run, debuff)?.secondsLeft).toBeCloseTo(seconds / 2, 5);
    expect(held(walkFor(seconds / 2 + STEP, halfway).run, debuff)).toBeUndefined();

    const hitStop = { cards: [], firing: false, seconds: 1, zoneEnded: false };
    const stopped: Walk = { ...start, road: { ...start.road, hitStop } };
    expect(held(walkFor(0.5, stopped).run, debuff)).toEqual(held(start.run, debuff));

    const refreshed = withDebuffs(walkFor(1, start).run, [debuff]);
    expect(refreshed.debuffs.filter((active) => active.debuff === debuff)).toHaveLength(1);
    expect(held(refreshed, debuff)?.secondsLeft).toBe(seconds);
  });
});
