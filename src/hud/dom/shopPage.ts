import type { Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import type { DetailFramed } from "../../home/detailCardView.ts";
import {
  type PageFill,
  type PageTab,
  SELECT_FRAME,
  type ShopPageView,
} from "../../home/shopPageView.ts";
import { createTextLine, placeFrame, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { SELECT_OUTSET } from "../../ui/selection.ts";
import type { DomPart } from "./questionPanel.ts";

// The page the Pet shop and the Logbook share in HTML over the canvas: the wood under the card,
// the ui-detail-card and the tabs, at the places the canvas draws them (shopPageView). The
// page's title and close control are a panel's (showQuestionPanel). Boxes, bands and keylines are
// whole art pixels from their frame's snapped corner.

type Box = Parameters<typeof setBox>[1];

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// A box of one colour, placed by place.
export function boxPart(doc: Document, colour: number, place: (scale: DomScale) => Box): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-framed";
  element.style.backgroundColor = hex(colour);
  return { element, place: (scale) => setBox(element, place(scale)) };
}

// A fill over its rect, its corner on the art-pixel grid and its size whole art pixels.
export function fillPart(doc: Document, fill: PageFill): DomPart {
  return boxPart(doc, fill.colour, (scale) => frameRect(scale, fill.rect));
}

// A framed box: its rect a frame (frameRect), its fill an art pixel inside its border.
export function framedBoxPart(doc: Document, framed: DetailFramed): DomPart {
  const outer = boxPart(doc, framed.border, (scale) => frameRect(scale, framed.rect));
  const inner = doc.createElement("div");
  inner.className = "adw-framed";
  inner.style.backgroundColor = hex(framed.fill);
  outer.element.append(inner);
  return {
    element: outer.element,
    place: (scale) => {
      outer.place(scale);
      const box = frameRect(scale, framed.rect);
      const pixel = artPixel(scale);
      setBox(inner, {
        height: box.height - 2 * pixel,
        left: pixel,
        top: pixel,
        width: box.width - 2 * pixel,
      });
    },
  };
}

// The boxes of a ring inset art pixels inside a width by height box, width art pixels wide, in
// device pixels from the box's corner.
function ringBoxes(
  pixel: number,
  size: { height: number; width: number },
  ring: { inset: number; width: number },
): Box[] {
  const inset = ring.inset * pixel;
  const band = ring.width * pixel;
  const width = size.width - 2 * inset;
  const height = size.height - 2 * inset;
  return [
    { height: band, left: inset, top: inset, width },
    { height: band, left: inset, top: inset + height - band, width },
    { height: height - 2 * band, left: inset, top: inset + band, width: band },
    { height: height - 2 * band, left: inset + width - band, top: inset + band, width: band },
  ];
}

// A tab: its shadow under the group that lifts and dips, its face, the open tab's gold frame and
// its label, laid out in art pixels from the snapped corner of the frame round it.
function tabPart(doc: Document, title: BitmapFont, tab: PageTab): DomPart {
  const outer: Rect = tab.framed
    ? {
        height: tab.face.height + 2 * SELECT_OUTSET,
        width: tab.face.width + 2 * SELECT_OUTSET,
        x: tab.face.x - SELECT_OUTSET,
        y: tab.face.y - SELECT_OUTSET,
      }
    : tab.face;
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const box = (colour: number) => {
    const part = doc.createElement("div");
    part.className = "adw-framed";
    part.style.backgroundColor = hex(colour);
    return part;
  };
  const shadow = tab.shadow === undefined ? undefined : box(PALETTE.plum);
  const group = doc.createElement("div");
  group.className = "adw-framed";
  const face = box(tab.border);
  const fill = box(tab.fill);
  face.append(fill);
  // The frame's ring, amber band and keyline, four bands each, then its four corner dots.
  const { amber, dots, keyline, ring } = SELECT_FRAME;
  const frameBands = tab.framed
    ? [ring, amber, keyline, dots].flatMap((part) =>
        [0, 1, 2, 3].map(() => box(part === amber ? PALETTE.amber : PALETTE.ink)),
      )
    : [];
  const label = createTextLine(doc, tab.label);
  label.setAttribute("aria-hidden", "true");
  group.append(face, ...frameBands, label);
  if (shadow !== undefined) {
    element.append(shadow);
  }
  element.append(group);
  return {
    element,
    place: (scale) => {
      const pixel = artPixel(scale);
      const corner = frameRect(scale, outer);
      setBox(group, { ...corner, top: corner.top + tab.dy * pixel });
      const outset = tab.framed ? SELECT_OUTSET * pixel : 0;
      const faceBox = {
        height: corner.height - 2 * outset,
        left: outset,
        top: outset,
        width: corner.width - 2 * outset,
      };
      setBox(face, faceBox);
      setBox(fill, {
        height: faceBox.height - 2 * pixel,
        left: pixel,
        top: pixel,
        width: faceBox.width - 2 * pixel,
      });
      if (tab.framed) {
        const size = { height: corner.height, width: corner.width };
        const rings = [
          // The outer ring leaves out its corner pixels.
          ...ringBoxes(pixel, size, ring).map((band, i) =>
            i < 2 ? { ...band, left: band.left + pixel, width: band.width - 2 * pixel } : band,
          ),
          ...ringBoxes(pixel, size, amber),
          ...ringBoxes(pixel, size, keyline),
          ...[dots.inset, size.height / pixel - dots.inset - 1].flatMap((y) =>
            [dots.inset, size.width / pixel - dots.inset - 1].map((x) => ({
              height: pixel,
              left: x * pixel,
              top: y * pixel,
              width: pixel,
            })),
          ),
        ];
        frameBands.forEach((band, i) => {
          const at = rings[i];
          if (at !== undefined) {
            setBox(band, at);
          }
        });
      }
      if (shadow !== undefined && tab.shadow !== undefined) {
        const { shadow: rect } = tab;
        setBox(shadow, {
          height: rect.height * pixel,
          left: corner.left + (rect.x - outer.x) * pixel,
          top: corner.top + corner.height - (outer.y + outer.height - rect.y) * pixel,
          width: corner.width - (outer.width - rect.width) * pixel,
        });
      }
      placeText(title, scale, { x: outer.x, y: outer.y }, label, tab.label);
    },
  };
}

// The wood, the card and the tabs, in order.
export function shopPageParts(doc: Document, title: BitmapFont, page: ShopPageView): DomPart[] {
  const card = doc.createElement("div");
  card.className = "adw-card";
  return [
    fillPart(doc, page.wood),
    { element: card, place: (scale) => placeFrame(scale, { x: 0, y: 0 }, card, page.card) },
    ...page.tabs.map((tab) => tabPart(doc, title, tab)),
  ];
}
