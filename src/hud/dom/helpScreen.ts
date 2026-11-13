import { itemAt } from "@andornaut/game-kit/arrays";

import { HELP_DOTS, type HelpView } from "../../help/helpView.ts";
import { createTextLine, type DomTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import type { PanelText } from "../questionPanelView.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The help screen's heading, close control, picture rules, page title, body, dots and buttons in
// HTML over the canvas, at the places the canvas draws them (helpView). The canvas keeps the dark
// screen, the top bar and the page's picture under it. It takes no presses: the scene under it
// takes every tap, swipe and key, as on the canvas, and draws it again as they change it.

export type DomHelpInput = Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame"> & {
  readonly view: HelpView;
};

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// Ids that tie each screen's dialog to its page.
let screens = 0;

// A box of one colour, its edges on the art-pixel grid; height, where given, in art pixels.
function fillPart(
  doc: Document,
  colour: number,
  place: (scale: DomScale) => Parameters<typeof setBox>[1],
): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-framed";
  element.style.backgroundColor = hex(colour);
  return { element, place: (scale) => setBox(element, place(scale)) };
}

// Where the dots go, in whole device pixels: each its side in art pixels, the row laid out in
// art pixels from the snapped column under its middle, so every dot and gap is the same size.
function dotBoxes(scale: DomScale, dots: HelpView["dots"]): Parameters<typeof setBox>[1][] {
  const first = dots[0]?.rect;
  const last = dots.at(-1)?.rect;
  if (first === undefined || last === undefined) {
    return [];
  }
  const pixel = artPixel(scale);
  const half = Math.floor((last.x + last.width - first.x) / 2);
  const left = gridX(scale, first.x + half) - half * pixel;
  return dots.map(({ rect }) => ({
    height: rect.height * pixel,
    left: left + (rect.x - first.x) * pixel,
    top: gridY(scale, rect.y),
    width: rect.width * pixel,
  }));
}

// A dot: filled, or a ring an art pixel wide round the dark screen's colour.
function dotPart(
  doc: Document,
  dot: HelpView["dots"][number],
  box: (scale: DomScale) => Parameters<typeof setBox>[1],
): DomPart {
  const ring = fillPart(doc, dot.current ? HELP_DOTS.current : HELP_DOTS.ring, box);
  if (dot.current) {
    return ring;
  }
  const hole = doc.createElement("div");
  hole.className = "adw-framed";
  hole.style.backgroundColor = hex(PALETTE.darkBrown);
  ring.element.append(hole);
  return {
    element: ring.element,
    place: (scale) => {
      ring.place(scale);
      const { height, width } = box(scale);
      const pixel = artPixel(scale);
      setBox(hole, {
        height: height - 2 * pixel,
        left: pixel,
        top: pixel,
        width: width - 2 * pixel,
      });
    },
  };
}

// Lines of text in parent, placed as the canvas places them.
function textParts(input: DomHelpInput, parent: HTMLElement, lines: readonly PanelText[]): DomPart {
  const doc = parent.ownerDocument;
  const elements = lines.map((line) => {
    const element = createTextLine(doc, line as DomTextLine);
    element.setAttribute("aria-hidden", "true");
    parent.append(element);
    return element;
  });
  return {
    element: parent,
    place: (scale) =>
      lines.forEach((line, i) => {
        const element = elements[i];
        if (element !== undefined) {
          placeText(input.fonts[line.font], scale, { x: 0, y: 0 }, element, line);
        }
      }),
  };
}

// The help screen in layer, shown and its dialog focused.
export function showHelpScreen(layer: UiLayer, input: DomHelpInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  screens += 1;
  const { view } = input;
  const page = doc.createElement("div");
  page.className = "adw-lines";
  page.id = `adw-help-${screens}`;
  const title = doc.createElement("h3");
  title.className = "adw-lines";
  const body = doc.createElement("p");
  body.className = "adw-lines";
  const bodyLines = view.body.lines.map((text, i): PanelText => ({
    capTop: view.body.capTop + i * view.body.pitch,
    centre: "left",
    centreX: view.body.x,
    colour: view.body.colour,
    font: "body",
    line: 0,
    scale: view.body.scale,
    text,
  }));
  const titleText = textParts(input, title, [view.title]);
  const bodyText = textParts(input, body, bodyLines);
  // A screen reader reads the page's title and body as written.
  for (const [element, text] of [
    [title, view.title.text],
    [body, view.body.lines.join(" ")],
  ] as const) {
    const spoken = doc.createElement("span");
    spoken.className = "adw-spoken";
    spoken.textContent = text;
    element.append(spoken);
  }
  page.append(title, body);
  const parts: DomPart[] = [
    ...view.rules.map(({ colour, rect }) =>
      fillPart(doc, colour, (scale) => ({ ...gridRect(scale, rect), height: artPixel(scale) })),
    ),
    ...view.dots.map((dot, i) =>
      dotPart(doc, dot, (scale) => itemAt(dotBoxes(scale, view.dots), i)),
    ),
    {
      element: page,
      place: (scale) => {
        titleText.place(scale);
        bodyText.place(scale);
      },
    },
  ];
  return showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    closePressed: view.closePressed,
    describedBy: page.id,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: {
      buttons: view.buttons,
      close: view.close,
      covered: [],
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: view.illustration,
      title: [],
      titleY: view.heading.capTop,
    },
  });
}
