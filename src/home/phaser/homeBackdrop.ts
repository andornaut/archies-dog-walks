import type { Scene } from "phaser";

import { SCREEN_LAYOUT } from "../../layout/index.ts";
import { PALETTE } from "../../ui/palette.ts";
import { fillRect } from "../../ui/phaser/draw.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";

const SCREEN = SCREEN_LAYOUT.screen;
const PATH = HOME_LAYOUT.path;

export function renderHomeBackdrop(scene: Scene): void {
  fillRect(scene.add.graphics(), PALETTE.darkBrown, SCREEN);
  if (scene.textures.exists("screen-home")) {
    scene.add.image(0, HOME_LAYOUT.backdropY, "screen-home").setOrigin(0);
  } else {
    const g = scene.add.graphics();
    fillRect(g, PALETTE.darkSlate, {
      height: 52,
      width: SCREEN.width,
      x: 0,
      y: 40 + HOME_LAYOUT.heroOffsetY,
    });
    fillRect(g, PALETTE.lightGrey, {
      height: 34,
      width: SCREEN.width,
      x: 0,
      y: 92 + HOME_LAYOUT.heroOffsetY,
    });
    fillRect(g, PALETTE.green, {
      height: 70,
      width: SCREEN.width,
      x: 0,
      y: 126 + HOME_LAYOUT.heroOffsetY,
    });
    fillRect(g, PALETTE.tan, {
      height: 70,
      width: PATH.width,
      x: PATH.x,
      y: 126 + HOME_LAYOUT.heroOffsetY,
    });
    fillRect(g, PALETTE.brown, {
      height: HOME_LAYOUT.gateBar.height - 1,
      width: SCREEN.width,
      x: 0,
      y: HOME_LAYOUT.gateBar.y,
    });
  }
}
