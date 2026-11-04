import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Point } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import type { WalkStep } from "../../runner/walk";
import type { WalkItem } from "../../runner/walkItems";
import { playTagOnce } from "../sprites";

// The sprite a collected tip twinkles once over the walker: 9x9, drawn with its centre pixel
// (anchor, from its top-left) gap px plus its half height above the walker's top opaque row,
// so its bottom edge is gap px above the walker.
export const TIP_SPARKLE = {
  anchor: { x: 4, y: 4 },
  gap: 4,
  key: "fx-tip-sparkle",
  tag: "play",
} as const;

// What a step's grabs sparkle: fx-sparkle over the pack for each collected item but a tip,
// and the tip sparkle over the walker when it grabbed a tip.
export function stepSparkles(step: Pick<WalkStep, "collected" | "tips">): {
  overPack: WalkItem[];
  overWalker: boolean;
} {
  const tips = new Set(step.tips.map(({ item }) => item.id));
  return {
    overPack: step.collected.filter((item) => !tips.has(item.id)),
    overWalker: step.tips.length > 0,
  };
}

// The walker's one tip sparkle: a tip plays it once, and a tip grabbed while it plays restarts
// it, so sparkles never stack. It follows the walker's top, read by top, while it plays, and is
// hidden when it ends. Reduced motion skips it; nothing is drawn when the art is missing.
export class TipSparkle {
  private readonly depth: number;
  private readonly scene: Scene;
  private sprite: GameObjects.Sprite | undefined;
  private readonly top: () => Point;

  constructor(scene: Scene, depth: number, top: () => Point) {
    this.scene = scene;
    this.depth = depth;
    this.top = top;
  }

  play(still: boolean): void {
    const { key, tag } = TIP_SPARKLE;
    if (still || !this.scene.textures.exists(key)) {
      return;
    }
    if (!this.scene.anims.exists(animationKey(key, tag))) {
      return;
    }
    const sprite =
      this.sprite ?? this.scene.add.sprite(0, 0, key).setOrigin(0, 0).setDepth(this.depth);
    this.sprite = sprite;
    sprite.setVisible(true);
    this.follow();
    playTagOnce(sprite, key, tag, () => sprite.setVisible(false));
  }

  // Keeps a playing sparkle over the walker where this frame draws it.
  follow(): void {
    const { sprite } = this;
    if (sprite?.visible !== true) {
      return;
    }
    const { anchor, gap } = TIP_SPARKLE;
    const top = this.top();
    const centre = { x: top.x, y: top.y - gap - anchor.y };
    sprite.setPosition(Math.round(centre.x - anchor.x), Math.round(centre.y - anchor.y));
  }
}
