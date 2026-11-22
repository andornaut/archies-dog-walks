import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { FontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { dogFaceKey, gearIconKey } from "../assets/spriteKeys.ts";
import type { DogId, GameData, GearId, WalkerId } from "../data/types.ts";
import { effectIconKey, walkerEffectItems } from "../hud/effectIcons.ts";
import { dollarText } from "../presentation/currency.ts";
import type { SaveDocument } from "../save/schema.ts";
import {
  type ArtLook,
  type Badge,
  type ItemTile,
  itemTile,
  itemTileLook,
} from "../ui/interaction.ts";
import type { PanelText } from "../ui/modal/types.ts";
import { PALETTE } from "../ui/palette.ts";
import { pictureBox, type PlateKind, selectLook } from "../ui/selection.ts";
import { gearPictureFallback } from "./gearPictureView.ts";
import {
  type HomeLoadout,
  isAffordable,
  packCapacity,
  type Purchase,
  purchasePrice,
} from "./home.ts";
import { dogTileNameY, dogTilePlateY, HOME_LAYOUT, tileStrip } from "./homeLayout.ts";
import { walkerTile } from "./walkers.ts";
export interface HomeSelectionCell<Id> {
  readonly id: Id;
  readonly feedbackId: string;
  readonly hit: Rect;
  readonly rect: Rect;
}
export interface HomeSelectionSnapshot {
  readonly save: Pick<SaveDocument, "bankCents" | "owned" | "walker">;
  readonly loadout: HomeLoadout;
  readonly dogs: readonly HomeSelectionCell<DogId>[];
  readonly gear: readonly HomeSelectionCell<GearId>[];
  readonly walkers: readonly HomeSelectionCell<WalkerId>[];
}
export interface HomeSelectionPicture {
  readonly fallback?: PanelText;
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly tag?: string;
  readonly scale: number;
  readonly moving: boolean;
}
export interface HomeSelectionView {
  readonly id: string;
  readonly label: string;
  readonly hit: Rect;
  readonly rect: Rect;
  readonly tile: ItemTile;
  readonly art: ArtLook;
  readonly fill: {
    readonly colour: number;
    readonly rect: Rect;
  };
  readonly pictures: readonly HomeSelectionPicture[];
  readonly name?: {
    readonly text: string;
    readonly x: number;
    readonly capTop: number;
    // Where the name's ink is centred across and down, when it is.
    readonly centreIn?: Rect;
  };
  readonly plate?: {
    readonly text: string;
    readonly kind: PlateKind;
    readonly x: number;
    readonly capTop: number;
    readonly originX: number;
    // The label strip across the tile's foot that carries the text, when it has one.
    readonly strip?: Rect;
  };
  readonly badge?: {
    readonly kind: Badge;
    readonly x: number;
    readonly y: number;
  };
}
type SelectionData = Pick<
  GameData,
  "dogSlots" | "dogs" | "runText" | "shopGear" | "tuning" | "upgrades" | "walkerPerks" | "walkers"
>;
// The home picker uses authored geometry and one interaction state for its art, copy and plate.
export function homeSelectionViews(
  data: SelectionData,
  body: FontMetrics,
  reducedMotion: boolean,
  snapshot: HomeSelectionSnapshot,
): readonly HomeSelectionView[] {
  const result: HomeSelectionView[] = [];
  const { loadout, save } = snapshot;
  const capacity = packCapacity(data, save.owned);
  const make = (
    cell: HomeSelectionCell<unknown>,
    tile: ItemTile,
    box: {
      readonly dx: number;
      readonly dy: number;
      readonly size: number;
    },
    badgeAt: {
      readonly dx: number;
      readonly dy: number;
    },
  ): HomeSelectionView => {
    const look = itemTileLook(tile);
    const { x, y } = cell.rect;
    return {
      art: look.art,
      fill: {
        colour: PALETTE[pictureBox(look)],
        rect: {
          height: box.size,
          width: box.size,
          x: x + box.dx,
          y: y + box.dy,
        },
      },
      hit: cell.hit,
      id: cell.feedbackId,
      label: "",
      pictures: [],
      rect: cell.rect,
      tile,
      ...(look.badge === null
        ? {}
        : { badge: { kind: look.badge, x: x + badgeAt.dx, y: y + badgeAt.dy } }),
    };
  };
  const pricePlate = (tile: ItemTile, x: number, capTop: number, originX: number, strip?: Rect) => {
    const kind = itemTileLook(tile).plate;
    const text =
      tile.kind === "locked" ? dollarText(tile.price) : tile.kind === "goal" ? tile.goal : null;
    return text === null || kind === null
      ? {}
      : { plate: { capTop, kind, originX, text, x, ...(strip === undefined ? {} : { strip }) } };
  };
  for (const cell of snapshot.walkers) {
    const { width, x, y } = cell.rect;
    const { badge, box, face, icons, strip } = HOME_LAYOUT.walkerTile;
    const walkerStrip = tileStrip(cell.rect, strip);
    const tile = walkerTile(data, save, cell.id);
    const walker = data.walkers[cell.id];
    const portrait = {
      key: walker.portraitKey,
      moving: !reducedMotion,
      scale: face.size / 32,
      tag: tile.kind === "picked" ? "happy" : "neutral",
      x: x + face.dx,
      y: y + face.dy,
    };
    const pictures = [
      portrait,
      ...walkerEffectItems(data, cell.id).map((item, i) => ({
        key: effectIconKey(item),
        moving: false,
        scale: 1,
        x: x + icons.dx,
        y: y + itemAt(icons.dy, i),
      })),
    ];
    result.push({
      ...make(cell, tile, box, badge),
      label: walker.name,
      pictures,
      plate: {
        capTop: walkerStrip.y + 1,
        kind: "goal",
        originX: 0.5,
        strip: walkerStrip,
        text: walker.name,
        x: x + width / 2,
      },
    });
  }
  for (const cell of snapshot.dogs) {
    const { x, y } = cell.rect;
    const dog = data.dogs[cell.id];
    const purchase: Purchase = { dog: cell.id, kind: "dog" };
    const tile = itemTile({
      affordable: isAffordable(data, save.owned, save.bankCents, purchase),
      capacity,
      goal: null,
      picked: loadout.dogs.includes(cell.id),
      pickedCount: loadout.dogs.length,
      price: purchasePrice(data, save.owned, purchase),
    });
    const { badge, face, lockedNameY, textX } = HOME_LAYOUT.dogTile;
    const box = { dx: face.dx - 1, dy: face.dy - 1, size: face.size + 2 };
    const view = make(cell, tile, box, badge);
    const locked = itemTileLook(tile).badge !== null;
    // An owned dog's name is centred on its ink in the space right of the portrait's box, as tall
    // as the box and keeping the box's left padding at the tile's right.
    const beside = box.dx + box.size;
    result.push({
      ...view,
      label: dog.name,
      name: {
        capTop: y + (locked ? lockedNameY : dogTileNameY(body)),
        text: dog.name,
        x: x + textX,
        ...(locked
          ? {}
          : {
              centreIn: {
                height: box.size,
                width: cell.rect.width - beside - box.dx,
                x: x + beside,
                y: y + box.dy,
              },
            }),
      },
      pictures: [
        {
          key: dogFaceKey(data, cell.id),
          moving: !reducedMotion && !locked,
          scale: 1,
          tag: locked ? "neutral" : "happy",
          x: x + face.dx,
          y: y + face.dy,
        },
      ],
      ...(locked ? pricePlate(tile, x + textX, y + dogTilePlateY(body) - 1, 0) : {}),
    });
  }
  for (const cell of snapshot.gear) {
    const { width, x, y } = cell.rect;
    const purchase: Purchase = { gear: cell.id, kind: "gear" };
    const tile = itemTile({
      affordable: isAffordable(data, save.owned, save.bankCents, purchase),
      capacity: 1,
      goal: null,
      picked: loadout.gear === cell.id,
      pickedCount: loadout.gear === null ? 0 : 1,
      price: purchasePrice(data, save.owned, purchase),
    });
    const { badge, box, icon, strip } = HOME_LAYOUT.pocket;
    const gearStrip = tileStrip(cell.rect, strip);
    result.push({
      ...make(cell, tile, box, badge),
      label: data.shopGear[cell.id].name,
      pictures: [
        {
          fallback: gearPictureFallback(data, {
            gear: cell.id,
            scale: 1,
            x: x + icon.dx,
            y: y + icon.dy,
          }),
          key: gearIconKey(cell.id),
          moving: false,
          scale: 1,
          x: x + icon.dx,
          y: y + icon.dy,
        },
      ],
      ...pricePlate(tile, x + width / 2, gearStrip.y + 1, 0.5, gearStrip),
    });
  }
  return result;
}
export function homeSelectionColour(view: Pick<HomeSelectionView, "tile">): number {
  return PALETTE[selectLook(itemTileLook(view.tile).state).text];
}
