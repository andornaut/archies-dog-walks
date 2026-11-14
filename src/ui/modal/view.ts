import type { Rect } from "@andornaut/game-kit/rect";

import { HOME_SCREEN } from "../../data/layout.ts";
import { barTitleLeft, barTitleRoom } from "../barTitle.ts";
import { closeControl } from "../closeControl.ts";
import { PALETTE } from "../palette.ts";
import { BUTTON_COLOURS, BUTTON_LIP_PX } from "../selection.ts";
import { TEXT_SCALE } from "../textFit.ts";
import { modalTitleLayout } from "./layout.ts";
import { cardTitleRow } from "./titleRow.ts";
import type {
  CardAction,
  PanelButton,
  PanelMeasure,
  PanelText,
  QuestionPanelView,
} from "./types.ts";

// A modal card's or panel's title in plum on its title row beside the close control in its
// top-right corner, or with none where it does not close, each line's ink centred in the room
// the control leaves, its first line's capitals at capTop, as the canvas draws it
// (addCardTitle).
export function panelTitle(
  measure: PanelMeasure,
  panel: Rect,
  capTop: number,
  title: string,
  closes = true,
): PanelText[] {
  const row = cardTitleRow(panel);
  const close = closes ? closeControl(panel) : undefined;
  const titled = modalTitleLayout(
    { font: measure.title, widthOf: (line) => measure.inkWidth("title", line) },
    barTitleRoom(row, close),
    title,
  );
  return titled.lines.map((line, i): PanelText => {
    const ink = measure.inkWidth("title", line);
    return {
      capTop: capTop + i * titled.linePitch,
      centre: "ink",
      centreX: barTitleLeft(row, close, ink) + ink / 2,
      colour: PALETTE.plum,
      font: "title",
      line: i,
      scale: TEXT_SCALE,
      text: line,
    };
  });
}

// A button with text as its label, primary or normal, its hit its face: the label's line
// centred on the face over the lip, as the canvas centres a one-line label on its height, a font
// line, its capitals capTop rows into the line (addMenuButton).
export function panelButton(
  measure: PanelMeasure,
  rect: Rect,
  primary: boolean,
  text: string,
): PanelButton {
  const { capTop, lineHeight } = measure.title;
  const lineToCaps = (capTop - lineHeight / 2) * TEXT_SCALE;
  return {
    hit: rect,
    label: text,
    primary,
    rect,
    text: {
      capTop: Math.round(rect.y + (rect.height - BUTTON_LIP_PX) / 2 + lineToCaps),
      centre: "advance",
      centreX: rect.x + rect.width / 2,
      colour: PALETTE[BUTTON_COLOURS[primary ? "primary" : "normal"].label],
      font: "title",
      line: 0,
      scale: TEXT_SCALE,
      text,
    },
  };
}

// A modal card laid out by its caller (an update notice's, updateModalLayout): the ui-detail-card
// over card, its title on its title row beside the close control, and its buttons, as the canvas
// draws it (addModalCard, addMenuButton).
export function modalCardView(
  measure: PanelMeasure,
  card: Rect,
  title: string,
  actions: readonly CardAction[],
): QuestionPanelView {
  const titleY = cardTitleRow(card).y + HOME_SCREEN.card.titleRow.titleY;
  const buttons = actions.map(({ label, primary, rect, secondary }) => ({
    ...panelButton(measure, rect, primary, label),
    ...(secondary === true ? { secondary } : {}),
  }));
  return {
    buttons,
    close: closeControl(card),
    covered: [card, ...buttons.map(({ hit }) => hit)],
    frame: "card",
    note: [],
    notePlate: undefined,
    panel: card,
    title: panelTitle(measure, card, titleY, title),
    titleY,
  };
}
