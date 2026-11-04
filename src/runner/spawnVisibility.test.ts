import { describe, expect, it } from "vitest";

import { type SpawnVisibility, visibilityRejection } from "./spawnVisibility.ts";

const shown = (entry: number, lane: number, kind = "dog"): SpawnVisibility => ({
  entry,
  kind,
  lane,
  row: Math.floor(entry / 10),
  until: entry + 100,
});

describe("visible logical obstacle limits", () => {
  it.each([
    { entry: 40, lane: 2, name: "a kind past its cap, across skins and paths", want: "kind-cap" },
    { entry: 100, lane: 2, name: "a kind's new entry after a departure", want: undefined },
  ])("judges $name: $want", ({ entry, lane, want }) => {
    const planned = [shown(0, 0), shown(20, 1), shown(25, 3, "cat")];
    expect(visibilityRejection(1, planned, shown(entry, lane))).toBe(want);
  });

  it.each([
    { entry: 0.5, existing: [shown(0, 0)], lane: 1, name: "in the same row", want: "kind-row" },
    { entry: 20, existing: [shown(0, 0)], lane: 0, name: "in the same lane", want: "kind-lane" },
    {
      entry: 10.1,
      existing: [shown(9.9, 0)],
      lane: 1,
      name: "entering together",
      want: "kind-entry",
    },
    {
      entry: -10,
      existing: [shown(-30, 0)],
      lane: 1,
      name: "prepopulated in negative rows, as entering together at the walk's start",
      want: "kind-entry",
    },
    {
      entry: 0,
      existing: [shown(20, 1), shown(40, 2)],
      lane: 0,
      name: "overlapping later starts when it begins first",
      want: "kind-cap",
    },
  ])("rejects a spawn $name: $want", ({ entry, existing, lane, want }) => {
    expect(visibilityRejection(1, existing, shown(entry, lane))).toBe(want);
  });
});
