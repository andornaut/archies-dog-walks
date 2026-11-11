import type { Scene } from "phaser";

import type { DetailMeasure } from "../home/detailCardView.ts";
import { modalTitleLayout } from "../home/modalLayout.ts";
import { GREETING_FIT } from "../hud/celebrationLayout.ts";
import type { CelebrationMeasure } from "../hud/celebrationView.ts";
import { NOTE_PLATE } from "../hud/pauseMenu.ts";
import type { PanelMeasure } from "../hud/questionPanelView.ts";
import { PALETTE } from "../ui/palette.ts";
import {
  fitPixelText,
  type FontRole,
  labelInkWidth,
  pixelFontMetrics,
  setPixelText,
  withProbe,
  wrapPixelText,
} from "../ui/phaser/pixelText.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { firstTag } from "./sprites.ts";

// Measure actual game glyph ink without changing its role's font size.
export function modalTextWidth(scene: Scene, font: FontRole, values: readonly string[]): number {
  return withProbe(scene, { colour: PALETTE.plum, font, scale: TEXT_SCALE }, (probe) => {
    const widthOf = labelInkWidth(probe);
    return Math.max(0, ...values.map((value) => widthOf({ scale: TEXT_SCALE }, value)));
  });
}

export function measureModalTitle(scene: Scene, room: number, title: string) {
  return withProbe(scene, { colour: PALETTE.plum, font: "title", scale: TEXT_SCALE }, (probe) => {
    const measure = labelInkWidth(probe);
    return modalTitleLayout(
      {
        font: pixelFontMetrics(scene, "title"),
        widthOf: (value) => measure({ scale: TEXT_SCALE }, value),
      },
      room,
      title,
    );
  });
}

// A panel's text measured on the bitmap fonts scene draws it in.
export function canvasPanelMeasure(scene: Scene): PanelMeasure {
  return {
    body: pixelFontMetrics(scene, "body"),
    inkWidth: (font, line) => modalTextWidth(scene, font, [line]),
    title: pixelFontMetrics(scene, "title"),
    wrapNote: (width, text) =>
      wrapPixelText(scene, { colour: PALETTE.plum, scale: NOTE_PLATE.scale }, width, text),
  };
}

// 2x body text, as a detail card's rows are drawn.
const DETAIL_TEXT = { colour: PALETTE.plum, scale: TEXT_SCALE } as const;

// A detail card's text and art measured on what scene has loaded: a label's width as the canvas
// bounds it, and art's size by its default frame, which an image and a sheet's frames share.
export function canvasDetailMeasure(scene: Scene): DetailMeasure {
  return {
    ...canvasPanelMeasure(scene),
    art: (key) => {
      if (!scene.textures.exists(key)) {
        return undefined;
      }
      const frame = scene.textures.getFrame(key);
      return { height: frame.realHeight, width: frame.realWidth };
    },
    bodyWidth: (lines) =>
      withProbe(scene, DETAIL_TEXT, (probe) => {
        setPixelText(probe, lines.join("\n"));
        return probe.getBounds().right - probe.x;
      }),
    hasTag: (key, tag) => firstTag(scene, key, [tag]) !== undefined,
    wrapBody: (width, text) => wrapPixelText(scene, DETAIL_TEXT, width, text),
  };
}

// A zone celebration's text and art measured as a detail card's are, and its greeting fitted
// on the body font.
export function canvasCelebrationMeasure(scene: Scene): CelebrationMeasure {
  return {
    ...canvasDetailMeasure(scene),
    fitGreeting: (text) =>
      withProbe(scene, DETAIL_TEXT, (probe) => {
        setPixelText(probe, text);
        return fitPixelText(probe, GREETING_FIT, 0, 0);
      }),
  };
}
