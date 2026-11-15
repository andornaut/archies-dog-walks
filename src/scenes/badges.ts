import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data/index.ts";
import type { AchievementId } from "../data/types.ts";
import {
  type BadgeCardView,
  badgeCardView,
  type BurstEffect,
  CONFETTI,
} from "../home/badgeCardView.ts";
import {
  badgeNameTops,
  type BadgeRowNames,
  badgeRowNames,
  earnedBadges,
  panelBadgeStrip,
  stripUnderClose,
} from "../home/badgesView.ts";
import type { DetailText } from "../home/detailCardView.ts";
import { achievementLabel } from "../rules/achievements.ts";
import { PALETTE } from "../ui/palette.ts";
import { labelInkWidth, type PixelTextStyle, withProbe } from "../ui/phaser/pixelText.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";
import { playTagOnce } from "./sprites.ts";
import { tagFrame } from "./uiKit.ts";

const BURST_TAG = "play";

// A one-shot effect's play tag centred on a point: it plays once and is removed, or with
// reduced motion holds one still frame.
type Burst = Pick<BurstEffect, "key" | "stillFrame">;

export const NEW_BEST_BURST: Burst = { key: "fx-new-best", stillFrame: 3 };

export function addBurst(
  scene: Scene,
  reduced: boolean,
  burst: Burst,
  scale: number,
  centreX: number,
  centreY: number,
): GameObjects.Sprite | undefined {
  if (!scene.textures.exists(burst.key)) {
    return undefined;
  }
  const sprite = scene.add
    .sprite(Math.round(centreX), Math.round(centreY), burst.key)
    .setScale(scale);
  if (reduced) {
    const frame = tagFrame(scene, burst.key, BURST_TAG, burst.stillFrame);
    if (frame !== undefined) {
      sprite.setFrame(frame);
    }
    return sprite;
  }
  playTagOnce(sprite, burst.key, BURST_TAG, () => sprite.destroy());
  return sprite;
}

// fx-confetti behind a badge drawn at scale.
export function addConfetti(
  scene: Scene,
  reduced: boolean,
  scale: number,
  centreX: number,
  centreY: number,
): GameObjects.Sprite | undefined {
  return addBurst(scene, reduced, CONFETTI, scale, centreX, centreY);
}

// Each badge's name under it, where the strip names them: its lines in one style for the row
// (badgeRowNames), each line centred on its slot as a label with originX 0.5 there.
export function badgeCelebrationNames(
  scene: Scene,
  panel: Rect,
  rows: number,
  ids: readonly AchievementId[],
  closes: boolean,
): DetailText[] {
  const rect = closes ? stripUnderClose(panel) : panel;
  const badges = earnedBadges(gameData, ids);
  const strip = panelBadgeStrip(rect, rows, badges.length);
  if (!strip.named) {
    return [];
  }
  const style = { colour: PALETTE.plum, originX: 0.5, scale: TEXT_SCALE };
  const slotWidth = strip.slots[0]?.width ?? 0;
  const named = badges.map((badge) => (closes ? achievementLabel(gameData, badge) : badge.name));
  const names = rowNames(scene, style, slotWidth, named);
  const { scale } = names.style;
  return badges.flatMap((_, i) => {
    const slot = strip.slots[i];
    const lines = names.lines[i] ?? [];
    const tops = badgeNameTops(lines.length, rect.y);
    return slot === undefined
      ? []
      : lines.map((line, n): DetailText => ({
          align: "centre",
          capTop: tops[n] ?? 0,
          colour: style.colour,
          lines: [line],
          scale,
          x: Math.round(slot.centreX),
        }));
  });
}

// A badge's card's view (badgeCardView), measured on scene's fonts and art.
export function badgeCard(
  scene: Scene,
  dim: Rect,
  card: Parameters<typeof badgeCardView>[3],
): BadgeCardView {
  return badgeCardView(gameData, canvasDetailMeasure(scene), dim, card);
}

// A strip's names set as badgeRowNames gives them, measured on the font they are drawn in.
function rowNames(
  scene: Scene,
  style: PixelTextStyle,
  slotWidth: number,
  names: readonly string[],
): BadgeRowNames {
  return withProbe(scene, style, (probe) => badgeRowNames(labelInkWidth(probe), slotWidth, names));
}
