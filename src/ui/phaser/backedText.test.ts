import type { GameObjects } from "phaser";
import { expect, it } from "vitest";

import { centreBackedText } from "./backedText.ts";

it("centres canvas note ink rather than advances and retains the line pitch", () => {
  const makeLabel = (y: number, width: number, height: number) => {
    const label = {
      displayOriginX: width / 2 + 2,
      displayOriginY: 0,
      getTextBounds: () => ({ characters: [{ h: height, w: width, x: 1, y: 2 }] }),
      scaleX: 2,
      scaleY: 2,
      setPosition: (x: number, y: number) => {
        label.x = x;
        label.y = y;
      },
      x: 180,
      y,
    };
    return label;
  };
  const labels = [makeLabel(364, 90, 8), makeLabel(384, 12, 7)];
  const backing = { height: 42, width: 220, x: 70, y: 360 };
  centreBackedText(backing, labels as unknown as GameObjects.BitmapText[]);
  const ink = labels.map((label) => {
    const char = label.getTextBounds().characters[0]!;
    return {
      bottom: label.y + (char.y + char.h) * 2,
      left: label.x + (char.x - label.displayOriginX) * 2,
      right: label.x + (char.x + char.w - label.displayOriginX) * 2,
      top: label.y + char.y * 2,
    };
  });
  expect(ink.map(({ left, right }) => (left + right) / 2)).toEqual([180, 180]);
  expect((ink[0]!.top + ink[1]!.bottom) / 2).toBe(381);
  expect(labels[1]!.y - labels[0]!.y).toBe(20);
  expect(labels.map(({ scaleX, scaleY }) => [scaleX, scaleY])).toEqual([
    [2, 2],
    [2, 2],
  ]);
});
