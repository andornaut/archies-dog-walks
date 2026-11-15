import { expect, it } from "vitest";

import { FakeDocument } from "./fakeDom.ts";

it("replaces children by moving existing nodes once and detaching the prior children", () => {
  const doc = new FakeDocument();
  const source = doc.createElement("div");
  const target = doc.createElement("div");
  const moved = doc.createElement("span");
  const old = doc.createElement("span");
  const kept = doc.createElement("span");
  source.append(moved);
  target.append(old, kept);

  target.replaceChildren(kept, moved, kept);

  expect(source.children).toEqual([]);
  expect(target.children).toEqual([moved, kept]);
  expect(old.parent).toBeUndefined();
  expect(moved.parent).toBe(target);
  expect(kept.parent).toBe(target);

  target.replaceChildren();
  expect(target.children).toEqual([]);
  expect(moved.parent).toBeUndefined();
  expect(kept.parent).toBeUndefined();
});
