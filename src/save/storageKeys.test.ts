import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEV_CHEATS_KEY,
  DEV_LAST_LOG_KEY,
  DEV_REPLAY_KEY,
  DEV_SAVE_EDITS_KEY,
} from "../dev/devPanelModel.ts";
import { INSTALL_NUDGE_KEY } from "../pwa/installNudge.ts";
import { SETTINGS_KEYS } from "./settings.ts";
import { EARNED_KEYS, RESUME_BACKUP_KEY, SAVE_KEYS } from "./storage.ts";

const SRC = new URL("../", import.meta.url);

// Every storage key the game names: the game's name, a dot, then the key in kebab case.
const DOTTED = /^archies-dog-walks\.[a-z]+(?:-[a-z]+)*$/u;

describe("storage keys", () => {
  it.each([
    ...Object.values(SAVE_KEYS),
    ...Object.values(EARNED_KEYS),
    ...Object.values(SETTINGS_KEYS),
    DEV_CHEATS_KEY,
    DEV_LAST_LOG_KEY,
    DEV_REPLAY_KEY,
    DEV_SAVE_EDITS_KEY,
    INSTALL_NUDGE_KEY,
    RESUME_BACKUP_KEY,
  ])("%s takes the dotted style", (key) => {
    expect(key).toMatch(DOTTED);
  });

  // A source scan, so a key named outside the constants above is caught too.
  it("are never named in the colon style in src/", () => {
    const files = readdirSync(SRC, { recursive: true, withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
    );
    const colon = files.flatMap((entry) => {
      const path = `${entry.parentPath}/${entry.name}`;
      return [...readFileSync(path, "utf8").matchAll(/["'`]archies-dog-walks:[^"'`]*/gu)].map(
        ([found]) => `${path.slice(SRC.pathname.length)}: ${found}`,
      );
    });
    expect(files.length).toBeGreaterThan(0);
    expect(colon).toEqual([]);
  });
});
