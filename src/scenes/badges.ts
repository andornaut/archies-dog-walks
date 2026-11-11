import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import type { AchievementId, DogId } from "../data/types.ts";
import {
  type BadgeCardView,
  badgeCardView,
  type BurstEffect,
  CONFETTI,
} from "../home/badgeCardView.ts";
import {
  BADGE_STRIP,
  badgeNameTops,
  type BadgeRowNames,
  badgeRowNames,
  type BadgeView,
  celebrationTitle,
  earnedBadges,
  panelBadgeStrip,
  stripUnderClose,
} from "../home/badgesView.ts";
import type { DetailText } from "../home/detailCardView.ts";
import { achievementLabel } from "../rules/achievements.ts";
import { PALETTE } from "../ui/palette.ts";
import { addModalShade, fillRect } from "../ui/phaser/draw.ts";
import { labelInkWidth, type PixelTextStyle, withProbe } from "../ui/phaser/pixelText.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { addCardTitle, addDetailContent, addDetailText } from "./homePanels.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";
import { playTag, playTagOnce } from "./sprites.ts";
import { addCloseButton, addPanel, tagFrame } from "./uiKit.ts";

export const BADGE_SIZE = BADGE_STRIP.badgeSize;
const BURST_TAG = "play";
const POP = { delayMs: 140, durationMs: 320 } as const;

type Placed = GameObjects.Graphics | GameObjects.Image;

// A badge's earned or locked frame centred on a point, or a box in its state's colour while the
// art is missing.
export function addBadge(
  scene: Scene,
  art: string,
  earned: boolean,
  centreX: number,
  centreY: number,
): Placed {
  const frame = tagFrame(scene, art, earned ? "earned" : "locked");
  if (frame !== undefined) {
    return scene.add.image(Math.round(centreX), Math.round(centreY), art, frame);
  }
  const half = BADGE_SIZE / 2;
  return scene.add
    .graphics({ x: Math.round(centreX), y: Math.round(centreY) })
    .fillStyle(earned ? PALETTE.amber : PALETTE.grey)
    .fillRect(-half, -half, BADGE_SIZE, BADGE_SIZE);
}

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

// Badges just earned, side by side in rows rows of a panel with confetti behind each: they pop
// in one after another, or with reduced motion are simply there over a still frame of confetti.
// Every name under its badge is set in one style for the row (badgeRowNames), centred on its
// slot. closes: the panel is a modal card with a close control in its top-right corner, which
// the caller draws: the title is placed beside it (addCardTitle) and the badges clear it
// (stripUnderClose). Returns the badges in their slots' order.
export function addBadgeCelebration(
  scene: Scene,
  reduced: boolean,
  panel: Rect,
  rows: number,
  ids: readonly AchievementId[],
  closes: boolean,
  // Whether the canvas draws the title and the names, or the HTML interface does over it.
  text = true,
): BadgeView[] {
  addPanel(scene, panel);
  if (text) {
    const title = celebrationTitle(gameData, ids.length);
    addCardTitle(scene, panel, title, closes, panel.y + BADGE_STRIP.titleY);
    for (const name of badgeCelebrationNames(scene, panel, rows, ids, closes)) {
      for (const label of addDetailText(scene, undefined, name)) {
        label.setDepth(1);
      }
    }
  }
  const rect = closes ? stripUnderClose(panel) : panel;
  const badges = earnedBadges(gameData, ids);
  const strip = panelBadgeStrip(rect, rows, badges.length);
  badges.forEach((badge, i) => {
    const slot = strip.slots[i];
    if (slot === undefined) {
      return;
    }
    const delay = i * POP.delayMs;
    const badgeY = rect.y + slot.top + BADGE_SIZE / 2;
    const burst = () => addConfetti(scene, reduced, 1, slot.centreX, badgeY);
    const image = addBadge(scene, badge.art, true, slot.centreX, badgeY);
    if (reduced) {
      burst();
      image.setDepth(1);
      return;
    }
    image.setScale(0).setDepth(1);
    scene.time.delayedCall(delay, burst);
    scene.tweens.add({
      delay,
      duration: POP.durationMs,
      ease: "Back.easeOut",
      scale: 1,
      targets: image,
    });
  });
  return badges;
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

// A badge's card in parent as its view lays it out: the dim, the ui-panel, the close control,
// any confetti behind the badge, the badge at 2x, then its name, status, goal and line.
export function drawBadgeCard(
  scene: Scene,
  parent: GameObjects.Container,
  view: BadgeCardView,
): void {
  parent.add([addModalShade(scene, view.dim), addPanel(scene, view.panel)]);
  addCloseButton(scene, parent, view.close, false);
  const { confetti } = view;
  if (confetti !== undefined) {
    const { at, scale, still } = confetti;
    const sprite = addConfetti(scene, still, scale, at.x, at.y);
    if (sprite !== undefined) {
      parent.add(sprite);
    }
  }
  const g = scene.add.graphics();
  view.fills.forEach(({ colour, rect }) => fillRect(g, colour, rect));
  parent.add(g);
  addDetailContent(scene, parent, { ...view, framed: [] });
}

// A badge's card, the one every screen opens on a badge, in parent over dim, the part of the
// screen it dims (badgeCardView). An earned badge bursts with confetti when burst is set, or
// with reduced motion shows a still frame of it. Returns the card's rect.
export function addBadgeDetail(
  scene: Scene,
  parent: GameObjects.Container,
  dim: Rect,
  reduced: boolean,
  burst: boolean,
  badge: BadgeView,
): Rect {
  const view = badgeCard(scene, dim, { badge, burst, reduced });
  drawBadgeCard(scene, parent, view);
  return view.panel;
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

// The owners cheering: their happy faces, hopping now and then unless motion is reduced.
export function addCheeringFace(
  scene: Scene,
  reduced: boolean,
  dog: DogId,
  x: number,
  y: number,
): GameObjects.Sprite {
  const key = ownerFaceKey(gameData, dog);
  const face = scene.add.sprite(x, y, key).setOrigin(0);
  playTag(face, key, "happy", reduced);
  if (!reduced) {
    scene.tweens.add({
      duration: 180,
      ease: "Sine.easeOut",
      hold: 60,
      repeat: -1,
      repeatDelay: 600,
      targets: face,
      y: y - 4,
      yoyo: true,
    });
  }
  return face;
}
