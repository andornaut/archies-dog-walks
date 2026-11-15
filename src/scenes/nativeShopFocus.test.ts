import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { shopFocusView } from "../home/shopFocusView.ts";
import { rowRects, SHOP_LAYOUT } from "../home/shopLayout.ts";
import { addShopFocusFrame } from "./uiKit.ts";

it("keeps the native shop focus contour identical to the existing authored drawer", () => {
  const rect = rowRects(SHOP_LAYOUT.row.width, SHOP_LAYOUT.gear.rows, 1)[0]!;
  const painted: {
    colour: number;
    rect: { x: number; y: number; width: number; height: number };
  }[] = [];
  let colour = 0;
  const graphics = {
    fillRect(x: number, y: number, width: number, height: number) {
      painted.push({ colour, rect: { height, width, x, y } });
      return this;
    },
    fillStyle(value: number) {
      colour = value;
      return this;
    },
  };
  const scene = sceneStub(vi.fn, { add: { graphics: () => graphics } });
  addShopFocusFrame(
    scene as unknown as Scene,
    { add: vi.fn() } as unknown as GameObjects.Container,
    rect,
    true,
  );
  expect(shopFocusView(rect).fills).toEqual(painted);
});
