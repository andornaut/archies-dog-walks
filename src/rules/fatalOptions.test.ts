import { fillNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { CardSource, DogId } from "../data/types.ts";
import { testState } from "../testing/runState.ts";
import { TEST_TUNING } from "../testing/tuning.ts";
import { firedByText } from "./causes.ts";
import { cardFor, firesText } from "./choices.ts";

const data = { ...gameData, tuning: TEST_TUNING };
// Skunk's hearts option, its name, and what it costs each owner.
const SKUNK_OPTIONS = (() => {
  const { resolution } = gameData.encounters.skunk;
  return resolution.kind === "card" ? resolution.options : [];
})();
const HOLD_YOUR_NOSE = SKUNK_OPTIONS.findIndex(({ effects }) =>
  effects.some((effect) => effect.kind === "hearts"),
);
const NOSE_NAME = SKUNK_OPTIONS[HOLD_YOUR_NOSE]?.name;
const NOSE_EFFECT = (() => {
  const effect = SKUNK_OPTIONS[HOLD_YOUR_NOSE]?.effects.find(({ kind }) => kind === "hearts");
  return effect?.kind === "hearts" ? -effect.amount : 0;
})();
const owner = (dog: DogId) => gameData.dogs[dog].owner.name;

const skunk = (affected: DogId[]): CardSource => ({
  affected,
  encounter: "skunk",
  kind: "encounter",
});

describe("an option that would fire an owner", () => {
  // The option with the meter landing on 0, and left above it.
  it("flags each option that can fire an owner, saying who fires you in plain words", () => {
    const nose = (hearts: number) =>
      cardFor(data, testState({ kilo: hearts }), skunk(["kilo"])).options.find(
        ({ index }) => index === HOLD_YOUR_NOSE,
      );
    expect(nose(NOSE_EFFECT + 1)?.fires).toEqual([]);
    const option = nose(NOSE_EFFECT);
    expect(option?.fires).toEqual(["kilo"]);
    // Not as a meter held at 0.
    expect(option?.breakdown.map(({ dog, name, text }) => [dog, text, name])).toEqual([
      ["kilo", `−${NOSE_EFFECT}♥`, NOSE_NAME],
      ["kilo", "", firedByText(data, "kilo")],
    ]);
  });
});

describe("firesText", () => {
  it("names each fatal option", () => {
    const [kilo, ginger, lady] = [owner("kilo"), owner("ginger"), owner("lady")];
    for (const { dogs, owners } of [
      { dogs: ["kilo"], owners: kilo },
      { dogs: ["kilo", "ginger"], owners: `${kilo} and ${ginger}` },
      { dogs: ["kilo", "ginger", "lady"], owners: `${kilo}, ${ginger} and ${lady}` },
    ] as const) {
      expect(firesText(data, dogs)).toBe(fillNames(gameData.runText.card.fires, { owners }));
    }
  });
});
