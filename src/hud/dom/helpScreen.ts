import { itemAt } from "@andornaut/game-kit/runtime/arrays";

import { HELP_LAYOUT } from "../../help/helpLayout.ts";
import { HELP_DOTS, type HelpView } from "../../help/helpView.ts";
import { createTextLine, type DomTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import { type PanelText } from "../../ui/modal/types.ts";
import { PALETTE } from "../../ui/palette.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// Native Help text, page controls, body scrolling and dismissal share the scene's callbacks.
// The canvas keeps the full-screen backing and live illustration beneath this logical layout.

export type DomHelpInput = Pick<
  DomQuestionPanelInput,
  "closeLabel" | "fonts" | "footerPress" | "gesture" | "presses" | "toGame"
> & {
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
function textParts(
  input: DomHelpInput,
  parent: HTMLElement,
  lines: readonly PanelText[],
  origin = { x: 0, y: 0 },
): DomPart {
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
          placeText(input.fonts[line.font], scale, origin, element, line);
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
  const clip = doc.createElement("div");
  clip.className = "adw-help-body adw-framed";
  clip.tabIndex = 0;
  clip.setAttribute("role", "region");
  clip.setAttribute("aria-label", view.title.text);
  Object.assign(clip.style, {
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    pointerEvents: "auto",
    scrollbarWidth: "thin",
    touchAction: "pan-y",
  });
  clip.addEventListener("keydown", (event) => {
    if (
      [
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "End",
        "Enter",
        "Home",
        "PageDown",
        "PageUp",
        "Space",
      ].includes(event.code)
    ) {
      event.stopPropagation();
    }
  });
  clip.append(body);
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
  const bodyText = textParts(input, body, bodyLines, { x: 0, y: view.body.capTop });
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
  page.append(title, clip);
  const parts: DomPart[] = [
    ...view.rules.map(({ colour, rect }) =>
      fillPart(doc, colour, (scale) => ({ ...gridRect(scale, rect), height: artPixel(scale) })),
    ),
    ...view.dots.map((dot, i) =>
      dotPart(doc, dot, (scale) => itemAt(dotBoxes(scale, view.dots), i)),
    ),
    {
      controls: [clip],
      element: page,
      place: (scale) => {
        setBox(clip, gridRect(scale, HELP_LAYOUT.body.viewport));
        const content = gridRect(scale, {
          height: view.body.lines.length * view.body.pitch,
          width: HELP_LAYOUT.screen.width,
          x: 0,
          y: view.body.capTop,
        });
        setBox(body, { height: content.height, left: 0, top: 0, width: content.width });
        titleText.place(scale);
        bodyText.place(scale);
      },
    },
  ];
  let scrollingBody = false;
  const gesture =
    input.gesture === undefined
      ? undefined
      : {
          cancel: () => {
            scrollingBody = false;
            input.gesture?.cancel?.();
          },
          down: (event: PointerEvent) => {
            scrollingBody = clip.contains(event.target as Node);
            if (scrollingBody) {
              input.gesture?.cancel?.();
            } else {
              input.gesture?.down?.(event);
            }
          },
          move: (event: PointerEvent) => {
            if (!scrollingBody) {
              input.gesture?.move?.(event);
            }
          },
          up: (event: PointerEvent, cancelled: boolean) => {
            const scroll = scrollingBody;
            scrollingBody = false;
            return scroll ? false : input.gesture?.up?.(event, cancelled);
          },
        };
  return showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    closePressed: view.closePressed,
    describedBy: page.id,
    fonts: input.fonts,
    gestureOnActions: true,
    ...(input.footerPress === undefined ? {} : { footerPress: input.footerPress }),
    label: view.heading.text,
    numberKeys: false,
    parts,
    presses: input.presses,
    ...(gesture === undefined ? {} : { gesture }),
    toGame: input.toGame,
    view: {
      buttons: view.buttons,
      close: view.close,
      covered: [],
      footer: view.footer,
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: view.illustration,
      title: [],
      titleY: view.heading.capTop,
    },
  });
}
