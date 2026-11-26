import type { Scene } from "phaser";

import { ownerFaceKey } from "../assets/index.ts";
import type { DogId } from "../data/ids.ts";
import { gameData, OWNER_TAB } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import { ownerTabRect } from "../hud/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import { PALETTE } from "../ui/index.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { TimedGroup } from "./timedGroup.ts";
const POP_MS = 120;
const FADE_MS = 400;
interface OwnerTabHooks {
  group: TimedGroup;
  painter: HudMomentPainter;
  still: () => boolean;
}
// The newest owner's tab per card. Scene timelines retain ownership of its paused lifetime.
export class OwnerTabs {
  private readonly shown = new Map<number, HudMoment>();
  private readonly scene: Scene;
  private readonly hooks: OwnerTabHooks;
  constructor(scene: Scene, hooks: OwnerTabHooks) {
    this.scene = scene;
    this.hooks = hooks;
  }
  pop(
    at: {
      dog: DogId;
      mood: string;
      slot: number;
    },
    holdMs: number,
  ): void {
    const card = SCREEN_LAYOUT.dogSlots[at.slot];
    if (card === undefined) {
      return;
    }
    this.clear(at.slot);
    const tab = ownerTabRect(card);
    const view = this.hooks.painter.group(HUD_DEPTH.ownerTab);
    if (!this.hooks.painter.hasArt("ui-owner-tab")) {
      view.panel(tab, undefined, { border: PALETTE.ink, fill: PALETTE.cyan });
    }
    view.art({ at: tab, image: { height: tab.height, width: tab.width }, key: "ui-owner-tab" });
    const key = ownerFaceKey(gameData, at.dog);
    const x = tab.x + OWNER_TAB.face;
    const y = tab.y + OWNER_TAB.face;
    if (this.hooks.painter.hasArt(key)) {
      view.art({ at: { x, y }, clock: "now", key, loop: true, tags: [at.mood, "neutral"] });
    } else {
      view.text({
        capTop: y,
        colour: PALETTE.ink,
        font: "body",
        lines: [gameData.dogs[at.dog].owner.name.slice(0, 1)],
        scale: 1,
        x,
      });
    }
    this.shown.set(at.slot, view);
    if (!this.hooks.still()) {
      this.hooks.group.tween(this.scene, {
        alpha: { from: 0, to: 1 },
        duration: POP_MS,
        targets: view.state,
      });
    }
    this.hooks.group.tween(this.scene, {
      alpha: 0,
      delay: holdMs,
      duration: FADE_MS,
      ease: "Sine.easeIn",
      onComplete: () => {
        view.dispose();
        if (this.shown.get(at.slot) === view) {
          this.shown.delete(at.slot);
        }
      },
      targets: view.state,
    });
  }
  dispose(): void {
    [...this.shown.keys()].forEach((slot) => this.clear(slot));
  }
  private clear(slot: number): void {
    const view = this.shown.get(slot);
    if (view === undefined) {
      return;
    }
    this.shown.delete(slot);
    this.scene.tweens.killTweensOf(view.state);
    view.dispose();
  }
}
