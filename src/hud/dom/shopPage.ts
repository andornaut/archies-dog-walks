import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import type { DetailFramed } from "../../home/detailCardView.ts";
import type { PageFill, PageTab } from "../../home/shopPageView.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import { createTextLine, placeBox, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect } from "../../ui/domScale.ts";
import { bindPanelFeedback, type PanelPress } from "./panelButton.ts";
import type { DomPart } from "./questionPanel.ts";

// The page the Pet shop and the Logbook share in HTML over the canvas: the cream fill and the
// tabs, at the places the canvas draws them (shopPageView). Boxes, bands and keylines are whole
// art pixels from their frame's snapped corner.

type Box = Parameters<typeof setBox>[1];

// Native tabs share the button face and dispatcher while retaining their authored target.
export function createPageTab(
  doc: Document,
  input: { readonly font: BitmapFont; readonly press: PanelPress },
  hit: Rect,
  tab: PageTab,
): DomPart & { dispose(): void } {
  const content = doc.createElement("span");
  content.className = "adw-lines";
  const label = createTextLine(doc, tab.label);
  label.setAttribute("aria-hidden", "true");
  content.append(label);
  const view = createGameButton(doc, {
    appearance: { className: "adw-button", role: "secondary" },
    content: { icon: content, kind: "icon", name: tab.label.text },
    getAction: () => (input.press.accepts() ? { activate: input.press.press } : null),
    getState: () => ({ selected: tab.framed }),
  });
  const stopFeedback = bindPanelFeedback(view, input.press);
  return {
    controls: [view.element],
    dispose() {
      stopFeedback();
      view.dispose();
    },
    element: view.element,
    place(scale) {
      placeBox(scale, { x: 0, y: 0 }, view.element, hit);
      placeBox(scale, hit, view.face, tab.face);
      placeText(input.font, scale, tab.face, label, tab.label);
    },
  };
}

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
