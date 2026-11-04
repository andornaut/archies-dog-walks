import { describe, expect, it } from "vitest";

import { limitConcurrency } from "./concurrency.ts";

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("limitConcurrency", () => {
  it("keeps each call's result and never runs more than the limit at once", async () => {
    let active = 0;
    let peak = 0;
    const started: number[] = [];
    const limited = limitConcurrency(3, async (n: number) => {
      started.push(n);
      active++;
      peak = Math.max(peak, active);
      // Later calls finish first, so a result reaching the wrong caller would show.
      await sleep(10 - n);
      active--;
      return n * 2;
    });
    const inputs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    const results = await Promise.all(inputs.map(async (n) => limited(n)));

    expect(results).toEqual(inputs.map((n) => n * 2));
    expect(peak).toBe(3);
    expect(started).toEqual(inputs);
  });

  it("passes on a rejection and frees its slot for the calls waiting", async () => {
    let active = 0;
    let peak = 0;
    const limited = limitConcurrency(2, async (n: number) => {
      active++;
      peak = Math.max(peak, active);
      await sleep(1);
      active--;
      if (n % 2 === 0) {
        throw new Error(`failed ${n}`);
      }
      return n;
    });

    const results = await Promise.allSettled([0, 1, 2, 3, 4].map(async (n) => limited(n)));

    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "fulfilled",
      "rejected",
      "fulfilled",
      "rejected",
    ]);
    expect(results[0]).toMatchObject({ reason: new Error("failed 0") });
    expect(peak).toBe(2);
  });

  it("refuses a limit below one", () => {
    expect(() => limitConcurrency(0, async () => 0)).toThrow(/positive integer/);
  });
});
