import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { artPixel, domScale, gridRect } from "../../ui/domScale.ts";
import { artPart, framedPart } from "./detailCard.ts";

it("keeps art hidden, and settles, where its frames are not a sheet's", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const part = artPart(
    new FakeDocument() as unknown as Document,
    { artUrl: (path) => `/art/${path}`, loadSheet: () => Promise.resolve({}) },
    { key: "ui-detail-well", scale: 1, size: { height: 68, width: 68 }, x: 0, y: 0 },
  );
  await expect(part.ready).resolves.toEqual(["/art/images/ui-detail-well.png"]);
  expect(part.element.style.visibility).toBe("hidden");
  expect(error).toHaveBeenCalledOnce();
  error.mockRestore();
});

it("fills allocated detail and purchase picture extents while incidental art retains authored pixels", async () => {
  const doc = new FakeDocument() as unknown as Document;
  const source = {
    artUrl: (path: string) => path,
    loadSheet: async (path: string) => ownArtFrames(path),
  };
  const rect = { height: 68, width: 68, x: 32, y: 120 };
  const principal = artPart(doc, source, {
    key: "ui-detail-well",
    projection: "layout",
    scale: 1,
    size: { height: 68, width: 68 },
    ...rect,
  });
  const fallback = framedPart(doc, { border: 0, fill: 0xffffff, projection: "layout", rect });
  const portrait = artPart(doc, source, {
    holder: rect,
    key: "portrait-dog-archie",
    projection: "layout",
    scale: 1,
    size: { height: 64, width: 64 },
    x: rect.x + 2,
    y: rect.y + 2,
  });
  const incidental = artPart(doc, source, {
    key: "portrait-dog-archie",
    scale: 1,
    size: { height: 64, width: 64 },
    x: 0,
    y: 0,
  });
  await Promise.all([principal.ready, portrait.ready, incidental.ready]);
  for (const [dpr, width] of [
    [1, 575],
    [2.625, 393],
  ] as const) {
    const scale = domScale(dpr, { height: (width * 560) / 360, width, x: 0, y: 0 });
    const expected = gridRect(scale, rect);
    for (const part of [principal, fallback]) {
      part.place(scale);
      expect(part.element.style).toMatchObject({
        height: `${expected.height}px`,

        left: `${expected.left}px`,

        top: `${expected.top}px`,

        width: `${expected.width}px`,
      });
    }
    portrait.place(scale);
    const inner = gridRect(scale, { height: 64, width: 64, x: rect.x + 2, y: rect.y + 2 });
    expect(portrait.element.style).toMatchObject({
      height: `${inner.height}px`,

      width: `${inner.width}px`,
    });
    expect(inner.width).toBeGreaterThan(64 * artPixel(scale));
    incidental.place(scale);
    expect(incidental.element.style.width).toBe(`${64 * artPixel(scale)}px`);
  }
});
