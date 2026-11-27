import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { dogFaceKey, gearIconKey } from "../assets/index.ts";
import type { DogId, GearId, WalkerId } from "../data/ids.ts";
import { FACE_SIZE, type GameData, GEAR_ICON, UI_FUNCTION_ICON_SIZE } from "../data/index.ts";
import { dollarText, hudEffectIconKey, walkerEffectItems } from "../presentation/index.ts";
import type { SaveDocument } from "../save/index.ts";
import {
  type ArtLook,
  type Badge,
  type ItemTile,
  itemTile,
  itemTileLook,
  lineInk,
  PALETTE,
  plainMarks,
  type PlateKind,
  selectLook,
} from "../ui/index.ts";
import { type GearPictureFallback, gearPictureFallback } from "./details/gearPictureView.ts";
import {
  type HomeLoadout,
  isAffordable,
  packCapacity,
  type Purchase,
  purchasePrice,
} from "./home.ts";
import { HOME_LAYOUT, tileStrip } from "./homeLayout.ts";
import { pickerPicture, START_PICKER_MARK } from "./startPickerArt.ts";
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
  readonly fallback?: GearPictureFallback;
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly tag?: string;
  readonly scale: number;
  readonly moving: boolean;
}
// A Start name or price measured within its own region.
interface TileLabel {
  readonly rect: Rect;
  readonly text: string;
}
export interface HomeSelectionView {
  readonly id: string;
  readonly label: string;
  readonly hit: Rect;
  readonly rect: Rect;
  readonly tile: ItemTile;
  readonly art: ArtLook;
  readonly pictures: readonly HomeSelectionPicture[];
  readonly name?: TileLabel & { readonly align: "centre" | "left" | "strip" };
  readonly plate?: TileLabel & { readonly kind: PlateKind; readonly framed: boolean };
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
  body: BitmapFont,
  reducedMotion: boolean,
  snapshot: HomeSelectionSnapshot,
): readonly HomeSelectionView[] {
  const result: HomeSelectionView[] = [];
  const { loadout, save } = snapshot;
  const capacity = packCapacity(data, save.owned);
  const make = (cell: HomeSelectionCell<unknown>, tile: ItemTile, label: string) => {
    const look = itemTileLook(tile);
    return {
      art: look.art,
      hit: cell.hit,
      id: cell.feedbackId,
      label,
      rect: cell.rect,
      tile,
      ...(look.badge === null
        ? {}
        : {
            badge: {
              kind: look.badge,
              x: cell.rect.x + START_PICKER_MARK.x,
              y: cell.rect.y + START_PICKER_MARK.y,
            },
          }),
    };
  };
  const plateText = (tile: ItemTile) => {
    const kind = itemTileLook(tile).plate;
    return tile.kind === "locked" && kind !== null
      ? { kind, text: dollarText(tile.price) }
      : undefined;
  };
  const ink = (text: string) => lineInk(body, plainMarks(text));
  for (const cell of snapshot.walkers) {
    const { x, y } = cell.rect;
    const { face, perk, strip } = HOME_LAYOUT.walkerTile;
    const walkerStrip = tileStrip(cell.rect, strip);
    const tile = walkerTile(data, save, cell.id);
    const walker = data.walkers[cell.id];
    const portrait = {
      key: walker.portraitKey,
      moving: !reducedMotion,
      scale: 1,
      tag: tile.kind === "picked" ? "happy" : "neutral",
      ...pickerPicture(face, walker.portraitKey, x, y, FACE_SIZE),
    };
    const pictures = [
      portrait,
      ...walkerEffectItems(data, cell.id).map((item) => {
        const key = hudEffectIconKey(item);
        return {
          key,
          moving: false,
          scale: 1,
          ...pickerPicture(perk, key, x, y, UI_FUNCTION_ICON_SIZE.standard),
        };
      }),
    ];
    result.push({
      ...make(cell, tile, walker.name),
      name: { align: "strip", rect: walkerStrip, text: walker.name },
      pictures,
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
    const { face, name, priceGap } = HOME_LAYOUT.dogTile;
    const locked = tile.kind === "locked";
    const nameRegion = { ...name, x: x + name.x, y: y + name.y };
    const nameInk = ink(dog.name);
    const nameHeight = nameInk.bottom - nameInk.top;
    // The one-pixel inset leaves the complete name above the measured price, including descenders.
    const nameTop = nameRegion.y + 1;
    const price = plateText(tile);
    const priceInk = price === undefined ? undefined : ink(price.text);
    const key = dogFaceKey(data, cell.id);
    result.push({
      ...make(cell, tile, dog.name),
      name: {
        align: locked ? "left" : "centre",
        rect: locked ? { ...nameRegion, height: nameHeight, y: nameTop } : nameRegion,
        text: dog.name,
      },
      pictures: [
        {
          key,
          moving: !reducedMotion && !locked,
          scale: 1,
          tag: locked ? "neutral" : "happy",
          ...pickerPicture(face, key, x, y, FACE_SIZE),
        },
      ],
      ...(price === undefined || priceInk === undefined
        ? {}
        : {
            plate: {
              ...price,
              framed: true,
              rect: {
                height: priceInk.bottom - priceInk.top + 2,
                width: priceInk.right - priceInk.left + 4,
                x: nameRegion.x,
                y: nameTop + nameHeight + priceGap,
              },
            },
          }),
    });
  }
  for (const cell of snapshot.gear) {
    const { x, y } = cell.rect;
    const purchase: Purchase = { gear: cell.id, kind: "gear" };
    const tile = itemTile({
      affordable: isAffordable(data, save.owned, save.bankCents, purchase),
      capacity: 1,
      goal: null,
      picked: loadout.gear === cell.id,
      pickedCount: loadout.gear === null ? 0 : 1,
      price: purchasePrice(data, save.owned, purchase),
    });
    const { ownedIcon, strip, unownedIcon } = HOME_LAYOUT.pocket;
    const price = plateText(tile);
    const key = gearIconKey(cell.id);
    const at = pickerPicture(price === undefined ? ownedIcon : unownedIcon, key, x, y, GEAR_ICON);
    result.push({
      ...make(cell, tile, data.shopGear[cell.id].name),
      pictures: [
        {
          fallback: gearPictureFallback(data, { ...at, gear: cell.id, scale: 1 }),
          key,
          moving: false,
          scale: 1,
          ...at,
        },
      ],
      ...(price === undefined
        ? {}
        : { plate: { ...price, framed: false, rect: tileStrip(cell.rect, strip) } }),
    });
  }
  return result;
}
export function homeSelectionColour(view: Pick<HomeSelectionView, "tile">): number {
  return PALETTE[selectLook(itemTileLook(view.tile).state).text];
}
