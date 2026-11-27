import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/build/png";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { expect, it } from "vitest";

import { dogFaceKey, gearIconKey } from "../assets/index.ts";
import { gameData } from "../data/index.ts";
import { hudEffectIconKey, walkerEffectItems } from "../presentation/index.ts";
import { sheetTagFrames } from "../ui/dom/sheetFrames.ts";
import { START_PICKER_INK } from "./startPickerArt.ts";

it("matches the visible union of every Start portrait, perk and gear icon", () => {
  const keys = [
    ...keysOf(gameData.dogs).map((id) => dogFaceKey(gameData, id)),
    ...keysOf(gameData.shopGear).map(gearIconKey),
    ...keysOf(gameData.walkers).flatMap((id) => [
      gameData.walkers[id].portraitKey,
      ...walkerEffectItems(gameData, id).map(hudEffectIconKey),
    ]),
  ];
  expect(new Set(Object.keys(START_PICKER_INK))).toEqual(new Set(keys));
  for (const key of keys) {
    const portrait = key.startsWith("face-");
    const path = `public/art/${portrait ? "sprites" : "images"}/${key}`;
    const png = decodePng(readFileSync(`${path}.png`));
    const json: unknown = portrait ? JSON.parse(readFileSync(`${path}.json`, "utf8")) : undefined;
    const frames = portrait
      ? ["neutral", "happy"].flatMap((tag) => sheetTagFrames(json, tag))
      : [{ height: png.height, width: png.width, x: 0, y: 0 }];
    let left = png.width;
    let top = png.height;
    let right = 0;
    let bottom = 0;
    for (const frame of frames) {
      for (let y = 0; y < frame.height; y += 1) {
        for (let x = 0; x < frame.width; x += 1) {
          if (png.data[4 * ((frame.y + y) * png.width + frame.x + x) + 3] !== 0) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + 1);
            bottom = Math.max(bottom, y + 1);
          }
        }
      }
    }
    expect([left, top, right, bottom], key).toEqual(START_PICKER_INK[key]);
  }
});
