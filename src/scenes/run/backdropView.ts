import type { GameObjects, Scene } from "phaser";

import { backdropKey } from "../../assets/spriteKeys";
import type { Zone } from "../../data/types";
import { BumpOverscan } from "./bumpOverscan";
import { DEPTH, LAYOUT } from "./stage";

// The zone's backdrop band over the far end of the road, held still.
export class BackdropView {
  private readonly image: GameObjects.Image;
  private readonly scene: Scene;
  private readonly overscan: BumpOverscan;
  // The backdrop key last drawn, which a missing texture's placeholder does not change.
  private shown: string | undefined;

  constructor(scene: Scene) {
    this.scene = scene;
    const { backdrop } = LAYOUT;
    this.image = scene.add.image(backdrop.x, backdrop.y, "__DEFAULT").setOrigin(0);
    this.image.setDepth(DEPTH.backdrop);
    this.overscan = new BumpOverscan(scene, {
      depth: DEPTH.backdrop,
      kind: "backdrop",
      view: backdrop,
    });
  }

  draw(zone: Zone): void {
    const key = backdropKey(zone);
    if (this.shown !== key) {
      this.shown = key;
      const band = LAYOUT.backdrop;
      this.image
        .setTexture(this.scene.textures.exists(key) ? key : "__DEFAULT")
        .setCrop(0, 0, band.width, band.height);
      this.overscan.setTexture(this.scene.textures.exists(key) ? key : "__DEFAULT");
    }
  }
}
