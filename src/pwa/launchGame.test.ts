import { describe, expect, it, vi } from "vitest";

import type { LaunchResult } from "./launch.ts";
import { launchGame } from "./launchGame.ts";

describe("launchGame", () => {
  it.each<[LaunchResult, number]>([
    ["play", 1],
    ["reloading", 0],
  ])("keeps the game's start behind the %s launch decision", async (result, starts) => {
    let resolveLaunch!: (result: LaunchResult) => void;
    const launch = new Promise<LaunchResult>((resolve) => {
      resolveLaunch = resolve;
    });
    const start = vi.fn(() => Promise.resolve());
    const started = launchGame(launch, start);
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    resolveLaunch(result);
    await started;
    expect(start).toHaveBeenCalledTimes(starts);
  });
});
