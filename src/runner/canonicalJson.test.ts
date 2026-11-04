import { describe, expect, it } from "vitest";

import { canonicalJson } from "./canonicalJson.ts";

const sortKeys = (_key: string, item: unknown): unknown =>
  item !== null && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : item;
// An object with its keys in the given, unsorted order.
const unsorted = (...entries: [string, unknown][]) => Object.fromEntries(entries);

class Point {
  readonly x: number;
  constructor(x: number) {
    this.x = x;
  }
}

describe("canonicalJson", () => {
  const shared = unsorted(["b", 1], ["a", [2, unsorted(["d", undefined], ["c", "x"])]]);
  it.each([
    ["primitives", [1, -0, NaN, Infinity, 'q"\n', true, null, undefined]],
    ["sorted keys", unsorted(["z", 1], ["a", unsorted(["y", [1, 2]], ["b", "c"])], ["m", null])],
    [
      "array-index keys",
      unsorted(
        ["b", "d"],
        ["10", "a"],
        ["2", "b"],
        ["01", "c"],
        ["4294967295", "e"],
        ["4294967294", "f"],
      ),
    ],
    ["omitted fields", { a: undefined, b: () => 1, c: Symbol("s"), d: [undefined, () => 1] }],
    ["shared references", { first: shared, second: [shared, shared] }],
    ["null prototype", Object.assign(Object.create(null) as object, unsorted(["b", 1], ["a", 2]))],
    ["toJSON", { a: { toJSON: () => unsorted(["z", 1], ["y", 2]) }, b: new Date(0) }],
    ["class instances", { a: new Point(1), b: [new Point(2)] }],
    ["top-level undefined", undefined],
    ["top-level string", "text"],
  ])("matches JSON.stringify with sorted keys for %s", (_name, value) => {
    expect(canonicalJson(value)).toBe(JSON.stringify(value, sortKeys));
  });

  it("throws as JSON.stringify does for a bigint", () => {
    expect(() => canonicalJson({ a: 1n })).toThrow(TypeError);
  });
});
