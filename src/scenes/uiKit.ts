import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene, Tweens } from "phaser";

import { playEffect } from "../assets/phaser/sprites.ts";
import { SLICES } from "../data/index.ts";
import { loopFrame } from "../home/feedback.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { PALETTE } from "../ui/palette.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import { SELECT_OUTSET } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { TAP_BURST_SCENE_KEY } from "./sceneKeys.ts";

// Body text at 2x in plum, the screens' default text.
export const BODY_TEXT = { colour: PALETTE.plum, scale: TEXT_SCALE } as const;

// A graphics object added to parent.
export function addGraphicsIn(scene: Scene, parent: GameObjects.Container): GameObjects.Graphics {
  const g = scene.add.graphics();
  parent.add(g);
  return g;
}

export type SliceKey = keyof typeof SLICES;

// The texture frame an Aseprite tag shows at index, from the animation BootScene made for it.
export function tagFrame(
  scene: Scene,
  key: string,
  tag: string,
  index = 0,
): string | number | undefined {
  const frames = scene.anims.get(animationKey(key, tag))?.frames;
  if (frames === undefined || frames.length === 0) {
    return undefined;
  }
  return frames[index % frames.length]?.textureFrame;
}

// A nine-slice of a UI kit texture over rect, or undefined when the art is missing. tag picks
// a frame of a sprite; an image has none.
export function addNineSlice(
  scene: Scene,
  key: SliceKey,
  rect: Rect,
  tag?: string,
  index = 0,
): GameObjects.NineSlice | undefined {
  if (!scene.textures.exists(key)) {
    return undefined;
  }
  const frame = tag === undefined ? undefined : tagFrame(scene, key, tag, index);
  if (tag !== undefined && frame === undefined) {
    return undefined;
  }
  const { bottom, left, right, top } = SLICES[key];
  return scene.add
    .nineslice(rect.x, rect.y, key, frame, rect.width, rect.height, left, right, top, bottom)
    .setOrigin(0);
}

// One frame of a sprite's tag, placed by its top-left corner, or undefined when missing.
export function addTagImage(
  scene: Scene,
  key: string,
  tag: string,
  x: number,
  y: number,
): GameObjects.Image | undefined {
  const frame = tagFrame(scene, key, tag);
  return frame === undefined ? undefined : scene.add.image(x, y, key, frame).setOrigin(0);
}

// A control that shows itself pressed, such as the Pet shop's sign.
export interface IconButton {
  setPressed(pressed: boolean): void;
}

export function selectOuter(rect: Rect, outset = SELECT_OUTSET): Rect {
  return insetRect(-outset, rect);
}

// A looping outline nine-slice over outer, one nine-slice per frame of key's tag, shown one
// at a time from the scene's update, or holding its first frame with reduced motion. While
// the art is missing, drawFallback draws it instead.
export function addLoopingFrame(
  scene: Scene,
  parent: GameObjects.Container,
  frame: { key: SliceKey; outer: Rect; tag: string },
  reducedMotion: boolean,
  drawFallback: (g: GameObjects.Graphics) => void,
): void {
  const { key, outer, tag } = frame;
  const frames = scene.anims.get(animationKey(key, tag))?.frames ?? [];
  const slices = frames.flatMap((_, i) => {
    const slice = addNineSlice(scene, key, outer, tag, i);
    return slice === undefined ? [] : [slice];
  });
  const first = slices[0];
  if (first === undefined) {
    const g = scene.add.graphics();
    drawFallback(g);
    parent.add(g);
    return;
  }
  parent.add(slices);
  const durations = frames.map(({ duration }) => duration);
  const show = () => {
    const shown = loopFrame(reducedMotion, durations, scene.time.now);
    slices.forEach((slice, i) => slice.setVisible(i === shown));
  };
  show();
  if (!reducedMotion && slices.length > 1) {
    scene.events.on("update", show);
    first.once("destroy", () => scene.events.off("update", show));
  }
}

// Fades parts out over ms after delayMs, easing in, rising rise pixels as they go (0 fades
// them in place, as reduced motion does), then destroys them and calls done.
export function fadeAway(
  scene: Scene,
  parts: readonly GameObjects.GameObject[],
  timing: { delayMs?: number; ms: number; rise: number },
  done: () => void = () => undefined,
): Tweens.Tween {
  return scene.tweens.add({
    alpha: 0,
    delay: timing.delayMs ?? 0,
    duration: timing.ms,
    ease: "Sine.easeIn",
    onComplete: () => {
      parts.forEach((part) => part.destroy());
      done();
    },
    targets: [...parts],
    y: `-=${timing.rise}`,
  });
}

// fx-tap bursts where the finger lands on scene, drawn in the tap burst layer (TapBurstScene)
// over every scene, so it plays out over whatever the tap opens or whatever scene does next.
export function addTapBurst(scene: Scene, x: number, y: number): void {
  playEffect(scene.scene.get(TAP_BURST_SCENE_KEY), "fx-tap", "play", { x, y }, 0);
}

// The screen's art, or dark brown over the whole screen while it is missing or the screen has
// none.
export function addScreenBackdrop(scene: Scene, key?: string): void {
  if (key !== undefined && scene.textures.exists(key)) {
    scene.add.image(0, 0, key).setOrigin(0);
  } else {
    fillRect(scene.add.graphics(), PALETTE.darkBrown, SCREEN_LAYOUT.screen);
  }
}

// Destroys everything the scene drew except keep, such as an overlay's ramp dim.
export function clearScene(scene: Scene, keep: readonly GameObjects.GameObject[] = []): void {
  for (const child of [...scene.children.list]) {
    if (!keep.includes(child)) {
      child.destroy();
    }
  }
}
