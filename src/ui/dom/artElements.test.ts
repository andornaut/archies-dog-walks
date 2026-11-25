import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { domScale, gridRect } from "../domScale.ts";
import { imageArt, imageNineSlice, sheetArt, type SheetArtPlace } from "./artElements.ts";
import { setRampDimmed } from "./rampDim.ts";

it("uses original sheet metadata with a disabled image and the requested animated frame", async () => {
  const json = {
    frames: {
      first: { frame: { h: 6, w: 4, x: 0, y: 0 } },
      second: { frame: { h: 6, w: 4, x: 8, y: 0 } },
    },
    meta: { size: { h: 6, w: 12 } },
  };
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    loadSheet: vi.fn().mockResolvedValue(json),
  };
  const doc = new FakeDocument();
  const part = sheetArt(doc as unknown as Document, source, "dog", "dog-disabled");
  part.place(
    domScale(1, { height: 560, width: 360, x: 0, y: 0 }),
    { x: 0, y: 0 },
    { frame: 1, scale: 2, x: 3, y: 4 },
  );
  await expect(part.ready).resolves.toEqual(["/art/sprites/dog-disabled.png"]);
  expect(source.loadSheet).toHaveBeenCalledWith("/art/sprites/dog.json");
  expect(part.element.style).toMatchObject({
    backgroundPosition: "-16px 0px",
    height: "12px",
    width: "8px",
  });
});

// A sheet of two 4x6 frames, its pulse tag playing them 100 ms each, placed at 3,4 at scale 1.
it.each<[string, Partial<SheetArtPlace>, Record<string, string>]>([
  [
    "a crop from the frame's corner",
    { crop: { height: 2, width: 3, x: 1, y: 4 } },
    { backgroundPosition: "-1px -4px", height: "2px", left: "3px", top: "4px", width: "3px" },
  ],
  ["its centre at x", { originX: 0.5 }, { left: "1px", width: "4px" }],
  ["its tag's frame playing", { playMs: 150, tag: "pulse" }, { backgroundPosition: "-8px 0px" }],
  [
    "its tag's loop from the start",
    { playMs: 250, tag: "pulse" },
    { backgroundPosition: "0px 0px" },
  ],
  ["the tag's first frame still", { tag: "pulse" }, { backgroundPosition: "0px 0px" }],
])("draws a sheet frame's %s", async (_name, art, style) => {
  const json = {
    frames: {
      first: { duration: 100, frame: { h: 6, w: 4, x: 0, y: 0 } },
      second: { duration: 100, frame: { h: 6, w: 4, x: 8, y: 0 } },
    },
    meta: { frameTags: [{ from: 0, name: "pulse", to: 1 }], size: { h: 6, w: 12 } },
  };
  const source = { artUrl: (path: string) => path, loadSheet: vi.fn().mockResolvedValue(json) };
  const part = sheetArt(new FakeDocument() as unknown as Document, source, "fires");
  part.place(
    domScale(1, { height: 560, width: 360, x: 0, y: 0 }),
    { x: 0, y: 0 },
    { projection: "layout", x: 3, y: 4, ...art },
  );
  await part.ready;
  expect(part.element.style).toMatchObject(style);
});

it("paints an image panel with unchanged nine-slice geometry from its frame on its sheet", async () => {
  const doc = new FakeDocument();
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    loadSheet: vi.fn().mockResolvedValue({
      frames: { "ui-panel 0.aseprite": { frame: { h: 24, w: 24, x: 10, y: 20 } } },
      meta: { size: { h: 64, w: 64 } },
    }),
  };
  const part = imageNineSlice(
    doc as unknown as Document,
    source,
    "ui-panel",
    { height: 24, width: 24 },
    { bottom: 4, left: 4, right: 4, top: 4 },
  );
  part.place(
    domScale(1, { height: 560, width: 360, x: 0, y: 0 }),
    { x: 0, y: 0 },
    { height: 48, width: 96, x: 5, y: 7 },
  );
  expect(source.loadSheet).toHaveBeenCalledExactlyOnceWith("/art/images/ui-panel.json");
  await expect(part.ready).resolves.toEqual(["/art/images/ui-panel.png"]);
  const children = [...part.element.children] as unknown as {
    style: CSSStyleDeclaration;
    getAttribute(name: string): string | null;
  }[];
  expect(children).toHaveLength(9);
  expect(children[4]?.style).toMatchObject({
    height: "40px",
    left: "4px",
    top: "4px",
    width: "88px",
  });
  expect(children[0]?.style.backgroundPosition).toBe("-10px -20px");
  setRampDimmed(part.element, true);
  expect(part.element.style.filter).toBe("brightness(0.28)");
  expect(
    children.every((child) => child.style.backgroundImage === 'url("/art/images/ui-panel.png")'),
  ).toBe(true);
  setRampDimmed(part.element, false);
});

it("projects declared image layout edges without changing default authored-pixel scaling", () => {
  const doc = new FakeDocument();
  const source = {
    artUrl: (path: string) => path,
    loadSheet: vi.fn().mockResolvedValue({
      frames: { "ui-dog-card-band 0.aseprite": { frame: { h: 76, w: 360, x: 0, y: 0 } } },
      meta: { size: { h: 76, w: 360 } },
    }),
  };
  const image = imageArt(doc as unknown as Document, source, "ui-dog-card-band");
  for (const dpr of [1, 2.625]) {
    const scale = domScale(dpr, { height: 844, width: 390, x: 0, y: 0 });
    const art = { height: 76, width: 360, x: 0, y: 484 };
    image.place(scale, { x: 0, y: 0 }, art);
    expect(image.element.style.width).toBe(`${360 * Math.max(1, Math.floor(scale.unit * dpr))}px`);
    image.place(scale, { x: 0, y: 0 }, { ...art, projection: "layout" });
    const box = gridRect(scale, art);
    expect(image.element.style).toMatchObject({
      height: `${box.height}px`,
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
    });
  }
});

it("darkens disabled native variants without changing their image or metadata dependency", async () => {
  const doc = new FakeDocument();
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    loadSheet: vi.fn().mockResolvedValue({}),
  };
  const image = imageArt(
    doc as unknown as Document,
    source,
    "item-whistle",
    "item-whistle-disabled",
  );
  const sheet = sheetArt(
    doc as unknown as Document,
    source,
    "face-dog-kilo",
    "face-dog-kilo-disabled",
  );
  await Promise.all(
    (
      [
        [image, "images", "item-whistle"],
        [sheet, "sprites", "face-dog-kilo"],
      ] as const
    ).map(async ([part, kind, key]) => {
      const normal = `/art/${kind}/${key}-disabled.png`;
      await expect(part.ready).resolves.toEqual([normal]);
      setRampDimmed(part.element, true);
      expect(part.element.style.filter).toBe("brightness(0.28)");
      expect(part.element.style.backgroundImage).toBe(`url("${normal}")`);
      setRampDimmed(part.element, false);
      expect(part.element.style.backgroundImage).toBe(`url("${normal}")`);
    }),
  );
  expect(source.loadSheet).toHaveBeenCalledWith("/art/sprites/face-dog-kilo.json");
});
