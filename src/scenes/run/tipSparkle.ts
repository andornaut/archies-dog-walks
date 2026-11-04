import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Point } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import type { WalkStep } from "../../runner/walk.ts";
import type { WalkItem } from "../../runner/walkItems.ts";
import { playTagOnce } from "../sprites.ts";

// The sprite a collected tip, or a treat that pays cash, twinkles once over the lead dog: centred
// on the dog's centre column, gap px plus half its frame height above the dog's top opaque row,
// so its bottom edge is gap px above the dog. Its frame size is read from the loaded texture.
export const TIP_SPARKLE = {
  gap: 4,
  key: "fx-tip-sparkle",
  tag: "play",
} as const;

// The centre column and top opaque row of each figure the tip sparkle can stand over: the lead
// dog's, undefined with no lead dog shown, and the walker's.
export interface SparkleTops {
  lead: Point | undefined;
  walker: Point;
}

// What a step's grabs sparkle: the tip sparkle when it grabbed a tip, a Stinky tip's $0
// included, or a treat that paid cash, each of which plays no other sparkle, and fx-sparkle over
// the pack for each other collected item. A lucky find's cash pops its own art over its pickup,
// and the step's other money changes are a bump's or a contact's, which play their own hit, so
// none of them plays the tip sparkle.
export function stepSparkles(step: Pick<WalkStep, "collected" | "tips" | "treats">): {
  overPack: WalkItem[];
  tip: boolean;
} {
  const paid = new Set([
    ...step.tips.map(({ item }) => item.id),
    ...step.treats.flatMap(({ cash, item }) => (cash !== null && cash.amount > 0 ? [item.id] : [])),
  ]);
  return {
    overPack: step.collected.filter((item) => !paid.has(item.id)),
    tip: paid.size > 0,
  };
}

// The pack's one tip sparkle: a tip or a treat's cash plays it once, and another grabbed while
// it plays restarts it, so sparkles never stack. While it plays it follows the lead dog's top,
// read by tops each frame, so it moves to a new lead, and the walker's when no lead dog is shown;
// it is hidden when it ends. Reduced motion skips it; nothing is drawn when the art is missing.
export class TipSparkle {
  private readonly depth: number;
  private readonly scene: Scene;
  private sprite: GameObjects.Sprite | undefined;
  private readonly tops: () => SparkleTops;

  constructor(scene: Scene, depth: number, tops: () => SparkleTops) {
    this.scene = scene;
    this.depth = depth;
    this.tops = tops;
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

  // Keeps a playing sparkle over the lead dog, or else the walker, where this frame draws it.
  follow(): void {
    const { sprite } = this;
    if (sprite?.visible !== true) {
      return;
    }
    const { gap, key } = TIP_SPARKLE;
    const texture = this.scene.textures.get(key);
    const { realHeight, realWidth } = texture.get(texture.getFrameNames()[0] ?? "__BASE");
    const half = { x: Math.floor(realWidth / 2), y: Math.floor(realHeight / 2) };
    const { lead, walker } = this.tops();
    const top = lead ?? walker;
    const centre = { x: top.x, y: top.y - gap - half.y };
    sprite.setPosition(Math.round(centre.x - half.x), Math.round(centre.y - half.y));
  }
}
