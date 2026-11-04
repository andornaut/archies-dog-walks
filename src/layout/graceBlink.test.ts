import { describe, expect, it } from "vitest";

import { TUNING } from "../data/tuning.ts";
import { read } from "../rules/units.ts";
import { GRACE_BLINK, graceAlpha } from "./graceBlink.ts";

const WINDOW = read(TUNING, "seconds", "collisionGrace");
const { blinkSeconds, dimAlpha } = GRACE_BLINK;

describe("graceAlpha", () => {
  // remaining is the grace left; elapsed blinks count from the window's start.
  it.each([
    { alpha: 1, name: "past the window's end", remaining: -blinkSeconds, still: false },
    { alpha: 1, name: "as the window opens, in the hit stop", remaining: WINDOW, still: false },
    { alpha: 1, name: "in the first blink", remaining: WINDOW - 0.5 * blinkSeconds, still: false },
    { alpha: 0, name: "in the second blink", remaining: WINDOW - 1.5 * blinkSeconds, still: false },
    { alpha: dimAlpha, name: "dimmed as the window opens", remaining: WINDOW, still: true },
    { alpha: dimAlpha, name: "dimmed late on", remaining: blinkSeconds / 2, still: true },
    { alpha: 1, name: "once the window ends", remaining: 0, still: true },
  ])("shows the pack at $alpha $name, reduced motion $still", ({ alpha, remaining, still }) => {
    expect(graceAlpha(still, WINDOW, remaining)).toBe(alpha);
  });

  // Stepped through the window at the walk's 60 Hz, the pack is hidden for about half of it,
  // in runs no longer than a blink, and shown again once it ends.
  it("blinks the pack through the whole window at the blink rate", () => {
    const step = 1 / 60;
    const alphas: number[] = [];
    for (let remaining: number = WINDOW; remaining > 0; remaining -= step) {
      alphas.push(graceAlpha(false, WINDOW, remaining));
    }
    const hidden = alphas.filter((alpha) => alpha === 0).length / alphas.length;
    expect(hidden).toBeGreaterThan(0.4);
    expect(hidden).toBeLessThan(0.6);
    const runs = alphas.join("").match(/0+/g) ?? [];
    expect(Math.max(...runs.map((run) => run.length))).toBeLessThanOrEqual(
      Math.ceil(blinkSeconds / step),
    );
    expect(graceAlpha(false, WINDOW, 0)).toBe(1);
  });
});
