import { Core, type Game, Scale, type Scene, Scenes } from "phaser";

import { ownDeviceFit } from "../ui/index.ts";
import { fitWorldCamera } from "../ui/phaser/worldCamera.ts";

// The native scale manager owns backing/CSS size. This installation only fits scene cameras
// to their unchanged logical view, once on creation and whenever that backing changes.
export function followWorldCameras(game: Game): () => void {
  const release = ownDeviceFit(game.scale);
  const bound = new Map<Scene, () => void>();
  let disposed = false;
  const bind = () => {
    if (disposed) {
      return;
    }
    for (const scene of game.scene.scenes) {
      if (!bound.has(scene)) {
        const fit = () => scene.cameras.cameras.forEach((camera) => fitWorldCamera(scene, camera));
        bound.set(scene, fit);
        scene.events.on(Scenes.Events.CREATE, fit);
      }
      bound.get(scene)?.();
    }
  };
  game.events.once(Core.Events.READY, bind);
  if (game.scene.isBooted) {
    bind();
  }
  game.scale.on(Scale.Events.RESIZE, bind);
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    release();
    game.events.off(Core.Events.DESTROY, dispose);
    game.events.off(Core.Events.READY, bind);
    game.scale.off(Scale.Events.RESIZE, bind);
    for (const [scene, fit] of bound) {
      scene.events.off(Scenes.Events.CREATE, fit);
    }
    bound.clear();
  };
  game.events.once(Core.Events.DESTROY, dispose);
  return dispose;
}
