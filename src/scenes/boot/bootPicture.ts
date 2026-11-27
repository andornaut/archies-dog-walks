import type { GameObjects, Scene } from "phaser";

import { LOADING_ART, type SpriteAsset } from "../../assets/index.ts";
import { LOADING_WALKER_START } from "../../data/index.ts";

// Loading artwork has no progress input: the top-edge strip is the only loading gauge.
export function addBootPicture(
  context: { readonly registerSprite: (sprite: SpriteAsset) => void; readonly scene: Scene },
  sprites: readonly SpriteAsset[],
): GameObjects.Sprite | undefined {
  const { scene } = context;
  if (scene.textures.exists(LOADING_ART.screen)) {
    scene.add.image(0, 0, LOADING_ART.screen).setOrigin(0);
  }
  const walker = sprites.find(({ key }) => key === LOADING_ART.walker);
  if (walker === undefined || !scene.textures.exists(walker.key)) {
    return undefined;
  }
  context.registerSprite(walker);
  const { x, y } = LOADING_WALKER_START;
  return scene.add.sprite(x, y, walker.key).setOrigin(0);
}
