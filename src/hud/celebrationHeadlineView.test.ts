import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import { gameFont } from "../testing/fontInk.ts";
import { domScale } from "../ui/domScale.ts";
import { celebrationHeadlineView } from "./celebrationHeadlineView.ts";
import { zoneHeadlineParts } from "./dom/celebration.ts";
import { celebrationText } from "./zoneCelebration.ts";

it("keeps both celebration title rows and subtitle at their full-size visible-ink positions", () => {
  const font = gameFont("font-display");
  const welcome = celebrationText(gameData, { kind: "newWalker", walker: "mrB" });
  for (const title of [welcome.title, gameData.runText.zoneDone.title]) {
    const lines = celebrationHeadlineView(font, {
      subtitle: welcome.subtitle,
      title,
    });
    expect(lines.map(({ scale }) => scale)).toEqual([3, 3, 1]);
    expect(lines.map(({ inkTop }) => inkTop)).toEqual([44, 94, 146]);
  }
});

it("places native display glyph ink on the shared title and subtitle rows", () => {
  const font = gameFont("font-display");
  const text = celebrationText(gameData, { kind: "newWalker", walker: "mrB" });
  const lines = celebrationHeadlineView(font, text);
  const parts = zoneHeadlineParts(new FakeDocument() as unknown as Document, font, text);
  parts.forEach((part, i) => {
    part.place(domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
    const line = lines[i]!;
    const ink = Math.min(
      ...[...line.text].flatMap((char) => {
        const glyph = font.glyphs.get(char);
        return glyph !== undefined && glyph.width > 0 ? [glyph.yOffset] : [];
      }),
    );
    expect(Number.parseFloat(part.element.style.top) + ink * line.scale).toBe(line.inkTop);
  });
});
