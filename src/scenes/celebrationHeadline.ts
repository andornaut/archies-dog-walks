import { wrapWords } from "@andornaut/game-kit/lines";
import { type BitmapFont, inkWidth, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import type { GameObjects, Scene } from "phaser";

import { CELEBRATION_LAYOUT as LAYOUT } from "../hud/celebrationLayout.ts";
import { LABEL_ALIGN_DATA } from "../ui/dom/labelBlock.ts";
import { PALETTE } from "../ui/palette.ts";
import { addDisplayText } from "../ui/phaser/displayText.ts";

function labelFont(scene: Scene, label: GameObjects.BitmapText): BitmapFont {
  const { data } = scene.cache.bitmapFont.get(label.font) as { data: PhaserFontData };
  return phaserBitmapFont(data);
}

// Position actual glyph ink, including the display font's baked outline and shadow.
function placeInk(
  font: BitmapFont,
  scale: number,
  top: number,
  label: GameObjects.BitmapText,
): void {
  const spans = laidGlyphs(font, scale, label.text).flatMap(({ ink }) =>
    ink === null ? [] : [ink],
  );
  const left = Math.min(...spans.map((ink) => ink.left));
  const right = Math.max(...spans.map((ink) => ink.right));
  const glyphs = [...label.text].flatMap((char) => {
    const glyph = font.glyphs.get(char);
    return glyph !== undefined && glyph.width > 0 ? [glyph] : [];
  });
  const inkTop = Math.min(...glyphs.map((glyph) => glyph.yOffset)) * scale;
  label.setScale(scale).setPosition(Math.round(LAYOUT.centreX - (left + right) / 2), top - inkTop);
  // Its ink is centred, so the HTML interface lays it out about its middle.
  label.setData(LABEL_ALIGN_DATA, "centre");
}

// Full-scene celebration headings keep their size, word-wrap, and reserve a fixed two-line slot.
export function addCelebrationHeadline(
  scene: Scene,
  text: { title: string; subtitle: string },
): void {
  const style = { colour: PALETTE.yellow, font: "title", originX: 0 } as const;
  const title = addDisplayText(scene, 0, 0, text.title, style);
  const font = labelFont(scene, title);
  const width = (line: string) => inkWidth(font, LAYOUT.titleScale, line);
  const lines = wrapWords(width, LAYOUT.titleRoom, title.text);
  if (lines.length > LAYOUT.titleLines || lines.some((line) => width(line) > LAYOUT.titleRoom)) {
    throw new Error("Celebration title exceeds its fixed-size two-line slot");
  }
  lines.forEach((line, index) => {
    const label = index === 0 ? title.setText(line) : addDisplayText(scene, 0, 0, line, style);
    placeInk(font, LAYOUT.titleScale, LAYOUT.titleInkTop + index * LAYOUT.titlePitch, label);
  });
  const subtitle = addDisplayText(scene, 0, 0, text.subtitle, {
    ...style,
    colour: PALETTE.cream,
    variant: "cream",
  });
  placeInk(labelFont(scene, subtitle), 1, LAYOUT.subtitleInkTop, subtitle);
}
