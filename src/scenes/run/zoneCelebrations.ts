import type { Scene } from "phaser";

import { playInTurn, type ZoneCelebration } from "../../hud/index.ts";
import type { MenuFlow } from "./menuFlow.ts";

// The celebrations due after a zone's fee coins land.
export interface CelebrationBatch {
  readonly celebrations: readonly ZoneCelebration[];
  readonly delayMs: number;
}

type CelebrationMenus = Pick<MenuFlow, "holdForCelebration" | "showCelebration">;

export function createZoneCelebrations(scene: Pick<Scene, "time">, openPause: () => void) {
  let generation = 0;
  return {
    cancel() {
      generation += 1;
    },
    // Hold the walk through the payout and let each celebration's button advance the sequence.
    play(
      menus: CelebrationMenus | undefined,
      { celebrations, delayMs }: CelebrationBatch,
      next: () => void,
    ): void {
      if (menus === undefined) {
        return;
      }
      const started = ++generation;
      const current = (action: () => void) => () => {
        if (started === generation) {
          action();
        }
      };
      const show = (celebration: ZoneCelebration, done: () => void) => {
        menus.holdForCelebration();
        menus.showCelebration({ celebration, onDone: current(done), openPause });
      };
      menus.holdForCelebration();
      scene.time.delayedCall(
        delayMs,
        current(() => playInTurn(show, next, celebrations)),
      );
    },
  };
}
