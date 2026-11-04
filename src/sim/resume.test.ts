import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { beforeAll, describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import { type InputEvent, takeCardChoice, takeDueInputs } from "../dev/inputLog";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  chooseCard,
  forkPoint,
  resumeSession,
  type RunStreams,
  runStreams,
  type Session,
  type SessionStep,
  startSession,
  stepSession,
  zoneStartPoint,
} from "../runner/session";
import { startRoad } from "../runner/walk";
import { encodeResume, launchWalk, type ResumeWalk } from "../save/resume";
import { checkpointOf } from "../save/runSlices";
import { newRun, type PackDogs, type RunState } from "../state/runState";
import { simConfig } from "../testing/sim";
import { simulateRun } from "./simulate";
import { SKILL_PRESETS } from "./skills";

const PACK: PackDogs = ["kilo", "lady"];
const CONFIG = simConfig(SKILL_PRESETS.typical, PACK, { gear: "fannyPack", policy: "mixed" });
// A walk that reaches zone 4 turns up within this many seeds.
const SEARCH_SEEDS_MOST = 40;

type Point = "fork" | "zoneStart";

// Where a walk was saved to resume, and how many of its logged inputs it had taken by then.
interface Saved {
  readonly next: number;
  readonly walk: ResumeWalk;
}

// Where a walk is saved: at point before zone index zone, or as that zone starts.
interface SaveAt {
  readonly point: Point;
  readonly zone: number;
}

// The save made at a save point, and the session as it was there when saved as a zone starts.
interface SavedAt {
  saved: Saved | undefined;
  sessionAt: Session | undefined;
}

// Plays session on from the logged inputs at next, as the game's replay does, and saves where it
// would resume from at each of saveAt.
function playOn(
  streams: RunStreams,
  inputs: readonly InputEvent[],
  start: { next: number; session: Session },
  saveAt: readonly SaveAt[] = [],
): { run: RunState; saves: SavedAt[] } {
  let { next, session } = start;
  const saves: SavedAt[] = saveAt.map(() => ({ saved: undefined, sessionAt: undefined }));
  const save = (point: Session) => ({
    next,
    walk: { draws: streams.draws(), seed: streams.seed, session: point },
  });
  while (session.walk.run.phase.kind !== "ended") {
    let step: SessionStep;
    if (session.card === null) {
      const due = takeDueInputs(inputs, next, session.timeMs);
      next = due.next;
      step = stepSession(gameData, streams, screenRoadGeometry, STEP_SECONDS, due.due, session);
    } else {
      const taken = takeCardChoice(inputs, next);
      if (taken.choice === undefined) {
        throw new Error(`No choice logged for ${session.card.title}`);
      }
      next = taken.next;
      step = chooseCard(gameData, streams, screenRoadGeometry, taken.choice, session);
    }
    const { run } = step.session.walk;
    for (const event of step.events) {
      for (const [index, { point, zone }] of saveAt.entries()) {
        const at = saves[index]!;
        if (at.saved !== undefined || run.zoneIndex !== zone) {
          continue;
        }
        if (point === "fork" && event.kind === "zoneEnded" && run.phase.kind !== "ended") {
          at.saved = save(forkPoint(step.session));
        } else if (point === "zoneStart" && event.kind === "zonePlanned") {
          at.saved = save(zoneStartPoint(step.session, event.unplanned));
          at.sessionAt = step.session;
        }
      }
    }
    session = step.session;
  }
  return { run: session.walk.run, saves };
}

// The first simulated walk that reaches zone 4, so every row can save it as zone 3 starts.
let reaching: { inputs: readonly InputEvent[]; run: RunState; seed: number } | undefined;
function walkReaching(): { inputs: readonly InputEvent[]; run: RunState; seed: number } {
  for (let seed = 1; seed <= SEARCH_SEEDS_MOST && reaching === undefined; seed++) {
    const result = simulateRun(gameData, seed, CONFIG);
    if (result.run.route.length >= 4) {
      reaching = { inputs: result.inputs, run: result.run, seed };
    }
  }
  if (reaching === undefined) {
    throw new Error(`no walk reaches zone 4 on ${SEARCH_SEEDS_MOST} seeds`);
  }
  return reaching;
}

// A walk saved between zones and resumed from its checkpoint, as the next launch does, plays the
// rest of the walk as the walk itself did: the run's streams take up where they were, each zone
// is planned from the seed as before, and transient movement timing starts fresh at the boundary.
describe("a walk resumed from its checkpoint", () => {
  const CASES: readonly { point: Point; zone: number }[] = [
    { point: "zoneStart", zone: 2 },
    { point: "fork", zone: 2 },
    { point: "zoneStart", zone: 3 },
  ];
  // The walk played once from its start in the game, saved at every case's point.
  let played: ReturnType<typeof playOn>;
  beforeAll(() => {
    const { inputs, seed } = walkReaching();
    const streams = runStreams(seed);
    const run = newRun(gameData, PACK.length, {
      dogs: PACK,
      gear: CONFIG.gear,
      walker: CONFIG.walker,
    });
    const session = startSession(gameData, streams, screenRoadGeometry, {
      road: startRoad(LANE_COUNT),
      run,
    });
    played = playOn(
      streams,
      inputs,
      { next: 0, session },
      CASES.map(({ point, zone }) => ({ point, zone: zone - 1 })),
    );
  }, 90_000);

  it.each(CASES.map((saveAt, index) => ({ ...saveAt, index })))(
    "plays on as the walk did, saved at the $point of zone $zone",
    ({ index, point, zone }) => {
      const found = walkReaching();
      const { inputs } = found;
      expect(played.run).toEqual(found.run);
      const { saved, sessionAt } = played.saves[index]!;
      if (saved === undefined) {
        throw new Error(`the walk was not saved at the ${point} of zone ${zone}`);
      }
      expect(saved.walk.session.debuffMovement).toBeNull();
      expect(saved.walk.session.walk.run.debuffs).toEqual([]);

      const checkpoint = {
        ...checkpointOf(gameData, saved.walk.session.walk.run),
        resume: encodeResume(gameData, saved.walk) ?? "",
      };
      const launched = launchWalk(gameData, true, checkpoint);
      if (launched.kind !== "resume") {
        throw new Error(`the walk did not resume: ${JSON.stringify(launched)}`);
      }
      const { walk } = launched;
      const resumedStreams = runStreams(walk.seed, walk.draws);
      const resumed = resumeSession(gameData, resumedStreams, screenRoadGeometry, walk.session);
      if (sessionAt !== undefined) {
        expect(resumed.session).toEqual(sessionAt);
      }
      const rest = playOn(resumedStreams, inputs, { next: saved.next, session: resumed.session });
      expect(rest.run).toEqual(found.run);
    },
  );
});
