import type { GameObjects } from "phaser";

import { gameData } from "../../data/index.ts";
import { bobOffset, itemBobs } from "../../rules/itemCues.ts";
import type { WalkItem } from "../../runner/walkItems.ts";

// The walk screen's reading aid for road items: the grab-worthy ones bob, from the item's
// data. View-only. Call after the item's sprites are placed, with the scene's time.
export function applyItemCue(
  item: WalkItem,
  parts: readonly { sprite: GameObjects.Sprite }[],
  still: boolean,
  timeMs: number,
): void {
  if (itemBobs(gameData, item.kind)) {
    const offset = bobOffset(still, timeMs);
    parts.forEach(({ sprite }) => sprite.setY(sprite.y + offset));
  }
}
