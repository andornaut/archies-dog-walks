import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";

import { addRampDim } from "../ui/phaser/rampDim.ts";

// Native modal paint and its world shade share visibility and disposal without another input scope.
export function nativeModalShade<P extends { destroy(): void; setShown(shown: boolean): void }>(
  scene: Scene,
  area: Rect,
  panel: P,
): P {
  const graphics = addRampDim(scene, area);
  let alive = true;
  const destroy = () => {
    if (!alive) {
      return;
    }
    alive = false;
    scene.events.off("shutdown", destroy);
    graphics.forEach((graphic) => graphic.destroy());
    panel.destroy();
  };
  scene.events.once("shutdown", destroy);
  return {
    ...panel,
    destroy,
    setShown(shown) {
      if (!alive) {
        return;
      }
      graphics.forEach((graphic) => graphic.setVisible(shown));
      panel.setShown(shown);
    },
  };
}
