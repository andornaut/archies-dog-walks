import type { DogId, GearId, WalkerId } from "../../data/ids.ts";
import { gameData } from "../../data/index.ts";
import {
  homeRunSetup,
  type ParsedRunSetup,
  parseRunSetup,
  runSetupLimitsFor,
  stripRunOverrides,
} from "../index.ts";
import { browserToolsOn, pageSearch } from "./browserTools.ts";
import { randomSeed } from "./randomSeed.ts";

let parsed: ParsedRunSetup<DogId, GearId, WalkerId> | undefined;
let appParsed: ParsedRunSetup<DogId, GearId, WalkerId> | undefined;

// The setup in this page's URL, parsed on first use and kept for the page's life, so every
// scene sees the same random seed when the URL has none. Warnings go to the console. The
// installed app reads no setup from its URL.
export function pageRunSetup(): ParsedRunSetup<DogId, GearId, WalkerId> {
  if (!browserToolsOn()) {
    appParsed ??= parseRunSetup(runSetupLimitsFor(gameData), randomSeed, "");
    return appParsed;
  }
  if (parsed === undefined) {
    parsed = parseRunSetup(runSetupLimitsFor(gameData), randomSeed, pageSearch());
    parsed.warnings.forEach((warning) => console.warn(`Run setup: ${warning}`));
  }
  return parsed;
}

// Called when the player is home: the URL's run overrides applied to the walk they started, so
// they leave the URL and the page's setup, and the start screen's picks decide the next walk.
export function clearRunOverrides(): void {
  const current = pageRunSetup();
  parsed = {
    setup: homeRunSetup(current.setup, randomSeed()),
    warnings: [],
  };
  const href = globalThis.location.href;
  const stripped = stripRunOverrides(href, false);
  if (stripped !== href) {
    globalThis.history.replaceState(globalThis.history.state, "", stripped);
  }
}
