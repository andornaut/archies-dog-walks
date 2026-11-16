import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { domScale, gridRect, gridX } from "../domScale.ts";
import { imageArt, imageNineSlice, sheetArt, sheetThreeSlice } from "./artElements.ts";
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

it("paints an image panel with unchanged nine-slice geometry and only its original image", async () => {
  const doc = new FakeDocument();
  const source = { artUrl: (path: string) => `/art/${path}`, loadSheet: vi.fn() };
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
  expect(source.loadSheet).not.toHaveBeenCalled();
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
  setRampDimmed(part.element, true);
  expect(part.element.style.filter).toBe("brightness(0.28)");
  expect(
    children.every((child) => child.style.backgroundImage === 'url("/art/images/ui-panel.png")'),
  ).toBe(true);
  setRampDimmed(part.element, false);
});

it("retains three-slice art scaling unless logical projection is explicit", async () => {
  const doc = new FakeDocument();
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    loadSheet: vi.fn().mockResolvedValue({
      frames: { first: { frame: { h: 9, w: 12, x: 2, y: 3 } } },
      meta: { size: { h: 16, w: 32 } },
    }),
  };
  const view = sheetThreeSlice(doc as unknown as Document, source, "ui-slider", {
    left: 3,
    right: 3,
  });
  const scale = domScale(2.625, { height: 844, width: 390, x: 0, y: 0 });
  const art = { width: 96, x: 5, y: 7 };
  await view.ready;
  view.place(scale, { x: 0, y: 0 }, art);
  expect(view.element.style.height).toBe("18px");
  expect(
    (view.element.children[0] as unknown as { style: CSSStyleDeclaration }).style,
  ).toMatchObject({
    backgroundPosition: "-4px -6px",
    backgroundSize: "64px 32px",
    width: "6px",
  });
  view.place(scale, { x: 0, y: 0 }, { ...art, projection: "layout" });
  const expected = gridRect(scale, { ...art, height: 9 });
  expect(view.element.style.height).toBe(`${expected.height}px`);
  expect((view.element.children[0] as unknown as { style: CSSStyleDeclaration }).style.width).toBe(
    `${gridX(scale, art.x + 3) - expected.left}px`,
  );
});

it("projects declared image layout edges without changing default authored-pixel scaling", () => {
  const doc = new FakeDocument();
  const source = { artUrl: (path: string) => path, loadSheet: vi.fn() };
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
