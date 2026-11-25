import { insetRect, type Point } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { playEffect } from "../assets/phaser/sprites.ts";
import { gameData } from "../data/index.ts";
import type { LabelAnchor } from "../hud/feedback.ts";
import { BUFF_POP, CHARM, sparkleAt } from "../layout/buffLayout.ts";
import {
  effectIconFallback,
  type EffectItem,
  walkBarIconKey,
} from "../presentation/effectIcons.ts";
import { PALETTE } from "../ui/palette.ts";
import { addFilledRect, drawRing } from "../ui/phaser/draw.ts";
import { addPixelText } from "../ui/phaser/pixelText.ts";
import { floatLabel } from "./packFeedback.ts";
import { fadeAway } from "./uiKit.ts";

// A buff's charm and the value it made, as the road draws them.

const SPARKLE = { key: "fx-sparkle", tag: "play" } as const;
const WELL_KEY = "ui-effect-well";

// The charm at at: ui-effect-well (an ink square while it is missing) holding
// the buff's 20x20 icon (its name's first letter while that is missing), lit with a 1px amber
// ring around it.
export function addCharm(
  scene: Scene,
  item: EffectItem,
  at: Point,
  style: { lit: boolean },
): GameObjects.Container {
  const { ring, size } = CHARM;
  const parts: GameObjects.GameObject[] = [
    scene.textures.exists(WELL_KEY)
      ? scene.add.image(0, 0, WELL_KEY).setOrigin(0)
      : addFilledRect(scene, PALETTE.ink, { height: size, width: size, x: 0, y: 0 }),
    addCharmIcon(scene, item),
  ];
  if (style.lit) {
    const g = scene.add.graphics();
    drawRing(g, PALETTE.amber, insetRect(-ring, { height: size, width: size, x: 0, y: 0 }), ring);
    parts.push(g);
  }
  return scene.add.container(at.x, at.y, parts);
}

// The buff's icon in the well's place at 0,0: its 20x20 icon (its name's first letter while that
// is missing).
function addCharmIcon(scene: Scene, item: EffectItem): GameObjects.GameObject {
  const { icon, size } = CHARM;
  const iconKey = walkBarIconKey(item);
  return scene.textures.exists(iconKey)
    ? scene.add.image(icon, icon, iconKey).setOrigin(0)
    : addPixelText(scene, size / 2, size / 2 - 2, effectIconFallback(gameData, item), {
        colour: PALETTE.cream,
        originX: 0.5,
      });
}

// fx-sparkle over a charm or a well whose top-left is at, drawn at scale.
function sparkleCharm(
  scene: Scene,
  at: Point,
  depth: number,
  scale = 1,
): GameObjects.Sprite | undefined {
  return playEffect(scene, SPARKLE.key, SPARKLE.tag, sparkleAt(at, scale), depth);
}

// A buff's pop, shownAtMs into its moment: its charm appears lit at rect's top-left with
// fx-sparkle at its top-right, then at the moment's fadeAtMs fades out, rising unless motion is
// reduced.
export function popCharm(
  scene: Scene,
  moment: { depth: number; shownAtMs: number; still: boolean },
  item: EffectItem,
  rect: Point,
): void {
  const charm = addCharm(scene, item, rect, { lit: true }).setDepth(moment.depth);
  sparkleCharm(scene, rect, moment.depth + 1);
  const { fadeAtMs, fadeMs, rise } = BUFF_POP;
  fadeAway(scene, [charm], {
    delayMs: Math.max(0, fadeAtMs - moment.shownAtMs),
    ms: fadeMs,
    rise: moment.still ? 0 : rise,
  });
}

// The value a buff made, as floatLabel draws a label: font-title at TEXT_SCALE in forest on
// a floating chip, held until BUFF_POP's fadeAtMs, shownAtMs into its moment, then fading out,
// rising unless motion is reduced.
export function floatValue(
  scene: Scene,
  moment: { depth: number; shownAtMs: number; still: boolean },
  anchor: LabelAnchor,
  text: string,
): void {
  const { fadeAtMs, fadeMs, rise } = BUFF_POP;
  const holdMs = Math.max(0, fadeAtMs - moment.shownAtMs);
  floatLabel(scene, moment, anchor, text, PALETTE.forest, { holdMs, ms: holdMs + fadeMs, rise });
}
