import { gameData } from "../data/index.ts";
import { screenRoadGeometry } from "./screenGeometry.ts";
import { planZoneFromSeed } from "./walk/session.ts";
import type { Walk } from "./walk/step.ts";
import type { ZonePlanAnswer, ZonePlanRequest } from "./zonePlans.ts";

// Plans the walk's zones in a worker, so the page keeps painting and answering input while a
// zone is planned. The worker plans as a step does (planZoneFromSeed), from the seed and the walk
// copied to it, so its plan is the plan the page would make. Without a worker, or once it fails,
// the page plans here; a planner error then throws here, with its evidence, as a step's does.

// A worker's two ends as the planner uses them: requests go out by post, and listen hears each
// answer, or that the worker failed to load or to copy a message.
export interface ZonePlanPort {
  listen(answer: (answer: ZonePlanAnswer) => void, fail: () => void): void;
  post(request: ZonePlanRequest): void;
}

export interface ZonePlanner {
  // Plans walk's current zone from seed and calls planned with the walk, unless a later request
  // came first: the latest request wins, and an earlier one still planning or waiting is dropped.
  plan(seed: number, walk: Walk, planned: (walk: Walk) => void): void;
}

interface Job {
  readonly planned: (walk: Walk) => void;
  readonly request: ZonePlanRequest;
}

// A planner that sends one request at a time through port, or plans here without one.
export function zonePlanner(port: ZonePlanPort | undefined): ZonePlanner {
  let ids = 0;
  let working = port !== undefined;
  let running: Job | undefined;
  let waiting: Job | undefined;
  const planHere = ({ planned, request }: Job) => {
    planned(planZoneFromSeed(gameData, screenRoadGeometry, request.seed, request.walk));
  };
  const send = (job: Job) => {
    running = job;
    port?.post(job.request);
  };
  port?.listen(
    (answer) => {
      const job = running;
      if (job === undefined || answer.id !== job.request.id) {
        return;
      }
      running = undefined;
      const next = waiting;
      waiting = undefined;
      if (next !== undefined) {
        send(next);
      } else if ("walk" in answer) {
        job.planned(answer.walk);
      } else {
        planHere(job);
      }
    },
    () => {
      working = false;
      const latest = waiting ?? running;
      running = undefined;
      waiting = undefined;
      if (latest !== undefined) {
        planHere(latest);
      }
    },
  );
  return {
    plan(seed, walk, planned) {
      ids += 1;
      const job = { planned, request: { id: ids, seed, walk } };
      if (!working) {
        planHere(job);
      } else if (running === undefined) {
        send(job);
      } else {
        waiting = job;
      }
    },
  };
}
