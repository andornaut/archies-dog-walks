import type { GameObjects, Scene } from "phaser";

import type { DetailPicture } from "../home/detail.ts";
import type { ConfirmChoice, ConfirmLines } from "../home/purchaseConfirm.ts";
import {
  type PurchaseConfirmCardView,
  purchaseConfirmCardView,
} from "../home/purchaseConfirmCardView.ts";
import { addModalShade } from "../ui/phaser/draw.ts";
import { addDetailContent, addModalCard } from "./homePanels.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";
import { addMenuButton } from "./uiKit.ts";

// The scene that opens the confirm routes its taps and keys through the model in
// home/purchaseConfirm; the views only draw.

// Where the confirm's card lies, and where each answer and its close control are tapped. A tap
// on the close control or off the card cancels; one on the card off its answers does nothing.
export type PurchaseConfirmHits = PurchaseConfirmCardView["hits"];

// The confirm's view, measured on scene's fonts and art: the modal card titled "Buy {name}?" with
// its close control, which cancels as Cancel does, the picture in its well, the price and the
// bank it would leave, then Cancel and Buy, the answer under a finger or a key's dip pressed.
export function purchaseConfirmView(
  scene: Scene,
  input: {
    readonly lines: ConfirmLines;
    readonly picture: DetailPicture;
    readonly pressed: ConfirmChoice | undefined;
  },
): PurchaseConfirmCardView {
  return purchaseConfirmCardView(canvasDetailMeasure(scene), input);
}

// The confirm over everything the scene drew before it, as its view lays it out: the shop
// dimmed, then the card, its close control shown pressed while closePressed.
export function drawPurchaseConfirm(
  scene: Scene,
  layer: GameObjects.Container,
  view: PurchaseConfirmCardView,
  closePressed: boolean,
): void {
  const { card } = view;
  layer.add(addModalShade(scene, view.dim));
  addModalCard(scene, layer, card.panel, view.title, { pressed: closePressed });
  addDetailContent(scene, layer, view);
  for (const button of card.buttons) {
    addMenuButton(
      scene,
      button.rect,
      button.label,
      { available: true, primary: button.primary, secondary: button.secondary === true },
      layer,
    ).setPressed(button.pressed === true);
  }
}
