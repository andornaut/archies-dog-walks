import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { bumpOverscan } from "../../layout/bumpFlash.ts";

interface OverscanView {
  depth: number;
  kind: "backdrop" | "road";
  view: Rect;
}

// Live texture edge frames provide render padding without changing native pixels or projection.
export class BumpOverscan {
  private readonly images: GameObjects.Image[];
  private readonly options: OverscanView;
  private readonly patches: ReturnType<typeof bumpOverscan>;
  private readonly scene: Scene;

  constructor(scene: Scene, options: OverscanView) {
    this.options = options;
    this.scene = scene;
    this.patches = bumpOverscan(options.kind, options.view);
    this.images = this.patches.map(({ target }) =>
      scene.add
        .image(target.x, target.y, "__DEFAULT")
        .setOrigin(0)
        .setDepth(options.depth)
        .setVisible(false),
    );
  }

  setTexture(key: string): void {
    const frame = this.scene.textures.getFrame(key);
    const { kind, view } = this.options;
    const ready =
      frame !== undefined && frame.cutWidth >= view.width && frame.cutHeight >= view.height;
    this.images.forEach((image, i) => {
      const patch = this.patches[i];
      image.setVisible(ready);
      if (!ready || patch === undefined) {
        return;
      }
      const texture = this.scene.textures.get(key);
      const name = `bump-overscan-${kind}-${frame.cutX}-${frame.cutY}-${view.width}-${view.height}-${patch.name}`;
      if (!texture.has(name)) {
        const { height, width, x, y } = patch.source;
        // Edge frames leave the texture's default full frame available to all native consumers.
        const firstFrame = texture.firstFrame;
        texture.add(name, frame.sourceIndex, frame.cutX + x, frame.cutY + y, width, height);
        texture.firstFrame = firstFrame;
      }
      image.setTexture(key, name).setDisplaySize(patch.target.width, patch.target.height);
    });
  }
}
