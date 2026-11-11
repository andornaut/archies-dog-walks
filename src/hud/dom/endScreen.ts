import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import type { DetailArt, DetailText } from "../../home/detailCardView.ts";
import type { EndResults, EndScreenView } from "../../home/endScreenView.ts";
import { closeControl } from "../../ui/closeControl.ts";
import {
  createTextLine,
  type DomTextLine,
  placeBox,
  placeFrame,
  placeText,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import type { PanelText } from "../questionPanelView.ts";
import { artPart, type DomDetailCardInput, framedPart, textPart } from "./detailCard.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The End screen's text, pips, bubbles and Back to title in HTML over the canvas, at the places
// the canvas draws them (endScreenView). The canvas keeps the backdrop, the returning pack and
// its owners, the logo, the ribbon and its burst, the results panel with its wells, TOTAL's band
// and rule, the faces, and the badge strip's panel, confetti and badges. It takes no presses: the
// scene takes every press and key, as on the canvas, and says how Back to title shows.

export interface DomEndScreenInput extends Pick<
  DomDetailCardInput,
  "artUrl" | "fonts" | "loadSheet" | "pillColours"
> {
  readonly closeLabel: string;
  // The display lettering's bitmap font, which lays the title's web font out.
  readonly display: BitmapFont;
  readonly toGame: DomQuestionPanelInput["toGame"];
  readonly view: EndScreenView;
}

export interface DomEndScreen extends DomQuestionPanel {
  // Back to title pressed, or raised bob game pixels down (whole, as the canvas bobs it).
  setButton(pressed: boolean, bob: number): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// The display lettering's fill colour, which its bitmap font bakes in on the canvas.
const DISPLAY_FILL = PALETTE.yellow;

// The results moved down dy, as the canvas moves their group.
function moved(results: EndResults, dy: number) {
  const point = <T extends Point>(at: T): T => ({ ...at, y: at.y + dy });
  const art = (item: DetailArt): DetailArt => ({
    ...point(item),
    ...(item.holder === undefined ? {} : { holder: point(item.holder) }),
    ...(item.right === undefined ? {} : { right: point(item.right) }),
  });
  const text = (item: DetailText): DetailText => ({ ...item, capTop: item.capTop + dy });
  const line = (item: PanelText): PanelText => ({ ...item, capTop: item.capTop + dy });
  return {
    art: results.art.map(art),
    bubbles: results.bubbles.map(point),
    framed: results.framed.map((box) => ({ ...box, rect: point(box.rect) })),
    names: results.names.map(line),
    texts: results.texts.map(text),
    title: { ...results.title, capTop: results.title.capTop + dy },
  };
}

// Lines of text in parent, each placed as the canvas places it, the whole read as written unless
// the dialog's name already reads it.
function linesPart(
  doc: Document,
  fonts: (line: DomTextLine) => BitmapFont,
  lines: readonly DomTextLine[],
  spoken = true,
): DomPart {
  const parent = doc.createElement("p");
  parent.className = "adw-lines";
  const elements = lines.map((line) => {
    const element = createTextLine(doc, line);
    element.setAttribute("aria-hidden", "true");
    parent.append(element);
    return element;
  });
  if (spoken) {
    const words = doc.createElement("span");
    words.className = "adw-spoken";
    words.textContent = lines.map(({ text }) => text).join(" ");
    parent.append(words);
  }
  return {
    element: parent,
    place: (scale) =>
      lines.forEach((line, i) => {
        const element = elements[i];
        if (element !== undefined) {
          placeText(fonts(line), scale, ORIGIN, element, line);
        }
      }),
  };
}

// A ui-quip bubble, whole art pixels wide and tall from its snapped corner.
function bubblePart(doc: Document, rect: Rect): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-quip-frame";
  return { element, place: (scale) => placeFrame(scale, ORIGIN, element, rect) };
}

// Back to title: the go button's face and its label, pressed or bobbing as the scene says.
function buttonPart(
  doc: Document,
  fonts: (line: DomTextLine) => BitmapFont,
  button: EndScreenView["button"],
): DomPart & { set(pressed: boolean, bob: number): void } {
  const element = doc.createElement("span");
  element.className = "adw-button adw-go";
  element.setAttribute("aria-hidden", "true");
  const face = doc.createElement("span");
  face.className = "adw-face";
  const label = createTextLine(doc, button.text);
  label.setAttribute("aria-hidden", "true");
  element.append(face, label);
  let scale: DomScale | undefined;
  let shown = { bob: 0, pressed: false };
  const show = () => {
    if (shown.pressed) {
      element.setAttribute("data-pressed", "");
    } else {
      element.removeAttribute("data-pressed");
    }
    element.style.transform =
      scale === undefined || shown.bob === 0 ? "" : `translateY(${shown.bob * artPixel(scale)}px)`;
  };
  return {
    element,
    place: (at) => {
      scale = at;
      placeBox(at, ORIGIN, element, button.hit);
      placeFrame(at, button.hit, face, button.rect);
      placeText(fonts(button.text), at, button.hit, label, button.text);
      show();
    },
    set(pressed, bob) {
      if (pressed !== shown.pressed || bob !== shown.bob) {
        shown = { bob, pressed };
        show();
      }
    },
  };
}

// The End screen in layer, shown and its dialog focused.
export function showEndScreen(layer: UiLayer, input: DomEndScreenInput): DomEndScreen {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const fonts = (line: DomTextLine) =>
    line.font === "display" ? input.display : input.fonts[line.font];
  const results = moved(view.results, view.offsetY);
  const title: DomTextLine = {
    capTop: results.title.capTop,
    centre: "advance",
    centreX: results.title.centreX,
    colour: DISPLAY_FILL,
    font: "display",
    scale: 1,
    text: results.title.text,
  };
  const strip = view.strip;
  const button = buttonPart(doc, fonts, view.button);
  const parts: DomPart[] = [
    ...results.bubbles.map((rect) => bubblePart(doc, rect)),
    ...results.framed.map((box) => framedPart(doc, box)),
    ...results.art.map((art) => artPart(doc, input, art)),
    linesPart(doc, fonts, [title], false),
    ...results.texts.map((text) => textPart(doc, input, text)),
    linesPart(doc, fonts, results.names),
    ...(strip === undefined
      ? []
      : [
          linesPart(doc, fonts, strip.title),
          ...strip.names.map((name) => textPart(doc, input, name)),
        ]),
    button,
  ];
  const screen = { height: 0, width: 0, x: 0, y: 0 };
  const panel = showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    label: results.title.text,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: {
      buttons: [],
      close: closeControl(screen),
      covered: [],
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: screen,
      title: [],
      titleY: 0,
    },
  });
  return { ...panel, setButton: (pressed, bob) => button.set(pressed, bob) };
}
