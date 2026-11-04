import type { GameData } from "../data/types.ts";
import { DEFAULT_WALKER, WALKER_PERKS, WALKERS } from "../data/walkers.ts";

// The walker data, for a test's data object.
export const TEST_WALKER_DATA: Pick<GameData, "defaultWalker" | "walkerPerks" | "walkers"> = {
  defaultWalker: DEFAULT_WALKER,
  walkerPerks: WALKER_PERKS,
  walkers: WALKERS,
};
