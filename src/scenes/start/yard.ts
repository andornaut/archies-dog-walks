import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { dogSpriteKey } from "../../assets/index.ts";
import { playEffect, spriteMetrics } from "../../assets/phaser/index.ts";
import type { DogId } from "../../data/ids.ts";
import { gameData } from "../../data/index.ts";
import {
  FEEDBACK,
  HOME_LAYOUT,
  type HomeLoadout,
  porchOwners,
  shopAffordable,
} from "../../home/index.ts";
import { type PackPlacement, SCREEN_LAYOUT } from "../../layout/index.ts";
import { addFigure, PackFigures } from "../../pack/phaser/index.ts";
import type { SaveDocument } from "../../save/index.ts";
import { PALETTE } from "../../ui/index.ts";
import { drawShadow } from "../../ui/phaser/index.ts";
import { addAffordFrame } from "../homePanels.ts";
import { drawPetShopFallback, SHOP_ART } from "../itemArt.ts";
import { addOwnerFigure } from "../ownerFigure.ts";
import { currentSettings, walkerSpriteKey } from "../profileStore.ts";
import { maskToRect } from "../scrollView.ts";
import { addShopBoard, addShopIdle, type ShopBoard, type ShopIdle } from "../shopIdle.ts";
import { addTagImage, type IconButton } from "../uiKit.ts";
import { targetId } from "./targets.ts";

const GATE = HOME_LAYOUT.gate;
const PATH = HOME_LAYOUT.path;
const WALKER_AT_GATE = HOME_LAYOUT.walkerAtGate;
const GATE_SPOTS: readonly PackPlacement[] = HOME_LAYOUT.gateSpots;
const PORCH_SPOTS: Readonly<Partial<Record<DogId, { footY: number; x: number }>>> =
  HOME_LAYOUT.porchSpots;
const PORCH_DOG_OFFSET = HOME_LAYOUT.porchDogOffset;
const PET_SHOP: Rect = HOME_LAYOUT.petShop;
const PET_SHOP_BOARD: Rect = HOME_LAYOUT.petShop.board;
const GEAR_BADGE: Rect = HOME_LAYOUT.gearBadge;
// The gate scene, which crops the Pet shop group: its foot sits under the divider strip.
export const HERO_CROP: Rect = { ...GATE, width: SCREEN_LAYOUT.screen.width, x: 0 };
const HERO_MASK_KEY = "home-hero-mask";

export interface GateDog {
  readonly dog: DogId;
  readonly footY: number;
  readonly sprite: GameObjects.Sprite;
}

export interface YardShop {
  readonly container: GameObjects.Container;
  focusFallback?: GameObjects.Graphics;
  iconButton?: IconButton;
  shopBoard?: ShopBoard;
  shopIdle?: ShopIdle;
}

// The starter owners waiting at the gate until the first walk; a picked dog has gone to the
// walker and leaves its owner standing alone.
function drawPorch(
  scene: Scene,
  {
    root,
    save,
    yard,
  }: {
    readonly root: GameObjects.Container;
    readonly save: SaveDocument;
    readonly yard: GameObjects.Graphics;
  },
  reduced: boolean,
  dogs: readonly DogId[],
): void {
  const waiting = porchOwners(gameData, save.stats, dogs).flatMap((owner) => {
    const at = PORCH_SPOTS[owner.dog];
    return at === undefined ? [] : [{ ...owner, at }];
  });
  // Owners first, then the dogs in front of them.
  for (const { at, dog } of waiting) {
    drawShadow(yard, PALETTE.darkGreen, at.x, at.footY, 20);
    root.add(addOwnerFigure(scene, gameData, reduced, dog, at, ["idle"]));
  }
  for (const { at, dog } of waiting.filter(({ withDog }) => withDog)) {
    const key = dogSpriteKey(gameData, dog);
    const x = at.x + PORCH_DOG_OFFSET.dx;
    const footY = at.footY + PORCH_DOG_OFFSET.footDy;
    drawShadow(yard, PALETTE.darkGreen, x, footY, spriteMetrics(key).opaqueWidth);
    root.add(addFigure(scene, reduced, "idle", key).sprite.setPosition(x, footY));
  }
}

