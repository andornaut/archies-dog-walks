import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import { domScale, gridRect } from "../../ui/domScale.ts";
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
  it("keeps the full hit target fixed while a selected tile plays a refusal", async () => {
    const doc = new FakeDocument();
    const name = gameData.dogs.kilo.name;
    const host = createGameButton(doc as unknown as Document, {
      content: { kind: "icon", name },
      getAction: () => ({ activate: vi.fn() }),
      getState: () => ({ toggled: true }),
      skin: "authored",
    });
    const tile = createSelectionTile(doc as unknown as Document, SOURCE, gameFont("font-title"), {
      control: host,
      focus: "content",
      hit: HIT,
      mark: "none",
      rect: FACE,
      state: "selected",
    });
    await tile.ready;
    tile.place(SCALE, { markY: 0, x: 3 });
    expect(tile.element).toBe(host.element);
    expect(tile.element.getAttribute("aria-pressed")).toBe("true");
    expect(tile.element.style).toMatchObject({
      height: "96px",
      left: "24px",
      top: "480px",
      width: "96px",
    });
    const paint = (tile.content as unknown as FakeElement).parent;
    expect(paint?.parent).toBe(host.face);
    expect(host.face.style).toMatchObject({
      height: "96px",
      left: "0px",
      top: "0px",
      width: "96px",
    });
    expect(paint?.style.transform).toBe("translateX(6px)");
    tile.place(SCALE, { markY: 0, x: 0 });
    expect(tile.element.style).toMatchObject({ left: "24px", top: "480px" });
    const fractional = domScale(1, { height: 844, width: 390, x: 0, y: 0 });
    tile.place(fractional, { markY: 0, x: 0 });
    const face = descendants(tile.element as unknown as FakeElement).find((node) =>
      node.className.includes("adw-selection-face"),
    )!;
    const box = gridRect(fractional, FACE);
    const hit = gridRect(fractional, HIT);
    expect(face.style).toMatchObject({
      height: `${box.height}px`,
      left: `${box.left - hit.left}px`,
      top: `${box.top - hit.top}px`,
      width: `${box.width}px`,
    });
    host.dispose();
  });
  it("changes shop focus paint state without changing its target or adding perimeter layers", async () => {
    const doc = new FakeDocument();
    const host = createGameButton(doc as unknown as Document, {
      content: { kind: "icon", name: gameData.shopGear.runningShoes.name },
      getAction: () => null,
      getState: () => ({ toggled: false }),
      skin: "authored",
    });
    const tile = createSelectionTile(doc as unknown as Document, SOURCE, gameFont("font-title"), {
      control: host,
      focus: "face",
      hit: HIT,
      mark: "none",
      rect: FACE,
      state: "disabled",
    });
    await tile.ready;
    tile.place(SCALE, { focused: true, markY: 0, x: 0 });
    expect(tile.element.hasAttribute("data-picker-focused")).toBe(true);
    const painted = descendants(tile.element as unknown as FakeElement);
    expect(painted.filter((node) => node.className.includes("adw-selection-face"))).toHaveLength(1);
    expect(tile.element.style.getPropertyValue("--adw-selection-fill")).toBe(
      hex(PALETTE.neutralGrey),
    );
    tile.place(SCALE, { focused: false, markY: 0, x: 0 });
    expect(tile.element.hasAttribute("data-picker-focused")).toBe(false);
    expect(tile.element.getAttribute("aria-pressed")).toBe("false");
    expect(tile.element.style.width).toBe("96px");
    host.dispose();
  });
  it("retains the selected fill, persistent edge and plus marker without source textures", async () => {
    const doc = new FakeDocument();
    const source = { ...SOURCE, loadSheet: vi.fn(SOURCE.loadSheet) };
    const host = createGameButton(doc as unknown as Document, {
      content: { kind: "icon", name: gameData.dogs.archie.name },
      getAction: () => null,
      skin: "authored",
    });
    const tile = createSelectionTile(doc as unknown as Document, source, gameFont("font-title"), {
      control: host,
      focus: "content",
      hit: HIT,
      mark: "fallback",
      rect: FACE,
      state: "selected",
    });
    expect(await tile.ready).toEqual([]);
    tile.place(SCALE, { markY: 0, x: 0 });
    const painted = descendants(tile.element as unknown as FakeElement);
    expect(source.loadSheet).not.toHaveBeenCalled();
    expect(tile.element.style.getPropertyValue("--adw-selection-fill")).toBe(hex(PALETTE.cyan));
    expect(tile.element.style.getPropertyValue("--adw-selection-edge")).toBe(hex(PALETTE.ink));
    expect(painted.some((node) => node.style.backgroundColor === hex(PALETTE.green))).toBe(true);
    expect(painted.some((node) => node.textContent === "+")).toBe(true);
    expect(tile.element.style.width).toBe("96px");
    host.dispose();
  });
});
