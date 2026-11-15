import { describe, expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { domScale } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { createSelectionTile } from "./selectionTile.ts";
const SOURCE = {
  artUrl: (path: string) => `/art/${path}`,
  loadSheet: () =>
    Promise.resolve({
      frames: { normal: { frame: { h: 24, w: 24, x: 0, y: 0 } } },
      meta: { size: { h: 24, w: 24 } },
    }),
};
const HIT = { height: 48, width: 48, x: 12, y: 240 };
const FACE = { height: 44, width: 44, x: 14, y: 242 };
const SCALE = domScale(1, { height: 1120, width: 720, x: 0, y: 0 });
const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;
const descendants = (node: FakeElement): FakeElement[] => [
  node,
  ...node.children.flatMap(descendants),
];
describe("native selection tile", () => {
  it("keeps the full hit target fixed while selected paint lifts and shakes", async () => {
    const doc = new FakeDocument();
    const tile = createSelectionTile(doc as unknown as Document, SOURCE, {
      hit: HIT,
      label: gameData.dogs.kilo.name,
      rect: FACE,
      state: "selected",
    });
    await tile.ready;
    tile.place(SCALE, { markY: 0, x: 3, y: -2 });
    expect(tile.element.getAttribute("aria-pressed")).toBe("true");
    expect(tile.element.style).toMatchObject({
      height: "96px",
      left: "24px",
      top: "480px",
      width: "96px",
    });
    const paint = (tile.content as unknown as FakeElement).parent;
    expect(paint?.style.transform).toBe("translate(6px,-4px)");
    tile.place(SCALE, { markY: 0, x: 0, y: 0 });
    expect(tile.element.style).toMatchObject({ left: "24px", top: "480px" });
  });
  it("retains shop focus while its separate moving orbit settles", async () => {
    const doc = new FakeDocument();
    const tile = createSelectionTile(doc as unknown as Document, SOURCE, {
      hit: HIT,
      label: gameData.shopGear.runningShoes.name,
      rect: FACE,
      state: "disabled",
    });
    await tile.ready;
    const ring = { height: 1, width: 44, x: 14, y: 242 };
    tile.setFrameFills([{ colour: PALETTE.cyan, rect: ring }]);
    tile.setOrbit([{ colour: PALETTE.white, rect: { ...ring, width: 4 } }]);
    tile.place(SCALE, { markY: 0, x: 0, y: 0 });
    tile.setOrbit([]);
    tile.place(SCALE, { markY: 0, x: 0, y: 0 });
    const painted = descendants(tile.element as unknown as FakeElement);
    expect(
      painted.some((node) => !node.hidden && node.style.backgroundColor === hex(PALETTE.cyan)),
    ).toBe(true);
    expect(
      painted.some((node) => !node.hidden && node.style.backgroundColor === hex(PALETTE.white)),
    ).toBe(false);
    expect(tile.element.getAttribute("aria-pressed")).toBe("false");
    expect(tile.element.style.width).toBe("96px");
  });
});
