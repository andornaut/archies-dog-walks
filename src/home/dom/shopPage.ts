import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  bindPanelFeedback,
  createGameButton,
  createTextLine,
  type DomPart,
  type PanelPress,
  placeBox,
  placeText,
} from "../../ui/dom/index.ts";
import type { PageTab } from "../index.ts";

// The tabs the Pet shop and the Logbook share in HTML over the canvas, at the places the canvas
// draws them (shopPageView).

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
