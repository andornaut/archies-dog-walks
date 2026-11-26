import type { Scene } from "phaser";

import type { HudMoment } from "../hud/dom/index.ts";
import type { TimedGroup } from "./timedGroup.ts";

export function fadeFeedback(
  scene: Scene,
  group: TimedGroup,
  views: HudMoment[],
  delay: number,
  ms: number,
): void {
  group.tween(scene, {
    alpha: 0,
    delay,
    duration: ms,
    onComplete: () => views.forEach((view) => view.dispose()),
    targets: views.map(({ state }) => state),
  });
}
