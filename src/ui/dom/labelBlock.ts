import { advanceWidth, type BitmapFont, fontMetrics } from "@andornaut/game-kit/text/bitmapFont";

import {
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  fontPixel,
  wholeArtPixels,
} from "../domScale.ts";
import { displayGlyphs, inkEnd, namePillBoxes, penRuns, setBox, spokenText } from "./pixelLine.ts";
import type { WEB_FONTS } from "./uiLayer.ts";

// A canvas label as the HTML interface draws it in its web font: its text as the bitmap font
// draws it, line by line, where the canvas lays each line out, and its colour. The canvas draws
// each glyph at a whole game pixel, rounding its place, so a line starts on the game pixel
// nearest its unrounded start, mid-tween too. HTML text is narrower than the canvas's wherever
// the fit is fractional (fontPixel), so each line is laid out from the point the label is
// anchored by, as the canvas draws it: its start, middle or ink's end across, as the label
// aligns, and its first line's capitals' top down, each snapped to whole art pixels.
export interface DomLabelLine {
  // The font pixels from the label's left edge to the line's pen start: its alignment's offset,
  // a half where a centred line's spare width is odd.
  readonly pen: number;
  readonly text: string;
}

// The data key a scene sets on a label it places itself about its middle, as the display
// lettering's centred lines, whose origin is their left: align takes it over the label's origin.
export const LABEL_ALIGN_DATA = "htmlAlign";

export interface DomLabel {
  // How its lines align on the canvas: from their start, about their middle or to their end.
  readonly align: "centre" | "end" | "start";
  readonly colour: number;
  readonly font: keyof typeof WEB_FONTS;
  readonly lines: readonly DomLabelLine[];
  // How the pills of the names it sets in pills are drawn: in each kind's colours, or grey for a
  // disabled item, the name left in the label's colour.
  readonly pills: "colour" | "grey";
  readonly scale: number;
  // The label's top-left corner, in game pixels.
  readonly x: number;
  readonly y: number;
}

type Box = { height: number; left: number; top: number; width: number };

// Where a label's parts go, in whole device pixels from the layer's corner: each run of text,
// its font size and line height, and each pill behind a name, its corners cut a font pixel.
export function labelPlace(
  bitmap: BitmapFont,
  scale: DomScale,
  label: DomLabel,
): {
  readonly cut: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly pills: readonly { readonly box: Box; readonly index: number }[];
  readonly runs: readonly {
    readonly left: number;
    readonly pill: number | undefined;
    readonly text: string;
    readonly top: number;
  }[];
} {
  const pixel = fontPixel(scale, label.scale);
  const { capTop } = fontMetrics(bitmap);
  const caps = Math.round(label.y) + capTop * label.scale;
  const top = wholeArtPixels(scale, exactDeviceY(scale, caps) - capTop * pixel);
  const share = { centre: 0.5, end: 1, start: 0 }[label.align];
  const lines = label.lines.map((line, i) => {
    const start = Math.round(label.x + line.pen * label.scale);
    // An end-aligned line is anchored by its ink's end, on the art-pixel grid; the rest by their
    // advance's start or middle.
    const end = label.align === "end";
    const width = end ? inkEnd(bitmap, line.text) : advanceWidth(bitmap, 1, line.text);
    const anchor = exactDeviceX(scale, start + share * width * label.scale);
    return {
      left: end
        ? wholeArtPixels(scale, anchor) - width * pixel
        : wholeArtPixels(scale, anchor - share * width * pixel),
      text: line.text,
      top: top + i * bitmap.lineHeight * pixel,
    };
  });
  return {
    cut: pixel,
    fontSize: 8 * pixel,
    lineHeight: bitmap.lineHeight * pixel,
    pills: lines.flatMap(({ left, text, top: lineTop }) =>
      namePillBoxes(bitmap, pixel, { x: left, y: lineTop }, text),
    ),
    runs: lines.flatMap(({ left, text, top: lineTop }) =>
      penRuns(bitmap, text).map((run) => ({
        left: left + run.pen * pixel,
        pill: run.pill,
        text: run.text,
        top: lineTop,
      })),
    ),
  };
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// The colours of a name's pill of a kind and of its name, or undefined for none.
export type PillColours = (index: number) => { name: number; pill: number } | undefined;

// A label's element: its runs over its pills, and its text for a screen reader. Built again by
// drawLabel whenever the label changes.
export function drawLabel(
  doc: Document,
  input: {
    readonly bitmap: BitmapFont;
    readonly grey: number;
    readonly pillColours: PillColours;
    readonly scale: DomScale;
  },
  element: HTMLElement,
  label: DomLabel,
): void {
  const place = labelPlace(input.bitmap, input.scale, label);
  const pills = place.pills.map(({ box, index }) => {
    const pill = doc.createElement("span");
    pill.className = "adw-pill";
    pill.setAttribute("aria-hidden", "true");
    setBox(pill, box);
    pill.style.setProperty("--adw-cut", `${place.cut}px`);
    const colours = input.pillColours(index);
    const fill = label.pills === "grey" ? input.grey : colours?.pill;
    if (fill !== undefined) {
      pill.style.backgroundColor = hex(fill);
    }
    return pill;
  });
  const runs = place.runs.map((run) => {
    const span = doc.createElement("span");
    span.className = `adw-text adw-font-${label.font}`;
    span.setAttribute("aria-hidden", "true");
    if (label.font === "display") {
      span.append(...displayGlyphs(doc, run.text));
      // The display font's ring and shadow, a font pixel a step (uiStyle.ts).
      span.style.setProperty("--adw-k", `${place.fontSize / 8}px`);
    } else {
      span.textContent = run.text;
    }
    const named =
      run.pill === undefined || label.pills === "grey" ? undefined : input.pillColours(run.pill);
    Object.assign(span.style, {
      color: hex(named?.name ?? label.colour),
      fontSize: `${place.fontSize}px`,
      left: `${run.left}px`,
      lineHeight: `${place.lineHeight}px`,
      top: `${run.top}px`,
    });
    return span;
  });
  const spoken = doc.createElement("span");
  spoken.className = "adw-spoken";
  spoken.textContent = `${label.lines.map(({ text }) => spokenText(text)).join(" ")} `;
  element.replaceChildren(...pills, ...runs, spoken);
}
