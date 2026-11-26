import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { PALETTE, plainMarks } from "../ui/index.ts";
import { CELEBRATION_LAYOUT as LAYOUT } from "./celebrationLayout.ts";

export interface CelebrationHeadlineLine {
  readonly colour: number;
  readonly inkTop: number;
  readonly scale: number;
  readonly text: string;
}

// Full-scene titles retain their two fixed-size rows and visible-ink positions.
export function celebrationHeadlineView(
  font: BitmapFont,
  text: { readonly title: string; readonly subtitle: string },
): readonly CelebrationHeadlineLine[] {
  const width = (line: string) => inkWidth(font, LAYOUT.titleScale, line);
  const lines = wrapWords(width, LAYOUT.titleRoom, plainMarks(text.title).toUpperCase());
  if (lines.length > LAYOUT.titleLines || lines.some((line) => width(line) > LAYOUT.titleRoom)) {
    throw new Error("Celebration title exceeds its fixed-size two-line slot");
  }
  return [
    ...lines.map((line, index) => ({
      colour: PALETTE.yellow,
      inkTop: LAYOUT.titleInkTop + index * LAYOUT.titlePitch,
      scale: LAYOUT.titleScale,
      text: line,
    })),
    {
      colour: PALETTE.cream,
      inkTop: LAYOUT.subtitleInkTop,
      scale: 1,
      text: plainMarks(text.subtitle).toUpperCase(),
    },
  ];
}
