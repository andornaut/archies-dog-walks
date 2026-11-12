import type { Rect } from "@andornaut/game-kit/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
  laidGlyphs,
  leftBearing,
} from "@andornaut/game-kit/text/bitmapFont";

import {
  artPixel,
  deviceRect,
  deviceX,
  deviceY,
  type DomScale,
  exactDeviceX,
  fontPixel,
  frameRect,
  wholeArtPixels,
} from "../domScale.ts";
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
// span a character (displayGlyphs).
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
  element.append(...displayGlyphs(doc, text));
  return element;
}

// Display text's characters, a span each, the heart red: each glyph's ring and shadow paint over
// the glyph before it, as the canvas draws its glyphs in order, and the font still kerns across
// them.
export function displayGlyphs(doc: Document, text: string): HTMLElement[] {
  return [...text].map((char) => {
    const glyph = doc.createElement("span");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = char;
    if (char === DISPLAY_HEART.char) {
      glyph.style.color = hex(DISPLAY_HEART.colour);
    }
    return glyph;
  });
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

// A run of a line the web font draws as one element: its text, the index of its first character
// in the line, where the pen starts it in font pixels from the line's start, and the kind of pill
// whose name it is part of, if any.
export interface PenRun {
  readonly from: number;
  readonly pen: number;
  readonly pill: number | undefined;
  readonly text: string;
}

// line split where the bitmap font's pill characters (ui/namePills.ts) sit, which the web fonts
// lack, and before each character index in breaks (where a run of another colour starts): each
// run's pen start as the bitmap font lays the whole line out, kerning included. Phaser kerns no
// pair across a pill character, so neither does a run.
export function penRuns(
  bitmap: BitmapFont,
  line: string,
  breaks: ReadonlySet<number> = new Set(),
): PenRun[] {
  const runs: { from: number; pen: number; pill: number | undefined; text: string }[] = [];
  let pen = 0;
  let previous: string | undefined;
  let pill: number | undefined;
  let run: (typeof runs)[number] | undefined;
  for (const [at, char] of [...line].entries()) {
    if (breaks.has(at)) {
      run = undefined;
    }
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
        run = { from: at, pen, pill, text: "" };
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
// as a right-aligned label's does), or its widest line's ink ending there (inkRight, as a label
// the canvas moves there, placeInkRight), or each line's advance centred on x (centre, as a label
// with originX 0.5 there), and its first line's capitals at capTop (game pixels), its lines a
// font line apart, each effect's name set in a pill.
export interface DomTextBlock {
  readonly anchor?: "centre" | "ink" | "inkRight" | "pen" | "right";
  // Each line's character indices where a run of another colour starts.
  readonly breaks?: readonly ReadonlySet<number>[];
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

// The column after the last a line inks, in font pixels from its pen's start, or its advance
// where it inks nothing.
export function inkEnd(bitmap: BitmapFont, line: string): number {
  const inked = laidGlyphs(bitmap, 1, line).flatMap(({ ink }) => (ink === null ? [] : [ink.right]));
  return inked.length > 0 ? Math.max(...inked) : boundsAdvance(bitmap, line);
}

// Where a right-aligned block's pen starts, in device pixels: its widest line's ink ending where
// the canvas's ends, on the art-pixel grid. HTML text is narrower than the canvas's wherever the
// fit is fractional, so it is anchored at its right edge, as the canvas's right column.
function rightPen(
  bitmap: BitmapFont,
  scale: DomScale,
  block: DomTextBlock,
  lines: readonly string[],
): number {
  const widest = lines.reduce(
    (best, line) => (boundsAdvance(bitmap, line) > boundsAdvance(bitmap, best) ? line : best),
    lines[0] ?? "",
  );
  const ink = inkEnd(bitmap, widest);
  const right = Math.round(block.x);
  // The canvas's ink end, in game pixels: x itself, or short of the advance's end by the last
  // glyph's right side bearing.
  const canvasEnd =
    block.anchor === "right" ? right - (boundsAdvance(bitmap, widest) - ink) * block.scale : right;
  return (
    wholeArtPixels(scale, exactDeviceX(scale, canvasEnd)) - ink * fontPixel(scale, block.scale)
  );
}

// Where a block's pen starts from x, in font pixels, by its anchor; a centred block's lines each
// start from their own (lineLeft) and a right-aligned block's from rightPen.
function penOffset(bitmap: BitmapFont, block: DomTextBlock): number {
  const lines = block.lines.map((line) => shownText(block.font, line));
  return (block.anchor ?? "pen") === "ink"
    ? -leftBearing((char) => bitmap.glyphs.get(char), lines[0] ?? "")
    : 0;
}

// Where a centred line's pen starts, in device pixels: its advance at pixel device pixels a font
// pixel centred on the device column at x, the half rounded down to whole art pixels, as the
// canvas rounds a centred label's left edge up. HTML text is never wider than the canvas's, so it
// stays centred where the canvas's would overhang.
export function centredLeft(scale: DomScale, x: number, width: number): number {
  const art = artPixel(scale);
  return deviceX(scale, x) - Math.floor(width / 2 / art) * art;
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
  readonly runs: readonly (PenRun & {
    readonly left: number;
    readonly line: number;
    readonly top: number;
  })[];
} {
  const pixel = fontPixel(scale, block.scale);
  const start =
    block.anchor === "right" || block.anchor === "inkRight"
      ? rightPen(
          bitmap,
          scale,
          block,
          block.lines.map((line) => shownText(block.font, line)),
        )
      : deviceX(scale, block.x) + penOffset(bitmap, block) * pixel;
  const lineLeft = (shown: string) =>
    block.anchor === "centre"
      ? centredLeft(scale, block.x, boundsAdvance(bitmap, shown) * pixel)
      : start;
  const capTop = capRows(bitmap, block.font);
  const rows = pillRows(1);
  const lines = block.lines.map((line, i) => {
    const shown = shownText(block.font, line);
    return {
      left: lineLeft(shown),
      shown,
      top: deviceY(scale, block.capTop) + (i * bitmap.lineHeight - capTop) * pixel,
    };
  });
  return {
    cut: pixel,
    fontSize: 8 * pixel,
    lineHeight: bitmap.lineHeight * pixel,
    pills: lines.flatMap(({ left, shown, top }) =>
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
    runs: lines.flatMap(({ left, shown, top }, i) =>
      penRuns(bitmap, shown, block.breaks?.[i]).map((run) => ({
        ...run,
        left: left + run.pen * pixel,
        line: i,
        top,
      })),
    ),
  };
}
