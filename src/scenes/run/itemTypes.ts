import type { GameObjects } from "phaser";

import type { WalkItem } from "../../runner/walkItems.ts";

// One sprite of an item. dx is across the road from the item's centre and footY the flat
// road row it stands on, both in road pixels. feet "bottom" stands it on its frame's bottom
// rather than its anchor. A flat sprite lies on the road, under everything else with no
// shadow. A lifted sprite floats that many pixels, at its scale, over where it stands, with
// no shadow.
export interface ItemPart {
  dx: number;
  feet: "anchor" | "bottom";
  flat: boolean;
  footY: (item: Pick<WalkItem, "height" | "y">) => number;
  key: string;
  lift: number;
  sprite: GameObjects.Sprite;
}

export interface ItemView {
  parts: ItemPart[];
}
