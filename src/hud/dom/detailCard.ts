import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { domArtPath } from "../../assets/index.ts";
import { textPart } from "../../home/dom/index.ts";
import type { DetailArt, DetailCardView } from "../../home/index.ts";
import {
  contentSeparatorPart,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  framedPart,
  setBox,
  type SheetFrame,
  sheetFrame,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  frameRect,
  gridRect,
  gridX,
  gridY,
  wholeArtPixels,
} from "../../ui/index.ts";
import { showQuestionPanel } from "./questionPanel.ts";

// A detail card in HTML over the canvas: the ui-detail-card, its title and close control drawn
// as a modal card is (showQuestionPanel), and its framed boxes, art and text as its view
// (detailCardView) lays them out at the places the canvas draws them. Art is each key's own file,
// a sheet's frame a background position in it, every art pixel the art's scale times artPixel
// device pixels.

export interface DomDetailCardInput extends Pick<
  DomQuestionPanelInput,
  "backgroundCancel" | "closeLabel" | "fonts" | "dismiss" | "toGame"
> {
  // What the close control does, dismiss where the card has no close of its own.
  readonly close?: () => void;
  // An art file's URL by its path under /art/.
  readonly artUrl: (path: string) => string;
  // A sheet's JSON by its URL, once it has loaded.
  readonly loadSheet: (url: string) => Promise<unknown>;
  // The colours of a name's pill of a kind and of its name, or undefined for none.
  readonly pillColours: (index: number) => { name: number; pill: number } | undefined;
  readonly view: DetailCardView;
  readonly presses?: readonly (() => void)[];
}

// Ids that tie each card's dialog to its text.
let cards = 0;

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
  const corner = gridX(scale, holder.x);
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

// Art from its top-left, authored pixels by default or the explicit logical allocation: an image's one
// frame, or a sheet's frame, hidden until its frames say where on its sheet it is. Default art in a box
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
  const urls = [input.artUrl(domArtPath(kind, art.key, "png"))];
  let frame: SheetFrame | undefined;
  let scale: DomScale | undefined;
  const place = (at: DomScale) => {
    scale = at;
    const pixel = artPixel(at) * art.scale;
    const holder = art.holder ?? art;
    const into = (from: number, to: number) => Math.floor(to - from) * artPixel(at);
    const logical = { height: art.size.height * art.scale, width: art.size.width * art.scale };
    const projected =
      art.projection === "layout"
        ? gridRect(at, {
            ...logical,
            x: art.centre === undefined ? art.x : art.centre.x - logical.width / 2,
            y: art.centre === undefined ? art.y : art.centre.y - logical.height / 2,
          })
        : undefined;
    const width = projected?.width ?? art.size.width * pixel;
    const height = projected?.height ?? art.size.height * pixel;
    const left = gridX(at, holder.x);
    const top = gridY(at, holder.y);
    const { centre } = art;
    setBox(element, {
      height,
      left:
        projected === undefined
          ? (art.right !== undefined
              ? fromRight(at, art.right, art.x)
              : left +
                (centre !== undefined
                  ? wholeArtPixels(at, exactDeviceX(at, centre.x) - width / 2 - left)
                  : art.aim === undefined
                    ? into(holder.x, art.x)
                    : aimed(at, holder, art.aim, width))) + shift(at)
          : projected.left + shift(at),
      top:
        projected?.top ??
        top +
          (centre === undefined
            ? into(holder.y, art.y)
            : wholeArtPixels(at, exactDeviceY(at, centre.y) - height / 2 - top)),
      width,
    });
    if (frame !== undefined) {
      // An image fills its box; a sheet's frame shows at its own size.
      const across = kind === "image" || projected !== undefined ? width / frame.width : pixel;
      const down = kind === "image" || projected !== undefined ? height / frame.height : pixel;
      element.style.backgroundSize = `${frame.sheet.width * across}px ${frame.sheet.height * down}px`;
      element.style.backgroundPosition = `${-frame.x * across}px ${-frame.y * down}px`;
    }
  };
  element.style.visibility = "hidden";
  const ready = input
    .loadSheet(input.artUrl(domArtPath(kind, art.key, "json")))
    .then((json) => {
      frame = sheetFrame(json, art.sheet?.tag);
      element.style.visibility = "";
      if (scale !== undefined) {
        place(scale);
      }
    })
    // A request that fails, or frames that are not a sheet's, leave the art hidden.
    .catch((error: unknown) => console.error(`The ${art.key} sheet did not load.`, error))
    .then(() => urls);
  return { element, place, ready };
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
    ...(view.separators ?? []).map((rect) => contentSeparatorPart(doc, "grid", rect)),
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
    ...(input.backgroundCancel === undefined ? {} : { backgroundCancel: input.backgroundCancel }),
    close: input.close ?? input.dismiss ?? null,
    closeLabel: input.closeLabel,
    ...(input.dismiss === undefined ? {} : { dismiss: input.dismiss }),
    describedBy: texts.id,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: input.presses ?? [],
    toGame: input.toGame,
    view: view.card,
  });
}
