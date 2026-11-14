import { itemAt } from "@andornaut/game-kit/arrays";
import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { dogFaceKey } from "../../assets/spriteKeys.ts";
import type { DogId, GameData, GearId, WalkerId } from "../../data/types.ts";
import {
  EFFECT_ICON_SIZE,
  effectIconFallback,
  effectIconKey,
  walkerEffectItems,
} from "../../hud/effectIcons.ts";
import { dollarText } from "../../presentation/currency.ts";
import type { SaveDocument } from "../../save/schema.ts";
import { addPlate, addTileBadge, plateColours } from "../../scenes/itemArt.ts";
import {
  addBodyText,
  addGraphicsIn,
  addSelectTile,
  addTileSprite,
  type SelectTile,
  type SelectTileOptions,
  tileTextureKey,
} from "../../scenes/uiKit.ts";
import { type ItemTile, itemTile, itemTileLook } from "../../ui/interaction.ts";
import { PALETTE } from "../../ui/palette.ts";
import { fillRect } from "../../ui/phaser/draw.ts";
import { pixelFontMetrics } from "../../ui/phaser/pixelText.ts";
import { pictureBox, type SelectLook } from "../../ui/selection.ts";
import {
  type HomeLoadout,
  isAffordable,
  packCapacity,
  type Purchase,
  purchasePrice,
} from "../home.ts";
import { dogTileNameY, dogTilePlateY, HOME_LAYOUT } from "../homeLayout.ts";
import { walkerTile } from "../walkers.ts";
import { addGearPicture } from "./gearPicture.ts";
import type { TileView } from "./tileFeedbackView.ts";

interface SelectionContext {
  readonly scene: Scene;
  readonly root: GameObjects.Container;
  readonly reducedMotion: boolean;
  readonly data: Pick<
    GameData,
    "dogSlots" | "dogs" | "runText" | "shopGear" | "tuning" | "upgrades" | "walkerPerks" | "walkers"
  >;
}
interface SelectionCell<Id> {
  readonly id: Id;
  readonly feedbackId: string;
  readonly rect: Rect;
}
interface HomeSelectionSnapshot {
  readonly save: Pick<SaveDocument, "bankCents" | "owned" | "walker">;
  readonly loadout: HomeLoadout;
  readonly dogs: readonly SelectionCell<DogId>[];
  readonly gear: readonly SelectionCell<GearId>[];
  readonly walkers: readonly SelectionCell<WalkerId>[];
}
const TILE_SELECT_OUTSET = HOME_LAYOUT.tileSelectOutset;
const DOG_TILE = HOME_LAYOUT.dogTile;
const POCKET = HOME_LAYOUT.pocket;
const WALKER_TILE = HOME_LAYOUT.walkerTile;

export function renderHomeSelections(
  context: SelectionContext,
  snapshot: HomeSelectionSnapshot,
): readonly [string, TileView][] {
  const views: [string, TileView][] = [];
  drawWalkerPicker(context, snapshot, views);
  drawDogTiles(context, snapshot, views);
  drawPocket(context, snapshot, views);
  return views;
}

function selectTile(
  context: SelectionContext,
  views: [string, TileView][],
  id: string,
  rect: Rect,
  options: Omit<SelectTileOptions, "outset" | "reducedMotion">,
): { content: GameObjects.Container; look: SelectLook; view: TileView } {
  const { root, scene } = context;
  const reducedMotion = context.reducedMotion;
  const tile: SelectTile = addSelectTile(scene, root, rect, {
    ...options,
    outset: TILE_SELECT_OUTSET,
    reducedMotion,
  });
  const view: TileView = { container: tile.container, lift: tile.lift };
  if (tile.mark !== undefined) {
    view.mark = { image: tile.mark, y: tile.mark.y };
  }
  views.push([id, view]);
  return { content: tile.content, look: tile.look, view };
}

function lockedPlate(
  scene: Scene,
  parent: GameObjects.Container,
  tile: ItemTile,
  at: { capY: number; originX: number; x: number },
): void {
  const { plate } = itemTileLook(tile);
  const text =
    tile.kind === "locked" ? dollarText(tile.price) : tile.kind === "goal" ? tile.goal : null;
  if (text !== null && plate !== null) {
    addPlate(scene, parent, at, text, plateColours(plate));
  }
}

function drawDogTiles(
  context: SelectionContext,
  snapshot: HomeSelectionSnapshot,
  views: [string, TileView][],
): void {
  const { scene } = context;
  const { save } = snapshot;
  const { owned } = save;
  const reduced = context.reducedMotion;
  const capacity = packCapacity(context.data, owned);
  snapshot.dogs.forEach(({ feedbackId, id, rect }) => {
    const { x, y } = rect;
    const dog = context.data.dogs[id];
    const purchase: Purchase = { dog: id, kind: "dog" };
    const tile = itemTile({
      affordable: isAffordable(context.data, owned, save.bankCents, purchase),
      capacity,
      goal: null,
      picked: snapshot.loadout.dogs.includes(id),
      pickedCount: snapshot.loadout.dogs.length,
      price: purchasePrice(context.data, owned, purchase),
    });
    const { art, badge, state } = itemTileLook(tile);
    const { content, look, view } = selectTile(context, views, feedbackId, rect, {
      edge: true,
      // A picked dog wears a tick: the game sets the pack's order by the dogs' sizes.
      mark: "tick",
      state,
      tile: true,
    });
    const ink = PALETTE[look.text];
    const { badge: badgeAt, face: faceBox, lockedNameY, textX } = DOG_TILE;
    fillRect(addGraphicsIn(scene, content), PALETTE[pictureBox({ art, state })], {
      height: faceBox.size + 2,
      width: faceBox.size + 2,
      x: x + faceBox.dx - 1,
      y: y + faceBox.dy - 1,
    });
    const faceKey = dogFaceKey(context.data, id);
    const faceTag = badge === null ? "happy" : "neutral";
    const faceAt = { x: x + faceBox.dx, y: y + faceBox.dy };
    // A dog not owned holds its first frame, in colour while the player can buy it.
    const still = reduced || badge !== null;
    const face = addTileSprite(scene, art, still, faceKey, faceTag, faceAt);
    content.add(face);
    view.face = { object: face, y: faceAt.y };

    const body = pixelFontMetrics(scene, "body");
    const nameText = (value: string, top: number) => {
      addBodyText(scene, content, { x: x + textX, y: top }, value, { colour: ink });
    };
    if (badge === null) {
      // Every dog earns the same pay, so an owned tile names the dog alone; its card says the
      // pay.
      nameText(dog.name, y + dogTileNameY(body));
      return;
    }
    // A locked dog shows its name over its price plate, and its badge.
    nameText(dog.name, y + lockedNameY);
    addTileBadge(scene, content, badge, { x: x + badgeAt.dx, y: y + badgeAt.dy });
    const plateY = dogTilePlateY(body);
    lockedPlate(scene, content, tile, { capY: y + plateY - 1, originX: 0, x: x + textX });
  });
}

