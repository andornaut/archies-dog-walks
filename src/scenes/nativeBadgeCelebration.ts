import { Core, type Scene, Scenes } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import type { DogId } from "../data/ids.ts";
import { BADGE_CHEER, BADGE_POP, type BadgeView } from "../home/badgesView.ts";
import type { BadgeCelebrationView } from "../hud/dom/celebration.ts";
import { showOrdinaryBadgeCelebration } from "../hud/dom/ordinaryBadgeCelebration.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { followScene, htmlPanelInput, htmlPanelPlace } from "./questionPanel.ts";

// Native badge parts keep the existing scene clock, pop timings and cheering motion.
export function addNativeBadgeCelebration(
  scene: Scene,
  view: BadgeCelebrationView,
  input: {
    readonly badges: readonly BadgeView[];
    readonly close: () => void;
    readonly faces: readonly {
      readonly dog: DogId;
      readonly rect: { height: number; width: number; x: number; y: number };
    }[];
    readonly reduced: boolean;
    readonly rows: number;
  },
) {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const shown = showOrdinaryBadgeCelebration(place.layer, {
    ...htmlPanelInput(place),
    ...input,
    artUrl: domArtUrl,
    everyFrame: (step) => {
      scene.game.events.on(Core.Events.PRE_RENDER, step);
      return () => scene.game.events.off(Core.Events.PRE_RENDER, step);
    },
    loadSheet,
    now: () => scene.time.now,
    pillColours: () => undefined,
    view,
  });
  const panel = followScene(scene, shown.panel);
  input.badges.forEach((_, index) => shown.badges.setPop(index, input.reduced ? 1 : 0));
  const start = () => {
    if (!panel.accepts()) {
      return;
    }
    scene.game.events.off(Core.Events.PRE_RENDER, start);
    input.badges.forEach((_, index) => {
      if (input.reduced) {
        shown.badges.burst(index);
        return;
      }
      const delay = index * BADGE_POP.delayMs;
      scene.time.delayedCall(delay, () => shown.badges.burst(index));
      const target = { scale: 0 };
      scene.tweens.add({
        delay,
        duration: BADGE_POP.durationMs,
        ease: BADGE_POP.ease,
        onUpdate: () => shown.badges.setPop(index, target.scale),
        scale: 1,
        targets: target,
      });
    });
    if (!input.reduced) {
      shown.faces.forEach((face) => {
        const target = { rise: 0 };
        scene.tweens.add({
          duration: BADGE_CHEER.duration,
          ease: BADGE_CHEER.ease,
          hold: BADGE_CHEER.hold,
          onUpdate: () => face.rise(target.rise),
          repeat: -1,
          repeatDelay: BADGE_CHEER.repeatDelay,
          rise: BADGE_CHEER.rise,
          targets: target,
          yoyo: true,
        });
      });
    }
  };
  scene.game.events.on(Core.Events.PRE_RENDER, start);
  scene.events.once(Scenes.Events.SHUTDOWN, () =>
    scene.game.events.off(Core.Events.PRE_RENDER, start),
  );
  return panel;
}
