import type { Scene } from "phaser";

import type { DetailPicture } from "../home/detail.ts";
import type { ConfirmChoice, ConfirmLines } from "../home/purchaseConfirm.ts";
import {
  type PurchaseConfirmCardView,
  purchaseConfirmCardView,
} from "../home/purchaseConfirmCardView.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";

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
