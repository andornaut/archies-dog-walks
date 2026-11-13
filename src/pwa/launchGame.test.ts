import type { LaunchResult } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { describe, expect, it, vi } from "vitest";

import { launchGame } from "./launchGame.ts";

describe("launchGame", () => {
  it.each(["blocked", "continue", "reloading"] as const)(
    "keeps save edits and game boot behind the %s launch decision",
    async (result) => {
      let resolveLaunch!: (result: LaunchResult) => void;
      let resolveSave!: () => void;
      const launch = new Promise<LaunchResult>((resolve) => {
        resolveLaunch = resolve;
      });
      const save = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const prepare = vi.fn(() => save);
      const boot = vi.fn();
      const started = launchGame(prepare, boot, launch);
      expect(prepare).not.toHaveBeenCalled();
      expect(boot).not.toHaveBeenCalled();
      resolveLaunch(result);
      await Promise.resolve();
      expect(prepare).toHaveBeenCalledTimes(result === "reloading" ? 0 : 1);
      expect(boot).not.toHaveBeenCalled();
      resolveSave();
      await started;
      expect(boot).toHaveBeenCalledTimes(result === "reloading" ? 0 : 1);
    },
  );
});
