import type { GameObjects, Scene } from "phaser";

import { PALETTE } from "../ui/palette";

// Rejected choices retain their grey chrome and briefly emphasise their labels.
export const REFUSE = { flashMs: 80, flashes: 4, shake: 3, shakeMs: 40 } as const;

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
  if (!reducedMotion && parts.length > 0) {
    scene.tweens.add({
      duration: REFUSE.shakeMs,
      repeat: 3,
      targets: [...parts],
      x: `+=${REFUSE.shake}`,
      yoyo: true,
    });
  }
  if (reducedMotion) {
    labels.forEach((label) => label.setTint(PALETTE.red));
    scene.time.delayedCall(REFUSE.flashMs * REFUSE.flashes, () => {
      restore();
      complete();
    });
    return;
  }
  let flashes = 0;
  scene.time.addEvent({
    callback: () => {
      flashes += 1;
      if (flashes % 2 === 1) {
        labels.forEach((label) => {
          if (label.active) {
            label.setTint(PALETTE.red);
          }
        });
      } else {
        restore();
      }
      if (flashes >= REFUSE.flashes) {
        complete();
      }
    },
    delay: REFUSE.flashMs,
    repeat: REFUSE.flashes - 1,
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
