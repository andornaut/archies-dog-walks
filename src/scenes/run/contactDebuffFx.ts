import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Time } from "phaser";

import type { DogId } from "../../data/types.ts";
import { DEBUFF_GROUND, type DebuffHitEffect, HIT_ART } from "../../layout/hitEffects.ts";
import { formationOrder } from "../../layout/packFormation.ts";
import { playTagOnce } from "../sprites.ts";
import { tagFrame } from "../uiKit.ts";

// One ground animation follows the dog selected as formation lead when the cue begins.
// It plays once. Reduced motion holds the readable pose for the same loaded duration.
export function playContactDebuff(
  scene: Scene,
  context: {
    readonly depth: number;
    readonly dogs: readonly DogId[];
    readonly feet: (dog: DogId) => Point | undefined;
    readonly view: Rect;
  },
  cue: DebuffHitEffect,
): void {
  const animation = scene.anims.get(animationKey(cue.key, HIT_ART.tag));
  if (!scene.textures.exists(cue.key) || animation === undefined) {
    return;
  }
  const frame = cue.frame === null ? undefined : tagFrame(scene, cue.key, HIT_ART.tag, cue.frame);
  if (cue.frame !== null && frame === undefined) {
    return;
  }
  const lead = formationOrder(context.dogs)[0];
  if (lead === undefined || context.feet(lead) === undefined) {
    return;
  }
  const burst: GameObjects.Image | GameObjects.Sprite =
    cue.frame === null ? scene.add.sprite(0, 0, cue.key) : scene.add.image(0, 0, cue.key, frame);
  burst
    .setOrigin(0.5, DEBUFF_GROUND.groundRow / DEBUFF_GROUND.height)
    .setScale(DEBUFF_GROUND.scale);
  const group = scene.add.container(0, 0, [burst]).setDepth(context.depth);
  const graphics = scene.make.graphics({}, false).setScrollFactor(0);
  const { view } = context;
  graphics.fillStyle(0xffffff).fillRect(view.x, view.y, view.width, view.height);
  const mask = graphics.createGeometryMask();
  group.setMask(mask);
  let ended = false;
  let timer: Time.TimerEvent | undefined;
  const place = () => {
    const at = context.feet(lead);
    burst.setVisible(at !== undefined);
    if (at !== undefined) {
      burst.setPosition(at.x, at.y + DEBUFF_GROUND.yOffset);
    }
  };
  const stopTracking = () => {
    if (ended) {
      return;
    }
    ended = true;
    scene.events.off("postupdate", place);
    scene.events.off("shutdown", finish);
    timer?.remove(false);
    mask.destroy();
    graphics.destroy();
  };
  const finish = () => {
    if (ended) {
      return;
    }
    stopTracking();
    group.destroy();
  };
  group.once("destroy", stopTracking);
  scene.events.on("postupdate", place);
  scene.events.once("shutdown", finish);
  if (cue.frame === null) {
    playTagOnce(burst as GameObjects.Sprite, cue.key, HIT_ART.tag, finish);
  } else {
    timer = scene.time.delayedCall(animation.duration, finish);
  }
  place();
}
