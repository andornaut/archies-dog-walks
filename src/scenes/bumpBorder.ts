import type { Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/hudMoments.ts";
import { BUMP_FLASH, bumpBorder, bumpFlashOn } from "../layout/bumpFlash.ts";
import { PALETTE } from "../ui/palette.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
const SCREEN = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };
// HUD coordinates keep the native border and tint still while the road camera jolts.
export class BumpBorder {
  private border: HudMoment | undefined;
  private tint: HudMoment | undefined;
  private started = 0;
  private still = false;
  private readonly painters: { border: HudMomentPainter; tint: HudMomentPainter };
  private readonly scene: Scene;
  constructor(scene: Scene, painters: { border: HudMomentPainter; tint: HudMomentPainter }) {
    this.painters = painters;
    this.scene = scene;
    scene.events.once("shutdown", () => this.cancel());
  }
  flash(still: boolean, colour: number): void {
    this.cancel();
    this.started = this.scene.game.loop.time;
    this.still = still;
    const border = this.painters.border.group(HUD_DEPTH.bumpBorder, "now");
    const tint = this.painters.tint.group(HUD_DEPTH.bumpTint, "now");
    const paint = (group: HudMoment, fill: number, rect: typeof SCREEN) =>
      group.panel(rect, undefined, { border: fill, fill });
    const rects = bumpBorder(SCREEN);
    rects.band.forEach((rect) => paint(border, colour, rect));
    rects.keyline.forEach((rect) => paint(border, PALETTE.ink, rect));
    paint(tint, colour, SCREEN);
    tint.state.alpha = BUMP_FLASH.tintAlpha;
    this.border = border;
    this.tint = tint;
    this.scene.events.on("postupdate", this.draw);
    this.draw();
  }
  cancel(): void {
    this.scene.events.off("postupdate", this.draw);
    this.border?.dispose();
    this.tint?.dispose();
    this.border = undefined;
    this.tint = undefined;
  }
  private readonly draw = () => {
    const elapsed = this.scene.game.loop.time - this.started;
    if (elapsed >= BUMP_FLASH.ms) {
      this.cancel();
      return;
    }
    const shown = bumpFlashOn(this.still, elapsed);
    if (this.border !== undefined) {
      this.border.state.visible = shown;
    }
    if (this.tint !== undefined) {
      this.tint.state.visible = shown;
    }
  };
}
