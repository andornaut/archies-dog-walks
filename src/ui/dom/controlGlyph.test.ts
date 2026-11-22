import { expect, it } from "vitest";

import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { type ControlGlyph, createControlGlyph } from "./controlGlyph.ts";

function fixture() {
  const document = new FakeDocument();
  const create = (glyph: ControlGlyph) =>
    createControlGlyph(document as unknown as Document, glyph) as unknown as FakeElement;
  return { create };
}

it("keeps every decorative control glyph in its existing box and out of keyboard and label semantics", () => {
  const { create } = fixture();
  const names: ControlGlyph[] = ["close", "exit", "menu", "pause", "sound-off", "sound-on"];
  for (const name of names) {
    const first = create(name);
    const second = create(name);
    expect(first.attributes.get("viewBox")).toBe("0 0 16 16");
    expect(first.attributes.get("width")).toBe("16");
    expect(first.attributes.get("height")).toBe("16");
    expect(first.attributes.get("aria-hidden")).toBe("true");
    expect(first.attributes.get("focusable")).toBe("false");
    expect(first.attributes.has("tabindex")).toBe(false);
    expect(first.attributes.has("aria-label")).toBe(false);
    expect(first).not.toBe(second);
    expect(first.children.length).toBeGreaterThan(0);
    expect(first.children[0]).not.toBe(second.children[0]);
    for (const element of [first, ...first.children]) {
      expect(element.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(["svg", "path"]).toContain(element.tagName);
      expect(element.attributes.has("href")).toBe(false);
      expect(element.attributes.has("style")).toBe(false);
      for (const attribute of ["fill", "stroke"]) {
        const value = element.attributes.get(attribute);
        if (value !== undefined) {
          expect(["none", "currentColor"]).toContain(value);
        }
      }
    }
  }
});

it("keeps the sound body consistent while giving muted and audible states distinct monochrome cues", () => {
  const { create } = fixture();
  const audible = create("sound-on");
  const muted = create("sound-off");
  expect(audible.children[0]?.attributes).toEqual(muted.children[0]?.attributes);
  expect(audible.children[0]?.attributes.get("fill")).toBe("currentColor");
  const waves = audible.children[1]?.attributes.get("d");
  const cross = muted.children[1]?.attributes.get("d");
  expect(waves).toContain("q");
  expect(cross).not.toContain("q");
  expect(cross).toContain("l");
  expect(cross).not.toBe(waves);
  expect(audible.attributes.get("stroke")).toBe("currentColor");
  expect(muted.attributes.get("stroke")).toBe("currentColor");
});
