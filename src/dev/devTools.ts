// Browser tabs offer development tools; installed app windows play as shipped.
import { runsInAppWindow } from "@andornaut/game-kit/runtime/web/pwa/appWindow";

// The global that holds the game when dev=1, for the console and headless checks.
export const DEV_GAME_GLOBAL = "archiesDogWalksGame";

export function devToolsOn(): boolean {
  return !runsInAppWindow(globalThis.window);
}

// Installed app windows read no run setup from their URL.
export function pageSearch(): string {
  return devToolsOn() ? globalThis.location.search : "";
}
