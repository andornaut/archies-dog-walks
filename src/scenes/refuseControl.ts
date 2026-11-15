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

function controlLabels(container: GameObjects.Container): GameObjects.BitmapText[] {
  return container.list.flatMap((part) =>
    part.type === "BitmapText"
      ? [part as GameObjects.BitmapText]
      : part.type === "Container"
        ? controlLabels(part as GameObjects.Container)
        : [],
  );
}

const refusingContainers = new WeakSet<GameObjects.Container>();

// Home controls already receive their shared shake offset in the scene update.
export function emphasiseRefusedControl(
  scene: Scene,
  reducedMotion: boolean,
  container: GameObjects.Container,
): void {
  if (refusingContainers.has(container)) {
    return;
  }
  refusingContainers.add(container);
  refuseControl(scene, reducedMotion, [], controlLabels(container), () =>
    refusingContainers.delete(container),
  );
}