// The walker and pack at the gate, with their shadows on the yard.
export function drawStartGate(
  scene: Scene,
  context: {
    readonly purchasePops: ReadonlyMap<string, number>;
    readonly root: GameObjects.Container;
    readonly save: SaveDocument;
    readonly yard: GameObjects.Graphics;
  },
  loadout: HomeLoadout,
): { bubbleHits: Rect[]; gateDogs: GateDog[] } {
  const { purchasePops, root, save, yard } = context;
  const { footY, x } = WALKER_AT_GATE;
  const reduced = currentSettings(scene).reducedMotion;
  drawPorch(scene, context, reduced, loadout.dogs);
  const walkerKey = save.walker === null ? undefined : walkerSpriteKey(scene, save.walker);
  const dogs = loadout.dogs.map((dog, rank) => {
    const placement = itemAt(GATE_SPOTS, rank);
    return {
      dog,
      feet: { footY: footY + placement.footDy, x: x + placement.dx },
      placement,
      rank,
    };
  });
  // With no walker picked, the dogs stand without leashes.
  const figures = new PackFigures(scene, { still: reduced, tag: "walk" }, walkerKey, loadout.dogs);
  figures.standInYard(yard, { path: PATH, shadows: false }, { dogs, walker: { footY, x } });
  root.add(figures.layers());
  const walkerSprite = figures.walker?.sprite;
  const bubbleHits = walkerSprite !== undefined ? [walkerSprite.getBounds()] : [];
  const now = scene.time.now;
  const gateDogs: GateDog[] = [];
  for (const { dog, feet } of dogs) {
    const sprite = figures.dogs.get(dog);
    if (sprite !== undefined) {
      gateDogs.push({ dog, footY: feet.footY, sprite });
    }
    // A just-purchased dog hops onto the path in a puff of dust.
    const popped = purchasePops.get(targetId({ dog, kind: "dog" }));
    if (!reduced && popped !== undefined && now - popped < FEEDBACK.dustFrameMs) {
      playEffect(scene, "fx-dust", "play", { x: feet.x, y: feet.footY - 6 }, 0);
    }
  }
  return { bubbleHits, gateDogs };
}

export function gearBadgeAtGate(loadout: HomeLoadout): Rect | undefined {
  if (loadout.gear === null) {
    return undefined;
  }
  const clear = Math.max(
    GEAR_BADGE.x,
    ...loadout.dogs.flatMap((dog, rank) => {
      const placement = itemAt(GATE_SPOTS, rank);
      const footY = WALKER_AT_GATE.footY + placement.footDy;
      const x = WALKER_AT_GATE.x + placement.dx;
      return footY > GEAR_BADGE.y
        ? [x + Math.ceil(spriteMetrics(dogSpriteKey(gameData, dog)).opaqueWidth / 2) + 1]
        : [];
    }),
  );
  return { ...GEAR_BADGE, x: Math.min(clear, PET_SHOP.x - GEAR_BADGE.width) };
}

// The Pet shop on the yard's right lot: ui-pet-shop under ui-pet-shop-board, which bobs while
// up and alone sinks while pressed, with the gold outline while anything inside is
// affordable. Drawn in code while the art is missing, when the whole building dips instead.
export function drawStartShop(
  scene: Scene,
  { focus, root }: { readonly focus: () => boolean; readonly root: GameObjects.Container },
  save: SaveDocument,
): YardShop {
  const container = scene.add.container(0, 0);
  root.add(container);
  const view: YardShop = { container };
  maskToRect(scene, HERO_MASK_KEY, HERO_CROP, view.container);
  const focused = focus();
  const faces = addPressFaces(scene, SHOP_ART.petShop, PET_SHOP);
  if (faces !== undefined) {
    const [normal, pressed] = faces;
    view.container.add(faces);
    const idle = addShopIdle(scene, view.container, faces);
    if (idle !== undefined) {
      view.shopIdle = idle;
    }
    const shop: IconButton = idle ?? {
      setPressed: (down) => {
        normal.setVisible(!down);
        pressed.setVisible(down);
      },
    };
    // The board draws over the door-wave.
    const board = addPressFaces(scene, SHOP_ART.petShopBoard, PET_SHOP_BOARD);
    if (board === undefined) {
      view.iconButton = shop;
    } else {
      view.container.add(board);
      const focusFace = focused
        ? addTagImage(scene, SHOP_ART.petShopBoard, "focused", PET_SHOP_BOARD.x, PET_SHOP_BOARD.y)
        : undefined;
      if (focusFace !== undefined) {
        view.container.add(focusFace);
      }
      // The building stays up; only the board presses.
      shop.setPressed(false);
      view.shopBoard = addShopBoard(board, focusFace);
      view.iconButton = view.shopBoard;
    }
    view.iconButton.setPressed(false);
  } else {
    const fallback = drawPetShopFallback(
      scene,
      view.container,
      PET_SHOP,
      gameData.homeText.shop.title,
    );
    if (focused) {
      view.focusFallback = fallback.setVisible(true);
    }
  }
  if (shopAffordable(gameData, save.owned, save.bankCents)) {
    addAffordFrame(scene, view.container, PET_SHOP, currentSettings(scene).reducedMotion);
  }
  return view;
}

// Draw the normal and pressed faces together. If either is missing, discard the other.
function addPressFaces(
  scene: Scene,
  key: string,
  at: { readonly x: number; readonly y: number },
): [GameObjects.Image, GameObjects.Image] | undefined {
  const normal = addTagImage(scene, key, "normal", at.x, at.y);
  const pressed = addTagImage(scene, key, "pressed", at.x, at.y);
  if (normal === undefined || pressed === undefined) {
    normal?.destroy();
    pressed?.destroy();
    return undefined;
  }
  return [normal, pressed];
}
