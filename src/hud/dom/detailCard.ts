import type { Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { domArtPath } from "../../assets/domArt.ts";
import type { DetailArt, DetailCardView, DetailText } from "../../home/detailCardView.ts";
import { blockPlace, setBox, shownText, spokenText } from "../../ui/dom/pixelLine.ts";
import { type SheetFrame, sheetFrame } from "../../ui/dom/sheetFrames.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  artPixel,
  deviceX,
  deviceY,
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  frameRect,
  wholeArtPixels,
} from "../../ui/domScale.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// A detail card in HTML over the canvas: the ui-detail-card, its title and close control drawn
// as a modal card is (showQuestionPanel), and its framed boxes, art and text as its view
// (detailCardView) lays them out at the places the canvas draws them. Art is each key's own file,
// a sheet's frame a background position in it, every art pixel the art's scale times artPixel
// device pixels.

export interface DomDetailCardInput extends Pick<
  DomQuestionPanelInput,
  "close" | "closeLabel" | "closePressed" | "fonts" | "shade" | "toGame"
> {
  // An art file's URL by its path under /art/.
  readonly artUrl: (path: string) => string;
  // A sheet's JSON by its URL, once it has loaded.
  readonly loadSheet: (url: string) => Promise<unknown>;
  // The colours of a name's pill of a kind and of its name, or undefined for none.
  readonly pillColours: (index: number) => { name: number; pill: number } | undefined;
  readonly view: DetailCardView;
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// Ids that tie each card's dialog to its text.
let cards = 0;

// A framed box, whole art pixels from its corner, its fill an art pixel inside its border.
export function framedPart(doc: Document, view: DetailCardView["framed"][number]): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-framed";
  element.style.backgroundColor = hex(view.border);
  const fill = doc.createElement("div");
  fill.className = "adw-framed";
  fill.style.backgroundColor = hex(view.fill);
  element.append(fill);
  return {
    element,
    place: (scale) => {
      const pixel = artPixel(scale);
      const { height, width, x, y } = view.rect;
      setBox(element, {
        height: height * pixel,
        left: deviceX(scale, x),
        top: deviceY(scale, y),
        width: width * pixel,
      });
      setBox(fill, {
        height: (height - 2) * pixel,
        left: pixel,
        top: pixel,
        width: (width - 2) * pixel,
      });
    },
  };
}

// The device pixels from holder's snapped corner to art that aims at aim's column: its middle
// there, rounded to whole art pixels, and kept within the edge's straight part, whose length is
// the snapped frame's (frameRect).
function aimed(
  scale: DomScale,
  holder: { readonly x: number },
  aim: NonNullable<DetailArt["aim"]>,
  width: number,
): number {
  const pixel = artPixel(scale);
  const corner = deviceX(scale, holder.x);
  const edge = frameRect(scale, aim.edge);
  const from = edge.left - corner + aim.inset.left * pixel;
  const to = edge.left - corner + edge.width - aim.inset.right * pixel - width;
  const at = wholeArtPixels(scale, exactDeviceX(scale, aim.centreX) - width / 2 - corner);
  return Math.min(Math.max(at, from), to);
}

// The device column of art at game column x hanging off frame's right side: as many whole art
// pixels in from the snapped frame's right edge (frameRect) as at 1x.
function fromRight(scale: DomScale, frame: Rect, x: number): number {
  const box = frameRect(scale, frame);
  return box.left + box.width - (frame.x + frame.width - x) * artPixel(scale);
}

// Art from its top-left, each art pixel art.scale times artPixel device pixels: an image's whole
// file, or a sheet's frame, hidden until the sheet's JSON says where the frame is. Art in a box
// sits whole art pixels into it, rounded down where it is centred on a half pixel.
export function artPart(
  doc: Document,
  input: Pick<DomDetailCardInput, "artUrl" | "loadSheet">,
  art: DetailArt,
  // Device pixels to move it right by at a scale, as an icon of a centred row (rowPart).
  shift: (scale: DomScale) => number = () => 0,
): DomPart {
  const element = doc.createElement("span");
  element.className = "adw-art";
  if (art.flipX === true) {
    element.style.transform = "scaleX(-1)";
  }
  const kind = art.sheet === undefined ? "image" : "sheet";
  element.style.backgroundImage = `url("${input.artUrl(domArtPath(kind, art.key, "png"))}")`;
  let frame: SheetFrame | undefined;
  let scale: DomScale | undefined;
  const place = (at: DomScale) => {
    scale = at;
    const pixel = artPixel(at) * art.scale;
    const holder = art.holder ?? art;
    const into = (from: number, to: number) => Math.floor(to - from) * artPixel(at);
    const width = art.size.width * pixel;
    const height = art.size.height * pixel;
    const left = deviceX(at, holder.x);
    const top = deviceY(at, holder.y);
    const { centre } = art;
    setBox(element, {
      height,
      left:
        (art.right !== undefined
          ? fromRight(at, art.right, art.x)
          : left +
            (centre !== undefined
              ? wholeArtPixels(at, exactDeviceX(at, centre.x) - width / 2 - left)
              : art.aim === undefined
                ? into(holder.x, art.x)
                : aimed(at, holder, art.aim, width))) + shift(at),
      top:
        top +
        (centre === undefined
          ? into(holder.y, art.y)
          : wholeArtPixels(at, exactDeviceY(at, centre.y) - height / 2 - top)),
      width,
    });
    if (frame !== undefined) {
      element.style.backgroundSize = `${frame.sheet.width * pixel}px ${frame.sheet.height * pixel}px`;
      element.style.backgroundPosition = `${-frame.x * pixel}px ${-frame.y * pixel}px`;
    }
  };
  if (art.sheet !== undefined) {
    const { tag } = art.sheet;
    element.style.visibility = "hidden";
    input.loadSheet(input.artUrl(domArtPath("sheet", art.key, "json"))).then(
      (json) => {
        frame = sheetFrame(json, tag);
        element.style.visibility = "";
        if (scale !== undefined) {
          place(scale);
        }
      },
      (error: unknown) => console.error(`The ${art.key} sheet did not load.`, error),
    );
  }
  return { element, place };
}

