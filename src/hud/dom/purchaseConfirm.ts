import type { PurchaseConfirmCardView } from "../../home/purchaseConfirmCardView.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPart, type DomDetailCardInput, framedPart, textPart } from "./detailCard.ts";
import { type DomPart, type DomQuestionPanel, showQuestionPanel } from "./questionPanel.ts";

// The purchase confirm in HTML over the canvas: the modal card, its title, close control and
// Cancel and Buy drawn as a modal card is (showQuestionPanel), and its well, picture, price and
// the bank it would leave as its view (purchaseConfirmCardView) lays them out, at the places the
// canvas draws them. Its buttons and close control press on a click; number keys press none.

export interface DomPurchaseConfirmInput extends Omit<DomDetailCardInput, "close" | "view"> {
  // What Buy does, and what Cancel and the close control do.
  readonly buy: () => void;
  readonly cancel: () => void;
  readonly view: PurchaseConfirmCardView;
}

// Ids that tie each confirm's dialog to its text.
let confirms = 0;

// The confirm in layer, shown and its dialog focused.
export function showPurchaseConfirm(
  layer: UiLayer,
  input: DomPurchaseConfirmInput,
): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  confirms += 1;
  const { view } = input;
  const texts = doc.createElement("div");
  texts.className = "adw-lines";
  texts.id = `adw-confirm-${confirms}`;
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
    close: input.cancel,
    closeLabel: input.closeLabel,
    describedBy: texts.id,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    // Cancel, then Buy, as the view lays them out.
    presses: [input.cancel, input.buy],
    toGame: input.toGame,
    view: view.card,
  });
}
