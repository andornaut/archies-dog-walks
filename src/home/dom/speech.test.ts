import { readFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import { domArtPath } from "../../assets/domArt.ts";
import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { walkerSays } from "../homeLines.ts";
import { homeSpeechView } from "../speechView.ts";
import { createHomeSpeech } from "./speech.ts";
function fixture(hasArt: boolean) {
  const doc = new FakeDocument();
  const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
  const loadSheet = vi.fn(async (url: string) => ownArtFrames(url));
  const path = domArtPath("image", "ui-quip", "png");
  const png = readFileSync(`public/art/${path}`);
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    hasArt: () => hasArt,
    imageSize: () => ({ height: png.readUInt32BE(20), width: png.readUInt32BE(16) }),
    loadSheet,
  };
  const view = homeSpeechView(gameData, fonts.body, undefined, {
    owner: null,
    paragraphs: [walkerSays(gameData, "firstVisit", null)],
  });
  const speech = createHomeSpeech(doc as unknown as Document, source, fonts, () => undefined, view);
  return { loadSheet, path, speech, view };
}
it("paints the authored speech-frame image from its one frame on its sheet", async () => {
  const { loadSheet, path, speech } = fixture(true);
  const urls = await speech.ready;
  speech.place(domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const parts = (speech.element as unknown as FakeElement).all();
  expect(loadSheet).toHaveBeenCalledWith(`/art/${domArtPath("image", "ui-quip", "json")}`);
  expect(urls).toContain(`/art/${path}`);
  expect(parts.some((node) => node.style.backgroundImage?.includes(path))).toBe(true);
  expect(parts[0]?.style.visibility).not.toBe("hidden");
});
it("keeps the framed cream speech fallback when the source texture is absent", async () => {
  const { loadSheet, speech, view } = fixture(false);
  expect(await speech.ready).toEqual([]);
  speech.place(domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const parts = (speech.element as unknown as FakeElement).all();
  expect(loadSheet).not.toHaveBeenCalled();
  expect(parts.some((node) => node.style.backgroundColor === `#${PALETTE.plum.toString(16)}`)).toBe(
    true,
  );
  expect(
    parts.some((node) => node.style.backgroundColor === `#${PALETTE.cream.toString(16)}`),
  ).toBe(true);
  expect(parts.some((node) => node.style.width === `${view.rect.width}px`)).toBe(true);
});