function drawPocket(
  context: SelectionContext,
  snapshot: HomeSelectionSnapshot,
  views: [string, TileView][],
): void {
  const { scene } = context;
  const { save } = snapshot;
  const { owned } = save;
  const pocketed = snapshot.loadout.gear;
  snapshot.gear.forEach(({ feedbackId, id, rect }) => {
    const { width, x, y } = rect;
    const purchase: Purchase = { gear: id, kind: "gear" };
    const tile = itemTile({
      affordable: isAffordable(context.data, owned, save.bankCents, purchase),
      capacity: 1,
      goal: null,
      picked: pocketed === id,
      pickedCount: pocketed === null ? 0 : 1,
      price: purchasePrice(context.data, owned, purchase),
    });
    const { art, badge, state } = itemTileLook(tile);
    const { content, view } = selectTile(context, views, feedbackId, rect, {
      edge: true,
      mark: "tick",
      state,
      tile: true,
    });
    const { badge: badgeAt, box, icon: iconAt } = POCKET;
    fillRect(addGraphicsIn(scene, content), PALETTE[pictureBox({ art, state })], {
      height: box.size,
      width: box.size,
      x: x + box.dx,
      y: y + box.dy,
    });
    const at = { x: x + iconAt.dx, y: y + iconAt.dy };
    const icon = addGearPicture(context, content, art, id, at, 1);
    if (icon !== undefined) {
      view.face = { object: icon, y: at.y };
    }
    if (badge !== null) {
      addTileBadge(scene, content, badge, { x: x + badgeAt.dx, y: y + badgeAt.dy });
      const plateAt = { capY: y + POCKET.priceY, originX: 0.5, x: x + width / 2 };
      lockedPlate(scene, content, tile, plateAt);
    }
  });
}

function drawWalkerPicker(
  context: SelectionContext,
  snapshot: HomeSelectionSnapshot,
  views: [string, TileView][],
): void {
  const { scene } = context;
  const { save } = snapshot;
  const reduced = context.reducedMotion;
  snapshot.walkers.forEach(({ feedbackId, id, rect }) => {
    const { x, y } = rect;
    const tile = walkerTile(context.data, save, id);
    const { art, badge, state } = itemTileLook(tile);
    const { content, look, view } = selectTile(context, views, feedbackId, rect, {
      edge: true,
      mark: "tick",
      state,
      tile: true,
    });
    const { badge: badgeAt, box, face: faceAt, icons, plateY } = WALKER_TILE;
    fillRect(addGraphicsIn(scene, content), PALETTE[pictureBox({ art, state })], {
      height: box.size,
      width: box.size,
      x: x + box.dx,
      y: y + box.dy,
    });
    const walker = context.data.walkers[id];
    const at = { x: x + faceAt.dx, y: y + faceAt.dy };
    if (scene.textures.exists(walker.portraitKey)) {
      const tag = tile.kind === "picked" ? "happy" : "neutral";
      const face = addTileSprite(scene, art, reduced, walker.portraitKey, tag, at);
      content.add(face);
      view.face = { object: face, y: at.y };
    } else {
      const centre = { x: x + box.dx + box.size / 2, y: y + box.dy + box.size / 2 };
      addBodyText(scene, content, { x: centre.x, y: centre.y }, walker.name.charAt(0), {
        colour: PALETTE[look.text],
        font: "title",
        originX: 0.5,
        originY: 0.5,
      });
    }
    if (badge !== null) {
      addTileBadge(scene, content, badge, { x: x + badgeAt.dx, y: y + badgeAt.dy });
    }
    // Every walker's name on the goal plate, owned or locked.
    const plateAt = { capY: y + plateY, originX: 0.5, x: x + rect.width / 2 };
    addPlate(scene, content, plateAt, walker.name, plateColours("goal"));
    walkerEffectItems(context.data, id).forEach((item, n) => {
      const iconAt = { x: x + icons.dx, y: y + itemAt(icons.dy, n) };
      const key = effectIconKey(item);
      if (scene.textures.exists(key)) {
        const shown = tileTextureKey(scene, art, key);
        content.add(scene.add.image(iconAt.x, iconAt.y, shown).setOrigin(0));
        return;
      }
      const half = EFFECT_ICON_SIZE / 2;
      const letter = effectIconFallback(context.data, item);
      addBodyText(scene, content, { x: iconAt.x + half, y: iconAt.y + half }, letter, {
        colour: PALETTE[look.text],
        originX: 0.5,
        originY: 0.5,
      });
    });
  });
}
