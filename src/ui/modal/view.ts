import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { barTitleLeft, barTitleRoom } from "../barTitle.ts";
import { actionLabelCapTop, type LabelInk } from "../buttonGeometry.ts";
import { closeControl } from "../closeControl.ts";
import { PALETTE } from "../palette.ts";
import { BUTTON_COLOURS } from "../selection.ts";
import { ACTION_LABEL_SCALE, MODAL_TITLE_SCALE, TEXT_SCALE } from "../textFit.ts";
import { arrangePanelActions } from "./actionGroup.ts";
import { modalTitleLayout } from "./layout.ts";
import { modalTitleWidthAtScale } from "./titleRole.ts";
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
// the control leaves, its first line's capitals at capTop.
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
    {
      font: measure.title,
      inkOf: measure.titleInk,
      widthOf: (line) => measure.inkWidth("title", line),
    },
    barTitleRoom(row, close),
    title,
  );
  return titled.lines.map((line, i): PanelText => {
    const ink = modalTitleWidthAtScale(measure.inkWidth("title", line));
    return {
      capTop: capTop + titled.capOffset + i * titled.linePitch,
      centre: "ink",
      centreX: barTitleLeft(row, close, ink) + ink / 2,
      colour: PALETTE.plum,
      font: "title",
      line: i,
      scale: MODAL_TITLE_SCALE,
      text: line,
    };
  });
}

// The ink block of a title-font label's lines at TEXT_SCALE, a font line apart, from the first
// line's capitals' top: the glyphs' visible rows, punctuation included.
function labelInkAt(
  scale: number,
  measure: Pick<PanelMeasure, "title" | "titleInk">,
  lines: readonly string[],
): LabelInk {
  const pitch = measure.title.lineHeight * scale;
  const inks = lines.map((line, i) => {
    const ink = measure.titleInk(line);
    return {
      bottom: i * pitch + (ink.bottom * scale) / MODAL_TITLE_SCALE,
      top: i * pitch + (ink.top * scale) / MODAL_TITLE_SCALE,
    };
  });
  const top = Math.min(...inks.map((ink) => ink.top));
  return { rows: Math.max(...inks.map((ink) => ink.bottom)) - top, top };
}

// Compact tabs retain their existing text role.
export function titleLabelInk(
  measure: Pick<PanelMeasure, "title" | "titleInk">,
  lines: readonly string[],
): LabelInk {
  return labelInkAt(TEXT_SCALE, measure, lines);
}

export function actionLabelInk(
  measure: Pick<PanelMeasure, "title" | "titleInk">,
  lines: readonly string[],
): LabelInk {
  return labelInkAt(ACTION_LABEL_SCALE, measure, lines);
}

// An ordinary action's complete visible ink centred across and down its painted face.
export function panelButton(
  measure: Pick<PanelMeasure, "title" | "titleInk">,
  rect: Rect,
  primary: boolean,
  text: string,
): PanelButton {
  return {
    hit: rect,
    label: text,
    primary,
    rect,
    text: {
      capTop: actionLabelCapTop(rect, actionLabelInk(measure, [text])),
      centre: "ink",
      centreX: rect.x + rect.width / 2,
      colour: PALETTE[BUTTON_COLOURS[primary ? "primary" : "normal"].label],
      font: "title",
      line: 0,
      projection: "layout",
      scale: ACTION_LABEL_SCALE,
      text,
    },
  };
}

// A native modal card keeps its caller-owned bounds, shared title row and action geometry.
export function modalCardView(
  measure: PanelMeasure,
  card: Rect,
  title: string,
  actions: readonly CardAction[],
): QuestionPanelView {
  const buttons = actions.map(({ label, primary, rect, secondary }) => ({
    ...panelButton(measure, rect, primary, label),
    ...(secondary === true ? { secondary } : {}),
  }));
  const placed = arrangePanelActions(
    measure,
    card,
    actions.some(({ rect }) => rect.y !== actions[0]?.rect.y) ? "stack" : "row",
    buttons,
  );
  return {
    buttons: placed,
    close: closeControl(card),
    covered: [card, ...placed.map(({ hit }) => hit)],
    frame: "card",
    note: [],
    notePlate: undefined,
    panel: card,
    title: panelTitle(measure, card, cardTitleRow(card).y, title),
  };
}
