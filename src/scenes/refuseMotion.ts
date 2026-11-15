import type { Scene } from "phaser";

import { REFUSE, REFUSE_SHAKES } from "../ui/refuse.ts";

export interface RefusalFeedback {
  readonly complete: () => void;
  readonly emphasis: (red: boolean) => void;
  readonly motion?: {
    readonly targets: object[];
    readonly update?: () => void;
    readonly x: number | string;
  };
}

// Refusal feedback follows the presenting scene's clock, including pauses and shutdown.
export function refuseMotion(
  scene: Pick<Scene, "time" | "tweens">,
  reduced: boolean,
  feedback: RefusalFeedback,
): void {
  if (!reduced && feedback.motion !== undefined) {
    const motion = feedback.motion;
    scene.tweens.add({
      duration: REFUSE.shakeMs,
      ...(motion.update === undefined ? {} : { onUpdate: motion.update }),
      repeat: REFUSE_SHAKES - 1,
      targets: motion.targets,
      x: motion.x,
      yoyo: true,
    });
  }
  if (reduced) {
    feedback.emphasis(true);
    scene.time.delayedCall(REFUSE.flashMs * REFUSE.flashes, () => {
      feedback.emphasis(false);
      feedback.complete();
    });
    return;
  }
  let flashes = 0;
  scene.time.addEvent({
    callback: () => {
      flashes += 1;
      feedback.emphasis(flashes % 2 === 1);
      if (flashes >= REFUSE.flashes) {
        feedback.complete();
      }
    },
    delay: REFUSE.flashMs,
    repeat: REFUSE.flashes - 1,
  });
}
