import type { GameData, GearId } from "../data/types.ts";
import type { PanelText } from "../ui/modal/types.ts";
import { PALETTE } from "../ui/palette.ts";

// Missing gear art keeps the item's authored initials at the picture's centre.
export function gearPictureFallback(
  data: Pick<GameData, "shopGear">,
  picture: {
    readonly gear: GearId;
    readonly scale: number;
    readonly x: number;
    readonly y: number;
  },
): PanelText {
  return {
    capTop: picture.y + 11 * picture.scale,
    centre: "advance",
    centreX: picture.x + 16 * picture.scale,
    colour: PALETTE.cream,
    font: "title",
    line: 0,
    scale: 1,
    text: data.shopGear[picture.gear].name
      .split(" ")
      .map((word) => word.charAt(0))
      .join(""),
  };
}
