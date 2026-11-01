import { describe, expect, it } from "vitest";

import { type SpawnVisibility, visibilityRejection } from "./spawnVisibility";

const shown = (entry: number, lane: number, kind = "dog"): SpawnVisibility => ({
  entry,
  kind,
  lane,
  row: Math.floor(entry / 10),
  until: entry + 100,
});

describe("visible logical obstacle limits", () => {
  it("counts a kind across skins and movement paths, but permits a new entry after departure", () => {
    const planned = [shown(0, 0), shown(20, 1), shown(25, 3, "cat")];
    expect(visibilityRejection(1, planned, shown(40, 2))).toBe("kind-cap");
    expect(visibilityRejection(1, planned, shown(100, 2))).toBeUndefined();
  });

  it.each([
    [0.5, 1, "kind-row"],
    [20, 0, "kind-lane"],
    [10.1, 1, "kind-entry"],
  ] as const)("rejects a duplicate spawn at %s in lane %s: %s", (entry, lane, reason) => {
    const existing = reason === "kind-entry" ? shown(9.9, 0) : shown(0, 0);
    expect(visibilityRejection(1, [existing], shown(entry, lane))).toBe(reason);
  });

  it("treats prepopulated negative rows as entering together at the start of the walk", () => {
    expect(visibilityRejection(1, [shown(-30, 0)], shown(-10, 1))).toBe("kind-entry");
  });

  it("checks overlap at later starts when an incoming interval begins first", () => {
    expect(visibilityRejection(1, [shown(20, 1), shown(40, 2)], shown(0, 0))).toBe("kind-cap");
  });
});
