import {
  advanceWidth,
  fontMetrics,
  inkWidth,
  laidGlyphs,
  leftBearing,
} from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { artPixel, deviceX, deviceY, domScale, fontPixel } from "../domScale.ts";
import { inPill, laidPills, PILL, pillRows } from "../namePills.ts";
import { PALETTE } from "../palette.ts";
import {
  blockPlace,
  boundsAdvance,
  capRows,
  createTextLine,
  penRuns,
  shownText,
  spokenText,
  textPlace,
} from "./pixelLine.ts";

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

describe("a left-aligned line", () => {
  it.each([
    ["title", "Switch lanes"],
    ["body", "Drag anywhere"],
  ] as const)("starts where the canvas starts one in the %s font", (font, text) => {
    const scale = domScale(3, { height: 560, width: 360, x: 0, y: 0 });
    const bitmap = gameFont(`font-${font}`);
    const line = {
      capTop: 300,
      centre: "left",
      centreX: 12,
      colour: 0,
      font,
      scale: 2,
      text,
    } as const;
    const place = textPlace(bitmap, scale, ORIGIN, line);
    // A title label's ink starts at its x, a body label's pen.
    const bearing =
      font === "title" ? leftBearing((char) => bitmap.glyphs.get(char), shownText(font, text)) : 0;
    expect(place.left + bearing * fontPixel(scale, 2)).toBe(deviceX(scale, 12));
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

describe("a block's anchor", () => {
  it.each([
    ["pen", 0],
    ["ink", -leftBearing((char) => gameFont("font-title").glyphs.get(char), "MUSIC")],
    ["right", -boundsAdvance(gameFont("font-title"), "45%")],
  ] as const)("starts the pen from x by the %s anchor", (anchor, offset) => {
    const font = gameFont("font-title");
    const scale = domScale(2, { height: 560, width: 360, x: 0, y: 0 });
    const text = anchor === "right" ? "45%" : "MUSIC";
    const place = blockPlace(font, scale, {
      anchor,
      capTop: 200,
      colour: 0,
      font: "title",
      lines: [text],
      scale: 2,
      x: 100,
    });
    expect(place.runs[0]?.left).toBe(deviceX(scale, 100) + offset * fontPixel(scale, 2));
  });
});

describe("display text", () => {
  it("draws a span a character, the heart red, its capitals a ring's pixel under the glyphs' top", () => {
    const doc = new FakeDocument();
    const line = {
      capTop: 100,
      centre: "advance",
      centreX: 180,
      colour: PALETTE.yellow,
      font: "display",
      scale: 3,
      text: "Fired ♥",
    } as const;
    const element = createTextLine(doc as unknown as Document, line) as unknown as FakeElement;
    expect(element.children.map(({ textContent }) => textContent).join("")).toBe("FIRED ♥");
    expect(element.children.at(-1)?.style.color).toBe("#e43b44");
    expect(element.getAttribute("aria-label")).toBe("FIRED ♥");
    const font = gameFont("font-display");
    const scale = domScale(2, { height: 560, width: 360, x: 0, y: 0 });
    const place = textPlace(font, scale, ORIGIN, line);
    const pixel = fontPixel(scale, 3);
    expect(capRows(font, "display")).toBe(fontMetrics(font).capTop + 1);
    expect(place.top + capRows(font, "display") * pixel).toBe(deviceY(scale, line.capTop));
  });
});

describe("a centred line", () => {
  const font = gameFont("font-body");

  it.each([
    [1, 360],
    [3, 393],
    [2.625, 411],
  ])("sits on its centre in whole art pixels at DPR %d, width %d", (dpr, width) => {
    const scale = domScale(dpr, { height: 611, width, x: 0, y: 0 });
    const line = "Tidy lane work. May I walk with you?";
    const block = {
      anchor: "centre",
      capTop: 300,
      colour: 0,
      font: "body",
      lines: [line],
      scale: 2,
      x: 180,
    } as const;
    const [first] = blockPlace(font, scale, block).runs;
    const advance = boundsAdvance(font, line) * fontPixel(scale, 2);
    const art = artPixel(scale);
    expect((deviceX(scale, 180) - (first?.left ?? 0)) % art).toBe(0);
    expect(Math.abs((first?.left ?? 0) + advance / 2 - deviceX(scale, 180))).toBeLessThan(art);
  });

  it("breaks a line into runs where its colours change, each character in one run", () => {
    const line = "+$12 pay · +$3 tips";
    const runs = penRuns(font, line, new Set([4, 11, 14]));
    expect(runs.map(({ text }) => text)).toEqual(["+$12", " pay · ", "+$3", " tips"]);
    expect(runs.map(({ from }) => from)).toEqual([0, 4, 11, 14]);
  });
});
