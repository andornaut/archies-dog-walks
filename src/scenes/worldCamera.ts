import type { Rect } from "@andornaut/game-kit/rect";
import { type Cameras, Core, type Game, Scale, type Scene, Scenes } from "phaser";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { deviceFitOwned, ownDeviceFit, worldFit, worldViewport } from "../ui/worldFit.ts";

const views = new WeakMap<Cameras.Scene2D.Camera, Rect>();

// A picture may show only a strip of the logical screen. Its viewport uses the same fit as
// every scene, while camera scroll remains in logical pixels.
export function setWorldViewport(scene: Scene, camera: Cameras.Scene2D.Camera, rect: Rect): void {
  views.set(camera, rect);
  if (deviceFitOwned(scene.scale)) {
    fitCamera(scene, camera);
  } else {
    camera.setViewport(rect.x, rect.y, rect.width, rect.height);
  }
}

function fitCamera(scene: Scene, camera: Cameras.Scene2D.Camera): void {
  const fit = worldFit(scene.scale);
  const viewport = worldViewport(fit);
  const rect = views.get(camera) ?? { ...SCREEN_CONFIG, x: 0, y: 0 };
  camera
    .setViewport(
      viewport.x + rect.x * fit.zoom,
      viewport.y + rect.y * fit.zoom,
      rect.width * fit.zoom,
      rect.height * fit.zoom,
    )
    .setOrigin(0, 0)
    .setZoom(fit.zoom);
}

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
        const fit = () => scene.cameras.cameras.forEach((camera) => fitCamera(scene, camera));
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
