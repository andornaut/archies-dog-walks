import { fontMetrics, inkWidth, leftBearing } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameFont } from "../../testing/fontInk.ts";
import { domScale, snapX, snapY } from "../domScale.ts";
import { shownText, textPlace } from "./pixelLine.ts";

const onGrid = (dpr: number, css: number) => Math.abs(css * dpr - Math.round(css * dpr)) < 1e-6;

describe("textPlace", () => {
  it.each([1, 2, 2.625, 3])(
    "puts a line's pen, capitals and ink middle on the device grid at DPR %d",
    (dpr) => {
      const scale = domScale(dpr, { height: 611, width: 393, x: 0, y: 0 });
      const font = gameFont("font-title");
      const line = {
        capTop: 100,
        centreX: 180,
        colour: 0,
        font: "title",
        scale: 2,
        text: "Resume",
      } as const;
      const place = textPlace(font, scale, { x: 0, y: 0 }, line);
      const pixel = place.fontSize / 8;
      expect(onGrid(dpr, pixel)).toBe(true);
      expect(onGrid(dpr, place.left)).toBe(true);
      expect(place.top + fontMetrics(font).capTop * pixel).toBeCloseTo(
        snapY(scale, line.capTop),
        9,
      );
      const text = shownText("title", line.text);
      const first = leftBearing((char) => font.glyphs.get(char), text);
      const middle = place.left + (first + inkWidth(font, 1, text) / 2) * pixel;
      expect(Math.abs(middle - snapX(scale, line.centreX))).toBeLessThanOrEqual(0.5 / dpr + 1e-9);
    },
  );

  it("writes the title font's text in capitals with plain marks", () => {
    expect(shownText("title", "Don’t stop")).toBe("DON'T STOP");
    expect(shownText("body", "Don’t stop")).toBe("Don't stop");
  });
});
