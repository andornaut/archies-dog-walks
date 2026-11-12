import { describe, expect, it } from "vitest";

import { offlineProgress, reportOfflineActivity } from "./offlineProgress.ts";

function active(): boolean {
  let shown = false;
  offlineProgress.subscribe(({ active: on }) => {
    shown = on;
  })();
  return shown;
}

describe("reportOfflineActivity", () => {
  it.each([
    { activities: ["precaching"], shown: true },
    { activities: ["updating"], shown: false },
    { activities: ["precaching", "idle"], shown: false },
    { activities: ["precaching", "updating"], shown: false },
  ] as const)("shows the line after $activities: $shown", ({ activities, shown }) => {
    for (const activity of activities) {
      reportOfflineActivity(activity);
    }
    expect(active()).toBe(shown);
    reportOfflineActivity("idle");
  });
});
