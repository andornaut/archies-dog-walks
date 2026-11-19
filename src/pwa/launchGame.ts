import type { LaunchResult } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";

// A staged launch takes control before this bundle reads or writes saves or constructs Phaser.
export async function launchGame(
  boot: () => unknown,
  launch: Promise<LaunchResult>,
): Promise<void> {
  if ((await launch) !== "reloading") {
    boot();
  }
}
