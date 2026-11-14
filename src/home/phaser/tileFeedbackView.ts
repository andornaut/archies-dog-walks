import type { GameObjects } from "phaser";

import type { ShopBoard, ShopIdle } from "../../scenes/shopIdle.ts";
import type { IconButton } from "../../scenes/uiKit.ts";

// A tile that reacts to taps: its container moves for the dip, lift and shake, its face hops,
// and its mark pops.
export interface TileView {
  container: GameObjects.Container;
  face?: { object: GameObjects.Image | GameObjects.Sprite; y: number };
  // A button with a pressed face shows it rather than dipping.
  iconButton?: IconButton;
  lift: number;
  mark?: { image: GameObjects.Image; y: number };
  // The pop timer that raises the whole tile for a moment, for the gear badge at the gate.
  rise?: string;
  shopBoard?: ShopBoard;
  shopIdle?: ShopIdle;
}
