import type { LaunchResult } from "./launch.ts";

// The launch decides before the game's modules load: "reloading" means another document takes
// over, so this one never reads or writes a save or constructs Phaser.
export async function launchGame(
  launch: Promise<LaunchResult>,
  start: () => Promise<void>,
): Promise<void> {
  if ((await launch) !== "reloading") {
    await start();
  }
}
