import { itemAt } from "@andornaut/game-kit/runtime/arrays";

import { HELP_LAYOUT } from "../../help/helpLayout.ts";
import { HELP_DOTS, type HelpView } from "../../help/helpView.ts";
import { borderedPart, boxPart, type DomBox, type DomPart } from "../../ui/dom/parts.ts";
import { createTextLine, type DomTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import { type PanelText } from "../../ui/modal/types.ts";
import { PALETTE } from "../../ui/palette.ts";
import { BODY_ASCENT_ROWS } from "../../ui/textFit.ts";
import { showPage } from "./page.ts";
import type { DomQuestionPanel, DomQuestionPanelInput } from "./questionPanel.ts";

// Native Help text, page controls, body scrolling and dismissal share the scene's callbacks, on
// the page template (showPage). The canvas keeps the page's backing, the picture's frame and the
// live illustration beneath this logical layout.

export type DomHelpInput = Pick<
  DomQuestionPanelInput,
  "fonts" | "gesture" | "presses" | "toGame"
> & {
  // What Back does.
  readonly footerPress: () => void;
  readonly view: HelpView;
};

// Ids that tie each screen's dialog to its page.
let screens = 0;

// Where the dots go, in whole device pixels: each its side in art pixels, the row laid out in
// art pixels from the snapped column under its middle, so every dot and gap is the same size.
function dotBoxes(scale: DomScale, dots: HelpView["dots"]): DomBox[] {
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
  box: (scale: DomScale) => DomBox,
): DomPart {
  return dot.current
    ? boxPart(doc, HELP_DOTS.current, box)
    : borderedPart(doc, { border: HELP_DOTS.ring, fill: PALETTE.darkBrown }, box);
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

// The help page in layer, shown and its dialog focused.
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
    scrollSnapType: "y mandatory",
    scrollbarWidth: "none",
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
  const caption = doc.createElement("p");
  caption.className = "adw-lines";
  const captionText = textParts(input, caption, [view.caption]);
  caption.setAttribute("aria-hidden", "true");
  // The lines from the first's slot, its letters' top: the viewport shows whole slots, and a
  // scroll comes to rest on one.
  const slotTop = view.body.capTop - BODY_ASCENT_ROWS * view.body.scale;
  const bodyText = textParts(input, body, bodyLines, { x: 0, y: slotTop });
  const slots = view.body.lines.map(() => {
    const slot = doc.createElement("div");
    slot.className = "adw-framed";
    slot.style.scrollSnapAlign = "start";
    body.append(slot);
    return slot;
  });
  // A screen reader reads the page's title and body as written.
  for (const [element, text] of [
    [title, view.title.text],
    [body, view.body.lines.join(" ")],
  ] as const) {
    const spoken = doc.createElement("span");
    spoken.className = "visually-hidden";
    spoken.textContent = text;
    element.append(spoken);
  }
  page.append(caption, title, clip);
  // A press anywhere on the page under the top bar's press columns, away from its controls, is a
  // page press (the scene's gesture).
  const surface = doc.createElement("div");
  surface.setAttribute("aria-hidden", "true");
  Object.assign(surface.style, { pointerEvents: "auto", position: "absolute" });
  const parts: DomPart[] = [
    { element: surface, place: (scale) => setBox(surface, gridRect(scale, HELP_LAYOUT.presses)) },
    ...view.dots.map((dot, i) =>
      dotPart(doc, dot, (scale) => itemAt(dotBoxes(scale, view.dots), i)),
    ),
  ];
  const bodyPart: DomPart = {
    controls: [clip],
    element: page,
    place: (scale) => {
      setBox(clip, gridRect(scale, HELP_LAYOUT.body.viewport));
      const content = gridRect(scale, {
        height: view.body.lines.length * view.body.pitch,
        width: HELP_LAYOUT.screen.width,
        x: 0,
        y: slotTop,
      });
      setBox(body, { height: content.height, left: 0, top: 0, width: content.width });
      slots.forEach((slot, i) => {
        const top = gridY(scale, slotTop + i * view.body.pitch) - content.top;
        const bottom = gridY(scale, slotTop + (i + 1) * view.body.pitch) - content.top;
        setBox(slot, { height: bottom - top, left: 0, top, width: content.width });
      });
      captionText.place(scale);
      titleText.place(scale);
      bodyText.place(scale);
    },
  };
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
  return showPage(layer, {
    back: input.footerPress,
    buttons: view.buttons,
    chrome: { back: view.footer },
    describedBy: page.id,
    fonts: input.fonts,
    gestureOnActions: true,
    ...(gesture === undefined ? {} : { gesture }),
    label: view.label,
    list: {
      clip,
      part: bodyPart,
      scroll: () => ({
        contentHeight: view.body.lines.length * view.body.pitch,
        viewport: HELP_LAYOUT.body.viewport,
      }),
    },
    parts,
    presses: input.presses,
    toGame: input.toGame,
  });
}
