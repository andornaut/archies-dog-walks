import { describe, expect, it } from "vitest";

import { REFUSE, REFUSE_SHAKES, refuseOffset, refuseShakeSteps } from "./refuse.ts";

describe("refuseShakeSteps", () => {
  it("holds, at every moment of a shake there and back, the whole pixel the canvas rounds to", () => {
    const steps = refuseShakeSteps();
    // Between step starts, so no moment falls on a rounding edge.
    for (let i = 1; i < 1000; i += 2) {
      const at = i / 1000;
      const linear = REFUSE.shake * (at < 0.5 ? 2 * at : 2 - 2 * at);
      const step = steps.filter((each) => each.at <= at).at(-1);
      expect(step?.offset, String(at)).toBe(Math.round(linear));
    }
  });

  it("shakes as long as the labels flash", () => {
    expect(REFUSE_SHAKES * 2 * REFUSE.shakeMs).toBe(REFUSE.flashMs * REFUSE.flashes);
  });
});

describe("refuseOffset", () => {
  it("steps through each shake's offsets at their times, and is still after it or under reduced motion", () => {
    const period = 2 * REFUSE.shakeMs;
    for (const { at, offset } of refuseShakeSteps()) {
      for (let shake = 0; shake < REFUSE_SHAKES; shake += 1) {
        expect(refuseOffset(false, shake * period + Math.ceil(at * period))).toBe(offset);
      }
    }
    expect(refuseOffset(false, period * REFUSE_SHAKES)).toBe(0);
    expect(refuseOffset(true, REFUSE.shakeMs)).toBe(0);
  });
});
