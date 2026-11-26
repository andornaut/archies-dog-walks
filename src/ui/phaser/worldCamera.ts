import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { Cameras, Scene } from "phaser";

import { SCREEN_CONFIG } from "../../data/index.ts";
import { deviceFitOwned, worldFit, worldViewport } from "../index.ts";

const views = new WeakMap<Cameras.Scene2D.Camera, Rect>();

// A picture may show only a strip of the logical screen. Its viewport uses the same fit as
// every scene, while camera scroll remains in logical pixels.
export function setWorldViewport(scene: Scene, camera: Cameras.Scene2D.Camera, rect: Rect): void {
  views.set(camera, rect);
  if (deviceFitOwned(scene.scale)) {
    fitWorldCamera(scene, camera);
  } else {
    camera.setViewport(rect.x, rect.y, rect.width, rect.height);
  }
}

// Synchronous consumers such as modal snapshots need the same fit during scene.create,
// before Phaser emits CREATE and after a restarted scene resets its cameras.
export function fitWorldCamera(scene: Scene, camera: Cameras.Scene2D.Camera): void {
  if (!deviceFitOwned(scene.scale)) {
    return;
  }
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
