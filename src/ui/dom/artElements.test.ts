import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { domScale } from "../domScale.ts";
import { imageNineSlice, sheetArt } from "./artElements.ts";

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

it("paints an image panel with the same nine-slice geometry and preloads its registered dim copy", async () => {
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
  await expect(part.ready).resolves.toEqual([
    "/art/images/ui-panel.png",
    "/art/images/ui-panel-dim.png",
  ]);
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
  expect(
    children.every(
      (child) => child.getAttribute("data-dim-art") === "/art/images/ui-panel-dim.png",
    ),
  ).toBe(true);
});
