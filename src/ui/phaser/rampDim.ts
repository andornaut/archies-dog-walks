import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { modalDimmer } from "@andornaut/game-kit/runtime/view/modalDim";
import { snapshotRemapped } from "@andornaut/game-kit/runtime/view/phaser/snapshotRemap";
import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { ONE_STEP_DARKER } from "../../assets/housePalette.ts";
import { shownWorldRect } from "../worldFit.ts";
import { addModalShade } from "./draw.ts";

// Dims rect under an overlay the style guide's way: the frozen view read back from the next
// frame and redrawn through the kit's shared modal palette-ramp policy, never blended with
// black. The overlay
// scene's cameras are hidden for that frame, so the read-back holds only the scenes beneath it,
// never the overlay's own objects, which may later hide or move. Only the part the scene's
// camera shows is read back. Where the renderer gives no snapshot to remap, the ink layer stands
// in. Each scene keeps its own texture, so two overlays can dim at once. onDrawn, if given, is
// called as the overlay's first drawn frame begins, unless the scene shuts down first. Returns
// the objects it adds, for a scene that redraws to keep (clearScene).
export function addRampDim(
  scene: Scene,
  rect: Rect,
  onDrawn?: () => void,
): readonly GameObjects.GameObject[] {
  const drawn = () => {
    if (onDrawn !== undefined) {
      onceBeforeRender(scene, onDrawn);
    }
  };
  const shown = shownWorldRect(scene.cameras.main, rect);
  if (shown === undefined) {
    drawn();
    return [];
  }
  const { canvas, world } = shown;
  const shade = addModalShade(scene, world).setVisible(false);
  const dim = scene.add.image(world.x, world.y, "__DEFAULT").setOrigin(0).setVisible(false);
  const key = `${scene.scene.key}-dim`;
  const fallback = () => shade.setVisible(true);
  // The renderer reads the snapshot back in its post-render step, before the game's
  // POST_RENDER event, so the cameras show again from the following frame.
  const shownCameras = scene.cameras.cameras.filter((camera) => camera.visible);
  shownCameras.forEach((camera) => camera.setVisible(false));
  scene.game.events.once(Core.Events.POST_RENDER, () => {
    shownCameras.forEach((camera) => camera.setVisible(true));
    drawn();
  });
  // The game canvas is opaque (src/main.ts sets no transparent background), so the kit's WebGL
  // readback gives the same pixels its PNG snapshot did.
  void snapshotRemapped(modalDimmer(ONE_STEP_DARKER), scene, canvas, key).then((remapped) => {
    if (!dim.active) {
      return;
    }
    if (remapped) {
      dim.setTexture(key).setDisplaySize(world.width, world.height).setVisible(true);
    } else {
      fallback();
    }
  });
  return [shade, dim];
}

// Calls then once, before the game's next frame is rendered, unless scene shuts down first.
export function onceBeforeRender(scene: Scene, then: () => void): void {
  const { events } = scene.game;
  const forget = () => events.off(Core.Events.PRE_RENDER, then);
  events.once(Core.Events.PRE_RENDER, then);
  scene.events.once(Scenes.Events.SHUTDOWN, forget);
}
