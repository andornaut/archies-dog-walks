import { itemAt } from "@andornaut/game-kit/arrays";
import { sentences } from "@andornaut/game-kit/lines";
import { insetRect, type Rect } from "@andornaut/game-kit/rect";

import { withKeyNumber } from "../input/keyNumbers.ts";
import { closeControl } from "../ui/closeControl.ts";
import { modalActionWidth } from "../ui/modal/layout.ts";
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
  // Each button's label, top to bottom: the first is the call to action and key 1.
  readonly labels: readonly string[];
  // pauseMenuLayout, the buttons then the note, or homeQuestionLayout, the note first.
  readonly layout: typeof pauseMenuLayout;
  // No parts draws no note plate.
  readonly note: readonly PanelNotePart[];
  // Whether each sentence of a part starts a line of its own.
  readonly sentenceLines: boolean;
  readonly title: string;
}

// The panel centred in area: its title beside the close control in its top-right corner, as on
// every modal card, the buttons, and the note plate.
export function questionPanelView(
  measure: PanelMeasure,
  area: Rect,
  question: PanelQuestion,
): QuestionPanelView {
  const shown = question.labels.map((label, i) => withKeyNumber(i + 1, label));
  const widest = (font: PanelFont, lines: readonly string[]) =>
    Math.max(0, ...lines.map((line) => measure.inkWidth(font, line)));
  const parts = {
    avoid: question.avoid,
    buttonCount: shown.length,
    buttonWidths: shown.map((label) => modalActionWidth(widest("title", [label]))),
    noteWidth: widest(
      "body",
      question.note.map(({ text }) => text),
    ),
    titleWidth: widest("title", [question.title]),
  };
  const preview = question.layout(measure.body, area, { ...parts, noteLines: 0 });
  const noteRoom = preview.notePlate.width - 2 * NOTE_PLATE.padX;
  const noteParts = question.note.map(({ colour, text }) => ({
    colour,
    lines: (question.sentenceLines ? sentences(text) : [text]).flatMap((said) =>
      measure.wrapNote(noteRoom, said),
    ),
  }));
  const noteLines = noteParts.reduce((sum, part) => sum + part.lines.length, 0);
  const layout = question.layout(measure.body, area, { ...parts, noteLines });
  const { panel } = layout;
  const close = closeControl(panel);
  const centreX = panel.x + panel.width / 2;

  const title = panelTitle(measure, panel, layout.titleY, question.title);
  const buttons = shown.map((text, i): PanelButton => ({
    ...panelButton(measure, itemAt(layout.buttons, i), i === 0, text),
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

  return {
    buttons,
    close,
    covered: [insetRect(-1, panel), ...layout.hits],
    frame: "panel",
    note,
    notePlate: noted ? layout.notePlate : undefined,
    panel,
    title,
    titleY: layout.titleY,
  };
}
