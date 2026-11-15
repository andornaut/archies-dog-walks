import { expect, it } from "vitest";

import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { fontInk, fontInkRows, gameFont } from "../../testing/fontInk.ts";
import { domScale, fontPixel, frameRect } from "../domScale.ts";
import { inPill } from "../namePills.ts";
import { textBlock } from "./textBlock.ts";
it("centres a backed label's ink and retains coloured pill runs and accessible text on resize", async () => {
  const doc = new FakeDocument();
  const bitmap = gameFont("font-body");
  const label = "Earned: $13";
  const backing = { height: 46, width: 260, x: 50, y: 350 };
  const block = textBlock(
    doc as unknown as Document,
    { bitmap, pillColours: () => ({ name: 0x102030, pill: 0xffdd88 }) },
    {
      anchor: "ink",
      backing,
      capTop: 366,
      colour: 0,
      font: "body",
      lines: [label],
      scale: 2,
      x: 180,
    },
  );
  await expect(block.ready).resolves.toEqual([]);
  const root = block.element as unknown as FakeElement;
  const run = root.children[0]!;
  const scale = domScale(1, { height: 894, width: 575, x: 0, y: 0 });
  block.place(scale);
  const ink = fontInk("font-body", { scale: fontPixel(scale, 2) }, label);
  const rows = fontInkRows("font-body", { scale: fontPixel(scale, 2) }, label);
  const frame = frameRect(scale, backing);
  expect(
    Math.abs(
      parseFloat(run.style.left!) + (ink.left + ink.right) / 2 - frame.left - frame.width / 2,
    ),
  ).toBeLessThanOrEqual(0.5);
  const capTop =
    parseFloat(run.style.top!) + (bitmap.glyphs.get("H")?.yOffset ?? 0) * fontPixel(scale, 2);
  expect(
    Math.abs(capTop + (rows.top + rows.bottom) / 2 - frame.top - frame.height / 2),
  ).toBeLessThanOrEqual(0.5);
  block.place(domScale(3, { height: 560, width: 360, x: 0, y: 0 }));
  expect(root.children[0]).toBe(run);
  expect(root.children.at(-1)!.textContent).toBe(`${label} `);
  const named = textBlock(
    doc as unknown as Document,
    { bitmap, pillColours: () => ({ name: 0x102030, pill: 0xffdd88 }) },
    { capTop: 20, colour: 0, font: "body", lines: [inPill(0, "Zoomies")], scale: 2, x: 10 },
  );
  named.place(scale);
  const parts = (named.element as unknown as FakeElement).children;
  expect(parts[0]!.style.backgroundColor).toBe("#ffdd88");
  expect(parts[1]!.style.color).toBe("#102030");
  expect(parts.at(-1)!.textContent).toBe("Zoomies ");
});
it("keeps display glyphs separate and updates their placement without rebuilding them", () => {
  const doc = new FakeDocument();
  const view = textBlock(
    doc as unknown as Document,
    { bitmap: gameFont("font-display"), pillColours: () => undefined },
    {
      anchor: "centre",
      capTop: 10,
      colour: 0xffcc00,
      font: "display",
      lines: ["Fired!"],
      scale: 1,
      x: 180,
    },
  );
  const root = view.element as unknown as FakeElement;
  const run = root.children[0]!;
  expect(run.children.map(({ textContent }) => textContent).join("")).toBe("FIRED!");
  view.place(domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const glyph = run.children[0];
  view.place(domScale(3, { height: 560, width: 360, x: 0, y: 0 }));
  expect(run.children[0]).toBe(glyph);
  expect(run.style.fontSize).toBe("24px");
  expect(root.children.at(-1)!.textContent).toBe("FIRED! ");
});
