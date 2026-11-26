import {
  sessionRead,
  sessionRemove,
  sessionWrite,
} from "@andornaut/game-kit/runtime/web/save/dom/pageSessionStore";

import { browserToolsOn, pageRunSetup } from "../../cheats/dom/index.ts";
import {
  type CardChoice,
  decodeInputLog,
  DEV_LAST_LOG_KEY,
  DEV_REPLAY_KEY,
  encodeInputLog,
  type InputEvent,
  type InputLog,
  NEXT_WALK_OFF,
  type NextWalk,
  nextWalkSetup,
  recordInput,
  replayInputs,
  type RunSetup,
  runSetupLimitsFor,
  startInputLog,
  takeCardChoice,
  takeDueInputs,
  WALK_CHEATS_OFF,
  type WalkCheats,
} from "../../cheats/index.ts";
import { gameData } from "../../data/index.ts";
import type { SessionInput } from "../../runner/index.ts";

// How a run starts: the cheats it plays by, its setup, and the inputs that drive it when it
// replays a log.
export interface RunStart {
  cheats: WalkCheats;
  replay: readonly InputEvent[] | undefined;
  setup: RunSetup;
}

// A replay log waiting in the session starts the next run from its setup and drives its inputs,
// with no cheats but the setup's Invincible owners; otherwise the page's URL sets the run up, with
// the next walk's cheats over it. Reading the log clears it. The installed app reads no log.
export function nextRunStart(next: NextWalk = NEXT_WALK_OFF): RunStart {
  const raw = browserToolsOn() ? sessionRead(DEV_REPLAY_KEY) : null;
  if (raw !== null) {
    sessionRemove(DEV_REPLAY_KEY);
    const decoded = decodeInputLog(runSetupLimitsFor(gameData), raw);
    if (decoded.ok) {
      const { setup } = decoded.log;
      return {
        cheats: { ...WALK_CHEATS_OFF, invincible: setup.invincible },
        replay: [...replayInputs(decoded.log)],
        setup,
      };
    }
    console.warn("Replay log rejected:", decoded.errors.join("; "));
  }
  const setup = nextWalkSetup(gameData, next, pageRunSetup().setup);
  return {
    cheats: { invincible: setup.invincible, speed: next.speed },
    replay: undefined,
    setup,
  };
}

// The run's cheat hooks: the input log it records and the replay that drives it.
export class RunRecorder {
  private inputLog: InputLog | undefined;
  private replay: { events: readonly InputEvent[]; next: number } | undefined;

  constructor(replay: readonly InputEvent[] | undefined) {
    this.replay = replay === undefined ? undefined : { events: replay, next: 0 };
  }

  start(setup: RunSetup): void {
    this.inputLog = startInputLog(setup);
  }

  // A live edit cannot be represented by the step and card inputs in a replay.
  abandon(): void {
    this.inputLog = undefined;
    this.replay = undefined;
  }

  replaying(): boolean {
    return this.replay !== undefined;
  }

  // The replayed step inputs due by timeMs, or undefined when the run is played live.
  due(timeMs: number): SessionInput[] | undefined {
    const replay = this.replay;
    if (replay === undefined) {
      return undefined;
    }
    const { due, next } = takeDueInputs(replay.events, replay.next, timeMs);
    replay.next = next;
    return due;
  }

  // The next replayed card choice, if a replay is driving the run, or "home" when the player
  // headed home from the card, as a fork card's End walk or the pause menu over a card does.
  cardChoice(): CardChoice | "home" | undefined {
    const replay = this.replay;
    if (replay === undefined) {
      return undefined;
    }
    if (replay.events[replay.next]?.kind === "home") {
      replay.next += 1;
      return "home";
    }
    const { choice, next } = takeCardChoice(replay.events, replay.next);
    replay.next = next;
    return choice;
  }

  log(event: InputEvent): void {
    if (this.inputLog !== undefined) {
      this.inputLog = recordInput(event, this.inputLog);
    }
  }

  // The finished run's log, kept for the tab under DEV_LAST_LOG_KEY.
  save(): void {
    if (this.inputLog !== undefined) {
      sessionWrite(DEV_LAST_LOG_KEY, encodeInputLog(this.inputLog));
    }
  }
}
