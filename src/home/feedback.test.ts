import { describe, expect, it } from "vitest";

import { REFUSE, REFUSE_SHAKES } from "../ui/refuse.ts";
import { FEEDBACK, loopFrame, settleDelay, shakeOffset } from "./feedback.ts";

describe("shakeOffset", () => {
  it("steps the refusal's shake, then settles; still under reduced motion or with no shake", () => {
    const period = 2 * REFUSE.shakeMs;
    const total = period * REFUSE_SHAKES;
    const offsets = Array.from({ length: total }, (_, i) => shakeOffset(false, 1000 + i, 1000));
    expect(Math.min(...offsets)).toBe(0);
    expect(Math.max(...offsets)).toBe(REFUSE.shake);
    expect(offsets.slice(period, 2 * period)).toEqual(offsets.slice(0, period));
    expect(shakeOffset(false, 1000 + total, 1000)).toBe(0);
    expect(shakeOffset(true, 1100, 1000)).toBe(0);
    expect(shakeOffset(false, 1100, undefined)).toBe(0);
  });
});

describe("settleDelay", () => {
  it("holds a tap until the press dip is over, and shows a press held past it at once", () => {
    for (const [, releasedMs, expected] of [
      ["holds a tap released at once until the dip is over", 1000, FEEDBACK.pressDipMs],
      ["holds a quick tap for the rest of the dip", 1050, FEEDBACK.pressDipMs - 50],
      ["shows a press held for the dip on release", 1000 + FEEDBACK.pressDipMs, 0],
      ["shows a long press's result on release", 5000, 0],
    ] as const) {
      expect(settleDelay(releasedMs, 1000)).toBe(expected);
    }
  });
});

describe("loopFrame", () => {
  it("steps through the frames by their durations and loops", () => {
    const durations = [450, 150, 300];
    expect(loopFrame(false, durations, 0)).toBe(0);
    expect(loopFrame(false, durations, 449)).toBe(0);
    expect(loopFrame(false, durations, 450)).toBe(1);
    expect(loopFrame(false, durations, 600)).toBe(2);
    expect(loopFrame(false, durations, 900)).toBe(0);
    expect(loopFrame(true, durations, 450)).toBe(0);
  });
});
