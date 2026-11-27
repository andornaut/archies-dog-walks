import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { dogPortraitKey, gearIconKey } from "../assets/index.ts";
import { gameData, UI_PICTURE_SIZE } from "../data/index.ts";
import type { DetailPicture, Purchase } from "../home/index.ts";
import { type Badge, PALETTE } from "../ui/index.ts";
import { addPixelText, fillRect } from "../ui/phaser/index.ts";

// The home screen's and the shop's art keys, each with a drawn stand-in below while missing.
export const SHOP_ART = {
  dogSlot: "icon-dog-slot",
  petShop: "ui-pet-shop",
  petShopBoard: "ui-pet-shop-board",
} as const;

// Each badge's art.
export const BADGE_KEYS: Readonly<Record<Badge, string>> = {
  bill: "icon-bill",
  lock: "icon-lock",
};

// A purchase's picture on its detail card: a dog's portrait, a gear item's icon or the slot's art
// at 2x.
export function purchasePicture(purchase: Purchase): DetailPicture {
  const scale = UI_PICTURE_SIZE.detail / UI_PICTURE_SIZE.standard;
  switch (purchase.kind) {
    case "dog":
      return { key: dogPortraitKey(gameData, purchase.dog), scale: 1 };
    case "dogSlot":
      return { key: SHOP_ART.dogSlot, scale };
    case "gear":
      return { key: gearIconKey(purchase.gear), scale };
    default:
      return purchase satisfies never;
  }
}

// The pet shop building drawn in code while ui-pet-shop is missing: green walls, a striped
// awning, a window and a door, under a board with the shop's name.
export function drawPetShopFallback(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  name: string,
): GameObjects.Graphics {
  const { height, width, x, y } = rect;
  const g = scene.add.graphics();
  fillRect(g, PALETTE.ink, { height: height - 18, width: width - 8, x: x + 4, y: y + 18 });
  fillRect(g, PALETTE.darkGreen, { height: height - 20, width: width - 10, x: x + 5, y: y + 19 });
  for (let stripe = 0; stripe < width - 6; stripe += 12) {
    fillRect(g, PALETTE.red, { height: 12, width: 6, x: x + 3 + stripe, y: y + 24 });
    fillRect(g, PALETTE.white, { height: 12, width: 6, x: x + 9 + stripe, y: y + 24 });
  }
  fillRect(g, PALETTE.cyan, { height: 46, width: 56, x: x + 10, y: y + 44 });
  fillRect(g, PALETTE.navy, { height: height - 48, width: 30, x: x + 76, y: y + 44 });
  // The board is Start walk's green, as every tappable entry point is.
  fillRect(g, PALETTE.ink, { height: 18, width: 74, x: x + 23, y });
  fillRect(g, PALETTE.green, { height: 16, width: 72, x: x + 24, y: y + 1 });
  parent.add(g);
  const focusFace = scene.add.graphics().setVisible(false);
  fillRect(focusFace, PALETTE.cyan, { height: 16, width: 72, x: x + 24, y: y + 1 });
  parent.add(focusFace);
  parent.add(
    addPixelText(scene, x + width / 2, y + 5, name, {
      colour: PALETTE.ink,
      font: "title",
      originX: 0.5,
    }),
  );
  return focusFace;
}
