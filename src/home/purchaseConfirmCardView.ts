import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { barTitleRoom } from "../ui/barTitle.ts";
import { closeControl } from "../ui/closeControl.ts";
import { modalTitleLayout } from "../ui/modal/layout.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { type QuestionPanelView } from "../ui/modal/types.ts";
import { modalCardView } from "../ui/modal/view.ts";
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

// Native purchase confirmation uses this shared view in logical game pixels.

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
  const sizes = {
    buy: ink("title", lines.buy),
    cancel: ink("title", lines.cancel),
    left: ink("body", lines.left),
    price: ink("title", lines.price),
    title: ink("title", lines.title),
  };
  const fonts = { body: measure.body, title: measure.title };
  const preview = purchaseConfirmLayout(fonts, sizes);
  const heading = modalTitleLayout(
    {
      font: measure.title,
      inkOf: measure.titleInk,
      widthOf: (line) => measure.inkWidth("title", line),
    },
    barTitleRoom(cardTitleRow(preview.card), closeControl(preview.card)),
    lines.title,
  );
  const layout = purchaseConfirmLayout(fonts, { ...sizes, titleExtraHeight: heading.extraHeight });
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
    framed.push({
      border: PALETTE.plum,
      fill: PALETTE.grey,
      projection: "layout",
      rect: layout.well,
    });
  } else {
    art.push({
      key: DETAIL_WELL_KEY,
      projection: "layout",
      scale: 1,
      size: wellSize,
      ...layout.well,
    });
  }
  const shown = measure.art(picture.key);
  if (shown !== undefined) {
    art.push({
      holder: layout.well,
      key: picture.key,
      projection: "layout",
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
        pressed: CHOICES[button.actionIndex ?? i] === pressed,
      })),
    },
    dim: layout.dim,
    framed,
    hits: {
      buttons: Object.fromEntries(
        CHOICES.map((choice, index) => [
          choice,
          card.buttons.find((button) => button.actionIndex === index)!.rect,
        ]),
      ) as Record<ConfirmChoice, Rect>,
      card: layout.card,
      close: closeControl(layout.card).hit,
    },
    texts: [
      centred(layout.price, lines.price, PALETTE.plum),
      centred(layout.left, lines.left, PALETTE.darkBrown),
    ],
    title: lines.title,
  };
}
