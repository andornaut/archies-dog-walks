import {
  advanceWidth,
  fontMetrics,
  inkWidth,
  laidGlyphs,
  leftBearing,
} from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameFont } from "../../testing/fontInk.ts";
import { deviceX, deviceY, domScale, fontPixel } from "../domScale.ts";
import { inPill, laidPills, PILL, pillRows } from "../namePills.ts";
import { blockPlace, penRuns, shownText, spokenText, textPlace } from "./pixelLine.ts";

const ORIGIN = { x: 0, y: 0 };

describe("textPlace", () => {
  it.each([1, 2, 2.625, 3])(
    "puts a line's pen, capitals and ink middle on device pixels at DPR %d",
    (dpr) => {
      const scale = domScale(dpr, { height: 611, width: 393, x: 0, y: 0 });
      const font = gameFont("font-title");
      const line = {
        capTop: 100,
        centre: "ink",
        centreX: 180,
        colour: 0,
        font: "title",
        scale: 2,
        text: "Resume",
      } as const;
      const place = textPlace(font, scale, ORIGIN, line);
      const pixel = fontPixel(scale, 2);
      expect(place.fontSize).toBe(8 * pixel);
      expect(place.lineHeight).toBe(font.lineHeight * pixel);
      expect(Number.isInteger(place.left) && Number.isInteger(place.top)).toBe(true);
      expect(place.top + fontMetrics(font).capTop * pixel).toBe(deviceY(scale, line.capTop));
      const text = shownText("title", line.text);
      const first = leftBearing((char) => font.glyphs.get(char), text);
      const middle = place.left + (first + inkWidth(font, 1, text) / 2) * pixel;
      expect(Math.abs(middle - deviceX(scale, line.centreX))).toBeLessThanOrEqual(0.5);
    },
  );

  it("sets a block's later lines whole font lines under its first", () => {
    const scale = domScale(3, { height: 516, width: 331.703125, x: 14.140625, y: 0 });
    const font = gameFont("font-body");
    const pixel = fontPixel(scale, 2);
    const at = (line: number) =>
      textPlace(font, scale, ORIGIN, {
        capTop: 348 + line * font.lineHeight * 2,
        centre: "advance",
        centreX: 180,
        colour: 0,
        font: "body",
        line,
        scale: 2,
        text: "Ending now keeps all",
      }).top;
    expect(at(1) - at(0)).toBe(font.lineHeight * pixel);
    expect(at(2) - at(0)).toBe(2 * font.lineHeight * pixel);
  });

  it("centres a line the canvas centres on its width by its advances", () => {
    const scale = domScale(1, { height: 560, width: 360, x: 0, y: 0 });
    const font = gameFont("font-body");
    const line = {
      capTop: 377,
      centreX: 180,
      colour: 0,
      font: "body",
      scale: 2,
      text: "$45.",
    } as const;
    // The canvas puts this note line's pen at 180 less half its 30px of advances.
    expect(textPlace(font, scale, ORIGIN, { ...line, centre: "advance" }).left).toBe(165);
    expect(textPlace(font, scale, ORIGIN, { ...line, centre: "ink" }).left).toBe(166);
  });

  it("writes the title font's text in capitals with plain marks", () => {
    expect(shownText("title", "Don’t stop")).toBe("DON'T STOP");
    expect(shownText("body", "Don’t stop")).toBe("Don't stop");
  });
});

describe("a block of text with name pills", () => {
  const font = gameFont("font-body");
  const line = `${inPill(1, "Second chance")} First lost`;

  it("splits a line at its pill characters, each run's pen where the bitmap font puts it", () => {
    const runs = penRuns(font, line);
    expect(runs.map(({ pill, text }) => [text, pill])).toEqual([
      ["Second", 1],
      ["chance", 1],
      [" First lost", undefined],
    ]);
    const penAt = (run: number) => {
      const before = [...line].slice(0, line.indexOf(runs[run]?.text ?? ""));
      return advanceWidth(font, 1, before.join(""));
    };
    expect(runs.map(({ pen }) => pen)).toEqual([0, 1, 2].map(penAt));
    expect(spokenText(line)).toBe("Second chance First lost");
  });

  it.each([1, 2, 3])("sets each pill behind its name in whole font pixels at DPR %d", (dpr) => {
    const scale = domScale(dpr, { height: 560, width: 360, x: 0, y: 0 });
    const block = { capTop: 300, colour: 0, font: "body", lines: ["Ready", line], scale: 2, x: 47 };
    const place = blockPlace(font, scale, { ...block, font: "body" });
    const pixel = fontPixel(scale, 2);
    const [pill] = laidPills(
      1,
      laidGlyphs(font, 1, line).map((glyph) => ({ ...glyph, line: 0 })),
    );
    const lineTop = deviceY(scale, 300) + (font.lineHeight - fontMetrics(font).capTop) * pixel;
    expect(place.pills).toEqual([
      {
        box: {
          height: PILL.height * pixel,
          left: deviceX(scale, 47) + (pill?.left ?? 0) * pixel,
          top: lineTop + pillRows(1).top * pixel,
          width: ((pill?.right ?? 0) - (pill?.left ?? 0)) * pixel,
        },
        index: 1,
      },
    ]);
    expect(place.cut).toBe(pixel);
    expect(place.runs.at(-1)?.top).toBe(lineTop);
  });
});
