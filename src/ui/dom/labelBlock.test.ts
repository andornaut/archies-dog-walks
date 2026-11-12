import { advanceWidth, fontMetrics, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameFont } from "../../testing/fontInk.ts";
import {
  artPixel,
  deviceX,
  deviceY,
  domScale,
  exactDeviceX,
  exactDeviceY,
  fontPixel,
} from "../domScale.ts";
import { inPill, laidPills, PILL, pillRows } from "../namePills.ts";
import { labelPlace } from "./labelBlock.ts";
import { inkEnd } from "./pixelLine.ts";

const font = gameFont("font-body");

describe("labelPlace", () => {
  it.each([1, 2, 3])(
    "starts each line on the game pixel the canvas rounds its glyphs to, at DPR %d",
    (dpr) => {
      const scale = domScale(dpr, { height: 560, width: 360, x: 0, y: 0 });
      const pixel = fontPixel(scale, 1);
      // A centred line half a font pixel in, on a label mid-shake.
      const label = {
        align: "start",
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
      align: "start",
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

describe("a centred or right-aligned label at a fractional fit", () => {
  // 393 CSS px wide at DPR 3: a game pixel is 3.275 device pixels, a font pixel at 1x 3.
  const scale = domScale(3, { height: 611, width: 393, x: 0, y: 0 });
  const title = gameFont("font-title");
  const text = "END WALK";
  const width = advanceWidth(title, 1, text);

  // Where a line's anchor is, in font pixels from its pen: its advance's middle, or its ink's end.
  it.each([
    ["centre", width / 2],
    ["end", inkEnd(title, text)],
  ] as const)("sets each line's %s where the canvas does, within an art pixel", (align, at) => {
    const label = {
      align,
      colour: 0,
      font: "title",
      lines: [{ pen: 0, text }],
      pills: "colour",
      scale: 2,
      x: 131,
      y: 361,
    } as const;
    const place = labelPlace(title, scale, label);
    const left = place.runs[0]?.left ?? 0;
    const html = left + at * fontPixel(scale, 2);
    const canvas = exactDeviceX(scale, 131 + at * 2);
    expect(Math.abs(html - canvas)).toBeLessThan(artPixel(scale));
    expect(left % artPixel(scale)).toBe(0);
    // A right-aligned line's ink ends on the art-pixel grid, as the canvas's right column.
    expect(align === "end" ? html % artPixel(scale) : 0).toBe(0);
  });

  it("puts the capitals' top where the canvas does, within an art pixel", () => {
    const { capTop } = fontMetrics(title);
    const place = labelPlace(title, scale, {
      align: "centre",
      colour: 0,
      font: "title",
      lines: [{ pen: 0, text }],
      pills: "colour",
      scale: 1,
      x: 40,
      y: 244,
    });
    const caps = (place.runs[0]?.top ?? 0) + capTop * fontPixel(scale, 1);
    expect(Math.abs(caps - exactDeviceY(scale, 244 + capTop))).toBeLessThan(artPixel(scale));
  });
});
