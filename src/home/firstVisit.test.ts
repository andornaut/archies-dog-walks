import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { DogId } from "../data/types.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { homeSections, startReady } from "./sections.ts";

describe("a first visit", () => {
  it("is ready to start with a dog: the saved walker counts", () => {
    for (const row of [
      { dogs: [], ready: false },
      { dogs: newPlayerSave.owned.dogs.slice(0, 1), ready: true },
    ] as const) {
      const sections = homeSections(gameData, newPlayerSave.owned, {
        loadout: { dogs: row.dogs as readonly DogId[], gear: null },
        walker: newPlayerSave.walker,
      });
      expect(sections.walker.state).toBe("complete");
      expect(startReady(sections)).toBe(row.ready);
    }
  });
});
