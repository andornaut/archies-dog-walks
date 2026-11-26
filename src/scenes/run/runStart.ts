import { type Random, randomStream } from "@andornaut/game-kit/runtime/random";

import { WALK_CHEATS_OFF } from "../../cheats/cheats.ts";
import type { RunSetup } from "../../cheats/runSetup.ts";
import { loadoutFor } from "../../cheats/setupRun.ts";
import type { DogId } from "../../data/ids.ts";
import type { ResumeWalk } from "../../save/resume.ts";
import type { Loadout, PackDogs } from "../../state/index.ts";
import type { RunSceneData } from "../RunScene.ts";
import type { RunStart } from "./runRecorder.ts";

// The streams only the run's views draw from, each named from the setup's seed beside the
// session's own (runStreams).
export interface RunRandom {
  ambient: Random;
  distractions: Random;
  quips: Random;
}

export function runRandom(seed: number): RunRandom {
  return {
    ambient: randomStream(seed, "ambient"),
    distractions: randomStream(seed, "distractions"),
    quips: randomStream(seed, "quips"),
  };
}

// What a walk's starter picked: the loadout and the dog slots owned.
export interface RunPick {
  dogSlots: number;
  loadout: Loadout;
}

// The walk a pick starts: start's setup, with its pack, gear and walker over the pick and a slot
// for each dog its pack names.
export function runSceneData(start: RunStart, pick: RunPick): RunSceneData {
  const { cheats, replay, setup } = start;
  const typed = setup as RunSetup<DogId, never>;
  return {
    cheats,
    dogSlots: Math.max(pick.dogSlots, pick.loadout.dogs.length, typed.pack?.length ?? 0),
    loadout: loadoutFor(pick.loadout, setup as Parameters<typeof loadoutFor>[1]),
    replay,
    setup,
  };
}

// The walk a launch resumes: its own pack, gear, walker, seed and road speed, its setup at the
// zone it resumes in, no cheats and no replay. dev keeps the page's dev mode.
export function resumedRunSceneData(dev: boolean, resume: ResumeWalk): RunSceneData {
  const { road, run } = resume.session.walk;
  const dogs = run.pack.map(({ dog }) => dog) as readonly DogId[] as PackDogs;
  return {
    cheats: WALK_CHEATS_OFF,
    dogSlots: dogs.length,
    loadout: { dogs, gear: run.gear, walker: run.walker },
    replay: undefined,
    resume,
    setup: {
      dev,
      invincible: false,
      seed: resume.seed,
      speed: road.speedFactor,
      zone: run.zoneIndex + 1,
    },
  };
}
