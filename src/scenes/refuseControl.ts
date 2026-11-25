import type { GameObjects, Scene } from "phaser";

import { PALETTE } from "../ui/palette.ts";
import { REFUSE } from "../ui/refuse.ts";
import { refuseMotion } from "./refuseMotion.ts";

// Rejected choices retain their grey chrome and briefly emphasise their labels.
export { REFUSE };

export function refuseControl(
  scene: Scene,
  reducedMotion: boolean,
  parts: readonly GameObjects.GameObject[],
  labels: readonly GameObjects.BitmapText[],
  complete: () => void = () => undefined,
): void {
  const colours = labels.map(
    (label) =>
      [label.tintTopLeft, label.tintTopRight, label.tintBottomLeft, label.tintBottomRight] as const,
  );
  const restore = () =>
    labels.forEach((label, i) => {
      if (label.active) {
        label.setTint(...colours[i]!);
      }
    });
  refuseMotion(scene, reducedMotion, {
    complete,
    emphasis: (red) => {
      if (red) {
        labels.forEach((label) => {
          if (label.active) {
            label.setTint(PALETTE.red);
          }
        });
      } else {
        restore();
      }
    },
    ...(parts.length === 0 ? {} : { motion: { targets: [...parts], x: `+=${REFUSE.shake}` } }),
  });
}
