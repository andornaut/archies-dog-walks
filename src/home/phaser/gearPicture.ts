import type { GameObjects, Scene } from "phaser";

import { gearIconKey } from "../../assets/spriteKeys.ts";
import type { GameData, GearId } from "../../data/types.ts";
import { addBodyText, tileTextureKey } from "../../scenes/uiKit.ts";
import type { ArtLook } from "../../ui/interaction.ts";
import { PALETTE } from "../../ui/palette.ts";

export function addGearPicture(
  context: { readonly scene: Scene; readonly data: Pick<GameData, "shopGear"> },
  parent: GameObjects.Container,
  art: ArtLook,
  gear: GearId,
  at: { x: number; y: number },
  scale: number,
): GameObjects.Image | undefined {
  const { data, scene } = context;
  const { x, y } = at;
  const key = gearIconKey(gear);
  if (scene.textures.exists(key)) {
    const icon = scene.add
      .image(x, y, tileTextureKey(scene, art, key))
      .setOrigin(0)
      .setScale(scale);
    parent.add(icon);
    return icon;
  }
  const initials = data.shopGear[gear].name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("");
  addBodyText(scene, parent, { x: x + 16 * scale, y: y + 11 * scale }, initials, {
    colour: PALETTE.cream,
    font: "title",
    originX: 0.5,
    scale: 1,
  });
  return undefined;
}
