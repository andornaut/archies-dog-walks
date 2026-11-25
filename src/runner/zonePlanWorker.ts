import { answerZonePlan, type ZonePlanRequest } from "./zonePlans.ts";

// The zone planner's module worker (pageZonePlanner): answers each request in turn.
globalThis.addEventListener("message", (event: MessageEvent<ZonePlanRequest>) => {
  globalThis.postMessage(answerZonePlan(event.data));
});
