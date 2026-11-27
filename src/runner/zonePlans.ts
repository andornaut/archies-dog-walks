import { gameData } from "../data/index.ts";
import { screenRoadGeometry } from "./screenGeometry.ts";
import { planZoneFromSeed } from "./walk/session.ts";
import type { Walk } from "./walk/step.ts";

// What the zone planner's worker (zonePlanWorker.ts) is asked and answers, kept apart from the
// page's planner (zonePlanner.ts) and the browser adapter that starts the worker.

// A request to plan the current zone of walk from seed, and its answer: the planned walk, or the
// planner's error message.
export interface ZonePlanRequest {
  readonly id: number;
  readonly seed: number;
  readonly walk: Walk;
}

export type ZonePlanAnswer =
  { readonly error: string; readonly id: number } | { readonly id: number; readonly walk: Walk };

// The worker's answer to request: the zone planned on the game's screen, as a step plans it.
export function answerZonePlan(request: ZonePlanRequest): ZonePlanAnswer {
  try {
    const walk = planZoneFromSeed(gameData, screenRoadGeometry, request.seed, request.walk);
    return { id: request.id, walk };
  } catch (error) {
    return { error: String(error), id: request.id };
  }
}
