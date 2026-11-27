import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { GearId } from "../../data/ids.ts";
import { type GameData, GEAR_ICON } from "../../data/index.ts";
import { PALETTE, type PanelText } from "../../ui/index.ts";

// A gear item's authored initials, shown in place of its missing art, their ink centred on the
// picture they stand in for (placeBackedText).
export interface GearPictureFallback {
  readonly line: PanelText;
  readonly picture: Rect;
}

export function gearPictureFallback(
  data: Pick<GameData, "shopGear">,
  picture: {
    readonly gear: GearId;
    readonly scale: number;
    readonly x: number;
    readonly y: number;
  },
): GearPictureFallback {
  const side = GEAR_ICON * picture.scale;
  return {
    line: {
      capTop: picture.y,
      centre: "ink",
      centreX: picture.x + side / 2,
      colour: PALETTE.cream,
      font: "title",
      line: 0,
      scale: 1,
      text: data.shopGear[picture.gear].name
        .split(" ")
        .map((word) => word.charAt(0))
        .join(""),
    },
    picture: { height: side, width: side, x: picture.x, y: picture.y },
  };
}
