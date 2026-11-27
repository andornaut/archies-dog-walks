import { gameData } from "../data/index.ts";
import { LANE_COUNT } from "../data/screen.ts";
import type { ZoneId } from "../data/types.ts";
import { newRun } from "../rules/newRun.ts";
import { screenRoadGeometry } from "../runner/screenGeometry.ts";
import {
  jumpToNeighbourhood,
  runStreams,
  unplannedStart,
  zoneStartPoint,
} from "../runner/walk/session.ts";
import { startRoad } from "../runner/walk/step.ts";
import { encodeResume, launchWalk } from "../save/resume.ts";
import { checkpointOf } from "../save/runSlices.ts";
import type { RunState } from "../state/runState.ts";

// A live neighbourhood switch from Cheats, as RunScene plays it: a walk midway along route
// (walking its last slot) switched to zone, the next zone it forks to, and the run a launch
// resumes from the checkpoint the switched zone's start saves. Planning is deferred, as for the
// page's planner, so no zone is planned.
export function liveSwitchRuns(
  route: readonly ZoneId[],
  zone: ZoneId,
  next: ZoneId,
): { readonly next: RunState; readonly resumed: RunState; readonly switched: RunState } {
  const run = {
    ...newRun(gameData, 3, { dogs: ["kilo", "lady"], gear: null, walker: "casey" }),
    route,
    zoneIndex: route.length - 1,
  };
  const walking = {
    ...unplannedStart({ road: startRoad(LANE_COUNT), run }),
    needsZonePlan: false,
  };
  const streams = runStreams(1);
  const { session } = jumpToNeighbourhood(
    gameData,
    streams,
    screenRoadGeometry,
    "deferred",
    LANE_COUNT,
    zone,
    walking,
  );
  const switched = session.walk.run;
  const resume = encodeResume(gameData, {
    draws: streams.draws(),
    seed: streams.seed,
    session: zoneStartPoint(session, session.walk),
  });
  if (!resume.ok) {
    throw new Error(resume.reason);
  }
  const launch = launchWalk(gameData, true, {
    ...checkpointOf(gameData, switched),
    resume: resume.value,
  });
  if (launch.kind !== "resume") {
    throw new Error(`The switched walk does not resume: ${JSON.stringify(launch)}`);
  }
  return {
    next: { ...switched, route: [...switched.route, next], zoneIndex: switched.zoneIndex + 1 },
    resumed: launch.walk.session.walk.run,
    switched,
  };
}
