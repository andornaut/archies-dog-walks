import type { LaunchResult } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";
import { describe, expect, it, vi } from "vitest";

import { launchGame } from "./launchGame.ts";

describe("launchGame", () => {
  it.each(["blocked", "continue", "reloading"] as const)(
    "keeps game boot behind the %s launch decision",
    async (result) => {
      let resolveLaunch!: (result: LaunchResult) => void;
      const launch = new Promise<LaunchResult>((resolve) => {
        resolveLaunch = resolve;
      });
      const boot = vi.fn();
      const started = launchGame(boot, launch);
      expect(boot).not.toHaveBeenCalled();
      resolveLaunch(result);
      await started;
      expect(boot).toHaveBeenCalledTimes(result === "reloading" ? 0 : 1);
    },
  );
});
