import { fillNames } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { HINTS } from "../data/hints.ts";
import { TUNING } from "../data/tuning.ts";
import type { HintId } from "../data/types.ts";
import { hintFor, hintJumpsQueue, hintText } from "./hints.ts";
import { read } from "./units.ts";

const data = { hints: HINTS, tuning: TUNING };

describe("hintJumpsQueue", () => {
  const lowHearts = hintFor(data, [], { kind: "firedOwner" })?.id;

  it("jumps the queue only as the low-hearts hint", () => {
    for (const id of keysOf(HINTS)) {
      expect(hintJumpsQueue(data, id)).toBe(id === lowHearts);
    }
  });
});

describe("hintFor", () => {
  it("returns the next hint", () => {
    for (const [, shown, event, id] of [
      ["the hint for a matching event", [], { kind: "tip" }, "tip"],
      [
        "the hint for a matching encounter",
        [],
        { encounter: "puddle", kind: "encounter" },
        "puddle",
      ],
      ["nothing for a hint already shown", ["tip"], { kind: "tip" }, null],
      [
        "nothing for an event no hint waits for",
        [],
        { encounter: "thief", kind: "encounter" },
        null,
      ],
    ] satisfies readonly [string, HintId[], Parameters<typeof hintFor>[2], HintId | null][]) {
      expect(hintFor(data, shown, event)).toEqual(
        id === null ? null : { id, text: hintText(data, id) },
      );
    }
  });
});

describe("hintText", () => {
  it("fills the hearts a bump costs and a treat gives from the tuning", () => {
    const fields = {
      bumpHearts: String(read(TUNING, "hearts", "bump")),
      treatHearts: String(read(TUNING, "hearts", "treat")),
    };
    for (const id of ["minorBump", "treat"] as const) {
      expect(hintText(data, id)).toBe(fillNames(HINTS[id].text, fields));
    }
  });

  it("leaves no {name} unfilled in any hint", () => {
    for (const id of keysOf(HINTS)) {
      expect(hintText(data, id)).not.toMatch(/\{\w+\}/);
    }
  });
});
