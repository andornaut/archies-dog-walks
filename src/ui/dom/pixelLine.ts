import type { Rect } from "@andornaut/game-kit/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
  laidGlyphs,
  leftBearing,
} from "@andornaut/game-kit/text/bitmapFont";

import { deviceRect, deviceX, deviceY, type DomScale, fontPixel, frameRect } from "../domScale.ts";
import { laidPills, PILL_CLOSE, PILL_SPACE, pillIndex, pillRows } from "../namePills.ts";
import { PALETTE } from "../palette.ts";
import { plainMarks } from "../pixelFont.ts";
import { WEB_FONTS } from "./uiLayer.ts";

// A line of pixel text in the HTML interface: its web font draws the bitmap font's glyphs, so it
// is laid out by them. The capitals' top and the middle across are game pixels, as the canvas
// places its labels: the middle of the ink, or of the glyphs' advances where the canvas centres a
// label on its width. line is its index in a block of lines a font line apart, which sit
// lineHeight font pixels apart in device pixels too.
export interface DomTextLine {
  readonly capTop: number;
  // "left": centreX is where a left-aligned label starts, as addPixelText places one: its pen in
  // the body font, its ink in the title font.
  readonly centre: "advance" | "ink" | "left";
  readonly centreX: number;
  readonly colour: number;
  readonly font: keyof typeof WEB_FONTS;
  readonly line?: number;
  readonly scale: number;
  readonly text: string;
}

type Origin = { readonly x: number; readonly y: number };

// The text as the font draws it: capitals in the title font, typographic marks made plain.
export function shownText(font: DomTextLine["font"], text: string): string {
  const plain = plainMarks(text);
  return font === "body" ? plain : plain.toUpperCase();
}

// The rows from a line's top to its capitals in font: the bitmap font's capital's top, or, in the
// display font, whose glyphs hold the outline, the letters' fill a ring's pixel inside it, as the
// canvas places display text (addDisplayText) and as the web font draws it.
export function capRows(bitmap: BitmapFont, font: DomTextLine["font"]): number {
  return fontMetrics(bitmap).capTop + (font === "display" ? DISPLAY_RING : 0);
}

// art: the display letters' ink ring round their fill, in font pixels.
const DISPLAY_RING = 1;

// The display letters' heart, red in both of the display font's colours.
const DISPLAY_HEART = { char: "♥", colour: PALETTE.red } as const;

// Where line's element goes and its font size, in whole device pixels from its container's
// corner at origin game pixels: one font pixel is fontPixel device pixels, the ink's middle on the
// device column nearest centreX, and the capitals' top on the row nearest capTop, or, for a later
// line of a block, whole font lines under its first line's.
export function textPlace(
  bitmap: BitmapFont,
  scale: DomScale,
  origin: Origin,
  line: DomTextLine,
): {
  readonly fontSize: number;
  readonly left: number;
  readonly lineHeight: number;
  readonly top: number;
} {
  const pixel = fontPixel(scale, line.scale);
  const text = shownText(line.font, line.text);
  const inked = laidGlyphs(bitmap, 1, text).flatMap(({ ink }) => (ink === null ? [] : [ink]));
  // The first and last columns the line inks, in font pixels from the pen's start, or the pen's
  // start and its last advance.
  const ink = line.centre === "ink" && inked.length > 0;
  const first = ink ? Math.min(...inked.map(({ left }) => left)) : 0;
  const last = ink ? Math.max(...inked.map(({ right }) => right)) : advanceWidth(bitmap, 1, text);
  const half = Math.round(((last - first) * pixel) / 2);
  const bearing = line.font === "title" ? leftBearing((char) => bitmap.glyphs.get(char), text) : 0;
  const left =
    line.centre === "left"
      ? deviceX(scale, line.centreX) - bearing * pixel - deviceX(scale, origin.x)
      : deviceX(scale, line.centreX) - half - first * pixel - deviceX(scale, origin.x);
  const index = line.line ?? 0;
  const blockTop = line.capTop - index * bitmap.lineHeight * line.scale;
  const top =
    deviceY(scale, blockTop) +
    (index * bitmap.lineHeight - capRows(bitmap, line.font)) * pixel -
    deviceY(scale, origin.y);
  // The web fonts' em is 8 font pixels and their line the bitmap font's.
  return { fontSize: 8 * pixel, left, lineHeight: bitmap.lineHeight * pixel, top };
}

