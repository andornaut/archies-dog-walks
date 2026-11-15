import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { domScale } from "../domScale.ts";
import { sheetArt } from "./artElements.ts";

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
