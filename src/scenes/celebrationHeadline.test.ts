import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { CELEBRATION_LAYOUT } from "../hud/celebrationLayout.ts";
import { celebrationText } from "../hud/zoneCelebration.ts";
import { fontFileMetrics, fontInk, phaserFontData } from "../testing/fontInk.ts";
import { addDisplayText } from "../ui/phaser/displayText.ts";
import { addCelebrationHeadline } from "./celebrationHeadline.ts";

vi.mock("../ui/phaser/displayText.ts", () => ({ addDisplayText: vi.fn() }));

class Label {
  readonly font: string;
  text: string;
  scaleX = 1;
  scaleY = 1;
  x = 0;
  y = 0;
  constructor(font: string, text: string) {
    this.font = font;
    this.text = text;
  }
  setScale(scale: number) {
    this.scaleX = scale;
    this.scaleY = scale;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setText(text: string) {
    this.text = text;
    return this;
  }
}

const welcome = celebrationText(gameData, { kind: "newWalker", walker: "mrB" });

describe("full-scene celebration headings", () => {
  it.each([
    { lines: ["NEW", "WALKER!"], title: gameData.runText.newWalker.title },
    { lines: ["WELL", "WALKED!"], title: gameData.runText.zoneDone.title },
  ])("renders $title at actual3x with fixed visible-ink positions", ({ lines, title }) => {
    const labels: Label[] = [];
    vi.mocked(addDisplayText).mockImplementation((_scene, _x, _y, text, style) => {
      const label = new Label(
        style.variant === "cream" ? "font-display-cream" : "font-display",
        text.toUpperCase(),
      );
      labels.push(label);
      return label as unknown as ReturnType<typeof addDisplayText>;
    });
    const scene = {
      cache: { bitmapFont: { get: (key: string) => ({ data: phaserFontData(key) }) } },
    };
    addCelebrationHeadline(scene as unknown as Scene, { subtitle: welcome.subtitle, title });
    expect(labels.map(({ text }) => text)).toEqual([...lines, welcome.subtitle.toUpperCase()]);
    expect(labels.map(({ scaleX }) => scaleX)).toEqual([3, 3, 1]);
    expect(
      labels.map((label) => label.y + fontFileMetrics(label.font).letterTop * label.scaleY),
    ).toEqual([44, 94, 146]);
    labels.forEach((label) => {
      const ink = fontInk(label.font, { scale: label.scaleX }, label.text);
      expect(label.x + ink.left).toBeGreaterThanOrEqual(16);
      expect(label.x + ink.right).toBeLessThanOrEqual(344);
      expect(Math.abs(label.x + (ink.left + ink.right) / 2 - 180)).toBeLessThanOrEqual(0.5);
    });
    expect(CELEBRATION_LAYOUT.subtitleInkTop - (94 + 14 * 3)).toBe(10);
  });
});
