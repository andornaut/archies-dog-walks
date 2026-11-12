import { describe, expect, it } from "vitest";

import { LOADING_TRACK, LOADING_WALKER_SIZE, loadingWalkerAt } from "./loadingScreen.ts";

describe("loadingWalkerAt", () => {
  it("ends with its right edge on the track's end", () => {
    expect(loadingWalkerAt(1).x + LOADING_WALKER_SIZE.width).toBeLessThanOrEqual(
      LOADING_TRACK.x + LOADING_TRACK.width,
    );
  });
});
