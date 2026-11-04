import { fillLine, fillNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { maxHearts, placeInPack } from "../rules/dogs.ts";
import { testState } from "../testing/runState.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { explainDetail } from "./explain.ts";
import { RUN_TEXT_FIELDS } from "./runText.ts";
import type { ExplainTarget } from "./walkHud.ts";

// Kilo walks at 2 hearts with Lucky collar in the Pocket, a Whistle found, the Raincoats upgrade
// in effect and Muddy on the pack: the effects are the walker's perk, the Pocket's gear, the found
// gear, then the upgrade.
const run = testState(
  { kilo: 2 },
  {
    debuffs: [{ debuff: "muddy", secondsLeft: 9.2 }],
    foundGear: "whistle",
    gear: "luckyCollar",
    immunities: [{ encounter: "puddle", source: { kind: "upgrade", upgrade: "raincoats" } }],
    upgradesPicked: ["raincoats"],
  },
);
const text = gameData.runText.explain;
const kilo = gameData.dogs.kilo;

describe("explainDetail", () => {
  it.each<[string, ExplainTarget, { kind: string; status?: string; title: string } | undefined]>([
    [
      "the walker's perk as its walker",
      { effect: 0, kind: "effect" },
      { kind: "walker", title: gameData.walkers[run.walker].name },
    ],
    [
      "gear as the home screen's gear card",
      { effect: 1, kind: "effect" },
      { kind: "gear", title: gameData.shopGear.luckyCollar.name },
    ],
    [
      "found gear as its gear card, named and marked found",
      { effect: 2, kind: "effect" },
      {
        kind: "gear",
        status: text.foundStatus,
        title: fillNames(gameData.runText.foundGear, { gear: gameData.shopGear.whistle.name }),
      },
    ],
    [
      "an upgrade with its status",
      { effect: 3, kind: "effect" },
      { kind: "gear", status: text.upgradeStatus, title: gameData.upgrades.raincoats.name },
    ],
    [
      "a debuff with its status",
      { debuff: "muddy", kind: "debuff" },
      { kind: "gear", status: text.debuffStatus, title: gameData.debuffs.muddy.name },
    ],
    [
      "a dog with its owner's hearts now as its status",
      { dog: "kilo", kind: "dog" },
      {
        kind: "dog",
        status: fillLine(RUN_TEXT_FIELDS.explain, text, "dogHearts", {
          hearts: "2",
          max: String(maxHearts(gameData.tuning, run.modifiers, placeInPack(run, "kilo"), kilo)),
        }),
        title: kilo.name,
      },
    ],
    ["nothing for an effect past the walk's", { effect: 4, kind: "effect" }, undefined],
    ["nothing for a debuff that wore off", { debuff: "stinky", kind: "debuff" }, undefined],
    ["nothing for a dog not in the pack", { dog: "lady", kind: "dog" }, undefined],
  ])("shows %s", (_name, target, expected) => {
    const detail = explainDetail(gameData, newPlayerSave, run, target);
    expect(
      detail === undefined
        ? undefined
        : {
            kind: detail.kind,
            title: detail.card.title,
            ...(expected?.status === undefined ? {} : { status: detail.card.status }),
          },
    ).toEqual(expected);
  });

  it("fills the debuff's stake with its whole seconds left", () => {
    const detail = explainDetail(gameData, newPlayerSave, run, { debuff: "muddy", kind: "debuff" });
    expect(detail?.card.lines.join(" ").toLowerCase()).toContain(
      fillNames(gameData.debuffs.muddy.stake, { seconds: "10" }).toLowerCase(),
    );
  });
});
