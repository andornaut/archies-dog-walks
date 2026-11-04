import { describe, expect, it } from "vitest";

import type { DogId, EncounterId } from "../data/types.ts";
import type { RunState } from "../state/runState.ts";
import { testState } from "../testing/runState.ts";
import { affectedDogs, opensCard } from "./encounters.ts";

const pack = testState({ ginger: 5, kilo: 5, pepe: 5 });
const everyDog: DogId[] = ["ginger", "kilo", "pepe"];

describe("affectedDogs", () => {
  it("classifies each encounter", () => {
    for (const [, state, affected] of [
      ["every walking dog", pack, everyDog],
      ["no fired dog", testState({ ginger: 5, kilo: "fired", pepe: 5 }), ["ginger", "pepe"]],
    ] satisfies readonly [string, RunState, DogId[]][]) {
      expect(affectedDogs(state)).toEqual(affected);
    }
  });
});

describe("opensCard", () => {
  it("opens each encounter's card or applies it", () => {
    for (const [, id, affected, state, opens] of [
      ["no card with no dog affected", "squirrel", [], pack, false],
      ["a thief card for the pack", "thief", everyDog, pack, true],
      [
        "no card for an encounter the pack is immune to",
        "thief",
        ["ginger"],
        testState(
          { ginger: 5 },
          {
            immunities: [{ encounter: "thief", source: { kind: "upgrade", upgrade: "raincoats" } }],
          },
        ),
        false,
      ],
    ] satisfies readonly [string, EncounterId, DogId[], RunState, boolean][]) {
      expect(opensCard(affected, state, id)).toBe(opens);
    }
  });
});
