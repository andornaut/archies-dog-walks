import { readFileSync } from "node:fs";

import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { newPlayerSave, testContext } from "../../testing/saves.ts";
import { sheetFrame } from "../../ui/dom/sheetFrames.ts";
import { artPixel, domScale, fontPixel, gridRect, gridY } from "../../ui/domScale.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";
import { homeSections } from "../sections.ts";
import { homeSectionViews } from "../sectionView.ts";
import { slotSign } from "../slotSign.ts";
import { createHomeSections } from "./sections.ts";
import { createSlotSign } from "./slotSign.ts";

const source = {
  artUrl: (path: string) => path,
  hasArt: () => true,
  imageSize: (key: string) => {
    const png = readFileSync(`public/art/images/${key}.png`);
    return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
  },
  loadSheet: async (path: string) => JSON.parse(readFileSync(`public/art/${path}`, "utf8")),
};
const viewport = { height: 844, width: 390, x: 0, y: 0 };

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
  await view.ready;
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
  await view.ready;
  const json = await source.loadSheet("sprites/ui-slot-sign.json");
  const frame = sheetFrame(json, "normal");
  const image = view.element.children[0]!.children[0] as unknown as FakeElement;
  for (const dpr of [1, 2.625]) {
    const scale = domScale(dpr, viewport);
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
      expect(view.element.style.width).toBe(`${hit.width}px`);
      expect(absolute.width).toBeGreaterThan(frame.width * artPixel(scale));
    }
  }
});
