import { STEP_SECONDS } from "@andornaut/game-kit/runtime/clock/fixedStep";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { LANE_COUNT } from "../data/screen.ts";
import type { CardSource, ZoneId } from "../data/types.ts";
import { cardFor, openCard } from "../rules/choices.ts";
import { newRun } from "../rules/newRun.ts";
import { screenRoadGeometry } from "./screenGeometry.ts";
import {
  awaitsZonePlan,
  chooseShownCard,
  jumpToNeighbourhood,
  runStreams,
  type Session,
  stepSession,
  unplannedStart,
  withZonePlan,
  type ZonePlanning,
} from "./walk/session.ts";
import { startRoad, type Walk } from "./walk/step.ts";
import { type ZonePlanner, zonePlanner, type ZonePlanPort } from "./zonePlanner.ts";
import { answerZonePlan, type ZonePlanAnswer } from "./zonePlans.ts";

// A worker as the page has one: each message copied as postMessage copies it, answered on a
// later task.
function copyingWorker(): ZonePlanPort {
  let answer: (answer: ZonePlanAnswer) => void = () => undefined;
  return {
    listen: (heard) => {
      answer = heard;
    },
    post: (request) => {
      const sent = structuredClone(request);
      setTimeout(() => {
        answer(structuredClone(answerZonePlan(sent)));
      }, 0);
    },
  };
}

// A worker that fails to load, as one not yet cached does offline.
function failingWorker(): ZonePlanPort {
  let fail = () => undefined as void;
  return {
    listen: (_answer, failed) => {
      fail = failed;
    },
    post: () => {
      setTimeout(fail, 0);
    },
  };
}

const planned = (planner: ZonePlanner, seed: number, walk: Walk) =>
  new Promise<Walk>((resolve) => {
    planner.plan(seed, walk, resolve);
  });

const ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);

// A walk on seed in route slot zoneIndex, part way along its zone, its road not yet planned.
function walking(zoneIndex: number): Session {
  const run = {
    ...newRun(gameData, 3, { dogs: ["kilo", "lady"], gear: null, walker: "casey" }),
    route: ZONES.slice(0, zoneIndex + 1),
    zoneIndex,
  };
  return { ...unplannedStart({ road: startRoad(LANE_COUNT), run }), needsZonePlan: false };
}

describe("zone planner", { timeout: 60_000 }, () => {
  // A neighbourhood cheat or a fork's path planned off the page resumes the walk on the very plan
  // the step makes: the same seed, route and slot give the same walk, byte for byte, and its next
  // step is the same. A worker that fails plans on the page, with the same result.
  it.each([
    { port: copyingWorker, seed: 1, switchTo: "cabbagetown", zoneIndex: 0 },
    { port: copyingWorker, seed: 7, switchTo: "theBeaches", zoneIndex: 2 },
    { port: failingWorker, seed: 2026, switchTo: "yongeStreet", zoneIndex: 3 },
  ] as const)(
    "plans seed $seed's switch to $switchTo in slot $zoneIndex as the step does",
    async ({ port, seed, switchTo, zoneIndex }) => {
      const jump = (planning: ZonePlanning) =>
        jumpToNeighbourhood(
          gameData,
          runStreams(seed),
          screenRoadGeometry,
          planning,
          LANE_COUNT,
          switchTo,
          walking(zoneIndex),
        );
      const inStep = jump("inStep").session;
      const deferred = jump("deferred");
      expect(deferred.events).toEqual([]);
      expect(awaitsZonePlan(deferred.session)).toBe(true);
      expect(deferred.session.walk.road.pending).toEqual([]);

      const walk = await planned(zonePlanner(port()), seed, deferred.session.walk);
      const resumed = withZonePlan(deferred.session, walk);
      expect(awaitsZonePlan(resumed)).toBe(false);
      expect(JSON.stringify(resumed)).toBe(JSON.stringify(inStep));
      expect(resumed.walk.road.pending.length).toBeGreaterThan(0);
      const step = (session: Session) =>
        stepSession(gameData, runStreams(seed), screenRoadGeometry, STEP_SECONDS, [], session);
      expect(JSON.stringify(step(resumed))).toBe(JSON.stringify(step(inStep)));
    },
  );

  it("plans the zone a fork's path leads to as the step does", async () => {
    const source: CardSource = {
      kind: "fork",
      paths: ["kensingtonMarket"],
      upgrades: ["bellyRubs"],
    };
    const before = walking(1);
    const run = openCard(source, { ...before.walk.run, route: ZONES.slice(0, 1) });
    const fork: Session = {
      ...before,
      card: cardFor(gameData, run, source),
      needsZonePlan: true,
      walk: { ...before.walk, run },
    };
    const view = fork.card;
    if (view === null) {
      throw new Error("The fork did not open");
    }
    const choose = (planning: ZonePlanning) =>
      chooseShownCard(gameData, runStreams(5), screenRoadGeometry, planning, view, 0, fork);
    const deferred = choose("deferred").session;
    expect(awaitsZonePlan(deferred)).toBe(true);
    const walk = await planned(zonePlanner(copyingWorker()), 5, deferred.walk);
    expect(JSON.stringify(withZonePlan(deferred, walk))).toBe(
      JSON.stringify(choose("inStep").session),
    );
  });

  // Only the latest request is answered: one sent while another plans waits, and replaces any
  // that waits before it.
  it("answers only the latest of the requests sent while one plans", () => {
    const posted: number[] = [];
    let answer: (answer: ZonePlanAnswer) => void = () => undefined;
    const planner = zonePlanner({
      listen: (heard) => {
        answer = heard;
      },
      post: ({ id }) => posted.push(id),
    });
    const heard: string[] = [];
    const walk = (name: string) => ({ name }) as unknown as Walk;
    for (const name of ["first", "second", "third"]) {
      planner.plan(1, walk(name), (planned) =>
        heard.push((planned as unknown as { name: string }).name),
      );
    }
    expect(posted).toEqual([1]);
    answer({ id: 1, walk: walk("first") });
    expect(posted).toEqual([1, 3]);
    answer({ id: 3, walk: walk("third") });
    expect(heard).toEqual(["third"]);
  });
});
