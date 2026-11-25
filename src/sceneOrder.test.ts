import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

// The scenes as main.ts lists them, the order they draw in.
const LISTED =
  /scene: \[([^\]]*)\]/
    .exec(readFileSync(new URL("main.ts", import.meta.url), "utf8"))?.[1]
    ?.split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "") ?? [];
const HELP = [
  "HelpScene",
  "HelpPictureScene",
  "new HudScene(SCENE_KEYS.helpHud)",
  "new CardScene(SCENE_KEYS.helpCard)",
];

// A modal over help, or over a page its Menu opens, dims all of it once, its canvas page and
// pictures included: the modal's
// canvas dim draws after help and the picture scenes.
it.each(["CheatsScene", "MenuScene", "SettingsScene"])(
  "lists %s after help and its pictures",
  (modal) => {
    const at = (entry: string) => LISTED.indexOf(entry);
    expect(HELP.map(at)).not.toContain(-1);
    expect(HELP.filter((entry) => at(entry) > at(modal))).toEqual([]);
  },
);
