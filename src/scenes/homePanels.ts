import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { laidGlyphs } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { DETAIL_WELL_KEY, type DetailCardView, detailCardView } from "../home/detailCardView.ts";
import { shownText } from "../ui/dom/pixelLine.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { fontPixel } from "../ui/domScale.ts";
import { inkWithPills } from "../ui/namePills.ts";
import { pixelBitmapFont } from "../ui/phaser/pixelText.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
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
  const measure = canvasDetailMeasure(scene);
  const scale = uiLayer()?.scale();
  const font = pixelBitmapFont(scene, "body");
  if (scale === undefined || font === undefined) {
    return detailCardView(gameData, measure, dim, detail);
  }
  const density = scale.unit * scale.dpr;
  const pixel = fontPixel(scale, TEXT_SCALE);
  const inkRight = (line: string) =>
    (inkWithPills(
      1,
      laidGlyphs(font, 1, shownText("body", line)).map((glyph) => ({ ...glyph, line: 0 })),
    )?.right ?? 0) * pixel;
  return detailCardView(
    gameData,
    {
      ...measure,
      bodyWidth: (lines) => Math.max(0, ...lines.map(inkRight)) / density,
      // The snapped distance between two edges is at least the floor of their exact distance.
      wrapBody: (room, text) => wrapWords(inkRight, Math.floor(room * density + 1e-9), text),
    },
    dim,
    detail,
  );
}
