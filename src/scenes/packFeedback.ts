import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { playTagOnce } from "../assets/phaser/index.ts";
import { gameData, SCREEN_CONFIG } from "../data/index.ts";
import {
  ABOVE_DOG_GAP,
  changeChipAt,
  chipLeft,
  collisionHeartRow,
  FEEDBACK,
  FLY_HEART,
  type LabelAnchor,
  stackOverPop,
} from "../hud/index.ts";
import { COMIC_WORDS, SCREEN_LAYOUT } from "../layout/index.ts";
import { lineInk, PALETTE, TEXT_SCALE } from "../ui/index.ts";
import {
  addPixelText,
  CREAM_PANEL_COLOURS,
  drawFramedRect,
  inkSpan,
  pixelBitmapFont,
  pixelFontMetrics,
  placePixelText,
} from "../ui/phaser/index.ts";
import { letterEffect } from "./comicWord.ts";
import { FEEDBACK_ART } from "./feedbackArt.ts";
import { dogTop } from "./pullSignals.ts";
import { fadeAway } from "./uiKit.ts";

// A sidestep puff, 48x48, laid on the dog's frame and lettered with the dodge word.
const DODGE_ART = { key: "fx-dodge", tag: "play" } as const;

interface PackMoment {
  depth: number;
  still: boolean;
}

// A dog's dodge: fx-dodge's play tag laid on the dog's frame at its top-left with the
// dodge word over its first frames, or, with reduced motion or while that art is missing, the
// dodge label rising over the dog.
export function playDodge(scene: Scene, moment: PackMoment, dog: GameObjects.Sprite): void {
  const art = !moment.still && scene.anims.exists(animationKey(DODGE_ART.key, DODGE_ART.tag));
  if (art) {
    const { x, y } = dog.getTopLeft();
    const sprite = scene.add.sprite(x, y, DODGE_ART.key).setOrigin(0).setDepth(moment.depth);
    playTagOnce(sprite, DODGE_ART.key, DODGE_ART.tag, () => sprite.destroy());
    const { frames, ...place } = COMIC_WORDS.dodge;
    letterEffect(sprite, place, frames, gameData.runText.comicWords.dodge);
    return;
  }
  const anchor = headLabel(scene, dogTop(dog));
  floatLabel(scene, moment, anchor, gameData.runText.dodge, PALETTE.plum, FEEDBACK.dodge);
}

// A loss the walker's perk forgave: the forgiven label rising over the dog, from its top
// opaque row, or stacked over the heart pop over it (stackOverPop), pop's frame placed by the
// caller, centred on the pop.
export function playForgiven(
  scene: Scene,
  moment: PackMoment,
  dog: { readonly pop: HeartPopPlace | null; readonly top: Point },
): void {
  const { pop, top } = dog;
  const anchor =
    pop === null
      ? headLabel(scene, top)
      : (pop.forgiven ?? {
          centreX: pop.frame.x + FLY_HEART.frame / 2,
          lineBottom: stackOverPop(pop, 0).bottom,
        });
  const { forgiven } = FEEDBACK;
  floatLabel(scene, moment, anchor, gameData.runText.forgiven, PALETTE.forest, forgiven);
}

// A heart pop's 32x32 frame's top-left, and its top opaque row in it.
export interface HeartPopPlace {
  readonly frame: Point;
  readonly forgiven?: LabelAnchor;
  readonly inkTop: number;
}

function headLabel(scene: Scene, top: Point): LabelAnchor {
  return {
    centreX: top.x,
    lineBottom: Math.max(SCREEN_LAYOUT.walkView.y + floatChipHeight(scene), top.y - ABOVE_DOG_GAP),
  };
}

// A wholly forgiven collision has the heart and caption, with no signed loss.
export function wholeForgivenRow(scene: Scene, head: Point): HeartPopPlace | undefined {
  const font = pixelBitmapFont(scene, "body");
  if (font === undefined) {
    return undefined;
  }
  const ink = lineInk(font, gameData.runText.forgiven, TEXT_SCALE);
  const width = ink.right - ink.left;
  const { chip } = changeChipAt(
    pixelFontMetrics(scene, "body"),
    { x: 0, y: 0 },
    { lines: 1, scale: TEXT_SCALE, width },
  );
  const art = FEEDBACK_ART.heartGain.popInk;
  const { chips, frame } = collisionHeartRow(
    SCREEN_LAYOUT.walkView,
    head,
    { height: art.bottom - art.top, width: art.right - art.left, x: art.left, y: art.top },
    [{ ...chip, padX: (chip.width - width) / 2 }],
  );
  const caption = chips[0]!;
  return {
    forgiven: { centreX: caption.x + caption.width / 2, lineBottom: caption.y + caption.height },
    frame,
    inkTop: art.top,
  };
}

// The height of a floating label's chip, its text on one line.
export function floatChipHeight(scene: Scene): number {
  const shown = { lines: 1, scale: TEXT_SCALE, width: 0 };
  return changeChipAt(pixelFontMetrics(scene, "body"), { x: 0, y: 0 }, shown).chip.height;
}

// Body text at 2x on a cream chip, as a change label's (CHANGE_CHIP), centred on the anchor
// (moved in to stay on screen) with its bottom on the anchor's line bottom; held fully opaque
// for holdMs, then rising and fading out over the rest of ms; with reduced motion it fades in
// place. The chip and its text are one container, the text after the chip, so the text always
// draws over it.
export function floatLabel(
  scene: Scene,
  moment: PackMoment,
  anchor: LabelAnchor,
  text: string,
  colour: number,
  timing: { holdMs: number; ms: number; rise: number },
): void {
  const body = pixelFontMetrics(scene, "body");
  const label = addPixelText(scene, 0, 0, text, { colour, scale: TEXT_SCALE });
  const ink = inkSpan(label);
  const font = pixelBitmapFont(scene, "body");
  const rows = font === undefined ? undefined : lineInk(font, text, TEXT_SCALE);
  const shown = {
    ...(rows === undefined ? {} : { ink: { rows: rows.bottom - rows.top, top: rows.top } }),
    lines: 1,
    scale: TEXT_SCALE,
    width: ink.right - ink.left,
  };
  const { height, width } = changeChipAt(body, { x: 0, y: 0 }, shown).chip;
  const x = chipLeft(SCREEN_CONFIG.width, anchor.centreX, width);
  const placed = changeChipAt(body, { x, y: anchor.lineBottom - height }, shown);
  placePixelText(label, placed.text.x - ink.left, placed.text.y);
  const box = scene.add.graphics();
  drawFramedRect(box, CREAM_PANEL_COLOURS, placed.chip);
  const chip = scene.add.container(0, 0, [box, label]).setDepth(moment.depth);
  fadeAway(scene, [chip], {
    delayMs: timing.holdMs,
    ms: timing.ms - timing.holdMs,
    rise: moment.still ? 0 : timing.rise,
  });
}
