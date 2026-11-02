import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects, Scene } from "phaser";

import { playTagOnce } from "./sprites";
import type { IconButton } from "./uiKit";

const INVITATION_EVERY_MS = 7000;
const INVITATION_TAG = "door-wave";

export interface ShopIdle extends IconButton {
  update(eligible: boolean): void;
}

// The shop's one-shot invitation uses the loaded tag's frames and durations, between closed pauses.
export function addShopIdle(
  scene: Scene,
  parent: GameObjects.Container,
  faces: readonly [GameObjects.Image, GameObjects.Image],
): ShopIdle | undefined {
  const [normal, pressed] = faces;
  const key = normal.texture.key;
  const animation = scene.anims.get(animationKey(key, INVITATION_TAG));
  const first = animation?.frames[0];
  if (animation === undefined || first === undefined) {
    return undefined;
  }
  const duration = animation.frames.reduce(
    (total, frame) => total + (frame.duration || animation.msPerFrame),
    0,
  );
  const sprite = scene.add
    .sprite(normal.x, normal.y, key, first.textureFrame)
    .setOrigin(normal.originX, normal.originY)
    .setVisible(false);
  parent.add(sprite);
  let disposed = false;
  let down = false;
  let playing = false;
  let nextStart: number | undefined;
  const show = () => {
    normal.setVisible(!down && !playing);
    pressed.setVisible(down);
    sprite.setVisible(playing);
  };
  const reset = () => {
    if (disposed) {
      return;
    }
    sprite.anims.stop();
    playing = false;
    nextStart = undefined;
    show();
  };
  const dispose = (destroySprite: boolean) => {
    if (disposed) {
      return;
    }
    reset();
    disposed = true;
    scene.events.off("pause", reset);
    scene.events.off("sleep", reset);
    scene.events.off("shutdown", destroy);
    scene.events.off("destroy", destroy);
    normal.off("destroy", destroy);
    pressed.off("destroy", destroy);
    sprite.off("destroy", spriteDestroyed);
    if (destroySprite) {
      sprite.destroy();
    }
  };
  const destroy = () => dispose(true);
  const spriteDestroyed = () => dispose(false);
  scene.events.on("pause", reset);
  scene.events.on("sleep", reset);
  scene.events.once("shutdown", destroy);
  scene.events.once("destroy", destroy);
  normal.once("destroy", destroy);
  pressed.once("destroy", destroy);
  sprite.once("destroy", spriteDestroyed);
  show();
  return {
    setPressed(pressed) {
      if (disposed) {
        return;
      }
      down = pressed;
      if (down) {
        reset();
      } else {
        show();
      }
    },
    update(eligible) {
      if (disposed) {
        return;
      }
      if (!eligible || down) {
        reset();
        return;
      }
      const now = scene.time.now;
      nextStart ??= now + INVITATION_EVERY_MS;
      if (playing || now < nextStart) {
        return;
      }
      nextStart = now + INVITATION_EVERY_MS;
      playing = true;
      show();
      playTagOnce(sprite, key, INVITATION_TAG, () => {
        playing = false;
        // A late completion still leaves the door closed before another invitation.
        nextStart = Math.max(nextStart ?? 0, scene.time.now + INVITATION_EVERY_MS - duration);
        show();
      });
    },
  };
}
