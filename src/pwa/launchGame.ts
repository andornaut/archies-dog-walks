import type { LaunchResult } from "./launch.ts";

// The launch decides before the game's modules load: "reloading" means another document takes
// over. An unsupported browser stops here as well, before save access or Phaser.
export async function launchGame(
  launch: Promise<LaunchResult | "unsupported">,
  start: () => Promise<void>,
): Promise<void> {
  if ((await launch) === "play") {
    await start();
  }
}
