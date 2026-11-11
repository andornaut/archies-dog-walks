import { fittingText } from "@andornaut/game-kit/text/textFit";
import type { Scene } from "phaser";

import type { SettingsMeasure } from "../home/settingsView.ts";
import { PALETTE } from "../ui/palette.ts";
import { inkSpan, labelInkWidth, setPixelText, withProbe } from "../ui/phaser/pixelText.ts";
import { TEXT_SCALE, textOnLines } from "../ui/textFit.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";

// The settings card's text measured on the bitmap fonts scene draws it in: body text fitted as
// fitPixelText fits a label, and a line's ink as inkSpan reads it off one.
export function canvasSettingsMeasure(scene: Scene): SettingsMeasure {
  return {
    ...canvasPanelMeasure(scene),
    fitBody: (lines, room, text) =>
      withProbe(scene, { colour: PALETTE.plum, scale: TEXT_SCALE }, (probe) => {
        setPixelText(probe, text);
        return fittingText(textOnLines(lines), labelInkWidth(probe), room, probe.text).lines;
      }),
    ink: (font, scale, text) =>
      withProbe(scene, { colour: PALETTE.plum, font, scale }, (probe) => {
        setPixelText(probe, text);
        return inkSpan(probe);
      }),
  };
}
