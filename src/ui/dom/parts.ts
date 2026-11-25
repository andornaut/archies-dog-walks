import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import { closeControl } from "../closeControl.ts";
import { artPixel, type DomScale, frameRect, gridRect, gridX, gridY } from "../domScale.ts";
import type { QuestionPanelView } from "../modal/types.ts";
import { cssHex } from "../palette.ts";
import { placeBox, placeFrame, setBox } from "./pixelLine.ts";

// The HTML interface's shared parts: boxes of one colour, framed boxes, nine-slice panel frames
// and the view of a panel with no frame of its own. Every place is in device pixels from the
// part's frame corner, on the art-pixel grid.

// A part a panel draws beyond its frame, title, note and buttons (a detail card's well, art and
// text), placed again as the scale changes.
export interface DomPart {
  // The part's controls, which Tab reaches before the panel's buttons and close control, in
  // order; keys on them go through to the scene under, which acts on its own focus.
  readonly controls?: readonly HTMLElement[];
  readonly element: HTMLElement;
  readonly place: (scale: DomScale) => void;
  readonly ready?: Promise<readonly string[]>;
}

export type DomBox = Parameters<typeof setBox>[1];

// A rect filled in one colour.
export interface DomFill {
  readonly colour: number;
  readonly rect: Rect;
}

// A box filled in fill inside a one-art-pixel border, its rect in game pixels. Principal wells
// follow their logical allocation (layout); the rest keep authored pixels.
export interface DomFramed {
  readonly border: number;
  readonly fill: number;
  readonly projection?: "art" | "layout";
  readonly rect: Rect;
}

// An element of one colour, for its caller to place.
export function colourBox(doc: Document, colour: number, tag: "div" | "span" = "div"): HTMLElement {
  const element = doc.createElement(tag);
  element.className = "adw-framed";
  element.style.backgroundColor = cssHex(colour);
  return element;
}

// A box of one colour, placed by place.
export function boxPart(
  doc: Document,
  colour: number,
  place: (scale: DomScale) => DomBox,
): DomPart {
  const element = colourBox(doc, colour);
  return { element, place: (scale) => setBox(element, place(scale)) };
}

// A fill over its rect, its corner on the art-pixel grid and its size whole art pixels.
export function fillPart(doc: Document, fill: DomFill): DomPart {
  return boxPart(doc, fill.colour, (scale) => frameRect(scale, fill.rect));
}

// An element over rect on the device grid (placeBox), from origin.
export function gridBoxPart(origin: Point, element: HTMLElement, rect: Rect): DomPart {
  return { element, place: (scale) => placeBox(scale, origin, element, rect) };
}

// A fill over its rect on the device grid, from origin.
export function gridFillPart(
  doc: Document,
  origin: Point,
  fill: DomFill,
  tag: "div" | "span" = "div",
): DomPart {
  return gridBoxPart(origin, colourBox(doc, fill.colour, tag), fill.rect);
}

// A box placed by place, filled in fill an art pixel inside its border.
export function borderedPart(
  doc: Document,
  colours: Pick<DomFramed, "border" | "fill">,
  place: (scale: DomScale) => DomBox,
): DomPart {
  const element = colourBox(doc, colours.border);
  const fill = colourBox(doc, colours.fill);
  element.append(fill);
  return {
    element,
    place: (scale) => {
      const box = place(scale);
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

// A framed box whose rect is a frame (frameRect).
export function framedBoxPart(doc: Document, framed: DomFramed): DomPart {
  return borderedPart(doc, framed, (scale) => frameRect(scale, framed.rect));
}

// A framed box with one authored-pixel border: its corner on the art-pixel grid and its size the
// rect's in art pixels, or its logical allocation (gridRect) for a principal well.
export function framedPart(doc: Document, framed: DomFramed): DomPart {
  return borderedPart(doc, framed, (scale) => {
    const pixel = artPixel(scale);
    const { height, width, x, y } = framed.rect;
    return framed.projection === "layout"
      ? gridRect(scale, framed.rect)
      : {
          height: height * pixel,
          left: gridX(scale, x),
          top: gridY(scale, y),
          width: width * pixel,
        };
  });
}

// The nine-slice frames: a modal card's ui-detail-card, a ui-panel that takes presses, one that
// passes them through to the canvas (plate), and a ui-quip bubble.
const FRAME_CLASSES = {
  card: "adw-card",
  panel: "adw-panel",
  plate: "adw-plate-frame",
  quip: "adw-quip-frame",
} as const;

// A nine-slice frame over rect, whole art pixels wide and tall from its snapped corner.
export function panelFramePart(
  doc: Document,
  frame: keyof typeof FRAME_CLASSES,
  rect: Rect,
): DomPart {
  const element = doc.createElement("div");
  element.className = FRAME_CLASSES[frame];
  return { element, place: (scale) => placeFrame(scale, { x: 0, y: 0 }, element, rect) };
}

// A panel view with no frame of its own, where the canvas or the panel's parts draw it: no title,
// buttons or note, and a tap outside it missing nothing, unless given.
export function framelessView(
  panel: Rect,
  view: Partial<
    Pick<QuestionPanelView, "buttons" | "close" | "covered" | "footer" | "title" | "titleY">
  > = {},
): QuestionPanelView {
  return {
    buttons: view.buttons ?? [],
    close: view.close ?? closeControl(panel),
    covered: view.covered ?? [],
    ...(view.footer === undefined ? {} : { footer: view.footer }),
    frame: "none",
    note: [],
    notePlate: undefined,
    panel,
    title: view.title ?? [],
    titleY: view.titleY ?? panel.y,
  };
}
