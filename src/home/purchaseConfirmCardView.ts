import type { Rect } from "@andornaut/game-kit/rect";

import { modalCardView, type QuestionPanelView } from "../hud/questionPanelView.ts";
import { closeControl } from "../ui/closeControl.ts";
import { PALETTE } from "../ui/palette.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import type { DetailPicture } from "./detail.ts";
import {
  DETAIL_WELL_KEY,
  type DetailArt,
  type DetailFramed,
  type DetailMeasure,
  type DetailText,
} from "./detailCardView.ts";
import type { ConfirmChoice, ConfirmLines } from "./purchaseConfirm.ts";
import { purchaseConfirmLayout } from "./purchaseConfirmLayout.ts";

// The purchase confirm laid out as one view both renderers draw: the canvas's
// (drawPurchaseConfirm in src/scenes/purchaseConfirmView.ts) and the HTML interface's
// (src/hud/dom/purchaseConfirm.ts). Every rect and text origin is in game pixels.

export interface PurchaseConfirmCardView {
  // The well, then the item's picture in it, as a detail card's.
  readonly art: readonly DetailArt[];
  // The ui-detail-card, its title "Buy {name}?", close control, and Cancel then Buy.
  readonly card: QuestionPanelView;
  // The part of the screen dimmed under it.
  readonly dim: Rect;
  // The well's frame while its art is missing.
  readonly framed: readonly DetailFramed[];
  // Where the confirm's card lies, and where each answer and its close control are tapped.
  readonly hits: {
    readonly buttons: Readonly<Record<ConfirmChoice, Rect>>;
    readonly card: Rect;
    readonly close: Rect;
  };
  // The price, then the bank it would leave, each centred on the card.
  readonly texts: readonly DetailText[];
  readonly title: string;
}

// The answers, left to right: Cancel in the secondary look, Buy the call to action.
const CHOICES: readonly ConfirmChoice[] = ["cancel", "buy"];

// The confirm for lines and picture, the answer pressed names shown pressed.
export function purchaseConfirmCardView(
  measure: DetailMeasure,
  input: {
    readonly lines: ConfirmLines;
    readonly picture: DetailPicture;
    readonly pressed: ConfirmChoice | undefined;
  },
): PurchaseConfirmCardView {
  const { lines, picture, pressed } = input;
  const ink = (font: "body" | "title", text: string) => measure.inkWidth(font, text);
  const layout = purchaseConfirmLayout(
    { body: measure.body, title: measure.title },
    {
      buy: ink("title", lines.buy),
      cancel: ink("title", lines.cancel),
      left: ink("body", lines.left),
      price: ink("title", lines.price),
      title: ink("title", lines.title),
    },
  );
  const labels: Readonly<Record<ConfirmChoice, string>> = { buy: lines.buy, cancel: lines.cancel };
  const card = modalCardView(
    measure,
    layout.card,
    lines.title,
    CHOICES.map((choice) => ({
      label: labels[choice],
      primary: choice === "buy",
      rect: layout.buttons[choice],
      secondary: choice === "cancel",
    })),
  );
  const art: DetailArt[] = [];
  const framed: DetailFramed[] = [];
  const wellSize = measure.art(DETAIL_WELL_KEY);
  if (wellSize === undefined) {
    framed.push({ border: PALETTE.plum, fill: PALETTE.grey, rect: layout.well });
  } else {
    art.push({ key: DETAIL_WELL_KEY, scale: 1, size: wellSize, ...layout.well });
  }
  const shown = measure.art(picture.key);
  if (shown !== undefined) {
    art.push({
      holder: layout.well,
      key: picture.key,
      scale: picture.scale,
      size: shown,
      ...layout.picture,
    });
  }
  const centred = (
    at: { capTop: number; centreX: number; font: "body" | "title" },
    text: string,
    colour: number,
  ): DetailText => ({
    align: "centre",
    capTop: at.capTop,
    colour,
    font: at.font,
    lines: [text],
    scale: TEXT_SCALE,
    x: at.centreX,
  });
  return {
    art,
    card: {
      ...card,
      buttons: card.buttons.map((button, i) => ({
        ...button,
        pressed: CHOICES[i] === pressed,
      })),
    },
    dim: layout.dim,
    framed,
    hits: { buttons: layout.buttons, card: layout.card, close: closeControl(layout.card).hit },
    texts: [
      centred(layout.price, lines.price, PALETTE.plum),
      centred(layout.left, lines.left, PALETTE.darkBrown),
    ],
    title: lines.title,
  };
}
