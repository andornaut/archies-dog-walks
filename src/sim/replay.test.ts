import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { beforeAll, describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { LANE_COUNT } from "../data/screen.ts";
import type { GearId } from "../data/types.ts";
import {
  decodeInputLog,
  encodeInputLog,
  type InputLog,
  replayInputs,
  takeCardChoice,
  takeDueInputs,
} from "../dev/inputLog.ts";
import { runSetupLimitsFor } from "../dev/pageRunSetup.ts";
import { loadoutFor, withSetupStart } from "../dev/setupRun.ts";
import { screenRoadGeometry } from "../runner/screenGeometry.ts";
import { chooseCard, runStreams, startSession, stepSession } from "../runner/session.ts";
import { startRoad } from "../runner/walk.ts";
import { newRun, type RunState } from "../state/runState.ts";
import { simConfig } from "../testing/sim.ts";
import type { PolicyId } from "./policies.ts";
import { simulateRun } from "./simulate.ts";
import { SKILL_PRESETS, type SkillPresetId } from "./skills.ts";

// The run scene's replay, without the scene: the run started from the log's setup, each step's
// inputs taken as they fall due, and each card's choice taken as it opens.
function replay(log: InputLog): RunState {
  const { setup } = log;
  // As the run scene reads it, over a saved pick the setup replaces.
  const typed = setup as Parameters<typeof loadoutFor>[1];
  const loadout = loadoutFor(
    { dogs: ["ginger"], gear: null, walker: gameData.defaultWalker },
    typed,
  );
  const run = withSetupStart(gameData, setup, newRun(gameData, loadout.dogs.length, loadout));
  const streams = runStreams(setup.seed);
  const road = startRoad(LANE_COUNT, setup.speed);
  let session = startSession(gameData, streams, screenRoadGeometry, { road, run });
  const events = [...replayInputs(log)];
  let next = 0;
  while (session.walk.run.phase.kind !== "ended") {
    if (session.card === null) {
      const due = takeDueInputs(events, next, session.timeMs);
      next = due.next;
      session = stepSession(
        gameData,
        streams,
        screenRoadGeometry,
        STEP_SECONDS,
        due.due,
        session,
      ).session;
    } else {
      const taken = takeCardChoice(events, next);
      if (taken.choice === undefined) {
        throw new Error(`No choice logged for ${session.card.title}`);
      }
      next = taken.next;
      session = chooseCard(gameData, streams, screenRoadGeometry, taken.choice, session).session;
    }
  }
  return session.walk.run;
}

// A search simulates walks a seed at a time from a row's seed and replays the first that stores and
// spends at least the row's spare treats, so a tuning change that leaves one seed spending fewer
// takes a later one rather than failing, and fails only when the most seeds it simulates turn up
// none.
const SEARCH_SEEDS_MOST = 40;

interface ReplayRow {
  readonly gear: GearId | null;
  readonly pack: string;
  readonly policy: PolicyId;
  readonly seed: number;
  readonly skill: SkillPresetId;
  readonly spares: number;
}

interface Recorded {
  readonly log: InputLog;
  readonly result: ReturnType<typeof simulateRun>;
}

// The row's first qualifying simulated walk, with its seed and inputs written as the game's input
// log and read back as the dev panel reads a replay.
function record(row: ReplayRow): Recorded {
  const { gear, pack, policy, skill, spares } = row;
  const dogs = pack.split(",") as [never];
  const config = simConfig(SKILL_PRESETS[skill], dogs, {
    gear,
    policy,
    walker: gameData.defaultWalker,
  });
  let found: { result: ReturnType<typeof simulateRun>; seed: number } | undefined;
  for (let seed = row.seed; seed < row.seed + SEARCH_SEEDS_MOST && found === undefined; seed++) {
    const result = simulateRun(gameData, seed, config);
    if (result.planningFailure !== undefined) {
      throw new Error(`Simulation failed before replay: ${result.planningFailure.message}`);
    }
    expect(result.run.phase.kind).toBe("ended");
    const { spent, stored } = result.run.spareTreats;
    if (Math.min(stored, spent) >= spares) {
      found = { result, seed };
    }
  }
  if (found === undefined) {
    throw new Error(
      `no walk stores and spends ${spares} spare treats on ${SEARCH_SEEDS_MOST} seeds from ${row.seed}`,
    );
  }
  const { result, seed } = found;
  const log: InputLog = {
    events: result.inputs,
    setup: {
      dev: false,
      gear,
      pack: dogs,
      seed,
      speed: 1,
      walker: gameData.defaultWalker,
      zone: 1,
    },
  };
  const decoded = decodeInputLog(runSetupLimitsFor(gameData), encodeInputLog(log));
  if (!decoded.ok) {
    throw new Error(decoded.errors.join("; "));
  }
  return { log: decoded.log, result };
}

// A simulated run's seed and inputs, written as the game's input log and read back as the dev
// panel reads a replay, play the same run in the game's replay. Each row simulates its walk in a
// hook and replays it in its test, so neither holds more than one walk's work.
describe("a simulated run", { timeout: 60_000 }, () => {
  // spares is how many spare treats the walk stores and spends at least, which the replay matches.
  describe.each<ReplayRow>([
    { gear: null, pack: "kilo,lady", policy: "mixed", seed: 1, skill: "typical", spares: 0 },
    {
      gear: null,
      pack: "buddy,archie,sequoia",
      policy: "alwaysPay",
      seed: 3,
      skill: "novice",
      spares: 0,
    },
    {
      gear: "fannyPack",
      pack: "kilo,lady",
      policy: "mixed",
      seed: 1,
      skill: "novice",
      spares: 1,
    },
  ])("$skill, $pack, $gear, from seed $seed", (row) => {
    let recorded: Recorded;
    beforeAll(() => {
      recorded = record(row);
    }, 60_000);

    it("replays in the game", () => {
      expect(recorded.result.inputs.length).toBeGreaterThan(0);
      expect(replay(recorded.log)).toEqual(recorded.result.run);
    });
  });
});
