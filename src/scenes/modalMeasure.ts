import type { Scene } from "phaser";

import { modalTitleLayout } from "../home/modalLayout";
import { PALETTE } from "../ui/palette";
import { type FontRole, labelInkWidth, pixelFontMetrics, withProbe } from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";

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
