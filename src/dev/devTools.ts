// Browser tabs offer development tools; installed app windows play as shipped.
import { runsInAppWindow } from "@andornaut/game-kit/web/pwa/appWindow";
import { INSTALLED_APP_DISPLAY_QUERY } from "@andornaut/game-kit/web/pwa/backNavigation";

// The global that holds the game when dev=1, for the console and headless checks.
export const DEV_GAME_GLOBAL = "archiesDogWalksGame";

export function devToolsOn(): boolean {
  return !runsInAppWindow(globalThis.window);
}

// Recheck restored pages and foregrounded windows as well as display-mode changes.
export function watchDevTools(listener: (on: boolean) => void): () => void {
  const mode = window.matchMedia(INSTALLED_APP_DISPLAY_QUERY);
  const update = () => listener(devToolsOn());
  mode.addEventListener("change", update);
  window.addEventListener("pageshow", update);
  document.addEventListener("visibilitychange", update);
  update();
  return () => {
    mode.removeEventListener("change", update);
    window.removeEventListener("pageshow", update);
    document.removeEventListener("visibilitychange", update);
  };
}

// Installed app windows read no run setup from their URL.
export function pageSearch(): string {
  return devToolsOn() ? globalThis.location.search : "";
}
