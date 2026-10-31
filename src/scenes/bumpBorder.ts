import type { GameObjects, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { BUMP_FLASH, bumpBorder, bumpFlashOn } from "../layout/bumpFlash";
import { PALETTE } from "../ui/palette";
import { fillRect } from "../ui/phaser/draw";
import { HUD_DEPTH } from "./hudDepth";

const SCREEN = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };

// HUD coordinates keep the border and tint still while the road camera jolts.
export class BumpBorder {
  private colour = 0;
  private readonly graphics: GameObjects.Graphics;
  private readonly scene: Scene;
  private started = 0;
  private still = false;
  private readonly tint: GameObjects.Graphics;

  constructor(scene: Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(HUD_DEPTH.bumpBorder);
    this.tint = scene.add.graphics().setDepth(HUD_DEPTH.bumpTint).setAlpha(BUMP_FLASH.tintAlpha);
    scene.events.once("shutdown", () => this.cancel());
  }

  flash(still: boolean, colour: number): void {
    this.cancel();
    this.colour = colour;
    this.started = this.scene.game.loop.time;
    this.still = still;
    this.scene.events.on("postupdate", this.draw);
    this.draw();
  }

  cancel(): void {
    this.scene.events.off("postupdate", this.draw);
    if (this.graphics.active) {
      this.graphics.clear();
    }
    if (this.tint.active) {
      this.tint.clear();
    }
  }

  private readonly draw = () => {
    const elapsed = this.scene.game.loop.time - this.started;
    if (elapsed >= BUMP_FLASH.ms) {
      this.cancel();
      return;
    }
    const g = this.graphics.clear();
    const tint = this.tint.clear();
    if (bumpFlashOn(this.still, elapsed)) {
      const { band, keyline } = bumpBorder(SCREEN);
      band.forEach((rect) => fillRect(g, this.colour, rect));
      keyline.forEach((rect) => fillRect(g, PALETTE.ink, rect));
      fillRect(tint, this.colour, SCREEN);
    }
  };
}
