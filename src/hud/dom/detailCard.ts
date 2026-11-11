import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { domArtPath } from "../../assets/domArt.ts";
import type { DetailArt, DetailCardView, DetailText } from "../../home/detailCardView.ts";
import { blockPlace, setBox, shownText, spokenText } from "../../ui/dom/pixelLine.ts";
import { type SheetFrame, sheetFrame } from "../../ui/dom/sheetFrames.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, deviceRect, deviceX, deviceY, type DomScale } from "../../ui/domScale.ts";
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
  "close" | "closeLabel" | "fonts" | "toGame"
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

// The box a framed box's fill sits in, an art pixel inside its border.
function framedPart(doc: Document, view: DetailCardView["framed"][number]): DomPart {
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
      const box = deviceRect(scale, view.rect);
      const pixel = artPixel(scale);
      setBox(element, box);
      setBox(fill, {
        height: box.height - 2 * pixel,
        left: pixel,
        top: pixel,
        width: box.width - 2 * pixel,
      });
    },
  };
}

// Art from its top-left, each art pixel art.scale times artPixel device pixels: an image's whole
// file, or a sheet's frame, hidden until the sheet's JSON says where the frame is.
function artPart(doc: Document, input: DomDetailCardInput, art: DetailArt): DomPart {
  const element = doc.createElement("span");
  element.className = "adw-art";
  const kind = art.sheet === undefined ? "image" : "sheet";
  element.style.backgroundImage = `url("${input.artUrl(domArtPath(kind, art.key, "png"))}")`;
  let frame: SheetFrame | undefined;
  let scale: DomScale | undefined;
  const place = (at: DomScale) => {
    scale = at;
    const pixel = artPixel(at) * art.scale;
    setBox(element, {
      height: art.size.height * pixel,
      left: deviceX(at, art.x),
      top: deviceY(at, art.y),
      width: art.size.width * pixel,
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
function textPart(doc: Document, input: DomDetailCardInput, text: DetailText): DomPart {
  const element = doc.createElement("p");
  element.className = "adw-lines";
  const block = { ...text, font: "body", scale: TEXT_SCALE } as const;
  const bitmap: BitmapFont = input.fonts.body;
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
    span.className = "adw-text adw-font-body";
    span.setAttribute("aria-hidden", "true");
    span.textContent = run.text;
    const named = run.pill === undefined ? undefined : input.pillColours(run.pill);
    span.style.color = hex(named?.name ?? text.colour);
    return span;
  });
  const spoken = doc.createElement("span");
  spoken.className = "adw-spoken";
  spoken.textContent = `${text.lines.map((line) => spokenText(shownText("body", line))).join(" ")} `;
  element.append(...pills.map(({ pill }) => pill), ...runs, spoken);
  return {
    element,
    place: (scale) => {
      const place = blockPlace(bitmap, scale, block);
      place.pills.forEach(({ box }, i) => {
        const pill = pills[i]?.pill;
        if (pill !== undefined) {
          setBox(pill, box);
          pill.style.setProperty("--adw-cut", `${place.cut}px`);
        }
      });
      place.runs.forEach(({ left, top }, i) => {
        const span = runs[i];
        if (span !== undefined) {
          Object.assign(span.style, {
            fontSize: `${place.fontSize}px`,
            left: `${left}px`,
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
    describedBy: texts.id,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: view.card,
  });
}