// A block of text: each run of a line the web font draws, each name's pill behind it, and the
// whole for a screen reader.
export function textPart(
  doc: Document,
  input: Pick<DomDetailCardInput, "fonts" | "pillColours">,
  text: DetailText,
  // Device pixels to move it right by at a scale, as a run of a centred row (rowPart).
  shift: (scale: DomScale) => number = () => 0,
): DomPart {
  const element = doc.createElement("p");
  element.className = "adw-lines";
  const font = text.font ?? "body";
  // Where each span starts in the line as the font draws it, and its colour.
  let next = 0;
  const spans = (text.spans ?? []).map((span) => {
    const from = next;
    next += [...shownText(font, span.text)].length;
    return { colour: span.colour, from };
  });
  const block = {
    ...text,
    // A left-aligned label starts its pen at x in the body font and its ink in the title font,
    // as addPixelText places it.
    anchor:
      text.align === "centre"
        ? "centre"
        : text.align === "right"
          ? "right"
          : font === "title"
            ? "ink"
            : "pen",
    ...(text.spans === undefined ? {} : { breaks: [new Set(spans.map(({ from }) => from))] }),
    font,
    scale: text.scale ?? TEXT_SCALE,
  } as const;
  const bitmap: BitmapFont = input.fonts[font];
  // The runs and pills are the same at every scale.
  const first = blockPlace(bitmap, { dpr: 1, origin: { x: 0, y: 0 }, unit: 1 }, block);
  const pills = first.pills.map(({ index }) => {
    const pill = doc.createElement("span");
    pill.className = "adw-pill";
    pill.setAttribute("aria-hidden", "true");
    const colours = input.pillColours(index);
    if (colours !== undefined) {
      pill.style.backgroundColor = hex(colours.pill);
    }
    return { colours, pill };
  });
  // Each run's colour: its pill's name colour, or the text's.
  const runs = first.runs.map((run) => {
    const span = doc.createElement("span");
    span.className = `adw-text adw-font-${font}`;
    span.setAttribute("aria-hidden", "true");
    span.textContent = run.text;
    const named = run.pill === undefined ? undefined : input.pillColours(run.pill);
    const own = spans.filter(({ from }) => from <= run.from).at(-1)?.colour;
    span.style.color = hex(named?.name ?? own ?? text.colour);
    return span;
  });
  const spoken = doc.createElement("span");
  spoken.className = "adw-spoken";
  spoken.textContent = `${text.lines.map((line) => spokenText(shownText(font, line))).join(" ")} `;
  element.append(...pills.map(({ pill }) => pill), ...runs, spoken);
  return {
    element,
    place: (scale) => {
      const place = blockPlace(bitmap, scale, block);
      const by = shift(scale);
      place.pills.forEach(({ box }, i) => {
        const pill = pills[i]?.pill;
        if (pill !== undefined) {
          setBox(pill, { ...box, left: box.left + by });
          pill.style.setProperty("--adw-cut", `${place.cut}px`);
        }
      });
      place.runs.forEach(({ left, top }, i) => {
        const span = runs[i];
        if (span !== undefined) {
          Object.assign(span.style, {
            fontSize: `${place.fontSize}px`,
            left: `${left + by}px`,
            lineHeight: `${place.lineHeight}px`,
            top: `${top}px`,
          });
        }
      });
    },
  };
}

// The detail card in layer, shown and its dialog focused.
export function showDetailCard(layer: UiLayer, input: DomDetailCardInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  cards += 1;
  const { view } = input;
  const texts = doc.createElement("div");
  texts.className = "adw-lines";
  texts.id = `adw-detail-${cards}`;
  const textParts = view.texts.map((text) => textPart(doc, input, text));
  texts.append(...textParts.map(({ element }) => element));
  const parts: DomPart[] = [
    ...view.framed.map((framed) => framedPart(doc, framed)),
    ...view.art.map((art) => artPart(doc, input, art)),
    {
      element: texts,
      place: (scale) => {
        for (const part of textParts) {
          part.place(scale);
        }
      },
    },
  ];
  return showQuestionPanel(layer, {
    close: input.close,
    closeLabel: input.closeLabel,
    ...(input.closePressed === undefined ? {} : { closePressed: input.closePressed }),
    ...(input.shade === undefined ? {} : { shade: input.shade }),
    describedBy: texts.id,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: view.card,
  });
}
