import { describe, expect, it } from "vitest";

import { reportRequiredUpdate, requiredUpdateProgress } from "./requiredUpdate.ts";

function active(): boolean {
  let shown = false;
  requiredUpdateProgress.subscribe(({ active: on }) => {
    shown = on;
  })();
  return shown;
}

describe("reportRequiredUpdate", () => {
  it.each([
    { shown: true, states: ["updating"] },
    { shown: false, states: ["unavailable"] },
    { shown: false, states: ["updating", "unavailable"] },
    { shown: true, states: ["unavailable", "updating"] },
  ] as const)("shows the loading line after $states: $shown", ({ shown, states }) => {
    for (const state of states) {
      reportRequiredUpdate(state);
    }
    expect(active()).toBe(shown);
    reportRequiredUpdate("unavailable");
  });
});
