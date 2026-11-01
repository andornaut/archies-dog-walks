import { expect, it } from "vitest";

import { gameData } from "../data";
import { holdRule, TILE_SLOP_PX } from "./hold";

it("reads the live game hold time in milliseconds and retains the requested slop", () => {
  const tuning = {
    ...gameData.tuning,
    seconds: { ...gameData.tuning.seconds, holdSeconds: 1.25 },
  };
  expect(holdRule(tuning, TILE_SLOP_PX)).toEqual({ holdMs: 1250, slopPx: TILE_SLOP_PX });
  expect(holdRule(tuning, Number.POSITIVE_INFINITY)).toEqual({
    holdMs: 1250,
    slopPx: Number.POSITIVE_INFINITY,
  });
});