// Places element over rect, in device pixels from its container's corner at origin.
export function placeBox(scale: DomScale, origin: Origin, element: HTMLElement, rect: Rect): void {
  const box = deviceRect(scale, rect);
  setBox(element, {
    ...box,
    left: box.left - deviceX(scale, origin.x),
    top: box.top - deviceY(scale, origin.y),
  });
}

// Places element over rect as a frame (frameRect), in device pixels from its container's corner
// at origin.
export function placeFrame(
  scale: DomScale,
  origin: Origin,
  element: HTMLElement,
  rect: Rect,
): void {
  const box = frameRect(scale, rect);
  setBox(element, {
    ...box,
    left: box.left - deviceX(scale, origin.x),
    top: box.top - deviceY(scale, origin.y),
  });
}

// Sets element's place and size, in device pixels.
export function setBox(
  element: HTMLElement,
  box: {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
  },
): void {
  Object.assign(element.style, {
    height: `${box.height}px`,
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
  });
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// A text line's element: its text, font and colour; placeText positions it. Display text is a
// span a character, so each glyph's ring and shadow paint over the glyph before it, as the
// canvas draws its glyphs in order; the font still kerns across them.
export function createTextLine(doc: Document, line: DomTextLine): HTMLElement {
  const element = doc.createElement("span");
  element.className = `adw-text adw-font-${line.font}`;
  const text = shownText(line.font, line.text);
  element.style.color = hex(line.colour);
  if (line.font !== "display") {
    element.textContent = text;
    return element;
  }
  element.setAttribute("aria-label", text);
  for (const char of text) {
    const glyph = doc.createElement("span");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = char;
    if (char === DISPLAY_HEART.char) {
      glyph.style.color = hex(DISPLAY_HEART.colour);
    }
    element.append(glyph);
  }
  return element;
}

// Positions element as line, in its container whose corner is at origin game pixels.
export function placeText(
  bitmap: BitmapFont,
  scale: DomScale,
  origin: Origin,
  element: HTMLElement,
  line: DomTextLine,
): void {
  const place = textPlace(bitmap, scale, origin, line);
  Object.assign(element.style, {
    fontSize: `${place.fontSize}px`,
    left: `${place.left}px`,
    lineHeight: `${place.lineHeight}px`,
    top: `${place.top}px`,
  });
  // The display font's ring and shadow, a font pixel a step (uiStyle.ts).
  if (line.font === "display") {
    element.style.setProperty("--adw-k", `${place.fontSize / 8}px`);
  }
}

// A run of a line the web font draws as one element: its text, where the pen starts it in font
// pixels from the line's start, and the kind of pill whose name it is part of, if any.
export interface PenRun {
  readonly pen: number;
  readonly pill: number | undefined;
  readonly text: string;
}

// line split where the bitmap font's pill characters (ui/namePills.ts) sit, which the web fonts
// lack: each run's pen start as the bitmap font lays the line out, kerning included. Phaser
// kerns no pair across a pill character, so neither does a run.
export function penRuns(bitmap: BitmapFont, line: string): PenRun[] {
  const runs: { pen: number; pill: number | undefined; text: string }[] = [];
  let pen = 0;
  let previous: string | undefined;
  let pill: number | undefined;
  let run: (typeof runs)[number] | undefined;
  for (const char of line) {
    const glyph = bitmap.glyphs.get(char);
    if (glyph === undefined) {
      continue;
    }
    pen += previous === undefined ? 0 : (bitmap.kernings.get(previous + char) ?? 0);
    const opens = pillIndex(char);
    if (opens !== undefined || char === PILL_CLOSE || char === PILL_SPACE) {
      pill = opens ?? (char === PILL_SPACE ? pill : undefined);
      run = undefined;
    } else {
      if (run === undefined) {
        run = { pen, pill, text: "" };
        runs.push(run);
      }
      run.text += char;
    }
    pen += glyph.advance;
    previous = char;
  }
  return runs;
}

// The text a screen reader reads for a line with pills: their characters left out, a pill's
// spaces plain spaces.
export function spokenText(line: string): string {
  return [...line]
    .flatMap((char) =>
      char === PILL_SPACE
        ? [" "]
        : pillIndex(char) !== undefined || char === PILL_CLOSE
          ? []
          : [char],
    )
    .join("");
}

// A left-aligned block of text: its pen starting at x, or its first line's ink starting there
// (ink, as a left-aligned title label's does), or its widest line's advance ending there (right,
// as a right-aligned label's does), and its first line's capitals at capTop (game pixels), its
// lines a font line apart, each effect's name set in a pill.
export interface DomTextBlock {
  readonly anchor?: "ink" | "pen" | "right";
  readonly capTop: number;
  readonly colour: number;
  readonly font: keyof typeof WEB_FONTS;
  readonly lines: readonly string[];
  readonly scale: number;
  readonly x: number;
}

// The widest a line's pen reaches, in font pixels: the furthest any glyph's advance ends, as
// Phaser bounds a label.
export function boundsAdvance(bitmap: BitmapFont, line: string): number {
  let pen = 0;
  let widest = 0;
  let previous: string | undefined;
  for (const char of line) {
    const glyph = bitmap.glyphs.get(char);
    if (glyph === undefined) {
      continue;
    }
    pen += previous === undefined ? 0 : (bitmap.kernings.get(previous + char) ?? 0);
    widest = Math.max(widest, pen + glyph.advance);
    pen += glyph.advance;
    previous = char;
  }
  return widest;
}

// Where a block's pen starts from x, in font pixels, by its anchor.
function penOffset(bitmap: BitmapFont, block: DomTextBlock): number {
  const lines = block.lines.map((line) => shownText(block.font, line));
  const anchor = block.anchor ?? "pen";
  if (anchor === "ink") {
    return -leftBearing((char) => bitmap.glyphs.get(char), lines[0] ?? "");
  }
  return anchor === "right" ? -Math.max(0, ...lines.map((line) => boundsAdvance(bitmap, line))) : 0;
}

// Where a block's parts go, in whole device pixels from the layer's corner: each run of text,
// its font size and line height, and each pill behind a name, its corners cut a font pixel.
export function blockPlace(
  bitmap: BitmapFont,
  scale: DomScale,
  block: DomTextBlock,
): {
  readonly cut: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly pills: readonly {
    readonly box: { height: number; left: number; top: number; width: number };
    readonly index: number;
  }[];
  readonly runs: readonly (PenRun & { readonly left: number; readonly top: number })[];
} {
  const pixel = fontPixel(scale, block.scale);
  const left = deviceX(scale, block.x) + penOffset(bitmap, block) * pixel;
  const capTop = capRows(bitmap, block.font);
  const rows = pillRows(1);
  const lines = block.lines.map((line, i) => ({
    shown: shownText(block.font, line),
    top: deviceY(scale, block.capTop) + (i * bitmap.lineHeight - capTop) * pixel,
  }));
  return {
    cut: pixel,
    fontSize: 8 * pixel,
    lineHeight: bitmap.lineHeight * pixel,
    pills: lines.flatMap(({ shown, top }) =>
      laidPills(
        1,
        laidGlyphs(bitmap, 1, shown).map((glyph) => ({ ...glyph, line: 0 })),
      ).map((pill) => ({
        box: {
          height: rows.height * pixel,
          left: left + pill.left * pixel,
          top: top + rows.top * pixel,
          width: (pill.right - pill.left) * pixel,
        },
        index: pill.index,
      })),
    ),
    runs: lines.flatMap(({ shown, top }) =>
      penRuns(bitmap, shown).map((run) => ({ ...run, left: left + run.pen * pixel, top })),
    ),
  };
}
