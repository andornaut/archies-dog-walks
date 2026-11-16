import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { sentences } from "@andornaut/game-kit/runtime/lines";
import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";

import { withKeyNumber } from "../input/keyNumbers.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { closeControl } from "../ui/closeControl.ts";
import { arrangePanelActions } from "../ui/modal/actionGroup.ts";
import { modalActionWidth, modalTitleLayout } from "../ui/modal/layout.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import type {
  PanelButton,
  PanelFont,
  PanelMeasure,
  PanelNotePart,
  PanelText,
  QuestionPanelView,
} from "../ui/modal/types.ts";
import { panelButton, panelTitle } from "../ui/modal/view.ts";
import { NOTE_PLATE, notePartTops, type pauseMenuLayout } from "./pauseMenu.ts";

export interface PanelQuestion {
  readonly avoid?: Rect | undefined;
  // Source label and digit order; placement moves the existing primary last.
  readonly labels: readonly string[];
  // pauseMenuLayout, the buttons then the note, or homeQuestionLayout, the note first.
  readonly layout: typeof pauseMenuLayout;
  // No parts draws no note plate.
  readonly note: readonly PanelNotePart[];
  readonly panelWidth?: number;
  readonly primary?: "first" | "last";
  // Whether each sentence of a part starts a line of its own.
  readonly sentenceLines: boolean;
  readonly showKeyNumbers?: boolean;
  readonly title: string;
}

// The panel centred in area: its title beside the close control in its top-right corner, as on
// every modal card, the buttons, and the note plate.
export function questionPanelView(
  measure: PanelMeasure,
  area: Rect,
  question: PanelQuestion,
): QuestionPanelView {
  const shown = question.labels.map((label, i) =>
    question.showKeyNumbers === false ? label : withKeyNumber(i + 1, label),
  );
  const widest = (font: PanelFont, lines: readonly string[]) =>
    Math.max(0, ...lines.map((line) => measure.inkWidth(font, line)));
  const parts = {
    avoid: question.avoid,
    buttonCount: shown.length,
    buttonWidths: shown.map((label) => modalActionWidth(widest("title", [label]))),
    ...(question.panelWidth === undefined ? {} : { panelWidth: question.panelWidth }),
    noteWidth: widest(
      "body",
      question.note.map(({ text }) => text),
    ),
    titleWidth: widest("title", [question.title]),
  };
  const preview = question.layout(measure.body, area, { ...parts, noteLines: 0 });
  const titleLayout = modalTitleLayout(
    {
      font: measure.title,
      inkOf: measure.titleInk,
      widthOf: (text) => measure.inkWidth("title", text),
    },
    barTitleRoom(cardTitleRow(preview.panel), closeControl(preview.panel)),
    question.title,
  );
  const noteRoom = preview.notePlate.width - 2 * NOTE_PLATE.padX;
  const noteParts = question.note.map(({ colour, text }) => ({
    colour,
    lines: (question.sentenceLines ? sentences(text) : [text]).flatMap((said) =>
      measure.wrapNote(noteRoom, said),
    ),
  }));
  const noteLines = noteParts.reduce((sum, part) => sum + part.lines.length, 0);
  const layout = question.layout(measure.body, area, {
    ...parts,
    noteLines,
    titleExtraHeight: titleLayout.extraHeight,
  });
  const { panel } = layout;
  const close = closeControl(panel);
  const centreX = panel.x + panel.width / 2;

  const title = panelTitle(measure, panel, layout.titleY, question.title);
  const buttons = shown.map((text, i): PanelButton => ({
    ...panelButton(
      measure,
      itemAt(layout.buttons, i),
      i === (question.primary === "last" ? shown.length - 1 : 0),
      text,
    ),
    hit: itemAt(layout.hits, i),
    label: itemAt(question.labels, i),
  }));

  const noted = noteParts.length > 0;
  const tops = notePartTops(
    measure.body,
    layout.notePlate,
    noteParts.map((part) => part.lines.length),
  );
  // The parts' lines run on as one block, a body line apart (notePartTops).
  const pitch = measure.body.lineHeight * NOTE_PLATE.scale;
  const starts = noteParts.map((_, i) =>
    noteParts.slice(0, i).reduce((sum, part) => sum + part.lines.length, 0),
  );
  const note = noteParts.flatMap(({ colour, lines }, i) =>
    lines.map((text, j): PanelText => ({
      capTop: itemAt(tops, i) + j * pitch,
      centre: "advance",
      centreX,
      colour,
      font: "body",
      line: itemAt(starts, i) + j,
      scale: NOTE_PLATE.scale,
      text,
    })),
  );

  const actions = arrangePanelActions(measure, panel, "column", buttons);
  return {
    buttons: actions,
    close,
    covered: [insetRect(-1, panel), ...actions.map(({ hit }) => hit)],
    frame: "panel",
    note,
    notePlate: noted ? layout.notePlate : undefined,
    panel,
    title,
    titleY: layout.titleY,
  };
}
