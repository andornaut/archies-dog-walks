import { readFileSync } from "node:fs";

import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { fontInk, fontInkRows, gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { newPlayerSave, testContext } from "../../testing/saves.ts";
import { setRampDimmed } from "../../ui/dom/rampDim.ts";
import { sheetFrame } from "../../ui/dom/sheetFrames.ts";
import { artPixel, domScale, fontPixel, gridRect, gridY } from "../../ui/domScale.ts";
import { gridRects, type GridSpec } from "../../ui/grid.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { FEEDBACK } from "../feedback.ts";
import { HOME_LAYOUT, slotSignText, tileFace } from "../homeLayout.ts";
import { homeSections } from "../sections.ts";
import { homeSectionViews } from "../sectionView.ts";
import { homeSelectionViews } from "../selectionView.ts";
import { slotSign } from "../slotSign.ts";
import { createHomeSections } from "./sections.ts";
import { createHomeSelection } from "./selections.ts";

// The fake document draws no canvas, so the fills' cuts from their sheet stand in.
vi.mock("../../ui/dom/domCuts.ts", () => ({
  cutDomArt: vi.fn(() => Promise.resolve("blob:fill")),
}));
import { createSlotSign } from "./slotSign.ts";

const source = {
  artUrl: (path: string) => path,
  hasArt: () => true,
  imageSize: (key: string) => {
    const png = readFileSync(`public/art/images/${key}.png`);
    return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
  },
  loadSheet: async (path: string) => ownArtFrames(path),
};
const viewport = { height: 844, width: 390, x: 0, y: 0 };

it("fills each primary picker picture's logical well at fractional fits", async () => {
  const doc = new FakeDocument();
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  const cell = <Id extends string>(
    id: Id,
    grid: GridSpec,
    origin: { x: number; y: number },
    inset: { x: number; y: number },
  ) => {
    const hit = gridRects(grid, 1, origin)[0]!;
    return { feedbackId: id, hit, id, rect: tileFace(inset, hit) };
  };
  const home = HOME_LAYOUT;
  const models = homeSelectionViews(gameData, fontMetrics(fonts.body), false, {
    dogs: [cell("kilo", home.dogTiles, home.dogOrigin, home.dogTileInset)],
    gear: [cell("fannyPack", home.pocket.cells, home.pocket.origin, home.pocket.tileInset)],
    loadout: newPlayerSave.lastLoadout,
    save: newPlayerSave,
    walkers: [cell("casey", home.walkerTiles, home.walkerOrigin, home.walkerTileInset)],
  });
  const pictures = [
    [5, 1, 30],
    [4, 5, 32],
    [13, 2, 32],
  ] as const;
  await Promise.all(
    pictures.map(async ([dx, dy, size], index) => {
      const model = models[index]!;
      const tile = createHomeSelection(
        doc as unknown as Document,
        {
          ...source,
          disabledKey: (key) => `${key}-disabled`,
          isSheet: (key) => key.startsWith("face-"),
        },
        fonts,
        2,
        model,
      );
      const primary = model.pictures[0]!;
      const key = model.art === "grey" ? `${primary.key}-disabled` : primary.key;
      const path = index === 2 ? `images/${key}.png` : `sprites/${key}.png`;
      await expect(tile.ready).resolves.toContain(path);
      const image = Array.from(tile.element.querySelectorAll<HTMLElement>(".adw-art")).find(
        ({ style }) => style.backgroundImage?.includes(path),
      )!;
      for (const scale of [domScale(1, { ...viewport, width: 575 }), domScale(2.625, viewport)]) {
        const hit = gridRect(scale, model.hit);
        for (const faceY of [0, -FEEDBACK.hopPx]) {
          tile.place(scale, { faceY, markY: 0, refusing: false, x: 0, y: 0 });
          const dest = gridRect(scale, {
            height: size,
            width: size,
            x: model.rect.x + dx,
            y: model.rect.y + dy + faceY,
          });
          expect(image.style).toMatchObject({
            height: `${dest.height}px`,
            left: `${dest.left - hit.left}px`,
            top: `${dest.top - hit.top}px`,
            width: `${dest.width}px`,
          });
          expect(dest.width).toBeGreaterThan(32 * artPixel(scale));
          const strip = model.plate?.strip;
          if (strip !== undefined) {
            expect(dest.top + dest.height).toBeLessThanOrEqual(gridY(scale, strip.y));
          }
        }
        expect(tile.element.style.width).toBe(`${hit.width}px`);
      }
    }),
  );
});

it("keeps picker headings clear of fills within logical bands at fractional fits", async () => {
  const doc = new FakeDocument();
  const title = gameFont("font-title");
  const sections = homeSections(gameData, newPlayerSave.owned, {
    loadout: newPlayerSave.lastLoadout,
    walker: testContext.defaults.walker,
  });
  const view = createHomeSections(doc as unknown as Document, source, title, {
    bonus: null,
    sections,
  });
  await expect(view.ready).resolves.toContain("sprites/ui-section.png");
  const frames = [...view.element.children].filter((child) => child.className === "adw-art");
  const labels = [...view.element.children].filter((child) => child.className.includes("adw-text"));
  const specifications = homeSectionViews(sections);
  for (const dpr of [1, 2.625]) {
    const scale = domScale(dpr, viewport);
    view.place(scale);
    specifications.forEach((section, index) => {
      const frame = frames[index] as unknown as FakeElement;
      const top = Number.parseFloat(frame.style.top!);
      const cap = frame.children[0]!;
      const boundary = top + Number.parseFloat(cap.style.height!);
      expect(boundary).toBe(gridY(scale, section.fill.rect.y));
      expect(Number.parseFloat(cap.style.height!)).toBeGreaterThan(
        SLICES["ui-section"].top * artPixel(scale),
      );
      const heading = labels[index * 2] as unknown as FakeElement;
      const metrics = fontMetrics(title);
      const inkBottom =
        Number.parseFloat(heading.style.top!) +
        (metrics.capTop + metrics.capHeight) * fontPixel(scale, TEXT_SCALE);
      expect(inkBottom).toBeLessThan(gridY(scale, section.rect.y + 23));
    });
    const slices = frames
      .flatMap((frame) => [...frame.children])
      .map((slice) => slice as HTMLElement);
    const original = slices.map((slice) => slice.style.backgroundImage);
    setRampDimmed(view.element, true);
    expect(view.element.style.filter).toBe("brightness(0.28)");
    expect(slices.map((slice) => slice.style.backgroundImage)).toEqual(original);
    setRampDimmed(view.element, false);
    expect(slices.map((slice) => slice.style.backgroundImage)).toEqual(original);
  }
});

it("projects the slot sign frame without changing hit or pressed-tag geometry", async () => {
  const doc = new FakeDocument();
  const sign = slotSign(gameData, newPlayerSave.owned, newPlayerSave.bankCents)!;
  const view = createSlotSign(
    doc as unknown as Document,
    source,
    gameFont("font-body"),
    {
      height: HOME_LAYOUT.gate.height,
      width: 360,
      x: 0,
      y: HOME_LAYOUT.gate.y,
    },
    sign,
  );
  await expect(view.ready).resolves.toContain("sprites/ui-slot-sign.png");
  const json = await source.loadSheet("sprites/ui-slot-sign.json");
  const frame = sheetFrame(json, "normal");
  const image = view.element.children[0]!.children[0] as unknown as FakeElement;
  const labels = [...view.element.children[0]!.children]
    .filter((child) => child.className.includes("adw-text"))
    .map((child) => child as unknown as FakeElement);
  for (const [dpr, box] of [
    [1, viewport],
    [2.625, viewport],
    [1, { height: 1280, width: 575, x: 0, y: 0 }],
  ] as const) {
    const scale = domScale(dpr, box);
    const absolute = gridRect(scale, {
      ...HOME_LAYOUT.slotSign.art,
      height: frame.height,
      width: frame.width,
    });
    const hit = gridRect(scale, HOME_LAYOUT.slotSign.hit);
    for (const pressed of [false, true]) {
      view.place(scale, { pressed, x: 0, y: 0 });
      expect(image.style).toMatchObject({
        height: `${absolute.height}px`,
        left: `${absolute.left - hit.left}px`,
        top: `${absolute.top - hit.top}px`,
        width: `${absolute.width}px`,
      });
      const font = gameFont("font-body");
      const pixel = scale.unit * scale.dpr * HOME_LAYOUT.slotSign.scale;
      const cream = slotSignText(fontMetrics(font)).cream;
      const backing = gridRect(scale, {
        ...cream,
        y: cream.y + (pressed ? HOME_LAYOUT.slotSign.pressDrop : 0),
      });
      const bounds = labels.map((label, index) => {
        expect(Number.parseFloat(label.style.fontSize!)).toBeCloseTo(8 * pixel);
        const text = sign.lines[index]!;
        const columns = fontInk("font-body", { scale: pixel }, text);
        const rows = fontInkRows("font-body", { scale: pixel }, text);
        const left = Number.parseFloat(label.style.left!) + hit.left;
        const cap =
          Number.parseFloat(label.style.top!) + hit.top + fontMetrics(font).capTop * pixel;
        const ink = {
          bottom: cap + rows.bottom,
          left: left + columns.left,
          right: left + columns.right,
          top: cap + rows.top,
        };
        expect(
          Math.abs((ink.left + ink.right) / 2 - backing.left - backing.width / 2),
        ).toBeLessThanOrEqual(0.500001);
        expect(ink.left).toBeGreaterThanOrEqual(backing.left);
        expect(ink.right).toBeLessThanOrEqual(backing.left + backing.width);
        return ink;
      });
      const top = Math.min(...bounds.map((ink) => ink.top));
      const bottom = Math.max(...bounds.map((ink) => ink.bottom));
      expect(Math.abs((top + bottom) / 2 - backing.top - backing.height / 2)).toBeLessThanOrEqual(
        0.500001,
      );
      expect(top).toBeGreaterThanOrEqual(backing.top);
      expect(bottom).toBeLessThanOrEqual(backing.top + backing.height);
      expect(view.element.style.width).toBe(`${hit.width}px`);
      expect(absolute.width).toBeGreaterThan(frame.width * artPixel(scale));
    }
  }
});
