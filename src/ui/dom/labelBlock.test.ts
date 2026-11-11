import { advanceWidth, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameFont } from "../../testing/fontInk.ts";
import { deviceX, deviceY, domScale, fontPixel } from "../domScale.ts";
import { inPill, laidPills, PILL, pillRows } from "../namePills.ts";
import { labelPlace } from "./labelBlock.ts";

const font = gameFont("font-body");

describe("labelPlace", () => {
  it.each([1, 2, 3])(
    "starts each line on the game pixel the canvas rounds its glyphs to, at DPR %d",
    (dpr) => {
      const scale = domScale(dpr, { height: 560, width: 360, x: 0, y: 0 });
      const pixel = fontPixel(scale, 1);
      // A centred line half a font pixel in, on a label mid-shake.
      const label = {
        colour: 0,
        font: "body",
        lines: [
          { pen: 0, text: "Hold your" },
          { pen: 2.5, text: "nose" },
        ],
        pills: "colour",
        scale: 1,
        x: 120.4,
        y: 300,
      } as const;
      const place = labelPlace(font, scale, label);
      expect(place.runs.map(({ left, top }) => [left, top])).toEqual([
        [deviceX(scale, 120), deviceY(scale, 300)],
        [deviceX(scale, 123), deviceY(scale, 300) + font.lineHeight * pixel],
      ]);
    },
  );

  it("draws a name's runs on its pill, where the canvas draws the pill", () => {
    const scale = domScale(2, { height: 560, width: 360, x: 0, y: 0 });
    const pixel = fontPixel(scale, 2);
    const text = `${inPill(3, "Rush hour")} More of all`;
    const place = labelPlace(font, scale, {
      colour: 0,
      font: "body",
      lines: [{ pen: 0, text }],
      pills: "colour",
      scale: 2,
      x: 40,
      y: 200,
    });
    expect(place.runs.map(({ pill, text: run }) => [run, pill])).toEqual([
      ["Rush", 3],
      ["hour", 3],
      [" More of all", undefined],
    ]);
    const [pill] = laidPills(
      1,
      laidGlyphs(font, 1, text).map((glyph) => ({ ...glyph, line: 0 })),
    );
    expect(place.pills).toEqual([
      {
        box: {
          height: PILL.height * pixel,
          left: deviceX(scale, 40) + (pill?.left ?? 0) * pixel,
          top: deviceY(scale, 200) + pillRows(1).top * pixel,
          width: ((pill?.right ?? 0) - (pill?.left ?? 0)) * pixel,
        },
        index: 3,
      },
    ]);
    const before = text.slice(0, text.indexOf(" More"));
    expect(place.runs.at(-1)?.left).toBe(
      deviceX(scale, 40) + advanceWidth(font, 1, before) * pixel,
    );
  });
});
