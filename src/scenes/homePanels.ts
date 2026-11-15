import { insetRect, type Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { DETAIL_WELL_KEY, type DetailCardView, detailCardView } from "../home/detailCardView.ts";
import { PALETTE } from "../ui/palette.ts";
import { drawRing } from "../ui/phaser/draw.ts";
import { AFFORD_OUTSET } from "../ui/selection.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";
import { addLoopingFrame, selectOuter } from "./uiKit.ts";

export { DETAIL_WELL_KEY };

// The world Pet shop keeps its authored affordability glint and reduced-motion frame.
export function addAffordFrame(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  reducedMotion: boolean,
): void {
  const outer = selectOuter(rect, AFFORD_OUTSET);
  addLoopingFrame(scene, parent, { key: "ui-afford", outer, tag: "glint" }, reducedMotion, (g) => {
    drawRing(g, PALETTE.plum, outer, 1);
    drawRing(g, PALETTE.amber, insetRect(1, outer), 1);
  });
}

// Native detail cards use the same scene font and art measurements.
export function detailView(
  scene: Scene,
  dim: Rect,
  detail: Parameters<typeof detailCardView>[3],
): DetailCardView {
  return detailCardView(gameData, canvasDetailMeasure(scene), dim, detail);
}
