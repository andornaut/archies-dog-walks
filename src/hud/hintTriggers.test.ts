import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { EncounterId, HintId } from "../data/types.ts";
import { hintFor } from "../rules/hints.ts";
import { testState } from "../testing/runState.ts";
import { atPack, step, walkWith } from "../testing/walk.ts";
import {
  cardHintTriggers,
  moverHintTriggers,
  runHintTriggers,
  startHintTriggers,
  stepHintTriggers,
} from "./hintTriggers.ts";

describe("cardHintTriggers", () => {
  it("raises the fork hint for a fork, and the encounter's and the card's for an encounter", () => {
    expect(cardHintTriggers({ kind: "fork", paths: [], upgrades: [] })).toEqual([{ kind: "fork" }]);
    expect(cardHintTriggers({ affected: ["kilo"], encounter: "skunk", kind: "encounter" })).toEqual(
      [{ encounter: "skunk", kind: "encounter" }, { kind: "card" }],
    );
  });
});

describe("moverHintTriggers", () => {
  it("raises the data's cue hint, said once, for an arrow, and none for no cue or the wander mark", () => {
    expect(moverHintTriggers(null)).toEqual([]);
    expect(moverHintTriggers({ direction: 1, kind: "across" })).toEqual([{ kind: "moverCue" }]);
    expect(moverHintTriggers({ kind: "up" })).toEqual([{ kind: "moverCue" }]);
    expect(moverHintTriggers({ kind: "wander" })).toEqual([]);
    // The data has the hint, said once.
    const [trigger] = moverHintTriggers({ kind: "down" });
    const hint = trigger === undefined ? null : hintFor(gameData, [], trigger);
    expect(hint).not.toBeNull();
    expect(hint === null ? null : hintFor(gameData, [hint.id], { kind: "moverCue" })).toBeNull();
  });
});

describe("runHintTriggers", () => {
  it("raises the fired-owner hint for an owner at 1 heart, not a calm walk or a fired owner", () => {
    const kinds = (run: ReturnType<typeof testState>) =>
      runHintTriggers(run).map(({ kind }) => kind);
    expect(kinds(testState({ ginger: 5, kilo: 5, lady: 5 }))).toEqual([]);
    expect(kinds(testState({ ginger: 5, kilo: 1 }))).toEqual(["firedOwner"]);
    expect(kinds(testState({ ginger: 5, kilo: "fired" }))).toEqual([]);
  });
});

describe("stepHintTriggers", () => {
  // The hint text the data keys to an encounter.
  const encounterHints = (encounter: EncounterId) =>
    Object.values(gameData.hints).flatMap(({ text, trigger }) =>
      trigger.kind === "encounter" && trigger.encounter === encounter ? [text] : [],
    );

  it.each(["pothole", "puddle"] as const)(
    "says the %s hint once as the pack touches one, and not again at the next",
    (encounter) => {
      const shown: HintId[] = [];
      const said: string[] = [];
      for (let met = 0; met < 2; met += 1) {
        for (const trigger of stepHintTriggers(step(walkWith(["kilo"], [atPack(encounter)])))) {
          const hint = hintFor(gameData, shown, trigger);
          if (hint !== null) {
            shown.push(hint.id);
            said.push(hint.text);
          }
        }
      }
      expect(encounterHints(encounter)).toHaveLength(1);
      expect(said).toEqual(encounterHints(encounter));
    },
  );
});

describe("startHintTriggers", () => {
  const { packSizeBonus } = gameData.tuning.hearts;

  it.each([
    ["a lone dog", testState({ kilo: 5 }), packSizeBonus[1]],
    ["a pair", testState({ ginger: 5, kilo: 5 }), packSizeBonus[2]],
    ["a full pack", testState({ ginger: 5, kilo: 5, lady: 5 }), packSizeBonus[3]],
  ])(
    "raises the pack-bonus hint for %s only when its lead's owner gets a bonus",
    (_, run, bonus) => {
      expect(startHintTriggers(gameData.tuning, run)).toEqual(
        bonus > 0 ? [{ kind: "packBonus" }] : [],
      );
    },
  );
});
