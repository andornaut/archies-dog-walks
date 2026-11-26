import { type ZonePlanAnswer, type ZonePlanner, zonePlanner, type ZonePlanPort } from "../index.ts";

// The module worker that answers requests (zonePlanWorker.ts), or undefined where the page cannot
// start one.
function workerPort(): ZonePlanPort | undefined {
  if (typeof Worker === "undefined") {
    return undefined;
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL("./zonePlanWorker.ts", import.meta.url), { type: "module" });
  } catch (error) {
    console.warn("Zone planner: planning on the page without a worker", error);
    return undefined;
  }
  return {
    listen: (answer, fail) => {
      worker.addEventListener("message", (event: MessageEvent<ZonePlanAnswer>) => {
        answer(event.data);
      });
      worker.addEventListener("messageerror", fail);
      worker.addEventListener("error", (event) => {
        console.warn("Zone planner: the worker failed; planning on the page", event.message);
        fail();
      });
    },
    post: (request) => {
      worker.postMessage(request);
    },
  };
}

let pagePlanner: ZonePlanner | undefined;

// The page's one zone planner, its worker started on the first call.
export function pageZonePlanner(): ZonePlanner {
  pagePlanner ??= zonePlanner(workerPort());
  return pagePlanner;
}
