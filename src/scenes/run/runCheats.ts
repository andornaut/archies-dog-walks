import { finishZone, type WalkCheat, walkCheat } from "../../cheats/index.ts";
import type { ZoneId } from "../../data/ids.ts";
import { gameData, LANE_COUNT } from "../../data/index.ts";
import { currentZoneId } from "../../rules/index.ts";
import {
  awaitsZonePlan,
  jumpToNeighbourhood,
  planZoneFromSeed,
  type RunStreams,
  screenRoadGeometry,
  type Session,
  type SessionStep,
  type Walk,
  withZonePlan,
} from "../../runner/index.ts";
import type { RunState } from "../../state/index.ts";

export function liveCheatRun(session: Session | undefined): RunState | undefined {
  const run = session?.walk.run;
  return run?.phase.kind === "ended" ? undefined : run;
}

export function activeCheatsOf(
  session: Session | undefined,
): { readonly invincible: boolean; readonly zone: ZoneId } | undefined {
  const run = liveCheatRun(session);
  return run === undefined
    ? undefined
    : { invincible: run.invincible ?? false, zone: currentZoneId(gameData, run) };
}

// A cheat edits the planned walk even if the planner worker still owes its answer.
export function cheatZonePlan(
  streams: RunStreams | undefined,
  session: Session,
): Session | undefined {
  if (streams === undefined || !awaitsZonePlan(session)) {
    return undefined;
  }
  const planned = planZoneFromSeed(gameData, screenRoadGeometry, streams.seed, session.walk);
  return withZonePlan(session, planned);
}

export function cheatZoneJump(streams: RunStreams, zone: ZoneId, session: Session): SessionStep {
  return jumpToNeighbourhood(
    gameData,
    streams,
    screenRoadGeometry,
    "deferred",
    LANE_COUNT,
    zone,
    session,
  );
}

export function applyWalkCheat(cheat: WalkCheat, walk: Walk): Walk {
  return cheat.kind === "finishZone"
    ? finishZone(gameData, walk)
    : { ...walk, run: walkCheat(gameData, cheat, walk.run) };
}
